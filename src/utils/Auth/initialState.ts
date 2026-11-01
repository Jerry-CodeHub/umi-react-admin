import { DEMO_MODE } from '@/demo/mode';
import { fetchCurrentUser } from '@/services/auth';
import { clearDemoToken, readDemoToken, removeLegacyToken } from './session';
import { UserInfo } from './userInfo';

export type ThemeMode = 'light' | 'realDark';

/** 全局初始状态：用户信息 + 主题（主题随 localStorage 持久化，与 app.tsx 的 antd 初始算法同源） */
export type AppInitialState = UserInfo & { theme?: ThemeMode };

export const THEME_STORAGE_KEY = 'umi_theme';

export const readTheme = (): ThemeMode => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem(THEME_STORAGE_KEY) === 'realDark'
      ? 'realDark'
      : 'light';
  } catch {
    return 'light';
  }
};

/**
 * 真实模式直接查询服务端会话（JS 无法读取 HttpOnly Cookie）；演示模式需要本标签页的 token。
 * 换取失败返回 undefined，由路由守卫（app.tsx childrenRender 内 AuthGuard）引导至登录页。
 */
export async function getInitialState(): Promise<AppInitialState | undefined> {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const theme = readTheme();
  removeLegacyToken();
  if (!DEMO_MODE) clearDemoToken();
  if (DEMO_MODE && !readDemoToken()) {
    return undefined;
  }

  try {
    const user = await fetchCurrentUser();
    return { ...new UserInfo(user), theme };
  } catch (error) {
    // 会话失效（401 / success:false 业务失败）与网络故障分流：后者不清演示 token——
    // 网络抖动把有效会话误判成「过期」并销毁 token，恢复后还得重新登录。
    // BizError 用 name 判定而不是 instanceof：这里刻意不 import 它（会拖进 i18n→@umijs/max
    // 整条链，bootstrap 测试的 jsdom 环境装不下），且 vi.resetModules 下跨模块实例 instanceof 不可靠
    const response = error instanceof Object && 'response' in error ? (error as { response?: unknown }).response : null;
    const authFailed =
      (error instanceof Error && error.name === 'BizError') ||
      (response instanceof Object && (response as { status?: unknown }).status === 401);
    if (authFailed) clearDemoToken();
    return undefined;
  }
}
