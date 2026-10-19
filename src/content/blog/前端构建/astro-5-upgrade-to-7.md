---
title: 'Astro 5 升到 Astro 7：真正要防的不是破坏性变更，而是依赖层的连锁反应'
description: '一次 Astro 5.12 → 7.4 的实测复盘：代码零改动就能构建通过，但 compressHTML 默认值、pnpm 安装脚本白名单、lockfile 一致性和 Node engines 这四类依赖层问题，会让本地一切正常、云端 CI 直接红。'
pubDate: 'Oct 17 2026'
tags: [Astro, 升级, 依赖管理, pnpm]
---

升级一个静态博客框架，直觉上最担心的是「官方破坏性变更把代码搞坏」。

但我把一个 Astro 5.12 的官方 blog starter 升到 Astro 7.4 之后，得到的结论正好相反：

> **代码层面几乎零改动就能构建通过。真正的坑全在依赖管理层——版本声明、lockfile、安装脚本白名单。**
>
> 而且这些坑有个共同特征：**本地能过，云端 CI 直接红**。

这篇是这次升级的完整复盘：版本选型、必改项、实测发现的唯一真实回归、逐条破坏性变更核对，以及那批「升级之后才暴露出来、看起来跟升级无关」的依赖问题。

## 先说结论

| 验证项 | 实测结果 |
|---|---|
| 升级到 `astro@7.4.0` + 集成新版本 | ✅ 成功 |
| `pnpm build` | ✅ 成功，9 个页面，无 error / warning |
| 是否需要改代码才能构建 | ✅ **完全不需要**，零改动即可通过 |
| 官方警告的「Rust 编译器不容忍未闭合标签」 | ✅ 未触发（模板里那批 Prettier 生成的怪格式 SVG 被正常处理） |
| **`compressHTML` 默认值变更** | ❌ **唯一真实的视觉回归**，见「唯一的真回归」一节 |
| Node 版本要求 | ⚠️ 文档说 22.12，实际依赖要求 22.22，见「前置条件」一节 |
| 图片尺寸 | ⚠️ hero 图从 1020×510 变成 960×480（不放大），宽高比一致、不变形 |
| pnpm 安装脚本拦截 | ⚠️ 需要白名单，且**写错位置会让 CI 直接失败**，见「依赖层的四个坑」一节 |

一句话：**升级动作本身很轻，重的是升级后对依赖配置的重新审视。**

## 版本选型：五个包一起动

Astro 7 的官方集成有 peer 约束，不能只升 `astro`。本次的版本矩阵：

| 包 | 原版本 | 目标版本 | 依据 |
|---|---|---|---|
| `astro` | `^5.12.0` | **`^7.4.0`** | 升级当天的 `latest`（7.3.8）随后推进到 7.4.0 |
| `@astrojs/mdx` | `^4.3.1` | **`^8.1.0`** | 其 `peerDependencies.astro` 要求 `^7.2.10`，必须跟着升 |
| `@astrojs/rss` | `^4.0.12` | **`^4.0.19`** | 无 peer 约束 |
| `@astrojs/sitemap` | `^3.4.1` | **`^3.7.4`** | 无 peer 约束 |
| `sharp` | `^0.34.2` | **`^0.35.5`** | 图片优化；Astro 7 自己声明的范围是 `^0.35.4`，见「依赖层的四个坑」 |

> **不用手动装 `@astrojs/markdown-satteri`**：Astro 7 已把它列为直接依赖，`@astrojs/mdx@8` 也直接依赖它。实测自动装好了。

**不用分两步（5→6→7）**。我原以为需要，实测证明一步到位零障碍。真出问题时再回退到 `astro@^6.x` 分两步排查即可。

## 前置条件：Node 版本要按实际的 `engines` 走

Astro 6 起**彻底放弃 Node 18/20**。官方文档写的是 `>= 22.12.0`，但**项目里实际装的 `astro@7.4.0` 声明的 `engines.node` 是 `>= 22.22.0`**。

一条命令就能复核：

```bash
node -p "require('./node_modules/astro/package.json').engines.node"
# >=22.22.0
```

**结论：按 22.22.0 配，别按 22.12.0。** 这是典型的「文档说够、实际不够」——按 22.12 去配构建机，会遇到 `Unsupported engine`。

配套动作：在项目根目录加 `.nvmrc`，内容 `22.22.0`（**记得结尾留换行符**，有些工具解析不带换行的版本文件会出问题）。

## 执行步骤

### ① 留回滚点

```bash
git checkout -b upgrade/astro7
```

升级期间所有改动都在这个分支上，出问题随时切回主线。

### ② 升级（二选一）

