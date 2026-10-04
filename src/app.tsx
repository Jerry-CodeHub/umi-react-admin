// antd 5 的静态方法（message/Modal.confirm 等）内部用 ReactDOM.render 挂载，React 19 已删除该 API，
// 官方补丁改走 createRoot；必须先于任何 antd 静态调用加载（升级 antd 6 后可移除）
import '@ant-design/v5-patch-for-react-19';

import BuildFooter from '@/components/BuildFooter';
import ErrorBoundary from '@/components/ErrorBoundary';
import GuideTour from '@/components/GuideTour';
import { AUTH_TOKEN_KEY } from '@/constants';
import RightContent from '@/layouts/RightContent';
import Forbidden from '@/pages/Exception/403';
import { registerMessage } from '@/utils/antdMessage';
import {
  AntDesignOutlined,
  BookOutlined,
  BugOutlined,
  DotChartOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { RequestConfig, RuntimeAntdConfig, RunTimeLayoutConfig } from '@umijs/max';
import { getIntl, getLocale, Navigate, useLocation, useModel } from '@umijs/max';
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
const PUBLIC_PATHS = ['/login', '/exception/403', '/exception/404', '/exception/500'];

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
    // 带上原本要访问的地址，登录后回到这里
    return <Navigate replace to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} />;
  }
  return <>{children}</>;
};

/**
 * 路由 access 不满足时布局渲染它（替代布局自带的 403）：未登录先去登录（带回跳地址），
 * 已登录但权限不够才是真正的 403。此前未登录直接打开受保护页面会看到「无权访问」。
 */
const AccessFallback = () => {
  const { initialState } = useModel('@@initialState');
  const location = useLocation();
  if (!initialState?.name) {
    return <Navigate replace to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} />;
  }
  return <Forbidden />;
};

const REPO = 'https://github.com/Jerry-CodeHub/umi-react-admin';

/** 左上角应用列表：项目相关链接（图标用内置图标，不再热链第三方图片，CSP 随之收紧） */
const appList = () => {
  const t = (id: string) => getIntl().formatMessage({ id });
  return [
    { icon: <BookOutlined />, title: t('app.links.docs'), desc: t('app.links.docs.desc'), url: `${REPO}#readme` },
    {
      icon: <HistoryOutlined />,
      title: t('app.links.changelog'),
      desc: t('app.links.changelog.desc'),
      url: `${REPO}/blob/master/CHANGELOG.md`,
    },
    { icon: <BugOutlined />, title: t('app.links.issues'), desc: t('app.links.issues.desc'), url: `${REPO}/issues` },
    {
      icon: <AntDesignOutlined />,
      title: t('app.links.antd'),
      desc: t('app.links.antd.desc'),
      url: 'https://ant.design',
    },
    {
      icon: <ThunderboltOutlined />,
      title: t('app.links.umi'),
      desc: t('app.links.umi.desc'),
      url: 'https://umijs.org',
    },
    {
      icon: <DotChartOutlined />,
      title: t('app.links.antv'),
      desc: t('app.links.antv.desc'),
      url: 'https://antv.antgroup.com',
    },
  ].map((item) => ({ ...item, target: '_blank' as const }));
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
    appList: appList(),
    layout: 'mix',
    // 主题与 antd 运行时算法同源（localStorage），避免首帧闪烁
    navTheme: themeMode === 'realDark' ? 'realDark' : 'light',
    splitMenus: true,
    fixSiderbar: true,
    fixHeader: true,
    unAccessible: <AccessFallback />,
    footerRender: () => <BuildFooter />,
    childrenRender: (children) => (
      <ErrorBoundary>
        <MessageBridge />
        <AuthGuard>
          {children}
          <GuideTour />
        </AuthGuard>
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
  // tailwind 侧 token 类经 var() 桥接随算法联动，只在 antd 组件树内生效（见 tailwind.css 的 @theme inline）
  memo.theme.cssVar = true;
  // 暗色主题下 ProLayout 用 dark 菜单，选中项默认整块主色填充，比浅色主题（浅灰底）重得多、抢视线；
  // 改成与浅色一致的「浅底 + 高亮文字」（这两个 token 只作用于 dark 菜单，浅色主题不受影响）
  memo.theme.components = {
    ...memo.theme.components,
    Menu: {
      ...memo.theme.components?.Menu,
      darkItemSelectedBg: 'rgba(255, 255, 255, 0.1)',
      darkItemSelectedColor: '#fff',
    },
  };
  memo.appConfig = {
    message: {
      maxCount: 3,
    },
  };

  return memo;
};
