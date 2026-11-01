/**
 * Vercel Function：/api/* 的失败闭合入口（F6，审查 2026-10）。
 *
 * 问题：vercel.json 的 SPA 回退 "/(.*)" -> "/index.html" 会把 /api/* 变成 200 的 SPA HTML，
 * 前端请求层会把 HTML 当作接口响应解析（错误被掩盖）。Vercel 的 rewrites 不能表达状态码，
 * 所以 /api/* 需要一个真正返回 404/503 的函数（这就是本文件存在的原因）。
 *
 * 契约（三条产线一致，回归见 scripts/deploy-routing.test.ts）：
 * - 未配置后端（API_ORIGIN 为空）=> 503 + JSON；显式说明没有后端，绝不回 SPA HTML；
 * - 配置 API_ORIGIN => 只代理 /api/v1/*（前端同源契约，见 src/utils/Auth/apiBoundary.ts），
 *   浏览器始终只与本域名通信，保持同源代理语义；
 * - 其他路径、编码绕过、跨段路径 => 404 + JSON，不做任意转发（避免把函数变成开放代理）。
 *
 * 运行时影响（部署者必须知道）：/api 流量全部经过 Serverless Function——冷启动延迟、
 * 请求体上限（约 4.5 MB）、执行时长上限、响应不做流式转发；高流量后端应改用平台级网关。
 * 需要完全绕开时：删除本目录，并把 vercel.json 里 /api 规则指向真实网关（或设置 API_ORIGIN）。
 *
 * 路由说明：Vercel 先查文件系统（静态文件与函数）再应用 rewrites，因此 api/ 下的通配函数是
 * /api/* 的实际入口；vercel.json 里的 /api 规则是防漂移兜底，两者都不能回落到 index.html。
 */
const { Readable } = require('node:stream');

const JSON_TYPE = 'application/json; charset=utf-8';
/** vercel.json 里 /api 规则的目的地：函数未命中时也要落在这个闭合失败路径上 */
const UNCONFIGURED_ENTRY = '/api/not-configured';
const PROXY_TIMEOUT_MS = 15000;

const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];
const REQUEST_SKIP = new Set([...HOP_BY_HOP, 'host', 'content-length', 'accept-encoding']);
const RESPONSE_SKIP = new Set([...HOP_BY_HOP, 'content-encoding', 'content-length']);

/** 与 src/utils/Auth/apiBoundary.ts 的 resolveApiUrl 同一套约束：只放行同源 /api/v1/ 下的字面路径 */
const API_V1_PREFIX = '/api/v1/';
const INVALID_PATH = /[\\\u0000-\u0020\u007f]/;
const ENCODED_BYPASS = /%(?:2f|5c|25|2e|0[0-9a-f]|1[0-9a-f]|7f)/i;

const isApiV1Path = (pathname) =>
  pathname.startsWith(API_V1_PREFIX) &&
  !pathname.includes('//') &&
  !INVALID_PATH.test(pathname) &&
  !ENCODED_BYPASS.test(pathname) &&
  !pathname.split('/').some((segment) => segment === '.' || segment === '..');

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('content-type', JSON_TYPE);
  // 未配置/不可达是部署状态，不是资源内容：不缓存，避免 CDN 把 503 钉住
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
};

