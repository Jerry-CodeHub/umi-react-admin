import { AUTH_TOKEN_KEY } from '@/constants';
import type { RequestConfig, RequestOptions } from '@umijs/max';
import { history } from '@umijs/max';
import { message } from 'antd';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getErrorMessage = async (response: Response, fallback: string) => {
  const data = await response
    .clone()
    .json()
    .catch(() => undefined);

  if (!isRecord(data)) {
    return fallback;
  }

  const error = data.error;
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return typeof data.message === 'string' ? data.message : fallback;
};

const getAuthToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
};

export const requestConfig: RequestConfig = {
  timeout: 15000,
  errorConfig: {
    errorThrower: (res: unknown) => {
      throw res;
    },
    errorHandler: async (error: unknown) => {
      const response = isRecord(error) && error.response instanceof Response ? error.response : undefined;

      if (!!response && response.status === 400) {
        message.error(await getErrorMessage(response, '请求参数错误。'));
        history.push('/404');
        return;
      }

      if (!!response && response.status === 500) {
        message.error(await getErrorMessage(response, '服务器错误，请稍后重试。'));
        return;
      }

      if (!!response && (response.status === 404 || response.status === 403)) {
        message.error('请求地址错误或您没有权限访问该资源。');
        history.push('/403');
        return;
      }

      if (!!response && response.status === 401) {
        message.error('登录失效，即将跳转至登录页面');
        if (typeof window !== 'undefined') {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
        history.push('/login');
        return;
      }
    },
  },

  requestInterceptors: [
    (config: RequestOptions) => {
      const token = getAuthToken();
      if (!token) {
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

  responseInterceptors: [
    (response) => {
      return response;
    },
  ],
};
