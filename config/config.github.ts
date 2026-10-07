import { defineConfig } from '@umijs/max';
import { addChunkGraph } from './chunkGraph';
import { buildCsp } from './csp';
import { configureSplitChunks } from './splitChunks';
// import { routes } from './routes';

export default defineConfig({
  // 与 config.ts 同源：UMI_ENV=github 时本函数整体覆盖 config.ts 的 chainWebpack
  chainWebpack(config) {
    if (process.env.NODE_ENV === 'production') {
      configureSplitChunks(config);
      addChunkGraph(config);
    }
  },
  define: {
    CESIUM_BASE_URL: '/umi-react-admin/Cesium',
    CESIUM_ION_TOKEN: process.env.CESIUM_ION_TOKEN,
    PUBLIC_PATH: '/umi-react-admin/',
    UMI_APP_API_BASE: process.env.UMI_APP_API_BASE,
    AMAP_KEY: process.env.AMAP_KEY,
    AMAP_SECURITY_CODE: process.env.AMAP_SECURITY_CODE,
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
  favicons: ['/umi-react-admin/favicon.ico'],
  base: '/umi-react-admin/',
  publicPath: '/umi-react-admin/',
});
