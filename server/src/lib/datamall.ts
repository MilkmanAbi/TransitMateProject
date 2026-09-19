// Ported from BusTech api/lta.js: DataMall needs a private AccountKey header and sends no CORS
// headers, so every call is made here and forwarded to the browser.
const LTA_BASE = 'https://datamall2.mytransport.sg/ltaodataservice/';

export class UpstreamError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function accountKey(): string {
  const key = process.env.DATAMALL_KEY || process.env.LTA_ACCOUNT_KEY;
  if (!key) throw new UpstreamError(500, 'DATAMALL_KEY is not set — copy .env.example to .env and add your key');
  return key;
}

// `$skip` must reach DataMall unencoded, so the query string is assembled by hand.
export function buildUrl(path: string, params: Record<string, string | number | undefined> = {}): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${LTA_BASE}${path}${qs ? '?' + qs : ''}`;
}

export async function ltaFetch<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    headers: { AccountKey: accountKey(), accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new UpstreamError(res.status, `DataMall ${path} responded ${res.status}`);
  return (await res.json()) as T;
}

export async function ltaFetchAll<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const out: T[] = [];
  const BATCH = 6;
  for (let page = 0; ; page += BATCH) {
    const pages = await Promise.all(
      Array.from({ length: BATCH }, (_, i) =>
        ltaFetch<{ value: T[] }>(path, { ...params, $skip: (page + i) * 500 }).then((r) => r.value ?? []),
      ),
    );
    for (const p of pages) out.push(...p);
    if (pages.some((p) => p.length < 500)) return out;
  }
}
