// DEVIATION: CLAUDE.md calls the NEA nowcast directly from the browser. api-open.data.gov.sg v2 does not
// reliably send CORS headers, so the Express server fetches it (5-min cache) and we read /api/weather.
import type { AreaForecast } from '@/types';
import { STATIC, staticNowcast } from './static';

const BASE = `${import.meta.env.VITE_API_BASE ?? ''}/api`;

export async function nowcast(lat: number, lng: number): Promise<AreaForecast | null> {
  if (STATIC) return staticNowcast(lat, lng);
  const r = await fetch(`${BASE}/weather?lat=${lat}&lng=${lng}`);
  if (!r.ok) throw new Error('Weather unavailable');
  return (await r.json()) as AreaForecast | null;
}
