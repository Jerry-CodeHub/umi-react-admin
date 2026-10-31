/**
 * PDF 容器级预检（F13）：在把文件交给 react-pdf / PDF.js **之前**，解析 PDF 的对象、
 * 流、页树、字体与注释结构，按显式预算拒绝「压缩很小、解码很大」的资源放大文档。
 *
 * 为什么需要它：PDF.js 没有暴露任何「解码资源记账」接口。文件大小、页数、可见窗口、
 * 画布/图片像素与总时限都已被挡住（见 previewLimits.ts），但解码后的页树、注释、文本层、
 * 字体、对象流与内容流都不在 PDF.js 的可见边界内。这里用零依赖的容器解析补上这一段。
 *
 * 设计要点
 * - 零依赖：XRef/对象扫描是自研的，Flate 解压用 src/utils/inflate.ts（与签名 PNG 校验共用，不引入 pdfjs 之外的东西）。
 * - 硬预算：所有上限集中在 PDF_PREFLIGHT_BUDGETS 单一来源；命中即中止（fail fast）。
 * - 流式记账：解压结果边解边计数，绝不把完整解码结果留在内存里，解压炸弹在超限处立即抛错。
 * - 保守估算：无法解码的过滤器（LZW / RunLength）按 unknownFilterAmplification 保守放大估算；
 *   这是「宁可多算」的方向，且会在 SECURITY.md 中如实声明为估算而非精确值。
 * - 同号对象全部记账：增量更新与伪造的诱饵都会让同一对象号出现多次，PDF.js 按 xref 选哪一个由文件决定，
 *   所以每个物理存在的流都要解码记账，页树节点的每个定义都要过页树预算（引用解析取最后一个定义，
 *   与 PDF.js 重建 xref 时「后者覆盖」的口径一致）。
 * - 加密文档（trailer 或 xref 流字典带 /Encrypt）直接拒绝：流是密文，解压记账无从谈起，
 *   而 PDF.js 用空用户密码就能解密后再解压。
 * - fail closed：定位不到目录/页树时同样拒绝（code=structure），并且在此之前所有流照常记账——
 *   解析器与 PDF.js 的结构差异不能变成整份放行的旁路。预检仍不是完整的 PDF 校验器，
 *   残留限制见 SECURITY.md。
 */
import { InflateLimitError, inflateFlate } from '@/utils/inflate';
import { PDF_LIMITS } from './previewLimits';

/** 预检预算：唯一来源，生产路径不传任何覆盖值。 */
export const PDF_PREFLIGHT_BUDGETS = {
  /** 容器扫描的墙钟上限（毫秒）：超时即拒绝，避免同步解析长时间占用主线程 */
  scanMs: 3_000,
  /** 间接对象总数 */
  objects: 50_000,
  /** 全文件解析 token 总数上限（抵御畸形/超长对象） */
  tokens: 200_000,
  /** 解析器递归深度 */
  parseDepth: 64,
  /** 流对象总数 */
  streams: 10_000,
  /** 单个流解码后的字节上限 */
  streamBytes: 32 * 1024 * 1024,
  /** 全文件所有流解码后的字节总和 */
  decodedBytes: 128 * 1024 * 1024,
  /** /Type /ObjStm 对象流数量 */
  objectStreams: 256,
  /** 单个对象流解码后字节上限 */
  objectStreamBytes: 8 * 1024 * 1024,
  /** 全部对象流解码后字节总和 */
  objectStreamsBytes: 32 * 1024 * 1024,
  /** 页树节点总数（含中间节点） */
  pageTreeNodes: 4_000,
  /** 页树深度 */
  pageTreeDepth: 64,
  /** 页数上限；与 PDF_LIMITS.pages 单一来源，同时约束页树声明的 /Count */
  pages: PDF_LIMITS.pages,
  /** 字体对象数量（按对象去重） */
  fonts: 128,
  /** 字体文件解码后字节总和 */
  fontBytes: 32 * 1024 * 1024,
  /** /Annots 条目总数 */
  annotations: 5_000,
  /** 单页 /Annots 条目数 */
  pageAnnotations: 1_000,
  /** 文本显示算子（Tj / TJ / ' / "）总数 */
  textOperators: 500_000,
  /** 单个内容流的文本显示算子数 */
  streamTextOperators: 50_000,
  /** 单个内容流解码后字节上限 */
  contentStreamBytes: 8 * 1024 * 1024,
  /** 畸形容器重同步（搜索 endstream）允许扫描的总字节数 */
  resyncBytes: 64 * 1024 * 1024,
  /** 无法解码且可能放大的过滤器（LZW/RunLength）按压缩长度的倍数保守估算 */
  unknownFilterAmplification: 64,
} as const;

/**
 * 预算数值类型：键与 PDF_PREFLIGHT_BUDGETS 严格一致（单一来源），值允许为任意 number，
 * 否则 `{ tokens: 50 }` 这类调优值无法表达。常量本身仍是 as const 的字面量。
 */
export type PdfPreflightBudgets = { [Key in keyof typeof PDF_PREFLIGHT_BUDGETS]: number };

/** 覆盖项：仅供测试与宿主调优；生产路径不传。 */
export type PdfPreflightBudgetOverrides = Partial<PdfPreflightBudgets>;

export type PdfPreflightCode =
  | 'scanMs'
  | 'objects'
  | 'tokens'
  | 'parseDepth'
  | 'streams'
  | 'streamBytes'
  | 'decodedBytes'
  | 'objectStreams'
  | 'objectStreamBytes'
  | 'objectStreamsBytes'
  | 'pageTreeNodes'
  | 'pageTreeDepth'
  | 'pages'
  | 'fonts'
  | 'fontBytes'
  | 'annotations'
  | 'pageAnnotations'
  | 'textOperators'
  | 'streamTextOperators'
  | 'contentStreamBytes'
  | 'resyncBytes'
  /** 文档加密（/Encrypt）：密文流无法记账，一律拒绝 */
  | 'encrypted'
  /** 定位不到目录 / 页树：结构预算无从判定，fail closed */
  | 'structure';

export type PdfPreflightViolation = {
  code: PdfPreflightCode;
  /** 观测到的值（或保守估算值） */
  actual: number;
  /** 被突破的预算 */
  limit: number;
  detail?: string;
};

export type PdfPreflightStats = {
  bytes: number;
  objects: number;
  streams: number;
  /** 所有流解码/估算后的字节总和 */
  decodedStreamBytes: number;
  objectStreams: number;
  objectStreamBytes: number;
  pageTreeNodes: number;
  pageTreeDepth: number;
  pages: number;
  fonts: number;
  fontBytes: number;
  annotations: number;
  textOperators: number;
  /** 无法解码、按倍数保守估算的流数量 */
  estimatedFilterStreams: number;
  /** 过滤器/结构异常导致无法精确计数的流数量 */
  malformedStreams: number;
  /** 结构异常（无法解析的对象/流）次数；不单独构成违规 */
  structureErrors: number;
  /** 是否定位到 Catalog/页树；false 时流照常记账，但报告以 structure 违规拒绝 */
  parsed: boolean;
  elapsedMs: number;
};

