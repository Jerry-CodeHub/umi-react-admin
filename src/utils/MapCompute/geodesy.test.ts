import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { circle, destination, distanceKm } from './geodesy';

type Envelope = { azimuth: number; distanceKm: number; longitude: number; latitude: number }[];
const envelopes = JSON.parse(
  readFileSync(new URL('../../../public/data/cesium/envelopes.json', import.meta.url), 'utf8'),
) as { origin: [number, number]; intercept: Envelope; location: Envelope; demodulation: Envelope };

describe('geodesy', () => {
  it('正北 / 正东方向的终点符合直觉', () => {
    const [lng, lat] = destination(116, 30, 0, 111.195);
    expect(lng).toBeCloseTo(116, 6);
    expect(lat).toBeCloseTo(31, 2);
    const [eastLng, eastLat] = destination(116, 30, 90, 100);
    expect(eastLng).toBeGreaterThan(116);
    expect(eastLat).toBeCloseTo(30, 1);
  });

  it('destination 与 distanceKm 互逆', () => {
    const end = destination(121.47, 31.23, 37, 250);
    expect(distanceKm([121.47, 31.23], end)).toBeCloseTo(250, 6);
  });

  it('按方位距离计算的包络与实测经纬度吻合（误差 < 3 km）', () => {
    for (const envelope of [envelopes.intercept, envelopes.location, envelopes.demodulation]) {
      const worst = Math.max(
        ...envelope.map((p) =>
          distanceKm(destination(...envelopes.origin, p.azimuth, p.distanceKm), [p.longitude, p.latitude]),
        ),
      );
      expect(worst).toBeLessThan(3);
    }
  });

  it('等距圆上的点到圆心距离相等', () => {
    expect(circle(104.07, 30.57, 100).every((p) => Math.abs(distanceKm([104.07, 30.57], p) - 100) < 1e-6)).toBe(true);
  });
});
