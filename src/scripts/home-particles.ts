/**
 * 首页 hero 背景粒子（tsParticles）。
 *
 * 没有用官方封装 <Particles>（@tsparticles/astro）：它在 dev 下会把
 * initParticlesEngine 和组件脚本拆成两个模块实例，状态不共享，粒子永远不加载
 * （生产构建里被打进同一个 chunk 才碰巧能跑）。而且它把 id 写在 data-id 上、
 * tsParticles 却按 getElementById 找容器，会另建一个 canvas 挂到 body。
 * 直接用引擎：tsParticles.load({ element }) —— 路径唯一，dev/prod 行为一致。
 */
import { tsParticles } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';

/* 亮/暗两套粒子色，与 tokens.css 的 --c-accent 保持一致 */
const COLORS = { light: '#087ea4', dark: '#58c4dc' };

export function initHomeParticles(): void {
	const el = document.getElementById('hero-particles');
	const baked = el?.dataset.particlesOptions;

	if (!el || !baked) return;

	// 尊重系统设置：减少动效时完全不启动粒子，静态背景仍然可用
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
	if (reduceMotion.matches) return;

	const currentTheme = () =>
		document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

	const buildOptions = (theme: string) => {
		const options = JSON.parse(baked);
		const color = COLORS[theme as 'light' | 'dark'] ?? COLORS.light;
		if (options?.particles?.color) options.particles.color.value = color;
		if (options?.particles?.links?.color) options.particles.links.color = color;
		return options;
	};

	let container: Awaited<ReturnType<typeof tsParticles.load>> = undefined;
	let renderSeq = 0;

	const render = async (theme: string) => {
		const seq = ++renderSeq;
		container?.destroy();
		container = undefined;

		const next = await tsParticles.load({
			id: 'hero-particles',
			element: el,
			options: buildOptions(theme),
		});

		// 主题切换很快时，旧的一次 load 可能晚于新的一次返回，丢弃即可
		if (seq !== renderSeq) {
			next?.destroy();
			return;
		}

		container = next;
		if (document.hidden) container?.pause();
	};

	// 插件注册完成后才能 load；注册和 load 用的是同一个引擎实例
	loadSlim(tsParticles)
		.then(() => {
			void render(currentTheme());

			// 主题切换时重新着色。View Transition 期间 data-theme 只变一次，
			// 防抖是为了避免与过渡动画抢帧。
			let themeTimer = 0;
			const observer = new MutationObserver(() => {
				window.clearTimeout(themeTimer);
				themeTimer = window.setTimeout(() => void render(currentTheme()), 120);
			});
			observer.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ['data-theme'],
			});

			// 标签页不可见时暂停绘制，回来再继续
			document.addEventListener('visibilitychange', () => {
				if (!container) return;
				if (document.hidden) container.pause();
				else container.play();
			});

			// 用户在系统层面切换「减少动效」时，实时生效
			reduceMotion.addEventListener('change', (event) => {
				if (event.matches) {
					renderSeq += 1;
					container?.destroy();
					container = undefined;
				} else {
					void render(currentTheme());
				}
			});
		})
		.catch((error) => {
			console.error('[particles] 初始化失败', error);
		});
}
