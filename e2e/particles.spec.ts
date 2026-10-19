import { expect, test } from '@playwright/test';

test('主题切换后粒子仍正常挂载', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/');
	await expect(page.locator('#hero-particles canvas')).toHaveCount(1);

	await page.locator('#theme-toggle').click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('#hero-particles canvas')).toHaveCount(1);

	expect(errors).toEqual([]);
});

test.describe('减少动效', () => {
	test.use({ reducedMotion: 'reduce' });

	test('prefers-reduced-motion 下不启动粒子', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#hero-particles canvas')).toHaveCount(0);
	});
});
