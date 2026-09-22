import ErrorBoundary from '@/components/ErrorBoundary';
import { AUTH_TOKEN_KEY } from '@/constants';
import RightContent from '@/layouts/RightContent';
import { appList } from '@/layouts/_defaultProps';
import { registerMessage } from '@/utils/antdMessage';
import type { RequestConfig, RuntimeAntdConfig, RunTimeLayoutConfig } from '@umijs/max';
import { getLocale, Navigate, useLocation, useModel } from '@umijs/max';
import { App as AntdApp, theme as antdTheme } from 'antd';
import { useEffect } from 'react';
import { getInitialState as libGetInitialState, readTheme, type AppInitialState } from './utils/Auth/initialState';
import { requestConfig } from './utils/requestConfig';

// 更多信息见文档：https://umijs.org/docs/api/runtime-config#getinitialstate
export async function getInitialState(): Promise<AppInitialState | undefined> {
  return await libGetInitialState();
}

export const request: RequestConfig = requestConfig;

/**
 * 屏幕阅读器按 <html lang> 选择发音与断词（WCAG 3.1.1），umi 默认模板不带 lang。
 * 切换语言时 setLocale 默认整页刷新，因此启动时同步一次即可覆盖所有情况。
 */
export function render(oldRender: () => void) {
  document.documentElement.lang = getLocale();
  oldRender();
}

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
 * @umijs/max 4.6.53 + layout 插件组合下实测会导致生产构建整站静默不渲染（升级 4.7.19 后未复测，
 * 守卫实现保持不变）。
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

export const layout: RunTimeLayoutConfig = (initialState) => {
  // 回调参数是 initialState 插件的 model 对象（{ initialState, refresh, ... }）
  const themeMode = initialState?.initialState?.theme;
  return {
    title: 'React Admin',
    // 经 PUBLIC_PATH 拼接：GitHub Pages 部署在 /umi-react-admin/ 子路径下
    logo: `${PUBLIC_PATH}logo.svg`,
    rightContentRender: () => <RightContent />,
    menuHeaderRender: undefined,
    appList,
    layout: 'mix',
    // 主题与 antd 运行时算法同源（localStorage），避免首帧闪烁
    navTheme: themeMode === 'realDark' ? 'realDark' : 'light',
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
  // 启动初始算法与 layout 的 navTheme 同源（读同一 localStorage 键）
  memo.theme.algorithm = readTheme() === 'realDark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;
  // 开启 CSS 变量注入：--ant-* 变量挂在 antd 组件根的 .css-var-* 作用域（不在 :root），
  // tailwind 侧 token 类经 var() 桥接随算法联动，只在 antd 组件树内生效（见 tailwind.config.js）
  memo.theme.cssVar = true;
  memo.appConfig = {
    message: {
      maxCount: 3,
    },
  };

  return memo;
};
