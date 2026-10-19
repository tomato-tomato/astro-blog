/**
 * 分类页筛选：点 chip 只在前端显隐卡片，并同步 ?c=。
 * 由 src/pages/categories/index.astro 引入。
 */
export function initCategoryFilter(): void {
	const root = document.querySelector<HTMLElement>('[data-filter]');

	if (!root) return;

	const chips = Array.from(root.querySelectorAll<HTMLButtonElement>('.chip'));
	const items = Array.from(document.querySelectorAll<HTMLLIElement>('[data-post-list] > li'));
	const empty = document.querySelector<HTMLElement>('[data-filter-empty]');

	const apply = (category: string) => {
		let shown = 0;

		for (const chip of chips) {
			chip.setAttribute('aria-pressed', String(chip.dataset.category === category));
		}

		for (const li of items) {
			const match = !category || li.dataset.category === category;
			li.hidden = !match;
			if (match) shown++;
		}

		if (empty) empty.hidden = shown > 0;

		// 只改查询串，不产生历史记录
		const url = new URL(window.location.href);
		if (category) url.searchParams.set('c', category);
		else url.searchParams.delete('c');
		history.replaceState(null, '', url);
	};

	root.addEventListener('click', (event) => {
		const chip = (event.target as HTMLElement).closest<HTMLButtonElement>('.chip');
		if (!chip) return;
		apply(chip.dataset.category ?? '');
	});

	// 刷新 / 从外链进来时恢复选中
	const initial = new URL(window.location.href).searchParams.get('c') ?? '';
	apply(chips.some((c) => c.dataset.category === initial) ? initial : '');
}
