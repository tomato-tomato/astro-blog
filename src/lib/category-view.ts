/**
 * 分类页的视图模型（/categories/ 与 /categories/[category]/ 共用）。
 *
 * 两个页面以前各自做同样的事：把 posts 拆成「普通文章」和「文档」，
 * 再取文档集和总入口元数据。这里统一收口，页面只负责渲染。
 *
 * 规则：
 *   - 普通文章逐篇展示；
 *   - 文档文章不散开，整个「文档」分类只出一张总入口卡片；
 *   - 文档集 / overview 的完整性校验都在 lib/posts.ts。
 */
import {
	getDocBooks,
	getDocsOverview,
	getPosts,
	groupByCategory,
	isDocPost,
	type CategoryGroup,
	type DocBook,
	type DocOverview,
	type Post,
} from './posts';

export interface DocEntry {
	book: DocBook;
	overview: DocOverview;
}

export interface CategoryIndexView {
	categories: CategoryGroup[];
	total: number;
	articles: Post[];
	docEntry?: DocEntry;
}

export interface CategoryDetailView {
	category: string;
	total: number;
	docCount: number;
	articles: Post[];
	docEntry?: DocEntry;
}

/** 文档总入口数据；没有文档文章时返回 undefined */
async function loadDocEntry(posts: Post[]): Promise<DocEntry | undefined> {
	const [book] = getDocBooks(posts);
	if (!book) return undefined;
	return { book, overview: await getDocsOverview() };
}

/** 分类总览页：筛选 chips + 全部文章卡片 + 一张文档入口卡 */
export async function getCategoryIndexView(): Promise<CategoryIndexView> {
	const posts = await getPosts();
	return {
		categories: groupByCategory(posts),
		total: posts.length,
		articles: posts.filter((post) => !isDocPost(post)),
		docEntry: await loadDocEntry(posts),
	};
}

/** 单个分类页：普通文章逐篇，文档分类只出总入口卡 */
export async function getCategoryDetailView(
	category: string,
	posts: Post[],
): Promise<CategoryDetailView> {
	const articles = posts.filter((post) => !isDocPost(post));
	return {
		category,
		total: posts.length,
		docCount: posts.length - articles.length,
		articles,
		docEntry: await loadDocEntry(posts),
	};
}
