import type { Device } from '@/services/types';

/** 重点业务频段（MHz）。取常见民用业务的大致范围，仅作演示 */
export const KEY_BANDS: { key: string; range: [number, number] }[] = [
  { key: 'fm', range: [87.5, 108] },
  { key: 'aviation', range: [108, 137] },
  { key: 'gsm900', range: [880, 960] },
  { key: 'dcs1800', range: [1710, 1880] },
  { key: 'wlan24', range: [2400, 2483.5] },
  { key: 'nr35', range: [3300, 3600] },
  { key: 'wlan58', range: [5725, 5850] },
];

export type ModelCoverage = { model: string; band: [number, number]; total: number; online: number };

/** 按型号汇总：监测频段与设备数 */
export const coverageByModel = (devices: Device[]): ModelCoverage[] => {
  const map = new Map<string, ModelCoverage>();
  devices.forEach((device) => {
    const entry = map.get(device.model) ?? { model: device.model, band: device.band, total: 0, online: 0 };
    entry.total += 1;
    if (device.status === 'online') entry.online += 1;
    map.set(device.model, entry);
  });
  return [...map.values()].sort((a, b) => a.band[1] - b.band[1]);
};

/** 某个频段能被多少台在线设备完整监测到 */
export const devicesCovering = (devices: Device[], range: [number, number]) =>
  devices.filter((d) => d.status === 'online' && d.band[0] <= range[0] && d.band[1] >= range[1]);
