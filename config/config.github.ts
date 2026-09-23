import { defineConfig } from '@umijs/max';
import { addChunkGraph } from './chunkGraph';
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
  },
  // umi 对 metas 数组为整体覆盖（不与 config.ts 逐项合并），viewport 需一并带上。
  // meta CSP（审计 2026-09-22 H-3）：GitHub Pages 无法自定义响应头，只能走 meta；
  // meta 版不支持 frame-ancestors（点击劫持防护为平台限制，README 已声明）与 report-only。
  // 来源清单与 nginx/security-headers.conf、vercel.json 保持一致（后者含 frame-ancestors）。
  metas: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    {
      'http-equiv': 'Content-Security-Policy',
      content:
        "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; " +
        "script-src 'self' 'unsafe-eval' https://*.amap.com; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob: https://gw.alipayobjects.com https://img.alicdn.com https://*.amap.com https://*.autonavi.com " +
        'https://tile.openstreetmap.org https://ion.cesium.com https://api.cesium.com https://assets.ion.cesium.com https://*.virtualearth.net; ' +
        "connect-src 'self' blob: https://*.amap.com https://*.autonavi.com https://ion.cesium.com https://api.cesium.com https://assets.ion.cesium.com https://*.virtualearth.net; " +
        "font-src 'self' data:; media-src 'self' https://sf1-cdn-tos.huoshanstatic.com; " +
        "worker-src 'self' blob:; frame-src 'self'",
    },
  ],
  favicons: ['/umi-react-admin/favicon.ico'],
  base: '/umi-react-admin/',
  publicPath: '/umi-react-admin/',
});
