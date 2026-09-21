type SplitChunksOptions = {
  chunks: 'all';
  minSize: number;
  maxSize?: number;
  cacheGroups: Record<string, unknown>;
};

type WebpackChainConfig = {
  optimization: {
    splitChunks: (options: SplitChunksOptions) => void;
  };
};

/**
 * 分包策略要点：
 * - vendors 兜底组限定 chunks: 'initial'——此前继承顶层 chunks:'all' 且带 maxSize，
 *   把 Cesium/turf 等异步引擎打成碎片卷入首屏同步加载（审计 perf-1）；
 * - 不再使用 maxSize 碎片化——55KB 级的 vendor 碎片既推高请求数也破坏长效缓存；
 * - 只给「单一功能域」的大库建命名组。命名 + enforce 的组会把命中的所有模块合进同一个
 *   chunk，任何路由用到其中一个模块就得下载整组：曾经的 media 组把 html2canvas（图表库
 *   @antv/g 的依赖）与 xgplayer/wavesurfer 绑在一起、d3 组把图表库用到的 d3-* 与 D3 页的
 *   全部 d3 绑在一起，首页因此白白下载播放器与整份 d3。这类跨域共享的库交给 webpack
 *   按实际引用关系自动拆分；
 * - cesium 包只是 re-export，引擎代码在 @cesium/engine、@cesium/widgets，分组正则须覆盖。
 * 路由级真实首屏体积由 config/chunkGraph.ts 记录、scripts/check-bundle-size.mjs 门禁。
 */
export const configureSplitChunks = (config: WebpackChainConfig) => {
  config.optimization.splitChunks({
    chunks: 'all',
    minSize: 30_000,
    cacheGroups: {
      framework: {
        name: 'framework',
        test: /[\\/]node_modules[\\/](react|react-dom|scheduler|history)[\\/]/,
        priority: 50,
        enforce: true,
      },
      charts: {
        name: 'vendor-charts',
        test: /[\\/]node_modules[\\/](@antv|@ant-design[\\/](charts|plots))[\\/]/,
        priority: 45,
        enforce: true,
      },
      antd: {
        name: 'vendor-antd',
        test: /[\\/]node_modules[\\/](@ant-design|antd|rc-.+)[\\/]/,
        priority: 40,
        enforce: true,
      },
      cesium: {
        name: 'vendor-cesium',
        test: /[\\/]node_modules[\\/](@cesium[\\/][\w-]+|cesium|cesium-navigation-es6)[\\/]/,
        priority: 35,
        enforce: true,
      },
      // pdf（react-pdf/pdfjs-dist）不做强制分组，按引用自动拆分
      pdf: {
        name: 'vendor-pdf',
        test: /[\\/]node_modules[\\/](react-pdf|pdfjs-dist)[\\/]/,
        priority: 25,
      },
      turf: {
        name: 'vendor-turf',
        test: /[\\/]node_modules[\\/]@turf[\\/]/,
        priority: 20,
        enforce: true,
      },
      vendors: {
        name: 'vendors',
        test: /[\\/]node_modules[\\/]/,
        chunks: 'initial',
        priority: -10,
        reuseExistingChunk: true,
      },
    },
  });
};
