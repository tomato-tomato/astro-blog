// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

/**
 * 站点地址：会写进 canonical / og:url / rss.xml / sitemap.xml，
 * 所以它必须是**真实可访问**的地址，不能用 example.com 这类占位符。
 *
 * 解析顺序：
 *  1. process.env.SITE —— 显式指定优先。
 *     在 Cloudflare 上：Worker → Settings → Build → Build Variables and Secrets 里加
 *     SITE = https://你的地址，改完不用动代码。绑了自定义域名后推荐用这个。
 *  2. PRODUCTION_SITE —— 没设 SITE 时的默认值（当前的 workers.dev 正式地址）。
 *
 * 预览分支（非生产分支）构建时会回落到 PRODUCTION_SITE：预览产物只给内部看，
 * 而且 Preview URL 自带 X-Robots-Tag: noindex，写成正式地址比写错更安全。
 */
const PRODUCTION_SITE = "https://astro-blog.tomato-tomato.workers.dev";

const site = process.env.SITE ?? PRODUCTION_SITE;

// 兜底：万一有人把地址改回占位符，让构建直接失败，而不是静默产出指向
// 不存在域名的 canonical / sitemap / rss（这种错误线上很难发现）。
if (!site.startsWith("https://") || site.includes("example.com")) {
	throw new Error(
		`[astro.config.mjs] site 配置有误（当前值：${site}）。\n` +
			`请把 PRODUCTION_SITE 改成你的真实地址，或在 Cloudflare 的 Build Variables 里设置 SITE=https://你的地址`,
	);
}

// https://astro.build/config
export default defineConfig({
	site,
	integrations: [mdx(), sitemap()],
	compressHTML: true,
});
