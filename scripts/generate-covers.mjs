#!/usr/bin/env node
/**
 * 头图自动生成 —— 阶段一（构建期程序化封面，不接 AI / 不做标题卡）。
 *
 * 做什么
 *   扫描 src/content 下的文章、文档和文档册，给每个「frontmatter 里没写 heroImage」的内容
 *   生成一张抽象封面（渐变 + 几何线条 / 圆弧，无噪点），用 sharp 光栅化成 1020×510（2:1）
 *   WebP 放进 src/assets/covers/；再单独生成一张 1200×630 的 JPEG 作为社交分享图兜底。
 *
 * 关键约定
 *   1. 内容 id 决定画面：所有随机量都由 id 的哈希派生，不放随机种子。
 *      同一篇文章每次构建得到同一张图，重复构建不产生 diff。
 *   2. 文件名 = id 哈希（8 位十六进制）+ .webp。前端 src/lib/covers.ts 用同一套哈希规则取图，
 *      两边必须保持一致（那边有注释指向本文件）。
 *   3. 作者手写的 heroImage 优先，脚本直接跳过这些内容。
 *   4. 每册文档固定一张封面，key 为 `book:<文档册名>`。
 *   5. 内容删除后遗留的旧图会在下次构建时清理（只清理符合命名规则的文件，其它文件不碰）。
 *
 * 运行时机：package.json 的 prebuild（以及 predev），不需要手动调用。
 * 想调风格：改下面的 COVER_WIDTH / COVER_HEIGHT / HUES / 构图参数，重新 build 即可全站换图。
 */
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentRoot = path.join(repoRoot, 'src', 'content');
const outDir = path.join(repoRoot, 'src', 'assets', 'covers');

/** 内容封面尺寸：2:1，与文章页头图（1020×510）和卡片（720×360）同比例，缩放不裁切 */
const COVER_WIDTH = 1020;
const COVER_HEIGHT = 510;
/** 社交分享图尺寸：1.91:1，是各平台抓取器最稳的比例；用 JPEG 以兼容所有爬虫 */
const SOCIAL_WIDTH = 1200;
const SOCIAL_HEIGHT = 630;
const SOCIAL_KEY = '@site';
const SOCIAL_FILE = 'social.jpg';
/** 社交图锁站点主色（tokens.css 的 --c-accent 青），分享出去时和站徽一致 */
const SOCIAL_HUE = 196;

/* ---------------------------------- 工具 ---------------------------------- */

