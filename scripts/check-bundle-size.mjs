// 首屏体积度量与预算门禁（审计 perf-11：84ada98 声称减小体积却无产物体积记录）
// 用法：node scripts/check-bundle-size.mjs（需先 pnpm build）
// 阈值见仓库根 size-budget.json；超阈值 exit 1，可接入 CI。
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = new URL('..', import.meta.url);
const distDir = join(root.pathname, 'dist');
const indexPath = join(distDir, 'index.html');

if (!existsSync(indexPath)) {
  console.error('dist/index.html 不存在，请先执行 pnpm build');
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf8');
const scriptTags = html.match(/<script\b[^>]*>/g) || [];
const syncScripts = [];
for (const tag of scriptTags) {
  const src = /src="([^"]+)"/.exec(tag)?.[1];
  if (!src || /\b(async|defer)\b/.test(tag)) continue;
  syncScripts.push(src);
}

let firstScreenRaw = 0;
let firstScreenGzip = 0;
const rows = [];
for (const src of syncScripts) {
  const file = join(distDir, src.replace(/^\//, ''));
  if (!existsSync(file)) continue;
  const buf = readFileSync(file);
  const gzip = gzipSync(buf).length;
  firstScreenRaw += buf.length;
  firstScreenGzip += gzip;
  rows.push({ file: src, rawKB: Math.round(buf.length / 1024), gzipKB: Math.round(gzip / 1024) });
}
rows.sort((a, b) => b.gzipKB - a.gzipKB);

const dirSizeMB = (dir) => {
  if (!existsSync(dir)) return 0;
  let total = 0;
  const walk = (d) => {
    for (const name of execFileSync('ls', ['-A', d], { encoding: 'utf8' }).split('\n').filter(Boolean)) {
      const p = `${d}/${name}`;
      if (statSync(p).isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk(dir);
  return total / 1024 / 1024;
};

const budget = JSON.parse(readFileSync(join(root.pathname, 'size-budget.json'), 'utf8'));
const L = budget.limits;

console.log(`同步脚本数量: ${syncScripts.length}（预算 ≤${L.syncScripts}，基线 ${budget.baseline.syncScripts}）`);
console.log(
  `首屏 JS 体积: raw ${(firstScreenRaw / 1024 / 1024).toFixed(2)}MB / gzip ${(firstScreenGzip / 1024).toFixed(
    0,
  )}KB（预算 ≤${L.firstScreenGzipKB}KB，基线 ${budget.baseline.firstScreenGzipKB}KB）`,
);
console.log(`dist 总体积: ${dirSizeMB(distDir).toFixed(1)}MB（预算 ≤${L.distMB}MB）`);
console.log(`public 总体积: ${dirSizeMB(join(root.pathname, 'public')).toFixed(1)}MB（预算 ≤${L.publicMB}MB）`);
console.log('\n首屏最大的 10 个同步脚本：');
for (const r of rows.slice(0, 10))
  console.log(`  ${String(r.gzipKB).padStart(5)}KB gzip  ${String(r.rawKB).padStart(6)}KB raw  ${r.file}`);

const failures = [];
if (syncScripts.length > L.syncScripts) failures.push(`同步脚本 ${syncScripts.length} > ${L.syncScripts}`);
if (firstScreenGzip / 1024 > L.firstScreenGzipKB)
  failures.push(`首屏 gzip ${Math.round(firstScreenGzip / 1024)}KB > ${L.firstScreenGzipKB}KB`);
if (dirSizeMB(distDir) > L.distMB) failures.push(`dist ${dirSizeMB(distDir).toFixed(1)}MB > ${L.distMB}MB`);
if (dirSizeMB(join(root.pathname, 'public')) > L.publicMB)
  failures.push(`public ${dirSizeMB(join(root.pathname, 'public')).toFixed(1)}MB > ${L.publicMB}MB`);

// ---- 样式管线覆盖检查（审计 extra-3-9）----
// 源码中使用的 tailwind 工具类必须在构建产物 umi.css 中存在，
// 否则说明版本锁死/content 漏扫导致类被静默丢弃（min-w-96 案例的根因）。
const UTILITY_PREFIX =
  /^(?:!?[a-z:]+-|.+(?:\/|\[).+|flex|grid|block|hidden|relative|absolute|static|fixed|sticky|invisible|visible|italic|underline|truncate|table)$/;
const umiCss = readFileSync(join(distDir, 'umi.css'), 'utf8');
const cssClasses = new Set(
  Array.from(umiCss.matchAll(/\.((?:[a-zA-Z0-9_-]|\\.)+)/g)).map((m) => m[1].replace(/\\([./:[\]()])/g, '$1')),
);
const srcFiles = execFileSync('git', ['ls-files', 'src'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('.umi'));
const usedTokens = new Set();
const classRe = /(?:className|class)=?"([^"]+)"/g;
for (const f of srcFiles) {
  const text = readFileSync(f, 'utf8');
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
const UTILITY_RE =
  /^(?:!?(?:hover|focus|active|disabled|md|sm|lg|xl|2xl):)!?(?:p|px|py|pt|pb|pl|pr|m|mx|my|ml|mr|mt|mb|w|min-w|max-w|h|min-h|max-h|text|bg|font|flex|grid|items|justify|gap|rounded|border|shadow|z|overflow|top|bottom|left|right|transition|duration|cursor|select|aspect|order|col|leading|tracking|whitespace|list|space|object|opacity|ring|outline|uppercase|lowercase|capitalize)-/;
const utilityLike = (t) => BARE_UTILS.has(t.replace(/^!/, '')) || UTILITY_RE.test(t);
const missing = Array.from(usedTokens).filter((t) => utilityLike(t) && !cssClasses.has(t));
// hover: 等变体在产物中为转义形式（hover\:bg-x），按去掉变体前缀的基础类判定
const missingFinal = [
  ...new Set(
    missing.map((t) => {
      const bare = t.replace(/^(?:!?(?:hover|focus|active|disabled|md|sm|lg|xl|2xl):)/, '');
      return cssClasses.has(bare) ? null : bare;
    }),
  ),
].filter(Boolean);
if (missingFinal.length) {
  failures.push(`源码使用但 umi.css 缺失的工具类: ${missingFinal.slice(0, 12).join(', ')}`);
}

if (failures.length) {
  console.error('\n体积预算超限：\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('\n✅ 体积预算全部达标');
