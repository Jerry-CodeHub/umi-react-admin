// 纯静态服务器，行为对齐 GitHub Pages：站点挂在子路径下，不存在的路径返回 404.html（状态码 404）。
// 用于 E2E 与本地验证纯静态部署（不要用 max preview：它自带 mock 与 history fallback，会掩盖静态托管的问题）。
// 用法：node scripts/serve-dist.mjs [dist 目录] [base 路径] [端口]
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
const dist = process.argv[2] ?? 'dist';
const base = process.argv[3] ?? '/umi-react-admin/';
const port = Number(process.argv[4] ?? 8090);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.xml': 'application/xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
};
createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!url.startsWith(base)) {
    res.writeHead(404);
    res.end();
    return;
  }
  let file = join(dist, url.slice(base.length));
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    // GitHub Pages 的 SPA 回退：部署时复制 index.html 为 404.html；本地产物没有时直接用 index.html
    const fallback = await readFile(join(dist, '404.html')).catch(() =>
      readFile(join(dist, 'index.html')).catch(() => null),
    );
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(fallback ?? '');
  }
}).listen(port, () => console.log(`serving ${dist} at http://localhost:${port}${base}`));
