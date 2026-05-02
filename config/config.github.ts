import { defineConfig } from '@umijs/max';
import path from 'path';
import { configureSplitChunks } from './splitChunks';
// import { routes } from './routes';

export default defineConfig({
  chainWebpack(config) {
    configureSplitChunks(config);
    config.module
      .rule('cesium')
      .test(/\.js$/)
      .include.add(path.resolve(__dirname, 'node_modules/cesium/Source'))
      .end()
      .use('strip-pragma-loader')
      .loader('strip-pragma-loader')
      .options({
        pragmas: {
          debug: false,
        },
      });
  },
  define: {
    CESIUM_BASE_URL: '/umi-react-admin/Cesium',
    CESIUM_ION_TOKEN: process.env.CESIUM_ION_TOKEN,
  },
  favicons: ['/umi-react-admin/favicon.ico'],
  base: '/umi-react-admin/',
  publicPath: '/umi-react-admin/',
});
