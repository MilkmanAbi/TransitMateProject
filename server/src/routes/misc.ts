import { Router } from 'express';
import { cached } from '../lib/cache.js';
import { ltaFetch } from '../lib/datamall.js';
import { haversineKm, net } from '../lib/network.js';
import { nowcastAt } from '../lib/weather.js';
import { wrap } from './util.js';

export const misc = Router();

// Returns a count, not 3,000 coordinates — the phone only needs "N taxis nearby".
misc.get('/taxi', wrap(async (req) => {
  const all = await cached('Taxi-Availability', 30_000, async () => {
    const rows: { Latitude: number; Longitude: number }[] = [];
    for (let skip = 0; skip < 10000; skip += 500) {
      const r = await ltaFetch<{ value: { Latitude: number; Longitude: number }[] }>('Taxi-Availability', { $skip: skip });
      rows.push(...r.value);
      if (r.value.length < 500) break;
    }
    return rows;
  });
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radius ?? 1) || 1;
  const near = Number.isFinite(lat) && Number.isFinite(lng)
    ? all.filter((t) => haversineKm(lat, lng, t.Latitude, t.Longitude) <= radius).length
    : null;
  return { total: all.length, near, radiusKm: radius, fetchedAt: Date.now() };
}));

misc.get('/weather', wrap(async (req) => nowcastAt(Number(req.query.lat), Number(req.query.lng))));

interface OneMapResult {
  SEARCHVAL: string;
  ADDRESS: string;
  LATITUDE: string;
  LONGITUDE: string;
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Mrt|Lrt)\b/g, (m) => m.toUpperCase());

misc.get('/geo/search', wrap(async (req) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return [];
  const nq = norm(q);
  const stations = net.stationList
    .filter((s) => norm(s.name).includes(nq) || s.code.toLowerCase() === nq)
    .slice(0, 3)
    .map((s) => ({ name: `${s.name} ${['BPL', 'SKLRT', 'PGLRT'].includes(s.line) ? 'LRT' : 'MRT'}`, address: `${s.code} · ${s.line}`, lat: s.lat, lng: s.lng, kind: 'station' as const }));
  let places: { name: string; address: string; lat: number; lng: number; kind: 'place' }[] = [];
  try {
    places = await cached(`onemap:${nq}`, 3600_000, async () => {
      const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(q)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
      const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const j = (await r.json()) as { results?: OneMapResult[] };
      return (j.results ?? []).slice(0, 6).map((x) => ({
        name: titleCase(x.SEARCHVAL),
        address: titleCase(x.ADDRESS),
        lat: Number(x.LATITUDE),
        lng: Number(x.LONGITUDE),
        kind: 'place' as const,
      }));
    });
  } catch {
    /* OneMap unreachable: stations still work */
  }
  const seen = new Set<string>();
  return [...stations, ...places]
    .filter((x) => Number.isFinite(x.lat) && !seen.has(norm(x.name)) && seen.add(norm(x.name)))
    .slice(0, 7);
}));
