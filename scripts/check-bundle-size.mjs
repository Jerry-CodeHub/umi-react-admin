// 首屏体积度量与预算门禁（审计 perf-11：84ada98 声称减小体积却无产物体积记录）
// 用法：node scripts/check-bundle-size.mjs（需先 pnpm build；CI 在构建后自动执行）
// 阈值见仓库根 size-budget.json；任一超限 exit 1。
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(root, 'dist');
const indexPath = join(distDir, 'index.html');
// 由 config/chunkGraph.ts 在构建时写出（路由 → 实际加载的文件）
const chunkGraphPath = join(root, 'node_modules/.cache/umi-react-admin/chunk-graph.json');

if (!existsSync(indexPath)) {
  console.error('dist/index.html 不存在，请先执行 pnpm build');
  process.exit(1);
}

const budget = JSON.parse(readFileSync(join(root, 'size-budget.json'), 'utf8'));
const L = budget.limits;
const failures = [];

/** 产物内路径（可带 publicPath 前缀，如 /umi-react-admin/umi.js）→ dist 内文件 */
const distFile = (src) => {
  const rel = src.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
  const direct = join(distDir, rel);
  if (existsSync(direct)) return direct;
  // 兼容 GitHub Pages 构建的 /umi-react-admin/ 前缀
  const stripped = join(distDir, rel.split('/').slice(1).join('/'));
  return existsSync(stripped) ? stripped : null;
};

const sizeOf = (file) => {
  const buf = readFileSync(file);
  return { raw: buf.length, gzip: gzipSync(buf).length };
};

const kb = (bytes) => Math.round(bytes / 1024);

// ---- 1. 入口同步脚本（index.html 中非 async/defer 的 script）----
const html = readFileSync(indexPath, 'utf8');
const syncScripts = [];
for (const tag of html.match(/<script\b[^>]*>/g) || []) {
  const src = /src="([^"]+)"/.exec(tag)?.[1];
  if (src && !/\b(async|defer)\b/.test(tag)) syncScripts.push(src);
}

let initialRaw = 0;
let initialGzip = 0;
const rows = [];
for (const src of syncScripts) {
  const file = distFile(src);
  if (!file) continue;
  const { raw, gzip } = sizeOf(file);
  initialRaw += raw;
  initialGzip += gzip;
  rows.push({ src, raw, gzip });
}
rows.sort((a, b) => b.gzip - a.gzip);

console.log(
  `入口同步脚本: ${syncScripts.length} 个（预算 ≤${L.syncScripts}，治理前基线 ${budget.baseline.syncScripts}）`,
);
console.log(
  `入口 JS 体积: raw ${(initialRaw / 1024 / 1024).toFixed(2)}MB / gzip ${kb(initialGzip)}KB（预算 ≤${
    L.firstScreenGzipKB
  }KB）`,
);
for (const r of rows)
  console.log(`  ${String(kb(r.gzip)).padStart(5)}KB gzip  ${String(kb(r.raw)).padStart(6)}KB raw  ${r.src}`);
if (syncScripts.length > L.syncScripts) failures.push(`入口同步脚本 ${syncScripts.length} > ${L.syncScripts}`);
if (kb(initialGzip) > L.firstScreenGzipKB)
  failures.push(`入口 JS gzip ${kb(initialGzip)}KB > ${L.firstScreenGzipKB}KB`);

// ---- 2. 路由真实首屏：入口 + 布局 + 路由自身及其全部异步依赖 ----
if (!existsSync(chunkGraphPath)) {
  failures.push('缺少 chunk 清单（node_modules/.cache/umi-react-admin/chunk-graph.json），请先 pnpm build');
} else {
  const graph = JSON.parse(readFileSync(chunkGraphPath, 'utf8'));
  for (const [route, rule] of Object.entries(L.routes || {})) {
    const groups = ['umi', ...(rule.withLayout ? ['t__plugin-layout__Layout'] : []), route];
    const missing = groups.filter((g) => !graph[g]);
    if (missing.length) {
      failures.push(`chunk 清单中找不到 ${missing.join(', ')}（路由名是否变更？）`);
      continue;
    }
    const files = [...new Set(groups.flatMap((g) => graph[g]))].filter((f) => /\.m?js$/.test(f));
    const total = files.reduce(
      (acc, f) => {
        const file = join(distDir, f);
        if (!existsSync(file)) return acc;
        const { raw, gzip } = sizeOf(file);
        return { raw: acc.raw + raw, gzip: acc.gzip + gzip };
      },
      { raw: 0, gzip: 0 },
    );
    console.log(
      `\n路由首屏 ${route}: ${files.length} 个 JS / raw ${(total.raw / 1024 / 1024).toFixed(2)}MB / gzip ${kb(
        total.gzip,
      )}KB（预算 ≤${rule.maxGzipKB}KB）`,
    );
    console.log(`  ${files.join(' ')}`);
    if (kb(total.gzip) > rule.maxGzipKB)
      failures.push(`路由 ${route} 首屏 gzip ${kb(total.gzip)}KB > ${rule.maxGzipKB}KB`);
  }
}

