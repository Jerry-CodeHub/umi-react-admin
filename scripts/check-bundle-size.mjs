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

if (failures.length) {
  console.error('\n体积预算超限：\n  - ' + failures.join('\n  - '));
  process.exit(1);
}
console.log('\n✅ 体积预算全部达标');