export type PdfPreflightReport = {
  ok: boolean;
  aborted: boolean;
  violations: PdfPreflightViolation[];
  stats: PdfPreflightStats;
};

export type PdfPreflightOptions = {
  /** 取消信号：在对象/流边界检查，命中即抛 PdfPreflightAborted */
  signal?: AbortSignal;
  /**
   * 覆盖预算。仅供测试与宿主调优；生产路径（index.tsx）不传，始终使用
   * PDF_PREFLIGHT_BUDGETS，保证预算是单一来源。
   */
  budgets?: PdfPreflightBudgetOverrides;
};

/** 预检被调用方取消；调用方应丢弃结果（属于过期回调）。 */
export class PdfPreflightAborted extends Error {
  constructor() {
    super('pdf preflight aborted');
    this.name = 'AbortError';
  }
}

// ---------------------------------------------------------------------------
// PDF 词法/语法
// ---------------------------------------------------------------------------

type PdfDict = Map<string, PdfValue>;
type PdfRef = { readonly ref: number };
type PdfName = { readonly name: string };
type PdfLiteral = { readonly literal: string };
type PdfValue = null | boolean | number | PdfName | PdfLiteral | PdfRef | PdfValue[] | PdfDict;

const isDict = (value: PdfValue | undefined): value is PdfDict => value instanceof Map;
const isArray = (value: PdfValue | undefined): value is PdfValue[] => Array.isArray(value);
const isRef = (value: PdfValue | undefined): value is PdfRef =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Map) && 'ref' in value;

const isWhite = (byte: number) =>
  byte === 0x20 || byte === 0x0a || byte === 0x0d || byte === 0x09 || byte === 0x0c || byte === 0x00;
const isDelimiter = (byte: number) =>
  byte === 0x28 ||
  byte === 0x29 ||
  byte === 0x3c ||
  byte === 0x3e ||
  byte === 0x5b ||
  byte === 0x5d ||
  byte === 0x7b ||
  byte === 0x7d ||
  byte === 0x2f ||
  byte === 0x25;
const isRegular = (byte: number) => byte !== undefined && !isWhite(byte) && !isDelimiter(byte);
const isDigit = (byte: number) => byte >= 0x30 && byte <= 0x39;

/** JS 调用栈兜底：任何情况下递归都不超过此深度（正常路径由 parseDepth 预算更早拦截）。 */
const HARD_PARSE_DEPTH = 512;

/** 关键字必须带边界，避免把对象内容里的 obj/stream 子串当成关键字。 */
const keywordAt = (data: Uint8Array, index: number, text: string): boolean => {
  if (index + text.length > data.length) return false;
  for (let offset = 0; offset < text.length; offset++)
    if (data[index + offset] !== text.charCodeAt(offset)) return false;
  const next = data[index + text.length];
  return next === undefined || !isRegular(next);
};

/** 结构语法错误：由调用方决定是跳过该对象还是放弃解析，绝不外泄为崩溃。 */
class PdfSyntaxError extends Error {}

/** 预算命中：立刻向上抛出并终止扫描（fail fast），由 preflightPdf 收集为一条 violation。 */
class PreflightStop extends Error {
  constructor(readonly violation: PdfPreflightViolation) {
    super(violation.code);
  }
}

const isFatal = (error: unknown) => error instanceof PreflightStop || error instanceof PdfPreflightAborted;

const limitedText = (data: Uint8Array, start: number, end: number) => {
  const length = Math.min(end - start, 64);
  let text = '';
  for (let index = 0; index < length; index++) text += String.fromCharCode(data[start + index]);
  return text;
};

const hexValue = (byte: number) => {
  if (byte >= 0x30 && byte <= 0x39) return byte - 0x30;
  if (byte >= 0x41 && byte <= 0x46) return byte - 0x37;
  if (byte >= 0x61 && byte <= 0x66) return byte - 0x57;
  return -1;
};

class PdfLexer {
  pos = 0;

  constructor(
    private readonly data: Uint8Array,
    private readonly guard: () => void,
    private readonly depthExceeded: (depth: number) => void,
  ) {}

  skipSpace() {
    const { data } = this;
    while (this.pos < data.length) {
      const byte = data[this.pos];
      if (isWhite(byte)) {
        this.pos += 1;
        continue;
      }
      if (byte === 0x25) {
        this.pos += 1;
        while (this.pos < data.length && data[this.pos] !== 0x0a && data[this.pos] !== 0x0d) this.pos += 1;
        continue;
      }
      break;
    }
  }

  keyword(text: string): boolean {
    if (!keywordAt(this.data, this.pos, text)) return false;
    this.pos += text.length;
    return true;
  }

  parseValue(depth: number): PdfValue {
    // 绝对上限兜住递归（防御栈溢出）；预算内的深度由 depthExceeded 判为违规
    if (depth > HARD_PARSE_DEPTH) throw new PdfSyntaxError('nesting');
    this.depthExceeded(depth);
    this.guard();
    this.skipSpace();
    const { data } = this;
    if (this.pos >= data.length) throw new PdfSyntaxError('eof');
    const byte = data[this.pos];
    if (byte === 0x3c) {
      if (data[this.pos + 1] === 0x3c) return this.parseDict(depth);
      return this.parseHexString();
    }
    if (byte === 0x5b) return this.parseArray(depth);
    if (byte === 0x2f) return this.parseName();
    if (byte === 0x28) return this.parseLiteralString();
    if (byte === 0x74 && this.keyword('true')) return true;
    if (byte === 0x66 && this.keyword('false')) return false;
    if (byte === 0x6e && this.keyword('null')) return null;
    return this.parseNumberOrRef();
  }

  /** `N G obj` 头；失败时不移动 pos（热循环里被逐字节调用）。 */
  matchObjectHeader(): number | undefined {
    const { data } = this;
    const start = this.pos;
    if (!isDigit(data[start])) return undefined;
    let cursor = start;
    while (cursor < data.length && isDigit(data[cursor])) cursor += 1;
    if (cursor - start > 10) return undefined;
    const idEnd = cursor;
    while (cursor < data.length && isWhite(data[cursor])) cursor += 1;
    if (cursor === idEnd) return undefined;
    const generationStart = cursor;
    while (cursor < data.length && isDigit(data[cursor])) cursor += 1;
    if (cursor === generationStart) return undefined;
    const generationEnd = cursor;
    while (cursor < data.length && isWhite(data[cursor])) cursor += 1;
    if (cursor === generationEnd) return undefined;
    if (!keywordAt(data, cursor, 'obj')) return undefined;
    let id = 0;
    for (let index = start; index < idEnd; index++) id = id * 10 + (data[index] - 0x30);
    this.pos = cursor + 3;
    return id;
  }

