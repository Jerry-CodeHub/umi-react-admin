import { useCallback, useEffect, useState } from 'react';

/**
 * 拉取本地演示数据（public/data/charts），三态返回：loading / error / data。
 * 替代图表库内置的 data:{type:'fetch'}（不暴露错误回调，远程源挂了图表静默空白）。
 */
export const useChartData = <T>(url: string) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(url)
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        return resp.json();
      })
      .then((json: T) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, retry };
};
