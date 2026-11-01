import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(root, 'dist');
const indexPath = join(distDir, 'index.html');
/** 构建模式随产物落盘（config/buildInfo.ts 写 dist/version.json），不从旁路缓存推断 */
const versionPath = join(distDir, 'version.json');

/** 演示数据/演示后端的专属字符串：真实模式产物里一个都不该出现 */
const DEMO_DATA_MARKERS = [
  'WO-SCN-HIST', // src/demo/scenarios.ts 固定场景（历史告警工单）
  'ALM-SCN', // 同上的场景 ID 前缀（ALM-SCN-MAIN / -HIST / …）
  'umi-react-admin:demo-store', // src/demo/store.ts 补丁存储键（generate.ts/scenarios.ts 在它后面）
  'umi-react-admin-demo-users', // 同上的历史遗留存储键
];

/** adapter 替身哨兵：出现即证明 config/config.ts 的真实模式 alias 生效（正控制） */
const STUB_SENTINEL = '__REAL_MODE_ADAPTER_STUB__';
/** token 替身哨兵：第二个 alias（src/demo/token.real.ts）同样要有正控制 */
const TOKEN_STUB_SENTINEL = '__REAL_MODE_TOKEN_STUB__';
/**
 * clock 替身哨兵：第三个 alias（src/demo/clock.real.ts）。now.ts 只被页面引用，
 * 该哨兵只会出现在异步 chunk，因此它的正控制扫描整个 dist 而不只是入口。
 */
const CLOCK_STUB_SENTINEL = '__REAL_MODE_CLOCK_STUB__';

/**
 * 门禁上下文（CI 的 build:real 作业）用 REAL_MODE_ARTIFACT_REQUIRED=1 声明「这里必须是真实模式产物」：
 * 此时产物缺失或不是真实模式一律失败，绝不跳过——CI 里静默跳过的断言等于装饰。
 * 未声明时（本地、CI 的 check 作业）：有产物就按产物模式断言，没有产物才跳过。
 */
const requireRealMode = process.env.REAL_MODE_ARTIFACT_REQUIRED === '1';
const artifactExists = existsSync(indexPath);

/** 从产物自身读模式；读不出就是失败信号（旧产物 / 构建管线漏写），不能用缓存文件兜底 */
const readArtifactMode = (): boolean => {
  const raw = readFileSync(versionPath, 'utf8');
  const parsed = JSON.parse(raw) as { demoMode?: unknown };
  if (typeof parsed.demoMode !== 'boolean') {
    throw new Error(
      `${versionPath} 缺少布尔字段 demoMode（config/buildInfo.ts 应写入）——无法判定产物属于哪条产线，` +
        '也就无法判定该断言「不含演示数据」还是「含演示数据」。请重新构建，不要用缓存文件兜底。',
    );
  }
  return parsed.demoMode;
};

if (!artifactExists) {
  if (requireRealMode) {
    throw new Error(
      'REAL_MODE_ARTIFACT_REQUIRED=1 要求真实模式产物，但 dist/index.html 不存在：' +
        '本作业必须在 build:real 之后运行（CI 见 .github/workflows/ci.yml 的 build:real 分支）。',
    );
  }
  console.warn(
    '[real-mode-artifact] 未找到 dist/index.html：无产物可断言，本套用例跳过。' +
      'Q3 的强制断言在 CI 的 build:real 作业里执行（REAL_MODE_ARTIFACT_REQUIRED=1，产物必须存在且为真实模式）。',
  );
}

if (artifactExists && requireRealMode && readArtifactMode() !== false) {
  throw new Error(
    'REAL_MODE_ARTIFACT_REQUIRED=1 要求真实模式产物，但 dist/version.json 的 demoMode 不是 false：' +
      '本作业的构建命令与断言口径不一致（应为 build:real）。',
  );
}

