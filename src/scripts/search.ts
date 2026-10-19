/**
 * 页头搜索。
 *
 * 数据来自构建期生成的 /search.json（见 src/pages/search.json.ts），
 * 第一次聚焦 / 展开搜索时才 fetch，不占首屏。
 * 两种形态（宽屏常驻输入框、窄屏展开面板）共用这套逻辑。
 */
import type { SearchEntry } from '../lib/search-types';

export function initSearch(): void {
	const root = document.querySelector<HTMLElement>('[data-search]');
	if (!root) return;

	const trigger = root.querySelector<HTMLButtonElement>('[data-search-trigger]');
	const input = root.querySelector<HTMLInputElement>('[data-search-input]');
	const list = root.querySelector<HTMLUListElement>('[data-search-results]');

	let items: SearchEntry[] | null = null;
	let pending: Promise<SearchEntry[]> | null = null;
	let active = -1;
	let current: SearchEntry[] = [];

	const load = (): Promise<SearchEntry[]> => {
		if (items) return Promise.resolve(items);
		if (!pending) {
			pending = fetch(`${import.meta.env.BASE_URL}search.json`)
				.then((r) => (r.ok ? r.json() : []))
				.then((data: SearchEntry[]) => {
					items = data;
					return data;
				})
				.catch(() => {
					items = [];
					return [];
				});
		}
		return pending;
	};

	const score = (item: SearchEntry, terms: string[]): number => {
		const title = item.title.toLowerCase();
		const tags = item.tags.join(' ').toLowerCase();
		const context = [item.category, item.book].filter(Boolean).join(' ').toLowerCase();
		const description = item.description.toLowerCase();

		let total = 0;
		for (const term of terms) {
			let hit = 0;
			if (title.includes(term)) hit += 3;
			if (tags.includes(term) || context.includes(term)) hit += 2;
			if (description.includes(term)) hit += 1;
			if (hit === 0) return 0; // 有一个词没命中就整体不匹配
			total += hit;
		}
		return total;
	};

	const close = () => {
		root.removeAttribute('data-open');
		trigger?.setAttribute('aria-expanded', 'false');
		if (list) {
			list.hidden = true;
			list.innerHTML = '';
		}
		active = -1;
		current = [];
	};

	const render = (results: SearchEntry[], query: string) => {
		if (!list) return;
		list.innerHTML = '';
		active = -1;
		current = results;

		if (!query.trim()) {
			list.hidden = true;
			return;
		}

		if (results.length === 0) {
			const li = document.createElement('li');
			li.className = 'search-empty';
			li.textContent = '没有找到相关内容';
			list.appendChild(li);
			list.hidden = false;
			return;
		}

		results.forEach((item) => {
			const li = document.createElement('li');
			const a = document.createElement('a');
			a.href = item.url;

			const title = document.createElement('span');
			title.className = 'search-result-title';
			title.textContent = item.title;

			const meta = document.createElement('span');
			meta.className = 'search-result-meta';

			const kind = document.createElement('span');
			kind.className = `search-result-kind is-${item.kind}`;
			kind.textContent = item.kind === 'doc' ? '文档' : '文章';

			// 文档默认只显示类型与日期；属于别的文档册时补上册名，避免只看到「文档」
			const bookLabel =
				item.kind === 'doc' && item.book && item.book !== '文档' ? item.book : undefined;
			const detail = [item.kind === 'doc' ? bookLabel : item.category, item.date]
				.filter(Boolean)
				.join(' · ');
			meta.append(kind);
			if (detail) meta.append(document.createTextNode(` ${detail}`));

			a.append(title, meta);
			li.appendChild(a);
			list.appendChild(li);
		});

		list.hidden = false;
	};

	const run = (query: string) => {
		const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
		if (terms.length === 0 || !items) {
			render([], query);
			return;
		}

		const results = items
			.map((item) => ({ item, s: score(item, terms) }))
			.filter((x) => x.s > 0)
			.sort((a, b) => b.s - a.s)
			.slice(0, 8)
			.map((x) => x.item);

		render(results, query);
	};

	const move = (delta: number) => {
		if (!list || list.hidden || current.length === 0) return;
		const links = Array.from(list.querySelectorAll('a'));
		if (links.length === 0) return;

		links.forEach((a) => a.removeAttribute('data-active'));
		active = (active + delta + links.length) % links.length;
		const el = links[active];
		el.setAttribute('data-active', '');
		el.scrollIntoView({ block: 'nearest' });
	};

	const open = async () => {
		root.setAttribute('data-open', '');
		trigger?.setAttribute('aria-expanded', 'true');
		input?.focus();
		await load();
		if (input && input.value) run(input.value);
	};

	trigger?.addEventListener('click', () => {
		if (root.hasAttribute('data-open')) close();
		else void open();
	});

	input?.addEventListener('focus', () => {
		void load();
	});

	input?.addEventListener('input', async () => {
		await load();
		run(input.value);
	});

	input?.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(1);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(-1);
		} else if (event.key === 'Enter') {
			const links = list?.querySelectorAll('a');
			if (links && links.length > 0) {
				event.preventDefault();
				const target = links[active >= 0 ? active : 0] as HTMLAnchorElement;
				window.location.href = target.href;
			}
		} else if (event.key === 'Escape') {
			if (input.value) {
				input.value = '';
				run('');
			} else {
				close();
				input.blur();
			}
		}
	});

	document.addEventListener('click', (event) => {
		if (!root.contains(event.target as Node)) close();
	});
}
