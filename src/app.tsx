import ErrorBoundary from '@/components/ErrorBoundary';
import RightContent from '@/layouts/RightContent';
import { appList } from '@/layouts/_defaultProps';
import type { RequestConfig, RunTimeLayoutConfig, RuntimeAntdConfig } from '@umijs/max';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { getInitialState as libGetInitialState } from './utils/Auth/initalState';
import { requestConfig } from './utils/requestConfig';

// cesium-heatmap 等插件依赖全局 window.Cesium，需在此挂载
// 同时声明类型以避免 TS 报错
declare global {
  interface Window {
    Cesium: typeof import('cesium');
  }
}

import * as Cesium from 'cesium';
// 防止 SSR 或模块重复加载时重复挂载，也避免覆盖已有实例
if (typeof window !== 'undefined' && !window.Cesium) {
  window.Cesium = Cesium;
}
// CESIUM_ION_TOKEN 由构建时环境变量注入（见 config/config.ts define 配置）
if (typeof CESIUM_ION_TOKEN !== 'undefined' && CESIUM_ION_TOKEN) {
  Cesium.Ion.defaultAccessToken = CESIUM_ION_TOKEN as string;
}

// 更多信息见文档：https://umijs.org/docs/api/runtime-config#getinitialstate
export async function getInitialState() {
  return await libGetInitialState();
}

export const request: RequestConfig = requestConfig;

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
    childrenRender: (children) => <ErrorBoundary>{children}</ErrorBoundary>,
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