```bash
# 方式一：官方一键升级（同时升级 astro 和所有官方集成）
pnpm dlx @astrojs/upgrade

# 方式二：手动指定版本（可精确控制，本次实测用的是这个）
pnpm add astro@^7.4.0 @astrojs/mdx@^8.1.0 @astrojs/rss@^4.0.19 \
        @astrojs/sitemap@^3.7.4 sharp@^0.35.5
```

### ③ 改代码——实际只有 2 处

**改动 1（建议，非必须）：`src/content.config.ts` 的 `z` 导入**

```diff
-import { defineCollection, z } from 'astro:content';
+import { defineCollection } from 'astro:content';
+import { z } from 'astro/zod';
```

- **实测**：不改也能构建成功、没有警告
- **但建议改**：`z` 从 `astro:content` 导出在 v6 已被标记弃用，v7 的 `astro:content` 参考文档导出清单里已经没有它。属于「运行时还没删、文档已经不算数」的状态，随手改掉省心。

**改动 2（必须）：`astro.config.mjs` 加一行**

```diff
 export default defineConfig({
   site: 'https://example.com',
   integrations: [mdx(), sitemap()],
+  compressHTML: true,
 });
```

原因见下一节——这是本次升级**唯一的真实破坏**。

### ④ 构建验证

```bash
pnpm install
pnpm build
pnpm dev   # http://localhost:4321
```

## 唯一的真回归：`compressHTML` 默认值变了

**变更内容**：Astro 7 把 `compressHTML` 的默认值从 `true` 改成了 `'jsx'`。新默认行为会**按 JSX 规则剥掉标签相邻处的空白**——具体说，**换行紧挨着标签时，那个空格会被删掉**。

**实测方法**：同一份代码分别用 `'jsx'`（默认）和 `true` 构建，抽取可见文本逐页对比。

结果分两类。

**A 类——无视觉影响**：所有页面的页头导航、页脚图标、`<p>` 之间、`<li>` 之间。这些容器是 flex 或 block，去掉空白不影响渲染。

**B 类——真实视觉回归**：**共 6 处，全部集中在 `src/pages/index.astro`**。它是全站唯一「行内元素与文字混排且换行」的页面。

| # | 期望渲染 | 默认 `'jsx'` 下实际渲染 |
|---|---|---|
| 1 | `configured in your ` + 代码块 | `configured in your` + 代码块（空格丢失） |
| 2 | `your setup with Astro Integrations` | `your setup withAstro Integrations` |
| 3 | `remember to read the docs` | `remember toread the docs` |
| 4 | `read the docs or join us on Discord` | `read the docsor join us on Discord` |
| 5 | `Check out astro-blog-template` | `Check outastro-blog-template` |
| 6 | `astro-blog-template by Maxi Ferreira` | `astro-blog-templateby Maxi Ferreira` |

**修复**：`compressHTML: true`。实测验证过修复有效——加上后重新构建，上述 6 处空格全部恢复，`pnpm build` 依然零 error。

**备选修法**（不想全局关压缩）：在源码里给这 6 处显式补空格：

```astro
configured in your{" "}<code>astro.config.mjs</code>
```

对个人博客来说，直接 `compressHTML: true` 更省事，也是官方指南给出的推荐回退方案。

> 顺带提醒：`index.astro` 是 starter 引导文案，你迟早要重写。但**在你重写之前，这个空格问题是真实存在的**；而且重写后的新文案只要还有「文字换行接行内标签」的写法，同样会中招。所以建议保留 `compressHTML: true` 作为兜底。

## 升级之后才暴露的：依赖层的四个坑

这一节是这次升级最值钱的部分。它们的共同点是——**和 Astro 7 没有直接关系，但升级动作会触发它们**，而且**本地往往看不出来**。

### 坑 1：`sharp` 版本与 Astro 7 不一致，lockfile 里装了两套

原 `package.json` 写 `sharp: "^0.34.2"`，而 `astro@7.4.0` 自己声明：

```json
"optionalDependencies": { "sharp": "^0.35.4" }
```

结果 `pnpm-lock.yaml` 里**同时存在 sharp 0.34.3 和 0.35.5 两套**，连同各自的 `@img/sharp-*` 平台包全部重复（这个项目的 lockfile 因此多了 320 多行冗余内容）。

**修法**：统一到 `^0.35.5`。

### 坑 2：改了版本范围，`--frozen-lockfile` 直接失败

改完 `package.json` 的依赖范围后，如果不重新生成 lockfile：

```text
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile"
because pnpm-lock.yaml is not up to date with <ROOT>/package.json
```

**修法**：

```bash
pnpm install --lockfile-only
```

> 这一条在本地用普通 `pnpm install` 是**看不出来**的——它会自动更新 lockfile，一切正常。只有 CI 用 `--frozen-lockfile` 时才暴露。这也是为什么本地要刻意跑一次带 `--frozen-lockfile` 的安装。

