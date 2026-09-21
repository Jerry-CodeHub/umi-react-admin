import { defineConfig } from '@umijs/max';
import { applyCesiumStripPragma } from './chainWebpack';
import { configureSplitChunks } from './splitChunks';
// import { routes } from './routes';

export default defineConfig({
  chainWebpack(config) {
    configureSplitChunks(config);
    if (process.env.NODE_ENV === 'production') {
      applyCesiumStripPragma(config);
    }
  },
  define: {
    CESIUM_BASE_URL: '/umi-react-admin/Cesium',
    CESIUM_ION_TOKEN: process.env.CESIUM_ION_TOKEN,
  },
  favicons: ['/umi-react-admin/favicon.ico'],
  base: '/umi-react-admin/',
  publicPath: '/umi-react-admin/',
});
