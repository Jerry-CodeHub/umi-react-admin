// 全局类型声明（与 config.ts / config.github.ts 的 define 块一一对应）

// Cesium Ion Token（可选：未配置时 Cesium 回退自带默认 token）
declare const CESIUM_ION_TOKEN: string | undefined;
declare const CESIUM_BASE_URL: string;

// 站点资源根路径（主产线 '/'，GitHub Pages '/umi-react-admin/'）
declare const PUBLIC_PATH: string;

// 真实后端 API 地址（可选，未配置时 dev 走 umi mock、生产演示走静态数据）
declare const UMI_APP_API_BASE: string | undefined;

interface Window {
  Cesium?: typeof import('cesium');
}
