/**
 * 文档册左侧目录：配置 → 树。
 *
 * 配置放在 src/content/docs/<文档册>/_nav.yaml，和文档正文、册级元数据放在一起：
 *
 *   title: 文档目录              # 顶部总标题，纯文本，不参与折叠
 *   items:
 *     - label: 内容写作          # 纯文本分组，有 children 时可折叠
 *       children:
 *         - label: Markdown 语法 # 分组可以继续套分组
 *           children:
 *             - label: 语法指南  # 链接节点，label 与文档标题解耦
 *               doc: markdown-style-guide
 *
 * 节点语义（隐式判别，不写 type）：
 *   - 有 doc：可点击的文档入口，不能带 children；
 *   - 有 children：纯文本分组，可收起 / 展开；
 *   - 两者都没有：纯展示文本，不响应点击。
 *
 * 这里是纯函数，不读内容集合，方便单测；引用、重复、漏配都直接抛错，
 * 让错误在构建期暴露，而不是渲染出一个缺项的目录。
 */
import type { Doc } from './posts';

/** src/content/docs/<文档册>/_nav.yaml 的根形状 */
export interface NavConfig {
	/** 顶部总标题：纯文本，不可展开 */
	title?: string;
	items: NavConfigNode[];
}

/** src/content/docs/<文档册>/_nav.yaml 里的节点形状 */
export interface NavConfigNode {
	label: string;
	/** 文档 id 去掉「文档册名/」后的部分；例如 文档/markdown-style-guide → markdown-style-guide */
	doc?: string;
	/** 子节点；与 doc 互斥 */
	children?: NavConfigNode[];
}

/** 解析后的目录：总标题 + 树 */
export interface DocNav {
	title: string;
	items: DocNavNode[];
}

/** 解析后的目录节点：链接直接带文档条目，纯文本只留 label 与子节点 */
export type DocNavNode =
	| { type: 'doc'; label: string; doc: Doc }
	| { type: 'text'; label: string; children: DocNavNode[] };

const slugOf = (bookName: string, doc: Doc): string => doc.id.slice(bookName.length + 1);

/**
 * 把一本册子的目录配置组装成渲染树。
 *
 * 校验规则：
 *   - doc 必须能在本册已发布文档里找到；
 *   - 同一篇文档不能出现两次；
 *   - 所有已发布文档都必须出现在配置里（避免悄悄从目录消失）；
 *   - 链接节点不能再嵌套 children，分组不能再挂 doc。
 */
export function resolveDocNav(
	bookName: string,
	config: NavConfig,
	docs: Doc[],
): DocNav {
	const bySlug = new Map(docs.map((doc) => [slugOf(bookName, doc), doc]));
	const seen = new Set<string>();

	const walk = (nodes: NavConfigNode[], trail: string): DocNavNode[] =>
		nodes.map((node, index) => {
			const label = node.label?.trim();
			if (!label) {
				throw new Error(`文档册「${bookName}」的目录配置里，${trail}第 ${index + 1} 个节点缺少 label。`);
			}

			const rawDoc = typeof node.doc === 'string' ? node.doc.trim() : '';
			const children = node.children ?? [];

			if (rawDoc && children.length > 0) {
				throw new Error(
					`文档册「${bookName}」的目录配置里，「${label}」同时配置了 doc 和 children；` +
						'链接节点不能再嵌套子节点，请改成「文本分组 + 子链接」。',
				);
			}

			if (rawDoc) {
				const slug = rawDoc.replace(/^\/+|\/+$/g, '');
				const doc = bySlug.get(slug);

				if (!doc) {
					throw new Error(
						`文档册「${bookName}」的目录配置引用了不存在或未发布的文档：${slug}。` +
							`doc 填文档 id 去掉「${bookName}/」后的部分。`,
					);
				}

				if (seen.has(doc.id)) {
					throw new Error(`文档册「${bookName}」的目录配置重复引用了文档：${slug}。`);
				}

				seen.add(doc.id);
				return { type: 'doc', label, doc };
			}

			if (children.length > 0) {
				return { type: 'text', label, children: walk(children, `「${label}」下的`) };
			}

			return { type: 'text', label, children: [] };
		});

	const items = walk(config.items, '');

	const missing = docs.filter((doc) => !seen.has(doc.id));
	if (missing.length > 0) {
		throw new Error(
			`文档册「${bookName}」的目录配置未包含以下文档：` +
				`${missing.map((doc) => slugOf(bookName, doc)).join('、')}。` +
				`请在 src/content/docs/${bookName}/_nav.yaml 中补上链接，或确认这些文档是否还需要展示。`,
		);
	}

	const title = config.title?.trim() || `${bookName} · 目录`;
	return { title, items };
}
