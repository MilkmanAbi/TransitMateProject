// DEVIATION: CLAUDE.md puts journey computation in client/src/lib/journey.ts. The bus network
// (26k BusRoutes rows) is far too heavy for a phone, so routing lives on the server and the client
// only renders plans.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ltaFetchAll } from './datamall.js';
import mrtData from '../data/mrt.json' with { type: 'json' };

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.resolve(here, '../../.cache');
const DISK_TTL = 24 * 3600 * 1000;

export interface BusStop {
  BusStopCode: string;
  RoadName: string;
  Description: string;
  Latitude: number;
  Longitude: number;
}
interface BusRouteRow {
  ServiceNo: string;
  Operator: string;
  Direction: number;
  StopSequence: number;
  BusStopCode: string;
  Distance: number | null;
}
interface BusServiceRow {
  ServiceNo: string;
  Operator: string;
  Direction: number;
  Category: string;
  OriginCode: string;
  DestinationCode: string;
  AM_Peak_Freq: string;
  AM_Offpeak_Freq: string;
  PM_Peak_Freq: string;
  PM_Offpeak_Freq: string;
}
export interface RouteStop {
  code: string;
  km: number;
}
export interface BusRoute {
  key: string;
  service: string;
  direction: number;
  operator: string;
  stops: RouteStop[];
  destination: string;
  headway: { peak: number; offpeak: number };
}
export interface MrtStation {
  code: string;
  name: string;
  lat: number;
  lng: number;
  line: string;
}
export interface MrtEdge {
  a: string;
  b: string;
  line: string;
  km: number;
  min: number;
}

export const net = {
  ready: false,
  loading: null as Promise<void> | null,
  stops: new Map<string, BusStop>(),
  routes: new Map<string, BusRoute>(),
  stopRoutes: new Map<string, { key: string; idx: number }[]>(),
  grid: new Map<string, BusStop[]>(),
  stations: new Map<string, MrtStation>(),
  stationList: [] as MrtStation[],
  adj: new Map<string, { to: string; line: string; min: number; km: number }[]>(),
  interchange: new Map<string, string[]>(),
  stationStops: new Map<string, { code: string; m: number }[]>(),
};

async function diskCached<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const file = path.join(CACHE_DIR, `${name}.json`);
  try {
    const st = fs.statSync(file);
    if (Date.now() - st.mtimeMs < DISK_TTL) return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    /* no cache yet */
  }
  const data = await fn();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const CELL = 0.005;
const cellKey = (lat: number, lng: number) => `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`;

export function nearbyStops(lat: number, lng: number, radiusM: number, limit = 12): (BusStop & { m: number })[] {
  const r = Math.ceil(radiusM / 1000 / (CELL * 111)) ;
  const ci = Math.floor(lat / CELL);
  const cj = Math.floor(lng / CELL);
  const out: (BusStop & { m: number })[] = [];
  for (let i = ci - r; i <= ci + r; i++)
    for (let j = cj - r; j <= cj + r; j++)
      for (const s of net.grid.get(`${i}:${j}`) ?? []) {
        const m = haversineKm(lat, lng, s.Latitude, s.Longitude) * 1000;
        if (m <= radiusM) out.push({ ...s, m });
      }
  return out.sort((a, b) => a.m - b.m).slice(0, limit);
}

export function nearbyStations(lat: number, lng: number, radiusM: number, limit = 6): (MrtStation & { m: number })[] {
  return net.stationList
    .map((s) => ({ ...s, m: haversineKm(lat, lng, s.lat, s.lng) * 1000 }))
    .filter((s) => s.m <= radiusM)
    .sort((a, b) => a.m - b.m)
    .slice(0, limit);
}

