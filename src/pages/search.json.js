/**
 * 站内搜索索引。
 *
 * 构建期生成 /search.json，前端在第一次聚焦搜索框时才 fetch，
 * 不增加首屏请求。文章量小（几十到几百篇）时这个体积完全够用。
 */
import { getPosts, getCategory, postHref } from '../lib/posts';

export async function GET() {
	const posts = await getPosts();

	const items = posts.map((post) => ({
		title: post.data.title,
		description: post.data.description,
		category: getCategory(post),
		tags: post.data.tags,
		date: post.data.pubDate.toISOString().slice(0, 10),
		url: postHref(post),
	}));

	return new Response(JSON.stringify(items), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	});
}
