---
title: "教程文件结构"
description: "一门 Lathe 课程在磁盘上长什么样：metadata.json 的每个字段、continuity 的新鲜度与索引预算、changed_interfaces 与 research.md 归档、part-NN.md 的统一结构、代码块类型与验证状态横幅、verify-result.json，以及八种标注的用法。"
pubDate: "Oct 19 2026"
order: 13
---

这一页是参考手册：想直接改文件、或者想理解技能为什么这样运作时来查。

## metadata.json

每门课的索引文件，记录课程的全部状态。**请勿删除**——文件顶部有防误删提醒，误删后技能可从 `part-*.md` 正文自愈重建。

```json
{
	"_warning": "⚠️ 本文件是该教程的索引文件，请勿删除。误删后 lathe 将无法识别此教程；可运行 /lathe 标签 <slug> 或任一写入型操作触发自愈重建。",
	"_needs_backfill": [],
	"lathe_version": "0.5.4",
	"slug": "raft-go",
	"title": "用 Go 从零实现 Raft 共识算法",
	"topic": "用 Go 构建 Raft 共识算法实现",
	"goal": "掌握 Raft 核心机制（Leader 选举、日志复制、安全性）并用 Go 从零实现",
	"created": "2025-01-15T10:00:00Z",
	"status": "unverified",
	"tags": ["go", "distributed-systems", "consensus", "raft"],
	"parts": ["part-01.md", "part-02.md"],
	"language": "zh-CN",
	"experience_level": "familiar",
	"topic_novelty": "adjacent",
	"course_plan": [
		{
			"part": 1,
			"title": "从三个节点开始：状态机与任期",
			"goal": "搭起三节点骨架并理解 term",
			"prerequisites": ["Go 基础"]
		},
		{
			"part": 2,
			"title": "Leader 选举：随机超时与活锁",
			"goal": "实现可用的 Leader 选举",
			"prerequisites": ["part-01"]
		},
		{
			"part": 3,
			"title": "日志复制与安全性",
			"goal": "实现日志复制并验证提交规则",
			"prerequisites": ["part-02"]
		}
	],
	"changed_interfaces": [],
	"style_anchor": "sam-who",
	"repo": "",
	"repo_branch": "",
	"local_project_path": "",
	"tools": [{ "name": "Go", "version": "1.22" }],
	"sources": ["https://raft.github.io/raft.pdf", "https://pkg.go.dev/sync"],
	"voice": "plainspoken",
	"model": "QoderWork",
	"continuity": {
		"controlling_example": "一个三节点 Raft 集群，能在 Leader 被 kill -9 后自动选出新 Leader",
		"fixed_numbers": {
			"集群规模": "3",
			"选举超时": "150-300ms",
			"心跳间隔": "50ms"
		},
		"metaphor": "议会投票",
		"metaphor_retired": false,
		"covered_concepts": ["节点角色与状态机", "任期（term）", "RequestVote RPC"],
		"open_threads": [
			"日志复制时如何保证安全性？",
			"网络分区恢复后旧 Leader 怎么办？"
		],
		"next_hook": "选出了 Leader 之后，它如何把日志可靠地复制给跟随者？",
		"part_titles": {
			"part-01.md": "从三个节点开始：状态机与任期",
			"part-02.md": "Leader 选举：随机超时与活锁"
		},
		"updated_at": "2025-01-16T09:20:00Z",
		"updated_through": "part-02.md"
	},
	"verify_workspace": {
		"path": ".lathe-verify/",
		"note": "📦 教程验证工作区：/lathe 验证 在此目录中执行教程代码，并在再次验证时增量复用。可以安全删除，下次验证会自动重建。"
	}
}
```

> 所有字段都可以缺失——旧教程不需要手工迁移。技能遇到缺字段时按规则推断，并在**本次写回时一次补齐**，绝不因缺字段中止操作。

### 字段说明

