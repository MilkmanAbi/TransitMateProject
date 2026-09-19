const store = new Map<string, { data: unknown; expires: number }>();
const inflight = new Map<string, Promise<unknown>>();

// Stale entries are kept (not deleted) so an upstream outage can fall back to the last good copy.
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() <= hit.expires) return hit.data as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = fn()
    .then((data) => {
      store.set(key, { data, expires: Date.now() + ttlMs });
      return data;
    })
    .catch((err) => {
      if (hit) return hit.data as T;
      throw err;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
