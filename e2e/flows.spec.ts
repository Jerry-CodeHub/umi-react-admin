import { BASE_URL, expect, navigate, signIn, test } from './fixtures';

test('未登录打开受保护页面：先去登录，登录后回到原页面 @smoke', async ({ page }) => {
  await page.goto('system/users');
  await expect(page).toHaveURL(/\/login\?redirect=%2Fsystem%2Fusers/);
  await page.evaluate(() => localStorage.setItem('umi-react-admin:tour-seen', '1'));
  await page.getByRole('button', { name: /以管理员体验|Try as administrator/ }).click();
  await expect(page).toHaveURL(/\/system\/users$/);
  await expect(page.locator('.ant-table-row').first()).toBeVisible();
});

test('旧版路径重定向到新地址', async ({ page }) => {
  await signIn(page);
  await navigate(page, '/feature/Cesium/ThermalMap');
  await expect(page).toHaveURL(/\/map\/cesium\/heatmap$/);
});

test('访客访问系统管理得到 403，权限演示页显示脱敏数据', async ({ page }) => {
  await signIn(page, { user: 'guest' });
  await navigate(page, '/system/users');
  await expect(page.locator('.ant-result-403')).toBeVisible();
  await navigate(page, '/system/access');
  await expect(page.getByText(/\*\*\*/).first()).toBeVisible();
});

test('工作台 KPI 与明细口径一致：在线设备数等于设备台账筛选结果', async ({ page }) => {
  await signIn(page);
  const kpi = page.locator('.ant-card').filter({ hasText: '在线设备' }).first();
  await expect(kpi).toBeVisible();
  const online = Number((await kpi.locator('.text-3xl').first().innerText()).match(/\d+/)![0]);
  await navigate(page, '/ops/devices');
  // 查询表单默认折叠，「状态」在展开后的第二行
  await page.locator('.ant-pro-query-filter-collapse-button').click();
  await page.locator('.ant-form-item').filter({ hasText: '状态' }).locator('.ant-select').click();
  await page.locator('.ant-select-item-option[title="在线"]').click();
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await expect(page.locator('.ant-pagination-total-text')).toContainText(String(online));
});

test('告警转工单后出现在看板，拖到「处理中」并写回', async ({ page }) => {
  await signIn(page);
  await navigate(page, '/ops/alarms');
  await page.locator('.ant-switch').first().click();
  const row = page.locator('.ant-table-row').first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /处置/ }).hover();
  await page.getByRole('menuitem', { name: '转工单' }).click();
  await expect(page.locator('.ant-message')).toContainText('已处置');

  await navigate(page, '/ops/tickets');
  const columns = page.locator('.grid > div');
  const todo = columns.nth(0).locator('.ant-card');
  await expect(todo.first()).toBeVisible();
  const before = await columns.nth(1).locator('.ant-card').count();
  const card = await todo.first().boundingBox();
  const target = await columns.nth(1).boundingBox();
  await page.mouse.move(card!.x + 40, card!.y + 20);
  await page.mouse.down();
  await page.mouse.move(card!.x + 60, card!.y + 40, { steps: 5 });
  await page.mouse.move(target!.x + target!.width / 2, target!.y + 120, { steps: 15 });
  await page.mouse.up();
  await expect(columns.nth(1).locator('.ant-card')).toHaveCount(before + 1);
});

test('重置演示数据清除改动', async ({ page }) => {
  await signIn(page);
  await navigate(page, '/system/users');
  await page.getByRole('button', { name: /新建用户/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#name').fill('E2E 测试');
  await dialog.locator('#username').fill('e2e.user');
  await dialog.locator('#email').fill('e2e@example.com');
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByText('e2e@example.com')).toBeVisible();

  await page.locator('[data-tour="account"]').hover();
  await page.getByRole('menuitem', { name: '重置演示数据' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /确\s*定/ })
    .click();
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  await expect(page.getByText('e2e@example.com')).toHaveCount(0);
});

test('版本文件与页脚构建信息一致 @smoke', async ({ page, request }) => {
  const version = await (await request.get(new URL('version.json', BASE_URL).toString())).json();
  expect(version.sha).toMatch(/^[0-9a-f]{40}$|^unknown$/);
  await signIn(page);
  await expect(page.locator('footer')).toContainText(version.sha.slice(0, 7));
});
