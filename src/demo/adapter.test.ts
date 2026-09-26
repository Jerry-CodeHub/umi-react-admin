// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@umijs/max', () => ({ getLocale: () => 'zh-CN' }));

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

const loadAdapter = async () => {
  vi.resetModules();
  return import('./adapter');
};

describe('演示 adapter', () => {
  it('按 axios 响应形状返回演示后端的信封', async () => {
    const { demoAdapter } = await loadAdapter();
    const res = await demoAdapter({ method: 'post', url: '/api/v1/login', data: JSON.stringify({ name: 'admin' }) });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ success: true, errorCode: 0 });
  });

  it('非 2xx 以带 response 的错误 reject（请求层 errorHandler 按状态码分流）', async () => {
    const { demoAdapter } = await loadAdapter();
    const error = await demoAdapter({ method: 'get', url: '/api/v1/currentUser', headers: {} }).catch((e) => e);
    expect(error).toMatchObject({ isAxiosError: true, response: { status: 401 } });
  });

  it('从 AxiosHeaders 风格的 get() 读取 Authorization', async () => {
    const { demoAdapter } = await loadAdapter();
    const login = await demoAdapter({ method: 'post', url: '/api/v1/login', data: { name: 'guest' } });
    const token = (login.data.data as { token: string }).token;
    const headers = { get: (name: string) => (name === 'Authorization' ? `Bearer ${token}` : undefined) };
    const me = await demoAdapter({ method: 'get', url: '/api/v1/currentUser', headers });
    expect(me.data.data).toMatchObject({ name: 'guest', role: 'user' });
  });
});
