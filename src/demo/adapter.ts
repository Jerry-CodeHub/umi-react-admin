/**
 * 演示模式的 axios adapter：请求不出浏览器，交给同页运行的演示后端（src/demo/server）。
 *
 * 为什么不用 MSW：Service Worker 只在安全上下文（https / localhost）可用——Docker 部署后
 * 经 http://内网IP 访问时整站无法登录；且 msw 带 18 个直接依赖（graphql、yargs、tough-cookie…）。
 * adapter 方案零依赖、任何托管方式都能用，同一套 handler 同时服务 dev 与所有静态部署。
 *
 * 演示后端代码（生成器 + 路由）经动态 import 单独分包，首个请求时才加载，不进入口 chunk。
 */
import { getLocale } from '@umijs/max';
import type { DemoServer } from './server';

type AdapterConfig = {
  method?: string;
  url?: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: { get?: (name: string) => unknown } & Record<string, unknown>;
};

let serverPromise: Promise<DemoServer> | undefined;

const loadServer = () => {
  serverPromise ??= import('./server').then(({ createDemoServer }) =>
    createDemoServer({
      locale: getLocale() === 'en-US' ? 'en-US' : 'zh-CN',
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
    }),
  );
  return serverPromise;
};

/** 模拟网络耗时，让加载态在演示里真实可见 */
const latency = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 120 + Math.random() * 200);
  });

const header = (headers: AdapterConfig['headers'], name: string) =>
  String(headers?.get?.(name) ?? headers?.[name] ?? '') || undefined;

export const demoAdapter = async (config: AdapterConfig) => {
  const server = await loadServer();
  await latency();
  const { status, body } = server.handle({
    method: config.method ?? 'get',
    url: config.url ?? '',
    params: config.params,
    body: config.data,
    headers: { Authorization: header(config.headers, 'Authorization') },
  });
  const response = { data: body, status, statusText: String(status), headers: {}, config, request: {} };
  if (status >= 400) {
    // 与 axios 默认 adapter 的 settle 行为一致：非 2xx 以带 response 的错误 reject，请求层 errorHandler 按状态码分流
    throw Object.assign(new Error(`Request failed with status code ${status}`), {
      name: 'AxiosError',
      isAxiosError: true,
      code: status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST',
      config,
      response,
    });
  }
  return response;
};

/** 重置演示数据（头像菜单「重置演示数据」） */
export const resetDemoData = async () => {
  const server = await loadServer();
  server.store.reset();
};
