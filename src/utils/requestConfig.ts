import { AUTH_TOKEN_KEY } from '@/constants';
import { demoAdapter } from '@/demo/adapter';
import { DEMO_MODE } from '@/demo/mode';
import type { RequestConfig, RequestOptions } from '@umijs/max';
import { history } from '@umijs/max';
import { BizError } from './BizError';
import { getMessage } from './antdMessage';
import { t } from './i18n';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * 从后端返回体（axios 已解析为普通对象）中同步提取错误消息。
 * 注意：axios 的 response.data 是普通对象，不能使用 fetch Response 的 clone().json()。
 */
const getErrorMessage = (data: unknown, fallback: string) => {
  if (isRecord(data)) {
    const nested = data.error;
    if (isRecord(nested) && typeof nested.message === 'string' && nested.message) {
      return nested.message;
    }
    if (typeof data.message === 'string' && data.message) {
      return data.message;
    }
  }
  return fallback;
};

const getAuthToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
};

/** 请求是否发往本应用自己的后端（同源或配置的 baseURL）：第三方地址不附带登录 token */
const isOwnApi = (url?: string, baseURL?: string) => {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    const target = new URL(url || '', baseURL || window.location.href);
    const trusted = new Set([window.location.origin]);
    if (baseURL) {
      trusted.add(new URL(baseURL, window.location.href).origin);
    }
    return trusted.has(target.origin);
  } catch {
    return false;
  }
};

/** 主动取消的请求（AbortController / CancelToken）不是错误，无需提示 */
const isCanceled = (error: unknown) =>
  isRecord(error) && (error.code === 'ERR_CANCELED' || error.name === 'CanceledError');

export const requestConfig: RequestConfig = {
  timeout: 15000,
  // 真实后端地址（可选）：经 config define 注入的 UMI_APP_API_BASE 全局常量。
  // 未配置时为演示模式：请求交给浏览器内的演示后端（src/demo/adapter.ts），不发网络请求
  baseURL: UMI_APP_API_BASE,
  adapter: DEMO_MODE ? (demoAdapter as unknown as RequestConfig['adapter']) : undefined,
  errorConfig: {
    // 后端 success:false 的业务错误统一转成 BizError 抛给调用方
    errorThrower: (res) => {
      throw new BizError(isRecord(res) ? res : {});
    },
    /**
     * umi request 运行时的调用约定（见 src/.umi/plugin-request/request.ts）：
     * handler(error, opts) 同步调用、返回值被丢弃，随后运行时自行 reject(error) 给调用方。
     * 所以这里只负责提示与跳转：不能写成 async 或返回 rejected promise——那样每个失败请求
     * 都会多出一个无人处理的 rejection（控制台 Uncaught (in promise)）。
     * 传了 skipErrorHandler 的请求原样抛出，由调用方自行处理（运行时同样会 reject 给调用方）。
     */
    errorHandler: (error: unknown, opts?: { skipErrorHandler?: boolean }) => {
      if (opts?.skipErrorHandler) {
        throw error;
      }
      if (isCanceled(error)) {
        return;
      }

      const message = getMessage();

      // 业务错误：统一提示，调用方可 instanceof BizError 精确捕获
      if (error instanceof BizError) {
        message.error(error.message);
        return;
      }

      // HTTP 状态错误：@umijs/max 的 request 运行时基于 axios，
      // 错误对象为 AxiosError，response 是普通 AxiosResponse 对象（不是 fetch 的 Response 实例）
      const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
      if (response) {
        const status = typeof response.status === 'number' ? response.status : 0;
        const data = response.data;

        switch (status) {
          case 400:
            // 参数错误：仅提示，保留表单上下文
            message.error(getErrorMessage(data, t('request.badRequest')));
            break;
          case 401:
            message.error(t('request.unauthorized'));
            if (typeof window !== 'undefined') {
              localStorage.removeItem(AUTH_TOKEN_KEY);
              // 整页跳转而非 SPA 路由（审计 2026-09-22 L-2）：重置内存中的 initialState
              //（残留的已登录用户与昵称），也顺带避免并发 401 重复 push；PUBLIC_PATH 兼容子路径部署
              window.location.assign(`${PUBLIC_PATH}login`);
            }
            break;
          case 403:
            message.error(getErrorMessage(data, t('request.forbidden')));
            history.push('/exception/403');
            break;
          case 404:
            // 资源不存在：仅提示，停留当前页
            message.error(getErrorMessage(data, t('request.notFound')));
            break;
          case 500:
            message.error(getErrorMessage(data, t('request.serverError')));
            break;
          default:
            message.error(t('request.failedWithStatus', { status }));
        }
        return;
      }

      // 网络层错误（超时 / 断网）
      if (isRecord(error) && error.code === 'ECONNABORTED') {
        message.error(t('request.timeout'));
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        message.error(t('request.offline'));
      } else {
        message.error(t('request.network'));
      }
    },
  },
  requestInterceptors: [
    (config: RequestOptions) => {
      const token = getAuthToken();
      if (!token || !isOwnApi(config.url, config.baseURL)) {
        return config;
      }

      return {
        ...config,
        headers: {
          ...(config.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      };
    },
  ],
};
