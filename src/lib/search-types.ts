/**
 * 搜索索引的共享类型。
 *
 * 构建期端点（src/pages/search.json.ts）与浏览器脚本（src/scripts/search.ts）
 * 都依赖这份定义；这里是纯类型，不引入任何服务端代码，客户端可以安全地
 * 用 `import type` 引用。
 */
export type SearchKind = 'article' | 'doc';

export interface SearchEntry {
	/** 内容类型：文章 / 文档 */
	kind: SearchKind;
	title: string;
	description: string;
	/** 普通文章的分类；文档为空 */
	category?: string;
	/** 文档所属的书；文章为空 */
	book?: string;
	tags: string[];
	date: string;
	url: string;
}