  private parseDict(depth: number): PdfDict {
    this.pos += 2;
    const dict: PdfDict = new Map();
    for (;;) {
      this.guard();
      this.skipSpace();
      const { data } = this;
      if (this.pos >= data.length) throw new PdfSyntaxError('dict');
      if (data[this.pos] === 0x3e && data[this.pos + 1] === 0x3e) {
        this.pos += 2;
        return dict;
      }
      if (data[this.pos] !== 0x2f) throw new PdfSyntaxError('dictKey');
      const key = this.parseName().name;
      dict.set(key, this.parseValue(depth + 1));
    }
  }

  private parseArray(depth: number): PdfValue[] {
    this.pos += 1;
    const values: PdfValue[] = [];
    for (;;) {
      this.guard();
      this.skipSpace();
      if (this.pos >= this.data.length) throw new PdfSyntaxError('array');
      if (this.data[this.pos] === 0x5d) {
        this.pos += 1;
        return values;
      }
      values.push(this.parseValue(depth + 1));
    }
  }

  private parseName(): PdfName {
    this.pos += 1;
    const { data } = this;
    const start = this.pos;
    while (this.pos < data.length && isRegular(data[this.pos])) this.pos += 1;
    let name = '';
    for (let index = start; index < this.pos; index++) {
      const byte = data[index];
      if (byte === 0x23 && index + 2 < this.pos) {
        const high = hexValue(data[index + 1]);
        const low = hexValue(data[index + 2]);
        if (high >= 0 && low >= 0) {
          name += String.fromCharCode(high * 16 + low);
          index += 2;
          continue;
        }
      }
      name += String.fromCharCode(byte);
    }
    return { name };
  }

  /** 内容不参与判定，只做有界记录以消费输入（/ID 之类可能很长）。 */
  private parseLiteralString(): PdfLiteral {
    const { data } = this;
    this.pos += 1;
    let depth = 1;
    const start = this.pos;
    let literal = '';
    while (this.pos < data.length) {
      const byte = data[this.pos];
      if (byte === 0x5c) {
        this.pos += 2;
        continue;
      }
      if (byte === 0x28) depth += 1;
      else if (byte === 0x29) {
        depth -= 1;
        if (depth === 0) {
          if (literal.length === 0) literal = limitedText(data, start, this.pos);
          this.pos += 1;
          return { literal };
        }
      }
      this.pos += 1;
    }
    throw new PdfSyntaxError('literalString');
  }

  private parseHexString(): PdfLiteral {
    const { data } = this;
    this.pos += 1;
    const start = this.pos;
    while (this.pos < data.length && data[this.pos] !== 0x3e) this.pos += 1;
    if (this.pos >= data.length) throw new PdfSyntaxError('hexString');
    const literal = limitedText(data, start, this.pos);
    this.pos += 1;
    return { literal };
  }

  private parseNumberOrRef(): PdfValue {
    const first = this.readNumber();
    if (first === undefined) throw new PdfSyntaxError('token');
    if (Number.isInteger(first) && first >= 0) {
      const saved = this.pos;
      this.skipSpace();
      const second = this.readNumber();
      if (second !== undefined && Number.isInteger(second) && second >= 0) {
        this.skipSpace();
        if (this.keyword('R')) return { ref: first };
      }
      this.pos = saved;
    }
    return first;
  }

  private readNumber(): number | undefined {
    const { data } = this;
    const start = this.pos;
    let index = start;
    if (data[index] === 0x2b || data[index] === 0x2d) index += 1;
    let digits = 0;
    while (index < data.length && isDigit(data[index])) {
      index += 1;
      digits += 1;
    }
    if (index < data.length && data[index] === 0x2e) {
      index += 1;
      while (index < data.length && isDigit(data[index])) {
        index += 1;
        digits += 1;
      }
    }
    if (digits === 0) return undefined;
    this.pos = index;
    let value = 0;
    let seenDot = false;
    let scale = 1;
    for (let cursor = start; cursor < index; cursor++) {
      const byte = data[cursor];
      if (byte === 0x2d) value = -value;
      else if (byte === 0x2e) seenDot = true;
      else if (seenDot) {
        scale *= 10;
        value += (byte - 0x30) / scale;
      } else value = value * 10 + (byte - 0x30);
    }
    return value;
  }
}

/** 有界搜索 `endstream`：畸形容器里 /Length 不可信，只能回退到关键字搜索。 */
const findEndstream = (data: Uint8Array, from: number, spend: (scanned: number) => void): number => {
  const start = from;
  for (let index = from; index + 8 <= data.length; index++) {
    if (data[index] !== 0x65) continue; // 'e'
    if (keywordAt(data, index, 'endstream')) {
      spend(index - start);
      return index;
    }
  }
  spend(data.length - start);
  return -1;
};

// ---------------------------------------------------------------------------
// 文本算子统计（文本层预算的代理指标）
// ---------------------------------------------------------------------------

const tokenIs = (data: Uint8Array, start: number, end: number, text: string) => {
  if (end - start !== text.length) return false;
  for (let offset = 0; offset < text.length; offset++)
    if (data[start + offset] !== text.charCodeAt(offset)) return false;
  return true;
};

const skipLiteral = (data: Uint8Array, start: number): number => {
  let depth = 1;
  let cursor = start;
  while (cursor < data.length) {
    const byte = data[cursor];
    if (byte === 0x5c) {
      cursor += 2;
      continue;
    }
    if (byte === 0x28) depth += 1;
    else if (byte === 0x29) {
      depth -= 1;
      if (depth === 0) return cursor + 1;
    }
    cursor += 1;
  }
  return cursor;
};

/** 内联图像 `BI ... ID <binary> EI`：二进制段里可能含 Tj 字节，必须整体跳过。 */
const skipInlineImage = (data: Uint8Array, start: number): number => {
  let cursor = start;
  while (cursor < data.length && !keywordAt(data, cursor, 'ID')) cursor += 1;
  cursor += 2;
  while (cursor < data.length) {
    if (data[cursor] === 0x45 && data[cursor + 1] === 0x49 && isWhite(data[cursor - 1] ?? 0x20)) {
      const after = data[cursor + 2];
      if (after === undefined || isWhite(after) || isDelimiter(after)) return cursor + 2;
    }
    cursor += 1;
  }
  return cursor;
};

