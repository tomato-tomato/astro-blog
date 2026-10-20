/**
 * 文章大纲：滚动高亮 + 折叠状态。
 *
 * 三件事：
 *   1. 找出「已经滚过视口上沿」的最后一个标题，标给对应的大纲链接；
 *   2. 决定各折叠块的展开状态（窄屏一律收起，宽屏的浮动大纲听用户的选择）；
 *   3. 文档页之间换页后（由 <ClientRouter /> 完成，见 layouts/DocPage.astro）
 *      重新收集标题并恢复折叠状态。
 *
 * 折叠状态的记忆分两处：
 *   - 浮动大纲的开关        → localStorage（跨会话，它是全站共用一个开关）
 *   - 左栏目录与它的分组    → sessionStorage（只在本次阅读会话里，
 *     因为换页会重建左栏，不记忆的话每次点文档都会把用户收起的分组重新展开）
 */
const FLOAT_KEY = 'outline-float-open';
/** 浮动面板不压正文的最小视口宽度，低于它就默认收起 */
const FLOAT_AUTO_OPEN_AT = 1440;
/** 本次会话里左栏目录各分组的展开状态，按「册名 · 分组文字」记 */
const NAV_STORE_KEY = 'doc-nav-open-state';

function readStoredBool(key: string): boolean | null {
	try {
		const raw = localStorage.getItem(key);
		return raw === null ? null : raw === '1';
	} catch {
		// 隐私模式读不到：每次都按屏幕宽度决定
		return null;
	}
}

function writeStoredBool(key: string, open: boolean): void {
	try {
		localStorage.setItem(key, open ? '1' : '0');
	} catch {
		/* 隐私模式写不进去，忽略即可 */
	}
}

/** sessionStorage 不可用时退化成「不记忆」，功能本身不受影响 */
function readNavState(): Record<string, boolean> {
	try {
		const raw = sessionStorage.getItem(NAV_STORE_KEY);
		return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
	} catch {
		return {};
	}
}

function writeNavState(id: string, open: boolean): void {
	try {
		const map = readNavState();
		map[id] = open;
		sessionStorage.setItem(NAV_STORE_KEY, JSON.stringify(map));
	} catch {
		/* 同上 */
	}
}

/**
 * 分组身份：册名 + 分组文字。同一册里出现同名分组会被一起折叠 ——
 * 这是可接受的取舍，比用数组下标稳（改一次 _nav.yaml 顺序下标就全变了）。
 * 左栏整体（窄屏那个 details.doc-nav）用固定 id 记。
 */
function navIdOf(el: HTMLElement): string | null {
	const sidebar = el.closest<HTMLElement>('.doc-nav[data-book]');
	const book = sidebar?.dataset.book ?? '';
	if (el.hasAttribute('data-doc-sidebar')) return `${book}::__sidebar__`;
	const label = el.querySelector<HTMLElement>('.doc-group-label')?.textContent?.trim();
	return label ? `${book}::${label}` : null;
}

