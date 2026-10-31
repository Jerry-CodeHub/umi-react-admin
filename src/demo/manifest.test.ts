import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, SCENARIO_IDS, SCENARIO_MANIFEST } from './scenarios';
import { STORE_KEY, STORE_VERSION } from './store';

/**
 * 机器可读场景清单（docs/demo/demo-scenarios.json）的生成与一致性校验。
 * 首次运行（文件不存在或 CI 无写权限）时写出；之后每次运行校验清单与当前实现一致——
 * 改了 scenarios.ts 而忘记重新生成清单时，这里会失败提醒。
 */
const MANIFEST_PATH = new URL('../../docs/demo/demo-scenarios.json', import.meta.url);

/** 体验账号 → 角色 key（与 scenarios.ts 的种子角色同一映射；查表取代四层嵌套三元） */
const ROLE_KEY: Record<string, string> = {
  admin: 'admin',
  lead: 'lead',
  operator: 'operator',
  analyst: 'analyst',
};

const buildManifest = () => ({
  // 与存储版本同源：升 STORE_VERSION 时清单随之变化，提醒重新生成
  version: STORE_VERSION,
  storeKey: STORE_KEY,
  generatedBy: 'src/demo/scenarios.ts（src/demo/manifest.test.ts 生成）',
  accounts: DEMO_ACCOUNTS.map((username) => ({
    username,
    password: 'demo',
    roleKey: ROLE_KEY[username] ?? 'viewer',
  })),
  clock: {
    live: '跟随真实时间；演示后端每请求检查，跨过 60 秒即按当前时钟重建基础数据（补丁保留）',
    frozen: '进入固定演示场景时冻结；页面展示「演示时间」标记（src/demo/clock.ts）',
  },
  availability: {
    unrecovered: 'active，或 ticketed 且无 recoveredAt（转单不等于恢复）',
    blocking: '严重/重要 × 掉线/供电/链路/温度；干扰、信号与一般级别不阻断',
    derivedStatus: '未恢复 offline 型阻断 → 离线；其他未恢复阻断 → 故障；否则在线（全部解除才上线）',
  },
  scenarios: SCENARIO_MANIFEST.map((scenario) => ({
    key: scenario.key,
    title: scenario.title,
    objects: scenario.objects,
    initialState: scenario.initialState,
    demonstrates: scenario.demonstrates,
  })),
  objectIds: SCENARIO_IDS,
});

describe('demo-scenarios.json 清单', () => {
  it('清单与当前实现一致（改动 scenarios.ts 后运行 vitest 重新生成）', () => {
    const next = `${JSON.stringify(buildManifest(), null, 2)}\n`;
    if (!existsSync(MANIFEST_PATH)) {
      mkdirSync(new URL('.', MANIFEST_PATH), { recursive: true });
      writeFileSync(MANIFEST_PATH, next, 'utf-8');
    }
    // 首次生成；之后不一致直接失败（自写自证的校验没有意义）——重新生成：删除该 JSON 后跑本测试
    expect(readFileSync(MANIFEST_PATH, 'utf-8')).toBe(next);
  });
});
