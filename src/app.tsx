import ErrorBoundary from '@/components/ErrorBoundary';
import RightContent from '@/layouts/RightContent';
import { appList } from '@/layouts/_defaultProps';
import type { RequestConfig, RunTimeLayoutConfig, RuntimeAntdConfig } from '@umijs/max';
import { getInitialState as libGetInitialState } from './utils/Auth/initalState';
import { requestConfig } from './utils/requestConfig';

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