| 字段                   | 说明                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `_warning`             | 防误删提醒（技能读取时忽略；旧教程下次写回时自动补上）                                                         |
| `_needs_backfill`      | 无法可靠推断、需要人工补的字段名数组（如 `changed_interfaces`、归档）；补上后清空                              |
| `lathe_version`        | 生成 / 续写该教程时所用的技能版本，便于排查版本相关差异                                                        |
| `slug`                 | 教程的唯一标识符（URL 友好的短名称，同时也是目录名）                                                           |
| `title`                | 教程标题（来自 `part-01.md` 的 H1）                                                                            |
| `topic`                | 用户的原始主题描述                                                                                             |
| `goal`                 | 学习目标（生成时确认；续写的目标达成评估与收尾完结的判定基准；旧教程首次续写时自动推断补上）                   |
| `created`              | 创建时间（ISO 8601）                                                                                           |
| `status`               | `unverified` / `verified` / `completed`（已完结；续写会自动撤销完结）                                          |
| `tags`                 | 标签数组（由 `/lathe 标签` 管理）                                                                              |
| `parts`                | 已有的部分文件列表（含 `part-NN-review.md` 复习材料）                                                          |
| `language`             | 教程正文语言（如 `zh-CN`、`en`），续写 / 提问自动沿用                                                          |
| `experience_level`     | 读者经验水平：`beginner` / `familiar` / `experienced`。驱动「概念锚定」的类比深度；**续写读取，不重新询问**    |
| `topic_novelty`        | 主题新颖度：`new` / `adjacent` / `familiar`。驱动检索预算、地基章节、标注与概念锚定；**续写读取，不重新询问**  |
| `course_plan`          | 课程路线图（3–12 项，每项 `{part, title, goal, prerequisites}`）。生成时初始化、续写时维护；**不是 `index.md`** |
| `changed_interfaces`   | 跨部分活跃接口变更清单（v0.5.4）。每项 `{file, symbol, from, to, call_sites, part}`；按符号记录，最多 8 条，超出或同符号被替代时归档到 `research.md`；无变化时为空数组 |
| `style_anchor`         | 风格标杆主锚点 id（如 `nystrom`、`sam-who`）。续写沿用，避免重复加载标杆表                                     |
| `repo` / `repo_branch` | 关联的代码仓库 URL 与分支（独立教程为空）                                                                      |
| `local_project_path`   | 本地实战项目路径（由续写填写；已有值时只做轻确认）                                                             |
| `tools`                | 锁定的工具链及版本                                                                                             |
| `sources`              | 研究期间查阅的来源 URL（去重）                                                                                 |
| `voice`                | 使用的写作语气                                                                                                 |
| `model`                | 生成最后部分的 AI 模型                                                                                         |
| `continuity`           | **连续性摘要**（见下一节）：让续写避开全文重读的关键字段，由续写 / 收尾每次增量更新                            |
| `verify_workspace`     | 验证工作区说明（首次验证时写入），指向 `.lathe-verify/` 并说明其作用                                           |

## continuity 连续性摘要

`continuity` 存在的唯一目的：让续写**不必重读全部历史部分**。教程越长收益越大。

| 字段                            | 含义                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `controlling_example`           | 贯穿全课的具体产物。续写必须精确复用，不得替换                                                 |
| `fixed_numbers`                 | 已锁定的领域数字（采样率、超时、缓冲区大小等）。续写引用同一数字，不得漂移                     |
| `metaphor` / `metaphor_retired` | 控制性隐喻及是否已明确告别。已告别则不再重启                                                   |
| `covered_concepts`              | 已讲透的概念清单——避免重复教学，也是 `[!RECALL]` 的取材池。**只追加、不合并**，每项 ≤40 字     |
| `open_threads`                  | 已提出但尚未展开的问题 / 伏笔（最多 10 条，每条 ≤80 字）。续写优先回收；已解决或溢出的移到 `research.md`，不删除 |
| `next_hook`                     | 最后一部分「接下来」指向的方向——下次续写的默认任务（≤200 字）                                  |
| `part_titles`                   | 文件名 → 一级标题映射。让列表、复习、收尾无需打开文件就能拿到标题                              |
| `updated_through`               | 摘要覆盖到哪个部分——**新鲜度判定依据**                                                         |
| `updated_at`                    | 最后一次写回 `continuity` 的时间；也用于「part 文件是否被手工改过」的 mtime 比对，必须在所有部分文件写入之后刷新 |

