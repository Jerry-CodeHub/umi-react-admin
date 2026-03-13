// 运行时配置
import ErrorBoundary from '@/components/ErrorBoundary';
import RightContent from '@/layouts/RightContent';
import { appList } from '@/layouts/_defaultProps';
import type { RequestConfig, RunTimeLayoutConfig, RuntimeAntdConfig } from '@umijs/max';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { getInitialState as libGetInitialState } from './utils/Auth/initalState';
import { requestConfig } from './utils/requestConfig';

// NOTE: cesium-heatmap 插件需要全局引入 Cesium 库
// 声明全局 Cesium 类型
declare global {
  interface Window {
    Cesium: typeof import('cesium');
  }
}

import * as Cesium from 'cesium';
// 仅在需要时挂载到 window，避免全局污染
if (typeof window !== 'undefined' && !window.Cesium) {
  window.Cesium = Cesium;
}

// NOTE:全局初始化数据配置，用于 Layout 用户信息和权限初始化
// 更多信息见文档：https://umijs.org/docs/api/runtime-config#getinitialstate
export async function getInitialState() {
  // return { name: '@umijs/max' };
  return await libGetInitialState();
}

// NOTE: Request 运行时配置
export const request: RequestConfig = requestConfig;

// NOTE: Layout 运行时配置
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const layout: RunTimeLayoutConfig = (initialState) => {
  return {
    title: 'React Admin',
    // logo: '/umi-react-admin/logo.svg',
    logo: '/logo.svg',
    // 默认布局调整
    rightContentRender: () => <RightContent />,
    menuHeaderRender: undefined,
    appList,
    layout: 'mix',
    splitMenus: true,
    fixSiderbar: true,
    fixHeader: true,
    childrenRender: (children) => <ErrorBoundary>{children}</ErrorBoundary>,

    // 其他属性见：https://procomponents.ant.design/components/layout#prolayout
  };
};

// NOTE: Antd 运行时配置
export const antd: RuntimeAntdConfig = (memo) => {
  memo.theme ??= {};
  // 1, dark 算法
  // 默认算法 theme.defaultAlgorithm
  // 暗色算法 theme.darkAlgorithm
  // 紧凑算法 theme.compactAlgorithm

  // memo.theme.algorithm = theme.darkAlgorithm; // 配置 antd5 的预设 dark 算法

  // 2. 组合使用暗色算法与紧凑算法
  // algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],

  memo.appConfig = {
    message: {
      // 配置 message 最大显示数，超过限制时，最早的消息会被自动关闭
      maxCount: 3,
    },
  };

  return memo;
};
