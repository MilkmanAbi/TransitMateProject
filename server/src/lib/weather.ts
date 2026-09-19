import { cached } from './cache.js';
import { haversineKm } from './network.js';

interface NowcastResponse {
  data: {
    area_metadata: { name: string; label_location: { latitude: number; longitude: number } }[];
    items: { forecasts: { area: string; forecast: string }[]; valid_period?: { text?: string } }[];
  };
}

export interface AreaForecast {
  area: string;
  forecast: string;
  wet: boolean;
  heavy: boolean;
}

export const isWet = (f: string) => /rain|shower|thunder|drizzle/i.test(f);
export const isHeavy = (f: string) => /thunder|heavy/i.test(f);

export async function nowcastAt(lat: number, lng: number): Promise<AreaForecast | null> {
  try {
    const d = await cached('nea-2h', 5 * 60_000, async () => {
      const r = await fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast', { signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(`NEA ${r.status}`);
      return (await r.json()) as NowcastResponse;
    });
    let best: { name: string; d: number } | null = null;
    for (const a of d.data.area_metadata) {
      const dist = haversineKm(lat, lng, a.label_location.latitude, a.label_location.longitude);
      if (!best || dist < best.d) best = { name: a.name, d: dist };
    }
    if (!best) return null;
    const forecast = d.data.items[0]?.forecasts.find((f) => f.area === best!.name)?.forecast ?? 'Fair';
    return { area: best.name, forecast, wet: isWet(forecast), heavy: isHeavy(forecast) };
  } catch {
    return null;
  }
}
