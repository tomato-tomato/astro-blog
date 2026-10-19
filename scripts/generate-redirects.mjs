/**
 * 构建后生成 Cloudflare Workers Static Assets 的 dist/_redirects。
 *
 * 迁移规则：
 *   /blog/<文档册>/<篇>/  → /docs/<文档册>/<篇>/   301
 *   /categories/<文档册>/ → /docs/<文档册>/         301
 *
 * 中文路径直接写原文：Cloudflare 会按 URL 规范化匹配，wrangler 也能正确解析；
 * 带不带尾斜杠各一条，以兼容不同来源的旧链接。当前文档量远低于 Cloudflare 的
 * 2000 条静态规则上限。
 */
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const docsRoot = path.join(root, 'src/content/docs');
const output = path.join(root, 'dist/_redirects');

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await walk(full)));
		else if (/\.(md|mdx)$/.test(entry.name)) files.push(full);
	}

	return files;
}

function variants(source, destination) {
	const withSlash = source.endsWith('/') ? source : `${source}/`;
	const withoutSlash = withSlash.replace(/\/$/, '');
	return [withSlash, withoutSlash].map((from) => `${from} ${destination} 301`);
}

const files = await walk(docsRoot);
const books = new Set();
const rules = [];

for (const file of files) {
	const relative = path
		.relative(docsRoot, file)
		.split(path.sep)
		.join('/')
		.replace(/\.(md|mdx)$/, '');
	const [book, ...rest] = relative.split('/');

	// 直接放在 docs 根下的文件不是合法文档，跳过；构建期的数据层会报错
	if (!book || rest.length === 0) continue;

	books.add(book);
	const slug = rest.join('/');
	const destination = encodeURI(`/docs/${book}/${slug}/`);
	rules.push(...variants(`/blog/${book}/${slug}/`, destination));
}

for (const book of books) {
	rules.push(...variants(`/categories/${book}/`, encodeURI(`/docs/${book}/`)));
}

const unique = [...new Set(rules)];
await writeFile(output, `${unique.join('\n')}\n`, 'utf8');
console.log(`[redirects] wrote ${unique.length} rules to dist/_redirects`);
