import { execFileSync } from 'child_process';

/**
 * 构建信息：提交、时间、部署目标。页面页脚显示，并输出 dist/version.json 供部署后核对
 * （三条产线曾各自停在不同版本而无人察觉）。
 */
const gitSha = () => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const target = () => {
  if (process.env.UMI_ENV === 'github') return 'github-pages';
  if (process.env.VERCEL) return 'vercel';
  if (process.env.CF_PAGES) return 'cloudflare-pages';
  return process.env.BUILD_TARGET || 'local';
};

export const BUILD_INFO = {
  sha: process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || gitSha(),
  time: new Date().toISOString(),
  target: target(),
};

type CompilerLike = {
  hooks: {
    thisCompilation: {
      tap(name: string, fn: (compilation: CompilationLike) => void): void;
    };
  };
  webpack: { sources: { RawSource: new (source: string) => unknown } };
};
type CompilationLike = {
  hooks: { processAssets: { tap(options: { name: string; stage: number }, fn: () => void): void } };
  emitAsset(name: string, source: unknown): void;
};
type WebpackChainConfig = {
  plugin: (name: string) => { use: (plugin: new () => { apply(compiler: CompilerLike): void }) => unknown };
};

class VersionFilePlugin {
  apply(compiler: CompilerLike) {
    compiler.hooks.thisCompilation.tap('VersionFilePlugin', (compilation) => {
      // stage 数值取 webpack PROCESS_ASSETS_STAGE_ADDITIONAL（-2000）：只新增文件
      compilation.hooks.processAssets.tap({ name: 'VersionFilePlugin', stage: -2000 }, () => {
        compilation.emitAsset(
          'version.json',
          new compiler.webpack.sources.RawSource(`${JSON.stringify(BUILD_INFO, null, 2)}\n`),
        );
      });
    });
  }
}

export const addVersionFile = (config: WebpackChainConfig) => {
  config.plugin('version-file').use(VersionFilePlugin);
};
