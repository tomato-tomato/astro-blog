/**
 * 网格背景的指针跟随。
 *
 * 只在 [data-backdrop-interactive] 存在时由 page.ts 动态加载。
 * 背景层本身 pointer-events: none，这里监听 window，把指针位置写成
 * CSS 变量交给 backdrops.css 的径向光晕使用。
 *
 * 触屏、reduced-motion 下不更新；切到这些状态时清掉内联变量，
 * 让背景回到默认的静态光晕。
 */
const SELECTOR = '[data-backdrop-interactive]';
const finePointer = window.matchMedia('(pointer: fine)');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let initialized = false;
let targets: HTMLElement[] = [];
let frame = 0;
let pointerX = 0;
let pointerY = 0;

function reset(): void {
	for (const target of targets) {
		target.style.removeProperty('--backdrop-pointer-x');
		target.style.removeProperty('--backdrop-pointer-y');
	}
}

function apply(): void {
	frame = 0;

	for (const target of targets) {
		const rect = target.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) continue;

		const x = ((pointerX - rect.left) / rect.width) * 100;
		const y = ((pointerY - rect.top) / rect.height) * 100;
		target.style.setProperty('--backdrop-pointer-x', `${x.toFixed(2)}%`);
		target.style.setProperty('--backdrop-pointer-y', `${y.toFixed(2)}%`);
	}
}

function onPointerMove(event: PointerEvent): void {
	if (!finePointer.matches || reduceMotion.matches) return;

	pointerX = event.clientX;
	pointerY = event.clientY;
	if (frame === 0) frame = requestAnimationFrame(apply);
}

export function initBackdropInteraction(): void {
	if (initialized) return;
	initialized = true;

	targets = Array.from(document.querySelectorAll<HTMLElement>(SELECTOR));
	if (targets.length === 0) return;

	window.addEventListener('pointermove', onPointerMove, { passive: true });
	document.documentElement.addEventListener('pointerleave', reset);

	reduceMotion.addEventListener('change', (event) => {
		if (event.matches) reset();
	});

	finePointer.addEventListener('change', (event) => {
		if (!event.matches) reset();
	});
}
