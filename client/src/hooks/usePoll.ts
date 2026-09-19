import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/store/useStore';

// Polls while the tab is visible; refreshes immediately when the commuter comes back to the app.
export function usePoll<T>(fn: (() => Promise<T>) | null, intervalMs: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(!!fn);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const toast = useStore((s) => s.toast);

  const run = useCallback(async () => {
    if (!fnRef.current) return;
    setLoading(true);
    try {
      const d = await fnRef.current();
      setData(d);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e as Error);
      toast((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!fnRef.current) return;
    run();
    const t = setInterval(() => document.visibilityState === 'visible' && run(), intervalMs);
    const onVis = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [run, intervalMs]);

  return { data, error, loading, updatedAt, refresh: run };
}