**新鲜度规则**：`updated_through` 等于当前最后一个常规部分 → 摘要可信，续写只读它 + 最后一个部分；落后或缺失 → 全文读取一次并重建。**信任摘要之前先看文件修改时间**：任何部分的 mtime 晚于 `continuity.updated_at`，就按需要重建处理；此外每 3 个常规部分（`part-03` / `06` / `09`…）做一次全读审计，防止摘要慢慢失真。

摘要总量控制在 **1200 字软上限 / 2000 字硬上限**；分字段上限：`controlling_example` ≤200 字、`next_hook` ≤200 字、`covered_concepts` 每项 ≤40 字、`fixed_numbers` 每个值 ≤40 字、`open_threads` 每条 ≤80 字。**宁可多存 200 字，也不要让下次续写重读全部部分**——它是索引，不是缩写版教程。

> 这 1200 / 2000 是**索引预算，不是正文预算**。装不下时归档或压缩索引字段，**不要靠删正文来腾地方**。

> 手工修改过旧部分内容后，可以直接把 `continuity.updated_through` 改成一个较小的值（或删掉整个 `continuity`），下次续写就会重新全文读取并重建摘要。也可以直接告诉 AI「我改过前面的部分」。

## changed_interfaces 与 research.md

`changed_interfaces` 是 v0.5.4 加的**跨部分接口变更清单**，用来防住一类很具体的翻车：某个部分把函数签名改了，后面的部分还按旧签名往下写。它放在 `metadata.json` 顶层，**不占 `continuity` 的 1200 / 2000 索引预算**。

```json
{
	"changed_interfaces": [
		{
			"file": "src/documents/documents.service.ts",
			"symbol": "DocumentsService.findAll",
			"from": "findAll(limit: number)",
			"to": "findAll(query: QueryDocumentsDto)",
			"call_sites": ["src/documents/documents.controller.ts"],
			"part": "part-02.md"
		}
	]
}
```

- 按符号记录，最多 8 条。`call_sites` 为空表示已确认不需要外部改动，并要在该部分的改动面表里写明理由。
- 同一符号只保留最新一条活跃条目；旧条目、超出 8 条的条目移到教程目录下可选的 `research.md` 的 `## Changed Interfaces Archive`。仍有活跃溢出时标 `active (overflow)`，续写或验证碰到这个符号时会去读归档。
- 续写前先读活跃条目；本部分涉及归档里的接口时读 `research.md` 对应小节；验证把这份清单当检查表用，**不做自动签名推断**。
- 旧教程没有这个字段就视为空数组，不强行回填。

`open_threads` 超过 10 条、或者某条已经解决时，也移到 `research.md`，写在 `## Open Threads Archive` 下，并记清问题、提出的部分、状态、解决它的部分和备注 / 来源。**归档不是删除**——它保留的是「当时悬着什么、后来怎么关掉的」这条线索。

## part-NN.md 的统一结构

每个部分都遵循同一套骨架：

````markdown
# [标题]

[引子段落]

## 你将构建什么

[控制性示例的具体描述]

## 前置条件

[需要安装的工具和前置知识]

## [可选：地基章节——全新/相邻/初学者]

[心智模型/术语/环境；一个可观察或可运行的小例子]

## [具体章节标题]

[教学内容，含代码块、旁白、设计笔记]

## 检查点

> [!PREDICT]
> 运行之前：你预期会看到什么输出？

**运行以下命令验证：**

```bash
<命令>
```

