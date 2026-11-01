import { defineConfig } from '@umijs/max';
import { resolveAuthConfig } from './auth';
import { addVersionFile } from './buildInfo';
import { addChunkGraph } from './chunkGraph';
import { buildCsp } from './csp';
import { faviconLinks } from './favicons';
import { configureSplitChunks } from './splitChunks';
import { keepUrlAssetsVerbatim } from './urlAssets';

const AUTH_CONFIG = resolveAuthConfig(process.env);
if (!AUTH_CONFIG.demoMode) {
  throw new Error('GitHub Pages supports public demo only; backend mode needs a host with security headers');
}

export default defineConfig({
  // 与 config.ts 同源：UMI_ENV=github 时本函数整体覆盖 config.ts 的 chainWebpack
  // chainWebpack 是函数、merge 时整体覆盖：内容与 config.ts 保持一致（四个共享步骤 keepUrlAssetsVerbatim /
  // configureSplitChunks / addChunkGraph / addVersionFile 都来自各自单源模块）——
  // 在 config.ts 新增链式步骤时需同步调整本副本（无表达式层面的共享手段）
  chainWebpack(config) {
    keepUrlAssetsVerbatim(config);
    if (process.env.NODE_ENV === 'production') {
      configureSplitChunks(config);
      addChunkGraph(config);
      // 与 config.ts 对齐传入 demoMode：本文件入口已断言 demoMode 为真，避免仅靠
      // UMI_APP_DEMO_MODE 环境变量兜底（两条产线参数源不同就会静默漂移）
      addVersionFile(config, { demoMode: AUTH_CONFIG.demoMode });
    }
  },
  // define 经 lodash.merge 逐键深合并（@umijs/core getUserConfig）：这里只覆盖与主产线的
  // 差异键（PUBLIC_PATH / CESIUM_BASE_URL），其余（token/key/apiBase/demoMode/BUILD_INFO）
  // 自动继承 config.ts —— 避免两份逐字复制导致的漂移
  define: {
    CESIUM_BASE_URL: '/umi-react-admin/Cesium',
    PUBLIC_PATH: '/umi-react-admin/',
  },
  // umi 对 metas 数组为整体覆盖（不与 config.ts 逐项合并），viewport 需一并带上。
  // meta CSP（审计 2026-09-22 H-3）：GitHub Pages 无法自定义响应头，只能走 meta；
  // meta 版不支持 frame-ancestors（点击劫持防护为平台限制，README 已声明）与 report-only。
  // 来源清单单一来源见 ./csp.ts（vercel.json 与 nginx 副本由 scripts/csp-consistency.test.ts 比对）。
  metas: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    {
      'http-equiv': 'Content-Security-Policy',
      content: buildCsp({ meta: true }),
    },
  ],
  links: faviconLinks('/umi-react-admin/'),
  base: '/umi-react-admin/',
  publicPath: '/umi-react-admin/',
});
