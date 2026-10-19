---
title: '教程存在哪里'
description: 'Lathe 的所有教程位置都记在 ~/.lathe/config.json 里，支持多路径存储：默认目录、每门课的实际位置、面试文档的位置分别怎么解析，以及误删 metadata.json 之后怎么自愈。'
pubDate: 'Oct 19 2026'
order: 3
---

Lathe 不把教程塞进某个隐藏数据库，全部是普通目录 + 普通 markdown 文件。你随时可以用编辑器改、用 git 管、用 `grep` 搜。唯一记录「谁在哪」的地方是一个配置文件。

## 配置文件

**位置：** `~/.lathe/config.json`

```json
{
  "tutorials_base_path": "~/others/lathe_tutorials",
  "tutorial_paths": {
    "taskr": "~/others/lathe_tutorials",
    "raft-go": "~/projects/my-tutorials"
  }
}
```

| 字段 | 含义 |
|------|------|
| `tutorials_base_path` | 默认基础目录：生成新教程时默认提议的位置；`voices/` 自定义语气目录也始终位于这里 |
| `tutorial_paths` | 每门课（slug）实际所在目录的映射，由技能自动维护 |

支持**多路径存储**：不同教程可以散落在不同目录，只要登记过就都能被找到。

## 首次使用：配置不存在时

调用 `/lathe` 时如果配置文件不存在，技能会先问你是第一次使用还是之前生成过教程：

- **第一次使用**：询问是否使用默认路径 `~/others/lathe_tutorials/`（或指定新路径），确认后自动创建配置文件。
- **已经使用过**：请提供已有教程的存放位置（可以是一个或多个目录）。技能会按扫描规则枚举这些位置、分类展示结果，经你确认后写入配置——这样分散在各处的教程都能被 `列表` / `续写` / `验证` 找到。
- **配置已存在**：静默读取，直接使用。

> 注意：上面「已经使用过」这个分支**只在配置文件不存在时触发**。配置建立之后新出现的教程（手工拷贝、`git clone` 拉下来、目录被移动、跨机器同步）不会自动被发现——要把它们找回来，用 [`/lathe 扫描`](/docs/lathe/scan-and-list/)。

## 生成新教程时的位置

每次生成新教程，技能都会问一次保存位置（默认提议 `tutorials_base_path`）。选默认则与旧行为一致；指定新路径，则该教程单独存到那里，并自动登记进 `tutorial_paths`。

这一项**必问**：即使在没有图形选择框的终端 Agent 里，AI 也会以纯文本问出来，回车即采用默认目录。

## 手动改配置

直接编辑配置文件即可：

```bash
# 查看当前配置
cat ~/.lathe/config.json

# 修改默认目录（新教程的默认提议位置）
echo '{"tutorials_base_path": "~/my-tutorials", "tutorial_paths": {}}' > ~/.lathe/config.json
```

> 改 `tutorials_base_path` 后已有教程不会自动迁移，但 `tutorial_paths` 里已登记的教程仍在原位置被找到——这正是多路径机制的意义。

## 操作已有教程时怎么定位

对已有教程执行操作（续写、验证、复习、提问、标签等）时，技能按以下顺序找它的实际目录：

1. 先查 `tutorial_paths[<slug>]` 登记的位置；
2. 未登记则回退到默认目录 `tutorials_base_path`；
3. 该位置也找不到这个 slug 时，列出配置中已知的所有 slug 及其位置供你选择，并提示可以用 `/lathe 扫描` 把未登记的教程找回来。

## 面试文档的位置是另一套

面试文档（见[面试要点文档](/docs/lathe/interview/)）的位置用另外两个可选字段记录，与教程路径解耦：

```json
{
  "interview_base_path": "~/Code/agent-transition/interview",
  "interview_paths": {
    "nest-kb-service": "~/Code/agent-transition/interview/阶段一_NestJS与服务端基础"
  }
}
```

解析顺序：

| 顺序 | 条件 | 文档路径 |
|------|------|----------|
| 1 | `interview_paths[<slug>]` 存在 | `<该目录>/<slug>.md` |
| 2 | `interview_base_path` 存在 | `<该目录>/<slug>.md` |
| 3 | 都没有 | `<教程目录>/<slug>/interview.md` |

一个 slug 一个文档，文件名 = slug（第 3 档落在教程目录内，所以叫 `interview.md`）。

位置确认规则：

- **文档不存在**（首次创建）→ 技能会询问：展示解析出的默认路径并确认；你给出新位置就写到那里，并登记到 `interview_paths`。
- **文档已存在** → 不询问，沿用当前位置，只在结果里播报路径。
- 你也可以随时直接编辑 `interview_paths` 把文档挪走。

> 两个字段都可选，旧配置缺失即走第 3 档，无需迁移。

## 默认目录结构

```text
~/others/lathe_tutorials/          ← 默认教程基础目录
├── <slug>/                        ← 每门课一个子目录（也可位于其他已登记目录）
│   ├── metadata.json              ← 教程索引（顶部有防误删提醒）
│   ├── part-01.md                 ← 第一部分
│   ├── part-02.md                 ← 第二部分（由 /lathe 续写 添加）
│   ├── verify-result.json         ← 验证结果（由 /lathe 验证 生成）
│   └── .lathe-verify/             ← 验证工作区（隐藏目录，可安全删除）
└── voices/                        ← 自定义语气预设（始终位于默认基础目录）
    └── <名称>.md                  ← voice 规范文件
```

> **请勿删除 `metadata.json`**——它是这门课的索引。若误删或损坏，技能会在下次操作时自动检测，并从 `part-*.md` 正文推断字段重建（重建前会展示推断结果请你确认）。具体自愈路径见[找回与列出教程](/docs/lathe/scan-and-list/)。

字段完整含义见[教程文件结构](/docs/lathe/file-structure/)。
