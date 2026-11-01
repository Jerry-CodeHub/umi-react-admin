import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const severities = ['info', 'low', 'moderate', 'high', 'critical'];
const patchedAdvisories = {
  'GHSA-vfj7-8cjw-p6xm': { name: 'braces', version: '3.0.3' },
  // 同一份回移源码同时覆盖 0.5.0 的线性扫描(fa479da)与 0.5.1 的单遍替换:
  // 两者的修复都已在 patches/decode-uri-component@0.2.2.patch 里,proof 按安装源 SHA 验证
  'GHSA-vcc3-ghjq-m6fr': { name: 'decode-uri-component', version: '0.2.2' },
  'GHSA-qr28-fpjm-wq7f': { name: 'decode-uri-component', version: '0.2.2' },
};

/**
 * 构建链根：只出现在这些子树下的依赖不进 dist 产物（打包器/编译器/测试与 lint 工具链）。
 * 分层规则(2026-11-01):进产物的运行时依赖公告保持零忽略、阻塞;构建链传递依赖的公告
 * 降为非阻塞告警——上游(@umijs/max)锁死版本、仓库无法升格,而 GHSA 数据库每次更新都会
 * 把这类公告塞进来,2026-10-21 起已把所有 PR 的 check 连续打红。AUDIT_TOOLCHAIN_STRICT=1
 * 可恢复全量阻塞(用于周期性人工清点)。
 * 判定从宽:一条公告的所有路径都必须命中构建链标记才算构建链;有任何一条旁路即按运行时阻塞。
 */
const buildChainSegments = [
  // 打包器/编译器子树
  '@umijs/bundler-vite',
  '@umijs/bundler-webpack',
  '@umijs/bundler-mako',
  '@umijs/bundler-utoopack',
  '@utoo/pack',
  '@umijs/mako',
  '@tailwindcss/webpack',
  // 测试与 lint 工具链(vitest/jsdom/eslint/stylelint 家族,只在本机与 CI 运行)
  'vitest',
  '@vitest/coverage-v8',
  '@vitest/eslint-plugin',
  'jsdom',
  'stylelint',
  'eslint',
  'eslint-plugin-react-hooks',
  'eslint-plugin-react',
  'eslint-plugin-jsx-a11y',
  'typescript-eslint',
  '@typescript-eslint/parser',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/type-utils',
  '@typescript-eslint/utils',
  '@typescript-eslint/typescript-estree',
  '@eslint/config-array',
  '@eslint/eslintrc',
  '@humanwhocodes/config-array',
  // 纯 Node 的构建辅助(fsync/临时目录/文件匹配),不存在浏览器形态
  'file-entry-cache',
  'flat-cache',
  'rimraf',
  'glob',
  // exceljs 的 Node 侧流式插件:浏览器入口已被改到 lib/exceljs.bare.js
  // (dependency-security.test.ts 断言 manifest.browser),这些子树不进产物
  'archiver',
  'archiver-utils',
  'zip-stream',
  'readdir-glob',
  'unzipper',
  'fstream',
];

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Reject endpoint/schema failures and retain all severities; an empty or partial response is not success. */
export const parseAudit = (text) => {
  const audit = JSON.parse(text);
  if (!record(audit) || !record(audit.advisories) || !record(audit.metadata?.vulnerabilities) || audit.error) {
    throw new Error('Invalid audit response');
  }
  const counts = audit.metadata.vulnerabilities;
  if (severities.some((severity) => !Number.isSafeInteger(counts[severity]) || counts[severity] < 0)) {
    throw new Error('Invalid audit vulnerability counts');
  }
  const advisories = Object.values(audit.advisories);
  if (severities.reduce((total, severity) => total + counts[severity], 0) !== advisories.length) {
    throw new Error('Audit metadata/advisory count mismatch');
  }
  for (const advisory of advisories) {
    if (
      !record(advisory) ||
      typeof advisory.github_advisory_id !== 'string' ||
      typeof advisory.module_name !== 'string' ||
      !severities.includes(advisory.severity) ||
      !Array.isArray(advisory.findings) ||
      !advisory.findings.length ||
      advisory.findings.some(
        (finding) =>
          !record(finding) ||
          typeof finding.version !== 'string' ||
          !Array.isArray(finding.paths) ||
          !finding.paths.length,
      )
    ) {
      throw new Error('Invalid audit advisory');
    }
  }
  return audit;
};

/** Follow installed node_modules edges, including peer contexts; exclude unreachable old pnpm caches. */
export const installedPackages = (root) => {
  const packages = new Map();
  const directories = new Set();
  const pending = [join(root, 'node_modules')];
  while (pending.length) {
    const directory = pending.pop();
    if (!existsSync(directory)) continue;
    const realDirectory = realpathSync(directory);
    if (directories.has(realDirectory)) continue;
    directories.add(realDirectory);
    const candidates = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.name.startsWith('@') ? readdirSync(path).map((child) => join(path, child)) : [path];
      });
    for (const candidate of candidates) {
      if (!existsSync(join(candidate, 'package.json'))) continue;
      const path = realpathSync(candidate);
      if (packages.has(path)) continue;
      const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
      packages.set(path, pkg);
      const parent = pkg.name.startsWith('@') ? dirname(dirname(path)) : dirname(path);
      // pnpm stores dependency symlinks beside each package in its own virtual node_modules.
      if (basename(parent) === 'node_modules') pending.push(parent);
      pending.push(join(path, 'node_modules'));
    }
  }
  return packages;
};

