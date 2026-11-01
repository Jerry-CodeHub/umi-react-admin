import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ComponentType, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const store = join(root, 'node_modules/.pnpm');
const read = (path: string) => readFileSync(path, 'utf8');
const lockSource = read(join(root, 'pnpm-lock.yaml'));

// Resolve the actual pnpm-installed package, including its patch/peer suffix.
// These are dependency-boundary tests, so transitive packages are deliberately
// loaded from their own declared dependency context rather than hoisted imports.
const installed = (name: string, version: string) => {
  const prefix = `${name.replace('/', '+')}@${version}`;
  const patchHash = lockSource
    .split('\n')
    .map((line) => line.match(/^  ['"]?([^'"]+)['"]?: ([a-f0-9]{64})$/))
    .find((match) => match?.[1] === `${name}@${version}`)?.[2];
  const candidates = readdirSync(store)
    .filter((entry) => entry === prefix || entry.startsWith(`${prefix}_`))
    // pnpm truncates long directory names before its peer-context hash.
    .filter((entry) => !patchHash || entry.includes(`_patch_hash=${patchHash.slice(0, 32)}`))
    .sort(
      (a, b) =>
        Number(b.includes('_patch_hash=')) - Number(a.includes('_patch_hash=')) ||
        Number(b.includes('react@19.3.0')) - Number(a.includes('react@19.3.0')),
    );
  const directory = candidates.map((entry) => join(store, entry, 'node_modules', name))[0];
  if (!directory) throw new Error(`Missing installed package ${name}@${version}`);
  return directory;
};
const context = (name: string, version: string) => createRequire(join(installed(name, version), 'package.json'));
const yamlContext = context('yaml', '2.8.3');
const yamlName = 'yaml';
const yaml = yamlContext(yamlName) as { parse: (source: string) => unknown };
type Lock = { packages: Record<string, unknown>; patchedDependencies: Record<string, string> };
type Workspace = { patchedDependencies: Record<string, string>; auditConfig?: unknown };
const lock = yaml.parse(read(join(root, 'pnpm-lock.yaml'))) as Lock;
const workspace = yaml.parse(read(join(root, 'pnpm-workspace.yaml'))) as Workspace;

type Ast = { type: string; value?: string; nodes?: Ast[]; parent?: Ast };
type Options = Record<string, unknown>;
type Braces = ((input: string | string[], options?: Options) => string[]) & {
  parse: (input: string, options?: Options) => Ast;
  compile: (input: string | Ast, options?: Options) => string;
  expand: (input: string | Ast, options?: Options) => string[];
  stringify: (input: string | Ast, options?: Options) => string;
};
const bracesName = 'braces';
const braces = context(bracesName, '3.0.3')(bracesName) as Braces;

