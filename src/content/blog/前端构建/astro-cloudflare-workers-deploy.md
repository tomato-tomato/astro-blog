---
title: '把 Astro 7 博客部署到 Cloudflare：完整步骤、要点与避坑清单'
description: '从本地到 workers.dev 上线的全过程：Pages 还是 Workers 怎么选、四个「名称/地址」怎么对齐、构建命令与 wrangler.jsonc 怎么填，以及 13 个按「会不会让构建直接失败」分级的坑。'
pubDate: 'Oct 18 2026'
tags: [Astro, Cloudflare, 部署, CI]
---

把静态博客部署到 Cloudflare，框架本身这一步几乎没有难度——真正花时间的是**配置**，以及那些不会立刻报错、却在线上留下隐患的细节。

这篇是我把一个 Astro 博客（Astro 5 → 7）从本地跑到 `workers.dev` 上线的完整记录，涵盖：

- Cloudflare 上到底怎么选：Pages 还是 Workers
- 创建应用时「构建命令 / 部署命令 / 预览命令」分别填什么
- 分支怎么对应到线上地址
- 我在过程中踩到的 13 个坑，按「会不会让构建直接失败」分级

> 环境：Astro 7.4.0、pnpm 10.11.1 / 12.3.4、Node 24、Cloudflare Workers + Workers Builds。

## 先建立一个心智模型：地址由谁决定

Cloudflare 的部署链路里有**四个不同的「名称/地址」**，混在一起就会晕：

| 名称 | 由谁决定 | 作用 |
|---|---|---|
| **仓库名** | GitHub | 只决定代码从哪来 |
| **Worker 名 / 项目名** | 你在 Cloudflare 创建应用时填的 | 决定访问地址的**前缀** |
| **workers.dev 子域** | Cloudflare 账号级设置，全账号共用 | 决定访问地址的**后缀** |
| **站点域名（`site`）** | 你写在 `astro.config.mjs` 里的 | 决定 **canonical / sitemap / rss 里写什么地址** |

拼起来：

```text
https://  <Worker 名>  .  <workers.dev 子域>  .workers.dev
           astro-blog       tomato-tomato
```

两条容易忽略的事实：

- **`Worker 名` 必须和仓库里 `wrangler.jsonc` 的 `name` 完全一致**，否则 Workers Builds **直接构建失败**（官方明确要求二者一致）。
- 这个名字要当 DNS 标签用，所以限制是：≤ 63 字符，只允许 `a-zA-Z0-9-`，不能以 `-` 开头或结尾。`tomato-tomato` 合法，`tomato_tomato` 不合法。

> 对照记一下：Pages 项目名是**全平台唯一**的，撞名会被自动加随机后缀；**Workers 的 Worker 名只要账号内唯一**，所以能完整保留你想要的地址。

## 决策：Pages 还是 Workers

这是第一个岔路口，因为它决定了你界面上能看到哪些字段。

| | **Cloudflare Pages** | **Cloudflare Workers** |
|---|---|---|
| 创建应用后的字段 | Production branch、Build command、**Build output directory** | 构建命令、**部署命令**、**预览命令** |
| 输出目录怎么定 | 面板里填 | `wrangler.jsonc` 的 `assets.directory` |
| 自定义域名 | 支持 NS 不在 Cloudflare 的域名（CNAME 接入） | **只支持 NS 已在 Cloudflare 的域名** |
| 分支控制粒度 | 精细（可只放行 `release/*` 等） | 目前是「开预览 / 关预览」这个量级 |
| 配置文件 | 不需要 | **必须有 `wrangler.jsonc`** |

**怎么判断你现在建的是哪种**：如果你在创建页看到「部署命令」「预览命令」两个字段，那说明你建的是 **Workers**——Pages 根本没有这两个字段。

**对纯静态博客，两者最终效果一致、都免费。** 已经建了 Workers 就继续用，把 `wrangler.jsonc` 提交上去即可。

> 如果你打算把域名 NS 迁到 Cloudflare，先确认一件事：**Workers 只认 NS 在 Cloudflare 的域名**。域名托管在别处的话，要么迁 NS，要么改用 Pages。

## 动手前的准备

### 三处必须先改的占位内容

Astro 官方 blog starter 里默认带一堆占位符，它们在部署前是**真的会出错**的：

| 位置 | 默认值 | 影响 |
|---|---|---|
| `astro.config.mjs` 的 `site` | `https://example.com` | canonical、og:url、`rss.xml`、`sitemap.xml` 全指向它 |
| `src/consts.ts` | `SITE_TITLE = 'Astro Blog'` | 页面标题、RSS 标题 |
| `src/components/Footer.astro` | `Your name here` | 页脚署名 |

