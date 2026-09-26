import { request, type RequestOptions } from '@umijs/max';
import type { ApiEnvelope } from './types';

/**
 * 统一的接口调用：返回信封里的 data。success:false 与 HTTP 错误由请求层（src/utils/requestConfig.ts）
 * 统一提示并以异常抛给调用方；需要自行处理错误的调用传 skipErrorHandler。
 */
export const api = async <T>(url: string, options: RequestOptions = { method: 'GET' }): Promise<T> => {
  const envelope = await request<ApiEnvelope<T>>(url, { ...options, getResponse: false as const });
  return envelope.data;
};

/** 去掉空字符串 / null / undefined 的查询参数（ProTable 表单清空后会带上空值） */
export const compact = <T extends object>(query: T) =>
  Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  );
