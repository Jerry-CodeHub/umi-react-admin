/** 时长（毫秒）→ 「45 分钟 / 3.5 小时 / 2 天」，精度随量级变化 */
export const humanizeDuration = (ms: number, t: (id: string, values: Record<string, string | number>) => string) => {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  if (minutes < 60) return t('duration.minutes', { value: minutes });
  const hours = minutes / 60;
  if (hours < 48) return t('duration.hours', { value: hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours) });
  return t('duration.days', { value: Math.round(hours / 24) });
};
