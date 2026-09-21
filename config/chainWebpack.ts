import path from 'path';

/**
 * Cesium strip-pragma：剥除引擎源码中的 debug pragma，减小产物体积。
 * 提取自原 config.github.ts 内联规则，供两条产线（pnpm build 与 build:github）共用，
 * 消除 Docker/Vercel 与 GitHub Pages 产物体积不一致（审计 perf-8）。
 * 调用方以 NODE_ENV==='production' 门控（开发模式跳过以提升构建速度）。
 */
// 参数为 webpack-chain 的 Config 实例；其链式类型与结构化声明不兼容，构建脚本此处从宽
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const applyCesiumStripPragma = (config: any) => {
  config.module
    .rule('cesium')
    .test(/\.js$/)
    .include.add(path.resolve(__dirname, '../node_modules/cesium/Source'))
    .end()
    .use('strip-pragma-loader')
    .loader('strip-pragma-loader')
    .options({
      pragmas: {
        debug: false,
      },
    });
};
