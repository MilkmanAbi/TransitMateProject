import { Router } from 'express';
import { cached } from '../lib/cache.js';
import { ltaFetch } from '../lib/datamall.js';
import { busArrivals } from '../lib/live.js';
import { nearbyStops, net } from '../lib/network.js';
import { badRequest, wrap } from './util.js';

export const bus = Router();

bus.get('/arrivals', wrap(async (req) => {
  const stop = String(req.query.stop ?? '').trim();
  if (!/^\d{5}$/.test(stop)) throw badRequest('stop must be a 5-digit BusStopCode');
  const raw = await busArrivals(stop);
  const s = net.stops.get(stop);
  return {
    ...raw,
    stop: s ? { code: stop, name: s.Description, road: s.RoadName, lat: s.Latitude, lng: s.Longitude } : { code: stop },
    destinations: Object.fromEntries(
      (raw.Services ?? []).map((x) => [x.ServiceNo, net.stops.get(x.NextBus?.DestinationCode)?.Description ?? null]),
    ),
    fetchedAt: Date.now(),
  };
}));

bus.get('/stops', wrap(async (req) => {
  const skip = Number(req.query.skip ?? 0) || 0;
  return cached(`BusStops:${skip}`, 3600_000, () => ltaFetch('BusStops', { $skip: skip }));
}));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
bus.get('/stops/search', wrap(async (req) => {
  const q = norm(String(req.query.q ?? ''));
  if (q.length < 2) return [];
  const toks = q.split(' ');
  const out: { code: string; name: string; road: string; lat: number; lng: number; score: number }[] = [];
  for (const s of net.stops.values()) {
    const hay = norm(`${s.Description} ${s.RoadName} ${s.BusStopCode}`);
    let score = 0;
    if (s.BusStopCode === q) score = 100;
    else if (toks.every((t) => hay.includes(t))) score = 10 + (norm(s.Description).startsWith(toks[0]) ? 5 : 0) - hay.length / 100;
    if (score > 0) out.push({ code: s.BusStopCode, name: s.Description, road: s.RoadName, lat: s.Latitude, lng: s.Longitude, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}));

bus.get('/stops/near', wrap(async (req) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Math.min(Number(req.query.radius ?? 400) || 400, 1500);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw badRequest('lat/lng required');
  return nearbyStops(lat, lng, radius, 25).map((s) => ({
    code: s.BusStopCode,
    name: s.Description,
    road: s.RoadName,
    lat: s.Latitude,
    lng: s.Longitude,
    m: Math.round(s.m),
    services: [...new Set((net.stopRoutes.get(s.BusStopCode) ?? []).map((r) => net.routes.get(r.key)!.service))].sort(
      (a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b),
    ),
  }));
}));

bus.get('/services', wrap(async () => cached('BusServices', 3600_000, () => ltaFetch('BusServices'))));

bus.get('/routes', wrap(async (req) => {
  const key = `${req.query.service}|${req.query.dir ?? 1}`;
  const r = net.routes.get(key);
  if (!r) throw badRequest(`No route for ${key}`, 404);
  return {
    ...r,
    stops: r.stops.map((s) => {
      const st = net.stops.get(s.code);
      return { ...s, name: st?.Description, lat: st?.Latitude, lng: st?.Longitude };
    }),
  };
}));
