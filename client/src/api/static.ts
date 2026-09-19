// Static-demo adapter for GitHub Pages (VITE_STATIC=1): answers /api calls from a recorded snapshot
// (scripts/snapshot.mjs). There is no server on Pages, so nothing here is live — the UI says so on every
// screen. Times are replayed relative to "now" so the demo journey reads coherently.
import type { AreaForecast } from '@/types';

export const STATIC = import.meta.env.VITE_STATIC === '1';
const ROOT = `${import.meta.env.BASE_URL}snapshot/`;
const files = new Map<string, Promise<unknown>>();

function load<T>(f: string): Promise<T> {
  if (!files.has(f))
    files.set(
      f,
      fetch(ROOT + f).then((r) => {
        if (!r.ok) throw new Error('Not in the static snapshot');
        return r.json();
      }),
    );
  return files.get(f) as Promise<T>;
}

interface Manifest {
  capturedAt: number;
  plans: { key: string }[];
  arrivals: string[];
}
export const snapshotManifest = () => load<Manifest>('manifest.json');

const planKey = (f: { lat: number; lng: number }, t: { lat: number; lng: number }, profile: string, scenario: string | null, at: boolean) =>
  `${f.lat.toFixed(4)}_${f.lng.toFixed(4)}__${t.lat.toFixed(4)}_${t.lng.toFixed(4)}__${profile}__${scenario ?? 'live'}__${at ? 'at' : 'now'}`.replace(/[^a-z0-9_]/gi, '');

const hav = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLng - aLng) * r) / 2) ** 2;
  return 12_742_000 * Math.asin(Math.sqrt(h));
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const ABBR: Record<string, string> = { place: 'pl', station: 'stn', mrt: 'stn', street: 'st', avenue: 'ave', road: 'rd', interchange: 'int', opposite: 'opp', central: 'ctrl', centre: 'ctr', tower: 'twr', upper: 'upp', bukit: 'bt' };
type StopRow = [string, string, string, number, number, string[]];
const stopObj = (s: StopRow, m?: number) => ({ code: s[0], name: s[1], road: s[2], lat: s[3], lng: s[4], services: s[5], ...(m !== undefined ? { m: Math.round(m) } : {}) });
const sgDate = (ms: number) => Math.floor((ms + 8 * 3600_000) / 86_400_000);

