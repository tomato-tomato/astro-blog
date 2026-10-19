import { expect, test } from '@playwright/test';
import { resolveDocNav, type NavConfig } from '../src/lib/doc-nav';
import type { Doc } from '../src/lib/posts';

/** 只用到 id 与标题，构造一个够用的文档条目 */
const makeDoc = (id: string, title: string): Doc =>
	({ id, data: { title } }) as unknown as Doc;

test('目录配置组装成多级树，总标题与展示文字都可自定义', () => {
	const docs = [
		makeDoc('册/guide/install', '安装'),
		makeDoc('册/guide/usage', '使用'),
		makeDoc('册/faq', '常见问题'),
	];
	const config: NavConfig = {
		title: '册目录',
		items: [
			{
				label: '入门指南',
				children: [
					{
						label: '安装',
						children: [
							{ label: '安装与配置', doc: 'guide/install' },
							{ label: '开始使用', doc: 'guide/usage' },
						],
					},
				],
			},
			{ label: 'FAQ', doc: 'faq' },
			{ label: '整理中' },
		],
	};

	const nav = resolveDocNav('册', config, docs);

	expect(nav.title).toBe('册目录');
	expect(nav.items).toHaveLength(3);

	const group = nav.items[0];
	expect(group.type).toBe('text');
	if (group.type === 'text') {
		expect(group.label).toBe('入门指南');
		const middle = group.children[0];
		expect(middle.type).toBe('text');
		if (middle.type === 'text') {
			expect(middle.label).toBe('安装');
			expect(
				middle.children.map((child) =>
					child.type === 'doc' ? [child.label, child.doc.id] : child.label,
				),
			).toEqual([
				['安装与配置', '册/guide/install'],
				['开始使用', '册/guide/usage'],
			]);
		}
	}

	expect(nav.items[1]).toMatchObject({ type: 'doc', label: 'FAQ', doc: { id: '册/faq' } });
	expect(nav.items[2]).toEqual({ type: 'text', label: '整理中', children: [] });
});

test('不写 title 时回退到册名', () => {
	const nav = resolveDocNav('册', { items: [{ label: 'A', doc: 'a' }] }, [makeDoc('册/a', 'A')]);
	expect(nav.title).toBe('册 · 目录');
});

test('未知引用、重复引用、链接带子节点都会被拒绝', () => {
	const docs = [makeDoc('册/a', 'A'), makeDoc('册/b', 'B')];
	const ok: NavConfig = {
		items: [
			{ label: 'A', doc: 'a' },
			{ label: 'B', doc: 'b' },
		],
	};

	expect(() =>
		resolveDocNav('册', { items: [{ label: 'A', doc: 'missing' }] }, docs),
	).toThrow(/不存在或未发布的文档：missing/);
	expect(() =>
		resolveDocNav(
			'册',
			{ items: [{ label: 'A', doc: 'a' }, { label: 'A again', doc: 'a' }] },
			docs,
		),
	).toThrow(/重复引用了文档：a/);
	expect(() =>
		resolveDocNav(
			'册',
			{ items: [{ label: 'A', doc: 'a', children: [{ label: 'B', doc: 'b' }] }] },
			docs,
		),
	).toThrow(/同时配置了 doc 和 children/);
	expect(() => resolveDocNav('册', ok, docs)).not.toThrow();
});

test('漏配文档会在构建期报错', () => {
	const docs = [makeDoc('册/a', 'A'), makeDoc('册/b', 'B')];

	expect(() => resolveDocNav('册', { items: [{ label: 'A', doc: 'a' }] }, docs)).toThrow(
		/目录配置未包含以下文档：b/,
	);
});
