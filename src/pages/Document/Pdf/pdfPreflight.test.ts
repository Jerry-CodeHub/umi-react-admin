import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  annotationHeavyPdf,
  buildPdfBytes,
  buildRawPdfBytes,
  contentOnlyPdf,
  declaredCountBombPdf,
  deepPageTreePdf,
  fontHeavyPdf,
  notAPdf,
  objectStreamPdf,
  streamBody,
  textBytes,
  twoPageReportPdf,
} from './pdfFixtures';
import {
  PDF_PREFLIGHT_BUDGETS,
  PdfPreflightAborted,
  countTextOperators,
  preflightFailure,
  preflightPdf,
  summarizePreflight,
} from './pdfPreflight';
import { buildImagePdf } from './pdfWriter';

/** 本机长期高负载，解码较重的用例放宽超时；断言本身不放松。 */
const HEAVY = { timeout: 120_000 } as const;
const flate = (payload: Uint8Array) => new Uint8Array(deflateSync(payload));

/** 近似不可压缩的数据：保证「压缩后长度」与原始长度同量级，便于断言保守估算值。 */
const incompressible = (length: number) => {
  const bytes = new Uint8Array(length);
  // xorshift32 + 取高位字节：LCG 的低字节周期极短，会被 deflate 压到几百字节而破坏前提
  let state = 0x1f123bb5;
  for (let index = 0; index < length; index++) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = (state >>> 24) & 0xff;
  }
  return bytes;
};

/** 单页 + 一个 FlateDecode 内容流：把巨大的解码结果压成几 KB。 */
const flateContentPdf = (payload: Uint8Array, filter = '/Filter /FlateDecode') =>
  buildPdfBytes([
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>' },
    { id: 4, body: streamBody(filter, flate(payload)) },
  ]);

