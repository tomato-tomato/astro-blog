/**
 * 站内搜索索引。
 *
 * 构建期生成 /search.json，前端在第一次聚焦搜索框时才 fetch，
 * 不增加首屏请求。文章与文档统一索引，但保留 kind / book 以便区分。
 */
import {
	docHref,
	getAllDocs,
	getArticles,
	getCategory,
	getDocBookName,
	postHref,
} from '../lib/posts';
import type { SearchEntry } from '../lib/search-types';

export async function GET(): Promise<Response> {
	const [articles, docs] = await Promise.all([getArticles(), getAllDocs()]);

	const items: SearchEntry[] = [
		...articles.map(
			(article): SearchEntry => ({
				kind: 'article',
				title: article.data.title,
				description: article.data.description,
				category: getCategory(article),
				tags: article.data.tags,
				date: article.data.pubDate.toISOString().slice(0, 10),
				url: postHref(article),
			}),
		),
		...docs.map(
			(doc): SearchEntry => ({
				kind: 'doc',
				title: doc.data.title,
				description: doc.data.description,
				book: getDocBookName(doc),
				tags: [],
				date: doc.data.pubDate.toISOString().slice(0, 10),
				url: docHref(doc),
			}),
		),
	].sort((a, b) => b.date.localeCompare(a.date));

	return new Response(JSON.stringify(items), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	});
}
