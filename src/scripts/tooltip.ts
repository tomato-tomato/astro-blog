/**
 * 全局悬浮提示：替代原生 title 的「慢半拍」提示。
 *
 * 用法：给可能被截断的元素加 data-tooltip="完整文本"。
 * 只有元素真的溢出（单行 ellipsis 或 line-clamp）时才显示；
 * 没截断的内容 hover 不会弹提示，避免满屏气泡。
 *
 * 浮层挂在 body 上、position: fixed，因此不会被左栏 / 大纲的
 * overflow 容器裁掉；滚动、点击、失焦、Esc 都会立即收起。
 */
const SELECTOR = '[data-tooltip]';
const GAP = 8;
const EDGE = 8;

let initialized = false;
let tip: HTMLDivElement | null = null;
let current: HTMLElement | null = null;

function getTip(): HTMLDivElement {
	// 文档页换页（<ClientRouter />）会重建 <body>，缓存的浮层会变成游离节点，
	// 所以这里检查它还在不在文档里，不在就重挂一个。
	if (tip?.isConnected) return tip;

	tip = document.createElement('div');
	tip.className = 'ui-tooltip';
	tip.setAttribute('role', 'tooltip');
	tip.hidden = true;
	document.body.append(tip);
	return tip;
}

/** 单行省略看宽度，line-clamp 看高度 */
function isTruncated(el: HTMLElement): boolean {
	const style = getComputedStyle(el);
	const clamp = style.getPropertyValue('-webkit-line-clamp').trim();
	if (clamp && clamp !== 'none') return el.scrollHeight > el.clientHeight + 1;
	return el.scrollWidth > el.clientWidth + 1;
}

function hide(): void {
	if (!current) return;
	current = null;
	if (tip) tip.hidden = true;
}

function show(target: HTMLElement): void {
	const text = target.dataset.tooltip?.trim();
	if (!text || !isTruncated(target)) return;

	const el = getTip();
	el.textContent = text;
	// 先归零再量尺寸，避免上一次的 left/top 影响 max-width 下的换行结果
	el.style.left = '0px';
	el.style.top = '0px';
	el.hidden = false;

	const rect = target.getBoundingClientRect();
	const box = el.getBoundingClientRect();

	let left = rect.left + rect.width / 2 - box.width / 2;
	left = Math.min(Math.max(EDGE, left), window.innerWidth - box.width - EDGE);

	let top = rect.top - box.height - GAP;
	if (top < EDGE) top = rect.bottom + GAP;
	top = Math.min(top, window.innerHeight - box.height - EDGE);

	el.style.left = `${Math.round(left)}px`;
	el.style.top = `${Math.round(top)}px`;
	current = target;
}

export function initTooltip(): void {
	if (initialized) return;
	initialized = true;

	document.addEventListener('pointerover', (event) => {
		// 触屏没有 hover，避免 pointerover 之后浮层一直挂着
		if (event.pointerType === 'touch') return;
		const target = (event.target as Element | null)?.closest<HTMLElement>(SELECTOR);
		if (!target || target === current) return;
		show(target);
	});

	document.addEventListener('pointerout', (event) => {
		if (!current) return;
		const next = event.relatedTarget;
		if (next instanceof Node && current.contains(next)) return;
		hide();
	});

	document.addEventListener('focusin', (event) => {
		const target = (event.target as Element | null)?.closest<HTMLElement>(SELECTOR);
		// 鼠标点击也会让链接获得焦点；只给键盘聚焦（:focus-visible）弹提示
		if (target?.matches(':focus-visible')) show(target);
	});

	document.addEventListener('focusout', hide);
	document.addEventListener('pointerdown', hide);
	document.addEventListener('click', hide);
	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') hide();
	});
	window.addEventListener('resize', hide);
	// scroll 不冒泡，用捕获阶段把左栏 / 大纲内部的滚动也接住
	window.addEventListener('scroll', hide, { capture: true, passive: true });
}
