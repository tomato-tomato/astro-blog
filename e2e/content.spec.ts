import { expect, test } from '@playwright/test';

test('首页与文章列表只包含普通文章', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.site-nav a.active')).toHaveText('首页');
	await expect(page.locator('.home-latest .content-card')).toHaveCount(3);
	await expect(page.locator('.home-latest')).not.toContainText('Lathe 技能使用指南');

	await page.goto('/blog/');
	await expect(page.locator('.site-nav a.active')).toHaveText('文章');
	await expect(page.locator('.post-grid > li')).toHaveCount(3);
	await expect(page.locator('.post-grid')).not.toContainText('就教程内容提问');
});

test('文章页展示发布与最后修改时间', async ({ page }) => {
	await page.goto('/blog/前端构建/astro-5-upgrade-to-7/');
	await expect(page.locator('.article-published')).toContainText('发布于');
	await expect(page.locator('.article-updated')).toContainText('最后修改于');

	const datetime = await page.locator('.article-updated time').getAttribute('datetime');
	expect(datetime).toBeTruthy();
	expect(new Date(datetime ?? '').toString()).not.toBe('Invalid Date');
});

test('标签、时间轴与 RSS 只收录文章', async ({ page }) => {
	await page.goto('/tags/');
	await expect(page.locator('.tag-cloud-item')).toHaveCount(10);
	await expect(page.locator('.tag-cloud')).not.toContainText('Lathe');
	await expect(page.locator('.tag-cloud')).not.toContainText('复习');

	await page.goto('/timeline/');
	await expect(page.locator('.timeline-item')).toHaveCount(3);
	await expect(page.locator('.timeline')).not.toContainText('Lathe 技能使用指南');
});

test('正文表格字号贴近正文，并与段落之间留出间距', async ({ page }) => {
	await page.goto('/blog/后端工程/nestjs-module-four-params/');

	const box = page.locator('.prose table').first();
	await expect(box).toBeVisible();

	const metrics = await box.evaluate((table) => {
		const cs = getComputedStyle(table);
		const cell = table.querySelector('td');
		return {
			tableFont: parseFloat(cs.fontSize),
			proseFont: parseFloat(getComputedStyle(table.closest('.prose') as HTMLElement).fontSize),
			marginTop: parseFloat(cs.marginTop),
			cellPadding: cell ? parseFloat(getComputedStyle(cell).paddingTop) : 0,
		};
	});

	// 曾经表格是 13px 而正文 17px，掉了一整档；现在允许比正文小，但不能超过 4px
	expect(metrics.tableFont).toBeGreaterThanOrEqual(metrics.proseFont - 4);
	// markdown 渲染出的 table 原本没有任何上下间距，会和段落贴在一起
	expect(metrics.marginTop).toBeGreaterThanOrEqual(16);
	expect(metrics.cellPadding).toBeGreaterThanOrEqual(8);
});
