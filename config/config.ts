import { defineConfig } from '@umijs/max';
import { routes } from './routes';
import { configureSplitChunks } from './splitChunks';

// Clarity 统计默认不加载：配置 CLARITY_ID 环境变量后按部署者自己的项目上报
// （原 public/js/clarity.js 硬编码作者私有项目 ID，下游部署无感知上报访客数据，已删除）
const CLARITY_ID = process.env.CLARITY_ID;

export default defineConfig({
  chainWebpack(config) {
    if (process.env.NODE_ENV === 'production') {
      configureSplitChunks(config);
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
    TINYMCE_API_KEY: process.env.TINYMCE_API_KEY,
  },
  headScripts: CLARITY_ID ? [{ src: `https://www.clarity.ms/tag/${CLARITY_ID}`, async: true }] : [],
  jsMinifier: 'terser',
  // 开启 valtio 数据流方案 https://umijs.org/docs/max/valtio
  valtio: {},
  antd: {
    theme: {},
    appConfig: {},
  },
  access: {},
  model: {},
  initialState: {},
  request: {},
  layout: {},
  // @umijs/max 内置了 styled-components 样式方案。
  // https://umijs.org/docs/max/styled-components
  styledComponents: {},
  // 路由配置
  routes,
  npmClient: 'pnpm',
  // 多语言配置 https://umijs.org/docs/max/i18n
  locale: {
    // 默认使用 src/locales/zh-CN.ts 作为多语言文件
    default: 'zh-CN',
    baseSeparator: '-',
  },
  tailwindcss: {},
  lessLoader: {
    modifyVars: {
      'root-entry-name': 'default',
    },
  },
  esbuildMinifyIIFE: true, // 开启 esbuild 压缩
});
