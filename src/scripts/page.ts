/**
 * 客户端脚本入口（由 BaseLayout 引入，全站只加载这一份路由）。
 *
 * 每个页面都需要的（搜索、悬浮提示）直接同步加载；
 * 只在特定页面出现的（分类筛选、首页粒子、文章大纲 / 文档换页）按 DOM 动态加载，
 * 避免把 tsparticles 这类重依赖带到所有页面。
 *
 * 脚本本身仍在 src/scripts/ 下按职责拆分，这里只负责判断当前页面需要哪些。
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

	// 文章 / 文档阅读页
	if (document.querySelector('main.article-shell')) {
		void Promise.all([import('./article-outline'), import('./doc-reader')]).then(
			([{ initArticleOutline }, { initDocReader }]) => {
				const outline = initArticleOutline();
				initDocReader({
					onSwap() {
						outline.collect();
						outline.update();
						// 换页后的大纲是新节点，按用户存过的状态重新决定展开 / 收起
						outline.applyDefaults();
					},
				});
			},
		);
	}
}
