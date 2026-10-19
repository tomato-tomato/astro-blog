import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// 普通文章：分类 = 目录，src/content/blog/<分类>/<文章>.md
// 文档不在这个集合里，见下面的 docs。
const blog = defineCollection({
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
		}),
});

// 文档正文：src/content/docs/<文档册>/<篇>.md
// 文档册的标识 = id 的第一段；册内顺序由 order 决定（小的在前）。
const docs = defineCollection({
	loader: glob({ base: "./src/content/docs", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			order: z.number().default(0),
			draft: z.boolean().default(false),
		}),
});

// 文档册元数据：src/content/books/<文档册>.md
// 只用于 /docs/ 的文档册卡片与册目录页，和具体文档正文分开。
const books = defineCollection({
	loader: glob({ base: "./src/content/books", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			heroImage: image().optional(),
			order: z.number().default(0),
		}),
});

export const collections = { blog, docs, books };