/** 单页 + 一个内嵌字体：内容流与 FontFile2 都走 FlateDecode。 */
const flateFontPdf = (payload: Uint8Array) =>
  buildPdfBytes([
    { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
    { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    {
      id: 3,
      body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R >> >> >>',
    },
    { id: 4, body: '<< /Type /Font /Subtype /TrueType /BaseFont /Test /FontDescriptor 5 0 R >>' },
    { id: 5, body: '<< /Type /FontDescriptor /FontName /Test /FontFile2 6 0 R >>' },
    { id: 6, body: streamBody('/Filter /FlateDecode', flate(payload)) },
  ]);

describe('正常文档不被误杀（预算之外的路径必须仍然可用）', () => {
  it('接受结构完整的两页报告夹具', () => {
    const report = preflightPdf(twoPageReportPdf());
    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
    expect(report.stats.parsed).toBe(true);
    expect(report.stats.pages).toBe(2);
    expect(report.stats.annotations).toBe(0);
    expect(report.stats.fonts).toBe(0);
    expect(report.stats.objectStreams).toBe(0);
    expect(report.stats.textOperators).toBe(0);
    expect(report.stats.structureErrors).toBe(0);
    expect(report.stats.streams).toBeGreaterThanOrEqual(4);
  });

  it('接受 pdfWriter 真实产出的两页图片报告', () => {
    const generated = buildImagePdf([
      { jpeg: new Uint8Array(1024).fill(1), width: 794, height: 1123 },
      { jpeg: new Uint8Array(1024).fill(2), width: 794, height: 1123 },
    ]);
    const report = preflightPdf(generated);
    expect(report.ok).toBe(true);
    expect(report.stats.parsed).toBe(true);
    expect(report.stats.pages).toBe(2);
    // 图片是 DCTDecode：按压缩长度计入，不做像素展开（由 PDF.js maxImageSize 约束）
    expect(report.stats.decodedStreamBytes).toBeGreaterThan(0);
    expect(report.stats.estimatedFilterStreams).toBe(0);
  });

  it('页树深度与注释数在预算内时不报违规', () => {
    expect(preflightPdf(deepPageTreePdf(10)).ok).toBe(true);
    expect(preflightPdf(annotationHeavyPdf(50)).ok).toBe(true);
    expect(preflightPdf(fontHeavyPdf(8)).ok).toBe(true);
  });

  it('解析现代布局：未压缩对象流里的目录 + 无 trailer 的 xref 流', () => {
    const report = preflightPdf(objectStreamPdf());
    expect(report.ok).toBe(true);
    expect(report.stats.parsed).toBe(true);
    expect(report.stats.objectStreams).toBe(1);
    expect(report.stats.objectStreamBytes).toBeGreaterThan(0);
    expect(report.stats.pages).toBe(1);
    expect(report.stats.structureErrors).toBe(0);
  });

  it('对象流解码量超预算时拒绝', () => {
    const report = preflightPdf(objectStreamPdf(), { budgets: { objectStreamBytes: 64 } });
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('objectStreamBytes');
  });
});

describe('解码放大预算', () => {
  it('拒绝「几 KB 压缩 → 超过内容流上限」的解压炸弹', HEAVY, () => {
    const bomb = flateContentPdf(new Uint8Array(9 * 1024 * 1024));
    expect(bomb.length).toBeLessThan(64 * 1024);
    const report = preflightPdf(bomb);
    expect(report.ok).toBe(false);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].code).toBe('contentStreamBytes');
    expect(report.violations[0].limit).toBe(PDF_PREFLIGHT_BUDGETS.contentStreamBytes);
    expect(summarizePreflight(report)).toContain('contentStreamBytes=');
    // 解码过程被硬预算截断，绝不把 9 MiB 结果留在内存里
    expect(report.stats.decodedStreamBytes).toBeLessThanOrEqual(PDF_PREFLIGHT_BUDGETS.contentStreamBytes);
  });

  it('全文件解码总量由 decodedBytes 约束', HEAVY, () => {
    const report = preflightPdf(flateContentPdf(new Uint8Array(1024 * 1024)), {
      budgets: {
        streamBytes: 8 * 1024 * 1024,
        contentStreamBytes: 8 * 1024 * 1024,
        decodedBytes: 512 * 1024,
      },
    });
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('decodedBytes');
    expect(report.violations[0].limit).toBe(512 * 1024);
  });

  it('无法解码的放大过滤器按倍数保守估算（宁多算）', () => {
    // 用不可压缩数据，使「压缩长度」与原始长度同量级：估算值 = 流长度 × 放大倍数
    const payload = incompressible(300 * 1024);
    // 前提自检：夹具确实不可压缩（否则这条用例证明不了估算逻辑）
    expect(flate(payload).length).toBeGreaterThan(payload.length * 0.9);
    const report = preflightPdf(flateContentPdf(payload, '/Filter /LZWDecode'), {
      budgets: { decodedBytes: 1024 * 1024 },
    });
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('decodedBytes');
    expect(report.violations[0].actual).toBeGreaterThanOrEqual(
      payload.length * PDF_PREFLIGHT_BUDGETS.unknownFilterAmplification,
    );
    expect(report.stats.estimatedFilterStreams).toBe(1);
  });

  it('纯 ASCIIHexDecode/ASCII85Decode 不算放大，不做过度拒绝', () => {
    const report = preflightPdf(flateContentPdf(new Uint8Array(64 * 1024), '/Filter /ASCIIHexDecode'));
    expect(report.ok).toBe(true);
    expect(report.stats.estimatedFilterStreams).toBe(0);
  });

  it('过滤器链首层是 FlateDecode 时按真实解码字节计数', HEAVY, () => {
    // pdf.js 的 filter() 逐项包装 filterArray[i]，最内层 filter[0] 先消费原始字节
    const report = preflightPdf(flateContentPdf(new Uint8Array(2 * 1024 * 1024), '/Filter [/FlateDecode /DCTDecode]'));
    expect(report.ok).toBe(true);
    expect(report.stats.decodedStreamBytes).toBe(2 * 1024 * 1024);
    expect(report.stats.estimatedFilterStreams).toBe(0);
  });

  it('盔甲层后还挂着 Flate 层时保守估算，不放行', HEAVY, () => {
    // /Filter [/ASCII85Decode /FlateDecode]：第一层是 ASCII85，我们解不到后面的 Flate 层，
    // 只能按倍数保守估算；3 MiB 不可压缩数据 × 64 已超过全文件解码预算。
    const payload = incompressible(3 * 1024 * 1024);
    const report = preflightPdf(flateContentPdf(payload, '/Filter [/ASCII85Decode /FlateDecode]'));
    expect(report.ok).toBe(false);
    expect(report.stats.estimatedFilterStreams).toBe(1);
    expect(report.violations[0].code).toBe('decodedBytes');
  });

  it('Flate 首层后再挂放大层（双层 Flate）也保守估算，不绕过预算', HEAVY, () => {
    // /Filter [/FlateDecode /FlateDecode]：我们只能解出第一层的字节数，第二层 Flate 的
    // 展开无从计量——修复前这里按 kind:'flate' 计账，双层 Flate 炸弹可绕过解码预算。
    const payload = incompressible(3 * 1024 * 1024);
    const report = preflightPdf(flateContentPdf(payload, '/Filter [/FlateDecode /FlateDecode]'));
    expect(report.ok).toBe(false);
    expect(report.stats.estimatedFilterStreams).toBe(1);
    expect(report.violations[0].code).toBe('decodedBytes');
  });

  it('Flate 首层后是缩小编码时仍按真实解码计数（不过度拒绝）', HEAVY, () => {
    const report = preflightPdf(
      flateContentPdf(new Uint8Array(2 * 1024 * 1024), '/Filter [/FlateDecode /ASCIIHexDecode]'),
    );
    expect(report.ok).toBe(true);
    expect(report.stats.decodedStreamBytes).toBe(2 * 1024 * 1024);
    expect(report.stats.estimatedFilterStreams).toBe(0);
  });
});

