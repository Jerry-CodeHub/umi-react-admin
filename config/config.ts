import { defineConfig } from '@umijs/max';
import { BUILD_INFO, addVersionFile } from './buildInfo';
import { addChunkGraph } from './chunkGraph';
import { routes } from './routes';
import { configureSplitChunks } from './splitChunks';

// Clarity 统计默认不加载：配置 CLARITY_ID 环境变量后按部署者自己的项目上报
// （原 public/js/clarity.js 硬编码作者私有项目 ID，下游部署无感知上报访客数据，已删除）
const CLARITY_ID = process.env.CLARITY_ID;

// 演示鉴权防线（审计 2026-09-22 H-4）：生产构建未配置真实后端时，登录是纯前端演示桩
// （任意用户名/密码放行）。这里把「静默 fail-open」变为「构建期可见」——banner 无法被忽略。
// 不做硬阻断（build fail）：那会破坏模板 clone 即 build 的开箱体验。
if (process.env.NODE_ENV === 'production' && !process.env.UMI_APP_API_BASE) {
  console.warn(
    [
      '',
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
      '!!                                                           !!',
      '!!   本构建使用纯前端演示鉴权：任意用户名/密码均可登录        !!',
      '!!   （详见 SECURITY.md「已知限制」）                         !!',
      '!!                                                           !!',
      '!!   接入真实后端：设置 UMI_APP_API_BASE 后重新构建           !!',
      '!!   下游二开请在面向公网部署前完成接入                       !!',
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
      '',
    ].join('\n'),
  );
}

export default defineConfig({
  chainWebpack(config) {
    if (process.env.NODE_ENV === 'production') {
      configureSplitChunks(config);
      addChunkGraph(config);
      addVersionFile(config);
    }
  },
  copy: [
    {
      from: 'node_modules/pdfjs-dist/cmaps',
      to: 'dist/cmaps',
    },
    {
      from: 'node_modules/pdfjs-dist/standard_fonts',
      to: 'dist/standard_fonts',
    },
    {
      from: 'node_modules/cesium/LICENSE.md',
      to: 'dist/Cesium/LICENSE.md',
    },
    {
      from: 'node_modules/cesium/Build/Cesium/Workers',
      to: 'dist/Cesium/Workers',
    },
    {
      from: 'node_modules/cesium/Build/Cesium/ThirdParty',
      to: 'dist/Cesium/ThirdParty',
    },
    {
      from: 'node_modules/cesium/Build/Cesium/Assets',
      to: 'dist/Cesium/Assets',
    },
    {
      from: 'node_modules/cesium/Build/Cesium/Widgets',
      to: 'dist/Cesium/Widgets',
    },
  ],
  define: {
    CESIUM_BASE_URL: '/Cesium',
    CESIUM_ION_TOKEN: process.env.CESIUM_ION_TOKEN,
    // 站点资源根路径：主产线 '/'，GitHub Pages 产线见 config.github.ts（'/umi-react-admin/'）。
    // 页面内引用 public 资源一律经 PUBLIC_PATH 拼接，保证两条产线可用。
    PUBLIC_PATH: '/',
    // 以下变量经 define 显式注入（umi 仅自动注入 UMI_APP_* 前缀，未显式声明的
    // process.env.X 会原样进入浏览器包并在模块初始化时抛 ReferenceError）
    UMI_APP_API_BASE: process.env.UMI_APP_API_BASE,
    // 高德 Web 端（JS API）Key 与安全密钥（审计 2026-09-22 M-6）：
    // 可选——不配置时高德页面回落 @pansy/amap-api-loader 自带的公共 key（配额不受本项目控制）
    AMAP_KEY: process.env.AMAP_KEY,
    AMAP_SECURITY_CODE: process.env.AMAP_SECURITY_CODE,
    // 构建信息（页脚与 dist/version.json 同源，见 ./buildInfo.ts）
    BUILD_INFO,
  },
  // 覆盖 umi 默认的 viewport（user-scalable=no / maximum-scale=1 禁止缩放，违反 WCAG 1.4.4）
  metas: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  // SVG 图标（现代浏览器均支持），GitHub Pages 产线见 config.github.ts
  favicons: ['/logo.svg'],
  headScripts: CLARITY_ID ? [{ src: `https://www.clarity.ms/tag/${CLARITY_ID}`, async: true }] : [],
  // 产物文件名带内容哈希：配合 nginx 对哈希文件的长缓存（nginx/default.conf），发版后不会命中旧脚本
  hash: true,
  jsMinifier: 'terser',
  // 只注入 core-js 稳定特性（默认 `import 'core-js'` 会带上 176 个 esnext 提案 polyfill）。
  // umi 锁定的 core-js 3.34 中约 95 个提案实现带 forced:true，会强制覆盖浏览器原生实现，
  // 例如 Promise.try 被替换成不透传参数的旧提案版本 → pdfjs 5 按 URL 加载 PDF 时
  // 报 "Cannot set properties of undefined (setting 'onPull')"。
  polyfill: {
    imports: ['core-js/stable'],
  },
  antd: {
    theme: {},
    appConfig: {},
    // 挂载 ConfigProvider 上下文：useAntdConfigSetter 热切换主题算法的前提
    configProvider: {},
  },
  access: {},
  // 不用 umi mock：演示接口由浏览器内的演示后端响应（src/demo，经请求层 adapter 接入），
  // dev 与所有静态部署走同一套实现
  mock: false,
  model: {},
  initialState: {},
  request: {},
  layout: {},
  // 路由配置
  routes,
  npmClient: 'pnpm',
  // 多语言配置 https://umijs.org/docs/max/i18n
  locale: {
    // 默认 zh-CN；首次访问按浏览器语言选择（英文浏览器进来即英文界面），之后以用户在顶栏的选择为准
    default: 'zh-CN',
    baseNavigator: true,
    baseSeparator: '-',
  },
  tailwindcss: {},
  esbuildMinifyIIFE: true, // 开启 esbuild 压缩
  // MFSU eager 模式会扫描 src 下所有文件（含 *.test.ts）的 import，把 vitest 当成页面依赖预编译，
  // vitest → vite 引用 node:module，dev 每次启动都报 UnhandledSchemeError。测试依赖不进浏览器，排除即可
  mfsu: { exclude: ['vitest'] },
});
