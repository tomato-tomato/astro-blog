/**
 * 客户端脚本入口（由 BaseLayout 引入，全站只加载这一份路由）。
 *
 * 每个页面都需要的（搜索、悬浮提示）直接同步加载；
 * 只在特定页面出现的（分类筛选、首页粒子、文章大纲）按 DOM 动态加载，
 * 避免把 tsparticles 这类重依赖带到所有页面。
 *
 * 脚本本身仍在 src/scripts/ 下按职责拆分，这里只负责判断当前页面需要哪些。
 *
 * ⚠️ 关于文档页换页：这里不再加载 doc-reader。文档页之间的原地换页由 Astro
 * 自带的 <ClientRouter /> 负责（见 layouts/DocPage.astro），换页后需要重建的
 * 大纲 / 折叠状态由 article-outline 自己监听 astro:page-load 处理。
 * 也正因为换页只换 <body>，页头用了 transition:persist 保住节点，
 * 这里的 initSearch() / initTooltip() 才不需要在换页后重跑。
 */
import { initSearch } from './search';
import { initTooltip } from './tooltip';

export function initPage(): void {
	initSearch();
	initTooltip();

	// 分类总览页
	if (document.querySelector('[data-filter]')) {
		void import('./category-filter').then(({ initCategoryFilter }) => initCategoryFilter());
	}

	// 分类总览 / 文档总入口：网格背景跟随指针
	if (document.querySelector('[data-backdrop-interactive]')) {
		void import('./backdrop').then(({ initBackdropInteraction }) => initBackdropInteraction());
	}

	// 首页 hero
	if (document.getElementById('hero-particles')) {
		void import('./home-particles').then(({ initHomeParticles }) => initHomeParticles());
	}

	// 文章 / 文档阅读页：大纲高亮 + 折叠状态（文档页换页后自己会重建）
	if (document.querySelector('main.article-shell')) {
		void import('./article-outline').then(({ initArticleOutline }) => initArticleOutline());
	}
}
