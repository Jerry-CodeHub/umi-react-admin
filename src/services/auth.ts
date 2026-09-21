import { AUTH_TOKEN_KEY } from '@/constants';
import { request } from '@umijs/max';
import { USE_BACKEND } from './demo/mode';

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
 * 演示 token 约定：`${name}-demo-token`，与 mock/userAPI.ts 保持一致。
 * 纯静态托管（GitHub Pages / Vercel / Docker）没有后端，鉴权在前端本地完成（见 ./demo/mode.ts）；
 * 这只是演示桩，接入真实后端时配置 UMI_APP_API_BASE 即走下方的 HTTP 接口。
 */
const DEMO_TOKEN_SUFFIX = '-demo-token';

const toDemoUser = (name: string): CurrentUser => ({ name, nickName: name, email: '' });

/**
 * 登录。演示环境对任意用户名/密码放行；
 * 用户名 dontHaveAccess 为约定的「禁止访问」演示账号（可登录，但 canSeeAdmin 为 false）。
 */
export async function login(params: LoginParams): Promise<LoginResult> {
  if (!USE_BACKEND) {
    return { token: `${params.name}${DEMO_TOKEN_SUFFIX}`, user: toDemoUser(params.name) };
  }
  const resp = await request<ApiResponse<LoginResult>>('/api/v1/login', { method: 'POST', data: params });
  return resp.data;
}

/** 退出登录，best-effort：失败不影响本地登出流程（skipErrorHandler：不弹全局错误提示） */
export async function logout(): Promise<void> {
  if (!USE_BACKEND) {
    return;
  }
  await request('/api/v1/logout', { method: 'POST', skipErrorHandler: true });
}

/**
 * 用本地 token 换取当前登录用户；token 无效时抛错，由调用方（getInitialState）回落到未登录态。
 * 应用启动时调用：skipErrorHandler 让失效 token 静默处理，由路由守卫引导回登录页。
 */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  if (!USE_BACKEND) {
    const token = typeof window === 'undefined' ? '' : localStorage.getItem(AUTH_TOKEN_KEY) || '';
    const name = token.endsWith(DEMO_TOKEN_SUFFIX) ? token.slice(0, -DEMO_TOKEN_SUFFIX.length) : '';
    if (!name) {
      throw new Error('演示 token 无效或已失效');
    }
    return toDemoUser(name);
  }
  const resp = await request<ApiResponse<CurrentUser>>('/api/v1/currentUser', { skipErrorHandler: true });
  return resp.data;
}
