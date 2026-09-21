import { AUTH_TOKEN_KEY } from '@/constants';
import { request } from '@umijs/max';
import { UserInfo } from './userInfo';

/**
 * 全局初始状态：有 token 则向后端换取当前用户；无 token 或换取失败返回 undefined，
 * 由路由守卫（src/wrappers/auth.tsx）引导至登录页。
 * 失败时 token 已被清除（401 分支由全局 errorHandler 提示并跳转）。
 */
export async function getInitialState(): Promise<UserInfo | undefined> {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    return undefined;
  }

  try {
    const resp = await request<{ data: { name: string; email: string; nickName?: string } }>('/api/v1/currentUser');
    return new UserInfo(resp.data);
  } catch {
    // token 失效/伪造：清除并回落到未登录态
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return undefined;
  }
}
