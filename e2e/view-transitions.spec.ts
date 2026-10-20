import { expect, test } from '@playwright/test';

/**
 * 文档页原地换页（Astro <ClientRouter />）的行为回归。
 *
 * 这套断言是 2026-10-20「组件库调研 5.1 / 5.2 试点」时补的，覆盖的都是
 * 原来手写 doc-reader.ts 负责、现在交给 Astro 的事情：
 *   - 真的没有整页重载（换页的意义所在）；
 *   - 换页后 <html> 上的运行时主题没有被静态 HTML 抹掉（试点时实测到的真问题）；
 *   - head 元信息、左栏当前项、大纲锚点都跟着新页面更新；
 *   - 页内 #锚点只是滚动，不会被当成换页；
 *   - 用户收起的分组在换页后仍收起；
 *   - 只有文档页带路由脚本，别的页面不受影响。
 */
test.use({ colorScheme: 'dark' });

test('文档页之间是原地换页，且主题与元信息都跟着走', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (e) => errors.push(e.message));

	await page.goto('/docs/lathe/introduction/');
	await expect(page.locator('.article-title')).toHaveText('前言');
	// 只在当前 JS 世界里存在的标记：整页重载就会消失
	await page.evaluate(() => {
		(window as unknown as { __noReloadProbe?: string }).__noReloadProbe = 'alive';
	});

	await page.locator('.doc-nav a', { hasText: '下载与安装' }).click();
	await expect(page).toHaveURL(/\/docs\/lathe\/install\/$/);
	await expect(page.locator('.article-title')).toHaveText('下载与安装');

	expect(await page.evaluate(() => (window as unknown as { __noReloadProbe?: string }).__noReloadProbe)).toBe(
		'alive',
	);

	// 换页会把新页面的 <html> 属性搬过来，data-theme 属于运行时写入，必须被补回
	await expect
		.poll(() => page.evaluate(() => document.documentElement.dataset.theme), {
			message: '换页后掉回亮色：BaseHead 的 astro:after-swap 补写没生效',
		})
		.toBe('dark');
	await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');

	// head 元信息与左栏当前项由新页面的服务端渲染给出
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/docs\/lathe\/install\/$/);
	await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /\/docs\/lathe\/install\/$/);
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', '下载与安装');
	await expect(page.locator('.doc-nav a[aria-current="page"]')).toContainText('下载与安装');

	// 大纲是新页面的：每个锚点都要能在换后的正文里找到
	const missing = await page.evaluate(() => {
		const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-outline] a[href^="#"]'));
		const ids = new Set(
			Array.from(document.querySelectorAll('.article-main h2, .article-main h3')).map((h) => h.id),
		);
		return { total: links.length, missing: links.filter((a) => !ids.has(decodeURIComponent(a.hash.slice(1)))).length };
	});
	expect(missing.total).toBeGreaterThan(0);
	expect(missing.missing, '大纲锚点没有全部命中换页后的正文').toBe(0);

	expect(errors).toEqual([]);
});

test('页内锚点只是滚动，不会被误当成换页', async ({ page }) => {
	await page.goto('/docs/lathe/file-structure/');
	await page.locator('.outline-summary').click();
	const href = await page.locator('.outline a').nth(2).getAttribute('href');
	expect(href).toMatch(/^#/);
	const hash = href ?? '';

	await page.evaluate(() => {
		(window as unknown as { __anchorProbe?: string }).__anchorProbe = 'alive';
	});
	await page.locator(`.outline a[href="${hash}"]`).click();
	await expect(page).toHaveURL(/#/);

	// 目标标题停在页头下方（scroll-margin-top = 页头 56px + 1.5rem = 80px）
	await expect
		.poll(
			async () =>
				page.evaluate((h) => {
					const el = document.getElementById(decodeURIComponent(h.slice(1)));
					return el ? Math.abs(Math.round(el.getBoundingClientRect().top) - 80) : 9999;
				}, hash),
			{ message: '点大纲后目标标题没有停在页头下方' },
		)
		.toBeLessThanOrEqual(8);

	// 没有整页重载，也没有留下 loading 标记
	expect(await page.evaluate(() => (window as unknown as { __anchorProbe?: string }).__anchorProbe)).toBe('alive');
	await expect(page.locator('main.article-shell[data-loading]')).toHaveCount(0);
});

test('收起的分组在换页后仍保持收起', async ({ page }) => {
	await page.goto('/docs/lathe/overview/');
	const group = page.locator('.doc-group', { hasText: '日常操作' }).first();
	await group.locator(':scope > summary').click();
	await expect(group).not.toHaveJSProperty('open', true);

	await page.locator('.doc-nav a', { hasText: '前言' }).click();
	await expect(page).toHaveURL(/\/docs\/lathe\/introduction\/$/);

	// 左栏是随 body 一起被换掉的，收起状态靠 sessionStorage 里的会话记忆恢复
	await expect(page.locator('.doc-group', { hasText: '日常操作' }).first()).not.toHaveJSProperty(
		'open',
		true,
	);
	expect(await page.evaluate(() => sessionStorage.getItem('doc-nav-open-state') ?? '')).toContain('日常操作');
});

test('脚本加载窗口期里的点击也算数（浮动大纲收起不被覆盖）', async ({ page }) => {
	await page.setViewportSize({ width: 1500, height: 900 });
	await page.goto('/docs/lathe/file-structure/');
	// 不等任何网络空闲：大纲模块是动态 import 的，这次点击很可能落在脚本跑起来之前
	await page.locator('.outline-summary').click();
	await expect(page.locator('.outline')).toHaveJSProperty('open', false);

	await page.reload();
	await expect(
		page.locator('.outline'),
		'用户在脚本加载前点的收起被视口宽度默认值覆盖了',
	).toHaveJSProperty('open', false);
});

test('只有文档页带换页路由，其他页面不受影响', async ({ page }) => {
	await page.goto('/blog/');
	await expect(page.locator('meta[name="astro-view-transitions-enabled"]')).toHaveCount(0);

	await page.goto('/docs/lathe/overview/');
	await expect(page.locator('meta[name="astro-view-transitions-enabled"]')).toHaveCount(1);

	// 从文档页点去普通页：目标页没有路由，必须退回整页加载
	await page.evaluate(() => {
		(window as unknown as { __leaveProbe?: string }).__leaveProbe = 'alive';
	});
	await page.locator('.site-nav a', { hasText: '文章' }).click();
	await expect(page).toHaveURL(/\/blog$/);
	expect(await page.evaluate(() => (window as unknown as { __leaveProbe?: string }).__leaveProbe)).toBeUndefined();
});