export function initArticleOutline(): void {
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

	/*
	 * 「这条 toggle 是用户点的还是程序改的」不能靠记名单来配对：
	 * toggle 事件是排队派发的，连续两次程序改动 + 一次用户改动就会把名单错位，
	 * 于是把程序行为存成了用户的选择（表现为「记住收起选择」偶发失效）。
	 * 改成反过来归因 —— 先在 summary 上收到真实输入（pointerdown / 键盘），
	 * 才认为紧随其后的那次 toggle 出自用户。程序改 open 永远不会带输入事件。
	 */
	const userActed = new WeakSet<HTMLDetailsElement>();

	const setOpen = (el: HTMLDetailsElement, next: boolean): void => {
		if (el.open !== next) el.open = next;
	};

	const markUserActed = (target: EventTarget | null): void => {
		const summary = (target as Element | null)?.closest?.('summary');
		const details = summary?.parentElement;
		if (details instanceof HTMLDetailsElement) userActed.add(details);
	};

	document.addEventListener('pointerdown', (e) => markUserActed(e.target), true);
	document.addEventListener(
		'keydown',
		(e) => {
			if (e.key === ' ' || e.key === 'Enter') markUserActed(document.activeElement);
		},
		true,
	);

	/**
	 * 折叠块的展开状态：
	 *   - 窄屏：左栏和大纲都收起（它们排到正文前，展开会吃掉第一屏）；
	 *   - 宽屏浮动大纲：用户选过就听用户的，没选过按视口宽度决定；
	 *   - 左栏分组：用户在这次会话里收起过的，换页后保持收起。
	 */
	const applyDefaults = () => {
		const narrow = window.matchMedia('(max-width: 900px)').matches;
		for (const el of document.querySelectorAll<HTMLDetailsElement>(
			'details.outline, details.doc-nav',
		)) {
			const floating = el.classList.contains('outline--float') && !narrow;
			const sidebar = el.matches('.doc-nav[data-book]');
			let next: boolean;
			if (narrow && sidebar) next = readNavState()[navIdOf(el) ?? ''] ?? false;
			else if (narrow) next = false;
			else if (floating) {
				let stored = readStoredBool(FLOAT_KEY);
				/*
				 * 大纲模块是动态 import 的，从「页面可见」到「脚本跑起来」之间有个窗口期。
				 * 用户如果在这段时间里点了收起，那次 toggle 没人听见、没写进存储，
				 * 而服务端渲染出来的是 <details open> —— 所以此刻 DOM 上是收起状态
				 * 本身就说明是用户干的，认下来，别按视口宽度给他重新撑开。
				 */
				if (stored === null && !el.open) {
					writeStoredBool(FLOAT_KEY, false);
					stored = false;
				}
				next = stored ?? window.innerWidth >= FLOAT_AUTO_OPEN_AT;
			} else next = true;
			setOpen(el, next);
		}

		if (narrow) return;
		const remembered = readNavState();
		for (const el of document.querySelectorAll<HTMLDetailsElement>('details[data-nav-group]')) {
			const id = navIdOf(el);
			if (id && id in remembered) setOpen(el, remembered[id]);
		}
	};

	// details 的 toggle 不冒泡，用捕获在 document 上收口：换页会把大纲 / 左栏
	// 整个替换掉，绑在元素上的监听会跟着节点一起丢。
	document.addEventListener(
		'toggle',
		(event) => {
			const el = event.target;
			if (!(el instanceof HTMLDetailsElement)) return;
			// 只有能归因到真实输入的 toggle 才算用户的选择
			if (!userActed.has(el)) return;
			userActed.delete(el);

			if (el.matches('details.outline--float')) {
				writeStoredBool(FLOAT_KEY, el.open);
				return;
			}
			if (el.matches('.doc-nav[data-book]') || el.matches('[data-nav-group]')) {
				const id = navIdOf(el);
				if (id) writeNavState(id, el.open);
			}
		},
		true,
	);

	/* ---------- 文档页换页（<ClientRouter />）的接线 ----------
	 * 换页只换 <body>，模块脚本不会重跑，所以标题、折叠状态都得重新收集。
	 * before-preparation 是「开始取下一篇」，after-swap 是「正文已经换上」，
	 * page-load 在首屏和每次换页后都会派发，用它做统一收口。
	 */
	const shell = () => document.querySelector<HTMLElement>('main.article-shell');

	document.addEventListener('astro:before-preparation', () => {
		// 只有文档版式才有左栏换页，文章页这个事件不会带着左栏变化
		const el = shell();
		if (el?.dataset.layout === 'doc') el.dataset.loading = '';
	});

	const clearLoading = () => {
		const el = shell();
		if (el) delete el.dataset.loading;
	};

	document.addEventListener('astro:after-preparation', clearLoading);
	document.addEventListener('astro:after-swap', () => {
		collect();
		update();
		applyDefaults();
	});
	document.addEventListener('astro:page-load', () => {
		clearLoading();
		collect();
		update();
		applyDefaults();
	});

	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll, { passive: true });
	window.matchMedia('(max-width: 900px)').addEventListener('change', applyDefaults);

	collect();
	update();
	applyDefaults();
}
