---
title: "教程文件结构"
description: "一门 Lathe 课程在磁盘上长什么样：metadata.json 的每个字段、continuity 连续性摘要的新鲜度规则、part-NN.md 的统一结构、verify-result.json，以及七种标注的使用频率上限。"
pubDate: "Oct 19 2026"
order: 13
---

这一页是参考手册：想直接改文件、或者想理解技能为什么这样运作时来查。

## metadata.json

每门课的索引文件，记录课程的全部状态。**请勿删除**——文件顶部有防误删提醒，误删后技能可从 `part-*.md` 正文自愈重建。

```json
{
	"_warning": "⚠️ 本文件是该教程的索引文件，请勿删除。误删后 lathe 将无法识别此教程；可运行 /lathe 标签 <slug> 或任一写入型操作触发自愈重建。",
	"lathe_version": "0.5.3",
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
| `course_plan`          | 课程路线图（3–8 项，每项 `{part, title, goal, prerequisites}`）。生成时初始化、续写时维护；**不是 `index.md`** |
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
| `open_threads`                  | 已提出但尚未展开的问题 / 伏笔（最多 10 条，每条 ≤40 字）。续写优先回收，收尾时清空或标注已解决 |
| `next_hook`                     | 最后一部分「接下来」指向的方向——下次续写的默认任务（≤200 字）                                  |
| `part_titles`                   | 文件名 → 一级标题映射。让列表、复习、收尾无需打开文件就能拿到标题                              |
| `updated_through`               | 摘要覆盖到哪个部分——**新鲜度判定依据**                                                         |

**新鲜度规则**：`updated_through` 等于当前最后一个常规部分 → 摘要可信，续写只读它 + 最后一个部分；落后或缺失 → 全文读取一次并重建。

摘要总量控制在 **1200 字软上限 / 2000 字硬上限**；分字段上限：`controlling_example` ≤200 字、`next_hook` ≤200 字、`covered_concepts` 每项 ≤40 字、`fixed_numbers` 每个值 ≤40 字、`open_threads` 每条 ≤40 字。**宁可多存 200 字，也不要让下次续写重读全部部分**——它是索引，不是缩写版教程。

> 手工修改过旧部分内容后，可以直接把 `continuity.updated_through` 改成一个较小的值（或删掉整个 `continuity`），下次续写就会重新全文读取并重建摘要。也可以直接告诉 AI「我改过前面的部分」。

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

从第二部分开始，正文以 `> [!RECALL]` 间隔检索开头；收尾前会多一节 `## 目标达成回顾`（见[续写与收尾](/docs/lathe/extend/)）。

## verify-result.json

验证结果文件，记录整体状态和逐部分明细；经版本冲突修复后通过的部分会附 `fixes`：

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

失败时 `parts` 中对应部分会包含 `failed_step`（部分内代码块与检查点命令的顺序编号）和 `error` 字段，未执行的部分记为 `not_run`。

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

| 标注               | 用途                      | 使用频率                                               |
| ------------------ | ------------------------- | ------------------------------------------------------ |
| `> [!PREDICT]`     | 检查点前的预测提示        | 每个检查点 1 次；每部分 1–3 次                         |
| `> [!RECALL]`      | 第 N≥2 部分顶部的间隔检索 | 每部分顶部 1 次；>3000 字可中段 +1                     |
| `> [!HEADS-UP]`    | 即将踩坑的警告            | 每个真实陷阱 1 次；熟悉 ≤2 / 相邻 ≤3 / 全新 ≤4         |
| `> [!ASIDE]`       | 词源、故事等旁白          | 装饰性；每部分 ≤2 次                                   |
| `> [!DESIGN-NOTE]` | 多段落的「为什么」讨论    | 每章节末尾 ≤1 次                                       |
| `> [!UNVERIFIED]`  | 无法确认的关键声明        | 按需；≥3 个关键事实时先补研究                          |
| `> [!NOTE]`        | 中性补充信息              | 信息型；与 HEADS-UP / TIP 合计 ≤ 章节数 +2（硬上限 8） |
| `> [!TIP]`         | 便捷技巧                  | 信息型；同上                                           |

> 信息型标注（HEADS-UP、NOTE、TIP）每章节 ≤2 个，全部分 ≤ 章节数 +2（章节数 = 地基 + 构建章节；硬上限 8）；ASIDE 每部分 ≤2 个。**标注是上限不是目标，宁缺毋滥。**
