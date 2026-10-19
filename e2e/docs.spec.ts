import { expect, test } from '@playwright/test';

test('文档入口直达首篇，左栏原地换页并同步元信息', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/docs/');
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');

	const bookCard = page.locator('.book-card');
	await expect(bookCard).toHaveCount(1);
	await expect(bookCard).toHaveAttribute('href', '/docs/文档/markdown-style-guide/');
	// 卡片描述只用 books 元数据，不再罗列册内每篇文档的摘要
	await expect(bookCard.locator('.book-card-summary')).toHaveCount(0);
	await expect(bookCard.locator('.book-card-desc')).toHaveText(
		'按章节顺序整理的项目文档，涵盖 Markdown 写作规范与 MDX 用法，方便系统阅读。',
	);
	await bookCard.click();

	await expect(page).toHaveURL(/\/docs\/.*markdown-style-guide\/$/);
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');
	await expect(page.locator('.article-updated')).toContainText('最后修改于');
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
	await expect(page.locator('.article-updated')).toContainText('最后修改于');
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

test('文档册目录页按 order 列出文档', async ({ page }) => {
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
