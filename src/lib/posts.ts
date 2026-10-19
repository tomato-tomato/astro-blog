/**
 * 文章查询的唯一入口。
 *
 * 约定：
 *   - 分类 = 目录。`src/content/blog/CSS/Flex.md` 的 id 是 `CSS/Flex`，分类即 `CSS`。
 *   - 标签 = frontmatter 里的 `tags` 数组。
 *   - `draft: true` 的文章一律不出现在列表、RSS 和页面里。
 *   - `articleLayout: doc` 的是文档文章：统一放在 blog/文档/ 目录下，
 *     因而自成一个「文档」分类。它们在「文章」列表与首页最新里排除，
 *     但分类、标签、时间轴、搜索与 RSS 仍会收录。
 *   - 分类页的「文档」只出一张总入口卡片（读 src/content/docs/overview.md
 *     的标题 / 封面 / 简介），不把每篇文档散成卡片。
 *
 * 全站任何地方要取文章都走这里，不要直接调 getCollection，
 * 否则容易漏掉 draft 过滤或排序。
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;
export type DocOverview = CollectionEntry<'docs'>;

/**
 * 文档统一归属的分类（目录名）。
 * 分类页据此识别「文档」分类，并把其中的文档折叠成一张总入口卡片。
 */
export const DOC_CATEGORY = '文档';

/** 是否为文档文章（articleLayout: doc） */
export function isDocPost(post: Post): boolean {
	return post.data.articleLayout === 'doc';
}

/** 全部已发布文章（含文档文章），按发布时间倒序 */
export async function getPosts(): Promise<Post[]> {
	const posts = await getCollection('blog', ({ data }) => !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * 普通文章（排除文档文章），按发布时间倒序。
 * 首页最新文章 / 文章列表用这个；文档文章另有文档集与分类页的文档集卡片。
 */
export async function getArticles(): Promise<Post[]> {
	const posts = await getPosts();
	return posts.filter((post) => !isDocPost(post));
}

/** 从 id 推导分类：`CSS/Flex` → `CSS`；直接放在 blog/ 下的归入「未分类」 */
export function getCategory(post: Post): string {
	const i = post.id.indexOf('/');
	return i === -1 ? '未分类' : post.id.slice(0, i);
}

/** 文章链接 */
export function postHref(post: Post): string {
	return `/blog/${post.id}/`;
}

export type CategoryGroup = { name: string; posts: Post[]; count: number };
export type TagGroup = { name: string; posts: Post[]; count: number };

function group(posts: Post[], keys: (p: Post) => string[]): { name: string; posts: Post[]; count: number }[] {
	const map = new Map<string, Post[]>();
	for (const p of posts) {
		for (const key of keys(p)) {
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(p);
		}
	}
	return [...map]
		.map(([name, list]) => ({ name, posts: list, count: list.length }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/** 按分类聚合，文章数多的在前 */
export function groupByCategory(posts: Post[]): CategoryGroup[] {
	return group(posts, (p) => [getCategory(p)]);
}

/** 按标签聚合，出现次数多的在前 */
export function groupByTag(posts: Post[]): TagGroup[] {
	return group(posts, (p) => p.data.tags);
}

/* ---------- 时间轴用的按年月分组 ---------- */

export type MonthGroup = { month: number; posts: Post[] };
export type YearGroup = { year: string; count: number; months: MonthGroup[] };

/**
 * 按「年 → 月」两级分组，年、月都倒序（新的在前）。
 * posts 需要已经排好序（getPosts() 的输出即可）。
 */
export function groupByYearMonth(posts: Post[]): YearGroup[] {
	const byYear = new Map<string, Map<number, Post[]>>();

	for (const post of posts) {
		const d = post.data.pubDate;
		const year = String(d.getFullYear());
		const month = d.getMonth();

		if (!byYear.has(year)) byYear.set(year, new Map());
		const months = byYear.get(year)!;
		if (!months.has(month)) months.set(month, []);
		months.get(month)!.push(post);
	}

	return [...byYear]
		.map(([year, months]) => ({
			year,
			count: [...months.values()].reduce((n, list) => n + list.length, 0),
			months: [...months]
				.map(([month, list]) => ({ month, posts: list }))
				.sort((a, b) => b.month - a.month),
		}))
		.sort((a, b) => Number(b.year) - Number(a.year));
}

/* ---------- 文档集（doc 版式）----------
 * 约定：分类 = 一本书。`articleLayout: doc` 的文章按分类归入各自的文档集，
 * 集内按 `docOrder`（小的在前）排，同序再按发布时间。
 * 目前所有文档都在 blog/文档/ 下，所以只有一本；分组逻辑保留，
 * 以后若再开一本 doc 目录也能直接工作。
 * 文档集的总入口是 /docs/<分类>/，左侧目录只列当前这一本。
 */
export type DocBook = { name: string; posts: Post[] };

/** 文档总入口的展示信息：/docs/ 与分类页的「文档」卡片共用 */
export async function getDocsOverview(): Promise<DocOverview> {
	const entries = await getCollection('docs');
	if (entries.length === 0) {
		throw new Error('缺少文档总入口元数据：请创建 src/content/docs/overview.md');
	}
	if (entries.length > 1) {
		throw new Error(
			`文档总入口元数据只能有一条，当前有 ${entries.length} 条：${entries
				.map((entry) => entry.id)
				.join('、')}。请只保留 src/content/docs/overview.md。`,
		);
	}
	return entries[0];
}

export function getDocBooks(posts: Post[]): DocBook[] {
	const map = new Map<string, Post[]>();

	for (const post of posts) {
		if (!isDocPost(post)) continue;
		const name = getCategory(post);
		if (!map.has(name)) map.set(name, []);
		map.get(name)!.push(post);
	}

	const books = [...map]
		.map(([name, list]) => ({
			name,
			posts: [...list].sort(
				(a, b) =>
					a.data.docOrder - b.data.docOrder || a.data.pubDate.valueOf() - b.data.pubDate.valueOf(),
			),
		}))
		.sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, 'zh'));

	// 当前内容模型只支持一个文档集；多出来的书没有入口，早点报错好过静默漏掉。
	if (books.length > 1) {
		throw new Error(
			`当前只支持一个文档集，但发现 ${books.length} 个：${books
				.map((book) => book.name)
				.join('、')}。请把所有 articleLayout: doc 的文章放到 ${DOC_CATEGORY}/ 下。`,
		);
	}
	if (books[0] && books[0].name !== DOC_CATEGORY) {
		throw new Error(
			`文档必须放在 src/content/blog/${DOC_CATEGORY}/ 下，当前文档集是「${books[0].name}」。`,
		);
	}

	return books;
}

/** 文档集总入口路径 */
export function bookHref(book: string): string {
	return `/docs/${book}/`;
}

/** 文档集卡片的链接：直达第一篇文档，左侧目录会以第一篇为当前项 */
export function docBookHref(book: DocBook): string {
	const first = book.posts[0];
	if (!first) {
		throw new Error(`文档集「${book.name}」没有任何文档，无法生成入口链接。`);
	}
	return postHref(first);
}

/** 时间轴左侧的月份名 */
export const MONTH_NAMES = [
	'一月',
	'二月',
	'三月',
	'四月',
	'五月',
	'六月',
	'七月',
	'八月',
	'九月',
	'十月',
	'十一月',
	'十二月',
] as const;
