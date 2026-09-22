// 产物 JWT 泄露扫描（审计 security-6：曾发生 token 经 define 注入构建产物并部署到 gh-pages）
// 用法：node scripts/check-dist-secrets.mjs [产物目录，默认 dist]（需先构建；CI 在构建后自动执行）
//
// 判定：CI 构建不注入任何 secret，产物里出现的 JWT 只可能是硬编码进源码或依赖的 token，一律判失败。
// 唯一例外是 Cesium 自带的公开默认 ion token（@cesium/engine 的 Source/Core/Ion.js，未配置 token 时兜底，
// 页面会提示正在使用默认 token），它随 Cesium 必然进入产物。白名单从已安装的源码动态读取：
// Cesium 升级换 token 不会误报；读取失败直接判失败，不会静默放行。
// 本地产物若经 .env.local 注入了自己的 CESIUM_ION_TOKEN，会被判为非白名单，这是预期行为。
// 输出只含文件路径与 sha256 指纹前缀，不打印 token 值（公开仓库的 CI 日志任何人可见）。
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = resolve(root, process.argv[2] ?? 'dist');
const ionSourcePath = join(root, 'node_modules/@cesium/engine/Source/Core/Ion.js');

// header 与 payload 都是 base64url 编码的 JSON（以 eyJ 开头）；不限定签名算法
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const MAX_LISTED_FILES = 10;

const fingerprint = (token) => createHash('sha256').update(token).digest('hex').slice(0, 12);

/** 仓库内路径显示为相对路径，仓库外（如测试用临时目录）显示绝对路径 */
const display = (path) => {
  const rel = relative(root, path);
  return rel && !rel.startsWith('..') ? rel : path;
};

const fail = (message) => {
  console.error(`::error::${message}`);
  process.exit(1);
};

if (!existsSync(distDir)) fail(`${display(distDir)} 不存在，请先构建`);

// ---- 白名单：Cesium 自带的默认 token ----
let cesiumDefaultToken;
try {
  cesiumDefaultToken = /defaultAccessToken\s*=\s*["'`]([^"'`]+)["'`]/.exec(readFileSync(ionSourcePath, 'utf8'))?.[1];
} catch {
  // 文件缺失与内容不符合预期统一在下方判失败
}
if (!cesiumDefaultToken || !new RegExp(`^${JWT_RE.source}$`).test(cesiumDefaultToken)) {
  fail(`无法从 ${display(ionSourcePath)} 读取 Cesium 默认 token，白名单失效（Cesium 升级后源码结构是否变化？）`);
}

// ---- 扫描产物 ----
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

const files = walk(distDir);
/** 指纹 → 出现该 token 的文件（相对产物目录） */
const allowed = new Map();
const unexpected = new Map();
for (const file of files) {
  // latin1 按字节一一映射：JWT 只含 ASCII，二进制文件也能安全扫描
  for (const [token] of readFileSync(file, 'latin1').matchAll(JWT_RE)) {
    const bucket = token === cesiumDefaultToken ? allowed : unexpected;
    const key = fingerprint(token);
    if (!bucket.has(key)) bucket.set(key, new Set());
    bucket.get(key).add(relative(distDir, file));
  }
}

const printGroup = (key, fileSet) => {
  const list = [...fileSet].sort();
  console.log(`  指纹 ${key}：${list.length} 个文件`);
  for (const file of list.slice(0, MAX_LISTED_FILES)) console.log(`    ${file}`);
  if (list.length > MAX_LISTED_FILES) console.log(`    …另 ${list.length - MAX_LISTED_FILES} 个`);
};

console.log(`产物 JWT 扫描：${display(distDir)}，共 ${files.length} 个文件`);
if (allowed.size) {
  console.log('放行 Cesium 自带的公开默认 ion token：');
  for (const [key, fileSet] of allowed) printGroup(key, fileSet);
}
if (unexpected.size) {
  console.log('非白名单 JWT：');
  for (const [key, fileSet] of unexpected) printGroup(key, fileSet);
  fail(
    `产物中发现 ${unexpected.size} 个非白名单 JWT，疑似 token 被硬编码进源码或依赖（上方只列指纹与文件，不含 token 值）`,
  );
}
console.log('✅ 未发现白名单以外的 JWT');