/** 统计内容流里的文本显示算子；字符串/十六进制串/内联图像被跳过，避免误计。 */
export const countTextOperators = (data: Uint8Array): number => {
  let count = 0;
  let index = 0;
  while (index < data.length) {
    const byte = data[index];
    if (isWhite(byte)) {
      index += 1;
      continue;
    }
    if (byte === 0x25) {
      index += 1;
      while (index < data.length && data[index] !== 0x0a && data[index] !== 0x0d) index += 1;
      continue;
    }
    if (byte === 0x28) {
      index = skipLiteral(data, index + 1);
      continue;
    }
    if (byte === 0x3c) {
      if (data[index + 1] === 0x3c) {
        index += 2;
        continue;
      }
      index += 1;
      while (index < data.length && data[index] !== 0x3e) index += 1;
      index += 1;
      continue;
    }
    if (byte === 0x5b || byte === 0x5d || byte === 0x7b || byte === 0x7d || byte === 0x3e) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < data.length && isRegular(data[end])) end += 1;
    if (end === index) {
      index += 1;
      continue;
    }
    if (data[index] === 0x54) {
      if (tokenIs(data, index, end, 'Tj') || tokenIs(data, index, end, 'TJ')) count += 1;
      else if (tokenIs(data, index, end, 'BI')) {
        index = skipInlineImage(data, end);
        continue;
      }
    } else if ((data[index] === 0x27 || data[index] === 0x22) && end === index + 1) count += 1;
    index = end;
  }
  return count;
};

// ---------------------------------------------------------------------------
// 过滤器分类
// ---------------------------------------------------------------------------

const FLATE_FILTERS = new Set(['FlateDecode', 'Fl']);
/** 图像编码器：流字节原样使用，像素展开由 PDF.js 的 maxImageSize/画布预算约束。 */
const IMAGE_CODERS = new Set(['DCTDecode', 'DCT', 'JPXDecode', 'CCITTFaxDecode', 'CCF', 'JBIG2Decode']);
/** 不放大（≤1:1）或我们无需解码的过滤器。 */
const NON_AMPLIFYING = new Set(['ASCIIHexDecode', 'AHx', 'ASCII85Decode', 'A85', 'Crypt']);

type StreamPlan =
  | { kind: 'flate' }
  | { kind: 'plain'; estimated: number }
  | { kind: 'amplifying'; estimated: number }
  | { kind: 'malformed' };

// ---------------------------------------------------------------------------
// 预检主体
// ---------------------------------------------------------------------------

type PdfStream = { dict: PdfDict; start: number; end: number; dataStart: number };
type PdfObjectEntry = {
  id: number;
  value: PdfValue;
  stream?: PdfStream;
  lengthRef?: number;
  /** 本定义是 /Type /ObjStm 对象流（按定义而不是按对象号标记：同号的另一个定义可能是普通流） */
  objectStream: boolean;
};

const nameOf = (value: PdfValue | undefined): string | undefined =>
  value && typeof value === 'object' && 'name' in value ? (value as PdfName).name : undefined;

