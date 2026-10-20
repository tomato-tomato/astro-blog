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

	/**
	 * 链接预取：这里**故意不写 `prefetch` 配置**，两件事都是实测出来的（见
	 * astro-blog_markdown/07 号文档的「试点实施记录」）：
	 *
	 * 1. 写了 `prefetch: {...}` 就是全站注入 —— 每个页面都会多加载一份 prefetch
	 *    运行时代码，实测每页 +1.37 KB gzip，包括根本不需要预取的固定页。
	 * 2. 不写也不等于没有预取：只要页面里有 <ClientRouter />（目前只有文档页），
	 *    它的脚本就会调用 prefetch 的 init({ prefetchAll: true })，
	 *    缺省策略是 hover（astro/dist/transitions/vite-plugin-transitions.js 里
	 *    `prefetchDisabled = config.prefetch === false`，缺省不算关闭）。
	 *    也就是「只在文档页 hover 预取左栏」，正好是需要的范围。
	 *
	 * 想要全站都预取，就显式加：
	 *   prefetch: { prefetchAll: true, defaultStrategy: 'hover' }
	 * 想彻底关掉，就写 `prefetch: false`（ClientRouter 里那段 init 会被 tree-shake 掉）。
	 */

	experimental: {
		/**
		 * 客户端预渲染（Speculation Rules API）**保持关闭**。
		 *
		 * 试过打开，实测两点结论：
		 *   - 文档页上它没有收益：ClientRouter 会 preventDefault 掉点击、自己去 fetch 目标页
		 *     再做 DOM 换入，浏览器预渲染好的那份文档永远轮不到被激活，
		 *     等于每次 hover 白渲染一个隐藏页面（hover 时确实多发一个请求）。
		 *   - 非文档页上收益无法确认：本地 preview 里点击后浏览器仍另发了一次 document 请求，
		 *     而且本地 RTT≈0，本来就量不出差别。真要收益得到部署环境用真实网络验。
		 *
		 * 保留这个开关的说明，是为了下次有人想开它时不用重新踩一遍。
		 */
		clientPrerender: false,
	},

	markdown: {
		// 代码高亮走双主题：亮色用 github-light、暗色用 github-dark。
		// 切换逻辑在 global.css 里按 [data-theme] 读 --shiki-dark-* 变量。
		shikiConfig: {
			themes: {
				light: 'github-light',
				dark: 'github-dark',
			},
		},
	},
});