其中 **`site` 是必须改的**。我实测过：不改的话构建出来的 `rss.xml` 里写的是 `<link>https://example.com/blog/first-post/</link>`，`sitemap-0.xml` 里是 `<loc>https://example.com/</loc>`。

**这带来的代价不只是「改完重新部署一次」**——在你改之前，搜索引擎收录的全是 example.com 的错误地址。

### 三行必须有且在版本控制里的文件

```text
.nvmrc               # Node 版本
wrangler.jsonc       # Workers 部署配置（走 Pages 则不需要）
pnpm-lock.yaml       # 必须提交！
```

`.nvmrc` 内容写 `22.22.0`。注意**不是**官方文档里写的 22.12——原因见避坑 G5。

### 本地三条命令先跑绿

```bash
pnpm install --frozen-lockfile   # 模拟 Cloudflare 的安装步骤
pnpm build                       # 产出 dist/
pnpm dlx wrangler deploy --dry-run   # 只校验配置 + 清点资源，不上传
```

**为什么一定要带 `--frozen-lockfile`**：Cloudflare 检测到 `pnpm-lock.yaml` 后，自动执行的正是这个命令。本地用普通 `pnpm install` 能过、CI 挂掉，绝大多数是这里暴露的（避坑 G4、G6）。

`wrangler deploy --dry-run` 会在**不上传**的前提下读完 `wrangler.jsonc` 并清点资源，是部署前最便宜的验证：

```text
✨ Read 39 files from the assets directory /path/to/dist
Total Upload: 0.34 KiB / gzip: 0.25 KiB
No bindings found.
--dry-run: exiting now.
```

## 部署七步

### 步骤 1：创建应用，填对项目名

Workers & Pages → **Create application** → 连接 GitHub 仓库。

**项目名就填和 `wrangler.jsonc` 里 `name` 一样的值**（本文用 `astro-blog`，和仓库名一致最省事）。

### 步骤 2：填三个命令

| 字段 | 值 |
|---|---|
| 构建命令 | `pnpm build` |
| 部署命令 | `npx wrangler deploy` |
| 预览命令 | `npx wrangler preview` |

要点：

- **不要在构建命令里再写 `pnpm install`**。Cloudflare 会自动检测 `pnpm-lock.yaml` 并安装依赖，重复写只会变慢。
- **不要把部署命令写成 `npx wrangler pages deploy`**。那是 Pages 的旧命令，在 Workers 项目里会失败。
- 后两个字段就是默认值，等于不用动。

### 步骤 3：加一个构建变量 `SITE`

```text
Worker → Settings → Build → Build Variables and Secrets
  变量名：SITE
  值：    https://astro-blog.tomato-tomato.workers.dev
```

`site` 是**构建期**写进产物的，所以必须让构建命令知道真实地址。用环境变量而不是写死代码的好处是：以后绑自定义域名，只改这里 + 重新部署，代码一行不动。

> 注意：**改了这个变量必须重新部署才生效**，光保存变量不会触发构建。

### 步骤 4：写 `wrangler.jsonc`

纯静态站只需要这些：

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "astro-blog",                    // 必须与面板上的 Worker 名一致
  "compatibility_date": "2026-10-16",      // 建议改成部署当天
  "assets": {
    "directory": "./dist",                 // 取代 Pages 的「输出目录」字段
    "not_found_handling": "404-page"       // 404 走自己的 404.html
  }
}
```

没有这个文件会怎样？实测直接报错，构建当场失败：

```text
✘ [ERROR] Missing entry-point to Worker script or to assets directory
```

> 补充：如果仓库里没有 wrangler 配置，`wrangler deploy` 会触发 **autoconfig**，检测到 Astro 后**自动开一个 PR**（不会直接改你的分支）。现在有了 `wrangler.jsonc` 通常不会再触发；如果还是收到这个 PR，审查后合并或直接关掉——它写的内容和手写版基本一致。

### 步骤 5：让 `site` 支持环境变量

`astro.config.mjs`：

```js
// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

const PRODUCTION_SITE = "https://astro-blog.tomato-tomato.workers.dev";
const site = process.env.SITE ?? PRODUCTION_SITE;

// 兜底：别让占位地址静默产出错误的 canonical / sitemap
if (!site.startsWith("https://") || site.includes("example.com")) {
  throw new Error(`[astro.config.mjs] site 配置有误（当前值：${site}）`);
}

export default defineConfig({
  site,
  integrations: [mdx(), sitemap()],
  compressHTML: true,   // Astro 7 必加，见避坑 G8
});
```

配套把 `public/robots.txt` 的 sitemap 改成**相对路径**：

```txt
User-agent: *
Allow: /

Sitemap: /sitemap-index.xml
```

`robots.txt` 必须位于站点根目录，相对路径会被解析成 `https://你的地址/sitemap-index.xml`。这样以后换域名不用再改这个文件。