const numberValue = (value: PdfValue | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const lengthRefOf = (value: PdfValue): number | undefined => {
  if (!isDict(value)) return undefined;
  const length = value.get('Length');
  return isRef(length) ? length.ref : undefined;
};

class Preflight {
  readonly stats: PdfPreflightStats;
  readonly budgets: PdfPreflightBudgets;
  /** 扫描起点：guard 的墙钟预算与报告里的 elapsedMs 共用 */
  readonly startedAt = Date.now();
  private readonly signal?: AbortSignal;
  private readonly bytes: Uint8Array;
  /** 文件里出现的每一个对象定义，按出现顺序（同号对象可能出现多次） */
  private readonly definitions: PdfObjectEntry[] = [];
  /** 对象号 → 该号的全部定义；引用解析取最后一个，结构遍历取全部 */
  private readonly objects = new Map<number, PdfObjectEntry[]>();
  /** 对象流内的对象号 → 全部取值（同样可能重复） */
  private readonly objectStreamValues = new Map<number, PdfValue[]>();
  private readonly trailers: PdfDict[] = [];
  private tokens = 0;
  private resyncScanned = 0;
  private decoded = 0;
  private objectStreamDecoded = 0;
  private fontStreamBytes = 0;
  private textOperators = 0;
  private readonly contentStreamIds = new Set<number>();
  private readonly fontFileIds = new Set<number>();
  private readonly fontsSeen = new Set<number>();
  /** 页对象号 → 其各定义中最多的注释数（同一页的多个定义不重复累加注释总量） */
  private readonly pageAnnotationCounts = new Map<number, number>();

  constructor(bytes: Uint8Array, budgets: PdfPreflightBudgets, signal?: AbortSignal) {
    this.bytes = bytes;
    this.budgets = budgets;
    this.signal = signal;
    this.stats = {
      bytes: bytes.length,
      objects: 0,
      streams: 0,
      decodedStreamBytes: 0,
      objectStreams: 0,
      objectStreamBytes: 0,
      pageTreeNodes: 0,
      pageTreeDepth: 0,
      pages: 0,
      fonts: 0,
      fontBytes: 0,
      annotations: 0,
      textOperators: 0,
      estimatedFilterStreams: 0,
      malformedStreams: 0,
      structureErrors: 0,
      parsed: false,
      elapsedMs: 0,
    };
  }

  /** 每个对象/流/token 边界都会调用：先看取消，再看墙钟。 */
  readonly guard = () => {
    if (this.signal?.aborted) throw new PdfPreflightAborted();
    const elapsed = Date.now() - this.startedAt;
    if (elapsed > this.budgets.scanMs) {
      throw new PreflightStop({ code: 'scanMs', actual: elapsed, limit: this.budgets.scanMs });
    }
  };

  private stop(code: PdfPreflightCode, actual: number, limit: number, detail?: string): never {
    throw new PreflightStop({ code, actual, limit, detail });
  }

  private countToken() {
    this.tokens += 1;
    if (this.tokens > this.budgets.tokens) {
      this.stop('tokens', this.tokens, this.budgets.tokens);
    }
  }

  /** 统一的词法器构造：token/超时/取消守卫 + 递归深度预算。 */
  private lexer(data: Uint8Array) {
    return new PdfLexer(
      data,
      () => {
        this.guard();
        this.countToken();
      },
      (depth) => {
        if (depth > this.budgets.parseDepth) this.stop('parseDepth', depth, this.budgets.parseDepth);
      },
    );
  }

  // -- 1. 对象扫描 ----------------------------------------------------------

  scanObjects() {
    const lexer = this.lexer(this.bytes);
    while (lexer.pos < this.bytes.length) {
      this.guard();
      if (lexer.keyword('trailer')) {
        try {
          lexer.skipSpace();
          const value = lexer.parseValue(0);
          if (isDict(value)) this.trailers.push(value);
        } catch (error) {
          if (isFatal(error)) throw error;
          this.stats.structureErrors += 1;
        }
        continue;
      }
      const id = lexer.matchObjectHeader();
      if (id === undefined) {
        lexer.pos += 1;
        continue;
      }
      this.stats.objects += 1;
      if (this.stats.objects > this.budgets.objects) {
        this.stop('objects', this.stats.objects, this.budgets.objects);
      }
      const bodyStart = lexer.pos;
      try {
        const value = lexer.parseValue(0);
        let stream: PdfStream | undefined;
        lexer.skipSpace();
        if (keywordAt(this.bytes, lexer.pos, 'stream')) {
          stream = this.readStream(lexer, value);
        }
        const entry: PdfObjectEntry = {
          id,
          value,
          stream,
          lengthRef: lengthRefOf(value),
          objectStream: !!stream && isDict(value) && nameOf(value.get('Type')) === 'ObjStm',
        };
        // 同号对象一律保留：只留第一次定义会让后面重复定义里的流永远不被记账（诱饵 + 解压炸弹）
        this.definitions.push(entry);
        const sameId = this.objects.get(id);
        if (sameId) sameId.push(entry);
        else this.objects.set(id, [entry]);
      } catch (error) {
        if (isFatal(error)) throw error;
        this.stats.structureErrors += 1;
        lexer.pos = bodyStart + 1;
      }
    }
  }

  /** 读取流数据范围：优先信任可验证的 /Length，否则有界搜索 endstream。 */
  private readStream(lexer: PdfLexer, dict: PdfValue): PdfStream | undefined {
    const { bytes } = this;
    const body = isDict(dict) ? dict : new Map<string, PdfValue>();
    lexer.pos += 6;
    let dataStart = lexer.pos;
    if (bytes[dataStart] === 0x0d && bytes[dataStart + 1] === 0x0a) dataStart += 2;
    else if (bytes[dataStart] === 0x0d || bytes[dataStart] === 0x0a) dataStart += 1;
    const declared = body.get('Length');
    let end = -1;
    if (
      typeof declared === 'number' &&
      Number.isSafeInteger(declared) &&
      declared >= 0 &&
      dataStart + declared <= bytes.length
    ) {
      const candidate = dataStart + declared;
      if (keywordAt(bytes, candidate, 'endstream')) end = candidate;
      else {
        let probe = candidate;
        while (probe < bytes.length && isWhite(bytes[probe])) probe += 1;
        if (keywordAt(bytes, probe, 'endstream')) end = candidate;
      }
    }
    if (end < 0) {
      const found = findEndstream(bytes, dataStart, (scanned) => this.spendResync(scanned));
      if (found < 0) return undefined;
      end = found;
      while (end > dataStart && (bytes[end - 1] === 0x0a || bytes[end - 1] === 0x0d)) end -= 1;
    }
    lexer.pos = Math.max(end, dataStart);
    return { dict: body, start: dataStart, end, dataStart };
  }

  private spendResync(scanned: number) {
    this.resyncScanned += scanned;
    if (this.resyncScanned > this.budgets.resyncBytes) {
      this.stop('resyncBytes', this.resyncScanned, this.budgets.resyncBytes, 'malformed stream lengths');
    }
  }

  // -- 2. 对象流（/Type /ObjStm）-------------------------------------------

  /** trailer 或 xref 流字典带 /Encrypt：流是密文，解码记账不成立，整份拒绝。 */
  rejectEncrypted() {
    const encrypted =
      this.trailers.some((trailer) => trailer.has('Encrypt')) ||
      this.definitions.some(
        (entry) => isDict(entry.value) && nameOf(entry.value.get('Type')) === 'XRef' && entry.value.has('Encrypt'),
      );
    if (encrypted) this.stop('encrypted', 1, 0, 'encrypted documents cannot be budgeted');
  }

  decodeObjectStreams() {
    for (const entry of this.definitions) {
      if (!entry.objectStream) continue;
      this.guard();
      this.stats.objectStreams += 1;
      if (this.stats.objectStreams > this.budgets.objectStreams) {
        this.stop('objectStreams', this.stats.objectStreams, this.budgets.objectStreams);
      }
      const stream = entry.stream;
      if (!stream) continue;
      const raw = this.bytes.subarray(stream.start, stream.end);
      // 未压缩对象流（合法 PDF）不能走 inflate；只有 Flate 层直接可见时才解码。
      if (this.planStream(stream.dict, raw.length).kind === 'plain') {
        if (raw.length > this.budgets.objectStreamBytes) {
          this.stop('objectStreamBytes', raw.length, this.budgets.objectStreamBytes);
        }
        this.decoded += raw.length;
        this.stats.decodedStreamBytes = this.decoded;
        this.objectStreamDecoded += raw.length;
        this.stats.objectStreamBytes = this.objectStreamDecoded;
        this.parseObjectStreamBody(stream.dict, [raw], raw.length);
        continue;
      }
      const limit = Math.min(
        this.budgets.objectStreamBytes,
        this.budgets.objectStreamsBytes - this.objectStreamDecoded,
        this.budgets.decodedBytes - this.decoded,
      );
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        inflateFlate(raw, {
          limit,
          sink: (chunk) => {
            this.guard();
            chunks.push(chunk.slice());
            size += chunk.length;
          },
        });
      } catch (error) {
        if (error instanceof InflateLimitError) {
          // 区分是对象流自身预算、对象流总量还是全文件解码总量把解码截断了
          if (limit === this.budgets.objectStreamBytes) {
            this.stop(
              'objectStreamBytes',
              limit,
              this.budgets.objectStreamBytes,
              'object stream decode budget reached',
            );
          }
          if (limit === this.budgets.objectStreamsBytes - this.objectStreamDecoded) {
            this.stop(
              'objectStreamsBytes',
              this.objectStreamDecoded + limit,
              this.budgets.objectStreamsBytes,
              'object stream total budget reached',
            );
          }
          this.stop('decodedBytes', this.decoded + limit, this.budgets.decodedBytes, 'global decode budget reached');
        }
        if (isFatal(error)) throw error;
        this.stats.malformedStreams += 1;
        continue;
      }
      this.decoded += size;
      this.stats.decodedStreamBytes = this.decoded;
      this.objectStreamDecoded += size;
      this.stats.objectStreamBytes = this.objectStreamDecoded;
      if (this.objectStreamDecoded > this.budgets.objectStreamsBytes) {
        this.stop('objectStreamsBytes', this.objectStreamDecoded, this.budgets.objectStreamsBytes);
      }
      this.parseObjectStreamBody(stream.dict, chunks, size);
    }
  }

  private parseObjectStreamBody(dict: PdfDict, chunks: Uint8Array[], size: number) {
    const decoded = new Uint8Array(size);
    let cursor = 0;
    for (const chunk of chunks) {
      decoded.set(chunk, cursor);
      cursor += chunk.length;
    }
    const count = numberValue(this.resolve(dict.get('N')));
    const first = numberValue(this.resolve(dict.get('First')));
    if (count === undefined || first === undefined || first < 0 || first > decoded.length) {
      this.stats.malformedStreams += 1;
      return;
    }
    // 头部是 N 组 "对象号 偏移" 的纯文本
    const header = this.lexer(decoded.subarray(0, first));
    const pairs: Array<[number, number]> = [];
    try {
      for (let index = 0; index < count; index++) {
        header.skipSpace();
        const objectNumber = header.parseValue(0);
        header.skipSpace();
        const offset = header.parseValue(0);
        if (typeof objectNumber !== 'number' || typeof offset !== 'number') break;
        pairs.push([objectNumber, offset]);
      }
    } catch (error) {
      if (isFatal(error)) throw error;
      this.stats.malformedStreams += 1;
      return;
    }
    for (const [objectNumber, offset] of pairs) {
      this.guard();
      const at = first + offset;
      if (at <= 0 || at >= decoded.length) continue;
      try {
        const lexer = this.lexer(decoded);
        lexer.pos = at;
        const value = lexer.parseValue(0);
        const sameId = this.objectStreamValues.get(objectNumber);
        if (sameId) sameId.push(value);
        else this.objectStreamValues.set(objectNumber, [value]);
      } catch (error) {
        if (isFatal(error)) throw error;
        this.stats.structureErrors += 1;
      }
    }
  }

  // -- 3. 引用解析 ----------------------------------------------------------

  /**
   * 解析引用目标：普通对象优先，其次对象流（/Type /ObjStm）内的对象；同号多定义时取最后一个
   * （PDF.js 重建 xref 时后出现的定义覆盖先出现的）。结构预算不只看这一个，见 alternatives。
   */
  private lookupValue(ref: number): PdfValue | undefined {
    const entries = this.objects.get(ref);
    if (entries?.length) return entries[entries.length - 1].value;
    const values = this.objectStreamValues.get(ref);
    return values?.length ? values[values.length - 1] : undefined;
  }

  /** 该对象号的全部定义（普通对象 + 对象流内对象）：xref 可以指向其中任何一个。 */
  private alternatives(ref: number): PdfValue[] {
    return [...(this.objects.get(ref) ?? []).map((entry) => entry.value), ...(this.objectStreamValues.get(ref) ?? [])];
  }

  private resolve(value: PdfValue | undefined): PdfValue | undefined {
    let current = value;
    let hops = 0;
    while (isRef(current)) {
      if (hops++ > this.budgets.parseDepth) return undefined;
      const next = this.lookupValue(current.ref);
      if (next === undefined) return undefined;
      current = next;
    }
    return current;
  }

  // -- 4. 页树遍历 ----------------------------------------------------------

  /**
   * 页树遍历的起点：每个 trailer / xref 流的 /Root 的每个定义，其 /Pages 的每个定义。
   * 都找不到时退回扫描 /Type /Catalog。同号节点的诱饵定义因此都会过页树预算。
   */
  pageTreeRoots(): PageTreeNode[] {
    const catalogs: PdfDict[] = [];
    const addCatalog = (root: PdfValue | undefined) => {
      for (const value of isRef(root) ? this.alternatives(root.ref) : [root]) if (isDict(value)) catalogs.push(value);
    };
    for (const trailer of this.trailers) addCatalog(trailer.get('Root'));
    for (const entry of this.definitions) {
      if (isDict(entry.value) && nameOf(entry.value.get('Type')) === 'XRef') addCatalog(entry.value.get('Root'));
    }
    if (!catalogs.length) {
      const candidates = [
        ...this.definitions.map((entry) => entry.value),
        ...[...this.objectStreamValues.values()].flat(),
      ];
      for (const value of candidates)
        if (isDict(value) && nameOf(value.get('Type')) === 'Catalog') catalogs.push(value);
    }
    const roots: PageTreeNode[] = [];
    const seen = new Set<number>();
    for (const catalog of catalogs) {
      const pages = catalog.get('Pages');
      const resources = catalog.get('Resources');
      if (isRef(pages)) {
        if (seen.has(pages.ref)) continue;
        seen.add(pages.ref);
        for (const value of this.alternatives(pages.ref)) {
          if (isDict(value)) roots.push({ value, depth: 0, resources, ref: pages.ref });
        }
      } else if (isDict(pages)) {
        roots.push({ value: pages, depth: 0, resources });
      }
    }
    return roots;
  }

  walkPageTree(roots: PageTreeNode[]) {
    const stack: PageTreeNode[] = [...roots];
    const visited = new Set<number>(roots.flatMap((root) => (root.ref === undefined ? [] : [root.ref])));
    const countedPages = new Set<number>();
    while (stack.length) {
      this.guard();
      const node = stack.pop() as PageTreeNode;
      this.stats.pageTreeNodes += 1;
      if (this.stats.pageTreeNodes > this.budgets.pageTreeNodes) {
        this.stop('pageTreeNodes', this.stats.pageTreeNodes, this.budgets.pageTreeNodes);
      }
      if (node.depth > this.stats.pageTreeDepth) this.stats.pageTreeDepth = node.depth;
      if (node.depth > this.budgets.pageTreeDepth) {
        this.stop('pageTreeDepth', node.depth, this.budgets.pageTreeDepth);
      }
      const resources = node.value.get('Resources') ?? node.resources;
      // 声明式放大：/Count 是 PDF.js numPages 的来源，必须在交给它之前拦住
      const declaredCount = numberValue(this.resolve(node.value.get('Count')));
      if (declaredCount !== undefined && declaredCount > this.budgets.pages) {
        this.stop('pages', declaredCount, this.budgets.pages, 'declared page tree /Count');
      }
      if (nameOf(node.value.get('Type')) === 'Page') {
        // 同一页对象的多个定义只算一页（增量更新常见），但每个定义的注释 / 内容 / 字体都要过预算
        if (node.ref === undefined || !countedPages.has(node.ref)) {
          if (node.ref !== undefined) countedPages.add(node.ref);
          this.stats.pages += 1;
          if (this.stats.pages > this.budgets.pages) this.stop('pages', this.stats.pages, this.budgets.pages);
        }
        this.collectPage(node.value, resources, node.ref);
        continue;
      }
      const kids = this.resolve(node.value.get('Kids'));
      if (!isArray(kids)) continue;
      for (const kid of kids) {
        if (isRef(kid)) {
          if (visited.has(kid.ref)) continue; // 环/重复引用：预算已封顶，跳过即可
          visited.add(kid.ref);
          // 必须同时查对象流：现代 PDF 常常把页节点压进 /Type /ObjStm；同号的每个定义都入栈
          const values = this.alternatives(kid.ref).filter(isDict);
          if (!values.length) this.stats.structureErrors += 1;
          for (const value of values) stack.push({ value, depth: node.depth + 1, resources, ref: kid.ref });
        } else if (isDict(kid)) {
          stack.push({ value: kid, depth: node.depth + 1, resources });
        }
      }
    }
  }

  private collectPage(page: PdfDict, resources: PdfValue | undefined, ref?: number) {
    const annots = this.resolve(page.get('Annots'));
    if (isArray(annots)) {
      if (annots.length > this.budgets.pageAnnotations) {
        this.stop('pageAnnotations', annots.length, this.budgets.pageAnnotations);
      }
      // 总量按页对象取各定义的最大值累加：同一页的新旧定义不重复计数，也不会让诱饵拉低计数
      const previous = ref === undefined ? 0 : (this.pageAnnotationCounts.get(ref) ?? 0);
      if (annots.length > previous) {
        this.stats.annotations += annots.length - previous;
        if (ref !== undefined) this.pageAnnotationCounts.set(ref, annots.length);
      }
      if (this.stats.annotations > this.budgets.annotations) {
        this.stop('annotations', this.stats.annotations, this.budgets.annotations);
      }
    }
    // /Contents 可能是单个流引用，也可能是引用数组（流本身必然是间接对象）
    const contentsRef = page.get('Contents');
    if (isRef(contentsRef)) this.contentStreamIds.add(contentsRef.ref);
    else {
      const contents = this.resolve(contentsRef);
      if (isArray(contents)) {
        for (const item of contents) if (isRef(item)) this.contentStreamIds.add(item.ref);
      }
    }
    const resourceDict = this.resolve(resources);
    if (!isDict(resourceDict)) return;
    const fonts = this.resolve(resourceDict.get('Font'));
    if (!isDict(fonts)) return;
    for (const font of fonts.values()) {
      if (!isRef(font)) {
        this.countFont(this.resolve(font));
        continue;
      }
      if (this.fontsSeen.has(font.ref)) continue;
      this.fontsSeen.add(font.ref);
      this.stats.fonts += 1;
      if (this.stats.fonts > this.budgets.fonts) this.stop('fonts', this.stats.fonts, this.budgets.fonts);
      this.countFont(this.resolve(font));
    }
  }

  /** 从字体字典（含 FontDescriptor / DescendantFonts）收集字体文件流。 */
  private countFont(font: PdfValue | undefined) {
    if (!isDict(font)) return;
    const descriptors: PdfValue[] = [];
    const own = font.get('FontDescriptor');
    if (own !== undefined) descriptors.push(own);
    const descendants = this.resolve(font.get('DescendantFonts'));
    if (isArray(descendants)) {
      for (const descendant of descendants) {
        const resolved = this.resolve(descendant);
        if (!isDict(resolved)) continue;
        const descriptor = resolved.get('FontDescriptor');
        if (descriptor !== undefined) descriptors.push(descriptor);
      }
    }
    for (const descriptor of descriptors) {
      const resolved = this.resolve(descriptor);
      if (!isDict(resolved)) continue;
      for (const key of ['FontFile', 'FontFile2', 'FontFile3']) {
        const file = resolved.get(key);
        if (isRef(file)) this.fontFileIds.add(file.ref);
      }
    }
  }

  // -- 5. 流记账 ------------------------------------------------------------

  /** 只解码计数、不保存结果；命中总预算立即中止。 */
  private accountDecoded(length: number) {
    this.decoded += length;
    if (this.decoded > this.budgets.decodedBytes) {
      this.stop('decodedBytes', this.decoded, this.budgets.decodedBytes);
    }
    this.stats.decodedStreamBytes = this.decoded;
  }

  accountStreams() {
    // 遍历每一个定义而不是每个对象号：同号的重复定义里的流同样要解码记账
    for (const { id, stream, objectStream } of this.definitions) {
      if (!stream) continue;
      if (objectStream) continue; // 这一份已在对象流阶段记账（同号的其他定义不受影响）
      this.guard();
      this.stats.streams += 1;
      if (this.stats.streams > this.budgets.streams) {
        this.stop('streams', this.stats.streams, this.budgets.streams);
      }
      const role = this.contentStreamIds.has(id) ? 'content' : this.fontFileIds.has(id) ? 'font' : 'other';
      this.accountStream(stream, role);
    }
  }

  private accountStream(stream: PdfStream, role: 'content' | 'font' | 'other') {
    const raw = stream.end - stream.start;
    const plan = this.planStream(stream.dict, raw);
    if (plan.kind === 'malformed') {
      this.stats.malformedStreams += 1;
      this.accountDecoded(raw);
      if (role === 'font') this.accountFontBytes(raw);
      return;
    }
    if (plan.kind === 'plain') {
      this.accountDecoded(plan.estimated);
      if (role === 'font') this.accountFontBytes(plan.estimated);
      // 没有过滤器时「压缩字节」就是解码字节，可以直接在其中统计文本算子
      if (role === 'content') this.chargeTextOperators(this.bytes.subarray(stream.start, stream.end));
      return;
    }
    if (plan.kind === 'amplifying') {
      this.stats.estimatedFilterStreams += 1;
      this.accountDecoded(plan.estimated);
      if (role === 'font') this.accountFontBytes(plan.estimated);
      return;
    }
    const remaining = this.budgets.decodedBytes - this.decoded;
    const perStream =
      role === 'content'
        ? Math.min(this.budgets.streamBytes, this.budgets.contentStreamBytes)
        : this.budgets.streamBytes;
    const limit = Math.min(perStream, remaining);
    const buffer: Uint8Array[] = [];
    const keepForText = role === 'content';
    let size = 0;
    try {
      inflateFlate(this.bytes.subarray(stream.start, stream.end), {
        limit,
        sink: (chunk) => {
          this.guard();
          // 先按字节记账（超总预算会在此抛错），再决定是否保留用于文本算子统计
          this.accountDecoded(chunk.length);
          size += chunk.length;
          if (keepForText) buffer.push(chunk.slice());
        },
      });
    } catch (error) {
      if (error instanceof InflateLimitError) {
        // 区分是哪个预算把解码截断了：内容流 / 单个流 / 全文件总量
        if (limit === this.budgets.contentStreamBytes) {
          this.stop(
            'contentStreamBytes',
            limit,
            this.budgets.contentStreamBytes,
            'content stream decode budget reached',
          );
        }
        if (limit === this.budgets.streamBytes) {
          this.stop('streamBytes', limit, this.budgets.streamBytes, 'stream decode budget reached');
        }
        this.stop('decodedBytes', this.decoded + limit, this.budgets.decodedBytes, 'global decode budget reached');
      }
      if (isFatal(error)) throw error;
      // 头部/语法异常：PDF.js 也会拒绝该流；这里保守按压缩长度估算，避免漏计
      this.stats.malformedStreams += 1;
      this.accountDecoded(raw);
      if (role === 'font') this.accountFontBytes(raw);
      return;
    }
    if (role === 'font') this.accountFontBytes(size);
    if (keepForText) {
      const decoded = new Uint8Array(size);
      let cursor = 0;
      for (const chunk of buffer) {
        decoded.set(chunk, cursor);
        cursor += chunk.length;
      }
      this.chargeTextOperators(decoded);
    }
  }

  /** 文本算子记账：先看单流预算，再看全文件预算。 */
  private chargeTextOperators(decoded: Uint8Array) {
    const operators = countTextOperators(decoded);
    if (operators > this.budgets.streamTextOperators) {
      this.stop('streamTextOperators', operators, this.budgets.streamTextOperators);
    }
    this.textOperators += operators;
    this.stats.textOperators = this.textOperators;
    if (this.textOperators > this.budgets.textOperators) {
      this.stop('textOperators', this.textOperators, this.budgets.textOperators);
    }
  }

  private accountFontBytes(length: number) {
    this.fontStreamBytes += length;
    this.stats.fontBytes = this.fontStreamBytes;
    if (this.fontStreamBytes > this.budgets.fontBytes) {
      this.stop('fontBytes', this.fontStreamBytes, this.budgets.fontBytes);
    }
  }

  /**
   * 过滤器链**按数组顺序解码**（已核对 pdf.js pdf.worker.mjs 的 `filter()`：它对
   * `filterArray[i]` 逐个 `makeFilter(stream, ...)` 包装，最内层 filter[0] 先消费原始字节）。
   * 于是：
   * - filter[0] 是 FlateDecode 时我们能精确解出第一层字节数（其余层要么缩小、要么是
   *   DCT 等图像编码器，其像素展开由 PDF.js 的 maxImageSize / 画布预算约束）；
   * - filter[0] 是图像编码器或缩小编码（ASCII85/ASCIIHex/Crypt）时按压缩长度计；
   *   但若其后还挂着放大层（如 /Filter [/ASCII85Decode /FlateDecode]），我们无法到达那一层，
   *   只能按倍数保守估算 —— 宁可多算，不可漏计；
   * - 其余（LZW/RunLength 等会放大而我们不解码的）同样按倍数保守估算。
   */
  private planStream(dict: PdfDict, raw: number): StreamPlan {
    const filter = this.resolve(dict.get('Filter'));
    const names: string[] = [];
    if (filter && typeof filter === 'object' && 'name' in filter) names.push((filter as PdfName).name);
    else if (isArray(filter)) {
      for (const item of filter)
        if (item && typeof item === 'object' && 'name' in item) names.push((item as PdfName).name);
    }
    if (names.length === 0) return { kind: 'plain', estimated: raw };
    const [firstDecoder] = names;
    const amplifying = (name: string) => !NON_AMPLIFYING.has(name) && !IMAGE_CODERS.has(name);
    if (FLATE_FILTERS.has(firstDecoder)) {
      // [/FlateDecode /FlateDecode] 这类链：第一层我们只解出其输出字节数，其后若还有
      // 放大层（第二个 Flate、LZW、RunLength…），其展开无法计量——与缩小编码分支同口径，
      // 按倍数保守估算，宁可多算不可漏计（曾只看 firstDecoder，双层 Flate 可绕过预算）。
      return names.slice(1).some(amplifying)
        ? { kind: 'amplifying', estimated: raw * this.budgets.unknownFilterAmplification }
        : { kind: 'flate' };
    }
    if (IMAGE_CODERS.has(firstDecoder)) return { kind: 'plain', estimated: raw };
    if (NON_AMPLIFYING.has(firstDecoder)) {
      // 盔甲/缩小编码本身不放大；只有其后确实还有放大层时才保守估算，
      // 避免对纯 /ASCIIHexDecode、/ASCII85Decode 的合法流过度拒绝。
      return names.slice(1).some(amplifying)
        ? { kind: 'amplifying', estimated: raw * this.budgets.unknownFilterAmplification }
        : { kind: 'plain', estimated: raw };
    }
    return { kind: 'amplifying', estimated: raw * this.budgets.unknownFilterAmplification };
  }

  // -- 6. 编排 --------------------------------------------------------------

  /**
   * 返回是否定位到 Catalog/页树；预算命中通过 PreflightStop 抛出。
   * 定位不到页树时流照常记账（不能因为结构认不出就跳过解码预算），由 preflightPdf 判 structure。
   */
  run(): boolean {
    this.scanObjects();
    this.rejectEncrypted();
    this.decodeObjectStreams();
    const roots = this.pageTreeRoots();
    if (roots.length) this.walkPageTree(roots);
    this.accountStreams();
    return roots.length > 0;
  }
}