### 坑 3：安装脚本白名单写错位置（最隐蔽）

pnpm 10+ 默认**拦截依赖的安装脚本**，会提示：

```text
Error: ERR_PNPM_IGNORED_BUILDS
  ╰─▶ Ignored build scripts: esbuild@0.27.7, sharp@0.35.5
  help: Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

处理方式有两种：

- 本地跑一次 `pnpm approve-builds`，按提示勾选
- 一劳永逸（**推荐，CI 上也生效**）：在 `package.json` 里加

```json
"pnpm": {
  "onlyBuiltDependencies": ["esbuild", "sharp"]
}
```

**真正的坑在于「写进哪里」**。pnpm 12 的 `approve-builds` 会把白名单写进 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  esbuild: set this to true or false   # ← 生成的占位符，需要手工改
  sharp: set this to true or false
```

而 **pnpm 10 根本不认识 `allowBuilds` 这个键**（它是 pnpm 11+ 的写法）。我用两个版本实测：

| pnpm 版本 | 配置位置 | 结果 |
|---|---|---|
| 12.3.4 | `allowBuilds` 占位符 | **`pnpm install --frozen-lockfile` exit 1**，报 `ERR_PNPM_IGNORED_BUILDS` |
| 10.11.1 | `allowBuilds` 占位符 | 不报错，但**白名单不生效**，`sharp` 脚本仍被拦 |
| 12.3.4 | `package.json` 的 `pnpm.onlyBuiltDependencies` | ✅ 正常执行构建脚本 |
| 10.11.1 | `package.json` 的 `pnpm.onlyBuiltDependencies` | ✅ 正常执行构建脚本 |

**结论：写进 `package.json`，不要写进 `pnpm-workspace.yaml`。** 后者留给只有新版才认识的高级配置项。

> 这个坑在本地可能完全无感（「我 build 是好的啊」），但只要换一台机器、换一个 pnpm 版本，就会变成 CI 上的一行红。

### 坑 4：pnpm 版本本身要钉住

lockfile 的格式和 pnpm 的识别能力都跟版本相关。建议在 `package.json` 里显式声明：

```json
"packageManager": "pnpm@10.11.1"
```

CI 平台（比如 Cloudflare 的构建镜像）通常会读这个字段来决定用哪个 pnpm 版本。**本地 devDependency、lockfile 格式、CI 三者对齐**，才不会出现「我这好好的」。

## 逐条核对官方破坏性变更

我把官方 v5→v6、v6→v7 两份升级指南里的**每一条**都对照项目源码核过。

### v5 → v6（19 条）

| # | 变更 | 本项目 |
|---|---|---|
| 1 | Node 22.12+ | ⚠️ 本机满足；**实际按 22.22 配**，见「前置条件」一节 |
| 2 | Vite 7 | ✅ 无自定义 vite 配置 |
| 3 | Zod 3 → **Zod 4** | ✅ schema 只用 `z.string()` / `z.coerce.date()` / `.optional()`，兼容 |
| 4 | **legacy content collections 彻底移除** | ✅ 已用 Content Layer API |
| 5 | `<ViewTransitions />` 组件移除 | ✅ 未使用 |
| 6 | `Astro.glob()` 移除 | ✅ 未使用 |
| 7 | `emitESMImage()` 移除 | ✅ 未使用 |
| 8 | `astro:actions` 内部导出移除 | ✅ 未使用 |
| 9 | CommonJS 配置文件移除 | ✅ 用的是 `.mjs` |
| 10 | 路由中 `%25` 移除 | ✅ 未使用 |
| 11 | `astro:ssr-manifest` 移除 | ✅ 未使用 |
| 12 | `import.meta.env` 不再做类型转换 | ✅ 只用了内置的 `BASE_URL` |
| 13 | Markdown 标题 ID 生成变化（不再去掉尾部连字符） | ✅ 全库无 `](#...)` 锚点链接 |
| 14 | `<script>`/`<style>` 改为按源码顺序输出 | ✅ 每组件各 1 个 style，无相对顺序问题 |
| 15 | 图片默认裁剪 + **不再放大** | ⚠️ 见「图片行为变化」一节 |
| 16 | SVG 光栅化 | ✅ 未用 `format` 转 SVG |
| 17 | `getImage()` 在客户端调用会抛错 | ✅ 未使用 |
| 18 | `getStaticPaths()` 不允许 number 参数 | ✅ 用的是 `post.id`（字符串） |
| 19 | session driver / i18n 默认值变更 | ✅ 均未使用 |

### v6 → v7（8 条）

