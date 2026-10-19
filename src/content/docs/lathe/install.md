---
title: "下载与安装"
description: "从 GitHub Releases 下载 Lathe 技能包、看清它的目录结构、装到用户级或项目级技能目录，并在四步之内生成第一篇教程。"
pubDate: "Oct 19 2026"
order: 2
---

Lathe 是一个可以直接复制到本地技能目录的文件夹，不需要安装任何命令行工具，也不联网。整套装好大约两分钟。

## 1. 下载技能包

到仓库的 [GitHub Releases](https://github.com/tomato-tomato/my-rust-lathe-courses/releases) 页面，下载最新的 `skills` 压缩包（文件名形如 `lathe-0.5.3.zip`，以实际 release 为准），然后解压：

```bash
unzip lathe-0.5.3.zip -d ./skills-download
```

解压后是一个技能文件夹：

```text
skills-download/
└── lathe/                          ← 统一技能文件夹
    ├── SKILL.md                    ← 入口路由 + 共享配置（含版本号）
    └── references/                 ← 模块（按需加载，请勿单独移动）
        ├── writing-core.md         ← 写作核心：结构 / 配额矩阵 / 标注 / 不变量 / 研究纪律
        ├── metadata.md             ← metadata.json 规范：字段 / continuity / course_plan / 自愈
        ├── style-benchmarks.md     ← 风格标杆：仅生成时选定主锚点
        ├── generate.md             ← 生成教程模块
        ├── extend.md               ← 续写 / 收尾模块
        ├── review.md               ← 复习模块
        ├── interview.md            ← 面试文档模块
        ├── verify.md               ← 验证模块
        ├── ask.md                  ← 提问模块
        ├── tag.md                  ← 标签模块
        ├── voice.md                ← 语气模块
        ├── scan.md                 ← 扫描登记模块
        └── list.md                 ← 列表模块
```

三点需要知道：

- `references/` 下前三个文件是**共享模块**（多个操作引用的同一份事实源），其余是每项操作各自的协议文件。
- 它们**按需加载**：列表、提问、扫描不会读 `writing-core.md`，续写不会读 `style-benchmarks.md`。这是为了压低每次调用的上下文开销。
- **安装时必须连同 `references/` 一起复制。** 只拷 `SKILL.md` 会让大部分操作找不到协议文件而失效。

> 压缩包里只有 `lathe/` 技能本身，使用教程不随包分发——你现在读的这份指南就是它的博客版。

## 2. 安装技能

把整个 `lathe/` 目录复制到技能目录。两种选择：

```bash
# 用户级：所有项目都能用（推荐，只做一次）
cp -r skills-download/lathe ~/.qoderwork/skills/

# 项目级：只在当前项目可用
mkdir -p .qoderwork/skills
cp -r skills-download/lathe .qoderwork/skills/
```

不同客户端的技能目录位置：

| 客户端                   | 用户级目录             | 项目级目录                               |
| ------------------------ | ---------------------- | ---------------------------------------- |
| QoderWork / QoderWork CN | `~/.qoderwork/skills/` | `.qoderwork/skills/`                     |
| Reasonix                 | `~/.reasonix/skills/`  | `.reasonix/skills/` 或 `.claude/skills/` |

> 用户级安装的好处是：教程数据本来就和客户端无关（存在 `~/.lathe/` 下），装一次之后在哪个项目、哪个客户端里都能接着同一门课往下学。

## 3. 验证安装

在客户端里输入：

```text
/lathe
```

技能正确加载时，AI 不会直接开始写教程，而是列出可执行的操作让你选。看到这个菜单就算装好了。

如果它像没看见命令一样自由发挥，通常是 `references/` 没复制过去，或者复制到了错误的目录层级。

## 4. 生成第一个教程

```text
/lathe 用 Go 构建一个 Raft 共识算法实现
```

第一次使用时，AI 会先问你配置（是否第一次用、教程存哪），然后用一条消息把写作前需要的信息一次问完，随后研究主题、写出 `part-01.md` 并保存。

完整对话流程见[完整工作流示例](/docs/lathe/workflow/)；生成阶段每一步在做什么，见[生成第一部分](/docs/lathe/generate/)。

## 装完之后

- 想知道教程和配置落在磁盘哪里：读[教程存在哪里](/docs/lathe/storage/)。
- 之前用别的机器或从仓库里拿到过现成教程目录，但 `/lathe 列表` 看不到：用[找回与列出教程](/docs/lathe/scan-and-list/)里的扫描登记。
