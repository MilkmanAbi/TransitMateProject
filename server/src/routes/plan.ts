import { Router } from 'express';
import { getTrainAlerts, plannedClosuresOn } from '../lib/alerts.js';
import { crowdRealtimeAll, type CrowdLevel } from '../lib/live.js';
import { loadNetwork, net } from '../lib/network.js';
import { buildConditions, plan, type Place, type ProfileId } from '../lib/planner.js';
import { nowcastAt } from '../lib/weather.js';
import { liftMaintenance } from './train.js';
import { badRequest, wrap } from './util.js';

export const planner = Router();

function parsePlace(v: unknown, label: string): Place {
  const [lat, lng, ...name] = String(v ?? '').split(',');
  const p = { lat: Number(lat), lng: Number(lng), name: name.join(',') || label };
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) throw badRequest(`${label} must be "lat,lng,name"`);
  return p;
}

planner.get('/', wrap(async (req) => {
  await loadNetwork();
  const from = parsePlace(req.query.from, 'Origin');
  const to = parsePlace(req.query.to, 'Destination');
  const departAt = Number(req.query.depart) || Date.now();
  const profile = String(req.query.profile ?? 'rachel') as ProfileId;
  const [alerts, crowd, wo, wd, lifts] = await Promise.all([
    getTrainAlerts(req.query.scenario as string | undefined),
    crowdRealtimeAll().catch(() => new Map<string, CrowdLevel>()),
    nowcastAt(from.lat, from.lng),
    nowcastAt(to.lat, to.lng),
    liftMaintenance().catch(() => []),
  ]);
  const liftOut = new Map<string, string[]>();
  for (const l of lifts) liftOut.set(l.StationCode, [...(liftOut.get(l.StationCode) ?? []), l.LiftDesc]);
  const planned = plannedClosuresOn(alerts.messages, departAt, (line) => net.stationList.filter((s) => s.line === line).map((s) => s.code));
  const disruptions = [...alerts.disruptions, ...planned];
  const conds = buildConditions(disruptions, liftOut);
  const result = await plan({ from, to, departAt, profile, conds, crowd, wet: { origin: wo, dest: wd } });
  return { ...result, simulated: alerts.simulated, scenarioLabel: alerts.scenarioLabel, disruptions };
}));
