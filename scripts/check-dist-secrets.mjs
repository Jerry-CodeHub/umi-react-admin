// 产物 JWT 泄露扫描（审计 security-6：曾发生 token 经 define 注入构建产物并部署到 gh-pages）
// 用法：node scripts/check-dist-secrets.mjs [产物目录，默认 dist]（需先构建；CI 在构建后自动执行）
//
// 判定：产物里出现的 JWT 只可能是硬编码进源码/依赖的 token 或经构建注入的预期公开 token，前者一律判失败。
// 白名单两个来源：
// 1. Cesium 自带的公开默认 ion token（@cesium/engine 的 Source/Core/Ion.js，未配置 token 时兜底，
//    页面会提示正在使用默认 token），它随 Cesium 必然进入产物。从已安装的源码动态读取：
//    Cesium 升级换 token 不会误报；读取失败直接判失败，不会静默放行。
// 2. EXPECTED_TOKEN 环境变量（审计 2026-09-22 H-1：部署产线注入的 ion token 等「设计上公开」的凭据）。
//    CI 传入 secret 值，脚本只以 sha256 指纹比对（不可逆），值不打印、不落日志——
//    声明它即显式决策「该 token 允许出现在公开产物」，杜绝扫描对象与部署对象错位的盲区。
// 本地产物若经 .env.local 注入了未声明的 token，会被判为非白名单，这是预期行为。
// 另有第二层检测：AWS/GitHub/OpenAI/Slack 前缀与 PEM 私钥块等非 JWT 形态密钥，无白名单，出现即失败。
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
const JWT_SHAPE_RE = /^eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
const MAX_LISTED_FILES = 10;

// 非 JWT 形态的常见密钥特征（审计 2026-09-22 M-5）：刻意保守，避免对 Cesium base64 资产误报。
// 高熵启发式不做——产物内合法高熵字符串过多，误报不可控。
const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS Access Key ID'],
  [/ghp_[A-Za-z0-9]{36}/, 'GitHub PAT（ghp_）'],
  [/gho_[A-Za-z0-9]{36}/, 'GitHub OAuth token（gho_）'],
  [/github_pat_[A-Za-z0-9_]{22,}/, 'GitHub fine-grained PAT'],
  [/sk-[A-Za-z0-9]{20,}/, 'sk- 前缀 API key'],
  [/xox[bp]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/, 'PEM 私钥块'],
];

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
if (!cesiumDefaultToken || !JWT_SHAPE_RE.test(cesiumDefaultToken)) {
  fail(`无法从 ${display(ionSourcePath)} 读取 Cesium 默认 token，白名单失效（Cesium 升级后源码结构是否变化？）`);
}

// ---- 白名单第二来源：EXPECTED_TOKEN（「设计上公开」的注入 token，如部署产线的 ion token） ----
// 设置了但形状不合法时判失败（fail-closed），防止把拼写残缺的 secret 当成已声明。
const expectedToken = process.env.EXPECTED_TOKEN || '';
if (expectedToken && !JWT_SHAPE_RE.test(expectedToken)) {
  fail('EXPECTED_TOKEN 已设置但不是合法的 JWT 形态（三段 base64url），请检查传入的值');
}
const expectedFingerprint = expectedToken ? fingerprint(expectedToken) : '';

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
/** 非 JWT 形态密钥：标签 → 文件集合（无白名单） */
const nonJwtHits = new Map();
for (const file of files) {
  // latin1 按字节一一映射：JWT 只含 ASCII，二进制文件也能安全扫描
  const content = readFileSync(file, 'latin1');
  for (const [token] of content.matchAll(JWT_RE)) {
    const isAllowed = token === cesiumDefaultToken || token === expectedToken;
    const bucket = isAllowed ? allowed : unexpected;
    const key = fingerprint(token);
    if (!bucket.has(key)) bucket.set(key, new Set());
    bucket.get(key).add(relative(distDir, file));
  }
  for (const [pattern, label] of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      if (!nonJwtHits.has(label)) nonJwtHits.set(label, new Set());
      nonJwtHits.get(label).add(relative(distDir, file));
    }
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
  console.log('放行公开 token（Cesium 默认 / EXPECTED_TOKEN 声明）：');
  for (const [key, fileSet] of allowed) {
    const source = expectedFingerprint && key === expectedFingerprint ? '（EXPECTED_TOKEN 声明的公开 token）' : '';
    console.log(`  指纹 ${key}${source}：${fileSet.size} 个文件`);
    for (const file of [...fileSet].sort().slice(0, MAX_LISTED_FILES)) console.log(`    ${file}`);
  }
}
if (nonJwtHits.size) {
  console.log('非 JWT 形态密钥特征：');
  for (const [label, fileSet] of nonJwtHits) printGroup(label, fileSet);
}
if (unexpected.size || nonJwtHits.size) {
  if (unexpected.size) {
    console.log('非白名单 JWT：');
    for (const [key, fileSet] of unexpected) printGroup(key, fileSet);
  }
  fail(
    `产物中发现 ${unexpected.size} 个非白名单 JWT 与 ${nonJwtHits.size} 类密钥形态特征，` +
      `疑似 secret 被硬编码进源码/依赖或经构建意外注入（上方只列指纹与文件，不含值）`,
  );
}
console.log('✅ 未发现白名单以外的 JWT 或密钥形态特征');
