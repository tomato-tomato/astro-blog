/**
 * 内容查询的唯一入口。
 *
 * 内容层（文档册相关的三份内容都在同一个目录下）：
 *   - 文章：  src/content/blog/<分类>/<文章>.md，blog 集合；
 *   - 文档：  src/content/docs/<文档册>/<篇>.md，docs 集合；
 *   - 册元数据：src/content/docs/<文档册>/_book.md，books 集合，只存册级展示信息；
 *   - 左栏目录：src/content/docs/<文档册>/_nav.yaml，nav 集合，定义层级树。
 *
 * 约定：
 *   - 文章分类 = 目录；文档所属文档册 = 文档 id 的第一段。
 *   - `draft: true` 的内容不出现在列表、RSS、搜索和页面里。
 *   - 文档的集内顺序由 `order` 决定（小的在前），同序再按发布时间。
 *   - 文档与文章是两种并列内容，不互相混入。
 *
 * 全站任何地方要取内容都走这里，不要直接调 getCollection，
 * 否则容易漏掉 draft 过滤或排序。
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { resolveDocNav, type DocNav } from './doc-nav';

export type Article = CollectionEntry<'blog'>;
export type Doc = CollectionEntry<'docs'>;
export type Book = CollectionEntry<'books'>;

/** 一册文档：册名 + 册级元数据 + 册内已发布文档（已按 order 排好）+ 左栏目录 */
export type DocBook = {
	name: string;
	meta: Book;
	docs: Doc[];
	nav: DocNav;
};

export type CategoryGroup = { name: string; posts: Article[]; count: number };
export type TagGroup = { name: string; posts: Article[]; count: number };