预期输出：...
**可能的错误：** ...

**本部分结束时的文件状态：** [新增/修改的文件、关键符号或产物]
**下一部分起始状态：** [下一部分从哪些文件/函数/状态开始]

## 接下来

[未决问题和前进方向]

## 练习

必做（3-5 个）：

1. [具体练习]
2. [具体练习]

选做（0-3 个，可不写）：3. [可选练习]

## 来源

1. [标题](url) —— 说明
   （数量不设上限；超过 5 条按主题分组）
````

从第二部分开始，正文以 `> [!RECALL]` 间隔检索开头；收尾前会多一节 `## 目标达成回顾`（见[续写与收尾](/docs/lathe/extend/)）。检查点之后那两行「文件状态」是 v0.5.4 加的：前者帮你确认自己真的跟到了哪，后者是下次续写的**起点契约**（见[续写与收尾](/docs/lathe/extend/)）。

构建章节 4–7 个，每章 1 个主知识点（紧耦合的最多 2 个），但**一个部分的主知识点总数不超过 7**。超了就拆部分，或者把剩下的写进 `course_plan` / `next_hook`——不靠压缩解释塞进去。

## 代码块类型

v0.5.4 起，代码块的 fence info string 可以带类型标记；**未标记的一律按 `runnable` 处理**：

| 标记                 | 用途                                       | 验证行为               |
| -------------------- | ------------------------------------------ | ---------------------- |
| `runnable`           | 完整可运行 / 可编译的单元                  | 执行                   |
| `fragment`           | 片段；前文写明所属文件与接缝               | 跳过，不单独执行       |
| `exercise`           | 练习 / 填空；应有参考答案或检查方式        | 跳过，不执行           |
| `text` / `output`    | 非执行文本：预期输出、文法、文件树、日志   | 跳过，不占步骤号       |
| `expected_failure`   | 故意失败的命令；前文写明预期退出码或错误   | 执行并期望非零退出     |

写法上的三条约束：同一文件的完整代码若拆成多个 `fragment`，教程要另外给出覆盖最终状态的 `runnable` 块或检查点；`runnable` 块里**不要出现 `...`**（出现了就按代码不完整处理），无关样板放进 `fragment`；单个 `runnable` 超过约 100–120 行时按文件 / 逻辑段拆成多个完整块，测试单独成块。

> 旧教程没有标记怎么办：未标记块按 `runnable` 处理，通常什么都不用做。只有当旧教程里的片段或 `...` 被验证误判时，给那一个块补上 `fragment` / `exercise` 标记即可，不必改正文。**旧教程无需强制迁移**；想彻底干净，可以先备份，再盘点一遍 `...`、填空和片段，补上代码块类型与 metadata 缺失字段，然后跑一次全量验证。

## 验证状态横幅

每个部分在 H1 之后、正文之前可以有一条验证状态横幅，由生成 / 续写 / 验证三方共同维护，标记是固定的：

```markdown
<!-- lathe:verify-status:start -->

> [!WARNING]
> 本部分尚未通过端到端验证。生成于 <YYYY-MM-DD>；运行 `/lathe 验证 <slug>` 查看结果。

<!-- lathe:verify-status:end -->
```

- 生成与续写写入「未验证」警告；验证失败写 WARNING（含失败步骤），某部分被跳过写 NOTE（含原因）；**通过后移除整块，不写「已验证」的正面横幅**。
- 旧部分没有横幅时：验证失败或被跳过会插入一条，通过则不添加。增量复用跳过的部分不改横幅。
- 验证必须**先更新横幅、再写 `verify-result.json` 的 `checked_at`**，否则部分文件的修改时间会晚于 `checked_at`，下次列表会被误判成「内容已变更」。
- 横幅不算教程正文，**不计入结构配额和知识点配额**。

## verify-result.json

