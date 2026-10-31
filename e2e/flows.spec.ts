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

test('组内导航条切换二级页面（顶栏一级 + 内容区页签二级） @smoke', async ({ page }) => {
  await signIn(page);
  await navigate(page, '/system/users');
  const nav = page.locator('[data-tour="groupnav"]');
  await expect(nav).toBeVisible();
  // 当前页在导航条上高亮
  await expect(nav.locator('.ant-menu-item-selected')).toContainText(/用户管理|Users/);
  // 点击页签切换到操作日志（不再依赖左侧菜单）
  await nav.getByRole('menuitem', { name: /操作日志|Audit log/ }).click();
  await expect(page).toHaveURL(/\/system\/logs$/);
});

test('访客访问系统管理得到 403，权限演示页显示服务端粗化后的坐标', async ({ page }) => {
  await signIn(page, { user: 'guest' });
  await navigate(page, '/system/users');
  await expect(page.locator('.ant-result-403')).toBeVisible();
  await navigate(page, '/system/access');
  /**
   * F12 改变了契约：脱敏不再由 UI 打星号，而是服务端在序列化时把坐标粗化到 0.1° 格网
   * （coordinatePrecision='coarse'），页面只标注精度。所以这里断言「拿到的是粗化值、
   * 且不是四位小数的精确值」——比原来的 `***` 更贴近真实边界。
   */
  const coordCell = page.locator('.ant-table-row').first().locator('td').nth(1);
  await expect(coordCell).toContainText('~');
  await expect(coordCell).toContainText('~10 km');
  const text = await coordCell.innerText();
  const numbers = text.match(/\d+\.\d+/g) ?? [];
  expect(numbers.length).toBeGreaterThan(0);
  for (const value of numbers) {
    // 粗化值最多一位小数；出现两位以上小数就说明精确坐标泄漏到了无权限会话
    expect(value.split('.')[1]!.length).toBeLessThanOrEqual(1);
  }
});

test('工作台 KPI 与明细口径一致：在线设备数等于设备台账筛选结果', async ({ page }) => {
  await signIn(page);
  const kpi = page.locator('.ant-card').filter({ hasText: '在线设备' }).first();
  await expect(kpi).toBeVisible();
  // 千分位感知的解析（与 demo-mainline.spec.ts 同口径）：/\d+/ 遇 "1,234" 只取到 1，
  // 配合下方 toContainText 会让一致性断言空转
  const online = Number((await kpi.locator('.text-3xl').first().innerText()).match(/[\d,]+/)![0].replace(/,/g, ''));
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
  // 未恢复口径（F08）包含已转工单未恢复的行（无处置按钮），取第一个带处置按钮的行
  await page.locator('.ant-table-row').getByRole('button', { name: /处置/ }).first().click();
  await page.getByRole('menuitem', { name: '转工单' }).click();
  await expect(page.locator('.ant-message')).toContainText('已处置');

  await navigate(page, '/ops/tickets');
  const columns = page.locator('.grid > div');
  const todo = columns.nth(0).locator('.ant-card');
  await expect(todo.first()).toBeVisible();
  const before = await columns.nth(1).locator('.ant-card').count();
  // 并发负载下首帧布局可能未稳（boundingBox 取到动画中的位置导致拖拽落空）：整段拖拽重试一次
  for (let attempt = 1; ; attempt += 1) {
    await page.waitForTimeout(600);
    const card = await todo.first().boundingBox();
    const target = await columns.nth(1).boundingBox();
    await page.mouse.move(card!.x + 40, card!.y + 20);
    await page.mouse.down();
    await page.mouse.move(card!.x + 60, card!.y + 40, { steps: 5 });
    await page.mouse.move(target!.x + target!.width / 2, target!.y + 120, { steps: 15 });
    await page.mouse.up();
    try {
      await expect(columns.nth(1).locator('.ant-card')).toHaveCount(before + 1, { timeout: 8000 });
      break;
    } catch (error) {
      if (attempt >= 2) throw error;
    }
  }
});

test('点击看板卡片查看详情，并在详情里流转状态（不用拖拽，手机上同样可用）', async ({ page }) => {
  await signIn(page);
  await navigate(page, '/ops/tickets');
  const columns = page.locator('.grid > div');
  const todo = columns.nth(0).locator('.ant-card');
  await expect(todo.first()).toBeVisible();
  const done = await columns.nth(2).locator('.ant-card').count();
  await todo.first().click();
  // antd 6 起 Drawer 内层的 .ant-drawer-content 元素被 .ant-drawer-section（role=dialog）取代
  const drawer = page.locator('.ant-drawer-section');
  await expect(drawer).toContainText('处理进度');
  await drawer.locator('.ant-segmented-item').nth(2).click();
  await expect(page.locator('.ant-message')).toContainText('已完成');
  await expect(columns.nth(2).locator('.ant-card')).toHaveCount(done + 1);
});

test('点击日程先看详情，不直接弹删除确认', async ({ page }) => {
  await signIn(page);
  await navigate(page, '/components/calendar');
  await page.locator('.calendar-skin [role=button]').filter({ hasText: '值班交接' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('值班交接');
  await expect(dialog.getByRole('button', { name: /删\s*除/ })).toBeVisible();
  await expect(page.getByText(/删除日程「/)).toHaveCount(0);
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

  // 账户菜单为点击展开（hover 展开会被读成误弹提示，见 fix/header-actions）
  await page.locator('[data-tour="account"]').click();
  await page.getByRole('menuitem', { name: '重置演示数据' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /确\s*定/ })
    .click();
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  await expect(page.locator('.ant-table-row').first()).toBeVisible();
  await expect(page.getByText('e2e@example.com')).toHaveCount(0);
});

test('版本文件与页脚构建信息一致 @smoke', async ({ page, request }) => {
  const version = await (await request.get(new URL('version.json', BASE_URL).toString())).json();
  expect(version.sha).toMatch(/^[0-9a-f]{40}$|^unknown$/);
  await signIn(page);
  await expect(page.locator('footer')).toContainText(version.sha.slice(0, 7));
});
