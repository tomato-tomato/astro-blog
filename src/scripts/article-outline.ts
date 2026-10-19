/**
 * 文章大纲高亮 + 展开状态。
 *
 * 找出「已经滚过视口上沿」的最后一个标题，标给对应链接。
 * 文档版式原地换文章后，正文和大纲都被替换了，需要调用返回的
 * collect() / update() / applyDefaults() 重新收集一次。
 *
 * 浮动大纲（.outline--float，只有文档版式用）的展开 / 收起状态记在 localStorage：
 * 没记过就按视口宽度决定——1440px 以上面板正好落在正文右侧的空白里，默认展开；
 * 再窄会压到文字，默认收起成一个「目录」胶囊。
 */
const FLOAT_KEY = 'outline-float-open';
/** 浮动面板不压正文的最小视口宽度，低于它就默认收起 */
const FLOAT_AUTO_OPEN_AT = 1440;

function readStored(): boolean | null {
	try {
		const raw = localStorage.getItem(FLOAT_KEY);
		return raw === null ? null : raw === '1';
	} catch {
		// 隐私模式读不到：每次都按屏幕宽度决定
		return null;
	}
}

function writeStored(open: boolean): void {
	try {
		localStorage.setItem(FLOAT_KEY, open ? '1' : '0');
	} catch {
		/* 隐私模式写不进去，忽略即可 */
	}
}

export interface ArticleOutlineController {
	/** 重新收集正文标题与大纲链接（换页后调用） */
	collect: () => void;
	/** 按当前滚动位置刷新高亮 */
	update: () => void;
	/** 按屏幕宽度与用户选择决定各折叠块的展开状态 */
	applyDefaults: () => void;
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

	/* 程序改 open 会派发 toggle，但这些不是用户的选择，不能存进 localStorage。 */
	const skip = new WeakSet<Element>();

	/**
	 * 折叠块的展开状态：窄屏一律收起（它们会排到正文前，展开就吃掉第一屏）；
	 * 宽屏的浮动大纲听用户的选择，用户没选过才按视口宽度决定。
	 */
	const applyDefaults = () => {
		const narrow = window.matchMedia('(max-width: 900px)').matches;
		for (const el of document.querySelectorAll<HTMLDetailsElement>('details.outline, details.doc-nav')) {
			const floating = el.classList.contains('outline--float') && !narrow;
			const next = floating ? (readStored() ?? window.innerWidth >= FLOAT_AUTO_OPEN_AT) : !narrow;
			if (el.open === next) continue;
			skip.add(el);
			el.open = next;
		}
	};

	// details 的 toggle 不冒泡，用捕获在 document 上收口：浮动大纲会被原地换页
	// 整个替换掉，绑在元素上的监听会跟着节点一起丢。
	document.addEventListener(
		'toggle',
		(event) => {
			const el = event.target;
			if (!(el instanceof HTMLElement) || !el.matches('details.outline--float')) return;
			if (skip.has(el)) {
				skip.delete(el);
				return;
			}
			writeStored((el as HTMLDetailsElement).open);
		},
		true,
	);

	window.addEventListener('scroll', onScroll, { passive: true });
	window.addEventListener('resize', onScroll, { passive: true });
	window.matchMedia('(max-width: 900px)').addEventListener('change', applyDefaults);

	collect();
	update();
	applyDefaults();

	return { collect, update, applyDefaults };
}