### 步骤 6：首次部署 + 验证

Save and Deploy，等 1–3 分钟，拿到地址后逐项确认：

```bash
# 1. 地址能开、HTTPS 正常
curl -I https://astro-blog.tomato-tomato.workers.dev/

# 2. canonical 指向正确（不是 example.com）
curl -s https://astro-blog.tomato-tomato.workers.dev/ | grep -o 'rel="canonical" href="[^"]*"'

# 3. sitemap / rss 里的地址正确
curl -s https://astro-blog.tomato-tomato.workers.dev/sitemap-index.xml
curl -s https://astro-blog.tomato-tomato.workers.dev/rss.xml | head -5

# 4. 404 走自己的页面
curl -I https://astro-blog.tomato-tomato.workers.dev/no-such-page
```

**特别要核对地址本身**：如果 Cloudflare 给你的子域带了后缀（如 `tomato-tomato-abc`），上面的 `SITE` 和 `PRODUCTION_SITE` 都要跟着改，然后**重新部署**。

### 步骤 7（可选）：绑自定义域名

`workers.dev` 可以用，但它有两个问题：**国内可达性不稳定**、名字不好看。要稳定访问就绑自己的域名。

- Workers：**只支持 NS 已在 Cloudflare 的域名**。域名在别处就先迁 NS。
- 绑好之后：把 `SITE` 改成新域名 → **重新部署**（canonical/sitemap 是构建期写死的，不重部署不生效）。
- 不需要备案——用的是海外节点。

## 避坑清单（13 条）

按「会不会让构建直接失败」分三级。

### A 级：会让构建直接失败

**G1. `pnpm-workspace.yaml` 里的 `allowBuilds` 占位符**

这是最隐蔽的一个。pnpm 12 的 `approve-builds` 会把白名单写进 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  esbuild: set this to true or false   # ← pnpm 生成的占位符，没人改
  sharp: set this to true or false
