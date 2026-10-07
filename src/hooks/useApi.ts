import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 拉取一次接口数据的三态 hook：loading / error / data，附带 reload。
 * 组件卸载或依赖变化后到达的旧响应会被丢弃。错误提示已由请求层统一弹出，这里只保留错误态用于占位渲染。
 */
export const useApi = <T>(fetcher: () => Promise<T>, deps: unknown[] = []) => {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    fetcherRef
      .current()
      .then((result) => !cancelled && setData(result))
      .catch((e: unknown) => !cancelled && setError(e ?? new Error('request failed')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
};
