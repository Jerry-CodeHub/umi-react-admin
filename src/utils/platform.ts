/**
 * 平台判定共享出口：⌘K / Ctrl+K 等随平台变化的文案统一走这里，
 * 避免各处内联同一份 navigator.platform 正则（已废弃 API）而彼此漂移。
 */
const platformOf = (): string => {
  if (typeof navigator === 'undefined') return '';
  const withUAD = navigator as Navigator & { userAgentData?: { platform?: string } };
  return withUAD.userAgentData?.platform ?? navigator.platform ?? '';
};

export const isMac = (): boolean => /Mac|iPhone|iPad/.test(platformOf());