```

而 **Cloudflare 构建镜像默认的 pnpm 是 10.11.1，根本不认识 `allowBuilds` 这个键**。实测后果：

- pnpm 12 下 `pnpm install --frozen-lockfile`：**exit 1**，报 `ERR_PNPM_IGNORED_BUILDS`
- pnpm 10 下：不报错，但**白名单完全不生效**，`sharp` 构建脚本照样被拦

**修法**：把白名单放进 `package.json`（pnpm 10 和 12 都认，两个版本我都实测过）：

```json
"pnpm": {
  "onlyBuiltDependencies": ["esbuild", "sharp"]
}
```

**G2. 缺 `wrangler.jsonc`**

报错原文：`Missing entry-point to Worker script or to assets directory`。见步骤 4。

**G3. Worker 名不一致**

面板上的 Worker 名 ≠ `wrangler.jsonc` 的 `name` → Workers Builds 直接构建失败。**改名字时两个地方都要改。**

**G4. lockfile 过期**

改了 `package.json` 里的依赖版本范围却没重新生成 lockfile → `ERR_PNPM_OUTDATED_LOCKFILE`，`--frozen-lockfile` 直接失败。

**修法**：`pnpm install --lockfile-only`。

**G5. Node 版本配低了**

官方文档说 Astro 7 要求 Node `>= 22.12.0`，但**实际项目里装的 `astro@7.4.0` 声明的 `engines` 是 `>= 22.22.0`**。按 22.12 配构建机会遇到 `Unsupported engine`。

**修法**：`.nvmrc` 写 `22.22.0` 或更高。好消息是 Workers Builds 默认 Node 24.18.0，**不覆盖就没事**；要覆盖的话别低于 22.22.0。

**G6. `sharp` 版本与 Astro 7 不一致**

`package.json` 里写 `sharp@^0.34.2`，而 Astro 7 自己声明的是 `optionalDependencies: { sharp: "^0.35.4" }` → lockfile 里**同时装两套 sharp**，连同各自的 `@img/sharp-*` 平台包全部重复。

**修法**：统一到 `^0.35.5`，然后重新生成 lockfile（否则踩 G4）。

### B 级：不报错，但线上是错的

**G7. `site` 还是占位符**

不报错、构建成功、页面也能打开——但 canonical / sitemap / rss 全指向 `example.com`。这种「看起来正常」的错误最难发现。

**建议加一道构建期守卫**（就是步骤 5 里那段 `throw`），让它在构建日志里明确失败。

**G8. `compressHTML` 默认值变了（Astro 7）**

Astro 7 把 `compressHTML` 的默认值从 `true` 改成了 `'jsx'`。新默认会**按 JSX 规则剥掉标签相邻处的空白**——换行紧贴标签时，那个空格会被删掉。

实测在一个 Astro blog starter 上造成了 **6 处真实视觉回归**，全部集中在「文字与行内标签混排且换行」的地方：

| 期望 | 实际（默认 `'jsx'`） |
|---|---|
| `configured in your astro.config.mjs` | `configured in yourastro.config.mjs` |
| `your setup with Astro Integrations` | `your setup withAstro Integrations` |
| `remember to read the docs` | `remember toread the docs` |

**修法**：`compressHTML: true`（官方推荐的回退方案）。或者给每处显式补 `{" "}`。

这个坑要记住的是：**你重写页面文案后，只要还有「文字换行接行内标签」的写法，同样会中招**。所以建议保留这个配置当兜底。

**G9. 没有 404 页面**

不存在的路径会返回 Cloudflare 自己的默认错误页。静态站一定会遇到这种情况（旧链接、爬虫、手滑），建议加 `src/pages/404.astro`，并在 `wrangler.jsonc` 里设 `not_found_handling: "404-page"`（Workers 要求显式声明，不像 Pages 会自动探测）。

页面里记得加 `<meta name="robots" content="noindex">`。

### C 级：知道就行

**G10. 预览部署默认公开**

非生产分支的构建默认**任何人可访问**。它们自带 `X-Robots-Tag: noindex`，不会污染 SEO，但内容是公开的。要锁的话：Settings → General → Enable access policy（Cloudflare Access）。

**G11. 免费额度与硬限制**

| 项 | Pages（Free） | Workers Builds（Free） |
|---|---|---|
| 构建 | 500 次/月 | 3,000 构建分钟/月 |
| 并发 | 1 | 1 |
| 超时 | 20 分钟 | 20 分钟 |
| 文件 | 单文件 ≤ 25 MiB | 同左 |

个人博客离这些限制很远。**唯一要留意的是单文件 25 MiB**——以后往 `public/` 放视频会撞墙，那种文件应该放 R2。

**G12. 缓存头不用手写**

Cloudflare 对**文件名带 hash 的静态资源会自动下发一年期 immutable 缓存**。我实测：

```bash
curl -I https://astro.build/_astro/xxx.js
# cache-control: max-age=31536000, immutable, public
```

所以**不需要**在 `_headers` 里给 `/_astro/*` 加缓存规则，写了反而可能在平台默认值变化时冲突。`public/_headers` 和 `public/_redirects` 会被复制进 `dist/`，由 Cloudflare 解析（Pages 和 Workers 静态资源都支持）。

> `pnpm preview` 是 Vite 预览服务器，它的响应头**不代表线上行为**，验证缓存头要用 `curl`。

**G13. 分支与部署的对应关系**

不需要合并到 `main` 才能上线——**生产分支是面板里的一个下拉框**，可以指向任意远端分支。但有三条硬约束：

1. **只有 push 到远端才触发构建**，本地 commit 不会让 Cloudflare 有任何动作；
2. 能选的分支**只限远端已存在的分支**；
3. 生产分支长期指向临时分支，分支一改名/删除，构建链路就断了——所以最终还是建议合并回 `main`。

## 上线检查表

```bash
# 本地
pnpm install --frozen-lockfile    # exit 0
pnpm build                        # exit 0，dist/ 产出完整
pnpm dlx wrangler deploy --dry-run   # 读到资源、无报错
```

- [ ] `wrangler.jsonc` 的 `name` == 面板上的 Worker 名
- [ ] 构建命令 `pnpm build`、部署命令 `npx wrangler deploy`、预览命令 `npx wrangler preview`
- [ ] 构建变量 `SITE` 已设置，且**部署后核对过实际地址**
- [ ] `site` 不是 `example.com`
- [ ] `robots.txt` 的 sitemap 用相对路径
- [ ] 有 `404.astro`，且 `wrangler.jsonc` 里 `not_found_handling: "404-page"`
- [ ] 首页 / `/blog` / `/about` / 文章页 都能打开
- [ ] `curl` 检查过 canonical、sitemap、rss 里的地址
- [ ] 构建耗时远低于 20 分钟超时

## 结语

回头看，这套流程真正的难点不在 Astro，也不在 Cloudflare，而在**四个「名称/地址」的对齐**，以及**依赖管理层的版本一致性**。

一句话总结这篇的经验：

> **部署到 Cloudflare 时，「构建成功」不等于「线上正确」。**
>
> 构建成功只证明代码能编译；canonical 和 sitemap 里的地址是否对、404 是否体面、缓存是否合理，都是构建不报错但会长期影响站点的事——所以检查表里那些 `curl` 才是重点。

另外值得记住的一条：**云端的构建环境和你本地不一样**。`pnpm` 版本、Node 版本、lockfile 一致性，这三个变量任何一个对不上，就会出现「本地一切正常、CI 直接红」。所以本地那条 `pnpm install --frozen-lockfile` 不是多余的仪式，它是最便宜的一次云端彩排。