| # | 变更 | 本项目 |
|---|---|---|
| 20 | Vite 8 | ✅ 无自定义 vite 配置 |
| 21 | 一批 `experimental` 标志移除 | ✅ 无 `experimental` 块 |
| 22 | **Rust 编译器成为唯一编译器**（不容忍未闭合标签） | ✅ 实测通过，产物 SVG 完整 |
| 23 | `src/fetch.ts` 成为保留文件名 | ✅ 项目无该文件 |
| 24 | **默认 Markdown 引擎换成 Sätteri**（替代 remark/rehype） | ✅ 没用任何 remark/rehype 插件；`.md` 与 `.mdx` 实测都正常 |
| 25 | **`compressHTML` 默认 `true` → `'jsx'`** | ❌ **实测有真实回归 → 见「唯一的真回归」一节** |
| 26 | `getContainerRenderer()` 导出路径变更 | ✅ 未使用 |
| 27 | `@astrojs/db` 移除、`astro:transitions` 内部导出移除 | ✅ 均未使用 |

> 这张表的用法不是「看一遍就完」，而是**逐条对着自己的源码确认**。比如 #22 那种「不容忍未闭合标签」的变更，只有在你的模板里真有怪格式 HTML 时才会炸——而 Astro starter 里恰好有一批 Prettier 生成的换行 SVG，实测却被正常处理。

**判断标准**：凡是表里标 ⚠️/❌ 的，必须自己跑一遍验证；标 ✅ 的，至少确认「确实没用到」。

## 图片行为变化（可以不管，但要知道）

`src/layouts/BlogPost.astro` 请求 `width={1020} height={510}`，而源图是 **960×480**。

- v5：会放大到 1020×510
- v6+：**不再放大** → 实测输出 **960×480**

因为源图宽高比（2:1）与请求值（2:1）**完全一致**，不会裁剪、不会变形；CSS 又是 `width: 100%`，视觉上基本看不出差别。列表页请求的 720×360 本来就小于源图，无影响。

**结论：不需要处理。** 换成自己的真实配图时，注意别请求超过原图尺寸即可。

## 升级后验证清单

```bash
pnpm install
pnpm build
pnpm dev
```

- [ ] `pnpm build` 零 error、零 warning
- [ ] `dist/` 生成完整：`index.html`、`about/index.html`、`blog/index.html`、`blog/*/index.html`、`rss.xml`、`sitemap-index.xml`、`sitemap-0.xml`、`_astro/*.webp`
- [ ] 首页 / `/blog` / `/about` / 任意文章页 都能打开
- [ ] 页头、页脚的内联 SVG 图标显示正常
- [ ] hero 图与列表缩略图显示正常、不变形
- [ ] **首页文字里的空格正确**（对照「唯一的真回归」里的 6 处逐字检查）
- [ ] 浏览器控制台无报错
- [ ] `pnpm install --frozen-lockfile` 也能过（CI 等价验证）

## 一个容易误判的诊断场景

升级过程中我遇到一次「几乎所有 `.astro` 文件在编辑器里飘红」。第一反应是「是不是依赖装坏了/升级炸了」——**其实一条依赖问题都没有**。

真相是：我在 `astro.config.mjs` 里加了一段**校验配置的 `throw`**（用来防止占位域名被静默写进 sitemap）。而 VS Code 的 Astro 语言服务**启动时要加载这个配置文件**，它抛异常 → 语言服务无法初始化 → 整个项目的 `.astro` 类型全部退化成报错。

**这里的教训有两条：**

1. **配置文件里的 `throw` 会影响编辑器**，不只是影响构建。写守卫时要想清楚：它该不该在开发环境触发。
2. **`.astro` 飘红的正确诊断顺序**：

   ```bash
   pnpm astro sync      # 重建 .astro/types.d.ts 和内容集合类型
   pnpm build           # 真实构建是否通过
   ```

   如果这两条都正常，那大概率是编辑器缓存或配置加载问题，而不是依赖损坏。先 `Cmd+Shift+P → Developer: Reload Window` 重载窗口。

## 回滚

```bash
git checkout main
git branch -D upgrade/astro7
```

因为升级是独立分支，回滚成本极低——这也是第一步要建分支的原因。

## 结语

这次升级让我重新认识了一件事：

> **框架大版本升级的「破坏性变更」通常是显式的、写在文档里的、有明确迁移路径的。**
>
> **真正的时间黑洞是那些「隐式的、跨环境的」问题**——lockfile 是否同步、安装脚本白名单写在哪、Node engines 声明和文档是否一致、pnpm 版本是否钉住。它们不写在你正在升级的那个框架的 changelog 里，但会在你「以为升级完成」的那一刻，于另一个环境里集中爆发。

所以如果只让我留一条经验，那就是：

> **升级完成后，一定要在干净环境里跑一次 `pnpm install --frozen-lockfile && pnpm build`。**
>
> 你的本地环境有历史包袱，它会把问题藏起来；干净环境没有，它会诚实告诉你云端会发生什么。
