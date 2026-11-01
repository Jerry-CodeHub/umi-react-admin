import { constants, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { InflateError, InflateLimitError, inflateFlate, inflateRaw } from './inflate';

/**
 * 本机长期高负载（其他工作流并行跑 lint/vitest），绝对耗时不可作为断言，
 * 因此解码较重的用例显式放宽超时；断言内容一律不放松。
 */
const HEAVY = { timeout: 120_000 };

/** 用真实 zlib 压缩，再用自研解码器解回来：这是「无依赖但正确」的核心对拍。 */
const roundTrip = (input: Uint8Array, deflateOptions?: Parameters<typeof deflateSync>[1]) => {
  const compressed = new Uint8Array(deflateSync(input, deflateOptions));
  const chunks: Uint8Array[] = [];
  const total = inflateFlate(compressed, { sink: (chunk) => chunks.push(chunk.slice()) });
  const joined = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    joined.set(chunk, cursor);
    cursor += chunk.length;
  }
  expect(cursor).toBe(total);
  expect(joined).toEqual(input);
  return { compressed, total };
};

const text = (value: string) => new TextEncoder().encode(value);
const zeros = (length: number) => new Uint8Array(length);

describe('inflateFlate round-trips real zlib output', () => {
  it('decodes a short literal string (fixed huffman)', () => {
    roundTrip(text('BT /F1 12 Tf (hello pdf preflight) Tj ET'), { strategy: constants.Z_FIXED });
  });

  it('decodes dynamic huffman with long back-references', { timeout: 120_000 }, () => {
    // 高度重复 -> 动态 Huffman + 长距离匹配，覆盖 copy() 的回环路径
    roundTrip(text('q 1 0 0 1 0 0 cm /Im0 Do Q '.repeat(2000)));
  });

  it('decodes a stored (uncompressed) block', () => {
    roundTrip(text('stored block payload '.repeat(200)), { level: 0 });
  });

  it('decodes level-0 zlib streams spanning multiple stored blocks (>64 KiB)', HEAVY, () => {
    // 200 KiB 零压缩 = 4 个 65535 字节存储块：第二个块进入前环形缓冲还滞留
    // 32767 字节未交付，覆盖即静默损坏（存储块回环写入缺陷的最小复现）。
    const input = text('level-zero must not corrupt the ring buffer. '.repeat(4600));
    expect(input.length).toBeGreaterThan(3 * 65535);
    roundTrip(input, { level: 0 });
  });

  it('delivers the partial tail before a stored block that would wrap the ring', HEAVY, () => {
    // 手工构造 raw DEFLATE：固定 Huffman 块先产出 1000 字节（余量 r=1000 ∈ (0,32768)），
    // 紧跟一个 65535 字节存储块 —— r+65535 > 65536，环形写入必然跨过未交付区间，
    // 修复前这里交付给 sink 的数据已被覆盖。Huffman 码字 MSB-first，其余比特 LSB-first。
    const headLen = 1000;
    const storedLen = 65535;
    const bytes: number[] = [];
    let bitBuf = 0;
    let bitCnt = 0;
    const writeBits = (value: number, n: number) => {
      bitBuf |= value << bitCnt;
      bitCnt += n;
      while (bitCnt >= 8) {
        bytes.push(bitBuf & 0xff);
        bitBuf >>>= 8;
        bitCnt -= 8;
      }
    };
    const writeCode = (code: number, n: number) => {
      for (let i = n - 1; i >= 0; i--) writeBits((code >> i) & 1, 1);
    };
    writeBits(0, 1); // BFINAL=0
    writeBits(1, 2); // BTYPE=01 固定 Huffman
    const payload: number[] = [];
    for (let i = 0; i < headLen; i++) payload.push(0x41 + (i % 26));
    for (const b of payload) writeCode(0x30 + b, 8); // 符号 0..143：8 位码 00110000+sym
    writeCode(0, 7); // EOB(256)：0000000
    writeBits(1, 1); // BFINAL=1
    writeBits(0, 2); // BTYPE=00 存储块
    if (bitCnt > 0) {
      bytes.push(bitBuf & 0xff);
      bitBuf = 0;
      bitCnt = 0;
    }
    const len = storedLen & 0xffff;
    const nlen = ~len & 0xffff;
    bytes.push(len & 0xff, (len >> 8) & 0xff, nlen & 0xff, (nlen >> 8) & 0xff);
    for (let i = 0; i < storedLen; i++) bytes.push(0x5a);

    const input = new Uint8Array(headLen + storedLen);
    input.set(payload, 0);
    input.fill(0x5a, headLen);
    const chunks: Uint8Array[] = [];
    const total = inflateRaw(new Uint8Array(bytes), { sink: (chunk) => chunks.push(chunk.slice()) });
    const joined = new Uint8Array(total);
    let cursor = 0;
    for (const chunk of chunks) {
      joined.set(chunk, cursor);
      cursor += chunk.length;
    }
    expect(cursor).toBe(total);
    expect(total).toBe(input.length);
    expect(joined).toEqual(input);
  });

  it('decodes incompressible binary data', HEAVY, () => {
    const binary = new Uint8Array(32 * 1024);
    for (let index = 0; index < binary.length; index++) binary[index] = (index * 37 + (index >> 3)) & 0xff;
    roundTrip(binary);
  });

  it('delivers output spanning many flush windows in order, including the tail', HEAVY, () => {
    // 256 KiB = 8 个 32 KiB 窗口 + 尾巴：同时覆盖多窗 flush 与 drain()
    const input = text('0123456789abcdef'.repeat(16 * 1024));
    const { total } = roundTrip(input);
    expect(total).toBe(input.length);
    expect(deflateSync(input).length).toBeLessThan(input.length / 4);
  });

  it('decodes an overlapping copy with distance 1', HEAVY, () => {
    roundTrip(text('a'.repeat(120_000)));
  });
});

