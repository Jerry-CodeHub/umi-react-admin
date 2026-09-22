import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url);
const script = fileURLToPath(new URL('check-dist-secrets.mjs', import.meta.url));

const ionSource = readFileSync(new URL('node_modules/@cesium/engine/Source/Core/Ion.js', root), 'utf8');
const cesiumDefaultToken = /defaultAccessToken\s*=\s*["'`]([^"'`]+)["'`]/.exec(ionSource)?.[1] ?? '';

// 伪造的 JWT 在运行时拼出，仓库文件里不出现 JWT 字面量（见 repo-hygiene.test.ts）
const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const fakeJwt = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ sub: 'fixture-only-not-a-secret' }),
  Buffer.from('signature-placeholder').toString('base64url'),
].join('.');

/** 以子进程运行门禁脚本，返回退出码与全部输出 */
const runScan = (distDir: string) => {
  try {
    return { code: 0, output: execFileSync(process.execPath, [script, distDir], { encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    const { status, stdout, stderr } = error as { status: number; stdout: string; stderr: string };
    return { code: status, output: `${stdout}${stderr}` };
  }
};

const tempDirs: string[] = [];
const makeDist = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'dist-secrets-'));
  tempDirs.push(dir);
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
};

describe('产物 JWT 泄露扫描', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('能从已安装的 Cesium 源码读到默认 token（白名单来源）', () => {
    expect(cesiumDefaultToken).toMatch(/^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+$/);
  });

  it('只含 Cesium 默认 token 时通过', () => {
    const { code, output } = runScan(makeDist({ 'cesium.js': `var t="${cesiumDefaultToken}";` }));
    expect(code).toBe(0);
    expect(output).toContain('放行 Cesium 自带的公开默认 ion token');
  });

  it('出现其他 JWT 时失败，只输出指纹与文件，不输出 token 值', () => {
    const { code, output } = runScan(
      makeDist({ 'cesium.js': `var t="${cesiumDefaultToken}";`, 'app.js': `const token = "${fakeJwt}";` }),
    );
    expect(code).toBe(1);
    expect(output).toContain(createHash('sha256').update(fakeJwt).digest('hex').slice(0, 12));
    expect(output).toContain('app.js');
    expect(output).not.toContain(fakeJwt);
    expect(output).not.toContain(cesiumDefaultToken);
  });

  it('产物目录不存在时失败', () => {
    expect(runScan(join(makeDist({}), 'missing')).code).toBe(1);
  });
});
