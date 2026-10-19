import { expect, test } from '@playwright/test';

test('列表与聚合页使用整页背景，且不拦截指针', async ({ page }) => {
	await page.goto('/blog/');

	const aurora = page.locator('[data-page-backdrop="aurora"]');
	await expect(aurora).toHaveCount(1);
	await expect(aurora).toHaveAttribute('data-backdrop-scope', 'page');
	await expect(aurora).toHaveAttribute('aria-hidden', 'true');
	await expect(aurora).toHaveCSS('pointer-events', 'none');
	// 背景要盖住整屏，不能只画在页头一条里
	expect(await aurora.evaluate((el) => el.clientHeight >= window.innerHeight - 1)).toBe(true);

	await page.goto('/categories/');
	const grid = page.locator('[data-page-backdrop="grid"]');
	await expect(grid).toHaveCount(1);
	await expect(grid).toHaveAttribute('data-backdrop-interactive', 'true');
	expect(await grid.evaluate((el) => el.clientHeight >= window.innerHeight - 1)).toBe(true);

	await page.mouse.move(640, 140);
	await expect
		.poll(() => grid.evaluate((el) => el.style.getPropertyValue('--backdrop-pointer-x')))
		.not.toBe('');

	await page.goto('/categories/笔记/');
	await expect(page.locator('[data-page-backdrop="sweep"]')).toHaveCount(1);

	await page.goto('/tags/');
	await expect(page.locator('[data-page-backdrop="dots"]')).toHaveCount(1);

	await page.goto('/docs/文档/');
	await expect(page.locator('[data-page-backdrop="dots"]')).toHaveCount(1);

	await page.goto('/docs/');
	await expect(page.locator('[data-page-backdrop="grid"][data-backdrop-interactive="true"]')).toHaveCount(1);
});

test('阅读页使用静态纸纹，时间轴有主线光晕', async ({ page }) => {
	await page.goto('/blog/笔记/third-post/');

	const paper = page.locator('[data-page-backdrop="paper"]');
	await expect(paper).toHaveCount(1);
	await expect(paper).toHaveAttribute('data-backdrop-scope', 'page');
	await expect(paper.locator('.backdrop-layer-a')).toHaveCSS('animation-name', 'none');

	// 纸纹要真的看得见：有噪点图，且透明度不能压回「几乎为 0」
	const grain = paper.locator('.backdrop-layer-a');
	const grainStyle = await grain.evaluate((el) => {
		const cs = getComputedStyle(el);
		return { image: cs.backgroundImage, opacity: Number.parseFloat(cs.opacity) };
	});
	expect(grainStyle.image).toContain('svg');
	expect(grainStyle.opacity).toBeGreaterThanOrEqual(0.06);

	await page.goto('/docs/文档/markdown-style-guide/');
	await expect(page.locator('[data-page-backdrop="paper"]')).toHaveCount(1);

	await page.goto('/about/');
	await expect(page.locator('[data-page-backdrop="paper"]')).toHaveCount(1);

	await page.goto('/timeline/');
	const glow = page.locator('.timeline-glow');
	await expect(glow).toHaveCount(1);
	await expect(glow).toHaveCSS('pointer-events', 'none');

	await page.setViewportSize({ width: 600, height: 800 });
	await expect(glow).toBeHidden();
});

test('404 使用星尘背景，首页保留粒子且不叠加背景层', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.page-backdrop')).toHaveCount(0);
	await expect(page.locator('#hero-particles')).toHaveCount(1);

	const response = await page.goto('/definitely-not-a-page/');
	expect(response?.status()).toBe(404);
	await expect(page.locator('[data-page-backdrop="stars"]')).toHaveCount(1);
});

test('reduced-motion 下背景不播放动画，也不跟随指针', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });

	await page.goto('/blog/');
	await expect(
		page.locator('[data-page-backdrop="aurora"] .backdrop-layer-a'),
	).toHaveCSS('animation-name', 'none');

	await page.goto('/categories/');
	await page.mouse.move(640, 140);
	await page.waitForTimeout(120);
	const pointerX = await page
		.locator('[data-page-backdrop="grid"]')
		.evaluate((el) => el.style.getPropertyValue('--backdrop-pointer-x'));
	expect(pointerX).toBe('');
});
