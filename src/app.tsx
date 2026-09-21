import ErrorBoundary from '@/components/ErrorBoundary';
import { AUTH_TOKEN_KEY } from '@/constants';
import RightContent from '@/layouts/RightContent';
import { appList } from '@/layouts/_defaultProps';
import { registerMessage } from '@/utils/antdMessage';
import type { RequestConfig, RunTimeLayoutConfig, RuntimeAntdConfig } from '@umijs/max';
import { Navigate, useLocation, useModel } from '@umijs/max';
import { App as AntdApp } from 'antd';
import { useEffect } from 'react';
import { getInitialState as libGetInitialState } from './utils/Auth/initialState';
import { requestConfig } from './utils/requestConfig';

// 更多信息见文档：https://umijs.org/docs/api/runtime-config#getinitialstate
export async function getInitialState() {
  return await libGetInitialState();
}

export const request: RequestConfig = requestConfig;

/** 将 antd App 上下文中的 message 实例注册给全局错误处理（requestConfig）使用 */
const MessageBridge = () => {
  const { message } = AntdApp.useApp();

  useEffect(() => {
    registerMessage(message);
  }, [message]);

  return null;
};

/** 无需登录即可访问的路径 */
const PUBLIC_PATHS = ['/login', '/403', '/404'];

/**
 * 路由守卫：包在 layout childrenRender 中，未登录（无 token 或 initialState 未建立）
 * 时重定向到登录页。不走 config/routes.ts 的 wrappers 属性——该属性在
 * @umijs/max 4.6.53 + layout 插件组合下会导致生产构建整站静默不渲染。
 */
const AuthGuard: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { initialState } = useModel('@@initialState');
  const location = useLocation();
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem(AUTH_TOKEN_KEY);

  if (PUBLIC_PATHS.includes(location.pathname)) {
    return <>{children}</>;
  }
  if (!hasToken || !initialState?.name) {
    return <Navigate replace to="/login" />;
  }
  return <>{children}</>;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const layout: RunTimeLayoutConfig = (initialState) => {
  return {
    title: 'React Admin',
    logo: '/logo.svg',
    rightContentRender: () => <RightContent />,
    menuHeaderRender: undefined,
    appList,
    layout: 'mix',
    splitMenus: true,
    fixSiderbar: true,
    fixHeader: true,
    childrenRender: (children) => (
      <ErrorBoundary>
        <MessageBridge />
        <AuthGuard>{children}</AuthGuard>
      </ErrorBoundary>
    ),
    // 更多 ProLayout 属性见：https://procomponents.ant.design/components/layout#prolayout
  };
};

export const antd: RuntimeAntdConfig = (memo) => {
  memo.theme ??= {};
  // 如需切换主题算法，取消对应行注释：
  // theme.defaultAlgorithm（默认）/ theme.darkAlgorithm（暗色）/ theme.compactAlgorithm（紧凑）
  // 也可组合使用：algorithm: [theme.darkAlgorithm, theme.compactAlgorithm]
  memo.appConfig = {
    message: {
      maxCount: 3,
    },
  };

  return memo;
};
