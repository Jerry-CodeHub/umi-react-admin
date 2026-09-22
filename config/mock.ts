/**
 * umi mock 配置（config.ts 与 scripts/mock-loadable.test.ts 共用）。
 *
 * umi 会把 mock 目录下的全部 .ts/.js 文件当作 mock 定义 require 进来。测试文件一旦落在其中，
 * 其 vitest 依赖无法被 require，整批 mock 加载失败：dev 下所有请求 HTTP 500、preview 启动即退出。
 * 约定测试不放 mock 目录（共享逻辑放 src/services/demo），这里再排除测试文件作兜底。
 */
export const mockConfig = {
  exclude: ['mock/**/*.test.ts', 'mock/**/*.spec.ts'],
};
