import { expect, test } from '@playwright/test';

test('搜索同时索引文章与文档，并显示类型', async ({ page }) => {
	await page.goto('/');

	const input = page.locator('[data-search-input]');
	await input.fill('MDX');

	const docResult = page.locator('[data-search-results] a').first();
	await expect(docResult).toHaveAttribute('href', '/docs/文档/using-mdx/');
	await expect(docResult.locator('.search-result-kind')).toHaveText('文档');

	await input.fill('Third');
	const articleResult = page.locator('[data-search-results] a').first();
	await expect(articleResult).toHaveAttribute('href', '/blog/笔记/third-post/');
	await expect(articleResult.locator('.search-result-kind')).toHaveText('文章');
});
