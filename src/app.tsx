// umi 的 antd 插件对 antd 6 不再自动注入 reset.css（插件源码 `if (!isV6)`），而本项目关闭了
// Tailwind preflight、基础 reset 由 antd 独占（见 tailwind.css），这里手动补回
import 'antd/dist/reset.css';

import BuildFooter from '@/components/BuildFooter';
import CommandPalette from '@/components/CommandPalette';
import ErrorBoundary from '@/components/ErrorBoundary';
import GroupNav from '@/components/GroupNav';
import GuideTour from '@/components/GuideTour';
import PageTransition from '@/components/PageTransition';
import { REPO_URL as REPO } from '@/constants/repo';
import { syncColorScheme } from '@/hooks/useThemeMode';
import RightContent from '@/layouts/RightContent';
import Forbidden from '@/pages/Exception/403';
import { a11yThemeTokens } from '@/styles/themeTokens';
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
import { getIntl, getLocale, history, matchRoutes, Navigate, useLocation, useModel } from '@umijs/max';
import { App as AntdApp, theme as antdTheme } from 'antd';
import { useEffect } from 'react';
import { getInitialState as libGetInitialState, readTheme, type AppInitialState } from './utils/Auth/initialState';
import { loginPath } from './utils/Auth/loginUrl';
import { APP_TITLE, menuKeyOf, pageTitle } from './utils/pageTitle';
import { requestConfig } from './utils/requestConfig';
import { firstAccessibleLeaf, type NavRoute } from './utils/routeNav';

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
  syncColorScheme(readTheme());
  oldRender();
}

/**
 * 浏览器标签页标题：「页面名 - React Admin」，页面名取菜单同一套文案键（menu.<父级>.<name>）。
 * ProLayout 不改 document.title，登录页又不在布局里，统一在路由切换时设置；
 * 切换语言默认整页刷新，首次触发（isFirst）即按新语言重算。
 */
export function onRouteChange({
  clientRoutes,
  location,
  basename,
}: {
  clientRoutes: Parameters<typeof matchRoutes>[0];
  location: { pathname: string };
  basename?: string;
}) {
  const chain = matchRoutes(clientRoutes, location.pathname, basename) ?? [];
  const key = menuKeyOf(chain.map((match) => match.route as { name?: unknown }));
  const intl = getIntl();
  document.title = pageTitle(key && intl.messages[key] ? intl.formatMessage({ id: key }) : undefined);
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
 * 路由守卫：包在 layout childrenRender 中，服务端/演示会话的 initialState 未建立
 * 时重定向到登录页。不走 config/routes.ts 的 wrappers 属性——该属性在
 * @umijs/max 4.6.53 + layout 插件组合下实测会导致生产构建整站静默不渲染（升级 4.7.19 后未复测，
 * 守卫实现保持不变）。
 */
const AuthGuard: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { initialState } = useModel('@@initialState');
  const location = useLocation();

  if (PUBLIC_PATHS.includes(location.pathname)) {
    return <>{children}</>;
  }
  if (!initialState?.name) {
    // 带上原本要访问的地址，登录后回到这里
    return <Navigate replace to={loginPath(location.pathname + location.search)} />;
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
    return <Navigate replace to={loginPath(location.pathname + location.search)} />;
  }
  return <Forbidden />;
};

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
    title: APP_TITLE,
    // 经 PUBLIC_PATH 拼接：GitHub Pages 部署在 /umi-react-admin/ 子路径下
    logo: `${PUBLIC_PATH}logo.svg`,
    // ProLayout v3 移除了 rightContentRender（umi 布局模板仍按 v2 传它，v3 直接忽略），顶栏右侧改走 actionsRender
    rightContentRender: false,
    actionsRender: () => [<RightContent key="right-content" />],
    menuHeaderRender: undefined,
    appList: appList(),
    // 顶栏只承载一级分组，二级由内容区顶部的 GroupNav 承载，内容区回收原侧栏宽度；
    // 分组带子项（hover/点击弹层直达任意二级页）
    layout: 'top',
    // 点分组标题（顶栏一级、下拉里的 Cesium 分组）= 进入该组第一个可见且可访问的子页
    // （firstAccessibleLeaf；分组路径自身的 redirect 是静态的，不看权限，直接 push 会让无权角色落进 403）。不走 postMenuData/onTitleClick——pro-components 3.1.14 的内部构建把
    // BaseMenu 的该属性名混淆成了 n，外部注入不生效；subMenuItemRender 是明文名且经
    // ProLayout→Header→TopNavHeader→BaseMenu 全程 {...props} 透传（实测可达）。
    // 移动端抽屉里点组名应展开子菜单而非跳转，按视口放行（桌面弹层 hover 触发，点标题不弹）
    subMenuItemRender: (item, defaultDom) =>
      item.path ? (
        <span
          onClick={(event) => {
            if (window.matchMedia('(max-width: 768px)').matches) return;
            event.preventDefault();
            event.stopPropagation();
            history.push(firstAccessibleLeaf(item as NavRoute) ?? item.path!);
          }}
        >
          {defaultDom}
        </span>
      ) : (
        defaultDom
      ),
    // 主题与 antd 运行时算法同源（localStorage），避免首帧闪烁
    navTheme: themeMode === 'realDark' ? 'realDark' : 'light',
    fixHeader: true,
    unAccessible: <AccessFallback />,
    footerRender: () => <BuildFooter />,
    childrenRender: (children) => (
      <ErrorBoundary>
        <MessageBridge />
        <AuthGuard>
          <GroupNav />
          <PageTransition>{children}</PageTransition>
          <GuideTour />
          <CommandPalette />
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
  // U04 + Q5 文本对比度：说明文字（Typography secondary → colorTextDescription → colorTextTertiary）
  // 默认是 rgba(0,0,0,.45)，白底 14px 只有 3.36:1，低于正文 4.5:1 的目标；主色 / 链接 / 状态色
  // 当文字用时同样不达标。整套覆盖（含实测对比度）集中在 src/styles/themeTokens.ts，按主题出两套值，
  // 热切换路径（src/hooks/useThemeMode.ts）消费同一份，避免切换后停留在启动主题那一套。
  // colorTextQuaternary（禁用态文字，白底 1.84:1）属 WCAG 豁免态，保持默认不动；
  // colorTextSecondary 默认浅色 7.0:1 / 深色 8.2:1 已达标，同样不动。
  memo.theme.token = {
    ...memo.theme.token,
    ...a11yThemeTokens(readTheme()),
  };
  // antd 6 默认注入 CSS 变量：--ant-* 变量挂在 antd 组件根的 .css-var-* 作用域（不在 :root），
  // tailwind 侧 token 类经 var() 桥接随算法联动，只在 antd 组件树内生效（见 tailwind.css 的 @theme inline）
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
