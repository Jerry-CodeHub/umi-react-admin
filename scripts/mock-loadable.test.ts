import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { mockConfig } from '../config/mock';

// @umijs/preset-umi 经 @umijs/max → umi 传递引入，沿依赖链解析，不依赖 node_modules 提升
const requireFromMax = createRequire(createRequire(import.meta.url).resolve('@umijs/max/package.json'));
const requireFromUmi = createRequire(requireFromMax.resolve('umi/package.json'));

/**
 * 门禁：用 umi 自身的 mock 加载函数按项目配置加载 mock 目录。
 * 任何一个 mock 文件 require 失败都会让 dev 全站 500、preview 启动失败，
 * 而 typecheck / lint / build 都覆盖不到这条链路，所以放进 pnpm check。
 * 注意：引用的是 @umijs/preset-umi 的内部路径，升级 umi 若路径变化需同步调整。
 */
describe('umi mock 可加载性', () => {
  it('按项目 mock 配置加载全部 mock 文件不抛错', async () => {
    const { getMockData } = requireFromUmi('@umijs/preset-umi/dist/features/mock/getMockData');
    const routes = Object.keys(getMockData({ cwd: process.cwd(), mockConfig }));
    expect(routes).toEqual(
      expect.arrayContaining(['POST /api/v1/login', 'GET /api/v1/currentUser', 'GET /api/v1/queryUserList']),
    );
    expect(routes.length).toBeGreaterThanOrEqual(8);
  });
});