验证结果文件，记录整体状态和逐部分明细；经版本冲突修复后通过的部分会附 `fixes`。逐部分状态可以是 `passed` / `failed` / `skipped` / `not_run` / `not_applicable`；v0.5.4 还记了 `mode`（`full` / `incremental`）和 `changed_interfaces_snapshot`（当时活跃接口清单的 JSON 副本，没有也写 `[]`），下面这个示例为了简洁把这两个字段省了：

```json
{
	"status": "verified",
	"checked_at": "2025-01-15T10:30:00Z",
	"parts": [
		{ "part": "part-01.md", "status": "passed" },
		{
			"part": "part-02.md",
			"status": "passed",
			"fixes": [
				"Cargo.toml 锁定 edition 2024，但测试代码按 2021 语义编写；已改写为 edition 2024 写法"
			]
		}
	]
}
```

失败时 `parts` 中对应部分会包含 `failed_step`（部分内 `runnable` / `expected_failure` 代码块与检查点命令的顺序编号；`fragment` / `exercise` / `text` / `output` **不占步骤号**）和 `error` 字段，未执行的部分记为 `not_run`。

## 面试文档的命名

面试文档**可以不在教程目录里**（解析规则见[教程存在哪里](/docs/lathe/storage/)），且**不是** part——不计入 `parts`、不参与验证。默认落在教程目录内时命名为 `interview.md`，落到外部目录时命名为 `<slug>.md`。

```markdown
# <slug> · 面试要点

> **教程**：… **教程目录**：… **代码仓库**：… **技术栈**：… **状态**：…

## 本课程的进度 ← 固定表，逐行更新

## 要点来源标注 ← 固定表（【课程】/【课程+延伸】/【延伸】）

# 第一部分 · Part 1：<该部分一级标题>

> **课程文件**：`…/part-01.md`（657 行）
> **本部分覆盖的章节**：《…》→《…》
> **要点构成**：课程 11 条 · 课程+延伸 2 条 · 延伸 1 条

## 1-1 <问题> 【课程】

> **课程出处**：Part 1 ·《章节名》

**一句话回答**：…
（展开段：主题化小标题）
**追问点**：…（可省略）
**我的项目里**：…（可省略）

---

# 第二部分 · Part 2：…
```

要点编号为 `<Part 序号>-<该部分内序号>`；**必写层只有「一句话回答」与「课程出处」**。

## 标注类型速查

| 标注               | 用途                      | 使用频率                                                     |
| ------------------ | ------------------------- | ------------------------------------------------------------ |
| `> [!PREDICT]`     | 检查点前的预测提示        | 每个检查点 1 次；每部分 1–3 次                               |
| `> [!RECALL]`      | 第 N≥2 部分顶部的间隔检索 | `part-01` 为 0；`part-02` 起顶部 1 次；按主要知识点边界可加，不以字数为触发 |
| `> [!HEADS-UP]`    | 即将踩坑的警告            | 每个真实陷阱 1 次；**不设总数上限**                          |
| `> [!ASIDE]`       | 词源、故事等旁白          | 装饰性；每部分 ≤2 次，保持简短                               |
| `> [!DESIGN-NOTE]` | 多段落的「为什么」讨论    | 每个独立设计决策 1 次；放章节末尾；不设每章 1 个的硬上限     |
| `> [!UNVERIFIED]`  | 无法确认的关键声明        | 按需；≥3 个关键事实时先补研究                                |
| `> [!NOTE]`        | 中性补充信息              | 按需；不设总数上限；每个都要对应一个具体知识点或真实陷阱     |
| `> [!TIP]`         | 便捷技巧                  | 按需；不设总数上限；同上                                     |

> v0.5.4 把信息型标注（HEADS-UP、NOTE、TIP）的**总数上限和每章节上限都取消了**，只留一条要求：每个标注必须对应一个具体知识点或真实陷阱。ASIDE 仍然每部分 ≤2 个，纯装饰。**标注是强调手段，不是配额对象**——不得用总数上限去删掉教学警告、必要补充、类比或边界说明。
