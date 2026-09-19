import { Router } from 'express';
import { cached } from '../lib/cache.js';
import { ltaFetch } from '../lib/datamall.js';
import { getTrainAlerts, SCENARIOS } from '../lib/alerts.js';
import { crowdForecast, crowdRealtime, crowdRealtimeAll, PCD_LINES } from '../lib/live.js';
import { badRequest, wrap } from './util.js';

export const train = Router();

train.get('/alerts', wrap((req) => getTrainAlerts(req.query.scenario as string | undefined)));
train.get('/scenarios', wrap(async () => SCENARIOS.map(({ id, label }) => ({ id, label }))));

train.get('/crowding', wrap(async (req) => {
  const line = String(req.query.line ?? '').toUpperCase();
  if (!PCD_LINES.includes(line)) throw badRequest(`line must be one of ${PCD_LINES.join(', ')}`);
  const fc = await crowdForecast(line);
  const station = req.query.station ? String(req.query.station).toUpperCase() : null;
  return { line, stations: Object.fromEntries([...fc.entries()].filter(([s]) => !station || s === station)) };
}));

train.get('/crowding/now', wrap(async (req) => {
  const line = req.query.line ? String(req.query.line).toUpperCase() : null;
  if (line) return { line, stations: await crowdRealtime(line) };
  return { stations: Object.fromEntries(await crowdRealtimeAll()) };
}));

interface LiftRow {
  Line: string;
  StationCode: string;
  StationName: string;
  LiftID: string;
  LiftDesc: string;
}
export const liftMaintenance = () =>
  cached('FacilitiesMaintenance', 10 * 60_000, () => ltaFetch<{ value: LiftRow[] }>('v2/FacilitiesMaintenance').then((r) => r.value));
train.get('/lifts', wrap(liftMaintenance));
