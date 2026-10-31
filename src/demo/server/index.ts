/**
 * 演示后端：一个跑在浏览器里的 REST 服务（路由表见 ./routes.ts）。
 * 请求层在演示模式下经 axios adapter 把请求交给 handle()（见 src/demo/adapter.ts），
 * dev、preview 与各静态部署走的是同一套实现，不再区分 umi mock 与前端本地实现两条链路。
 */
import type { DemoLocale } from '../generate';
import { DemoStore, type StorageLike } from '../store';
import { verifyDemoToken } from '../token';
import { BizFailure, HttpError, type DemoRequest, type DemoResponse } from './http';
import { message } from './messages';
import { PROTECTED_USERNAMES, resolvePermissions, routes, type Route, type Session } from './routes';

export type { DemoRequest, DemoResponse } from './http';

type CompiledRoute = Route & { pattern: RegExp; keys: string[] };

const compiled: CompiledRoute[] = routes.map((route) => {
  const keys: string[] = [];
  const source = route.path.replace(/:(\w+)/g, (_, key: string) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { ...route, pattern: new RegExp(`^${source}$`), keys };
});

const parseBody = (body: unknown): Record<string, unknown> => {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
};

export const createDemoServer = (options: { locale: DemoLocale; storage?: StorageLike; now?: () => Date }) => {
  const store = new DemoStore(options);
  const { locale } = options;

  /**
   * 会话 → 生效权限（F02 核心）：每次请求都按「用户记录的角色 → 角色权限记录」现算
   * （resolvePermissions），不进 token、不缓存——角色权限被修改后，已有会话与重新登录的
   * 会话立即执行同一份权限。
   */
  const resolveSession = (authorization?: string): Session | undefined => {
    // match 而非 regex.exec：exec 与 child_process.exec 同名会被安全扫描误判为命令注入 sink
    const matched = (authorization ?? '').match(/^Bearer (.+)$/);
    const payload = matched ? verifyDemoToken(matched[1]) : null;
    if (!payload) return undefined;
    const user = store.dataset.users.find((u) => u.username.toLowerCase() === payload.name.toLowerCase());
    // 种子用户被停用后，已签发的 token 随之失效；被删除同理——否则 admin 种子账号删除后
    // 其 token 会走「无用户记录」路径，继续保留 admin 角色全部权限
    if (user && user.status !== 'active') return undefined;
    if (!user && PROTECTED_USERNAMES.has(payload.name.toLowerCase())) return undefined;
    return {
      username: payload.name,
      role: payload.role,
      user,
      ...resolvePermissions(store.dataset, user, payload.role),
    };
  };

  /** 路径参数解码：畸形百分号编码（如 /tickets/%E4%25）按 400 响应，而不是抛裸 URIError 逃过异常分类 */
  const decodeParam = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      throw new HttpError(400, message('notFound', locale));
    }
  };

  const handle = (request: DemoRequest): DemoResponse => {
    const method = request.method.toUpperCase();
    const url = new URL(request.url, 'http://demo.local');
    const route = compiled.find((r) => r.method === method && r.pattern.test(url.pathname));
    try {
      if (!route) throw new HttpError(404, message('notFound', locale));
      // 时钟推进检查（F09）：live 模式下跨过阈值按当前时间重建基础数据（补丁保留）；受控模式时钟冻结不会触发
      store.refreshIfStale();
      const values = url.pathname.match(route.pattern)!.slice(1);
      const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeParam(values[i])]));
      const query = { ...Object.fromEntries(url.searchParams), ...(request.params ?? {}) };
      const session = resolveSession(request.headers?.Authorization ?? request.headers?.authorization);
      if (route.access !== 'public' && !session) throw new HttpError(401, message('unauthorized', locale));
      if (route.access && route.access !== 'public' && !session!.permissions.includes(route.access)) {
        throw new HttpError(403, message('forbidden', locale));
      }
      const data = route.handle({ params, query, body: parseBody(request.body), store, session, locale });
      return { status: 200, body: { success: true, data: data ?? null, errorCode: 0 } };
    } catch (error) {
      if (error instanceof HttpError) {
        return {
          status: error.status,
          body: { success: false, data: null, errorCode: error.status, message: error.message },
        };
      }
      if (error instanceof BizFailure) {
        return {
          status: 200,
          body: { success: false, data: null, errorCode: error.errorCode, message: error.message },
        };
      }
      throw error;
    }
  };

  return { handle, store };
};

export type DemoServer = ReturnType<typeof createDemoServer>;