// "09-12" → 10.5 minutes
function parseFreq(f: string | undefined): number | null {
  if (!f || f === '-') return null;
  const nums = f.split('-').map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildMrt() {
  for (const s of mrtData.stations as MrtStation[]) net.stations.set(s.code, s);
  net.stationList = [...net.stations.values()];
  for (const e of mrtData.edges as MrtEdge[]) {
    if (!net.stations.has(e.a) || !net.stations.has(e.b)) continue;
    const push = (from: string, to: string) => {
      const list = net.adj.get(from) ?? [];
      list.push({ to, line: e.line, min: e.min, km: e.km });
      net.adj.set(from, list);
    };
    push(e.a, e.b);
    push(e.b, e.a);
  }
  for (const group of mrtData.interchanges as string[][])
    for (const c of group) net.interchange.set(c, group.filter((x) => x !== c));
}

export async function loadNetwork(): Promise<void> {
  if (net.ready) return;
  if (net.loading) return net.loading;
  net.loading = (async () => {
    const t0 = Date.now();
    buildMrt();
    const [stops, routes, services] = await Promise.all([
      diskCached('bus-stops', () => ltaFetchAll<BusStop>('BusStops')),
      diskCached('bus-routes', () => ltaFetchAll<BusRouteRow>('BusRoutes')),
      diskCached('bus-services', () => ltaFetchAll<BusServiceRow>('BusServices')),
    ]);
    for (const s of stops) {
      if (!s.Latitude || !s.Longitude) continue;
      net.stops.set(s.BusStopCode, s);
      const k = cellKey(s.Latitude, s.Longitude);
      const cell = net.grid.get(k) ?? [];
      cell.push(s);
      net.grid.set(k, cell);
    }
    const svcMeta = new Map(services.map((s) => [`${s.ServiceNo}|${s.Direction}`, s]));
    const grouped = new Map<string, BusRouteRow[]>();
    for (const r of routes) {
      const key = `${r.ServiceNo}|${r.Direction}`;
      const g = grouped.get(key) ?? [];
      g.push(r);
      grouped.set(key, g);
    }
    for (const [key, rows] of grouped) {
      rows.sort((a, b) => a.StopSequence - b.StopSequence);
      const meta = svcMeta.get(key);
      const destCode = meta?.DestinationCode ?? rows[rows.length - 1].BusStopCode;
      const peak = parseFreq(meta?.AM_Peak_Freq) ?? parseFreq(meta?.PM_Peak_Freq) ?? 12;
      const off = parseFreq(meta?.AM_Offpeak_Freq) ?? parseFreq(meta?.PM_Offpeak_Freq) ?? peak + 3;
      const stopsSeq: RouteStop[] = [];
      let lastKm = 0;
      for (const r of rows) {
        if (!net.stops.has(r.BusStopCode)) continue;
        const km = typeof r.Distance === 'number' ? r.Distance : lastKm;
        lastKm = km;
        stopsSeq.push({ code: r.BusStopCode, km });
      }
      if (stopsSeq.length < 2) continue;
      net.routes.set(key, {
        key,
        service: rows[0].ServiceNo,
        direction: rows[0].Direction,
        operator: rows[0].Operator,
        stops: stopsSeq,
        destination: net.stops.get(destCode)?.Description ?? destCode,
        headway: { peak, offpeak: off },
      });
      stopsSeq.forEach((s, idx) => {
        const list = net.stopRoutes.get(s.code) ?? [];
        list.push({ key, idx });
        net.stopRoutes.set(s.code, list);
      });
    }
    for (const st of net.stationList) {
      net.stationStops.set(
        st.code,
        nearbyStops(st.lat, st.lng, 350, 10).map((s) => ({ code: s.BusStopCode, m: s.m })),
      );
    }
    net.ready = true;
    console.log(
      `[network] ${net.stops.size} bus stops · ${net.routes.size} bus route patterns · ${net.stationList.length} rail stations · ${Date.now() - t0}ms`,
    );
  })().catch((e) => {
    net.loading = null;
    throw e;
  });
  return net.loading;
}
