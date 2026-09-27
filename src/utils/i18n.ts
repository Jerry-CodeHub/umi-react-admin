import zhCN from '@/locales/zh-CN';
import { getIntl } from '@umijs/max';

/**
 * 组件外（请求层、错误边界等）取文案。locale 插件尚未就绪时回退到默认语言（zh-CN）的同名文案，
 * 不在代码里另写一份默认中文。
 */
export const t = (id: string, values?: Record<string, string | number>) => {
  try {
    return getIntl().formatMessage({ id, defaultMessage: (zhCN as Record<string, string>)[id] }, values);
  } catch {
    return (zhCN as Record<string, string>)[id] ?? id;
  }
};
