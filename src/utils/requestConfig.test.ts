// @vitest-environment jsdom
/**
 * requestConfig 行为契约测试——dec3a96 式回归（errorHandler 守卫对 axios 运行时失效）
 * 的测试网：全部状态码分支、token 生命周期、网络错误分流。
 */
import { AUTH_TOKEN_KEY } from '@/constants';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizError } from './BizError';

const { errorMock, pushMock } = vi.hoisted(() => ({
  errorMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  history: { push: pushMock },
  getIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage?: string }) => defaultMessage ?? '',
  }),
  request: vi.fn(),
}));

vi.mock('@/utils/antdMessage', () => ({
  getMessage: () => ({ error: errorMock }),
  registerMessage: vi.fn(),
}));

// UMI_APP_API_BASE 是构建期 define 注入的全局常量，测试环境需先声明再动态 import
let requestConfig: (typeof import('./requestConfig'))['requestConfig'];
type ErrorHandler = (error: unknown) => Promise<unknown>;
type Interceptor = (config: Record<string, unknown>) => Record<string, unknown>;
let errorHandler: ErrorHandler;
let interceptor: Interceptor;

beforeAll(async () => {
  (globalThis as Record<string, unknown>).UMI_APP_API_BASE = undefined;
  ({ requestConfig } = await import('./requestConfig'));
  errorHandler = requestConfig.errorConfig!.errorHandler! as unknown as ErrorHandler;
  interceptor = requestConfig.requestInterceptors![0] as unknown as Interceptor;
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

const httpError = (status: number, data?: unknown) => ({ response: { status, data } });

describe('请求拦截器：token 注入', () => {
  it('无 token 时配置原样返回', () => {
    const config = { url: '/api/v1/x', headers: { 'X-Test': '1' } } as never;
    const result = interceptor(config);
    expect((result as { headers: Record<string, string> }).headers['X-Test']).toBe('1');
    expect((result as { headers: Record<string, string> }).headers.Authorization).toBeUndefined();
  });

  it('有 token 时注入 Authorization Bearer 头', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'admin-demo-token');
    const config = { url: '/api/v1/x', headers: {} } as never;
    const result = interceptor(config) as { headers: Record<string, string> };
    expect(result.headers.Authorization).toBe('Bearer admin-demo-token');
  });
});

describe('errorHandler：HTTP 状态码分流（axios 形状）', () => {
  it('400 仅提示不跳页（保留表单上下文）', async () => {
    await expect(errorHandler(httpError(400))).rejects.toBeTruthy();
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('401 清除 token 并跳转登录页', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'stale-token');
    await expect(errorHandler(httpError(401))).rejects.toBeTruthy();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(pushMock).toHaveBeenCalledWith('/login');
  });

  it('403 提示并跳转 /403', async () => {
    await expect(errorHandler(httpError(403))).rejects.toBeTruthy();
    expect(pushMock).toHaveBeenCalledWith('/403');
  });

  it('404 仅提示停留当前页', async () => {
    await expect(errorHandler(httpError(404, { message: '用户不存在' }))).rejects.toBeTruthy();
    expect(errorMock).toHaveBeenCalledWith('用户不存在');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('500 提示服务器错误', async () => {
    await expect(errorHandler(httpError(500))).rejects.toBeTruthy();
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it('优先展示后端返回体中的 message', async () => {
    await expect(errorHandler(httpError(400, { error: { message: '后端参数错误' } }))).rejects.toBeTruthy();
    expect(errorMock).toHaveBeenCalledWith('后端参数错误');
  });
});

describe('errorHandler：业务错误与网络层', () => {
  it('BizError（success:false）提示后原样抛回', async () => {
    const biz = new BizError({ message: '业务处理失败', errorCode: 1001 });
    await expect(errorHandler(biz)).rejects.toBe(biz);
    expect(errorMock).toHaveBeenCalledWith('业务处理失败');
  });

  it('超时（ECONNABORTED）提示超时文案', async () => {
    await expect(errorHandler({ code: 'ECONNABORTED' })).rejects.toBeTruthy();
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('无 response 的未知错误走网络异常分支，不再有死分支', async () => {
    await expect(errorHandler(new Error('boom'))).rejects.toBeTruthy();
    expect(errorMock).toHaveBeenCalledTimes(1);
  });
});