describe('inflateFlate enforces the decode budget while decoding', () => {
  it('aborts a decompression bomb without materialising the full output', () => {
    // 4 MiB 的零压缩后只有几 KB：典型解压炸弹形状
    const bomb = new Uint8Array(deflateSync(zeros(4 * 1024 * 1024)));
    expect(bomb.length).toBeLessThan(16 * 1024);
    const limit = 64 * 1024;
    let emitted = 0;
    expect(() =>
      inflateFlate(bomb, {
        limit,
        sink: (chunk) => {
          emitted += chunk.length;
        },
      }),
    ).toThrow(InflateLimitError);
    // 硬上限：交付的字节数绝不超过预算，也绝不保留 4 MiB 输出。
    // 中止路径上最多还有不足一窗的尾部不交付，因此下限是「已交付的整窗」。
    expect(emitted).toBeLessThanOrEqual(limit);
    expect(emitted).toBeGreaterThanOrEqual(limit - 32768);
    expect(emitted).toBeLessThan(4 * 1024 * 1024);
  });

  it('reports the budget on the thrown error', () => {
    const compressed = new Uint8Array(deflateSync(text('x'.repeat(4096))));
    // 断言必须放在条件语句之外：先把异常捕获成值，再统一断言
    const captured: unknown = (() => {
      try {
        inflateFlate(compressed, { limit: 128 });
        return undefined;
      } catch (error) {
        return error;
      }
    })();
    expect(captured).toBeInstanceOf(InflateLimitError);
    expect((captured as InflateLimitError).limit).toBe(128);
  });

  it('allows output exactly equal to the limit and rejects one byte more', () => {
    const compressed = new Uint8Array(deflateSync(text('y'.repeat(1000))));
    expect(inflateFlate(compressed, { limit: 1000 })).toBe(1000);
    expect(() => inflateFlate(compressed, { limit: 999 })).toThrow(InflateLimitError);
  });

  it('delivers the complete output when no sink is attached', () => {
    const input = text('no sink means the caller only wants the byte count '.repeat(100));
    const compressed = new Uint8Array(deflateSync(input));
    expect(inflateFlate(compressed)).toBe(input.length);
  });
});

describe('inflateFlate header handling matches pdf.js FlateStream', () => {
  it('rejects a stream without a zlib header', () => {
    const raw = new Uint8Array(deflateSync(text('no zlib wrapper here')));
    expect(() => inflateRaw(raw.subarray(2), {})).not.toThrow();
    expect(() => inflateFlate(raw.subarray(2), {})).toThrow(InflateError);
  });

  it('rejects a preset-dictionary stream we cannot decode', () => {
    const compressed = new Uint8Array(deflateSync(text('dictionary'))).slice();
    const original = compressed[1];
    // FLG 低 5 位是 FCHECK：保留 FDICT(0x20)/FLEVEL 位，只在低 5 位里找出合法校验位，
    // 这样失败原因必然是 FDICT，而不是校验位。
    const base = (original | 0x20) & 0xe0;
    let flg = -1;
    for (let fcheck = 0; fcheck < 32; fcheck++) {
      if (((compressed[0] << 8) + (base | fcheck)) % 31 === 0) {
        flg = base | fcheck;
        break;
      }
    }
    expect(flg).toBeGreaterThanOrEqual(0);
    expect(flg & 0x20).toBe(0x20);
    compressed[1] = flg;
    expect(() => inflateFlate(compressed, {})).toThrow(/FDICT/);
    // 同样的字节去掉 FDICT 位就能解出来：证明抛错来自 FDICT 分支
    compressed[1] = original;
    expect(inflateFlate(compressed, {})).toBe(10);
  });

  it('rejects truncated and structurally invalid payloads instead of returning partial data', () => {
    const compressed = new Uint8Array(deflateSync(text('truncate me please'.repeat(50))));
    expect(() => inflateFlate(compressed.subarray(0, compressed.length - 8), {})).toThrow(InflateError);
    // DEFLATE 主体没有校验和，随机翻转一个字节仍可能解出「合法但不同」的数据，
    // 因此这里只断言真正可由结构判定的情形：非法的块类型 BTYPE=11。
    const invalidBlock = compressed.slice();
    invalidBlock[2] = (invalidBlock[2] & 0xf8) | 0b111;
    expect(() => inflateFlate(invalidBlock, {})).toThrow(/invalid block type/);
  });

  it('matches node zlib across a deterministic fuzz corpus', HEAVY, () => {
    let seed = 0x2f6e2b1;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const strategies = [constants.Z_DEFAULT_STRATEGY, constants.Z_FIXED, constants.Z_HUFFMAN_ONLY, constants.Z_RLE];
    for (let round = 0; round < 16; round++) {
      const length = 1 + Math.floor(random() * 16_000);
      const input = new Uint8Array(length);
      const alphabet = [1, 3, 17, 256][round % 4];
      for (let index = 0; index < length; index++) input[index] = Math.floor(random() * alphabet) & 0xff;
      roundTrip(input, { level: round % 10, strategy: strategies[round % strategies.length] });
    }
  });
});
