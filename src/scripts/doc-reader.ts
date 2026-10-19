/**
 * 文档版式：左侧点文章，原地换右侧。
 *
 * 不整页跳转：fetch 目标页 → 只替换 .article-main 与 .outline → pushState 同步地址。
 * 这样刷新、分享、前进后退都还是对的那一篇。
 *
 * ⚠️ 换页只认 **pathname**：大纲用的是 #锚点，浏览器做同文档片段导航时同样会派发
 * popstate。如果把它当成换页处理，就会 fetch 当前页、替换正文，而 swap 末尾的
 * scrollTo(0) 会把刚跳过去的滚动位置抹平——表现就是「点大纲只改地址、不跳转」。
 * 所以这里用 shownPath 记住当前真正展示的是哪一篇，路径没变就什么都不做。
 *
 * 正文替换后需要让大纲重新收集标题，所以通过 onSwap 注入回调，
 * 避免这个模块反过来依赖 article-outline。
 */
export interface DocReaderOptions {
	/** 正文 / 大纲替换完成、地址同步之后调用 */
	onSwap?: () => void;
}

/** 把当前页的某个 meta 更新为目标文档里的值 */
function syncMeta(selector: string, content: string | null | undefined): void {
	if (content == null) return;
	document.querySelector(selector)?.setAttribute('content', content);
}

/**
 * 原地换页后同步页面级元信息。
 *
 * 目标页是构建好的静态 HTML，所以直接以它为准；URL 类的字段用点击目标的
 * 绝对地址兜底，不在这里拼接任何路由规则。这样文档 URL 以后从 /blog/ 搬到
 * /docs/ 时，这段逻辑不需要改。
 */
function syncPageMeta(next: Document, href: string): void {
	const targetUrl = new URL(href, location.href);
	const attr = (selector: string, name = 'content') =>
		next.querySelector(selector)?.getAttribute(name) ?? undefined;

	const nextTitle =
		attr('meta[property="og:title"]') ??
		attr('meta[property="twitter:title"]') ??
		next.title;
	const nextDescription =
		attr('meta[name="description"]') ??
		attr('meta[property="og:description"]') ??
		attr('meta[property="twitter:description"]') ??
		'';
	const nextImage =
		attr('meta[property="og:image"]') ?? attr('meta[property="twitter:image"]');
	const nextType = attr('meta[property="og:type"]');
	const nextUrl =
		attr('meta[property="og:url"]') ??
		attr('meta[property="twitter:url"]') ??
		targetUrl.href;

	document.title = next.title;
	syncMeta('meta[name="title"]', nextTitle);
	syncMeta('meta[name="description"]', nextDescription);
	syncMeta('meta[property="og:type"]', nextType);
	syncMeta('meta[property="og:url"]', nextUrl);
	syncMeta('meta[property="og:title"]', nextTitle);
	syncMeta('meta[property="og:description"]', nextDescription);
	syncMeta('meta[property="og:image"]', nextImage);
	syncMeta('meta[property="twitter:url"]', nextUrl);
	syncMeta('meta[property="twitter:title"]', nextTitle);
	syncMeta('meta[property="twitter:description"]', nextDescription);
	syncMeta('meta[property="twitter:image"]', nextImage);
	syncMeta(
		'meta[property="article:published_time"]',
		attr('meta[property="article:published_time"]'),
	);
	syncMeta(
		'meta[property="article:modified_time"]',
		attr('meta[property="article:modified_time"]'),
	);

	const canonical = attr('link[rel="canonical"]', 'href') ?? targetUrl.href;
	document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
}

export function initDocReader(options: DocReaderOptions = {}): void {
	const shell = document.querySelector<HTMLElement>('main.article-shell[data-layout="doc"]');
	if (!shell) return;

	const docNav = shell.querySelector<HTMLElement>('.doc-nav');
	let busy = false;
	/** 当前实际展示的那一篇的路径，用来区分「换文档」和「只是滚到某个锚点」 */
	let shownPath = location.pathname;

	const setCurrent = (pathname: string) => {
		for (const a of shell.querySelectorAll<HTMLAnchorElement>('.doc-nav a')) {
			if (new URL(a.href).pathname === pathname) a.setAttribute('aria-current', 'page');
			else a.removeAttribute('aria-current');
		}

		// 分支箭头的强调色跟着当前文档走（左栏本身不替换）
		for (const group of shell.querySelectorAll<HTMLDetailsElement>('.doc-group')) {
			const active = [...group.querySelectorAll<HTMLAnchorElement>('a')].some(
				(link) => new URL(link.href).pathname === pathname,
			);
			group.classList.toggle('is-current', active);
		}
	};

	const swap = async (href: string, push: boolean) => {
		if (busy) return;
		busy = true;
		shell.dataset.loading = '';

		try {
			const res = await fetch(href, { headers: { accept: 'text/html' } });
			if (!res.ok) throw new Error(String(res.status));

			const next = new DOMParser().parseFromString(await res.text(), 'text/html');
			const nextShell = next.querySelector<HTMLElement>('main.article-shell');

			// 目标不是文档版式（没有左目录）就走正常跳转，别把导航弄丢
			if (!nextShell || nextShell.dataset.layout !== 'doc') {
				location.href = href;
				return;
			}

			// 跨文档册（跳到另一本文档册）也整页跳，左栏才对得上
			const curNav = shell.querySelector<HTMLElement>('.doc-nav');
			const nextNav = nextShell.querySelector<HTMLElement>('.doc-nav');
			if (!curNav || !nextNav || curNav.dataset.book !== nextNav.dataset.book) {
				location.href = href;
				return;
			}

			const nextArticle = nextShell.querySelector('.article-main');
			const curArticle = shell.querySelector('.article-main');
			if (!nextArticle || !curArticle) {
				location.href = href;
				return;
			}

			curArticle.replaceWith(document.importNode(nextArticle, true));

			const curOutline = shell.querySelector('.outline');
			const nextOutline = nextShell.querySelector('.outline');
			if (nextOutline) {
				const node = document.importNode(nextOutline, true);
				if (curOutline) curOutline.replaceWith(node);
				else shell.append(node);
			} else if (curOutline) {
				curOutline.remove();
			}

			const path = new URL(href, location.href).pathname;
			shell.dataset.hasToc = nextShell.dataset.hasToc ?? 'false';
			setCurrent(path);

			syncPageMeta(next, href);

			if (push) history.pushState({ doc: true }, '', href);

			shownPath = path;
			window.scrollTo({ top: 0 });
			options.onSwap?.();
		} catch {
			location.href = href;
		} finally {
			busy = false;
			delete shell.dataset.loading;
		}
	};

	docNav?.addEventListener('click', (event) => {
		const a = (event.target as HTMLElement).closest<HTMLAnchorElement>('a');
		if (!a) return;
		// 新标签页 / 中键 / 带修饰键：交给浏览器
		if (a.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;

		const url = new URL(a.href);
		// 只动锚点不动路径（例如带 # 的册内链接）：让浏览器原生跳，别拦下来换页
		if (url.pathname === location.pathname && url.hash) return;

		event.preventDefault();
		if (url.pathname === location.pathname) return;
		void swap(a.getAttribute('href') ?? a.href, true);
	});

	// 浏览器前进 / 后退：只有路径真的变了才换页。
	// 点大纲产生的同文档片段导航也会派发 popstate，这里必须放过，否则正文会被
	// 重新替换、滚动位置被抹平。
	window.addEventListener('popstate', () => {
		if (location.pathname === shownPath) return;
		void swap(location.pathname, false);
	});
}
