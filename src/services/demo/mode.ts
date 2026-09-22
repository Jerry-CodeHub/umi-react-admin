/**
 * 演示数据层运行模式（鉴权 services/auth.ts 与用户表格 userService.ts 共用）：
 * - dev（umi mock）或配置了 UMI_APP_API_BASE（真实后端）→ 走 HTTP 接口；
 * - 其余生产构建（GitHub Pages / Vercel / Docker 等纯静态托管）→ 走前端本地演示实现。
 *
 * 注意：`max preview` 虽然自带 mock，但预览的是生产构建，按此规则同样走本地实现，
 * 与真实的纯静态托管行为一致，不会再被 mock 掩盖。
 */
export const USE_BACKEND = process.env.NODE_ENV === 'development' || !!UMI_APP_API_BASE;