/** FNV-1a 32 位；同时充当文件名和画面种子。改它等于全站换图，谨慎。 */
function hashKey(key) {
	let h = 0x811c9dc5;
	for (let i = 0; i < key.length; i++) {
		h ^= key.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h >>> 0;
}

/** mulberry32：小、快、可复现的伪随机数发生器，让画面只依赖 seed */
function makeRandom(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 十六进制颜色：librsvg 对 CSS3 的 hsl() 支持不稳，一律先换算成 hex */
function hsl(h, s, l) {
	h = ((h % 360) + 360) % 360;
	s /= 100;
	l /= 100;
	const a = s * Math.min(l, 1 - l);
	const channel = (n) => {
		const k = (n + h / 30) % 12;
		const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(255 * c)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${channel(0)}${channel(8)}${channel(4)}`;
}

const num = (v) => Number(v.toFixed(2));

/* -------------------------------- 内容扫描 -------------------------------- */

/** 递归列出目录下的 markdown / mdx；默认跳过以 _ 开头的册级配置 */
function listContentFiles(dir, { includeConfig = false } = {}) {
	if (!existsSync(dir)) return [];
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			out.push(...listContentFiles(full, { includeConfig }));
		} else if (/\.mdx?$/.test(entry.name) && (includeConfig || !entry.name.startsWith('_'))) {
			out.push(full);
		}
	}
	return out;
}

/** 取 frontmatter 段（首个 --- 到下一个 --- 之间）；没有 frontmatter 返回空串 */
function frontmatter(file) {
	const text = readFileSync(file, 'utf8');
	const lines = text.split('\n');
	if ((lines[0] ?? '').trim() !== '---') return '';
	const body = [];
	for (let i = 1; i < lines.length; i++) {
		if ((lines[i] ?? '').trim() === '---') break;
		body.push(lines[i]);
	}
	return body.join('\n');
}

/** 作者自己写了封面 → 不生成，手选的图优先 */
function hasAuthorCover(file) {
	return /^\s*heroImage\s*:/m.test(frontmatter(file));
}

/**
 * 收集需要生成封面的 key。
 * 文章 id = src/content/blog 下的相对路径去掉扩展名；
 * 文档 id = src/content/docs 下的相对路径（天然带文档册名）；
 * 文档册封面 = `book:<册名>`，每册固定一张。
 */
function collectKeys() {
	const items = [];
	const add = (key, file) => {
		if (!hasAuthorCover(file)) items.push({ key, name: `${fileName(key)}.webp` });
	};

	const blogDir = path.join(contentRoot, 'blog');
	for (const file of listContentFiles(blogDir)) {
		const rel = path.relative(blogDir, file).replace(/\\/g, '/');
		add(rel.replace(/\.mdx?$/, ''), file);
	}

	const docsDir = path.join(contentRoot, 'docs');
	const books = new Set();
	for (const file of listContentFiles(docsDir)) {
		const rel = path.relative(docsDir, file).replace(/\\/g, '/');
		const slash = rel.indexOf('/');
		if (slash === -1) continue; // 文档必须放在 <文档册>/ 下，这情况由构建期校验报错
		books.add(rel.slice(0, slash));
		add(rel.replace(/\.mdx?$/, ''), file);
	}

	for (const book of books) {
		const meta = path.join(docsDir, book, '_book.md');
		if (existsSync(meta)) add(`book:${book}`, meta);
	}

	// 撞名检测：8 位十六进制在几百个内容里几乎不可能撞，但撞了必须显式失败
	const used = new Set();
	for (const item of items) {
		if (used.has(item.name)) {
			throw new Error(`封面文件名撞车（${item.name}），请检查内容 id 或加长哈希位数。`);
		}
		used.add(item.name);
	}

	return items;
}

function fileName(key) {
	return hashKey(key).toString(16).padStart(8, '0');
}

/* -------------------------------- 画面生成 -------------------------------- */

/**
 * 渐变 + 几何线条 / 圆弧。
 * 全部参数来自 key，所以同一内容永远画同一张图；改这里的参数就是全站换风格。
 * 配色取中间调（不是纯白也不是死黑），亮色 / 暗色主题下都不刺眼。
 *
 * @param {{ hue?: number }} [options] hue 锁色：社交图固定用站点主色青，内容封面按 key 选色
 */
function buildSvg(key, width, height, options = {}) {
	const rnd = makeRandom(hashKey(`${key}::art`));
	const range = (min, max) => min + rnd() * (max - min);
	const pick = (list) => list[Math.floor(rnd() * list.length)];

	// 以站点的青色系为主，向外扩出几支邻近色；暖色只用低饱和的梅红，避免生成图里出现土黄
	const HUES = [196, 188, 205, 172, 220, 158, 212, 338];
	const hue = options.hue ?? pick(HUES) + range(-6, 6);
	const warm = hue > 300 || hue < 60; // 梅红 / 橙这一侧：降饱和、收明度，往灰紫靠
	const sat = range(38, 58) * (warm ? 0.6 : 1);
	const deep = range(24, 34);
	const light = deep + range(20, 30) * (warm ? 0.8 : 1);
	const base = hsl(hue, sat, deep);
	const top = hsl(hue + (warm ? -range(4, 14) : range(8, 26)), sat * range(0.72, 0.95), light);
	const line = hsl(hue + range(-4, 10), sat * 0.55, range(86, 95));
	const accentHue = hue + range(-46, -18);
	const accent = hsl(accentHue, sat * 0.9, range(58, 72));

	const uid = fileName(key);
	const cx = range(0.18, 0.82) * width;
	const cy = range(0.22, 0.78) * height;
	const gradStops = pick([
		[0, 0, 1, 1],
		[1, 0, 0, 1],
		[0.5, 0, 0.5, 1],
		[0, 1, 1, 0],
	]);

	// 平行线族：整组旋转一个角度，每隔几条加粗一次，形成节奏
	const lineCount = Math.round(range(9, 17));
	const lineAngle = pick([-32, -18, -6, 6, 18, 32, 45]);
	const lineGap = (width * 1.6) / lineCount;
	const lineWeightEvery = Math.round(range(3, 6));
	let lines = '';
	for (let i = 0; i <= lineCount * 2; i++) {
		const bold = i % lineWeightEvery === 0;
		const x = num(-width * 0.5 + i * lineGap);
		lines += `<line x1="${x}" y1="${num(-height)}" x2="${x}" y2="${num(height * 2)}" stroke="${line}" stroke-width="${bold ? num(range(1.8, 3.2)) : 1}" stroke-opacity="${bold ? num(range(0.2, 0.3)) : num(range(0.07, 0.14))}" />`;
	}

	// 同心圆弧：由内向外渐淡，其中一条走虚线
	const arcCount = Math.round(range(4, 7));
	const arcR0 = range(0.06, 0.12) * height;
	const arcStep = range(0.1, 0.17) * height;
	const dashedAt = Math.round(range(1, arcCount));
	let arcs = '';
	for (let i = 0; i < arcCount; i++) {
		const r = num(arcR0 + i * arcStep);
		const opacity = num(0.5 - i * (0.42 / arcCount));
		const dash = i === dashedAt ? ' stroke-dasharray="2 14" stroke-linecap="round"' : '';
		arcs += `<circle cx="${num(cx)}" cy="${num(cy)}" r="${r}" fill="none" stroke="${line}" stroke-opacity="${opacity}" stroke-width="${num(range(1.2, 2.4))}"${dash} />`;
	}

	// 一枚实心点压在某一圈上，给画面一个视觉落点：
	// 方向大致朝画布中心，再从最外圈往里找第一个落在安全区内的半径，避免点被裁掉。
	const dotAngle = Math.atan2(height / 2 - cy, width / 2 - cx) + range(-0.55, 0.55);
	const margin = range(0.06, 0.12) * height;
	let ringR = arcR0;
	for (let i = arcCount - 1; i >= 0; i--) {
		const r = arcR0 + i * arcStep;
		const x = cx + r * Math.cos(dotAngle);
		const y = cy + r * Math.sin(dotAngle);
		if (x > margin && x < width - margin && y > margin && y < height - margin) {
			ringR = r;
			break;
		}
	}
	const dotX = num(cx + ringR * Math.cos(dotAngle));
	const dotY = num(cy + ringR * Math.sin(dotAngle));
	const dotR = num(range(5, 9));

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<linearGradient id="bg${uid}" x1="${gradStops[0]}" y1="${gradStops[1]}" x2="${gradStops[2]}" y2="${gradStops[3]}"><stop offset="0" stop-color="${top}" /><stop offset="1" stop-color="${base}" /></linearGradient>
<radialGradient id="glow${uid}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${line}" stop-opacity="0.34" /><stop offset="1" stop-color="${line}" stop-opacity="0" /></radialGradient>
<linearGradient id="sheen${uid}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${base}" stop-opacity="0.5" /><stop offset="1" stop-color="${base}" stop-opacity="0" /></linearGradient>
<clipPath id="clip${uid}"><rect width="${width}" height="${height}" /></clipPath>
</defs>
<g clip-path="url(#clip${uid})">
<rect width="${width}" height="${height}" fill="url(#bg${uid})" />
<ellipse cx="${num(width * range(0.3, 0.7))}" cy="${num(height * range(0.2, 0.5))}" rx="${num(width * 0.55)}" ry="${num(height * 0.6)}" fill="url(#glow${uid})" />
<g transform="rotate(${lineAngle} ${num(width / 2)} ${num(height / 2)})">${lines}</g>
${arcs}
<circle cx="${dotX}" cy="${dotY}" r="${num(dotR * 2.8)}" fill="none" stroke="${line}" stroke-opacity="0.4" stroke-width="1.2" />
<circle cx="${dotX}" cy="${dotY}" r="${dotR}" fill="${accent}" fill-opacity="0.85" />
<rect width="${width}" height="${height}" fill="url(#sheen${uid})" />
</g>
</svg>`;
}

/* ---------------------------------- 主流程 ---------------------------------- */

async function main() {
	mkdirSync(outDir, { recursive: true });

	const items = collectKeys();
	const manifest = {};
	const wanted = new Set();

	// 每次都重新生成（用户定的「prebuild 每次构建生成」）：
	// 画面只由 key 决定，重跑得到同样的图，改配色参数后也能立刻全站生效。
	for (const { key, name } of items) {
		const svg = buildSvg(key, COVER_WIDTH, COVER_HEIGHT);
		await sharp(Buffer.from(svg)).webp({ quality: 82, effort: 5 }).toFile(path.join(outDir, name));
		manifest[key] = name;
		wanted.add(name);
	}

	const socialSvg = buildSvg(SOCIAL_KEY, SOCIAL_WIDTH, SOCIAL_HEIGHT, { hue: SOCIAL_HUE });
	await sharp(Buffer.from(socialSvg)).jpeg({ quality: 84 }).toFile(path.join(outDir, SOCIAL_FILE));
	manifest[SOCIAL_KEY] = SOCIAL_FILE;

	// 清理：只删符合本项目命名规则的孤儿图，其它文件不碰
	const orphanPattern = /^[0-9a-f]{8}\.webp$/;
	let removed = 0;
	for (const entry of readdirSync(outDir)) {
		if (orphanPattern.test(entry) && !wanted.has(entry)) {
			rmSync(path.join(outDir, entry));
			removed++;
		}
	}

	// 调试索引：key → 文件名。页面取图靠哈希规则，不依赖这个文件。
	writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

	console.log(
		`[covers] 生成封面 ${items.length} 张 + 社交图 1 张` +
			`（跳过 ${countAuthorCovers()} 个作者手写封面，清理孤儿 ${removed} 张）→ src/assets/covers/`,
	);
}

/** 只为把日志说全：统计有多少内容因为自己写了 heroImage 而没生成封面 */
function countAuthorCovers() {
	let n = 0;
	for (const dir of [path.join(contentRoot, 'blog'), path.join(contentRoot, 'docs')]) {
		for (const file of listContentFiles(dir, { includeConfig: true })) {
			if (hasAuthorCover(file)) n++;
		}
	}
	return n;
}

main().catch((error) => {
	console.error('[covers] 生成失败：', error);
	process.exit(1);
});
