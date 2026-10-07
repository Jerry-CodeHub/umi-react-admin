/**
 * CSP 单一来源。三条产线各有一份副本：GitHub Pages 的 <meta>（config.github.ts 直接引用本模块）、
 * vercel.json 与 nginx/security-headers.conf（静态文件无法 import，由 scripts/csp-consistency.test.ts
 * 逐条比对，任何一处漂移即测试失败）。改来源清单只改这里，再同步两份静态副本。
 *
 * 来源说明：
 * - script 'unsafe-eval'：Cesium Knockout 模板编译用 new Function（实测在用），pdfjs 已关 isEvalSupported
 * - style 'unsafe-inline'：antd cssinjs 运行时注入 + tailwind 任意值
 * - 高德 / autonavi：AMap JS API 2.0；openstreetmap：OpenLayers 瓦片；cesium.com：ion 影像
 * - virtualearth.net：未配置 ion token 时 Cesium 的 Bing 影像兜底
 * - media blob:：wavesurfer 7 把音频解码后以 blob URL 交给 <audio> 播放（缺了它音频可视页无法播放）
 * - huoshanstatic：xgplayer 演示视频
 */
export const CSP_DIRECTIVES: [string, string[]][] = [
  ['default-src', ["'self'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'self'"]],
  ['object-src', ["'none'"]],
  ['frame-ancestors', ["'self'"]],
  ['script-src', ["'self'", "'unsafe-eval'", 'https://*.amap.com']],
  ['style-src', ["'self'", "'unsafe-inline'"]],
  [
    'img-src',
    [
      "'self'",
      'data:',
      'blob:',
      'https://*.amap.com',
      'https://*.autonavi.com',
      'https://tile.openstreetmap.org',
      'https://ion.cesium.com',
      'https://api.cesium.com',
      'https://assets.ion.cesium.com',
      'https://*.virtualearth.net',
    ],
  ],
  [
    'connect-src',
    [
      "'self'",
      'blob:',
      'https://*.amap.com',
      'https://*.autonavi.com',
      'https://ion.cesium.com',
      'https://api.cesium.com',
      'https://assets.ion.cesium.com',
      'https://*.virtualearth.net',
    ],
  ],
  ['font-src', ["'self'", 'data:']],
  ['media-src', ["'self'", 'blob:', 'https://sf1-cdn-tos.huoshanstatic.com']],
  ['worker-src', ["'self'", 'blob:']],
  ['frame-src', ["'self'"]],
];

/** meta 版 CSP 不支持 frame-ancestors（浏览器会忽略并告警），<meta> 输出时剔除 */
const META_UNSUPPORTED = new Set(['frame-ancestors']);

export const buildCsp = ({ meta = false }: { meta?: boolean } = {}) =>
  CSP_DIRECTIVES.filter(([name]) => !(meta && META_UNSUPPORTED.has(name)))
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
