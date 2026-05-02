type SplitChunksOptions = {
  chunks: 'all';
  minSize: number;
  maxSize: number;
  cacheGroups: Record<string, unknown>;
};

type WebpackChainConfig = {
  optimization: {
    splitChunks: (options: SplitChunksOptions) => void;
  };
};

export const configureSplitChunks = (config: WebpackChainConfig) => {
  config.optimization.splitChunks({
    chunks: 'all',
    minSize: 30_000,
    maxSize: 240_000,
    cacheGroups: {
      framework: {
        name: 'framework',
        test: /[\\/]node_modules[\\/](react|react-dom|scheduler|history)[\\/]/,
        priority: 50,
        enforce: true,
      },
      charts: {
        name: 'vendor-charts',
        test: /[\\/]node_modules[\\/](@antv|d3|@ant-design[\\/](charts|plots))[\\/]/,
        priority: 45,
        enforce: true,
        maxSize: 240_000,
      },
      antd: {
        name: 'vendor-antd',
        test: /[\\/]node_modules[\\/](@ant-design|antd|rc-.+)[\\/]/,
        priority: 40,
        enforce: true,
        maxSize: 240_000,
      },
      cesium: {
        name: 'vendor-cesium',
        test: /[\\/]node_modules[\\/](cesium|cesium-navigation-es6)[\\/]/,
        priority: 35,
        enforce: true,
      },
      designable: {
        name: 'vendor-designable',
        test: /[\\/]node_modules[\\/](@designable|@pind|@formily)[\\/]/,
        priority: 30,
        enforce: true,
        maxSize: 240_000,
      },
      pdf: {
        name: 'vendor-pdf',
        test: /[\\/]node_modules[\\/](react-pdf|pdfjs-dist)[\\/]/,
        priority: 25,
        enforce: true,
        maxSize: 240_000,
      },
      media: {
        name: 'vendor-media',
        test: /[\\/]node_modules[\\/](artplayer|wavesurfer\.js|xgplayer|xgplayer-music|html2canvas|tinymce)[\\/]/,
        priority: 20,
        enforce: true,
        maxSize: 240_000,
      },
      turf: {
        name: 'vendor-turf',
        test: /[\\/]node_modules[\\/](@turf|geojson-rbush|rbush)[\\/]/,
        priority: 20,
        enforce: true,
      },
      vendors: {
        name: 'vendors',
        test: /[\\/]node_modules[\\/]/,
        priority: -10,
        reuseExistingChunk: true,
        maxSize: 240_000,
      },
    },
  });
};
