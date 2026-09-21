import { AUTH_TOKEN_KEY } from '@/constants';
import type { RequestConfig, RequestOptions } from '@umijs/max';
import { getIntl, history } from '@umijs/max';
import { BizError } from './BizError';
import { getMessage } from './antdMessage';

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

/** 非组件环境取 intl 文案，locale 插件未就绪或键缺失时回退中文默认值 */
const t = (id: string, fallback: string) => {
  try {
    return getIntl().formatMessage({ id, defaultMessage: fallback });
  } catch {
    return fallback;
  }
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
  // 真实后端地址（可选）：经 config define 注入的 UMI_APP_API_BASE 全局常量，
  // 未配置时为 undefined 走相对路径（dev 由 umi mock 接管，静态演示走 services/demo 的本地实现）
  baseURL: UMI_APP_API_BASE,
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
            message.error(getErrorMessage(data, t('request.badRequest', '请求参数错误。')));
            break;
          case 401:
            message.error(t('request.unauthorized', '登录失效，即将跳转至登录页面'));
            if (typeof window !== 'undefined') {
              localStorage.removeItem(AUTH_TOKEN_KEY);
            }
            history.push('/login');
            break;
          case 403:
            message.error(getErrorMessage(data, t('request.forbidden', '没有权限访问该资源。')));
            history.push('/403');
            break;
          case 404:
            // 资源不存在：仅提示，停留当前页
            message.error(getErrorMessage(data, t('request.notFound', '请求的资源不存在。')));
            break;
          case 500:
            message.error(getErrorMessage(data, t('request.serverError', '服务器错误，请稍后重试。')));
            break;
          default:
            message.error(`${t('request.failed', '请求失败')}（HTTP ${status}）`);
        }
        return;
      }

      // 网络层错误（超时 / 断网）
      if (isRecord(error) && error.code === 'ECONNABORTED') {
        message.error(t('request.timeout', '请求超时，请稍后重试。'));
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        message.error(t('request.offline', '网络异常，请检查网络连接。'));
      } else {
        message.error(t('request.network', '网络异常，请稍后重试。'));
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
