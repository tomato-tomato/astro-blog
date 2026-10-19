import { expect, test } from '@playwright/test';

test('文章与文档使用 article 类型，固定页保持 website', async ({ page }) => {
	await page.goto('/blog/笔记/third-post/');
	await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
	await expect(page.locator('meta[property="article:published_time"]')).not.toHaveAttribute(
		'content',
		'',
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /third-post/);

	await page.goto('/docs/文档/using-mdx/');
	await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /using-mdx/);

	await page.goto('/about/');
	await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
});

test('404 返回 noindex', async ({ page }) => {
	const response = await page.goto('/this-page-does-not-exist/');
	expect(response?.status()).toBe(404);
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});
