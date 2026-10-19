import { expect, test } from '@playwright/test';

test('长文本 hover 立即出现全局提示，未截断不弹', async ({ page }) => {
	await page.goto('/blog/');

	const title = page.locator('.content-card-title').first();
	// 先换成一个不可能截断的短标题：未溢出时不应创建提示浮层
	await title.evaluate((el) => {
		el.textContent = '短标题';
		el.setAttribute('data-tooltip', '短标题');
	});
	await title.hover();
	await expect(page.locator('.ui-tooltip')).toHaveCount(0);

	const long = '这是一个明显超过两行的超长标题，用来验证截断后的完整提示。'.repeat(8);
	await title.evaluate((el, text) => {
		el.textContent = text;
		el.setAttribute('data-tooltip', text);
	}, long);

	await title.hover();
	const tip = page.locator('.ui-tooltip');
	await expect(tip).toBeVisible();
	await expect(tip).toHaveText(long);

	await page.mouse.move(0, 0);
	await expect(tip).toBeHidden();
});

test('左栏层级用字号 / 颜色区分，长标题两行截断后走提示', async ({ page }) => {
	await page.goto('/docs/lathe/overview/');

	// 不再给左栏元素挂原生 title
	await expect(page.locator('.doc-nav [title]')).toHaveCount(0);

	const styleOf = (index: number) =>
		page.locator('.doc-group-summary').nth(index).evaluate((el) => {
			const cs = getComputedStyle(el);
			return { size: Number.parseFloat(cs.fontSize), color: cs.color };
		});

	// 目录顺序：开始使用(0) 日常操作(1) 生成与精进(2)…——0 是第一层，2 是它的子分组
	const top = await styleOf(0);
	const nested = await styleOf(2);
	expect(top.size).toBeGreaterThan(nested.size);
	expect(top.color).not.toBe(nested.color);

	const label = page.locator('.doc-link[aria-current="page"] .doc-label');
	await expect(label).toHaveCSS('-webkit-line-clamp', '2');

	const long = '超长的文档目录标题，用来验证两行截断以及鼠标悬浮后的完整提示。'.repeat(6);
	await label.evaluate((el, text) => {
		el.textContent = text;
		el.setAttribute('data-tooltip', text);
	}, long);

	await label.hover();
	await expect(page.locator('.ui-tooltip')).toHaveText(long);
});

test('左栏纯文本节点同样两行截断并支持即时提示', async ({ page }) => {
	await page.goto('/docs/lathe/overview/');

	const text = page.locator('.doc-text').first();
	await expect(text).toHaveCSS('-webkit-line-clamp', '2');
	await expect(text).toHaveAttribute('data-tooltip', /.+/);

	const long = '这是目录里的纯文本分组标题，同样需要在超过两行时截断并展示完整提示。'.repeat(6);
	await text.evaluate((el, value) => {
		el.textContent = value;
		el.setAttribute('data-tooltip', value);
	}, long);

	await text.hover();
	await expect(page.locator('.ui-tooltip')).toHaveText(long);
});
