import { AUTH_TOKEN_KEY } from '@/constants';
import { request } from '@umijs/max';
import { UserInfo } from './userInfo';

export type ThemeMode = 'light' | 'realDark';

/** 全局初始状态：用户信息 + 主题（主题随 localStorage 持久化，与 app.tsx 的 antd 初始算法同源） */
export type AppInitialState = UserInfo & { theme?: ThemeMode };

export const THEME_STORAGE_KEY = 'umi_theme';

export const readTheme = (): ThemeMode =>
  typeof window !== 'undefined' && localStorage.getItem(THEME_STORAGE_KEY) === 'realDark' ? 'realDark' : 'light';

/**
 * 全局初始状态：有 token 则向后端换取当前用户；无 token 或换取失败返回 undefined，
 * 由路由守卫（app.tsx childrenRender 内 AuthGuard）引导至登录页。
 * 失败时 token 已被清除（401 分支由全局 errorHandler 提示并跳转）。
 */
export async function getInitialState(): Promise<AppInitialState | undefined> {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const theme = readTheme();
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    return undefined;
  }

  try {
    const resp = await request<{ data: { name: string; email: string; nickName?: string } }>('/api/v1/currentUser');
    return { ...new UserInfo(resp.data), theme };
  } catch {
    // token 失效/伪造：清除并回落到未登录态
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return undefined;
  }
}