describe('页树放大预算', () => {
  it('拒绝声明式 /Count 放大（PDF.js 的 numPages 就来自它）', () => {
    const report = preflightPdf(declaredCountBombPdf(100_000_000));
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('pages');
    expect(report.violations[0].actual).toBe(100_000_000);
    expect(report.violations[0].limit).toBe(PDF_PREFLIGHT_BUDGETS.pages);
    expect(report.violations[0].detail).toContain('/Count');
    // 声明被拦下，不会再去枚举页树
    expect(report.stats.pages).toBe(0);
  });

  it('拒绝超深页树', () => {
    const report = preflightPdf(deepPageTreePdf(200));
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('pageTreeDepth');
    expect(report.violations[0].limit).toBe(PDF_PREFLIGHT_BUDGETS.pageTreeDepth);
  });

  it('拒绝页树节点数量放大', () => {
    // 一个页树节点挂 N 个**互不相同**的子节点：节点预算必须封顶遍历
    const pageIds = [3, 4, 5, 6, 7, 8];
    const objects = [
      { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
      {
        id: 2,
        body: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
      },
      ...pageIds.map((id) => ({ id, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] >>' })),
    ];
    const report = preflightPdf(buildPdfBytes(objects), { budgets: { pageTreeNodes: 3 } });
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('pageTreeNodes');
    expect(report.violations[0].limit).toBe(3);
  });
});

describe('注释与字体预算', () => {
  it('拒绝单页注释过多', () => {
    const report = preflightPdf(annotationHeavyPdf(PDF_PREFLIGHT_BUDGETS.pageAnnotations + 1));
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('pageAnnotations');
    expect(report.violations[0].limit).toBe(PDF_PREFLIGHT_BUDGETS.pageAnnotations);
  });

  it('拒绝注释总量过多', () => {
    const report = preflightPdf(annotationHeavyPdf(100), { budgets: { annotations: 10 } });
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('annotations');
  });

  it('拒绝字体数量过多', () => {
    const report = preflightPdf(fontHeavyPdf(PDF_PREFLIGHT_BUDGETS.fonts + 1));
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('fonts');
    expect(report.stats.fonts).toBe(PDF_PREFLIGHT_BUDGETS.fonts + 1);
  });

  it('拒绝内嵌字体解码字节过多', HEAVY, () => {
    const report = preflightPdf(flateFontPdf(new Uint8Array(64 * 1024)), { budgets: { fontBytes: 4096 } });
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('fontBytes');
    expect(report.stats.fontBytes).toBeGreaterThan(4096);
  });
});

describe('文本算子预算', () => {
  it('拒绝内容流文本算子过多', () => {
    const content = '(x) Tj\n'.repeat(200);
    const report = preflightPdf(contentOnlyPdf(content), { budgets: { streamTextOperators: 50 } });
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('streamTextOperators');
  });

  it('拒绝文本算子总量过多', () => {
    const content = '(x) Tj\n'.repeat(100);
    const report = preflightPdf(contentOnlyPdf(content), { budgets: { textOperators: 10 } });
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('textOperators');
  });

  it('统计 Tj / TJ / \' / " 四类算子', () => {
    expect(countTextOperators(textBytes('BT (a) Tj [(b)] TJ (c) \' (d) " ET'))).toBe(4);
  });

  it('不把字符串里的 Tj 当成算子', () => {
    expect(countTextOperators(textBytes('(Tj TJ \' ") Tj'))).toBe(1);
    expect(countTextOperators(textBytes('<54782054> Tj'))).toBe(1);
  });

  it('跳过内联图像的二进制段', () => {
    const inline = 'BI /W 2 /H 2 ID \x00Tj\x01Tj EI (a) Tj';
    expect(countTextOperators(textBytes(inline))).toBe(1);
  });

  it('空内容流计 0', () => {
    expect(countTextOperators(new Uint8Array(0))).toBe(0);
  });
});

describe('取消与超时', () => {
  it('已取消的信号让预检立即抛出，不返回部分结果', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => preflightPdf(twoPageReportPdf(), { signal: controller.signal })).toThrow(PdfPreflightAborted);
  });

  it('未取消的信号不影响正常预检', () => {
    const controller = new AbortController();
    expect(preflightPdf(twoPageReportPdf(), { signal: controller.signal }).ok).toBe(true);
  });

  it('扫描墙钟超预算即拒绝（fail closed）', () => {
    const report = preflightPdf(twoPageReportPdf(), { budgets: { scanMs: -1 } });
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('scanMs');
  });

  it('token 预算拦下超长对象', () => {
    const huge = `<< /Type /Catalog /Pages 2 0 R /X [${Array.from({ length: 200 }, (_, index) => index).join(' ')}] >>`;
    const report = preflightPdf(
      buildPdfBytes([
        { id: 1, body: huge },
        { id: 2, body: '<< /Type /Pages /Kids [] /Count 0 >>' },
      ]),
      { budgets: { tokens: 50 } },
    );
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('tokens');
  });
});

// ---------------------------------------------------------------------------
// 2026-10-15 只读审查复现的残留：同号对象、加密文档、无法建立页树时的放行语义
// ---------------------------------------------------------------------------

/** 1 MiB 的零字节压成约 1 KiB；配合收紧的 decodedBytes 预算模拟解压炸弹，避免本机真的分配 200 MiB */
const BOMB = flate(new Uint8Array(1024 * 1024));
const TIGHT = { budgets: { decodedBytes: 256 * 1024 } } as const;
const PAGE = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R >>';
const head = [
  { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
  { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
  { id: 3, body: PAGE },
];

describe('同号对象的每一个定义都要记账（PDF.js 按 xref 取哪一个都不能漏）', () => {
  it('先放小的 4 0 obj、再放 Flate 炸弹 4 0 obj：拒绝', () => {
    const bytes = buildRawPdfBytes([
      ...head,
      { id: 4, body: streamBody('', 'q Q') },
      { id: 4, body: streamBody('/Filter /FlateDecode', BOMB) },
    ]);
    const report = preflightPdf(bytes, TIGHT);
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('decodedBytes');
  });

  it('炸弹在前、诱饵在后同样拒绝（不依赖「先到先得」或「后到覆盖」）', () => {
    const bytes = buildRawPdfBytes([
      ...head,
      { id: 4, body: streamBody('/Filter /FlateDecode', BOMB) },
      { id: 4, body: streamBody('', 'q Q') },
    ]);
    expect(preflightPdf(bytes, TIGHT).ok).toBe(false);
  });

  it('对象流与普通流同号时，普通流那一份不会被「已在对象流阶段记账」跳过', () => {
    const decoded = '1 0 << /Type /Catalog /Pages 2 0 R >>';
    const bytes = buildRawPdfBytes([
      { id: 2, body: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
      { id: 3, body: PAGE },
      { id: 4, body: streamBody('', 'q Q') },
      { id: 5, body: streamBody('/Type /ObjStm /N 1 /First 4', decoded) },
      { id: 5, body: streamBody('/Filter /FlateDecode', BOMB) },
      { id: 6, body: streamBody('/Type /XRef /Size 7 /Root 1 0 R', new Uint8Array([0, 0, 0, 1])) },
    ]);
    const report = preflightPdf(bytes, TIGHT);
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('decodedBytes');
  });

  it('页树节点的诱饵定义：任一定义声明的 /Count 超限都拒绝', () => {
    for (const order of [
      ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Pages /Kids [3 0 R] /Count 100000000 >>'],
      ['<< /Type /Pages /Kids [3 0 R] /Count 100000000 >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'],
    ]) {
      const bytes = buildRawPdfBytes([
        { id: 1, body: '<< /Type /Catalog /Pages 2 0 R >>' },
        { id: 2, body: order[0] },
        { id: 2, body: order[1] },
        { id: 3, body: '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] >>' },
        { id: 9, body: streamBody('/Type /XRef /Size 10 /Root 1 0 R', new Uint8Array([0, 0, 0, 1])) },
      ]);
      const report = preflightPdf(bytes);
      expect(report.ok).toBe(false);
      expect(report.violations[0].code).toBe('pages');
    }
  });

  it('正常的增量更新（同一页与内容流被重新定义）不误杀，页数按页对象去重', () => {
    const bytes = buildPdfBytes([...head, { id: 4, body: streamBody('', 'BT (a) Tj ET') }]);
    const update = textBytes(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Annots [] >>\nendobj\n' +
        '4 0 obj\n<< /Length 25 >>\nstream\nBT (a) Tj ET BT (b) Tj ET\nendstream\nendobj\n' +
        'trailer\n<< /Size 5 /Root 1 0 R >>\n%%EOF\n',
    );
    const merged = new Uint8Array(bytes.length + update.length);
    merged.set(bytes);
    merged.set(update, bytes.length);
    const report = preflightPdf(merged);
    expect(report.ok).toBe(true);
    expect(report.stats.pages).toBe(1);
    // 两个版本的内容流都按内容流统计了文本算子（1 + 2）
    expect(report.stats.textOperators).toBe(3);
  });
});

describe('加密文档（/Encrypt）一律拒绝：密文流无法记账', () => {
  const encryptDict = '<< /Filter /Standard /V 1 /R 2 /O <00> /U <00> /P -4 >>';

  it('trailer 带 /Encrypt 时拒绝，即便流本身很小', () => {
    const bytes = buildPdfBytes(
      [
        ...head,
        { id: 4, body: streamBody('/Filter /FlateDecode', new Uint8Array([1, 2, 3, 4])) },
        { id: 9, body: encryptDict },
      ],
      '/Encrypt 9 0 R /ID [<00> <00>]',
    );
    const report = preflightPdf(bytes);
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('encrypted');
    expect(preflightFailure(report)).toBe('encrypted');
  });

  it('xref 流字典带 /Encrypt 时同样拒绝', () => {
    const bytes = buildRawPdfBytes([
      ...head,
      { id: 4, body: streamBody('', 'q Q') },
      { id: 8, body: encryptDict },
      { id: 9, body: streamBody('/Type /XRef /Size 10 /Root 1 0 R /Encrypt 8 0 R', new Uint8Array([0, 0, 0, 1])) },
    ]);
    expect(preflightPdf(bytes).violations[0]?.code).toBe('encrypted');
  });
});

describe('定位不到目录 / 页树时 fail closed（不再整份放行）', () => {
  it('完全不是 PDF 的字节被拒绝，映射成「PDF 文件无效」', () => {
    const report = preflightPdf(notAPdf());
    expect(report.ok).toBe(false);
    expect(report.stats.parsed).toBe(false);
    expect(report.violations[0].code).toBe('structure');
    expect(preflightFailure(report)).toBe('parseFailed');
  });

  it('没有页树的目录同样拒绝', () => {
    const report = preflightPdf(buildPdfBytes([{ id: 1, body: '<< /Type /Catalog >>' }]));
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('structure');
  });

  it('找不到目录时流仍然全部记账：炸弹报的是解码预算而不是结构', () => {
    const bytes = buildRawPdfBytes([{ id: 4, body: streamBody('/Filter /FlateDecode', BOMB) }]);
    const report = preflightPdf(bytes, TIGHT);
    expect(report.ok).toBe(false);
    expect(report.violations[0].code).toBe('decodedBytes');
    expect(preflightFailure(report)).toBe('preflight');
  });
});