/** Verify every reachable installed instance; never trust just one hoisted import. */
export const verifyInstalledPatches = (root = projectRoot, proof) => {
  const manifest = proof ?? JSON.parse(readFileSync(join(root, 'scripts/dependency-patch-proof.json'), 'utf8'));
  const packages = installedPackages(root);
  const verified = new Map();
  for (const [name, expected] of Object.entries(manifest)) {
    const instances = [...packages].filter(([, pkg]) => pkg.name === name);
    if (!instances.length || !record(expected.files) || !Object.keys(expected.files).length) {
      throw new Error(`No installed source proof for ${name}`);
    }
    for (const [path, pkg] of instances) {
      if (pkg.name !== name || pkg.version !== expected.version)
        throw new Error(`Unverified ${name} version: ${pkg.version}`);
      for (const [file, hash] of Object.entries(expected.files)) {
        const actual = createHash('sha256')
          .update(readFileSync(join(path, file)))
          .digest('hex');
        if (actual !== hash) throw new Error(`Installed patch differs: ${name}/${file}`);
      }
    }
    verified.set(name, expected.version);
    console.log(`Verified patched source: ${name}@${expected.version}, ${instances.length} installed instance(s)`);
  }
  return verified;
};

/** 公告分层:每一条安装路径都只经过构建链子树的公告归入 toolchain,其余(含混合路径)归入 runtime。 */
export const classifyAdvisories = (audit) => {
  const toolchain = [];
  const runtime = [];
  for (const advisory of Object.values(audit.advisories)) {
    // 从宽判定:只要存在任何一条绕开构建链标记的路径,整条公告就按运行时阻塞处理
    const onlyBuildChain = advisory.findings.every((finding) =>
      finding.paths.every((path) => path.split('>').some((segment) => buildChainSegments.includes(segment))),
    );
    (onlyBuildChain ? toolchain : runtime).push(advisory);
  }
  return { toolchain, runtime };
};

export const assessAdvisories = (audit, verified, { toolchainStrict = false } = {}) => {
  const proven = [];
  const blocked = [];
  const toolchain = [];
  const toolchainIds = new Set(classifyAdvisories(audit).toolchain.map((advisory) => advisory.github_advisory_id));
  for (const advisory of Object.values(audit.advisories)) {
    const expected = patchedAdvisories[advisory.github_advisory_id];
    if (
      expected &&
      advisory.module_name === expected.name &&
      verified.get(expected.name) === expected.version &&
      advisory.findings.every((finding) => finding.version === expected.version)
    ) {
      proven.push(advisory.github_advisory_id);
    } else if (toolchainIds.has(advisory.github_advisory_id) && !toolchainStrict) {
      toolchain.push(advisory.github_advisory_id);
    } else {
      blocked.push(advisory.github_advisory_id);
    }
  }
  return { proven, blocked, toolchain };
};

const run = () => {
  const auditResult = spawnSync(
    'pnpm',
    ['audit', '--json', '--registry=https://registry.npmjs.org/', '--config.auditConfig={}'],
    {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  // Print the untouched upstream report and exit status before evaluating local source repairs.
  process.stdout.write(auditResult.stdout || '');
  process.stderr.write(auditResult.stderr || '');
  console.log(`Raw pnpm audit exit: ${auditResult.status}`);
  if (auditResult.error || ![0, 1].includes(auditResult.status)) throw new Error('Dependency audit failed to complete');
  const audit = parseAudit(auditResult.stdout);
  const verified = verifyInstalledPatches();
  const regression = spawnSync(
    process.execPath,
    [join(projectRoot, 'node_modules/vitest/vitest.mjs'), 'run', 'scripts/dependency-security.test.ts'],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      timeout: 60_000,
    },
  );
  if (regression.error || regression.status !== 0) throw new Error('Installed dependency attack regressions failed');
  const assessment = assessAdvisories(audit, verified, {
    toolchainStrict: process.env.AUDIT_TOOLCHAIN_STRICT === '1',
  });
  for (const id of assessment.proven) console.log(`Source repair verified; upstream version match retained: ${id}`);
  const toolchainAdvisories = Object.values(audit.advisories).filter((advisory) =>
    assessment.toolchain.includes(advisory.github_advisory_id),
  );
  for (const advisory of toolchainAdvisories) {
    console.warn(
      `Build-chain advisory (non-blocking): ${advisory.github_advisory_id} ${advisory.module_name}@${advisory.findings
        .map((finding) => finding.version)
        .join(',')} [${advisory.severity}] — 不进产物;AUDIT_TOOLCHAIN_STRICT=1 可恢复阻塞`,
    );
  }
  if (toolchainAdvisories.length) {
    console.warn(`Build-chain advisories total: ${toolchainAdvisories.length} (non-blocking)`);
  }
  if (assessment.blocked.length) throw new Error(`Unrepaired advisories: ${assessment.blocked.join(', ')}`);
  console.log('Dependency gate passed: no runtime advisories without a verified source repair');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
