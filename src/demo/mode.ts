/**
 * 演示模式：未配置真实后端（UMI_APP_API_BASE）时，所有接口由浏览器内的演示后端响应
 * （dev、preview、GitHub Pages / Vercel / Docker 等静态部署一律如此）。
 * 配置了 UMI_APP_API_BASE 后请求直连真实后端，演示后端代码不会被加载。
 */
export const DEMO_MODE = !UMI_APP_API_BASE;
