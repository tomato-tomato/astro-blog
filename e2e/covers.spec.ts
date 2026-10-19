import { expect, test } from '@playwright/test';

/**
 * 自动生成的头图（scripts/generate-covers.mjs + src/lib/covers.ts）。
 * 内容里已经不再写 heroImage，所以这里验的就是「什么都没配，图也必须在」。
 */

/** 图片真的解码成功（不是 404 / 不是空文件），且比例仍是 2:1 */
async function expectSquareCover(locator: import('@playwright/test').Locator) {
	await expect(locator).toBeVisible();
	const info = await locator.evaluate((el: HTMLImageElement) => ({
		loaded: el.complete && el.naturalWidth > 0,
		ratio: el.naturalWidth / el.naturalHeight,
	}));
	expect(info.loaded).toBe(true);
	expect(info.ratio).toBeGreaterThan(1.9);
	expect(info.ratio).toBeLessThan(2.1);
}

test('文章与文档卡片都有封面，且每张内容各自一张', async ({ page }) => {
	await page.goto('/blog/');
	const cardImages = page.locator('.content-card-media img');
	await expect(cardImages).toHaveCount(3);
	for (const image of await cardImages.all()) await expectSquareCover(image);

	const sources = (
		await cardImages.evaluateAll((els: HTMLImageElement[]) => els.map((el) => el.src))
	).map((src) => new URL(src).pathname);
	expect(new Set(sources).size).toBe(sources.length);
});

test('文章正文头图与卡片用的是同一张生成图', async ({ page }) => {
	await page.goto('/blog/');
	const cardSrc = await page
		.locator(
			'.content-card-link[href="/blog/后端工程/nestjs-module-four-params/"] .content-card-media img',
		)
		.getAttribute('src');

	await page.goto('/blog/后端工程/nestjs-module-four-params/');
	await expectSquareCover(page.locator('.hero-image img'));
	const heroSrc = await page.locator('.hero-image img').getAttribute('src');
	// 文件名里的内容哈希部分要一致（查询串与优化尺寸可以不同）
	expect(heroSrc?.split('/').pop()?.slice(0, 17)).toBe(cardSrc?.split('/').pop()?.slice(0, 17));
});

test('文档册卡片用册级固定封面', async ({ page }) => {
	await page.goto('/docs/');
	await expectSquareCover(page.locator('.book-card-media img').first());

	await page.goto('/docs/lathe/overview/');
	await expectSquareCover(page.locator('.hero-image img'));
});

test('og:image：内容页用生成封面，固定页退回站点社交图', async ({ page }) => {
	await page.goto('/blog/后端工程/nestjs-module-four-params/');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		/\/_astro\/[0-9a-f]{8}\..*\.webp$/,
	);

	// 列表页没有封面可传，退回站点社交图；关于页用的是自己的图，不能拿来当兜底样本
	await page.goto('/blog/');
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		/\/_astro\/social\..*\.jpg$/,
	);
	await expect(page.locator('meta[property="twitter:image"]')).toHaveAttribute(
		'content',
		/\/_astro\/social\..*\.jpg$/,
	);
});
