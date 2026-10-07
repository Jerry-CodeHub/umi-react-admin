import { defineConfig, devices } from '@playwright/test';

/**
 * 浏览器级冒烟：对 GitHub Pages 同构的静态产物（build:github，子路径 /umi-react-admin/）逐路由验证。
 * 设置 E2E_BASE_URL 时直接测线上地址（部署后冒烟），否则本地起静态服务器。
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173/umi-react-admin/';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'node scripts/serve-dist.mjs dist /umi-react-admin/ 4173',
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
      },
});