/** 产物内路径（可带 publicPath 前缀，如 /umi-react-admin/umi.js）→ dist 内文件 */
const distFile = (src: string) => {
  const rel = src.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
  const direct = join(distDir, rel);
  if (existsSync(direct)) return direct;
  const stripped = join(distDir, rel.split('/').slice(1).join('/'));
  return existsSync(stripped) ? stripped : null;
};

/** index.html 中的同步脚本（非 async/defer）= 首屏必须下载的入口 chunk */
const entryChunks = () => {
  const html = readFileSync(indexPath, 'utf8');
  return (html.match(/<script\b[^>]*>/g) || [])
    .filter((tag) => !/\b(async|defer)\b/.test(tag))
    .map((tag) => tag.match(/src="([^"]+)"/)?.[1])
    .filter((src): src is string => Boolean(src))
    .map((src) => ({ src, file: distFile(src) }))
    .filter((entry): entry is { src: string; file: string } => entry.file !== null)
    .map((entry) => ({ src: entry.src, text: readFileSync(entry.file, 'utf8') }));
};

/** 含指定字符串的入口 chunk（src 列表），断言失败时直接指出是哪个文件 */
const entryChunksContaining = (marker: string) =>
  entryChunks()
    .filter((chunk) => chunk.text.includes(marker))
    .map((chunk) => chunk.src);

/**
 * 有产物才跑（CI 的 check 作业在任何构建之前跑 vitest，没有产物可断言）；
 * 有产物时按产物自身的模式断言，两种方向都是实断言，不存在「跳过即通过」。
 */