type Params = Record<string, string | number | undefined | null>;
type AnyObj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function staticGet(path: string, p: Params): Promise<unknown> {
  const m = await snapshotManifest();
  const shift = Date.now() - m.capturedAt;
  const shiftIso = (iso?: string) => (iso ? new Date(Date.parse(iso) + shift).toISOString() : iso);

  switch (path) {
    case '/bus/arrivals': {
      const code = String(p.stop);
      if (!m.arrivals.includes(code)) throw new Error('Static demo: this stop’s arrivals aren’t in the snapshot — run locally for live data');
      const raw = await load<AnyObj>(`arrivals/${code}.json`);
      const sb = (b: AnyObj) => (b?.EstimatedArrival ? { ...b, EstimatedArrival: shiftIso(b.EstimatedArrival) } : b);
      return { ...raw, Services: raw.Services.map((s: AnyObj) => ({ ...s, NextBus: sb(s.NextBus), NextBus2: sb(s.NextBus2), NextBus3: sb(s.NextBus3) })), fetchedAt: raw.fetchedAt + shift };
    }
    case '/bus/stops/search': {
      const q = norm(String(p.q ?? ''));
      if (q.length < 2) return [];
      const toks = q.split(' ').map((t) => ABBR[t] ?? t);
      const stops = await load<StopRow[]>('stops.json');
      return stops
        .filter((s) => s[0] === q || toks.every((t) => norm(`${s[1]} ${s[2]} ${s[0]}`).includes(t)))
        .slice(0, 5)
        .map((s) => stopObj(s));
    }
    case '/bus/stops/near': {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      const radius = Number(p.radius ?? 400);
      const stops = await load<StopRow[]>('stops.json');
      return stops
        .map((s) => [s, hav(lat, lng, s[3], s[4])] as const)
        .filter(([, d]) => d <= radius)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 25)
        .map(([s, d]) => stopObj(s, d));
    }
    case '/train/alerts': {
      const all = await load<Record<string, AnyObj>>('alerts.json');
      const a = all[String(p.scenario || 'live')] ?? all.live;
      return { ...a, fetchedAt: Date.now() };
    }
    case '/train/scenarios':
      return load('scenarios.json');
    case '/train/crowding/now':
      return load('crowd-now.json');
    case '/train/crowding': {
      const all = await load<Record<string, Record<string, { start: number; level: string }[]>>>('crowd-forecast.json');
      const line = String(p.line).toUpperCase();
      const days = (sgDate(Date.now()) - sgDate(m.capturedAt)) * 86_400_000;
      const entries = Object.entries(all[line] ?? {}).filter(([s]) => !p.station || s === String(p.station).toUpperCase());
      return { line, stations: Object.fromEntries(entries.map(([s, slots]) => [s, slots.map((x) => ({ ...x, start: x.start + days }))])) };
    }
    case '/train/lifts':
      return load('lifts.json');
    case '/taxi': {
      const t = await load<{ total: AnyObj; near: Record<string, AnyObj> }>('taxi.json');
      const k = p.lat ? `${Number(p.lat).toFixed(3)},${Number(p.lng).toFixed(3)}` : '';
      return { ...(t.near[k] ?? t.total), fetchedAt: Date.now() };
    }
    case '/geo/search': {
      const q = norm(String(p.q ?? ''));
      if (q.length < 2) return [];
      const net = await fetch(`${import.meta.env.BASE_URL}mrt.json`).then((r) => r.json() as Promise<{ stations: { code: string; name: string; lat: number; lng: number; line: string }[] }>);
      const lrt = ['BPL', 'SKLRT', 'PGLRT'];
      const stations = net.stations
        .filter((s) => norm(s.name).includes(q) && !['STC', 'PTC'].includes(s.code))
        .filter((s, i, arr) => arr.findIndex((x) => x.name === s.name) === i)
        .slice(0, 4)
        .map((s) => ({ name: `${s.name} ${lrt.includes(s.line) ? 'LRT' : 'MRT'}`, address: `${s.code} · ${s.line}`, lat: s.lat, lng: s.lng, kind: 'station' }));
      const stops = ((await staticGet('/bus/stops/search', { q })) as { name: string; road: string; code: string; lat: number; lng: number }[]).map((s) => ({
        name: s.name, address: `${s.road} · stop ${s.code}`, lat: s.lat, lng: s.lng, kind: 'place',
      }));
      return [...stations, ...stops].slice(0, 7);
    }
    case '/plan': {
      const parse = (v: unknown) => {
        const [lat, lng] = String(v ?? '').split(',').map(Number);
        return { lat, lng };
      };
      const key = planKey(parse(p.from), parse(p.to), String(p.profile ?? 'rachel'), p.scenario ? String(p.scenario) : null, !!p.depart);
      if (!m.plans.some((x) => x.key === key))
        throw new Error('Static demo: only the recorded demo journeys are available here — run TransitMate locally (README) to plan any trip');
      const plan = await load<AnyObj>(`plans/${key}.json`);
      if (p.depart) return { ...plan, generatedAt: plan.generatedAt + shift };
      const legShift = (o: AnyObj) => o && { ...o, legs: o.legs.map((l: AnyObj) => (l.live ? { ...l, live: { ...l.live, eta: shiftIso(l.live.eta) } } : l)) };
      return {
        ...plan,
        generatedAt: plan.generatedAt + shift,
        departAt: plan.departAt + shift,
        options: plan.options.map(legShift),
        usual: legShift(plan.usual),
        usualLive: legShift(plan.usualLive),
      };
    }
  }
  throw new Error(`Static demo: ${path} is not available without the server`);
}

export async function staticNowcast(lat: number, lng: number): Promise<AreaForecast | null> {
  const d = (await load<AnyObj>('weather.json')).data;
  let best: { name: string; dist: number } | null = null;
  for (const a of d.area_metadata) {
    const dist = hav(lat, lng, a.label_location.latitude, a.label_location.longitude);
    if (!best || dist < best.dist) best = { name: a.name, dist };
  }
  if (!best) return null;
  const forecast = d.items[0]?.forecasts.find((f: AnyObj) => f.area === best!.name)?.forecast ?? 'Fair';
  return { area: best.name, forecast, wet: /rain|shower|thunder|drizzle/i.test(forecast), heavy: /thunder|heavy/i.test(forecast) };
}
