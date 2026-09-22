import { describe, expect, it } from 'vitest';
import { centerGeoHash, geohashBounds } from './geoHash';

const LAT = 39.9042;
const LON = 116.4074;

describe('geoHash', () => {
  it('空 hash 边界返回 null', () => {
    expect(geohashBounds('')).toBeNull();
  });

  it('已知值：与标准 geohash 算法（独立参考实现核对）一致', () => {
    expect(centerGeoHash(LAT, LON, 8)).toBe('wx4g0bm6');
    expect(centerGeoHash(LAT, LON, 12)).toBe('wx4g0bm6c408');
  });

  it('latitude / longitude 为格子中心', () => {
    const bounds = geohashBounds('wx4g0bm6')!;
    expect(bounds.latitude).toBeCloseTo((bounds.latitudeMin + bounds.latitudeMax) / 2, 10);
    expect(bounds.longitude).toBeCloseTo((bounds.longitudeMin + bounds.longitudeMax) / 2, 10);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])('精度 %d：编码长度正确且边界包含原坐标', (precision) => {
    const hash = centerGeoHash(LAT, LON, precision);
    expect(hash).toHaveLength(precision);

    const bounds = geohashBounds(hash);
    expect(bounds).not.toBeNull();
    expect(LAT).toBeGreaterThanOrEqual(bounds!.latitudeMin);
    expect(LAT).toBeLessThanOrEqual(bounds!.latitudeMax);
    expect(LON).toBeGreaterThanOrEqual(bounds!.longitudeMin);
    expect(LON).toBeLessThanOrEqual(bounds!.longitudeMax);
  });

  it('精度递增时格子单调收缩（不放大）', () => {
    let previousArea = Number.POSITIVE_INFINITY;
    for (let precision = 1; precision <= 8; precision++) {
      const bounds = geohashBounds(centerGeoHash(LAT, LON, precision))!;
      const area = (bounds.latitudeMax - bounds.latitudeMin) * (bounds.longitudeMax - bounds.longitudeMin);
      expect(area).toBeLessThanOrEqual(previousArea);
      previousArea = area;
    }
  });
});
