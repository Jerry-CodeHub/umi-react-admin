import { beforeEach, describe, expect, it } from 'vitest';
import type { StorageLike } from '../store';
import { STORE_KEY } from '../store';
import { DEMO_TOKEN_PREFIX, DEMO_TOKEN_TTL_MS, verifyDemoToken } from '../token';
import { createDemoServer } from './index';

const NOW = new Date(2026, 8, 23, 20, 15);

const memoryStorage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
};

let storage: ReturnType<typeof memoryStorage>;
let server: ReturnType<typeof createDemoServer>;

beforeEach(() => {
  storage = memoryStorage();
  server = createDemoServer({ locale: 'zh-CN', storage, now: () => NOW });
});

const call = (method: string, url: string, options: { body?: unknown; token?: string; params?: object } = {}) =>
  server.handle({
    method,
    url,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    params: options.params as Record<string, unknown>,
    headers: { Authorization: options.token ? `Bearer ${options.token}` : undefined },
  });

const loginAs = (name: string) => {
  const res = call('POST', '/api/v1/login', { body: { name, password: 'x' } });
  return (res.body.data as { token: string }).token;
};

describe('鉴权', () => {
  it('admin 体验账号签发管理员 token，显示名取自种子用户', () => {
    const res = call('POST', '/api/v1/login', { body: { name: 'admin', password: 'x' } });
    const { token, user } = res.body.data as { token: string; user: { nickName: string; role: string } };
    expect(verifyDemoToken(token)).toMatchObject({ name: 'admin', role: 'admin' });
    expect(user.role).toBe('admin');
    expect(user.nickName).not.toBe('admin');
  });

  it('guest 与 dontHaveAccess 为受限身份；任意其它用户名放行为管理员', () => {
    expect(verifyDemoToken(loginAs('guest'))?.role).toBe('user');
    expect(verifyDemoToken(loginAs('dontHaveAccess'))?.role).toBe('user');
    expect(verifyDemoToken(loginAs('someone'))?.role).toBe('admin');
  });

  it('空用户名 400；停用账号以业务错误拒绝', () => {
    expect(call('POST', '/api/v1/login', { body: { name: '' } }).status).toBe(400);
    const token = loginAs('admin');
    const disabled = (
      call('GET', '/api/v1/users', { token, params: { status: 'disabled' } }).body.data as {
        list: { username: string }[];
      }
    ).list[0];
    const res = call('POST', '/api/v1/login', { body: { name: disabled.username } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
  });

  it('缺失、伪造、损坏、过期的 token 一律 401', () => {
    const stale = `${DEMO_TOKEN_PREFIX}${encodeURIComponent(
      JSON.stringify({ name: 'admin', role: 'admin', ts: Date.now() - DEMO_TOKEN_TTL_MS - 1000 }),
    )}`;
    for (const token of [undefined, 'forged', `${DEMO_TOKEN_PREFIX}not-json`, stale]) {
      expect(call('GET', '/api/v1/currentUser', { token }).status).toBe(401);
    }
  });

  it('受限身份访问管理接口 403，业务接口正常', () => {
    const token = loginAs('guest');
    expect(call('GET', '/api/v1/users', { token }).status).toBe(403);
    expect(call('GET', '/api/v1/dashboard/overview', { token }).status).toBe(200);
  });

  it('登录写入操作日志，并刷新种子用户的最近登录时间', () => {
    const token = loginAs('admin');
    const logs = call('GET', '/api/v1/logs', { token }).body.data as { list: { action: string; createdAt: string }[] };
    expect(logs.list[0]).toMatchObject({ action: 'login', createdAt: NOW.toISOString() });
  });
});

describe('用户管理', () => {
  it('分页、筛选、排序', () => {
    const token = loginAs('admin');
    const page = call('GET', '/api/v1/users', { token, params: { current: 2, pageSize: 10 } }).body.data as {
      list: unknown[];
      total: number;
    };
    expect(page.total).toBe(86);
    expect(page.list).toHaveLength(10);
    const ops = call('GET', '/api/v1/users', { token, params: { department: 'ops1', pageSize: 100 } }).body.data as {
      list: { department: string }[];
    };
    expect(ops.list.every((u) => u.department === 'ops1')).toBe(true);
    const sorted = call('GET', '/api/v1/users', {
      token,
      params: { sortField: 'lastLoginAt', sortOrder: 'descend', pageSize: 5 },
    }).body.data as { list: { username: string }[] };
    expect(sorted.list[0].username).toBe('admin');
  });

  it('新建校验登录名唯一与邮箱格式，成功后持久化为补丁', () => {
    const token = loginAs('admin');
    const dup = call('POST', '/api/v1/users', {
      token,
      body: { name: '测试', username: 'admin', email: 'a@example.com' },
    });
    expect(dup.body.success).toBe(false);
    const bad = call('POST', '/api/v1/users', { token, body: { name: '测试', username: 'tester', email: 'nope' } });
    expect(bad.body.success).toBe(false);
    const created = call('POST', '/api/v1/users', {
      token,
      body: { name: '测试', username: 'tester', email: 'tester@example.com', role: 'analyst', department: 'analytics' },
    });
    expect(created.body.data).toMatchObject({ id: 'U1087', role: 'analyst' });
    // 重新打开页面（新建 server）后新建的用户仍在
    const reopened = createDemoServer({ locale: 'zh-CN', storage, now: () => NOW });
    expect(reopened.store.dataset.users.some((u) => u.username === 'tester')).toBe(true);
  });

  it('体验账号与当前登录账号不能停用或删除', () => {
    const token = loginAs('admin');
    const admin = server.store.dataset.users.find((u) => u.username === 'admin')!;
    expect(call('DELETE', `/api/v1/users/${admin.id}`, { token }).body.success).toBe(false);
    expect(call('PUT', `/api/v1/users/${admin.id}`, { token, body: { status: 'disabled' } }).body.success).toBe(false);
  });

  it('批量停用后该用户的 token 失效', () => {
    const adminToken = loginAs('admin');
    const target = server.store.dataset.users.find((u) => u.role === 'operator' && u.status === 'active')!;
    const userToken = loginAs(target.username);
    expect(call('GET', '/api/v1/currentUser', { token: userToken }).status).toBe(200);
    call('POST', '/api/v1/users/batch', { token: adminToken, body: { ids: [target.id], action: 'disable' } });
    expect(call('GET', '/api/v1/currentUser', { token: userToken }).status).toBe(401);
  });
});

describe('角色', () => {
  it('成员数由用户聚合；管理员角色不能删减权限', () => {
    const token = loginAs('admin');
    const roles = call('GET', '/api/v1/roles', { token }).body.data as { id: string; memberCount: number }[];
    expect(roles.reduce((s, r) => s + r.memberCount, 0)).toBe(86);
    expect(call('PUT', '/api/v1/roles/admin', { token, body: { permissions: [] } }).body.success).toBe(false);
    const updated = call('PUT', '/api/v1/roles/viewer', { token, body: { permissions: ['dashboard.view', 'bogus'] } });
    expect((updated.body.data as { permissions: string[] }).permissions).toEqual(['dashboard.view']);
  });
});

describe('工单与告警', () => {
  it('看板只含进行中与近 3 天完成的工单', () => {
    const token = loginAs('admin');
    const board = call('GET', '/api/v1/tickets', { token, params: { board: true } }).body.data as {
      list: { status: string; resolvedAt?: string }[];
    };
    const since = NOW.getTime() - 3 * 86_400_000;
    expect(board.list.every((x) => x.status !== 'done' || new Date(x.resolvedAt!).getTime() >= since)).toBe(true);
  });

  it('拖到「已完成」写入完成时间，退回「处理中」清除完成时间（跨重载保持）', () => {
    const token = loginAs('admin');
    const ticket = server.store.dataset.tickets.find((x) => x.status === 'doing')!;
    const done = call('PUT', `/api/v1/tickets/${ticket.id}`, { token, body: { status: 'done' } }).body.data as {
      resolvedAt?: string;
    };
    expect(done.resolvedAt).toBe(NOW.toISOString());
    call('PUT', `/api/v1/tickets/${ticket.id}`, { token, body: { status: 'doing' } });
    const reopened = createDemoServer({ locale: 'zh-CN', storage, now: () => NOW });
    const again = reopened.store.dataset.tickets.find((x) => x.id === ticket.id)!;
    expect(again).toMatchObject({ status: 'doing' });
    expect(again.resolvedAt).toBeUndefined();
  });

  it('未恢复告警可转工单，已处置的告警再次处置报业务错误', () => {
    const token = loginAs('admin');
    const alarm = server.store.dataset.alarms.find((a) => a.status === 'active')!;
    const handled = call('POST', `/api/v1/alarms/${alarm.id}/handle`, { token, body: { action: 'ticket' } });
    expect(handled.body.data).toMatchObject({ status: 'ticketed' });
    expect(server.store.dataset.tickets.some((x) => x.alarmId === alarm.id)).toBe(true);
    const again = call('POST', `/api/v1/alarms/${alarm.id}/handle`, { token, body: { action: 'recover' } });
    expect(again.body.success).toBe(false);
  });
});

describe('演示数据存储', () => {
  it('重置清空补丁并回到初始数据', () => {
    const token = loginAs('admin');
    call('POST', '/api/v1/users', {
      token,
      body: { name: '测试', username: 'tester', email: 'tester@example.com' },
    });
    expect(storage.data.has(STORE_KEY)).toBe(true);
    call('POST', '/api/v1/demo/reset', { token });
    expect(storage.data.has(STORE_KEY)).toBe(false);
    expect(server.store.dataset.users.some((u) => u.username === 'tester')).toBe(false);
  });

  it('损坏的补丁被丢弃，旧版本遗留的存储键被清理', () => {
    storage.setItem(STORE_KEY, JSON.stringify({ users: { created: 'oops' } }));
    storage.setItem('umi-react-admin-demo-users', '[]');
    const reopened = createDemoServer({ locale: 'zh-CN', storage, now: () => NOW });
    expect(reopened.store.dataset.users).toHaveLength(86);
    expect(storage.data.has('umi-react-admin-demo-users')).toBe(false);
  });

  it('未知接口 404', () => {
    expect(call('GET', '/api/v1/nope', { token: loginAs('admin') }).status).toBe(404);
  });
});
