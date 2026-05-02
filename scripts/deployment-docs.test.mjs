import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('committable text files do not include JWT-like secrets', () => {
  const root = new URL('..', import.meta.url);
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => /\.(?:[cm]?[jt]sx?|json|md|ya?ml|env|css|less|html|txt)$/.test(file))
    .filter((file) => !file.endsWith('pnpm-lock.yaml'));
  const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;

  const offenders = files.filter((file) => jwtPattern.test(readFileSync(new URL(file, root), 'utf8')));

  assert.deepEqual(offenders, []);
});

test('committable files do not include local OS or IDE artifacts', () => {
  const root = new URL('..', import.meta.url);
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);

  const forbiddenPatterns = [/(^|\/)\.DS_Store$/, /^\.idea\//];
  const offenders = files.filter((file) => forbiddenPatterns.some((pattern) => pattern.test(file)));

  assert.deepEqual(offenders, []);
});
