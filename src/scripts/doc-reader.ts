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

			document.title = next.title;
			const nextDesc = next.querySelector('meta[name="description"]');
			const curDesc = document.querySelector('meta[name="description"]');
			if (nextDesc && curDesc) curDesc.setAttribute('content', nextDesc.getAttribute('content') ?? '');

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
