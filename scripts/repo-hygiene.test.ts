import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url);

const readJson = (file: string) => JSON.parse(readFileSync(new URL(file, root), 'utf8'));

/**
 * 允许不在 package.json 声明的裸导入：
 * - react / react-dom：由 @umijs/max 提供并统一别名（umi 约定，项目不单独安装）
 * - @umijs/preset-umi：mock 可加载性门禁有意引用 umi 内部实现（见 mock-loadable.test.ts）
 */
const PROVIDED_BY_UMI = new Set(['react', 'react-dom', '@umijs/preset-umi']);

/**
 * 源码中的模块说明符（先剥注释，避免被注释掉的 import 误报）。
 * `import type` 单独归类：只需类型包（如 mock 里的 express 类型由 @types/express 提供）
 */
const importSpecifiers = (source: string) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
  const typeOnlyStatement = /\bimport\s+type\s[^;]*?\bfrom\s*['"]([^'"]+)['"]/g;
  const valuePattern =
    /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]|\brequire(?:\.resolve)?\(\s*['"]([^'"]+)['"]/g;
  return [
    ...[...code.matchAll(typeOnlyStatement)].map((m) => ({ specifier: m[1], typeOnly: true })),
    ...[...code.replace(typeOnlyStatement, '').matchAll(valuePattern)].map((m) => ({
      specifier: m[1] ?? m[2] ?? m[3],
      typeOnly: false,
    })),
  ];
};

const packageNameOf = (specifier: string) =>
  specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];

/** 可提交文本文件（暂存 + 未跟踪，排除 lockfile） */
const committableTextFiles = () =>
  execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean)
    .filter((file) => /\.(?:[cm]?[jt]sx?|json|md|ya?ml|env|css|less|html|txt)$/.test(file))
    .filter((file) => !file.endsWith('pnpm-lock.yaml'));

describe('仓库卫生门禁', () => {
  it('可提交文本文件不含 JWT 形态的秘钥', () => {
    const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
    const offenders = committableTextFiles().filter((file) =>
      jwtPattern.test(readFileSync(new URL(file, root), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('可提交文件不含本地 OS / IDE 工件', () => {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    const forbidden = [/(^|\/)\.DS_Store$/, /^\.idea\//];
    expect(files.filter((f) => forbidden.some((p) => p.test(f)))).toEqual([]);
  });

  it('导入的第三方包都已在 package.json 声明（不依赖 shamefully-hoist 的提升）', () => {
    // 幽灵依赖只在 .npmrc 的 shamefully-hoist 下可解析；pnpm 11 起 .npmrc 不再承载该配置，届时会整批断掉
    const pkg = readJson('package.json');
    const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
    const offenders = committableTextFiles()
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
      .flatMap((file) =>
        importSpecifiers(readFileSync(new URL(file, root), 'utf8'))
          .filter(({ specifier }) => !/^(?:\.|\/|@\/|@@\/|node:)/.test(specifier))
          .map(({ specifier, typeOnly }) => ({ name: packageNameOf(specifier), typeOnly }))
          .filter(
            ({ name, typeOnly }) =>
              !builtinModules.includes(name) &&
              !declared.has(name) &&
              !PROVIDED_BY_UMI.has(name) &&
              !(typeOnly && declared.has(`@types/${name}`)),
          )
          .map(({ name }) => `${file} → ${name}`),
      );
    expect(offenders).toEqual([]);
  });

  it('pdfjs-dist 与 react-pdf 内置版本严格一致', () => {
    // Pdf 页直接引用 pdfjs-dist（worker 与类型），config.ts 还从其目录拷贝 cmaps/standard_fonts；
    // 版本错位会报 "API version does not match the Worker version"
    expect(readJson('package.json').dependencies['pdfjs-dist']).toBe(
      readJson('node_modules/react-pdf/package.json').dependencies['pdfjs-dist'],
    );
  });
});
