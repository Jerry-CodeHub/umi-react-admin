import { useIntl } from '@umijs/max';
import { useMemo } from 'react';

/**
 * 枚举 key → 显示名 / ProTable valueEnum。文案键约定为 `<前缀>.<key>`（见 src/locales/*\/enums.ts）。
 */
export const useEnums = () => {
  const intl = useIntl();
  return useMemo(() => {
    const label = (prefix: string, key: string) => intl.formatMessage({ id: `${prefix}.${key}` });
    const valueEnum = <K extends string>(
      prefix: string,
      keys: readonly K[],
      extra?: (key: K) => Record<string, unknown>,
    ) => Object.fromEntries(keys.map((key) => [key, { text: label(prefix, key), ...extra?.(key) }]));
    const options = <K extends string>(prefix: string, keys: readonly K[]) =>
      keys.map((key) => ({ value: key, label: label(prefix, key) }));
    return { label, valueEnum, options };
  }, [intl]);
};
