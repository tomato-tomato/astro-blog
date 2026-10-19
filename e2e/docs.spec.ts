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
	// 左栏文字来自 nav 配置，与文档标题解耦
	await expect(page.locator('.doc-nav a[aria-current="page"]')).toContainText('语法指南');
	await expect(page.locator('.outline a')).not.toHaveCount(0);

	const firstCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
	expect(firstCanonical).toContain('markdown-style-guide');

	await page.locator('.doc-nav a', { hasText: '使用 MDX' }).click();
	await expect(page).toHaveURL(/\/docs\/.*using-mdx\/$/);
	await expect(page.locator('.article-title')).toHaveText('Using MDX');
	await expect(page.locator('.article-updated')).toContainText('最后修改于');
	await expect(page.locator('.doc-nav a[aria-current="page"]')).toContainText('使用 MDX');
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

test('左栏按 nav 配置渲染多级目录，并可逐级收起 / 展开', async ({ page }) => {
	await page.goto('/docs/文档/markdown-style-guide/');

	// 顶部总标题：取文档册总标题，纯文本，不是可折叠节点
	await expect(page.locator('.doc-nav-title')).toHaveText('文档');
	await expect(page.locator('.doc-nav-title details, .doc-nav-title summary')).toHaveCount(0);
	// 「总览」在标题上方
	const order = await page
		.locator('.doc-nav-body > *')
		.evaluateAll((els) => els.map((el) => el.className.split(' ')[0]));
	expect(order.slice(0, 3)).toEqual(['doc-nav-home', 'doc-nav-title', 'doc-tree']);

	const groups = page.locator('.doc-group');
	await expect(groups).toHaveCount(4);
	const topGroup = groups.nth(0);
	const markdownGroup = groups.nth(1);
	await expect(topGroup.locator(':scope > summary')).toContainText('内容写作');
	await expect(markdownGroup.locator(':scope > summary')).toContainText('Markdown 语法');
	await expect(groups.nth(2).locator(':scope > summary')).toContainText('MDX 介绍');

	const links = topGroup.locator('.doc-link');
	await expect(links).toHaveCount(2);
	// 目录 label 与文档标题解耦；完整文本走 data-tooltip，不再挂原生 title
	await expect(links.nth(0)).toContainText('语法指南');
	await expect(links.nth(0).locator('.doc-label')).toHaveAttribute('data-tooltip', '语法指南');
	await expect(links.nth(1)).toContainText('使用 MDX');
	await expect(links.nth(1).locator('.doc-label')).toHaveAttribute('data-tooltip', '使用 MDX');

	// 纯文本节点与链接一样携带完整文本，供截断后提示
	const textNodes = groups.nth(3).locator('.doc-text');
	await expect(textNodes).toHaveCount(2);
	await expect(textNodes.first()).toHaveAttribute('data-tooltip', /.+/);

	const isOpen = (group: typeof topGroup) =>
		group.evaluate((el) => (el as HTMLDetailsElement).open);

	// 第一层收起：整棵子树隐藏
	expect(await isOpen(topGroup)).toBe(true);
	await topGroup.locator(':scope > summary').click();
	expect(await isOpen(topGroup)).toBe(false);
	await expect(links.first()).toBeHidden();
	await topGroup.locator(':scope > summary').click();
	expect(await isOpen(topGroup)).toBe(true);
	await expect(links.first()).toBeVisible();

	// 第二层收起：只隐藏这一支，另一支仍然可见
	expect(await isOpen(markdownGroup)).toBe(true);
	await markdownGroup.locator(':scope > summary').click();
	expect(await isOpen(markdownGroup)).toBe(false);
	await expect(links.nth(0)).toBeHidden();
	await expect(links.nth(1)).toBeVisible();

	await markdownGroup.locator(':scope > summary').click();
	expect(await isOpen(markdownGroup)).toBe(true);
	await expect(links.nth(0)).toBeVisible();
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
