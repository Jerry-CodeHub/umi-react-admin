import { defineConfig } from '@umijs/max';
import path from 'path';
import { resolveAuthConfig } from './auth';
import { BUILD_INFO, addVersionFile } from './buildInfo';
import { addChunkGraph } from './chunkGraph';
import { buildCsp } from './csp';
import { faviconLinks } from './favicons';
import { routes } from './routes';
import { configureSplitChunks } from './splitChunks';
import { keepUrlAssetsVerbatim } from './urlAssets';

// 统计接入须同时具备用户同意、内容遮蔽和匹配的 CSP，模板没有这些集成时拒绝加载。
const CLARITY_ID = process.env.CLARITY_ID;
const AUTH_CONFIG = resolveAuthConfig(process.env);
if (CLARITY_ID)
  throw new Error(
    'Unsupported CLARITY_ID: the template ships no analytics; integration needs consent masking and a reviewed CSP',
  );

// 演示必须显式启用；真实模式缺失 API 配置由 resolveAuthConfig 阻止生产构建。
if (process.env.NODE_ENV === 'production' && AUTH_CONFIG.demoMode) {
  console.warn(
    [
      '',
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
      '!!                                                           !!',
      '!!   本构建使用纯前端演示鉴权：任意用户名/密码均可登录        !!',
      '!!   （详见 SECURITY.md「已知限制」）                         !!',
      '!!                                                           !!',
      '!!   真实接入：关闭演示并设置同源 UMI_APP_API_BASE           !!',
      '!!   下游二开请在面向公网部署前完成接入                       !!',
      '!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!',
      '',
    ].join('\n'),
  );
}

export default defineConfig({
  /**
   * 真实模式：演示 adapter / 演示 token 的静态 import 指向替身（见 src/demo/*.real.ts）。
   *
   * - '@/demo/adapter'：requestConfig.ts 顶层 import，adapter 又静态 import './clock' 与 './store'，
   *   store → generate → scenarios 会把整份演示数据生成器（固定场景 ID 与补丁存储键）
   *   拖进入口 chunk；真实模式虽不接线，但模块副作用使打包器无法删除这条链。
   * - '@/demo/token'：services/auth.ts 顶层 import，调用点在 `if (DEMO_MODE)` 里；DEMO_MODE 经
   *   模块命名空间读取（产物中是 `ne.G`），压缩器无法判定该分支为死代码，演示 token 模块
   *   （含 'demo.' 前缀字面量）因此留在真实模式入口 chunk，实测确认后才加的第二个替身。
   * - '@/demo/clock'：src/utils/now.ts 顶层 import。不加替身时 Signature / Tickets / Alarms 的
   *   懒加载 chunk 会带上演示时钟与存储键 'umi-react-admin:demo-clock'——若同一 origin 冻结过
   *   演示时钟，真实模式下 nowMs() 会继续返回旧锚点（SLA/持续时长按错误时间计算）。
   *   替身恒返回系统时间（见 src/demo/clock.real.ts），哨兵由 real-mode-artifact.test.ts 断言。
   *
   * 键写成完整路径：preset-umi 的 configPlugins 把用户 alias 展开在内置 '@' 之前
   * （memo.alias = { ...memo.alias, '@': absSrcPath }），完整键精确命中，不依赖前缀匹配顺序。
   * 演示构建（build:demo / build:github:demo）保持原路径，vitest 与 tsc 也不受影响。
   */
  alias: AUTH_CONFIG.demoMode
    ? {}
    : {
        '@/demo/adapter': path.resolve(__dirname, '../src/demo/adapter.real.ts'),
        '@/demo/token': path.resolve(__dirname, '../src/demo/token.real.ts'),
        '@/demo/clock': path.resolve(__dirname, '../src/demo/clock.real.ts'),
      },
  chainWebpack(config) {
    keepUrlAssetsVerbatim(config);
    if (process.env.NODE_ENV === 'production') {
      configureSplitChunks(config);
      addChunkGraph(config);
      addVersionFile(config, { demoMode: AUTH_CONFIG.demoMode });
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
    CESIUM_ION_TOKEN: process.env.CESIUM_ION_TOKEN || '',
    // 站点资源根路径：主产线 '/'，GitHub Pages 产线见 config.github.ts（'/umi-react-admin/'）。
    // 页面内引用 public 资源一律经 PUBLIC_PATH 拼接，保证两条产线可用。
    PUBLIC_PATH: '/',
    // 以下变量经 define 显式注入（umi 仅自动注入 UMI_APP_* 前缀，未显式声明的
    // process.env.X 会原样进入浏览器包并在模块初始化时抛 ReferenceError）
    UMI_APP_API_BASE: AUTH_CONFIG.apiBase,
    UMI_APP_DEMO_MODE: AUTH_CONFIG.demoMode,
    // 高德 Web 端（JS API）Key 与安全密钥（审计 2026-09-22 M-6）：
    // 未配置时不加载第三方 SDK，也不使用组件库内置的共享 key。
    AMAP_KEY: process.env.AMAP_KEY || '',
    AMAP_SECURITY_CODE: process.env.AMAP_SECURITY_CODE || '',
    // 构建信息（页脚与 dist/version.json 同源，见 ./buildInfo.ts）
    BUILD_INFO,
  },
  // index.html 的初始标题（分享卡片、首帧标签页）；进入应用后由 src/app.tsx 的 onRouteChange 按页面改写
  title: 'React Admin',
  // 覆盖 umi 默认的 viewport（user-scalable=no / maximum-scale=1 禁止缩放，违反 WCAG 1.4.4）
  metas: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ...(process.env.NODE_ENV === 'production'
      ? [{ 'http-equiv': 'Content-Security-Policy', content: buildCsp({ meta: true }) }]
      : []),
  ],
  // 站点图标（ICO + SVG + apple-touch-icon），GitHub Pages 产线见 config.github.ts
  links: faviconLinks('/'),
  headScripts: [],
  // 产物文件名带内容哈希：配合 nginx 对哈希文件的长缓存（nginx/default.conf），发版后不会命中旧脚本
  hash: true,
  // terser 而非 esbuild：产物里需要稳定的死代码消除与更细的压缩控制（切换时对比过体积）
  jsMinifier: 'terser',
  // 只注入 core-js 稳定特性（默认 `import 'core-js'` 会带上 176 个 esnext 提案 polyfill）。
  // umi 锁定的 core-js 3.34 中约 95 个提案实现带 forced:true，会强制覆盖浏览器原生实现，
  // 例如 Promise.try 被替换成不透传参数的旧提案版本 → pdfjs 5 按 URL 加载 PDF 时
  // 报 "Cannot set properties of undefined (setting 'onPull')"。
  // pdf.js 6 需要的 ES2026 方法（Map/WeakMap upsert、Math.sumPrecise）不在 core-js/stable 里，
  // 由 PDF 页在主线程与 worker 中按需补齐：src/pages/Document/Pdf/pdfjsPolyfills.mjs
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
  // ProLayout v3（pro-components 3）的菜单国际化默认关闭（getMenuData 取 menu.locale || false），
  // umi 模板把 layout.locale 透传为 menu.locale，这里显式开启
  layout: { locale: true },
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
  // MFSU eager 模式会扫描 src 下所有文件（含 *.test.ts）的 import，把 vitest 当成页面依赖预编译，
  // vitest → vite 引用 node:module，dev 每次启动都报 UnhandledSchemeError。测试依赖不进浏览器，排除即可
  mfsu: { exclude: ['vitest'] },
});
