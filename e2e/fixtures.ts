import { test as base, expect, type Page } from '@playwright/test';
import { DEFAULT_BASE_URL } from './baseUrl';

/** 第三方地图 / 影像 / 视频源的网络失败不算应用缺陷（CI 网络环境不可控） */
const THIRD_PARTY =
  /amap\.com|autonavi\.com|openstreetmap\.org|basemaps\.cartocdn\.com|cesium\.com|virtualearth\.net|huoshanstatic\.com/;

export type Health = { pageErrors: string[]; consoleErrors: string[]; csp: () => Promise<string[]> };

/**
 * 每个测试自动收集：未捕获异常、console.error、CSP 违规（securitypolicyviolation 事件）。
 * 直接打开深链时 GitHub Pages 返回 404.html（状态码 404）属平台行为，对应的资源错误被忽略。
 */
export const test = base.extend<{ health: Health }>({
  // Playwright fixture 的 use 不是 React hook（rules-of-hooks 按名字误判）
  health: async ({ page }, provide) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    await page.addInitScript(() => {
      const store: string[] = [];
      (window as unknown as { __csp: string[] }).__csp = store;
      document.addEventListener('securitypolicyviolation', (event) => {
        store.push(`${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}`);
      });
    });
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      const url = message.location().url ?? '';
      if (/status of 404/.test(text) || THIRD_PARTY.test(text) || THIRD_PARTY.test(url)) return;
      consoleErrors.push(text);
    });
    await provide({
      pageErrors,
      consoleErrors,
      csp: () => page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []),
    });
  },
});

export { expect };

/** 登录（演示后端：admin 为管理员、guest 为受限访客），可选界面语言 */
export const signIn = async (page: Page, { user = 'admin', locale = 'zh-CN' } = {}) => {
  await page.goto('login');
  await page.evaluate((l) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('umi_locale', l);
    // 导览只在首次进入工作台时出现，冒烟测试里关掉
    localStorage.setItem('umi-react-admin:tour-seen', '1');
  }, locale);
  await page.reload();
  await page.locator('input#name').fill(user);
  await page.locator('input#password').fill('demo');
  await page.locator('form button[type=submit]').click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
};

export const BASE_URL = process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL;

/** 站内跳转（不整页刷新，避开静态托管的 404 回退）；path 为应用内路由（可带 query），如 /system/users */
export const navigate = async (page: Page, path: string) => {
  // pathname 会丢掉 ?query（深链 focus/keyword 依赖它），pathname + search 一并还原
  const target =
    new URL(path.replace(/^\//, ''), BASE_URL).pathname + new URL(path.replace(/^\//, ''), BASE_URL).search;
  const go = () =>
    page.evaluate((url) => {
      window.history.pushState({}, '', url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, target);
  try {
    await go();
  } catch {
    // 与整页刷新（如进入/退出演示场景）竞态时上下文会被销毁：等新文档就绪后重试一次
    await page.waitForLoadState('domcontentloaded');
    await go();
  }
};

/** 页面可见文本中的中文（地图瓦片、三维场景、语言选择项等第三方或刻意保留的区域除外） */
export const visibleCjk = (page: Page) =>
  page.evaluate(() => {
    const skip = '.amap-container, .ol-viewport, .cesium-widget, .cesium-viewer, .xgplayer, .tox-tinymce';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const found: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || element.closest(skip) || !element.checkVisibility?.()) continue;
      const text = node.textContent?.trim() ?? '';
      if (/[一-龥]/.test(text)) found.push(text.slice(0, 40));
    }
    return found;
  });
