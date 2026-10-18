/**
 * 文章大纲（TOC）的树构建。
 *
 * Astro 的 render() 会给出扁平的 headings（depth / slug / text），
 * 这里把它收成「h2 为一级、h3 挂到最近的 h2 下」的两层结构。
 * 再深的层级（h4+）不放大纲 —— 中文长文里四级标题进目录只会更乱。
 */
export type Heading = { depth: number; slug: string; text: string };

export type TocNode = Heading & { children: Heading[] };

export function buildToc(headings: readonly Heading[] | undefined, maxDepth = 3): TocNode[] {
	const nodes: TocNode[] = [];

	for (const h of headings ?? []) {
		if (h.depth < 2 || h.depth > maxDepth) continue;

		if (h.depth === 2 || nodes.length === 0) {
			nodes.push({ ...h, children: [] });
		} else {
			nodes[nodes.length - 1].children.push(h);
		}
	}

	return nodes;
}
