/**
 * 演示 token 的签发与校验（services/auth.ts 本地实现与 mock/userAPI.ts 共用）。
 *
 * ⚠️ 仅限演示：token 在前端本地签发、本地校验，无任何密码学保护——
 * 任何能在浏览器里写 localStorage 的人都可以给自己签发任意身份。
 * 真实后端必须由服务端签发与校验会话（JWT / opaque session + 服务端状态），
 * 把本文件的约定搬进真实后端等于接受「任何人都可构造的万能凭证」。
 *
 * 形状：`demo.` + encodeURIComponent(JSON({ name, role, ts }))
 * - 明文 JSON：演示 token 无需遮掩，可读性优先；encodeURIComponent 保证 ASCII 与分隔安全
 * - ts：签发时间戳，7 天过期（见 DEMO_TOKEN_TTL_MS），避免演示 token 永久有效
 * - role 编码进 token：权限演示账号（dontHaveAccess）登录后即固定为 user，
 *   不再从用户名现推（access.ts 消费服务端/签发方声明的角色，见 M-1）
 */

export type DemoRole = 'admin' | 'user';

export const DEMO_TOKEN_PREFIX = 'demo.';
export const DEMO_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 演示约定：该用户名可登录但无管理权限（canSeeAdmin 为 false），用于演示路由权限拦截 */
export const isRestrictedDemoName = (name: string) => name === 'dontHaveAccess';

export const demoRoleFor = (name: string): DemoRole => (isRestrictedDemoName(name) ? 'user' : 'admin');

export interface DemoTokenPayload {
  name: string;
  role: DemoRole;
  ts: number;
}

export const issueDemoToken = (name: string, role: DemoRole = demoRoleFor(name)): string =>
  `${DEMO_TOKEN_PREFIX}${encodeURIComponent(JSON.stringify({ name, role, ts: Date.now() }))}`;

/** 校验并还原 token 载荷；形状不符、字段缺失或已过期返回 null */
export const verifyDemoToken = (token: string): DemoTokenPayload | null => {
  if (!token.startsWith(DEMO_TOKEN_PREFIX)) {
    return null;
  }
  try {
    const payload = JSON.parse(decodeURIComponent(token.slice(DEMO_TOKEN_PREFIX.length))) as Partial<DemoTokenPayload>;
    if (typeof payload.name !== 'string' || !payload.name) {
      return null;
    }
    if (payload.role !== 'admin' && payload.role !== 'user') {
      return null;
    }
    if (typeof payload.ts !== 'number' || Date.now() - payload.ts > DEMO_TOKEN_TTL_MS || payload.ts > Date.now()) {
      return null;
    }
    return { name: payload.name, role: payload.role, ts: payload.ts };
  } catch {
    return null;
  }
};
