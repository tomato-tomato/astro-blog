/**
 * 页面背景动效的语义映射。
 *
 * 页面只传「页面类型」key，具体效果 / 强度 / 范围集中在这里，
 * 后续调整映射不需要改各个页面。
 */
export type BackdropVariant = 'aurora' | 'grid' | 'dots' | 'sweep' | 'paper' | 'stars';
export type BackdropIntensity = 'subtle' | 'normal' | 'strong';
export type BackdropScope = 'page' | 'header';

export interface BackdropConfig {
	variant: BackdropVariant;
	intensity: BackdropIntensity;
	scope: BackdropScope;
	/** 只有 grid 等支持指针跟随的变体需要 */
	interactive?: boolean;
}

export const PAGE_BACKDROPS = {
	articleList: { variant: 'aurora', intensity: 'subtle', scope: 'page' },
	categoryIndex: { variant: 'grid', intensity: 'subtle', scope: 'page', interactive: true },
	categoryDetail: { variant: 'sweep', intensity: 'subtle', scope: 'page' },
	docIndex: { variant: 'grid', intensity: 'subtle', scope: 'page', interactive: true },
	bookIndex: { variant: 'dots', intensity: 'subtle', scope: 'page' },
	tagIndex: { variant: 'dots', intensity: 'subtle', scope: 'page' },
	tagDetail: { variant: 'aurora', intensity: 'subtle', scope: 'page' },
	article: { variant: 'paper', intensity: 'subtle', scope: 'page' },
	doc: { variant: 'paper', intensity: 'subtle', scope: 'page' },
	about: { variant: 'paper', intensity: 'subtle', scope: 'page' },
	notFound: { variant: 'stars', intensity: 'normal', scope: 'page' },
} as const satisfies Record<string, BackdropConfig>;

export type BackdropKey = keyof typeof PAGE_BACKDROPS;

export function getBackdrop(key: BackdropKey | undefined): BackdropConfig | null {
	return key ? PAGE_BACKDROPS[key] : null;
}
