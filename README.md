# 自留地

我的个人技术博客：**<https://astro-blog.tomato-tomato.workers.dev>**

前端出身，把服务端和 AI 一点点弄明白。文章和文档都直接写在这个仓库的 `src/content/` 里，构建后部署到 Cloudflare Workers。

这份 README 讲三件事：这个项目做了哪些技术判断、怎么把它跑起来、内容怎么写。逐文件的细节不在这里——`src/` 下每个模块头部都写了自己在干什么、为什么这么写。

## 目录结构

```text
├── src/
│   ├── content/
│   │   ├── blog/<分类>/<slug>.md        # 文章：分类 = 目录名
│   │   └── docs/<文档册>/               # 文档：_book.md + _nav.yaml + 正文
│   ├── pages/                           # 路由，全部静态生成
│   ├── layouts/                         # BaseLayout / BlogPost / DocPage
│   ├── components/                      # 正文块、卡片、左栏树、大纲、背景层
│   ├── lib/                             # posts / doc-nav / toc / covers：纯数据层
│   ├── scripts/                         # 客户端脚本，page.ts 是唯一入口
│   ├── styles/                          # tokens → global → backdrops
│   ├── consts.ts                        # 站名、一句话简介、首页文章数
│   └── content.config.ts                # 四个集合的 schema 与校验
├── scripts/                             # 构建期脚本：生成封面、生成 301 清单
├── e2e/                                 # Playwright 冒烟测试，11 个 spec
├── public/                              # favicon、robots、_headers
├── astro.config.mjs                     # site / MDX / sitemap / Shiki 双主题
└── wrangler.jsonc                       # Cloudflare Workers 静态资源
```

## 技术判断

- **文章与文档是两套内容模型，不是一个集合加 `type` 字段。** 文档要成册、要有目录树、要按 `order` 排序，而且不该进 RSS、标签云和时间轴；文章要分类和标签。硬塞进一个集合会让 schema 里一半字段是可选的。代价是两套 schema、两条路由。
- **文档左栏由 `_nav.yaml` 驱动，而不是从文件名里的数字推层级。** 层级是信息架构，不该由 `01-`、`02-` 这种命名隐式决定；同时 `label` 与文档标题解耦，左栏可以比正文标题短。代价是新增文档必须同步目录配置，所以构建期强制校验「每一篇已发布文档恰好出现一次」，漏配、重复、指向不存在的文档都直接构建失败。
- **头图不靠人工配图。** 以内容 id 的 FNV-1a 哈希作随机种子，构建期生成「渐变 + 几何线条」的 SVG，再用 `sharp` 转成 1020×510 WebP；卡片、正文、`og:image` 取同一张，所以分享出去和站内看到的一致。可复现、零素材维护、不需要图床。作者手写的 `heroImage` 优先级更高。代价是它是抽象图，不是照片。
- **文档 URL 从 `/blog` 迁到 `/docs` 的 301 由内容推导，不手写清单。** `scripts/generate-redirects.mjs` 在 build 后扫描 `src/content/docs` 生成 `dist/_redirects`，删掉一篇文档时对应规则自动消失——手写清单一定会漏。
- **`site` 必须是真实可访问的地址，否则直接让构建失败。** `canonical`、`og:url`、RSS、sitemap 全部由它派生；写成 `example.com` 不会报错，只会被搜索引擎收录成错误地址，而这类错误在线上很难发现。所以 `astro.config.mjs` 里拦一道，同时允许 Cloudflare 用构建变量 `SITE` 覆盖，绑自定义域名时不用改代码。
- **客户端脚本按 DOM 判断动态导入。** `page.ts` 是唯一入口，检测不到对应节点就不加载对应模块——首页粒子和背景交互不该出现在文章页。代价是首屏之后多一次动态 import。
- **所有交互都是渐进增强。** 没有 JS 时页面仍然可读、可导航：原地换页退化成普通跳转，大纲仍在，锚点仍可跳。
- **亮暗两套主题走 `html[data-theme]` + 一套 token，不做简单反色。** 首屏由 `BaseHead` 的内联脚本决定主题，颜色过渡只在 `theme-ready` 之后开启以免首屏闪烁，代码高亮用 Shiki 双主题跟随切换；粒子与背景动效在 `prefers-reduced-motion` 下完全不启动。
- **端到端测试跑真实构建产物**（`build` + `preview`），不用 jsdom。这个项目最容易坏的两类东西——构建期不变量、真实滚动与定位行为——jsdom 都测不到。

## 技术栈

Astro 7.4（Content Layer + glob loader）、MDX、`@astrojs/rss`、`@astrojs/sitemap`、`sharp`、`tsparticles`、TypeScript、`@playwright/test`。

Node 版本由 `.nvmrc` 固定（22.22.0），包管理器由 `package.json` 的 `packageManager` 固定（pnpm 10.11.1）。

