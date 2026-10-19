/**
 * 文档版式：左侧点文章，原地换右侧。
 *
 * 不整页跳转：fetch 目标页 → 只替换 .article-main 与 .outline → pushState 同步地址。
 * 这样刷新、分享、前进后退都还是对的那一篇。
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

	const setCurrent = (pathname: string) => {
		for (const a of shell.querySelectorAll<HTMLAnchorElement>('.doc-nav a')) {
			if (new URL(a.href).pathname === pathname) a.setAttribute('aria-current', 'page');
			else a.removeAttribute('aria-current');
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

			// 跨文档集（换了另一本书）也整页跳，左栏才对得上
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

			shell.dataset.hasToc = nextShell.dataset.hasToc ?? 'false';
			setCurrent(new URL(href, location.href).pathname);

			syncPageMeta(next, href);

			if (push) history.pushState({ doc: true }, '', href);

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

		const path = new URL(a.href).pathname;
		event.preventDefault();
		if (path === location.pathname) return;
		void swap(a.getAttribute('href') ?? a.href, true);
	});

	// 浏览器前进 / 后退
	window.addEventListener('popstate', () => {
		void swap(location.pathname, false);
	});
}
