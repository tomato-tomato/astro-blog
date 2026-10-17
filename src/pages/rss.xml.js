import rss from '@astrojs/rss';
import { SITE_TITLE, SITE_DESCRIPTION } from '../consts';
import { getPosts, postHref } from '../lib/posts';

export async function GET(context) {
	// 走 getPosts() 而不是直接 getCollection：会自动过滤 draft 并按时间倒序
	const posts = await getPosts();
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
