/**
 * 发版后的「旧 chunk 丢失」识别与自愈。
 *
 * gh-pages 以 force_orphan 整树替换部署、nginx/Vercel 也只保留当前版本的带哈希文件：
 * 已打开的旧页面切到懒加载路由时，会去请求已经不存在的旧 chunk（webpack 抛 ChunkLoadError）。
 * 这不是代码错误，刷新一次换到新版本即可恢复。
 */
const RELOAD_KEY = 'umi-react-admin:chunk-reload-at';
/** 该时间窗内只自动刷新一次：真正的网络故障（离线、CDN 故障）不会陷入刷新循环 */
const RELOAD_WINDOW_MS = 60_000;

const CHUNK_ERROR_PATTERN =
  /Loading (?:CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i;

export const isChunkLoadError = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'ChunkLoadError' || CHUNK_ERROR_PATTERN.test(error.message));

/**
 * 判断并登记一次自动刷新；返回 true 表示调用方应执行刷新。
 * sessionStorage 不可用（隐私模式等）时不自动刷新，交给用户手动点按钮。
 */
export const claimAutoReload = (storage: Pick<Storage, 'getItem' | 'setItem'>, now = Date.now()): boolean => {
  try {
    const last = Number(storage.getItem(RELOAD_KEY) || 0);
    if (now - last < RELOAD_WINDOW_MS) {
      return false;
    }
    storage.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
};
