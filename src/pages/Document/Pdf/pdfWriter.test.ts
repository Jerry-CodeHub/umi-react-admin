import { describe, expect, it } from 'vitest';
import { buildImagePdf } from './pdfWriter';

// 最小的合法 JPEG 不重要：这里验证的是 PDF 结构（交叉引用偏移必须精确，否则阅读器会报损坏）
const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

describe('buildImagePdf', () => {
  const pdf = buildImagePdf([
    { jpeg: fakeJpeg, width: 1588, height: 2246 },
    { jpeg: fakeJpeg, width: 1588, height: 2246 },
  ]);
  const text = new TextDecoder('latin1').decode(pdf);

  it('文件头、页数与结尾正确', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('xref 中每个对象的偏移都指向对应的「N 0 obj」', () => {
    const xref = text.slice(text.indexOf('xref\n'));
    const entries = [...xref.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(8);
    entries.forEach((offset, index) => {
      expect(text.slice(offset, offset + 12)).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
  });
});
