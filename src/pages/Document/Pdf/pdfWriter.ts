/**
 * 极简 PDF 封装：每页一张 JPEG（DCTDecode 原样嵌入，无需编码），A4 纵向铺满。
 * 用于把浏览器里渲染好的报告页（html2canvas 截图）打包成 PDF——中文、图表都按像素保留，
 * 不需要嵌入 CJK 字体（那会是数 MB 的字体文件）。代价是文字不可选中，适合「报表导出」这类场景。
 */

export type JpegPage = { jpeg: Uint8Array; width: number; height: number };

const A4 = { width: 595.28, height: 841.89 };

const encoder = new TextEncoder();

export const dataUrlToBytes = (dataUrl: string) => {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const buildImagePdf = (pages: JpegPage[]): Uint8Array => {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  // 对象编号：1 目录、2 页树，之后每页 3 个对象（页、内容流、图片）
  const object = (id: number, body: (string | Uint8Array)[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body.forEach(push);
    push('\nendobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const pageIds = pages.map((_, index) => 3 + index * 3);
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2, [`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`]);

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    // 等比缩放铺满 A4 宽度，顶部对齐
    const scale = A4.width / page.width;
    const drawHeight = page.height * scale;
    const content = `q ${A4.width.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} 0 ${(A4.height - drawHeight).toFixed(2)} cm /Im0 Do Q`;
    object(pageId, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] `,
      `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    ]);
    object(contentId, [`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`]);
    object(imageId, [
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} `,
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      '\nendstream',
    ]);
  });

  const xrefOffset = length;
  const count = 3 + pages.length * 3;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const result = new Uint8Array(length);
  let cursor = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, cursor);
    cursor += chunk.length;
  });
  return result;
};
