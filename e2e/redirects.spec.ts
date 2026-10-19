import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const redirects = readFileSync(`${root}/dist/_redirects`, 'utf8');
const sitemap = readFileSync(`${root}/dist/sitemap-0.xml`, 'utf8');

test('构建产物包含旧文档 URL 的 301 规则', () => {
	expect(redirects).toContain('/blog/lathe/overview/ /docs/lathe/overview/ 301');
	expect(redirects).toContain('/blog/lathe/file-structure/ /docs/lathe/file-structure/ 301');
	// 带斜杠与不带斜杠各一条，兼容不同来源的旧链接
	expect(redirects).toContain('/blog/lathe/overview /docs/lathe/overview/ 301');
	expect(redirects).toContain('/categories/lathe/ /docs/lathe/ 301');
});

test('Sitemap 只包含新文档 URL', () => {
	expect(sitemap).toContain('/docs/lathe/overview/');
	expect(sitemap).toContain('/docs/lathe/interview/');
	expect(sitemap).not.toContain('/blog/lathe/');
});

// 真实 301 只能在 Cloudflare 或 wrangler 上验证；设置 REDIRECT_BASE_URL 后启用。
test('旧文档 URL 在部署环境返回 301', async ({ request }) => {
	const base = process.env.REDIRECT_BASE_URL;
	test.skip(!base, '设置 REDIRECT_BASE_URL 后验证真实 301');

	const response = await request.get(`${base}/blog/lathe/overview/`, { maxRedirects: 0 });
	expect(response.status()).toBe(301);
	expect(response.headers()['location']).toContain('/docs/lathe/overview/');
});
