import { request } from '@umijs/max';

export interface LoginParams {
  name: string;
  password: string;
}

export interface CurrentUser {
  name: string;
  email: string;
  nickName?: string;
}

export interface LoginResult {
  token: string;
  user: CurrentUser;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  errorCode?: number;
}

/**
 * 登录。演示后端（mock）对任意用户名/密码放行；
 * 用户名 dontHaveAccess 为约定的「禁止访问」演示账号（可登录，但 canSeeAdmin 为 false）。
 */
export async function login(params: LoginParams): Promise<LoginResult> {
  const resp = await request<ApiResponse<LoginResult>>('/api/v1/login', { method: 'POST', data: params });
  return resp.data;
}

/** 退出登录，best-effort：失败不影响本地登出流程 */
export async function logout(): Promise<void> {
  await request('/api/v1/logout', { method: 'POST', skipErrorHandler: true });
}

/** 用本地 token 换取当前登录用户，token 无效时后端返回 401 */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const resp = await request<ApiResponse<CurrentUser>>('/api/v1/currentUser');
  return resp.data;
}
