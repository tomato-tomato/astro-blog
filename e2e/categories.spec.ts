import { expect, test } from '@playwright/test';

test('分类页只筛选文章，文档独立成块', async ({ page }) => {
	await page.goto('/categories/');
	await expect(page.locator('.site-nav a.active')).toHaveText('分类');

	// 全部 + 两个文章分类；文档册不进 chips
	await expect(page.locator('.chip')).toHaveCount(3);
	await expect(page.locator('.chip')).toHaveText([/全部\s*3/, /前端构建\s*2/, /后端工程\s*1/]);
	await expect(page.locator('.docs-section .content-card-title')).toHaveText(
		'Lathe 技能使用指南',
	);
	await expect(page.locator('.docs-section .content-card-link')).toHaveAttribute(
		'href',
		'/docs/lathe/introduction/',
	);

	await page.getByRole('button', { name: /前端构建/ }).click();
	await expect(page).toHaveURL(/\?c=/);
	await expect(page.locator('[data-post-list] > li:visible')).toHaveCount(2);
	// 筛选只作用于文章列表，文档块始终在场
	await expect(page.locator('.docs-section .content-card')).toBeVisible();
	await expect(page.getByRole('button', { name: /前端构建/ })).toHaveAttribute(
		'aria-pressed',
		'true',
	);

	await page.reload();
	await expect(page.getByRole('button', { name: /前端构建/ })).toHaveAttribute(
		'aria-pressed',
		'true',
	);
});

test('单个分类页只列出该分类的文章', async ({ page }) => {
	await page.goto('/categories/后端工程/');
	await expect(page.locator('.post-grid > li')).toHaveCount(1);
	await expect(page.locator('.content-card-title')).toHaveText(
		/NestJS 的 @Module 到底在管什么/,
	);
});
