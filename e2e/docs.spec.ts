import { expect, test } from '@playwright/test';

test('文档入口直达首篇，左栏原地换页并同步元信息', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));

	await page.goto('/docs/');
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');

	const bookCard = page.locator('.book-card');
	await expect(bookCard).toHaveCount(1);
	await expect(bookCard).toHaveAttribute('href', '/docs/lathe/overview/');
	await expect(bookCard.locator('.book-card-title')).toHaveText('Lathe 技能使用指南');
	await expect(bookCard.locator('.book-card-count')).toHaveText('14 篇');
	// 卡片描述只用 books 元数据，不罗列册内每篇文档的摘要
	await expect(bookCard.locator('.book-card-summary')).toHaveCount(0);
	await expect(bookCard.locator('.book-card-desc')).toContainText('把 /lathe 的十个操作一次讲清');
	await bookCard.click();

	await expect(page).toHaveURL(/\/docs\/lathe\/overview\/$/);
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');
	await expect(page.locator('.article-updated')).toContainText('最后修改于');
	await expect(page.locator('.doc-nav')).toHaveCount(1);
	// 左栏文字来自 nav 配置，与文档标题解耦
	await expect(page.locator('.doc-nav a[aria-current="page"]')).toContainText('Lathe 是什么');
	await expect(page.locator('.outline a')).not.toHaveCount(0);

	const firstCanonical = await page.locator('link[rel="canonical"]').getAttribute('href');
	expect(firstCanonical).toContain('/docs/lathe/overview/');

	await page.locator('.doc-nav a', { hasText: '下载与安装' }).click();
	await expect(page).toHaveURL(/\/docs\/lathe\/install\/$/);
	await expect(page.locator('.article-title')).toHaveText('下载与安装');
	await expect(page.locator('.article-updated')).toContainText('最后修改于');
	await expect(page.locator('.doc-nav a[aria-current="page"]')).toContainText('下载与安装');
	await expect(page.locator('.outline a')).not.toHaveCount(0);

	const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
	expect(canonical).toContain('/docs/lathe/install/');
	expect(canonical).not.toBe(firstCanonical);
	await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
		'content',
		/\/docs\/lathe\/install\/$/,
	);
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
		'content',
		'下载与安装',
	);
	await expect(page.locator('meta[property="twitter:title"]')).toHaveAttribute(
		'content',
		'下载与安装',
	);

	await page.goBack();
	await expect(page).toHaveURL(/\/docs\/lathe\/overview\/$/);
	await expect(page.locator('.article-title')).toHaveText('Lathe 是什么');
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');

	expect(errors).toEqual([]);
});

test('左栏按 nav 配置渲染三级目录，并可逐级收起 / 展开', async ({ page }) => {
	await page.goto('/docs/lathe/overview/');

	// 顶部总标题：取文档册总标题，纯文本，不是可折叠节点
	await expect(page.locator('.doc-nav-title')).toHaveText('Lathe 技能');
	await expect(page.locator('.doc-nav-title details, .doc-nav-title summary')).toHaveCount(0);
	// 「总览」在标题上方
	const order = await page
		.locator('.doc-nav-body > *')
		.evaluateAll((els) => els.map((el) => el.className.split(' ')[0]));
	expect(order.slice(0, 3)).toEqual(['doc-nav-home', 'doc-nav-title', 'doc-tree']);

	// 可折叠分组：开始使用 / 日常操作 / 生成与精进 / 学完之后 / 管理与参考
	const groups = page.locator('.doc-group');
	await expect(groups).toHaveCount(5);
	// 其中两个是「日常操作」的子分组，所以树里存在第三层
	await expect(page.locator('.doc-group .doc-group')).toHaveCount(2);

	// 只匹配「这一层自己」的分组：summary 必须是它的直接子节点
	const groupLabeled = (label: string) =>
		page.locator(`.doc-group:has(> .doc-group-summary .doc-group-label:text-is("${label}"))`);

	const topGroup = groupLabeled('开始使用');
	await expect(topGroup.locator(':scope > summary')).toContainText('开始使用');
	await expect(topGroup.locator('.doc-link')).toHaveCount(3);
	// 目录 label 与文档标题解耦；完整文本走 data-tooltip，不再挂原生 title
	await expect(topGroup.locator('.doc-link').first().locator('.doc-label')).toHaveText(
		'Lathe 是什么',
	);
	await expect(topGroup.locator('.doc-link').first().locator('.doc-label')).toHaveAttribute(
		'data-tooltip',
		'Lathe 是什么',
	);

	// 纯文本节点（版本说明）与链接一样携带完整文本，供截断后提示
	const textNodes = page.locator('.doc-text');
	await expect(textNodes).toHaveCount(1);
	await expect(textNodes.first()).toHaveAttribute('data-tooltip', /v0\.5\.3\.1/);

	const daily = groupLabeled('日常操作');
	const generate = groupLabeled('生成与精进');
	const review = groupLabeled('学完之后');
	const isOpen = (group: ReturnType<typeof groupLabeled>) =>
		group.evaluate((el) => (el as HTMLDetailsElement).open);

	// 第二层收起：整支子树（含两个子分组）隐藏
	expect(await isOpen(daily)).toBe(true);
	await daily.locator(':scope > summary').click();
	expect(await isOpen(daily)).toBe(false);
	await expect(page.locator('.doc-link', { hasText: '续写与收尾' })).toBeHidden();
	await daily.locator(':scope > summary').click();
	expect(await isOpen(daily)).toBe(true);
	await expect(page.locator('.doc-link', { hasText: '续写与收尾' })).toBeVisible();

	// 第三层收起：只影响这一支，兄弟子分组仍在
	expect(await isOpen(generate)).toBe(true);
	await generate.locator(':scope > summary').click();
	expect(await isOpen(generate)).toBe(false);
	await expect(page.locator('.doc-link', { hasText: '验证教程可用' })).toBeHidden();
	await expect(review.locator(':scope > summary')).toBeVisible();
	await expect(page.locator('.doc-link', { hasText: '复习材料' })).toBeVisible();
	await generate.locator(':scope > summary').click();
	expect(await isOpen(generate)).toBe(true);
});

test('文档册目录页按 order 列出文档', async ({ page }) => {
	await page.goto('/docs/lathe/');
	await expect(page.locator('.site-nav a.active')).toHaveText('文档');
	await expect(page.locator('.doc-index-title')).toHaveCount(14);
	await expect(page.locator('.doc-index-title').first()).toHaveText('Lathe 是什么');
	await expect(page.locator('.doc-index-title').nth(1)).toHaveText('下载与安装');
	await expect(page.locator('.doc-index a').first()).toHaveAttribute(
		'href',
		'/docs/lathe/overview/',
	);
});
