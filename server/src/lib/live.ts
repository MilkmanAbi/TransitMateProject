import { cached } from './cache.js';
import { ltaFetch } from './datamall.js';
import { pcdKeyForStation } from './lines.js';

export type CrowdLevel = 'l' | 'm' | 'h' | 'NA';
export const PCD_LINES = ['NSL', 'EWL', 'CGL', 'CCL', 'CEL', 'NEL', 'DTL', 'TEL', 'BPL', 'SLRT', 'PLRT'];

interface PcdRealtimeRow {
  Station: string;
  StartTime: string;
  EndTime: string;
  CrowdLevel: string;
}
interface PcdForecastRow {
  Date: string;
  Stations: { Station: string; Interval: { Start: string; CrowdLevel: string }[] }[];
}

const level = (v: string): CrowdLevel => (v === 'l' || v === 'm' || v === 'h' ? v : 'NA');

export function crowdRealtime(line: string) {
  return cached(`pcd-rt:${line}`, 5 * 60_000, async () => {
    const r = await ltaFetch<{ value: PcdRealtimeRow[] }>('PCDRealTime', { TrainLine: line });
    return r.value.map((x) => ({ station: x.Station, level: level(x.CrowdLevel), start: x.StartTime, end: x.EndTime }));
  });
}

export function crowdForecast(line: string) {
  return cached(`pcd-fc:${line}`, 30 * 60_000, async () => {
    const r = await ltaFetch<{ value: PcdForecastRow[] }>('PCDForecast', { TrainLine: line });
    const out = new Map<string, { start: number; level: CrowdLevel }[]>();
    for (const day of r.value)
      for (const s of day.Stations) {
        const list = out.get(s.Station) ?? [];
        for (const i of s.Interval) list.push({ start: Date.parse(i.Start), level: level(i.CrowdLevel) });
        out.set(s.Station, list);
      }
    return out;
  });
}

export async function crowdRealtimeAll(): Promise<Map<string, CrowdLevel>> {
  const res = await Promise.allSettled(PCD_LINES.map(crowdRealtime));
  const out = new Map<string, CrowdLevel>();
  for (const r of res) if (r.status === 'fulfilled') for (const x of r.value) out.set(x.station, x.level);
  return out;
}

// Forecast for departures more than 20 min out (the proactive case); real-time otherwise.
export async function crowdAt(stationCode: string, when: number, realtime: Map<string, CrowdLevel>): Promise<{ level: CrowdLevel; source: 'realtime' | 'forecast' }> {
  const key = pcdKeyForStation(stationCode);
  if (!key) return { level: 'NA', source: 'realtime' };
  if (when - Date.now() > 20 * 60_000) {
    try {
      const fc = await crowdForecast(key.line);
      const slots = fc.get(key.station) ?? [];
      const slot = slots.filter((s) => s.start <= when).sort((a, b) => b.start - a.start)[0];
      if (slot) return { level: slot.level, source: 'forecast' };
    } catch {
      /* fall through to real-time */
    }
  }
  return { level: realtime.get(key.station) ?? 'NA', source: 'realtime' };
}

export interface RawNextBus {
  OriginCode: string;
  DestinationCode: string;
  EstimatedArrival: string;
  Monitored: number;
  Latitude: string;
  Longitude: string;
  VisitNumber: string;
  Load: string;
  Feature: string;
  Type: string;
}
export interface RawBusArrival {
  BusStopCode: string;
  Services: { ServiceNo: string; Operator: string; NextBus: RawNextBus; NextBus2: RawNextBus; NextBus3: RawNextBus }[];
}

export const busArrivals = (stop: string) =>
  cached(`arr:${stop}`, 20_000, () => ltaFetch<RawBusArrival>('v3/BusArrival', { BusStopCode: stop }));