/** 全部已发布文章，按发布时间倒序 */
export async function getArticles(): Promise<Article[]> {
	const posts = await getCollection('blog', ({ data }) => !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 全部已发布文档，按发布时间倒序（搜索索引用；册内顺序走 getDocBooks） */
export async function getAllDocs(): Promise<Doc[]> {
	const docs = await getCollection('docs', ({ data }) => !data.draft);
	return docs.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 文档 id 的第一段就是文档册的名字：`文档/markdown-style-guide` → `文档` */
export function getDocBookName(doc: Doc): string {
	const slash = doc.id.indexOf('/');
	if (slash === -1) {
		throw new Error(`文档「${doc.id}」必须放在 src/content/docs/<文档册>/ 下。`);
	}
	return doc.id.slice(0, slash);
}

function groupDocs(docs: Doc[]): Map<string, Doc[]> {
	const groups = new Map<string, Doc[]>();

	for (const doc of docs) {
		const name = getDocBookName(doc);
		if (!groups.has(name)) groups.set(name, []);
		groups.get(name)!.push(doc);
	}

	return groups;
}

/**
 * 全部文档册：按文档册分组，关联 books 集合里的册级元数据与 nav 集合里的目录树。
 *
 * 构建期校验：
 *   - 有文档目录就必须有对应的 books/<文档册>.md 与 nav/<文档册>.yaml；
 *   - 有册级元数据 / 目录配置就必须有对应的文档目录；
 *   - 每册至少有一篇已发布文档，否则不会出现在 /docs/；
 *   - 目录配置必须恰好覆盖册内全部已发布文档（见 resolveDocNav）。
 */
export async function getDocBooks(): Promise<DocBook[]> {
	const [allDocs, metas, navs] = await Promise.all([
		getCollection('docs'),
		getCollection('books'),
		getCollection('nav'),
	]);

	const allGroups = groupDocs(allDocs);
	const publishedGroups = groupDocs(allDocs.filter((doc) => !doc.data.draft));
	const metaById = new Map(metas.map((meta) => [meta.id, meta]));
	const navById = new Map(navs.map((nav) => [nav.id, nav]));

	const missingMeta = [...allGroups.keys()].filter((name) => !metaById.has(name));
	if (missingMeta.length > 0) {
		throw new Error(
			`文档册缺少册级元数据：${missingMeta.join('、')}。` +
				`请创建 ${missingMeta.map((name) => `src/content/docs/${name}/_book.md`).join('、')}。`,
		);
	}

	const orphanMeta = metas.filter((meta) => !allGroups.has(meta.id));
	if (orphanMeta.length > 0) {
		throw new Error(
			`册级元数据没有对应的文档目录：${orphanMeta.map((meta) => meta.id).join('、')}。` +
				`请在 src/content/docs/<文档册>/ 下添加文档，或删除多余的 _book.md。`,
		);
	}

	const missingNav = [...publishedGroups.keys()].filter((name) => !navById.has(name));
	if (missingNav.length > 0) {
		throw new Error(
			`文档册缺少左侧目录配置：${missingNav.join('、')}。` +
				`请创建 ${missingNav.map((name) => `src/content/docs/${name}/_nav.yaml`).join('、')}。`,
		);
	}

	const orphanNav = navs.filter((nav) => !allGroups.has(nav.id));
	if (orphanNav.length > 0) {
		throw new Error(
			`左侧目录配置没有对应的文档目录：${orphanNav.map((nav) => nav.id).join('、')}。` +
				`请添加对应的 src/content/docs/<文档册>/，或删除多余的 _nav.yaml。`,
		);
	}

	return [...publishedGroups]
		.map(([name, docs]) => {
			const sortedDocs = [...docs].sort(
				(a, b) =>
					a.data.order - b.data.order || a.data.pubDate.valueOf() - b.data.pubDate.valueOf(),
			);

			return {
				name,
				meta: metaById.get(name)!,
				docs: sortedDocs,
				nav: resolveDocNav(name, navById.get(name)!.data, sortedDocs),
			};
		})
		.sort(
			(a, b) => a.meta.data.order - b.meta.data.order || a.name.localeCompare(b.name, 'zh'),
		);
}

/** 从文章 id 推导分类：`笔记/First` → `笔记`；直接放在 blog/ 下的归入「未分类」 */
export function getCategory(post: Article): string {
	const i = post.id.indexOf('/');
	return i === -1 ? '未分类' : post.id.slice(0, i);
}

/** 文章链接 */
export function postHref(post: Article): string {
	return `/blog/${post.id}/`;
}

/** 文档链接：id 已含文档册名，直接拼到 /docs/ 下 */
export function docHref(doc: Doc): string {
	return `/docs/${doc.id}/`;
}

/** 文档册目录页链接 */
export function bookHref(book: string): string {
	return `/docs/${book}/`;
}

/** 文档册入口链接：直达册内第一篇文档；空册在数据层就报错 */
export function docBookHref(book: DocBook): string {
	const first = book.docs[0];
	if (!first) {
		throw new Error(`文档册「${book.name}」没有任何已发布文档，无法生成入口链接。`);
	}
	return docHref(first);
}

function group(
	posts: Article[],
	keys: (post: Article) => string[],
): { name: string; posts: Article[]; count: number }[] {
	const map = new Map<string, Article[]>();
	for (const post of posts) {
		for (const key of keys(post)) {
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(post);
		}
	}
	return [...map]
		.map(([name, list]) => ({ name, posts: list, count: list.length }))
		.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/** 按分类聚合文章，文章数多的在前 */
export function groupByCategory(posts: Article[]): CategoryGroup[] {
	return group(posts, (post) => [getCategory(post)]);
}

/** 按标签聚合文章，出现次数多的在前 */
export function groupByTag(posts: Article[]): TagGroup[] {
	return group(posts, (post) => post.data.tags);
}

/* ---------- 时间轴用的按年月分组 ---------- */

export type MonthGroup = { month: number; posts: Article[] };
export type YearGroup = { year: string; count: number; months: MonthGroup[] };

/**
 * 按「年 → 月」两级分组，年、月都倒序（新的在前）。
 * posts 需要已经排好序（getArticles() 的输出即可）。
 */
export function groupByYearMonth(posts: Article[]): YearGroup[] {
	const byYear = new Map<string, Map<number, Article[]>>();

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
