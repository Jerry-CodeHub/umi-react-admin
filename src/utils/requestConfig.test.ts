// @vitest-environment jsdom
/**
 * requestConfig 行为契约测试：状态码分流、token 生命周期与注入范围、网络错误分流，
 * 以及与 umi request 运行时调用约定的一致性（handler 同步调用、返回值被丢弃）。
 */
import { AUTH_TOKEN_KEY } from '@/constants';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BizError } from './BizError';

const { errorMock, pushMock, assignMock } = vi.hoisted(() => ({
  errorMock: vi.fn(),
  pushMock: vi.fn(),
  assignMock: vi.fn(),
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
type ErrorHandler = (error: unknown, opts?: { skipErrorHandler?: boolean }) => unknown;
type Interceptor = (config: Record<string, unknown>) => { headers?: Record<string, string> };
let errorHandler: ErrorHandler;
let interceptor: Interceptor;

beforeAll(async () => {
  (globalThis as Record<string, unknown>).UMI_APP_API_BASE = undefined;
  // PUBLIC_PATH 与 UMI_APP_API_BASE 同为构建期 define 注入的全局常量（401 整页跳转用）
  (globalThis as Record<string, unknown>).PUBLIC_PATH = '/';
  // 401 走 window.location.assign（整页跳转重置内存态），jsdom 下需替换 location 才能断言
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign: assignMock },
    writable: true,
  });
  ({ requestConfig } = await import('./requestConfig'));
  errorHandler = requestConfig.errorConfig!.errorHandler! as unknown as ErrorHandler;
  interceptor = requestConfig.requestInterceptors![0] as unknown as Interceptor;
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

const httpError = (status: number, data?: unknown) => ({ response: { status, data } });

/** 复刻 umi request 运行时的 catch 分支：同步调用 handler，捕获同步异常，随后 reject 原错误 */
const umiRequestFailing = (error: unknown, opts: { skipErrorHandler?: boolean } = {}) =>
  new Promise((_resolve, reject) => {
    try {
      errorHandler(error, opts);
    } catch (e) {
      reject(e);
    }
    reject(error);
  });

describe('请求拦截器：token 注入范围', () => {
  const withToken = () => localStorage.setItem(AUTH_TOKEN_KEY, 'admin-demo-token');

  it('无 token 时配置原样返回', () => {
    const result = interceptor({ url: '/api/v1/x', headers: { 'X-Test': '1' } });
    expect(result.headers?.['X-Test']).toBe('1');
    expect(result.headers?.Authorization).toBeUndefined();
  });

  it('相对路径（同源）注入 Authorization Bearer 头', () => {
    withToken();
    expect(interceptor({ url: '/api/v1/x', headers: {} }).headers?.Authorization).toBe('Bearer admin-demo-token');
  });

  it('同源绝对地址注入 token', () => {
    withToken();
    const url = `${window.location.origin}/api/v1/x`;
    expect(interceptor({ url, headers: {} }).headers?.Authorization).toBe('Bearer admin-demo-token');
  });

  it('配置的 baseURL 源注入 token', () => {
    withToken();
    const result = interceptor({ url: '/api/v1/x', baseURL: 'https://api.example.com', headers: {} });
    expect(result.headers?.Authorization).toBe('Bearer admin-demo-token');
  });

  it('第三方绝对地址不注入 token（防止凭证外泄）', () => {
    withToken();
    const result = interceptor({ url: 'https://third-party.example.org/data.json', headers: {} });
    expect(result.headers?.Authorization).toBeUndefined();
  });
});

describe('errorHandler：HTTP 状态码分流（axios 形状）', () => {
  it('400 仅提示不跳页（保留表单上下文）', () => {
    expect(errorHandler(httpError(400))).toBeUndefined();
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('401 清除 token 并整页跳转登录页（重置内存中的 initialState）', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'stale-token');
    errorHandler(httpError(401));
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(assignMock).toHaveBeenCalledWith('/login');
  });

  it('403 提示并跳转 /403', () => {
    errorHandler(httpError(403));
    expect(pushMock).toHaveBeenCalledWith('/403');
  });

  it('404 仅提示停留当前页', () => {
    errorHandler(httpError(404, { message: '用户不存在' }));
    expect(errorMock).toHaveBeenCalledWith('用户不存在');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('500 提示服务器错误', () => {
    errorHandler(httpError(500));
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it('优先展示后端返回体中的 message', () => {
    errorHandler(httpError(400, { error: { message: '后端参数错误' } }));
    expect(errorMock).toHaveBeenCalledWith('后端参数错误');
  });
});

describe('errorHandler：业务错误、取消与网络层', () => {
  it('BizError（success:false）只提示，不返回 rejected promise', () => {
    const biz = new BizError({ message: '业务处理失败', errorCode: 1001 });
    expect(errorHandler(biz)).toBeUndefined();
    expect(errorMock).toHaveBeenCalledWith('业务处理失败');
  });

  it('主动取消的请求不提示', () => {
    errorHandler({ code: 'ERR_CANCELED', name: 'CanceledError' });
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('超时（ECONNABORTED）提示超时文案', () => {
    errorHandler({ code: 'ECONNABORTED' });
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('无 response 的未知错误走网络异常分支', () => {
    errorHandler(new Error('boom'));
    expect(errorMock).toHaveBeenCalledTimes(1);
  });
});

describe('与 umi request 运行时调用约定一致', () => {
  const unhandled = vi.fn();
  beforeEach(() => {
    process.on('unhandledRejection', unhandled);
  });
  afterEach(() => {
    process.off('unhandledRejection', unhandled);
  });

  it('失败请求只把错误 reject 给调用方，不产生无人处理的 rejection', async () => {
    const error = httpError(500);
    await expect(umiRequestFailing(error)).rejects.toBe(error);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('skipErrorHandler：不提示，错误原样交给调用方', async () => {
    const error = httpError(404);
    await expect(umiRequestFailing(error, { skipErrorHandler: true })).rejects.toBe(error);
    expect(errorMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
