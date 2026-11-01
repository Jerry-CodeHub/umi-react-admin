import { rampColor } from '@/components/CesiumViewer/palette';
import { contours } from 'd3';
import { FIELD_MAX, FIELD_MIN } from './fieldModel';

/**
 * 热力渲染（主线程）：ScalarGrid → ImageData（双线性采样 + 256 级色带 LUT）
 * + 等值线（d3-contour，标注 dB 值）。比旧的「径向渐变圆叠加」连续、专业，
 * 且逐像素写入 ImageData 的成本远低于数万个 fillRect。
 */

const LUT_SIZE = 256;
let lutCache: Uint8ClampedArray[] | undefined;

const buildLut = () =>
  (lutCache ??= Array.from({ length: LUT_SIZE }, (_, i) => {
    const css = rampColor(i / (LUT_SIZE - 1));
    const [r, g, b] = css.match(/\d+/g)!.map(Number);
    return new Uint8ClampedArray([r, g, b, 255]);
  }));

// ImageData 按 canvas + 尺寸缓存复用：热力「呼吸」4Hz 全像素重写，512×336 每帧新建
// 是 ~675KB/帧（≈2.7MB/s）的纯 GC 垃圾；下方循环逐像素写满全部通道，复用无残留
const imageCache = new WeakMap<HTMLCanvasElement, { w: number; h: number; image: ImageData }>();
const acquireImageData = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const hit = imageCache.get(canvas);
  if (hit && hit.w === w && hit.h === h) return hit.image;
  const image = ctx.createImageData(w, h);
  imageCache.set(canvas, { w, h, image });
  return image;
};

export interface HeatGrid {
  cols: number;
  rows: number;
  values: Float32Array;
}

/** 双线性采样网格（连续坐标，超界取边缘） */
const sampleBilinear = (grid: HeatGrid, x: number, y: number) => {
  const cx = Math.min(grid.cols - 1, Math.max(0, x));
  const cy = Math.min(grid.rows - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(grid.cols - 1, x0 + 1);
  const y1 = Math.min(grid.rows - 1, y0 + 1);
  const tx = cx - x0;
  const ty = cy - y0;
  const v = grid.values;
  const a = v[y0 * grid.cols + x0];
  const b = v[y0 * grid.cols + x1];
  const c = v[y1 * grid.cols + x0];
  const d = v[y1 * grid.cols + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
};

/**
 * 渲染一帧热力到 canvas。
 * @param thresholds 等值线阈值（dB），同时画线与标注
 */
export const renderHeatField = (canvas: HTMLCanvasElement, grid: HeatGrid, thresholds: number[] = [30, 45, 60, 75]) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const lut = buildLut();
  const image = acquireImageData(canvas, ctx, w, h);
  const data = image.data;
  for (let py = 0; py < h; py++) {
    const gy = (py / h) * grid.rows;
    for (let px = 0; px < w; px++) {
      const gx = (px / w) * grid.cols;
      const value = sampleBilinear(grid, gx, gy);
      const ratio = Math.min(1, Math.max(0, (value - FIELD_MIN) / (FIELD_MAX - FIELD_MIN)));
      const color = lut[Math.round(ratio * (LUT_SIZE - 1))];
      const idx = (py * w + px) * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      // 冷端近乎透明（露出暗色底图），热端饱满
      data[idx + 3] = Math.round(28 + 200 * ratio ** 1.25);
    }
  }
  ctx.putImageData(image, 0, 0);

  // 等值线：白色细线 + dB 标注（画在最亮前沿附近的一圈，读图即知覆盖水平）
  const bands = contours().size([grid.cols, grid.rows]).thresholds(thresholds)(grid.values as unknown as number[]);
  ctx.lineWidth = 1;
  ctx.font = '600 10px ui-monospace, Menlo, monospace';
  bands.forEach((band) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    band.coordinates.flat().forEach((polygon) => {
      ctx.beginPath();
      polygon.forEach(([x, y], i) => {
        const px = (x / grid.cols) * w;
        const py = (y / grid.rows) * h;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();
      // 标注放在环的最上点
      const top = polygon.reduce((min, p) => (p[1] < min[1] ? p : min), polygon[0]);
      const tx = (top[0] / grid.cols) * w;
      const ty = (top[1] / grid.rows) * h;
      const label = `${band.value}`;
      const wLabel = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(4,10,18,0.78)';
      ctx.fillRect(tx - 2, ty - 11, wLabel + 4, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(label, tx, ty - 2);
    });
  });
};
