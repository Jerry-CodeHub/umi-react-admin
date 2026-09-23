// @vitest-environment jsdom
/**
 * 鉴权服务两种模式的契约：纯静态托管（无后端）走前端本地演示实现，
 * 配置了 UMI_APP_API_BASE 时走 HTTP 接口。模式在模块加载时确定，故每例重新加载模块。
 */
import { AUTH_TOKEN_KEY } from '@/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TOKEN_PREFIX, DEMO_TOKEN_TTL_MS, issueDemoToken, verifyDemoToken } from './demo/demoToken';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('@umijs/max', () => ({ request: requestMock }));

const loadAuth = async (apiBase?: string) => {
  (globalThis as Record<string, unknown>).UMI_APP_API_BASE = apiBase;
  vi.resetModules();
  return import('./auth');
};

beforeEach(() => {
  requestMock.mockReset();
  localStorage.clear();
  vi.useRealTimers();
});

describe('纯静态演示模式（无后端）', () => {
  it('login 本地签发可校验的演示 token（含 role 声明），不发请求', async () => {
    const { login } = await loadAuth();
    const result = await login({ name: 'admin', password: 'any' });
    expect(verifyDemoToken(result.token)).toMatchObject({ name: 'admin', role: 'admin' });
    expect(result.user).toEqual({ name: 'admin', nickName: 'admin', email: '', role: 'admin' });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('演示降权账号 dontHaveAccess 签发 role=user', async () => {
    const { login } = await loadAuth();
    const result = await login({ name: 'dontHaveAccess', password: 'any' });
    expect(verifyDemoToken(result.token)).toMatchObject({ name: 'dontHaveAccess', role: 'user' });
    expect(result.user.role).toBe('user');
  });

  it('fetchCurrentUser 从本地 token 还原用户与角色', async () => {
    const { fetchCurrentUser } = await loadAuth();
    localStorage.setItem(AUTH_TOKEN_KEY, issueDemoToken('dontHaveAccess', 'user'));
    await expect(fetchCurrentUser()).resolves.toMatchObject({ name: 'dontHaveAccess', role: 'user' });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('缺失、伪造、损坏、过期与未来时间戳的 token 一律被拒绝', async () => {
    const { fetchCurrentUser } = await loadAuth();
    await expect(fetchCurrentUser()).rejects.toThrow();
    localStorage.setItem(AUTH_TOKEN_KEY, 'forged-token');
    await expect(fetchCurrentUser()).rejects.toThrow();
    localStorage.setItem(AUTH_TOKEN_KEY, `${DEMO_TOKEN_PREFIX}not-json`);
    await expect(fetchCurrentUser()).rejects.toThrow();
    // 过期（ts 早于 TTL 窗口）与未来时间戳（时钟回拨防御）都无效
    const stale = `${DEMO_TOKEN_PREFIX}${encodeURIComponent(
      JSON.stringify({ name: 'x', role: 'admin', ts: Date.now() - DEMO_TOKEN_TTL_MS - 1000 }),
    )}`;
    localStorage.setItem(AUTH_TOKEN_KEY, stale);
    await expect(fetchCurrentUser()).rejects.toThrow();
    const future = `${DEMO_TOKEN_PREFIX}${encodeURIComponent(
      JSON.stringify({ name: 'x', role: 'admin', ts: Date.now() + 60_000 }),
    )}`;
    localStorage.setItem(AUTH_TOKEN_KEY, future);
    await expect(fetchCurrentUser()).rejects.toThrow();
  });

  it('logout 不发请求', async () => {
    const { logout } = await loadAuth();
    await logout();
    expect(requestMock).not.toHaveBeenCalled();
  });
});

describe('配置了真实后端（UMI_APP_API_BASE）', () => {
  it('走 HTTP 接口；启动换取用户与登出都跳过全局错误提示', async () => {
    requestMock.mockResolvedValue({ data: { name: 'jerry', email: '' } });
    const { login, fetchCurrentUser, logout } = await loadAuth('https://api.example.com');
    await login({ name: 'jerry', password: 'any' });
    await fetchCurrentUser();
    await logout();
    expect(requestMock).toHaveBeenNthCalledWith(1, '/api/v1/login', expect.objectContaining({ method: 'POST' }));
    expect(requestMock).toHaveBeenNthCalledWith(2, '/api/v1/currentUser', { skipErrorHandler: true });
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/logout',
      expect.objectContaining({ method: 'POST', skipErrorHandler: true }),
    );
  });
});
