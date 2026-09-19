import type {
  BusETA,
  CrowdForecast,
  CrowdLevel,
  LiftOutage,
  Place,
  PlanResult,
  ProfileId,
  RawBusArrival,
  RawNextBus,
  StopArrivals,
  StopSummary,
  TaxiCount,
  TrainAlerts,
} from '@/types';

const BASE = `${import.meta.env.VITE_API_BASE ?? ''}/api`;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function get<T>(path: string, params: Record<string, string | number | undefined | null> = {}): Promise<T> {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, { cache: 'no-store' });
  } catch {
    throw new ApiError(0, navigator.onLine ? 'Server unreachable' : 'You are offline');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

// Ported from BusTech js/busApi.js normalise(): v3/BusArrival → per-service ETA list.
function mapBus(b: RawNextBus | undefined, now: number): BusETA | null {
  if (!b || !b.EstimatedArrival) return null;
  const at = Date.parse(b.EstimatedArrival);
  return {
    mins: Math.max(0, Math.round((at - now) / 60000)),
    at,
    load: b.Load,
    type: b.Type,
    wab: b.Feature === 'WAB',
    monitored: b.Monitored === 1,
  };
}

export function normaliseArrivals(raw: RawBusArrival): StopArrivals {
  const now = Date.now();
  const services = (raw.Services ?? [])
    .map((s) => ({
      service: s.ServiceNo,
      operator: s.Operator,
      destination: raw.destinations?.[s.ServiceNo] ?? null,
      buses: [mapBus(s.NextBus, now), mapBus(s.NextBus2, now), mapBus(s.NextBus3, now)].filter((b): b is BusETA => !!b),
    }))
    .filter((s) => s.buses.length)
    .sort((a, b) => a.buses[0].at - b.buses[0].at);
  return { stop: raw.stop, services, fetchedAt: raw.fetchedAt };
}

export const api = {
  arrivals: (stop: string) => get<RawBusArrival>('/bus/arrivals', { stop }).then(normaliseArrivals),
  searchStops: (q: string) => get<StopSummary[]>('/bus/stops/search', { q }),
  nearStops: (lat: number, lng: number, radius = 450) => get<StopSummary[]>('/bus/stops/near', { lat, lng, radius }),
  trainAlerts: (scenario?: string | null) => get<TrainAlerts>('/train/alerts', { scenario }),
  scenarios: () => get<{ id: string; label: string }[]>('/train/scenarios'),
  crowdForecast: (line: string, station?: string) => get<CrowdForecast>('/train/crowding', { line, station }),
  crowdNow: () => get<{ stations: Record<string, CrowdLevel> }>('/train/crowding/now'),
  lifts: () => get<LiftOutage[]>('/train/lifts'),
  taxi: (lat?: number, lng?: number, radius = 1) => get<TaxiCount>('/taxi', { lat, lng, radius }),
  geoSearch: (q: string) => get<Place[]>('/geo/search', { q }),
  plan: (from: Place, to: Place, opts: { departAt?: number; profile: ProfileId; scenario?: string | null }) =>
    get<PlanResult>('/plan', {
      from: `${from.lat},${from.lng},${from.name}`,
      to: `${to.lat},${to.lng},${to.name}`,
      depart: opts.departAt,
      profile: opts.profile,
      scenario: opts.scenario,
    }),
};
