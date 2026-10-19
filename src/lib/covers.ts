/**
 * 封面解析：把内容 id 映射到 scripts/generate-covers.mjs 生成的抽象封面。
 *
 * 命名规则（前后端两边必须一致，改一边等于全站换图）：
 *   文件名 = FNV-1a(key) 的 8 位十六进制 + `.webp`
 *   key：文章 / 文档 = 内容 id（如 `前端构建/astro-5-upgrade-to-7`）；文档册 = `book:<册名>`；站点 = `@site`
 *
 * 优先级：frontmatter 里作者手写的 heroImage > 生成封面 > 没有封面。
 * 生成图由 prebuild / predev 产出；万一某张还没生成（比如刚 `git clone` 就直接跑 dev），
 * 这里返回 undefined，页面按「没有封面」渲染，不会构建失败。
 */
import type { ImageMetadata } from 'astro';

/** 与 scripts/generate-covers.mjs 的 hashKey 等价：FNV-1a 32 位 */
function hashKey(key: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) {
		h ^= key.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h >>> 0;
}

const coverFiles = import.meta.glob('../assets/covers/*.webp', {
	eager: true,
	import: 'default',
}) as Record<string, ImageMetadata>;

const socialFiles = import.meta.glob('../assets/covers/social.jpg', {
	eager: true,
	import: 'default',
}) as Record<string, ImageMetadata>;

/** 社交分享图（1200×630 JPEG）：所有页面 og:image 的兜底 */
export const socialImage: ImageMetadata | undefined = Object.values(socialFiles)[0];

/** 取某个 key 的生成封面；没有则 undefined */
export function coverFor(key: string): ImageMetadata | undefined {
	const name = hashKey(key).toString(16).padStart(8, '0');
	return coverFiles[`../assets/covers/${name}.webp`];
}

/** 文章 / 文档封面：作者手写的 heroImage 优先，其次按内容 id 取生成图 */
export function resolveCover(id: string, authorCover?: ImageMetadata): ImageMetadata | undefined {
	return authorCover ?? coverFor(id);
}

/** 文档册封面：每册固定一张，key 为 `book:<册名>` */
export function resolveBookCover(bookName: string, authorCover?: ImageMetadata) {
	return authorCover ?? coverFor(`book:${bookName}`);
}
