import { defineConfig, devices } from '@playwright/test';

/**
 * 端到端冒烟测试。
 *
 * 默认复用本地已启动的 preview；CI 里会先构建再起 preview。
 * preview 不处理 dist/_redirects，真实的 301 需要 Cloudflare 或 wrangler；
 * 因此重定向本身用 manifest 断言，另有一条需要 REDIRECT_BASE_URL 的可选真实请求测试。
 */
export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4322',
		trace: 'on-first-retry',
	},
	webServer: {
		command: 'pnpm build && pnpm preview --port 4322',
		url: 'http://localhost:4322',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
