import { expect, test } from '@playwright/test';

test('首页与文章列表只包含普通文章', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.site-nav a.active')).toHaveText('首页');
	await expect(page.locator('.home-latest .content-card')).toHaveCount(3);
	await expect(page.locator('.home-latest')).not.toContainText('Markdown Style Guide');

	await page.goto('/blog/');
	await expect(page.locator('.site-nav a.active')).toHaveText('文章');
	await expect(page.locator('.post-grid > li')).toHaveCount(3);
	await expect(page.locator('.post-grid')).not.toContainText('Using MDX');
});

test('文章页展示发布与最后修改时间', async ({ page }) => {
	await page.goto('/blog/笔记/third-post/');
	await expect(page.locator('.article-published')).toContainText('发布于');
	await expect(page.locator('.article-updated')).toContainText('最后修改于');

	const datetime = await page.locator('.article-updated time').getAttribute('datetime');
	expect(datetime).toBeTruthy();
	expect(new Date(datetime ?? '').toString()).not.toBe('Invalid Date');
});

test('标签、时间轴与 RSS 只收录文章', async ({ page }) => {
	await page.goto('/tags/');
	await expect(page.locator('.tag-cloud-item')).toHaveCount(2);
	await expect(page.locator('.tag-cloud')).not.toContainText('MDX');
	await expect(page.locator('.tag-cloud')).not.toContainText('Markdown');

	await page.goto('/timeline/');
	await expect(page.locator('.timeline-item')).toHaveCount(3);
	await expect(page.locator('.timeline')).not.toContainText('Markdown Style Guide');
});
