// 全局类型声明

// Cesium Ion Token
declare const CESIUM_ION_TOKEN: string;
declare const CESIUM_BASE_URL: string;

interface Window {
  Cesium?: typeof import('cesium');
}
