import type { AreaForecast } from '@/types';

// data.gov.sg sends CORS headers, so the nowcast is fetched straight from the browser (as BusTech did).
const NOWCAST = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast';

interface Nowcast {
  data: {
    area_metadata: { name: string; label_location: { latitude: number; longitude: number } }[];
    items: { forecasts: { area: string; forecast: string }[] }[];
  };
}

let cache: { at: number; data: Nowcast } | null = null;

export async function nowcast(lat: number, lng: number): Promise<AreaForecast | null> {
  if (!cache || Date.now() - cache.at > 5 * 60_000) {
    const r = await fetch(NOWCAST);
    if (!r.ok) throw new Error('Weather unavailable');
    cache = { at: Date.now(), data: (await r.json()) as Nowcast };
  }
  const d = cache.data.data;
  let best: { name: string; dist: number } | null = null;
  for (const a of d.area_metadata) {
    const dist = (a.label_location.latitude - lat) ** 2 + (a.label_location.longitude - lng) ** 2;
    if (!best || dist < best.dist) best = { name: a.name, dist };
  }
  if (!best) return null;
  const forecast = d.items[0]?.forecasts.find((f) => f.area === best!.name)?.forecast ?? 'Fair';
  return { area: best.name, forecast, wet: /rain|shower|thunder|drizzle/i.test(forecast), heavy: /thunder|heavy/i.test(forecast) };
}
