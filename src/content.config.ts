import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const blog = defineCollection({
	// 分类 = 目录：src/content/blog/<分类>/<文章>.md
	// 文章的分类由 src/lib/posts.ts 的 getCategory() 从 id 的首段推导。
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			// 标签：一篇可挂多个，页面上按出现次数倒序
			tags: z.array(z.string()).default([]),
			// 草稿：true 的文章不进列表、不进 RSS、不生成页面
			draft: z.boolean().default(false),
			// 文章版式：
			//   post（默认）正文 + 右侧大纲
			//   doc        左侧文档目录 + 正文 + 右侧大纲
			// 注意别叫 layout —— 那是 Astro/MDX 的保留字段，会被当成布局组件路径去 import
			articleLayout: z.enum(['post', 'doc']).default('post'),
			// 文档集里的排序（小的在前）；同序时按发布时间
			docOrder: z.number().default(0),
		}),
});

export const collections = { blog };
