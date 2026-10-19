/**
 * 文章大纲高亮 + 窄屏折叠。
 *
 * 找出「已经滚过视口上沿」的最后一个标题，标给对应链接。
 * 文档版式原地换文章后，正文和大纲都被替换了，需要调用返回的
 * collect() / update() / collapseOnNarrow() 重新收集一次。
 */
export interface ArticleOutlineController {
	/** 重新收集正文标题与大纲链接（换页后调用） */
	collect: () => void;
	/** 按当前滚动位置刷新高亮 */
	update: () => void;
	/** 窄屏收起 details，宽屏展开 */
	collapseOnNarrow: () => void;
}

export function initArticleOutline(): ArticleOutlineController {
	let links: HTMLAnchorElement[] = [];
	let byId = new Map<string, HTMLAnchorElement[]>();
	let targets: HTMLElement[] = [];
	let active = '';

	const collect = () => {
		links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-outline] a[href^="#"]'));
		byId = new Map();
		for (const a of links) {
			const id = decodeURIComponent(a.hash.slice(1));
			const list = byId.get(id);
			if (list) list.push(a);
			else byId.set(id, [a]);
		}
		targets = Array.from(byId.keys())
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => Boolean(el));
		active = '';
	};

	const update = () => {
		if (targets.length === 0) return;
		const line = window.scrollY + 96; // 页头高度 + 一点余量
		let current = targets[0].id;
		for (const el of targets) {
			if (el.getBoundingClientRect().top + window.scrollY <= line) current = el.id;
			else break;
		}
		if (current === active) return;
		active = current;
		for (const a of links) a.removeAttribute('data-active');
		for (const a of byId.get(current) ?? []) a.setAttribute('data-active', '');
	};

	let ticking = false;
	const onScroll = () => {
		if (ticking) return;
		ticking = true;
		requestAnimationFrame(() => {
			ticking = false;
			update();
		});
	};

	/* 大纲 / 文档目录在窄屏会变成文首的折叠块，默认收起，别把正文顶下去。 */
	const collapseOnNarrow = () => {
		const narrow = window.matchMedia('(max-width: 900px)').matches;
		for (const el of document.querySelectorAll<HTMLDetailsElement>(
			'details.outline, details.doc-nav',
		)) {
			el.open = !narrow;
		}
	};

	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll, { passive: true });
	window.matchMedia('(max-width: 900px)').addEventListener('change', collapseOnNarrow);

	collect();
	update();
	collapseOnNarrow();

	return { collect, update, collapseOnNarrow };
}
