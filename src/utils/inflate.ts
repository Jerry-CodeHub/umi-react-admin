/**
 * 最小化 DEFLATE 解码器（RFC1950 zlib 包装 + RFC1951 主体）：零依赖、同步、可增量计数。
 * 使用方：PDF 容器预检（src/pages/Document/Pdf/pdfPreflight.ts）与签名 PNG 强校验（./signature.ts）。
 *
 * 为什么不用平台的 DecompressionStream：
 * - 预检必须在「解码过程中」就按字节预算中止，且不能把解码结果整体留在内存里 ——
 *   这正是抵御 PDF 解压炸弹的关键。流式 API 无法在同步点抛错退出并丢弃已解出的数据。
 * - 同步实现让 pdfPreflight 完全同步，Node（vitest）与浏览器行为一致，也便于对拍测试。
 *
 * 头部处理刻意与 pdf.js 的 FlateStream 保持一致：要求 zlib 头且禁止 FDICT，
 * 因此预检接受的流集合不会比真正的加载器更宽。
 *
 * 性能与正确性：解码器在主线程同步执行，热路径写成「单函数 + 闭包局部变量」，避免每比特的
 * 函数调用与属性访问。输出直接写进 64 KiB 环形缓冲，其中「最近 32 KiB」同时充当 LZ77 滑动
 * 字典；缓冲之所以是最大回溯距离的两倍，是因为输出缓冲本身会被复用 —— 若只有 32 KiB，
 * 写入下一窗的第一个字节就会覆盖尚未交付的上一窗首字节。每交付 32 KiB 回调一次 sink，
 * 因此从不保留完整解码结果。
 */

const WINDOW_SIZE = 32768;
const OUTPUT_SIZE = WINDOW_SIZE * 2;
const OUTPUT_MASK = OUTPUT_SIZE - 1;
const MAX_BITS = 15;

const LENGTH_BASE = new Uint16Array([
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
]);
const LENGTH_EXTRA = new Uint8Array([
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
]);
const DIST_BASE = new Uint16Array([
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577,
]);
const DIST_EXTRA = new Uint8Array([
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
]);
const CODE_LENGTH_ORDER = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);

export class InflateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InflateError';
  }
}

/** 解出的字节数超过调用方给出的预算；用于立刻中止解压炸弹。 */
export class InflateLimitError extends InflateError {
  constructor(readonly limit: number) {
    super(`inflate: decoded output exceeded ${limit} bytes`);
    this.name = 'InflateLimitError';
  }
}

export type InflateOptions = {
  /** 允许解出的最大字节数；达到 limit 后继续产出会抛 InflateLimitError。 */
  limit?: number;
  /**
   * 交付解码结果（顺序保证），调用方据此递增计数/预算，无需保存全量输出。
   * 通常每凑满 32 KiB 回调一次；唯一例外是超长存储块前的不足一窗尾巴（防环形覆盖），
   * 以及流末尾 drain() 的最后一段。传入的 Uint8Array 是复用中的环形缓冲视图：
   * 需要长期保留必须自行 `slice()`。
   * 成功返回时输出必然完整；若中途因 limit 或格式错误抛错，则不足一窗（< 32 KiB）的尾部
   * 不会交付 —— 这种情况只会发生在调用方已经决定拒绝该文件的路径上。
   */
  sink?: (chunk: Uint8Array) => void;
};

type Huffman = { counts: Uint16Array; symbols: Uint16Array };

const buildHuffman = (lengths: Uint8Array, count: number): { table: Huffman; left: number } => {
  const counts = new Uint16Array(MAX_BITS + 1);
  for (let index = 0; index < count; index++) counts[lengths[index]] += 1;
  counts[0] = 0;
  const offsets = new Uint16Array(MAX_BITS + 2);
  for (let length = 1; length <= MAX_BITS; length++) offsets[length + 1] = offsets[length] + counts[length];
  const symbols = new Uint16Array(count);
  for (let index = 0; index < count; index++) {
    const length = lengths[index];
    if (length) symbols[offsets[length]++] = index;
  }
  let left = 1;
  for (let length = 1; length <= MAX_BITS; length++) {
    left <<= 1;
    left -= counts[length];
    if (left < 0) break;
  }
  return { table: { counts, symbols }, left };
};

const FIXED_LITERAL = (() => {
  const lengths = new Uint8Array(288);
  for (let symbol = 0; symbol < 144; symbol++) lengths[symbol] = 8;
  for (let symbol = 144; symbol < 256; symbol++) lengths[symbol] = 9;
  for (let symbol = 256; symbol < 280; symbol++) lengths[symbol] = 7;
  for (let symbol = 280; symbol < 288; symbol++) lengths[symbol] = 8;
  return buildHuffman(lengths, 288).table;
})();
const FIXED_DISTANCE = buildHuffman(new Uint8Array(30).fill(5), 30).table;

