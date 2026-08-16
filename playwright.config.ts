import { defineConfig, devices } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT ?? '5173'
const runElectronE2E = process.env.ELECTRON_E2E === 'true'
// 统一使用 127.0.0.1：CI 上 localhost 可能只解析到 IPv6 ::1，
// 导致硬编码 127.0.0.1 的测试（如 canvas-density-overview）ERR_CONNECTION_REFUSED。
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI runs against a fresh server; locally reuse a running dev server.
  workers: process.env.CI ? 2 : 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Electron 专用 spec 由 electron-e2e job（windows）单独运行；
      // chromium 浏览器环境跑它们会因 electron 二进制缺失而误报失败。
      // blocknote-dnd 断言 BlockNote SideMenu 拖拽手柄，而应用自 2026-05-25
      // 起刻意禁用 sideMenu（用自定义 CardFormattingToolbar 替代），断言已过期。
      testIgnore: runElectronE2E
        ? ['**/blocknote-dnd.spec.ts']
        : ['**/electron-*.spec.ts', '**/blocknote-dnd.spec.ts'],
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port} --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
