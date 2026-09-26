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
import { routes, type Route, type Session } from './routes';

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

  const resolveSession = (authorization?: string): Session | undefined => {
    const matched = /^Bearer (.+)$/.exec(authorization ?? '');
    const payload = matched ? verifyDemoToken(matched[1]) : null;
    if (!payload) return undefined;
    const user = store.dataset.users.find((u) => u.username.toLowerCase() === payload.name.toLowerCase());
    // 种子用户被停用后，已签发的 token 随之失效
    if (user && user.status !== 'active') return undefined;
    return { username: payload.name, role: payload.role, user };
  };

  const handle = (request: DemoRequest): DemoResponse => {
    const method = request.method.toUpperCase();
    const url = new URL(request.url, 'http://demo.local');
    const route = compiled.find((r) => r.method === method && r.pattern.test(url.pathname));
    try {
      if (!route) throw new HttpError(404, message('notFound', locale));
      const values = route.pattern.exec(url.pathname)!.slice(1);
      const params = Object.fromEntries(route.keys.map((key, i) => [key, decodeURIComponent(values[i])]));
      const query = { ...Object.fromEntries(url.searchParams), ...(request.params ?? {}) };
      const session = resolveSession(request.headers?.Authorization ?? request.headers?.authorization);
      if (route.access !== 'public' && !session) throw new HttpError(401, message('unauthorized', locale));
      if (route.access === 'admin' && session?.role !== 'admin') throw new HttpError(403, message('forbidden', locale));
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
