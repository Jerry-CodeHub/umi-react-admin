import type { PageQuery, PageResult } from '@/services/types';

export type DemoRequest = {
  method: string;
  /** 不含 baseURL 的路径，可带 query string */
  url: string;
  params?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string | undefined>;
};

export type DemoResponse = {
  status: number;
  body: { success: boolean; data: unknown; errorCode: number; message?: string };
};

/** HTTP 层错误（401/403/404/400）：走请求层 errorHandler 的状态码分支 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 业务错误：HTTP 200 + success:false，走请求层 errorThrower → BizError 分支 */
export class BizFailure extends Error {
  constructor(
    message: string,
    readonly errorCode = 1000,
  ) {
    super(message);
  }
}

export const ok = (data: unknown): DemoResponse => ({ status: 200, body: { success: true, data, errorCode: 0 } });

const toNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** 通用排序 + 分页（ProTable 传 current / pageSize，排序字段见 PageQuery） */
export const paginate = <T>(list: T[], query: PageQuery & Record<string, unknown>): PageResult<T> => {
  const current = toNumber(query.current, 1);
  const pageSize = Math.min(toNumber(query.pageSize, 20), 200);
  let rows = list;
  const { sortField, sortOrder } = query;
  if (typeof sortField === 'string' && sortField && (sortOrder === 'ascend' || sortOrder === 'descend')) {
    const direction = sortOrder === 'ascend' ? 1 : -1;
    rows = [...list].sort((a, b) => {
      const x = (a as Record<string, unknown>)[sortField];
      const y = (b as Record<string, unknown>)[sortField];
      if (x === y) return 0;
      if (x === undefined || x === null) return 1;
      if (y === undefined || y === null) return -1;
      return (x > y ? 1 : -1) * direction;
    });
  }
  const start = (current - 1) * pageSize;
  return { list: rows.slice(start, start + pageSize), total: rows.length, current, pageSize };
};

/** 关键字匹配（忽略大小写） */
export const matches = (keyword: unknown, ...fields: (string | undefined)[]) => {
  if (typeof keyword !== 'string' || !keyword.trim()) return true;
  const needle = keyword.trim().toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(needle));
};

/** 时间区间过滤（from / to 为 ISO 或可被 Date 解析的字符串） */
export const inRange = (value: string, from: unknown, to: unknown) => {
  const time = new Date(value).getTime();
  if (typeof from === 'string' && from && time < new Date(from).getTime()) return false;
  if (typeof to === 'string' && to && time > new Date(to).getTime()) return false;
  return true;
};
