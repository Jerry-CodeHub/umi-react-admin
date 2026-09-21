import fs from 'fs';
import path from 'path';

/** 构建产物的路由级 chunk 清单，供 scripts/check-bundle-size.mjs 计算路由真实首屏体积 */
export const CHUNK_GRAPH_FILE = 'node_modules/.cache/umi-react-admin/chunk-graph.json';

type ChunkGroupLike = { getFiles(): string[] };
type CompilationLike = { namedChunkGroups: Map<string, ChunkGroupLike> };
type CompilerLike = {
  context: string;
  hooks: { afterEmit: { tap(name: string, fn: (compilation: CompilationLike) => void): void } };
};

type WebpackChainConfig = {
  plugin: (name: string) => { use: (plugin: new () => { apply(compiler: CompilerLike): void }) => unknown };
};

/**
 * 记录每个具名 chunk group（入口 umi、布局 t__plugin-layout__Layout、各路由 p__Xxx）
 * 实际需要加载的文件。异步路由组包含它依赖的全部拆分 chunk（如图表库、共享 vendor），
 * 这是「只统计 index.html 同步脚本」的口径看不到的部分。输出在 node_modules/.cache，不进 dist。
 */
class ChunkGraphPlugin {
  apply(compiler: CompilerLike) {
    compiler.hooks.afterEmit.tap('ChunkGraphPlugin', (compilation) => {
      const graph: Record<string, string[]> = {};
      compilation.namedChunkGroups.forEach((group, name) => {
        graph[name] = group.getFiles();
      });
      const file = path.join(compiler.context, CHUNK_GRAPH_FILE);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(graph, null, 2));
    });
  }
}

export const addChunkGraph = (config: WebpackChainConfig) => {
  config.plugin('chunk-graph').use(ChunkGraphPlugin);
};