// ---- 3. 产物与 public 总体积 ----
const dirSizeMB = (dir) => {
  let total = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  if (existsSync(dir)) walk(dir);
  return total / 1024 / 1024;
};
const distMB = dirSizeMB(distDir);
const publicMB = dirSizeMB(join(root, 'public'));
console.log(`\ndist 总体积: ${distMB.toFixed(1)}MB（预算 ≤${L.distMB}MB）`);
console.log(`public 总体积: ${publicMB.toFixed(1)}MB（预算 ≤${L.publicMB}MB）`);
if (distMB > L.distMB) failures.push(`dist ${distMB.toFixed(1)}MB > ${L.distMB}MB`);
if (publicMB > L.publicMB) failures.push(`public ${publicMB.toFixed(1)}MB > ${L.publicMB}MB`);

// ---- 4. 样式管线覆盖检查（审计 extra-3-9）----
// 源码中使用的 tailwind 工具类必须在构建产物的样式表中存在，
// 否则说明版本锁死/content 漏扫导致类被静默丢弃（min-w-96 案例的根因）。
const cssClasses = new Set();
for (const tag of html.match(/<link\b[^>]*rel="stylesheet"[^>]*>/g) || []) {
  const href = /href="([^"]+)"/.exec(tag)?.[1];
  const file = href && distFile(href);
  if (!file) continue;
  for (const m of readFileSync(file, 'utf8').matchAll(/\.((?:[a-zA-Z0-9_-]|\\.)+)/g)) {
    cssClasses.add(m[1].replace(/\\([./:[\]()!])/g, '$1'));
  }
}
const srcFiles = execFileSync('git', ['ls-files', 'src'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('.umi'));
const usedTokens = new Set();
const classRe = /(?:className|class)=?"([^"]+)"/g;
for (const f of srcFiles) {
  const text = readFileSync(join(root, f), 'utf8');
  let m;
  while ((m = classRe.exec(text))) {
    m[1].split(/\s+/).forEach((t) => t && usedTokens.add(t));
  }
}
// 只判定"确属 tailwind 工具类"的 token（自定义类如 audio-player/signature-pad 不在范围）
const BARE_UTILS = new Set([
  'flex',
  'grid',
  'block',
  'hidden',
  'relative',
  'absolute',
  'static',
  'fixed',
  'sticky',
  'italic',
  'underline',
  'truncate',
  'invisible',
  'visible',
  'table',
]);
const VARIANT = /^!?(?:hover|focus|active|disabled|md|sm|lg|xl|2xl):/;
// 变体前缀可选：无变体的普通工具类（min-w-96、p-4）同样要检查
const UTILITY_RE =
  /^(?:!?(?:hover|focus|active|disabled|md|sm|lg|xl|2xl):)?!?(?:p|px|py|pt|pb|pl|pr|m|mx|my|ml|mr|mt|mb|w|min-w|max-w|h|min-h|max-h|text|bg|font|flex|grid|items|justify|gap|rounded|border|shadow|z|overflow|top|bottom|left|right|transition|duration|cursor|select|aspect|order|col|leading|tracking|whitespace|list|space|object|opacity|ring|outline|uppercase|lowercase|capitalize|shrink|grow|basis)-/;
const utilityLike = (t) => BARE_UTILS.has(t.replace(/^!/, '')) || UTILITY_RE.test(t);
// hover: 等变体在产物中为转义形式（hover\:bg-x），这里已反转义，按原样或去掉变体前缀的基础类判定
const missing = [
  ...new Set(
    Array.from(usedTokens)
      .filter((t) => utilityLike(t) && !cssClasses.has(t) && !cssClasses.has(t.replace(VARIANT, '')))
      .map((t) => t.replace(VARIANT, '')),
  ),
];
if (missing.length) {
  failures.push(`源码使用但产物样式表缺失的工具类: ${missing.slice(0, 12).join(', ')}`);
}

if (failures.length) {
  console.error('\n门禁未通过：\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('\n✅ 体积预算与样式覆盖检查全部通过');
