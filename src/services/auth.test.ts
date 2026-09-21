// @vitest-environment jsdom
/**
 * 鉴权服务两种模式的契约：纯静态托管（无后端）走前端本地演示实现，
 * 配置了 UMI_APP_API_BASE 时走 HTTP 接口。模式在模块加载时确定，故每例重新加载模块。
 */
import { AUTH_TOKEN_KEY } from '@/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
});

describe('纯静态演示模式（无后端）', () => {
  it('login 本地签发演示 token，不发请求', async () => {
    const { login } = await loadAuth();
    await expect(login({ name: 'admin', password: 'any' })).resolves.toEqual({
      token: 'admin-demo-token',
      user: { name: 'admin', nickName: 'admin', email: '' },
    });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('fetchCurrentUser 从本地 token 还原用户（含 dontHaveAccess 权限演示账号）', async () => {
    const { fetchCurrentUser } = await loadAuth();
    localStorage.setItem(AUTH_TOKEN_KEY, 'dontHaveAccess-demo-token');
    await expect(fetchCurrentUser()).resolves.toMatchObject({ name: 'dontHaveAccess' });
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('缺失、伪造或空用户名的 token 被拒绝', async () => {
    const { fetchCurrentUser } = await loadAuth();
    await expect(fetchCurrentUser()).rejects.toThrow();
    localStorage.setItem(AUTH_TOKEN_KEY, 'forged-token');
    await expect(fetchCurrentUser()).rejects.toThrow();
    localStorage.setItem(AUTH_TOKEN_KEY, '-demo-token');
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