## 本地开发

| 命令 | 作用 |
| --- | --- |
| `pnpm install` | 安装依赖 |
| `pnpm dev` | 开发服务器 `localhost:4321`（会先生成封面） |
| `pnpm build` | 构建到 `dist/`，并生成 `_redirects` |
| `pnpm preview` | 本地预览构建产物 |
| `pnpm check` | 类型检查（含 `.astro`） |
| `pnpm test:e2e` | 端到端测试（内部会自己 build + preview） |
| `pnpm gen:covers` | 只重新生成封面图 |

三个会踩的坑：

1. `src/assets/covers/` 是构建产物，已 gitignore。`prebuild` / `predev` 会自动生成；万一某张没生成，页面按「没有封面」渲染而不是构建失败。
2. **文档册目录名必须用小写 ASCII。** glob loader 会把文档 id 规范化为小写，而 `books` / `nav` 两个集合用原始目录名生成 id，大小写不一致会报「文档册缺少册级元数据」。给人看的名字写在 `_book.md` 的 `title` 里。
3. `pnpm test:e2e` 会自己起 preview（端口 4322）。跑之前先关掉手动起的 preview，否则会测到旧产物。

## 部署

Cloudflare Workers 静态资源（`wrangler.jsonc`：`assets.directory = ./dist`、`not_found_handling = 404-page`，让 `/404` 页面而不是 Cloudflare 默认页兜底）。走 Pages 时这份配置被忽略，只需把 output directory 设成 `dist`。

构建命令 `pnpm build`，Node 版本读 `.nvmrc`。绑定自定义域名后在 Build Variables 里设 `SITE=https://你的域名` 即可，不用改代码。

非生产分支构建出来的是预览部署，`site` 仍回落到正式地址：预览产物只给内部看，而且 Cloudflare 会给预览 URL 自带 `X-Robots-Tag: noindex`，写成正式地址比写错更安全。

## 写作约定

文章 `src/content/blog/<分类>/<slug>.md`：

```yaml
---
title: '文章标题'
description: '一句话摘要，会出现在卡片、列表、RSS 和 og:description'
pubDate: 'Oct 19 2026'
updatedDate: 'Oct 22 2026'   # 可选；不写则「最后修改于」退回发布时间
tags: [Astro, 部署]           # 可选
draft: true                  # 可选，默认 false；草稿不进列表 / RSS / 搜索，也不生成页面
# heroImage: '../../../assets/x.jpg'  # 可选；不写用自动生成的封面。文章与文档同为三级路径
---
```

分类 = 目录名，新建目录即新建分类，无需注册。改目录名等于改分类 + 改 URL。

文档 `src/content/docs/<文档册>/<slug>.md` 的 frontmatter 与文章类似，但去掉 `tags`、加上 `order`（册内排序，小的在前），并且**必须**在同一个册目录下的 `_nav.yaml` 里登记一次：

```yaml
- label: 目录里显示的文字   # 与文档标题解耦
  doc: <slug>              # 不带册名前缀
```

`_nav.yaml` 支持分组嵌套，也支持不带 `doc` 的纯文本节点；`_book.md` 放册级标题与简介，`/docs/` 的册卡片、册目录页、分类页文档块都只读这一份。

## 路由

| 路径 | 内容 |
| --- | --- |
| `/` | 首页（最新 3 篇文章，数量由 `consts.ts` 的 `HOME_LATEST_COUNT` 控制 + 粒子背景） |
| `/blog/`、`/blog/<分类>/<slug>/` | 文章列表与文章页 |
| `/categories/`、`/categories/<分类>/` | 分类：文章按分类筛选，文档折叠成册卡片 |
| `/tags/`、`/tags/<标签>/` | 标签 |
| `/timeline/` | 时间轴（只含文章） |
| `/docs/`、`/docs/<册>/`、`/docs/<册>/<slug>/` | 文档入口、册目录、文档正文 |
| `/rss.xml`、`/search.json`、`/sitemap-0.xml` | 订阅、搜索索引、站点地图 |

## 已知取舍

- 搜索只匹配标题、描述、分类、标签和文档册名，**不搜正文**。索引在构建期生成为 `search.json`，纯前端匹配，没有后端。
- 封面只做到「按内容可复现生成」这一层，没有接 AI 生图。
- 301 规则的正确性只能在真实部署环境验证；`astro preview` 不执行 `_redirects`，所以对应那条 e2e 在未提供 `REDIRECT_BASE_URL` 时是 skip 状态。
- 没有评论区。这是刻意的：不想为了评论引入第三方脚本和一套鉴权。

## 许可与起点

代码以 MIT 许可开放；`src/content/` 下的文章与文档保留所有权利。项目起点是 Astro 官方 blog starter，页面结构、样式、内容模型与构建链路均已重写。
