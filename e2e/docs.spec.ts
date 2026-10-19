import { expect, test } from '@playwright/test';

test('文档入口直达首篇，左栏原地换页并同步元信息', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/docs/');
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');

	const bookCard = page.locator('.book-card');
	await expect(bookCard).toHaveCount(1);
	await expect(bookCard).toHaveAttribute('href', '/docs/文档/markdown-style-guide/');
	await bookCard.click();

	await expect(page).toHaveURL(/\/docs\/.*markdown-style-guide\/$/);
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');
	await expect(page.locator('.doc-nav')).toHaveCount(1);
	await expect(page.locator('.doc-nav a[aria-current="page"]')).toContainText(
		'Markdown Style Guide',
	);
	await expect(page.locator('.outline a')).not.toHaveCount(0);

	const firstCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
	expect(firstCanonical).toContain('markdown-style-guide');

	await page.locator('.doc-nav a', { hasText: 'Using MDX' }).click();
	await expect(page).toHaveURL(/\/docs\/.*using-mdx\/$/);
	await expect(page.locator('.article-title')).toHaveText('Using MDX');
	await expect(page.locator('.doc-nav a[aria-current="page"]')).toContainText('Using MDX');
	await expect(page.locator('.outline a')).not.toHaveCount(0);

	const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
	expect(canonical).toContain('using-mdx');
	expect(canonical).not.toBe(firstCanonical);
	await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /using-mdx/);
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Using MDX');
	await expect(page.locator('meta[property="twitter:title"]')).toHaveAttribute(
		'content',
		'Using MDX',
	);

	await page.goBack();
	await expect(page).toHaveURL(/\/docs\/.*markdown-style-guide\/$/);
	await expect(page.locator('.article-title')).toHaveText('Markdown Style Guide');
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');

	expect(errors).toEqual([]);
});

test('书目录页按 order 列出文档', async ({ page }) => {
	await page.goto('/docs/文档/');
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');
	await expect(page.locator('.doc-index-title')).toHaveText([
		'Markdown Style Guide',
		'Using MDX',
	]);
	await expect(page.locator('.doc-index a').first()).toHaveAttribute(
		'href',
		'/docs/文档/markdown-style-guide/',
	);
});
