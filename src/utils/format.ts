import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const dayjsLocale = (locale: string) => (locale === 'en-US' ? 'en' : 'zh-cn');

/** 相对时间：「3 分钟前」/「3 minutes ago」 */
export const fromNow = (value: string | number | Date, locale: string) =>
  dayjs(value).locale(dayjsLocale(locale)).fromNow();

export const formatDateTime = (value: string | number | Date, pattern = 'YYYY-MM-DD HH:mm') =>
  dayjs(value).format(pattern);

export const formatNumber = (value: number, locale: string, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale, options).format(value);

/** 比例（0~1）格式化为百分比，默认一位小数 */
export const formatPercent = (ratio: number, locale: string, digits = 1) =>
  new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
