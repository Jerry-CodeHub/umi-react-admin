// 参考文档 https://umijs.org/docs/max/access
import type { AppInitialState } from './utils/Auth/initialState';

// 参数是全局初始状态（未登录时为 undefined），不是表格用的 API.UserInfo
export default (initialState: AppInitialState | undefined) => {
  // 白名单式（审计 2026-09-22 M-1）：只有携带 role === 'admin' 声明的用户才有管理权限，
  // undefined/其他角色一律拒绝。真实后端必须由服务端返回 role 字段——
  // 不要改回用户名黑名单（'dontHaveAccess' 只是演示签发方的降权约定，见 demoToken.ts），
  // 前端 access 只是 UX 层，真正的权限校验必须在后端接口完成。
  const canSeeAdmin = initialState?.role === 'admin';
  return {
    canSeeAdmin,
  };
};