(artifactExists ? describe : describe.skip)('产物模式断言（Q3：真实模式不打包演示代码）', () => {
  // describe.skip 仍会执行这个回调来收集用例：无产物时不能读 version.json（CI 的 check 作业就是这种情况）
  const demoMode = artifactExists ? readArtifactMode() : undefined;

  it('入口同步脚本可解析，且产物模式可判定', () => {
    expect(entryChunks().length).toBeGreaterThan(0);
    expect(typeof demoMode).toBe('boolean');
  });

  /**
   * 真实模式（UMI_APP_DEMO_MODE=false UMI_APP_API_BASE=/ pnpm build 或 pnpm build:real）：
   * requestConfig 顶层 import '@/demo/adapter' 经 config/config.ts 的 alias 换成替身，
   * store → generate → scenarios 这条静态链随之中断，演示数据不再进入首屏。
   * 断言用产物原文而不是 import 图：打包器的 tree-shaking 结果只有产物说了算。
   */
  it.skipIf(demoMode !== false)('真实模式入口 chunk 不含任何演示数据标记', () => {
    for (const marker of DEMO_DATA_MARKERS) {
      expect(entryChunksContaining(marker), `标记 ${marker} 出现在入口 chunk`).toEqual([]);
    }
  });

  /**
   * 正控制：只做「不存在」断言时，一个什么都没打包进去的空产物同样能过。
   * 哨兵来自 src/demo/adapter.real.ts——它出现在真实模式入口，才证明 alias 真的替换成功。
   */
  it.skipIf(demoMode !== false)('真实模式入口 chunk 含 adapter 替身哨兵（证明 alias 生效）', () => {
    expect(entryChunksContaining(STUB_SENTINEL), `入口 chunk 未出现 ${STUB_SENTINEL}`).not.toEqual([]);
  });

  /** 入口之外也要求干净：演示后端/生成器整块不应存在于真实模式产物（含异步 chunk） */
  it.skipIf(demoMode !== false)('真实模式产物中不存在演示后端/生成器 chunk', () => {
    const hits = readdirSync(distDir)
      .filter((name) => name.endsWith('.js'))
      .filter((name) => {
        const text = readFileSync(join(distDir, name), 'utf8');
        return DEMO_DATA_MARKERS.some((marker) => text.includes(marker));
      });
    expect(hits, `以下产物仍含演示数据标记: ${hits.join(', ')}`).toEqual([]);
  });

  /**
   * 第三个正控制：clock 替身哨兵。alias 换掉的是懒加载 chunk 里的 '@/demo/clock'，
   * 只扫入口必然漏报 —— 扫全部 .js，出现即证明第三个 alias 真的生效；
   * 顺带断言演示时钟存储键在异步 chunk 里也消失（这正是加该替身的动机）。
   */
  it.skipIf(demoMode !== false)('真实模式产物含 clock 替身哨兵，且异步 chunk 无演示时钟存储键', () => {
    const jsFiles = readdirSync(distDir).filter((name) => name.endsWith('.js'));
    const withSentinel = jsFiles.filter((name) =>
      readFileSync(join(distDir, name), 'utf8').includes(CLOCK_STUB_SENTINEL),
    );
    expect(withSentinel, '产物未出现 clock 替身哨兵（第三个 alias 未生效）').not.toEqual([]);
    const withClockKey = jsFiles.filter((name) =>
      readFileSync(join(distDir, name), 'utf8').includes('umi-react-admin:demo-clock'),
    );
    expect(withClockKey, '以下异步 chunk 仍含演示时钟存储键').toEqual([]);
  });

  /** 真实模式残留面：demo 时钟存储键（旧 adapter → clock 链）与 demo token 前缀都不该出现在入口 */
  it.skipIf(demoMode !== false)('真实模式入口 chunk 不含 demo 时钟存储键与 demo token 前缀', () => {
    expect(entryChunksContaining('umi-react-admin:demo-clock')).toEqual([]);
    // 只匹配被引号包住的 'demo.' 字面量，避免误伤真实模式仍在用的 'system.demo.reset' 权限键
    // 与 '/api/v1/demo/...' 路径字符串
    const withTokenLiteral = entryChunks()
      .filter((chunk) => /["'`]demo\.["'`]/.test(chunk.text))
      .map((chunk) => chunk.src);
    expect(withTokenLiteral, '入口 chunk 出现 demo token 前缀字面量').toEqual([]);
  });

  /**
   * 第二个正控制：token 替身哨兵。没有它，「'demo.' 字面量消失」也可能只是压缩器的巧合，
   * 无法区分「alias 生效」与「碰巧被删」。
   */
  it.skipIf(demoMode !== false)('真实模式入口 chunk 含 token 替身哨兵（证明第二个 alias 生效）', () => {
    expect(entryChunksContaining(TOKEN_STUB_SENTINEL), `入口 chunk 未出现 ${TOKEN_STUB_SENTINEL}`).not.toEqual([]);
  });

  /**
   * 反向断言（演示构建时必须成立）：哨兵不得出现在演示产物里——演示构建走真实 adapter，
   * alias 只在 demoMode=false 时生效；同时用演示标记做正控制，避免「标记清单写错导致两边都空过」。
   */
  it.skipIf(demoMode !== true)('演示模式入口 chunk 不含替身哨兵，且确实包含演示数据（标记检测有效）', () => {
    expect(entryChunksContaining(STUB_SENTINEL), '演示产物不应出现真实模式 adapter 替身').toEqual([]);
    expect(entryChunksContaining(TOKEN_STUB_SENTINEL), '演示产物不应出现真实模式 token 替身').toEqual([]);
    expect(entryChunksContaining('ALM-SCN').length).toBeGreaterThan(0);
    expect(entryChunksContaining('umi-react-admin:demo-store').length).toBeGreaterThan(0);
  });

  /** 反向断言的异步面：演示构建走真实 clock，clock 替身哨兵不得出现在任何 chunk */
  it.skipIf(demoMode !== true)('演示模式产物不含 clock 替身哨兵', () => {
    const hits = readdirSync(distDir)
      .filter((name) => name.endsWith('.js'))
      .filter((name) => readFileSync(join(distDir, name), 'utf8').includes(CLOCK_STUB_SENTINEL));
    expect(hits, '演示产物不应出现真实模式 clock 替身').toEqual([]);
  });
});