type PageTreeNode = { value: PdfDict; depth: number; resources: PdfValue | undefined; ref?: number };

/**
 * 解析容器结构并按预算判定。
 *
 * - 命中预算：`ok=false` + 类型化 violations（扫描在第一条违规处停止，fail fast）。
 * - 加密文档：`ok=false`、code=encrypted。
 * - 定位不到 Catalog/页树（含预检内部异常）：所有流照常记账后 `ok=false`、code=structure、
 *   `stats.parsed=false`——fail closed，不再交给 PDF.js 兜底。预检仍不声称能识别所有畸形文件
 *   （见 SECURITY.md 的残留限制）。
 * - `signal` 触发：抛 PdfPreflightAborted，调用方按过期回调丢弃。
 */
export const preflightPdf = (bytes: Uint8Array, options: PdfPreflightOptions = {}): PdfPreflightReport => {
  const budgets: PdfPreflightBudgets = { ...PDF_PREFLIGHT_BUDGETS, ...options.budgets };
  const preflight = new Preflight(bytes, budgets, options.signal);
  const violations: PdfPreflightViolation[] = [];
  let parsed = false;
  try {
    parsed = preflight.run();
  } catch (error) {
    if (error instanceof PreflightStop) violations.push(error.violation);
    else if (error instanceof PdfPreflightAborted) throw error;
    else preflight.stats.structureErrors += 1;
  }
  preflight.stats.parsed = parsed;
  if (!parsed && violations.length === 0) {
    violations.push({ code: 'structure', actual: 0, limit: 1, detail: 'catalog / page tree not found' });
  }
  preflight.stats.elapsedMs = Date.now() - preflight.startedAt;
  return { ok: violations.length === 0, aborted: false, violations, stats: preflight.stats };
};

/** 预检拒绝 → 页面错误码：加密与结构无法识别各有专门提示，其余都是「资源超预算」。 */
export const preflightFailure = (report: PdfPreflightReport): 'encrypted' | 'parseFailed' | 'preflight' => {
  const code = report.violations[0]?.code;
  if (code === 'encrypted') return 'encrypted';
  if (code === 'structure') return 'parseFailed';
  return 'preflight';
};

/** 违规摘要（日志/告警用），例如 `decodedBytes=134217728>67108864`。 */
export const summarizePreflight = (report: PdfPreflightReport) =>
  report.violations.map((violation) => `${violation.code}=${violation.actual}>${violation.limit}`).join(', ');
