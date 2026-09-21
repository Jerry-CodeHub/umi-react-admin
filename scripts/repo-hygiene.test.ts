import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url);

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
});
