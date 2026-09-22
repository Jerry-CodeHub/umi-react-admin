/**
 * 业务错误：后端返回体 success:false 时由 errorThrower 抛出，
 * 与 HTTP 状态码错误（AxiosError）构成双线分流，调用方可通过 instanceof BizError 精确捕获。
 */
export class BizError extends Error {
  readonly errorCode?: number | string;

  constructor(payload: Record<string, unknown>) {
    const message = typeof payload.message === 'string' && payload.message ? payload.message : '业务处理失败';
    super(message);
    this.name = 'BizError';
    this.errorCode = payload.errorCode as number | string | undefined;
  }
}
