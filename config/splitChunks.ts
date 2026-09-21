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
 * - d3 独立分组（priority 44），与图表库解包：Home 页用 @ant-design/plots 不应连带下载 d3。
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
      d3: {
        name: 'vendor-d3',
        test: /[\\/]node_modules[\\/]d3(-[\w-]+)?[\\/]/,
        priority: 44,
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
        test: /[\\/]node_modules[\\/](cesium|cesium-navigation-es6)[\\/]/,
        priority: 35,
        enforce: true,
      },
      pdf: {
        name: 'vendor-pdf',
        test: /[\\/]node_modules[\\/](react-pdf|pdfjs-dist)[\\/]/,
        priority: 25,
        enforce: true,
      },
      media: {
        name: 'vendor-media',
        test: /[\\/]node_modules[\\/](wavesurfer\.js|xgplayer|xgplayer-music|html2canvas|tinymce)[\\/]/,
        priority: 20,
        enforce: true,
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
