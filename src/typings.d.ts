// 全局类型声明（与 config.ts / config.github.ts 的 define 块一一对应）

// Cesium Ion Token
declare const CESIUM_ION_TOKEN: string;
declare const CESIUM_BASE_URL: string;

// 站点资源根路径（主产线 '/'，GitHub Pages '/umi-react-admin/'）
declare const PUBLIC_PATH: string;

// 真实后端 API 地址（可选，未配置时 dev 走 umi mock、生产演示走静态数据）
declare const UMI_APP_API_BASE: string | undefined;

// 高德 Web 端 Key 与安全密钥（可选，见 config.ts define 注释）
declare const AMAP_KEY: string | undefined;
declare const AMAP_SECURITY_CODE: string | undefined;

interface Window {
  Cesium?: typeof import('cesium');
  /** AMap JS API 2.0 的安全密钥配置（必须在 JS API 脚本加载前设置） */
  _AMapSecurityConfig?: { securityJsCode: string };
}
