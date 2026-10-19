import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import type { NavConfigNode } from "./lib/doc-nav";

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
// 以 _ 开头的是册级配置（_book.md / _nav.yaml），排除在正文之外。
const docs = defineCollection({
	loader: glob({
		base: "./src/content/docs",
		pattern: ["**/*.{md,mdx}", "!**/_*.{md,mdx}"],
	}),
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

// 文档册元数据：src/content/docs/<文档册>/_book.md
// 和正文放在同一棵目录里；id 取目录第一段，与文档册名一一对应。
const books = defineCollection({
	loader: glob({
		base: "./src/content/docs",
		pattern: "**/_book.md",
		generateId: ({ entry }) => entry.split("/")[0],
	}),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			heroImage: image().optional(),
			order: z.number().default(0),
		}),
});

// 文档册左侧目录：src/content/docs/<文档册>/_nav.yaml
// title 是顶部总标题（纯文本）；items 里的节点有三种：
// 链接（doc）、可折叠文本分组（children）、纯展示文本（两者都没有）。
const navNode: z.ZodType<NavConfigNode> = z.lazy(() =>
	z.object({
		label: z.string().min(1),
		doc: z.string().min(1).optional(),
		children: z.array(navNode).optional(),
	}),
);

const nav = defineCollection({
	loader: glob({
		base: "./src/content/docs",
		pattern: "**/_nav.yaml",
		generateId: ({ entry }) => entry.split("/")[0],
	}),
	schema: z.object({
		title: z.string().min(1).optional(),
		items: z.array(navNode),
	}),
});

export const collections = { blog, docs, books, nav };
