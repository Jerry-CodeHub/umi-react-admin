import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('check-dist-secrets.mjs', import.meta.url));

// 与被测脚本同样经 cesium 包解析 @cesium/engine（传递依赖，不依赖 node_modules 提升）
const requireFromCesium = createRequire(createRequire(import.meta.url).resolve('cesium/package.json'));
const ionSource = readFileSync(
  join(dirname(requireFromCesium.resolve('@cesium/engine/package.json')), 'Source/Core/Ion.js'),
  'utf8',
);
const cesiumDefaultToken = /defaultAccessToken\s*=\s*["'`]([^"'`]+)["'`]/.exec(ionSource)?.[1] ?? '';

// 伪造的 JWT 在运行时拼出，仓库文件里不出现 JWT 字面量（见 repo-hygiene.test.ts）
const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const fakeJwt = [
  b64url({ alg: 'HS256', typ: 'JWT' }),
  b64url({ sub: 'fixture-only-not-a-secret' }),
  Buffer.from('signature-placeholder').toString('base64url'),
].join('.');

/** 以子进程运行门禁脚本，返回退出码与全部输出；extraEnv 可传 EXPECTED_TOKEN 等环境变量 */
const runScan = (distDir: string, extraEnv: Record<string, string> = {}) => {
  try {
    return {
      code: 0,
      output: execFileSync(process.execPath, [script, distDir], {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, ...extraEnv },
      }),
    };
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
    expect(output).toContain('放行公开 token（Cesium 默认 / EXPECTED_TOKEN 声明）');
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

  it('EXPECTED_TOKEN 声明的 token 被放行（部署产线的公开 ion token 通道）', () => {
    const { code, output } = runScan(makeDist({ 'app.js': `const token = "${fakeJwt}";` }), {
      EXPECTED_TOKEN: fakeJwt,
    });
    expect(code).toBe(0);
    expect(output).toContain('EXPECTED_TOKEN 声明的公开 token');
    // 声明值本身不得出现在输出里（CI 公开日志）
    expect(output).not.toContain(fakeJwt);
  });

  it('EXPECTED_TOKEN 设置了但不是合法 JWT 形态时失败（fail-closed）', () => {
    const { code, output } = runScan(makeDist({ 'app.js': 'ok' }), { EXPECTED_TOKEN: 'not-a-jwt' });
    expect(code).toBe(1);
    expect(output).toContain('EXPECTED_TOKEN');
  });

  it('检出 AWS Access Key 形态（非 JWT 第二层检测）', () => {
    const { code, output } = runScan(makeDist({ 'aws.js': 'var k = "AKIAIOSFODNN7EXAMPLE";' }));
    expect(code).toBe(1);
    expect(output).toContain('AWS Access Key ID');
    expect(output).toContain('aws.js');
  });

  it('检出 PEM 私钥块', () => {
    const { code, output } = runScan(
      makeDist({ 'key.txt': '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----' }),
    );
    expect(code).toBe(1);
    expect(output).toContain('PEM 私钥块');
  });

  it('产物目录不存在时失败', () => {
    expect(runScan(join(makeDist({}), 'missing')).code).toBe(1);
  });
});
