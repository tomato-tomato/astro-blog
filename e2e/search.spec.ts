import { expect, test } from '@playwright/test';

test('搜索同时索引文章与文档，并显示类型', async ({ page }) => {
	await page.goto('/');

	const input = page.locator('[data-search-input]');

	// 文档：标题里独有的词，第一条结果就应该是它
	await input.fill('面试要点');
	const docResult = page.locator('[data-search-results] a').first();
	await expect(docResult).toHaveAttribute('href', '/docs/lathe/interview/');
	await expect(docResult.locator('.search-result-kind')).toHaveText('文档');

	// 文章：只有 NestJS 那篇的标题与标签命中
	await input.fill('NestJS');
	const articleResult = page.locator('[data-search-results] a').first();
	await expect(articleResult).toHaveAttribute(
		'href',
		'/blog/后端工程/nestjs-module-four-params/',
	);
	await expect(articleResult.locator('.search-result-kind')).toHaveText('文章');
});
