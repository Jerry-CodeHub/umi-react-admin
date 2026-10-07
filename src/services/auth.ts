import type { DemoRole } from '@/demo/token';
import { api } from './client';

export interface LoginParams {
  name: string;
  password: string;
}

export interface CurrentUser {
  /** 登录名 */
  name: string;
  email: string;
  /** 显示名 */
  nickName?: string;
  /** 角色声明：access 权限消费它（canSeeAdmin = role === 'admin'）。真实后端必须由服务端返回 */
  role?: DemoRole;
}

export interface LoginResult {
  token: string;
  user: CurrentUser;
}

/**
 * 登录。演示模式下由浏览器内的演示后端签发 token（见 src/demo/server/routes.ts：
 * admin / guest 等种子账号按其角色签发，其余任意用户名放行；密码不校验）。
 */
export const login = (params: LoginParams) => api<LoginResult>('/api/v1/login', { method: 'POST', data: params });

/** 退出登录，best-effort：失败不影响本地登出流程（skipErrorHandler：不弹全局错误提示） */
export const logout = () => api<null>('/api/v1/logout', { method: 'POST', skipErrorHandler: true });

/**
 * 用本地 token 换取当前登录用户；token 无效时抛错，由调用方（getInitialState）回落到未登录态。
 * 应用启动时调用：skipErrorHandler 让失效 token 静默处理，由路由守卫引导回登录页。
 */
export const fetchCurrentUser = () => api<CurrentUser>('/api/v1/currentUser', { skipErrorHandler: true });
