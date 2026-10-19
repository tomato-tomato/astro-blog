import { expect, test } from '@playwright/test';

test('分类页只筛选文章，文档独立成块', async ({ page }) => {
	await page.goto('/categories/');
	await expect(page.locator('.site-nav a.active')).toHaveText('分类');

	await expect(page.locator('.chip')).toHaveCount(2);
	await expect(page.locator('.chip')).toHaveText([/全部\s*3/, /笔记\s*3/]);
	await expect(page.locator('.docs-section .content-card-title')).toHaveText('文档');
	await expect(page.locator('.docs-section .content-card-link')).toHaveAttribute(
		'href',
		'/docs/文档/markdown-style-guide/',
	);

	await page.getByRole('button', { name: /笔记/ }).click();
	await expect(page).toHaveURL(/\?c=/);
	await expect(page.locator('[data-post-list] > li:visible')).toHaveCount(3);
	await expect(page.locator('.docs-section .content-card')).toBeVisible();
	await expect(page.getByRole('button', { name: /笔记/ })).toHaveAttribute(
		'aria-pressed',
		'true',
	);

	await page.reload();
	await expect(page.getByRole('button', { name: /笔记/ })).toHaveAttribute(
		'aria-pressed',
		'true',
	);
});
