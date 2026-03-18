import type { RequestConfig } from '@umijs/max';
import { history } from '@umijs/max';
import { message } from 'antd';

// TODO: 请根据实际项目替换鉴权逻辑和错误处理策略
export const requestConfig: RequestConfig = {
  timeout: 15000,
  errorConfig: {
    errorThrower: (res: any) => {
      throw res;
    },
    errorHandler: (error: any, opts: any) => {
      const { response } = error;

      if (!!response && response.status === 400) {
        const data = response.clone().json();
        message.error(data.error.message);
        history.push('/404');
        return;
      }

      if (!!response && response.status === 500) {
        const data = response.clone().json();
        message.error(data.error.message);
        return;
      }

      if (!!response && (response.status === 404 || response.status === 403)) {
        message.error('请求地址错误或您没有权限访问该资源。');
        history.push('/403');
        return;
      }

      if (!!response && response.status === 401) {
        message.error('登录失效，即将跳转至登录页面');
        //  getAuthService().login();
        return;
      }
    },
  },

  requestInterceptors: [
    (config: any) => {
      // TODO: 替换为真实 token 鉴权逻辑，如从 localStorage 读取并注入 Authorization header
      const url = config.url.concat('?token = 123');
      return { ...config, url };
    },
  ],

  responseInterceptors: [
    (response) => {
      return response;
    },
  ],
};