/** API_ORIGIN 必须是 http(s) 源，不带凭据/查询/片段；未配置与配置非法都闭合失败 */
const resolveBackend = () => {
  const raw = (process.env.API_ORIGIN || '').trim();
  if (!raw) return { error: 'backend_not_configured' };
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      return { error: 'backend_misconfigured' };
    }
    // 公网部署（production 与 preview）拒绝环回/私网/保留地址（与全站服务端请求约束一致）：
    // API_ORIGIN 被污染成内网地址时不得把函数变成内网探测跳板。
    // 本地/CI 测试用 127.0.0.1 起真实上游验证代理语义，故仅公网部署启用
    const host = url.hostname.toLowerCase();
    const isLoopback = host === 'localhost' || host === '::1' || host === '[::1]' || host.endsWith('.localhost');
    const isPrivateIpv4 =
      /^(\d{1,3}\.){3}\d{1,3}$/.test(host) &&
      (() => {
        const [a, b] = host.split('.').map(Number);
        return (
          a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0 || a >= 224
        );
      })();
    // IPv6 ULA（fc00::/7）必然含 ':'：此前用 startsWith('fc')/startsWith('fd') 会把
    // fcms.example.com 这类公网域名误判成链路本地并拒绝
    const isLinkLocal = host.startsWith('169.254.') || host.startsWith('fe80:') || /^f[cd][0-9a-f]*:/.test(host);
    // preview 部署同样公网可达（此前只有 production 拒绝内网地址，preview 可被当内网探测跳板）
    const isProduction =
      process.env.VERCEL_ENV === 'production' ||
      process.env.VERCEL_ENV === 'preview' ||
      process.env.NODE_ENV === 'production';
    if (isProduction && (isLoopback || isPrivateIpv4 || isLinkLocal)) {
      return { error: 'backend_misconfigured' };
    }
    return { url: url.href.endsWith('/') ? url : new URL(`${url.href}/`) };
  } catch {
    return { error: 'backend_misconfigured' };
  }
};

/** Vercel 对可解析的请求体已填充 req.body；其余情况（multipart/流式）交给原始流 */
const requestBody = (req, method) => {
  if (method === 'GET' || method === 'HEAD') return undefined;
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) return req.body;
    return JSON.stringify(req.body);
  }
  return typeof req.pipe === 'function' ? Readable.toWeb(req) : undefined;
};

const proxy = async (req, res, backend, requestUrl) => {
  const method = (req.method || 'GET').toUpperCase();
  const forwarded = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (!value || REQUEST_SKIP.has(key.toLowerCase())) continue;
    forwarded.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  const init = {
    method,
    headers: forwarded,
    redirect: 'manual',
    signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
  };
  const body = requestBody(req, method);
  if (body !== undefined) {
    init.body = body;
    if (typeof body !== 'string' && !Buffer.isBuffer(body)) init.duplex = 'half';
  }
  const target = new URL(requestUrl.pathname.slice(1) + requestUrl.search, backend.url);
  try {
    const upstream = await fetch(target, init);
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (!RESPONSE_SKIP.has(key)) res.setHeader(key, value);
    });
    // 多个 Set-Cookie 必须用数组下发，Headers#forEach 会把它们合并成一条
    const cookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
    if (cookies.length) res.setHeader('set-cookie', cookies);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    if (res.headersSent) {
      res.destroy();
      return;
    }
    const timeout = error instanceof Error && error.name === 'TimeoutError';
    sendJson(res, timeout ? 504 : 502, {
      error: timeout ? 'backend_timeout' : 'backend_unreachable',
      message: 'API backend did not return a usable response',
    });
  }
};

const handler = async (req, res) => {
  let requestUrl;
  try {
    requestUrl = new URL(req.url || '/api', 'http://function.local');
  } catch {
    sendJson(res, 404, { error: 'not_found', message: 'API requests must use a path under /api/v1/' });
    return;
  }
  const backend = resolveBackend();
  if (requestUrl.pathname === UNCONFIGURED_ENTRY) {
    sendJson(res, 503, {
      error: 'backend_not_configured',
      message: 'No API backend is configured for this deployment; set API_ORIGIN to proxy /api/v1/*',
    });
    return;
  }
  if (!isApiV1Path(requestUrl.pathname)) {
    sendJson(res, 404, { error: 'not_found', message: 'API requests must use a path under /api/v1/' });
    return;
  }
  if (!backend.url) {
    sendJson(res, 503, {
      error: backend.error,
      message: 'No API backend is configured for this deployment; set API_ORIGIN to proxy /api/v1/*',
    });
    return;
  }
  await proxy(req, res, backend, requestUrl);
};

module.exports = handler;