/** 解码 raw DEFLATE（无 zlib 头），返回解出的总字节数。 */
export const inflateRaw = (data: Uint8Array, options: InflateOptions = {}): number => {
  const limit = options.limit ?? Number.MAX_SAFE_INTEGER;
  const sink = options.sink;
  const window = new Uint8Array(OUTPUT_SIZE);

  let pos = 0;
  let bitBuffer = 0;
  let bitCount = 0;
  let total = 0;
  let flushed = 0;

  /** 按逻辑顺序交付 [from, from + count)（count <= OUTPUT_SIZE），最多两段以处理回环。 */
  const sinkRange = (from: number, count: number) => {
    if (!sink) return;
    const start = from & OUTPUT_MASK;
    const firstPart = Math.min(count, OUTPUT_SIZE - start);
    if (firstPart === count) sink(window.subarray(start, start + count));
    else {
      sink(window.subarray(start));
      sink(window.subarray(0, count - firstPart));
    }
  };

  /** 交付所有已写满一整窗的连续输出。 */
  const flush = () => {
    // 没有 sink 时数据无需保留：直接推进 flushed，环形缓冲随即可被覆盖。
    if (!sink) {
      flushed = total;
      return;
    }
    while (total - flushed >= WINDOW_SIZE) {
      sinkRange(flushed, WINDOW_SIZE);
      flushed += WINDOW_SIZE;
    }
  };

  /** 流结束后交出最后一截不足一窗的尾巴；不调用会静默丢掉 < 32 KiB 的输出。 */
  const drain = () => {
    flush();
    if (sink && total > flushed) {
      sinkRange(flushed, total - flushed);
      flushed = total;
    }
  };

  const bits = (need: number): number => {
    while (bitCount < need) {
      if (pos >= data.length) throw new InflateError('inflate: unexpected end of stream');
      bitBuffer |= data[pos++] << bitCount;
      bitCount += 8;
    }
    const value = bitBuffer & ((1 << need) - 1);
    bitBuffer >>>= need;
    bitCount -= need;
    return value;
  };

  // 逐比特读取内联在这里：每个符号都要走 7~15 步，是解码的绝对热路径。
  const decodeSymbol = (table: Huffman): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let length = 1; length <= MAX_BITS; length++) {
      if (bitCount === 0) {
        if (pos >= data.length) throw new InflateError('inflate: unexpected end of stream');
        bitBuffer = data[pos++];
        bitCount = 8;
      }
      code |= bitBuffer & 1;
      bitBuffer >>>= 1;
      bitCount -= 1;
      const count = table.counts[length];
      if (code - first < count) return table.symbols[index + (code - first)];
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    throw new InflateError('inflate: invalid huffman code');
  };

  const copyMatch = (length: number, distance: number) => {
    let read = (total - distance) & OUTPUT_MASK;
    let write = total & OUTPUT_MASK;
    // 重叠匹配（distance < length）必须逐字节推进，才能复现 LZ77 的语义
    for (let index = 0; index < length; index++) {
      window[write] = window[read];
      read = (read + 1) & OUTPUT_MASK;
      write = (write + 1) & OUTPUT_MASK;
    }
    total += length;
    flush();
  };

  const runBlock = (literal: Huffman, distance: Huffman) => {
    for (;;) {
      // 先腾空间再写：保证被覆盖的槽位属于已经交付的数据
      if (total - flushed >= OUTPUT_SIZE) flush();
      const symbol = decodeSymbol(literal);
      if (symbol < 256) {
        // 预算检查放在「真正产出字节之前」：输出恰好等于 limit 的流必须能解完
        // （块结束符号不产出字节，不应因为到达 limit 而失败）。
        if (total >= limit) throw new InflateLimitError(limit);
        window[total & OUTPUT_MASK] = symbol;
        total += 1;
        flush();
        continue;
      }
      if (symbol === 256) {
        drain();
        return;
      }
      const lengthIndex = symbol - 257;
      if (lengthIndex >= LENGTH_BASE.length) throw new InflateError('inflate: invalid length code');
      const length = LENGTH_BASE[lengthIndex] + bits(LENGTH_EXTRA[lengthIndex]);
      const distSymbol = decodeSymbol(distance);
      if (distSymbol >= DIST_BASE.length) throw new InflateError('inflate: invalid distance code');
      const back = DIST_BASE[distSymbol] + bits(DIST_EXTRA[distSymbol]);
      if (back > total) throw new InflateError('inflate: distance beyond start of stream');
      if (total + length > limit) throw new InflateLimitError(limit);
      if (total - flushed + length > OUTPUT_SIZE) flush();
      copyMatch(length, back);
    }
  };

  let final = false;
  while (!final) {
    final = bits(1) === 1;
    const type = bits(2);
    if (type === 0) {
      bitBuffer = 0;
      bitCount = 0;
      const length = bits(16);
      const complement = bits(16);
      if (length !== (~complement & 0xffff)) throw new InflateError('inflate: stored block length mismatch');
      if (pos + length > data.length) throw new InflateError('inflate: stored block overruns stream');
      if (total + length > limit) throw new InflateLimitError(limit);
      if (total + length - flushed > OUTPUT_SIZE) {
        flush();
        // flush 只交付满窗（最多滞留 WINDOW_SIZE-1 字节）。存储块最长 65535，仍放不下时
        // 环形写入会覆盖这些未交付字节 —— 必须先把不足一窗的尾巴直接交给 sink（无 sink
        // 时 flush 已把 flushed 推到 total，不会走到这里）。此后剩余恒为 0，写入绝不回环覆盖。
        if (total + length - flushed > OUTPUT_SIZE) {
          sinkRange(flushed, total - flushed);
          flushed = total;
        }
      }
      const at = total & OUTPUT_MASK;
      const firstPart = Math.min(length, OUTPUT_SIZE - at);
      window.set(data.subarray(pos, pos + firstPart), at);
      if (firstPart < length) window.set(data.subarray(pos + firstPart, pos + length), 0);
      pos += length;
      total += length;
      flush();
    } else if (type === 1) {
      runBlock(FIXED_LITERAL, FIXED_DISTANCE);
    } else if (type === 2) {
      const literalCount = bits(5) + 257;
      const distanceCount = bits(5) + 1;
      const codeLengthCount = bits(4) + 4;
      if (literalCount > 286 || distanceCount > 30)
        throw new InflateError('inflate: too many length or distance codes');
      const codeLengths = new Uint8Array(19);
      for (let index = 0; index < codeLengthCount; index++) codeLengths[CODE_LENGTH_ORDER[index]] = bits(3);
      const codeLengthTable = buildHuffman(codeLengths, 19);
      if (codeLengthTable.left !== 0) throw new InflateError('inflate: incomplete code length code');
      const lengths = new Uint8Array(literalCount + distanceCount);
      let index = 0;
      while (index < literalCount + distanceCount) {
        const symbol = decodeSymbol(codeLengthTable.table);
        if (symbol < 16) {
          lengths[index++] = symbol;
          continue;
        }
        let repeat = 0;
        let value = 0;
        if (symbol === 16) {
          if (index === 0) throw new InflateError('inflate: repeat with no previous code length');
          value = lengths[index - 1];
          repeat = 3 + bits(2);
        } else if (symbol === 17) {
          repeat = 3 + bits(3);
        } else {
          repeat = 11 + bits(7);
        }
        if (index + repeat > literalCount + distanceCount) throw new InflateError('inflate: too many code lengths');
        while (repeat-- > 0) lengths[index++] = value;
      }
      const literal = buildHuffman(lengths.subarray(0, literalCount), literalCount);
      // 与 puff 一致：literal/length 表允许不完整，但仅限「只有一个长度为 1 的码」这一情形。
      if (
        literal.left !== 0 &&
        (literal.left < 0 || literalCount !== literal.table.counts[0] + literal.table.counts[1])
      ) {
        throw new InflateError('inflate: incomplete literal/length code');
      }
      const distance = buildHuffman(lengths.subarray(literalCount), distanceCount);
      if (distance.left < 0) throw new InflateError('inflate: over-subscribed distance code');
      runBlock(literal.table, distance.table);
    } else {
      throw new InflateError('inflate: invalid block type');
    }
  }

  drain();
  return total;
};

/**
 * 解码 PDF /FlateDecode 流。头部校验与 pdf.js FlateStream 相同：
 * 必须有合法 zlib 头，且 FDICT 必须为 0（需要预设字典的流我们无法解码）。
 */
export const inflateFlate = (data: Uint8Array, options: InflateOptions = {}): number => {
  if (data.length < 2) throw new InflateError('inflate: truncated zlib header');
  const cmf = data[0];
  const flg = data[1];
  if ((cmf & 0x0f) !== 8) throw new InflateError('inflate: unknown compression method');
  if (((cmf << 8) + flg) % 31 !== 0) throw new InflateError('inflate: bad FCHECK');
  if (flg & 0x20) throw new InflateError('inflate: FDICT requires a preset dictionary');
  return inflateRaw(data.subarray(2), options);
};
