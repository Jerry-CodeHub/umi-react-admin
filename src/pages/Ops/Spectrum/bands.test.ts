import { generateDataset } from '@/demo/generate';
import { describe, expect, it } from 'vitest';
import { KEY_BANDS, coverageByModel, devicesCovering } from './bands';

const { devices } = generateDataset({ now: new Date(2026, 8, 23, 12) });

describe('频谱覆盖', () => {
  it('按型号汇总的设备数等于设备总数，频段上限递增', () => {
    const models = coverageByModel(devices);
    expect(models.reduce((sum, m) => sum + m.total, 0)).toBe(devices.length);
    expect(models.map((m) => m.band[1])).toEqual([...models.map((m) => m.band[1])].sort((a, b) => a - b));
  });

  it('只有覆盖到 5.8G 的型号能监测 WLAN 5.8G；FM 频段所有在线设备都能监测', () => {
    const wlan58 = KEY_BANDS.find((b) => b.key === 'wlan58')!.range;
    expect(devicesCovering(devices, wlan58).every((d) => d.band[1] >= 5850)).toBe(true);
    const fm = KEY_BANDS.find((b) => b.key === 'fm')!.range;
    expect(devicesCovering(devices, fm).length).toBe(devices.filter((d) => d.status === 'online').length);
  });
});
