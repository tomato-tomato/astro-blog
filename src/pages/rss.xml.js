import rss from '@astrojs/rss';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import { getArticles, postHref } from '../lib/posts';

export async function GET(context) {
	// 走 getArticles() 而不是直接 getCollection：会自动过滤 draft 并按时间倒序，
	// 同时把文档排除在文章订阅之外。
	const posts = await getArticles();
	return rss({
		title: SITE_TITLE,
		description: SITE_DESCRIPTION,
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: postHref(post),
		})),
	});
}
