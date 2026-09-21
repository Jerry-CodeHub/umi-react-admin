import { defineConfig } from '@umijs/max';
import { configureSplitChunks } from './splitChunks';
// import { routes } from './routes';

export default defineConfig({
  chainWebpack(config) {
    configureSplitChunks(config);
  },
  define: {
    CESIUM_BASE_URL: '/umi-react-admin/Cesium',
    CESIUM_ION_TOKEN: process.env.CESIUM_ION_TOKEN,
    PUBLIC_PATH: '/umi-react-admin/',
    UMI_APP_API_BASE: process.env.UMI_APP_API_BASE,
    TINYMCE_API_KEY: process.env.TINYMCE_API_KEY,
  },
  favicons: ['/umi-react-admin/favicon.ico'],
  base: '/umi-react-admin/',
  publicPath: '/umi-react-admin/',
});
