import { useState, useEffect, useRef, useCallback } from 'react';

export function usePolling(fetchFn, intervalMs = 3000, shouldPoll = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  const doFetch = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    doFetch();

    if (shouldPoll) {
      timerRef.current = setInterval(doFetch, intervalMs);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [doFetch, intervalMs, shouldPoll]);

  return { data, error, loading, refetch: doFetch };
}
