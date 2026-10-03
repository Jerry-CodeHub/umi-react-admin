import { routes } from '../config/routes';
import { expect, navigate, signIn, test, visibleCjk } from './fixtures';

type Route = { path: string; component?: string; routes?: Route[]; redirect?: string };
const flatten = (list: Route[]): Route[] => list.flatMap((r) => [r, ...flatten(r.routes ?? [])]);
/** 所有有页面组件的路由（登录页与兜底 404 除外） */
const PAGES = flatten(routes as Route[])
  .filter((r) => r.component && r.path !== '/login' && r.path !== '*')
  .map((r) => r.path);

// 三维场景在无头浏览器里走软件渲染，给足时间
const settle = (path: string) => (path.includes('cesium') ? 6000 : 2500);

test.describe('每个页面都能正常渲染 @smoke', () => {
  for (const path of PAGES) {
    test(path, async ({ page, health }) => {
      await signIn(page);
      await navigate(page, path);
      await page.waitForTimeout(settle(path));
      await expect(page.locator('.ant-pro-page-container, .ant-result').first()).toBeVisible();
      expect(health.pageErrors).toEqual([]);
      expect(health.consoleErrors).toEqual([]);
      expect(await health.csp()).toEqual([]);
    });
  }
});

test.describe('英文界面没有遗漏的中文', () => {
  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await signIn(page, { locale: 'en-US' });
      await navigate(page, path);
      await page.waitForTimeout(settle(path));
      expect(await visibleCjk(page)).toEqual([]);
    });
  }
});