describe('真实安装依赖的安全修复', () => {
  it('补丁文件内容与锁文件哈希一致，审计没有忽略项', () => {
    expect(workspace.auditConfig).toBeUndefined();
    expect(Object.keys(workspace.patchedDependencies).sort()).toEqual(Object.keys(lock.patchedDependencies).sort());
    for (const [name, path] of Object.entries(workspace.patchedDependencies)) {
      expect(
        createHash('sha256')
          .update(read(join(root, path)))
          .digest('hex'),
      ).toBe(lock.patchedDependencies[name]);
    }
  });

  it('移除未使用的 Umi 工具和 ECC 链，保留真实库版本', () => {
    const packages = Object.keys(lock.packages);
    const removed = ['@umijs/test', '@umijs/lint', 'sprintf-js', 'elliptic', 'crypto-browserify'];
    expect(packages.filter((id) => removed.some((name) => id.startsWith(`${name}@`)))).toEqual([]);
    expect(packages.filter((id) => id.startsWith('uuid@'))).toEqual(['uuid@11.1.1']);
    expect(packages.filter((id) => id.startsWith('postcss-selector-parser@'))).toEqual([
      'postcss-selector-parser@7.1.6',
    ]);
    expect(packages.filter((id) => /^react-router(?:-dom)?@6\./.test(id))).toEqual([]);
    expect(packages).toContain('react-router@7.18.2');
    expect(packages).toContain('react-router-dom@7.18.2');
    // Keep actual patched versions; npm audit must still see their real version.
    expect(packages).toContain('braces@3.0.3');
    expect(packages).toContain('decode-uri-component@0.2.2');
  });

  it.each(['node-libs-browser', 'node-libs-browser-okam'])('关闭 %s 的通用 crypto fallback', (name) => {
    const version = name.endsWith('-okam') ? '2.2.5' : '2.2.1';
    expect((context(name, version)(name) as { crypto: unknown }).crypto).toBeNull();
  });

  it('Router 7 的 Umi 浏览器导出与真实 StaticRouter 渲染兼容', () => {
    const renderer = installed('@umijs/renderer-react', '4.7.22');
    const load = createRequire(join(renderer, 'package.json'));
    const reactName = 'react';
    const domName = 'react-dom/server';
    const routerName = 'react-router';
    const routerDomName = 'react-router-dom';
    const react = load(reactName) as typeof import('react');
    const server = load(domName) as typeof import('react-dom/server');
    type Routing = {
      StaticRouter: ComponentType<{ location: string; children: ReactNode }>;
      Routes: ComponentType<{ children: ReactNode }>;
      Route: ComponentType<{ path: string; element: ReactNode }>;
      Link: ComponentType<{ to: string; children: ReactNode }>;
      [name: string]: unknown;
    };
    const router = load(routerName) as Routing;
    const dom = load(routerDomName) as Routing;
    const used = ['Router', 'useRoutes', 'matchRoutes', 'useNavigate', 'useLocation', 'useParams', 'useSearchParams'];
    expect(used.filter((name) => typeof dom[name] !== 'function')).toEqual([]);
    expect(read(join(renderer, 'dist/server.js'))).toMatch(
      /import\s+\{\s*StaticRouter\s*\}\s+from\s+['"]react-router['"]/,
    );
    const html = server.renderToString(
      react.createElement(router.StaticRouter, {
        location: '/reports',
        children: react.createElement(dom.Routes, {
          children: react.createElement(dom.Route, {
            path: '/reports',
            element: react.createElement(dom.Link, { to: '/reports/detail', children: 'report' }),
          }),
        }),
      }),
    );
    expect(html).toContain('href="/reports/detail"');
    expect(html).toContain('report');
  });

  it('selector parser 保留普通选择器并处理公告中的扁平 class token', () => {
    const name = 'postcss-selector-parser';
    const parser = context(name, '7.1.6')(name) as () => {
      processSync: (input: string) => string;
      astSync: (input: string) => { first: { nodes: { type: string }[] } };
    };
    const selector = '.foo\\:bar[data-label="中 文"]:is(.a,#b)';
    expect(parser().processSync(selector)).toBe(selector);
    const flat = '.a'.repeat(256);
    expect(parser().astSync(flat).first.nodes).toHaveLength(256);
    expect(parser().processSync(flat)).toBe(flat);
  });
});

describe('braces 的有界解析和展开', () => {
  it('每个直接消费者都解析到锁文件指定的真实补丁实例', () => {
    const actualEntry = join(installed(bracesName, '3.0.3'), 'index.js');
    for (const [name, version] of [
      ['micromatch', '4.0.8'],
      ['chokidar', '3.5.3'],
      ['chokidar', '3.6.0'],
    ]) {
      expect(context(name, version).resolve(bracesName)).toBe(actualEntry);
    }
  });
  it.each(['{', '('])('对嵌套 %s 在递归前拒绝，不受 rangeLimit=false 绕过', (token) => {
    const close = token === '{' ? '}' : ')';
    const pattern = token.repeat(65) + 'x' + close.repeat(65);
    for (const entry of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
      expect(() => entry(pattern, { rangeLimit: false, maxLength: Infinity })).toThrow(
        /braces resource limit exceeded: parse depth/,
      );
    }
  });

  it('允许边界内的深度及普通 glob、转义、区间和空分支', () => {
    expect(braces.parse('('.repeat(64) + 'x' + ')'.repeat(64)).type).toBe('root');
    expect(braces.compile('src/{pages,utils}/**/*.{ts,tsx}')).toBe('src/(pages|utils)/**/*.(ts|tsx)');
    expect(braces.expand('v{01..03}-{a,b}')).toEqual(['v01-a', 'v01-b', 'v02-a', 'v02-b', 'v03-a', 'v03-b']);
    expect(braces.expand('{,a}')).toEqual(['', 'a']);
    expect(braces.expand('a\\{b,c\\}')).toEqual(['a{b,c}']);
    expect(braces.stringify('foo/{a,b}/bar')).toBe('foo/{a,b}/bar');
    expect(braces.expand('{3..1}')).toEqual(['3', '2', '1']);
  });

  it('手工 AST 不能绕过深度和循环限制', () => {
    const ast: Ast = { type: 'root', nodes: [] };
    let node = ast;
    for (let index = 0; index < 65; index++) {
      const next: Ast = { type: 'paren', nodes: [], parent: node };
      node.nodes = [next];
      node = next;
    }
    node.nodes = [{ type: 'text', value: 'x', parent: node }];
    for (const entry of [braces.compile, braces.expand, braces.stringify]) {
      expect(() => entry(ast)).toThrow(/braces resource limit exceeded: AST/);
    }
    const cycle: Ast = { type: 'root', nodes: [] };
    cycle.nodes = [cycle];
    expect(() => braces.compile(cycle)).toThrow(/cyclic/);
    const parentCycle: Ast = { type: 'root', nodes: [] };
    parentCycle.parent = parentCycle;
    expect(() => braces.expand(parentCycle)).toThrow(/cyclic AST parent/);
  });

  it('连乘展开、倒序区间和多 pattern 总量都明确拒绝超限', () => {
    expect(() => braces.expand('{a,b}'.repeat(10))).toThrow(/expanded paths/);
    expect(braces.expand('{1..1000}')).toHaveLength(1000);
    expect(() => braces.expand('{1..1001}', { rangeLimit: false })).toThrow(/range length/);
    expect(() => braces.expand('{1001..1}', { rangeLimit: Infinity })).toThrow(/range length/);
    expect(() => braces.compile('{1..1001..1}')).toThrow(/range length/);
    expect(() => braces(Array(1001).fill('a'), { expand: true })).toThrow(/expanded paths/);
  });

  it('在分配超预算字符串前拒绝重复展开输出', () => {
    // An 8 KiB input reaches the 1 MiB output guard without allocating the
    // requested Cartesian result. Only the patched package is executed.
    expect(() => braces.expand(`${'x'.repeat(8000)}{1..140}`)).toThrow(/output bytes|expansion work/);
  });
});

describe('decode-uri-component 的官方回移', () => {
  const name = 'decode-uri-component';
  const decode = context(name, '0.2.2')(name) as (value: unknown) => string;

  it('保留 CommonJS、表单加号与有效 UTF-8 解码', () => {
    expect(typeof decode).toBe('function');
    expect(decode('a+b%2Bc')).toBe('a b+c');
    expect(decode('%E4%B8%AD%E6%96%87%F0%9F%98%80')).toBe('中文😀');
    expect(decode('%')).toBe('%');
    expect(decode('%41%FF%42')).toBe('A%FFB');
    expect(() => decode(null)).toThrow(TypeError);
  });

  it('公告中的损坏 continuation run 使用单向迭代并保持 query-string 功能', () => {
    expect(decode('%80'.repeat(64))).toBe('%80'.repeat(64));
    const queryName = 'query-string';
    const query = context(queryName, '6.14.1')(queryName) as { parse: (value: string) => Record<string, string> };
    expect(context(queryName, '6.14.1').resolve(name)).toBe(join(installed(name, '0.2.2'), 'index.js'));
    expect(query.parse('label=a+b&bad=%41%FF%42')).toEqual({ label: 'a b', bad: 'A%FFB' });
    const source = read(join(installed(name, '0.2.2'), 'index.js'));
    expect(source).toContain('while (position < input.length)');
    expect(source).not.toContain('decodeComponents');
  });

  it('GHSA-qr28:百分号编码串单遍替换,不再有二次方 replaceMap 循环', () => {
    // 上游 0.5.1 的两个特例随单遍扫描落在 decode() 内:UTF-16 BOM 与截断的 %C2
    expect(decode('%FE%FF')).toBe('\uFFFD\uFFFD');
    expect(decode('%FF%FE')).toBe('\uFFFD\uFFFD');
    expect(decode('%C2')).toBe('\uFFFD');
    expect(decode('a%C2b')).toBe('a\uFFFDb');
    const source = read(join(installed(name, '0.2.2'), 'index.js'));
    expect(source).toContain('input.replace(multiMatcher');
    expect(source).not.toContain('replaceMap');
    // 大量互不相同的编码串(旧实现的 replaceMap 逐 key 全串扫描是二次方)单遍正确解码
    const big = Array.from({ length: 4000 }, (_, index) => `%${(0x41 + (index % 26)).toString(16)}${index % 10}`).join(
      '',
    );
    const decoded = decode(big);
    expect(decoded).not.toContain('%41');
    expect(decoded.length).toBeLessThanOrEqual(big.length);
  });
});

describe('Excel 的真实浏览器工作簿与密码保护', () => {
  const excelName = 'exceljs';
  const directory = installed(excelName, '4.4.0');
  const load = createRequire(join(directory, 'package.json'));
  const encryptorName = './lib/utils/encryptor.js';
  const encryptor = load(encryptorName) as {
    hash: (algorithm: string, ...buffers: Buffer[]) => Buffer;
    convertPasswordToHash: (password: string, algorithm: string, salt: string, count: number) => string;
    randomBytes: (size: number) => Buffer;
  };

  it.each(['md5', 'ripemd160', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'])(
    '保留 %s 的真实哈希能力',
    (algorithm) => {
      const value = Buffer.from('Excel protection regression');
      expect(encryptor.hash(algorithm, value)).toEqual(createHash(algorithm).update(value).digest());
    },
  );

  it('密码 spin hash 和安全随机字节保持功能，无通用 crypto 依赖', () => {
    const salt = Buffer.from('bounded-salt-1234');
    const password = Buffer.from('密码', 'utf16le');
    let expected = createHash('sha512')
      .update(Buffer.concat([salt, password]))
      .digest();
    for (let index = 0; index < 2; index++) {
      const iterator = Buffer.alloc(4);
      iterator.writeUInt32LE(index);
      expected = createHash('sha512')
        .update(Buffer.concat([expected, iterator]))
        .digest();
    }
    expect(encryptor.convertPasswordToHash('密码', 'SHA512', salt.toString('base64'), 2)).toBe(
      expected.toString('base64'),
    );
    expect(encryptor.randomBytes(16)).toBeInstanceOf(Uint8Array);
    expect(encryptor.randomBytes(16)).toHaveLength(16);
    expect(() => encryptor.convertPasswordToHash('p', 'unknown', salt.toString('base64'), 1)).toThrow(/not supported/);
    const manifest = JSON.parse(read(join(directory, 'package.json'))) as { browser: string };
    expect(manifest.browser).toBe('./lib/exceljs.bare.js');
    expect(read(join(directory, 'lib/utils/encryptor.js'))).not.toContain("require('crypto')");
    const hashName = 'create-hash/browser';
    const randomName = 'randombytes/browser';
    expect(dirname(load.resolve(hashName))).toContain('create-hash');
    expect(dirname(load.resolve(randomName))).toContain('randombytes');
  });

  it('真实 bare 入口可导出并重读保护工作簿，UUID v4 调用兼容', async () => {
    const bareName = './lib/exceljs.bare.js';
    const excel = load(bareName) as typeof import('exceljs');
    const workbook = new excel.Workbook();
    const sheet = workbook.addWorksheet('regression');
    sheet.getCell('A1').value = 'workbook round trip';
    await sheet.protect('password', { spinCount: 2 });
    const buffer = await workbook.xlsx.writeBuffer();
    const restored = new excel.Workbook();
    await restored.xlsx.load(buffer);
    expect(restored.getWorksheet('regression')?.getCell('A1').value).toBe('workbook round trip');
    const uuidName = 'uuid';
    const uuid = load(uuidName) as { v4: () => string; validate: (value: string) => boolean };
    expect(uuid.validate(uuid.v4())).toBe(true);
  });
});
