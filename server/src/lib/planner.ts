import { cached } from './cache.js';
import type { Disruption } from './alerts.js';
import { lineById } from './lines.js';
import { busArrivals, crowdAt, type CrowdLevel } from './live.js';
import { haversineKm, nearbyStations, nearbyStops, net } from './network.js';
import type { AreaForecast } from './weather.js';

export type LatLng = [number, number];
export interface Place {
  name: string;
  lat: number;
  lng: number;
}
export type ProfileId = 'rachel' | 'arjun' | 'lim';
interface Profile {
  id: ProfileId;
  walkSpeed: number;
  walkWeight: number;
  transferPenalty: number;
  crowdPenalty: number;
  maxWalkM: number;
  busWalkM: number;
  spreadWeight: number;
  liftPenalty: number;
}
// Persona weights. Rachel values reliability (spread), Arjun avoids crowds, Mdm Lim avoids walking,
// transfers and stations with a lift out of service.
export const PROFILES: Record<ProfileId, Profile> = {
  rachel: { id: 'rachel', walkSpeed: 80, walkWeight: 1.2, transferPenalty: 3, crowdPenalty: 1.5, maxWalkM: 1100, busWalkM: 500, spreadWeight: 0.5, liftPenalty: 0 },
  arjun: { id: 'arjun', walkSpeed: 80, walkWeight: 1.0, transferPenalty: 4, crowdPenalty: 8, maxWalkM: 1300, busWalkM: 550, spreadWeight: 0.25, liftPenalty: 0 },
  lim: { id: 'lim', walkSpeed: 55, walkWeight: 2.5, transferPenalty: 10, crowdPenalty: 5, maxWalkM: 650, busWalkM: 350, spreadWeight: 0.4, liftPenalty: 25 },
};

export interface LegEnd {
  name: string;
  lat: number;
  lng: number;
  code?: string;
}
export interface Leg {
  mode: 'walk' | 'mrt' | 'bus' | 'shuttle';
  from: LegEnd;
  to: LegEnd;
  minutes: number;
  min: number;
  max: number;
  waitMin: number;
  km: number;
  line?: string;
  lineName?: string;
  color?: string;
  service?: string;
  alsoServices?: string[];
  headsign?: string;
  stops?: number;
  stations?: string[];
  path: LatLng[];
  affectedPaths?: LatLng[][];
  live?: { eta: string; load: string; wab: boolean; type: string; monitored: boolean } | null;
  crowd?: { level: CrowdLevel; source: 'realtime' | 'forecast' };
  free?: boolean;
  delayMin?: number;
  blocked?: boolean;
  liftOut?: string[];
  note?: string;
}
export interface Option {
  id: string;
  kind: 'rail' | 'bus' | 'bus+rail' | 'rail+bus' | 'walk';
  summary: string;
  legs: Leg[];
  minutes: number;
  min: number;
  max: number;
  walkMin: number;
  transfers: number;
  fare: number;
  cost: number;
  tags: string[];
  feasible: boolean;
  signature: string;
}

interface Acc {
  code: string;
  m: number;
}
type Spec =
  | { t: 'walk' }
  | { t: 'rail'; acc: Acc; path: string[]; egr: Acc }
  | { t: 'bus'; a: Acc; key: string; i: number; j: number; e: Acc }
  | { t: 'bus+rail'; a: Acc; key: string; i: number; j: number; xferM: number; path: string[]; egr: Acc }
  | { t: 'rail+bus'; acc: Acc; path: string[]; xferM: number; key: string; i: number; j: number; e: Acc };

export interface Conditions {
  blocked: Set<string>;
  delay: Map<string, number>;
  shuttle: Map<string, number>;
  affected: Set<string>;
  freeBus: Set<string>;
  freeBusIslandWide: boolean;
  liftOut: Map<string, string[]>;
  disruptions: Disruption[];
}
interface Ctx {
  from: Place;
  to: Place;
  departAt: number;
  profile: Profile;
  peak: boolean;
  conds: Conditions;
  crowd: Map<string, CrowdLevel>;
  wet: { origin: AreaForecast | null; dest: AreaForecast | null };
  accStations: Map<string, number>;
  egrStations: Map<string, number>;
}

const ek = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const LRT = new Set(['BPL', 'SKLRT', 'PGLRT']);
const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildConditions(disruptions: Disruption[], liftOut: Map<string, string[]> = new Map()): Conditions {
  const c: Conditions = {
    blocked: new Set(), delay: new Map(), shuttle: new Map(), affected: new Set(), freeBus: new Set(),
    freeBusIslandWide: false, liftOut, disruptions,
  };
  for (const d of disruptions) {
    const set = new Set(d.stations);
    d.stations.forEach((s) => c.affected.add(s));
    d.freeBusStations.forEach((s) => c.freeBus.add(s));
    if (d.freeBusIslandWide) c.freeBusIslandWide = true;
    const edges: { key: string; min: number }[] = [];
    for (const s of d.stations)
      for (const e of net.adj.get(s) ?? []) if (set.has(e.to) && s < e.to) edges.push({ key: ek(s, e.to), min: e.min });
    if (d.status === 2) {
      for (const e of edges) {
        c.blocked.add(e.key);
        if (d.shuttleStations.length) c.shuttle.set(e.key, e.min * 2.4 + 1.5);
      }
    } else {
      const total = d.delayMin ?? 10;
      for (const e of edges) c.delay.set(e.key, total / Math.max(1, edges.length));
    }
  }
  return c;
}

function isPeak(t: number) {
  const d = new Date(t + 8 * 3600_000);
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  const wd = d.getUTCDay() !== 0 && d.getUTCDay() !== 6;
  return wd && ((h >= 7 && h < 9.5) || (h >= 17 && h < 20));
}
const headway = (line: string, peak: boolean) => (LRT.has(line) ? (peak ? 3.5 : 6) : peak ? 2.5 : 5);
const walkMin = (m: number, p: Profile) => (m * 1.25) / p.walkSpeed;

interface Dij {
  dist: Map<string, number>;
  prev: Map<string, string>;
}
function dijkstra(sources: Map<string, number>, ctx: Ctx, penal?: Set<string>): Dij {
  const { conds, profile } = ctx;
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const done = new Set<string>();
  for (const [k, v] of sources) dist.set(k, v);
  for (;;) {
    let u: string | null = null;
    let best = Infinity;
    for (const [k, v] of dist) if (!done.has(k) && v < best) (best = v), (u = k);
    if (u === null) break;
    done.add(u);
    const relax = (to: string, w: number) => {
      const nd = best + w;
      if (nd < (dist.get(to) ?? Infinity)) dist.set(to, nd), prev.set(to, u!);
    };
    for (const e of net.adj.get(u) ?? []) {
      const key = ek(u, e.to);
      const pf = penal?.has(key) ? 2.5 : 1;
      if (conds.blocked.has(key)) {
        const sh = conds.shuttle.get(key);
        if (sh !== undefined) relax(e.to, sh * pf + 1);
        continue;
      }
      relax(e.to, (e.min + (conds.delay.get(key) ?? 0)) * pf);
    }
    for (const x of net.interchange.get(u) ?? []) {
      const lift = conds.liftOut.has(u) || conds.liftOut.has(x) ? profile.liftPenalty : 0;
      relax(x, 4 + profile.transferPenalty + lift);
    }
  }
  return { dist, prev };
}
function pathTo(d: Dij, target: string): string[] {
  const out = [target];
  let c = target;
  while (d.prev.has(c)) (c = d.prev.get(c)!), out.push(c);
  return out.reverse();
}

let stopStationsCache: Map<string, { station: string; m: number }[]> | null = null;
function stopStations() {
  if (stopStationsCache) return stopStationsCache;
  const m = new Map<string, { station: string; m: number }[]>();
  for (const [station, stops] of net.stationStops)
    for (const s of stops) {
      const l = m.get(s.code) ?? [];
      l.push({ station, m: s.m });
      m.set(s.code, l);
    }
  return (stopStationsCache = m);
}

const stopEnd = (code: string): LegEnd => {
  const s = net.stops.get(code)!;
  return { name: s.Description, lat: s.Latitude, lng: s.Longitude, code };
};
const stationEnd = (code: string): LegEnd => {
  const s = net.stations.get(code)!;
  return { name: s.name, lat: s.lat, lng: s.lng, code };
};

function walkLeg(from: LegEnd, to: LegEnd, m: number, ctx: Ctx, note?: string): Leg {
  const mins = walkMin(m, ctx.profile);
  return {
    mode: 'walk', from, to, minutes: mins, min: mins * 0.9, max: mins * 1.2, waitMin: 0, km: (m * 1.25) / 1000,
    path: [[from.lat, from.lng], [to.lat, to.lng]], note,
  };
}

function busLeg(key: string, i: number, j: number, ctx: Ctx): Leg {
  const r = net.routes.get(key)!;
  const seg = r.stops.slice(i, j + 1);
  let km = seg[seg.length - 1].km - seg[0].km;
  if (!(km > 0)) {
    km = 0;
    for (let k = 1; k < seg.length; k++) {
      const a = net.stops.get(seg[k - 1].code)!;
      const b = net.stops.get(seg[k].code)!;
      km += haversineKm(a.Latitude, a.Longitude, b.Latitude, b.Longitude) * 1.2;
    }
  }
  const ride = (km / (ctx.peak ? 18 : 21)) * 60;
  const hw = ctx.peak ? r.headway.peak : r.headway.offpeak;
  const wait = hw / 2;
  const from = stopEnd(seg[0].code);
  const to = stopEnd(seg[seg.length - 1].code);
  const near = (code: string) =>
    ctx.conds.freeBusIslandWide ||
    [...ctx.conds.freeBus].some((st) => {
      const s = net.stations.get(st);
      const b = net.stops.get(code)!;
      return s && haversineKm(s.lat, s.lng, b.Latitude, b.Longitude) < 0.45;
    });
  const free = ctx.conds.freeBus.size > 0 || ctx.conds.freeBusIslandWide ? near(seg[0].code) && near(seg[seg.length - 1].code) : false;
  return {
    mode: 'bus', from, to, minutes: wait + ride, min: 1 + ride * 0.8, max: hw + ride * 1.35, waitMin: wait, km,
    service: r.service, headsign: r.destination, stops: seg.length - 1,
    path: seg.map((s) => {
      const b = net.stops.get(s.code)!;
      return [b.Latitude, b.Longitude] as LatLng;
    }),
    free,
  };
}

// Splits a station path into ride/shuttle legs; interchange hops become transfer time on the next leg.
function railLegs(path: string[], ctx: Ctx): Leg[] {
  const legs: Leg[] = [];
  let cur: { kind: 'mrt' | 'shuttle'; line: string; codes: string[]; ride: number; delay: number; blocked: boolean; affectedPaths: LatLng[][]; transfer: number } | null = null;
  let pendingTransfer = 0;
  const flush = () => {
    if (!cur) return;
    const first = legs.filter((l) => l.mode === 'mrt' || l.mode === 'shuttle').length === 0;
    const hw = cur.kind === 'shuttle' ? 6 : headway(cur.line, ctx.peak);
    const wait = cur.transfer + hw / 2;
    const info = lineById(cur.line);
    const lift = cur.codes.filter((c, i) => (i === 0 || i === cur!.codes.length - 1) && ctx.conds.liftOut.has(c));
    legs.push({
      mode: cur.kind,
      from: stationEnd(cur.codes[0]),
      to: stationEnd(cur.codes[cur.codes.length - 1]),
      minutes: wait + cur.ride + cur.delay,
      min: cur.transfer + 0.5 + cur.ride * 0.95,
      max: cur.transfer + hw + cur.ride * 1.1 + cur.delay * 1.6,
      waitMin: wait,
      km: 0,
      line: cur.kind === 'shuttle' ? 'SHUTTLE' : cur.line,
      lineName: cur.kind === 'shuttle' ? 'Free bridging bus' : info?.name,
      color: cur.kind === 'shuttle' ? '#f59e0b' : info?.color,
      stops: cur.codes.length - 1,
      stations: cur.codes,
      path: cur.codes.map((c) => [net.stations.get(c)!.lat, net.stations.get(c)!.lng] as LatLng),
      affectedPaths: cur.affectedPaths.length ? cur.affectedPaths : undefined,
      delayMin: cur.delay > 0 ? Math.round(cur.delay) : undefined,
      blocked: cur.blocked || undefined,
      free: cur.kind === 'shuttle' || undefined,
      liftOut: lift.length ? lift.flatMap((c) => ctx.conds.liftOut.get(c) ?? []) : undefined,
      note: first ? undefined : cur.transfer ? `Transfer ~${Math.round(cur.transfer)} min` : undefined,
    });
    cur = null;
  };
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1];
    const b = path[k];
    const edge = (net.adj.get(a) ?? []).find((e) => e.to === b);
    if (!edge) {
      flush();
      pendingTransfer = 3.5;
      continue;
    }
    const key = ek(a, b);
    const blocked = ctx.conds.blocked.has(key);
    const useShuttle = blocked && ctx.conds.shuttle.has(key);
    const kind: 'mrt' | 'shuttle' = useShuttle ? 'shuttle' : 'mrt';
    if (!cur || cur.kind !== kind || cur.line !== edge.line) {
      flush();
      cur = { kind, line: edge.line, codes: [a], ride: 0, delay: 0, blocked: false, affectedPaths: [], transfer: pendingTransfer };
      pendingTransfer = 0;
    }
    cur.codes.push(b);
    cur.ride += useShuttle ? ctx.conds.shuttle.get(key)! : edge.min;
    const dl = ctx.conds.delay.get(key) ?? 0;
    cur.delay += dl;
    if (blocked && !useShuttle) cur.blocked = true;
    if (blocked || dl > 0 || (ctx.conds.affected.has(a) && ctx.conds.affected.has(b))) {
      const sa = net.stations.get(a)!;
      const sb = net.stations.get(b)!;
      cur.affectedPaths.push([[sa.lat, sa.lng], [sb.lat, sb.lng]]);
    }
  }
  flush();
  return legs;
}

function materialize(spec: Spec, ctx: Ctx, id: string): Option {
  const O: LegEnd = { name: ctx.from.name, lat: ctx.from.lat, lng: ctx.from.lng };
  const D: LegEnd = { name: ctx.to.name, lat: ctx.to.lat, lng: ctx.to.lng };
  const legs: Leg[] = [];
  const addRail = (path: string[]) => legs.push(...railLegs(path, ctx));
  if (spec.t === 'walk') {
    legs.push(walkLeg(O, D, haversineKm(O.lat, O.lng, D.lat, D.lng) * 1000, ctx));
  } else if (spec.t === 'rail') {
    legs.push(walkLeg(O, stationEnd(spec.acc.code), spec.acc.m, ctx));
    addRail(spec.path);
    legs.push(walkLeg(stationEnd(spec.egr.code), D, spec.egr.m, ctx));
  } else if (spec.t === 'bus') {
    legs.push(walkLeg(O, stopEnd(spec.a.code), spec.a.m, ctx));
    legs.push(busLeg(spec.key, spec.i, spec.j, ctx));
    legs.push(walkLeg(stopEnd(spec.e.code), D, spec.e.m, ctx));
  } else if (spec.t === 'bus+rail') {
    legs.push(walkLeg(O, stopEnd(spec.a.code), spec.a.m, ctx));
    const b = busLeg(spec.key, spec.i, spec.j, ctx);
    legs.push(b);
    legs.push(walkLeg(b.to, stationEnd(spec.path[0]), spec.xferM, ctx, 'Transfer to train'));
    addRail(spec.path);
    legs.push(walkLeg(stationEnd(spec.egr.code), D, spec.egr.m, ctx));
  } else {
    legs.push(walkLeg(O, stationEnd(spec.acc.code), spec.acc.m, ctx));
    addRail(spec.path);
    const b = busLeg(spec.key, spec.i, spec.j, ctx);
    legs.push(walkLeg(stationEnd(spec.path[spec.path.length - 1]), b.from, spec.xferM, ctx, 'Transfer to bus'));
    legs.push(b);
    legs.push(walkLeg(stopEnd(spec.e.code), D, spec.e.m, ctx));
  }
  const kept = legs.filter((l) => !(l.mode === 'walk' && l.minutes < 0.3));
  return score({ id, kind: spec.t, summary: '', legs: kept, minutes: 0, min: 0, max: 0, walkMin: 0, transfers: 0, fare: 0, cost: 0, tags: [], feasible: true, signature: '' }, ctx);
}

function score(o: Option, ctx: Ctx): Option {
  const p = ctx.profile;
  const ride = o.legs.filter((l) => l.mode !== 'walk');
  o.minutes = o.legs.reduce((a, l) => a + l.minutes, 0);
  o.min = o.legs.reduce((a, l) => a + l.min, 0);
  o.max = o.legs.reduce((a, l) => a + l.max, 0);
  o.walkMin = o.legs.filter((l) => l.mode === 'walk').reduce((a, l) => a + l.minutes, 0);
  o.transfers = Math.max(0, ride.length - 1);
  o.feasible = !ride.some((l) => l.blocked);
  const paidKm = ride.filter((l) => !l.free).reduce((a, l) => a + (l.mode === 'bus' ? l.km : (l.stops ?? 0) * 1.3), 0);
  o.fare = paidKm > 0 ? Math.min(2.37, 0.99 + 0.075 * paidKm) : 0;
  o.summary = ride.map((l) => (l.mode === 'bus' ? `Bus ${l.service}` : l.mode === 'shuttle' ? 'Bridging bus' : l.line)).join(' → ') || 'Walk';
  o.signature = ride.map((l) => (l.mode === 'bus' ? `b${l.service}` : `${l.line}:${l.from.code}-${l.to.code}`)).join('/') || 'walk';
  const firstWalk = o.legs[0]?.mode === 'walk' ? o.legs[0].minutes : 0;
  const lastWalk = o.legs[o.legs.length - 1]?.mode === 'walk' ? o.legs[o.legs.length - 1].minutes : 0;
  const rain = (ctx.wet.origin?.wet ? firstWalk : 0) + (ctx.wet.dest?.wet ? lastWalk : 0);
  const crowded = ride.filter((l) => l.mode === 'mrt' && l.from.code && crowdOf(l.from.code, ctx) === 'h').length;
  const lifts = ride.filter((l) => l.liftOut?.length).length;
  o.cost =
    o.minutes + (p.walkWeight - 1) * o.walkMin + rain * 0.9 + o.transfers * p.transferPenalty +
    p.spreadWeight * (o.max - o.min) + crowded * p.crowdPenalty + lifts * p.liftPenalty + (o.feasible ? 0 : 1e6);
  o.tags = [];
  if (!o.feasible) o.tags.push('blocked');
  if (ride.some((l) => l.delayMin)) o.tags.push('delayed');
  if (ride.some((l) => l.free)) o.tags.push('free-transfer');
  if (crowded) o.tags.push('crowded');
  if (lifts) o.tags.push('lift-outage');
  if (rain > 2) o.tags.push('wet-walk');
  return o;
}

function crowdOf(code: string, ctx: Ctx): CrowdLevel {
  const k = code === 'CC34' ? 'CE1' : code === 'CC33' ? 'CE2' : code;
  return ctx.crowd.get(k) ?? 'NA';
}

function generate(ctx: Ctx): { options: Option[]; specs: Map<string, Spec> } {
  const { from, to, profile } = ctx;
  const specs: { spec: Spec; est: number }[] = [];
  const direct = haversineKm(from.lat, from.lng, to.lat, to.lng) * 1000;
  if (direct < 1600) specs.push({ spec: { t: 'walk' }, est: walkMin(direct, profile) });

  const accSources = new Map<string, number>();
  for (const [code, m] of ctx.accStations) accSources.set(code, walkMin(m, profile) * profile.walkWeight + headway(net.stations.get(code)!.line, ctx.peak) / 2);
  const egrSources = new Map<string, number>();
  for (const [code, m] of ctx.egrStations) egrSources.set(code, walkMin(m, profile) * profile.walkWeight);
  const fwd = dijkstra(accSources, ctx);
  const rev = dijkstra(egrSources, ctx);

  const railBest = (d: Dij) => {
    let best: { code: string; v: number } | null = null;
    for (const [code, m] of ctx.egrStations) {
      const v = (d.dist.get(code) ?? Infinity) + walkMin(m, profile) * profile.walkWeight;
      if (!best || v < best.v) best = { code, v };
    }
    return best && Number.isFinite(best.v) ? best : null;
  };
  let penal = new Set<string>();
  let d = fwd;
  for (let k = 0; k < 3; k++) {
    const b = railBest(d);
    if (!b) break;
    const path = pathTo(d, b.code);
    specs.push({ spec: { t: 'rail', acc: { code: path[0], m: ctx.accStations.get(path[0])! }, path, egr: { code: b.code, m: ctx.egrStations.get(b.code)! } }, est: b.v });
    penal = new Set([...penal, ...path.slice(1).map((c, i) => ek(path[i], c))]);
    d = dijkstra(accSources, ctx, penal);
  }

  const accStops = nearbyStops(from.lat, from.lng, profile.busWalkM, 12);
  const egrStops = nearbyStops(to.lat, to.lng, profile.busWalkM, 12);
  const egrStopM = new Map(egrStops.map((s) => [s.BusStopCode, s.m]));
  const sst = stopStations();
  const best = new Map<string, { spec: Spec; est: number }>();
  const keep = (k: string, spec: Spec, est: number) => {
    const cur = best.get(k);
    if (!cur || est < cur.est) best.set(k, { spec, est });
  };
  const rideEst = (key: string, i: number, j: number) => {
    const r = net.routes.get(key)!;
    const km = r.stops[j].km - r.stops[i].km;
    return (Math.max(km, 0.3) / (ctx.peak ? 18 : 21)) * 60 + (ctx.peak ? r.headway.peak : r.headway.offpeak) / 2;
  };
  for (const a of accStops) {
    const wa = walkMin(a.m, profile) * profile.walkWeight;
    for (const { key, idx } of net.stopRoutes.get(a.BusStopCode) ?? []) {
      const r = net.routes.get(key)!;
      const end = Math.min(r.stops.length - 1, idx + 60);
      for (let j = idx + 1; j <= end; j++) {
        const code = r.stops[j].code;
        const em = egrStopM.get(code);
        if (em !== undefined) {
          const est = wa + rideEst(key, idx, j) + walkMin(em, profile) * profile.walkWeight + profile.transferPenalty * 0;
          keep(`bus:${r.service}`, { t: 'bus', a: { code: a.BusStopCode, m: a.m }, key, i: idx, j, e: { code, m: em } }, est);
        }
        if (r.stops[j].km - r.stops[idx].km < 1) continue;
        for (const st of sst.get(code) ?? []) {
          const tail = rev.dist.get(st.station);
          if (tail === undefined) continue;
          const est = wa + rideEst(key, idx, j) + walkMin(st.m, profile) + headway(net.stations.get(st.station)!.line, ctx.peak) / 2 + tail + profile.transferPenalty;
          const k2 = `bus+rail:${r.service}`;
          const cur = best.get(k2);
          if (cur && cur.est <= est) continue;
          const tailPath = pathTo(rev, st.station).reverse();
          const egr = tailPath[tailPath.length - 1];
          keep(k2, { t: 'bus+rail', a: { code: a.BusStopCode, m: a.m }, key, i: idx, j, xferM: st.m, path: tailPath, egr: { code: egr, m: ctx.egrStations.get(egr) ?? 0 } }, est);
        }
      }
    }
  }
  for (const e of egrStops) {
    const we = walkMin(e.m, profile) * profile.walkWeight;
    for (const { key, idx } of net.stopRoutes.get(e.BusStopCode) ?? []) {
      const r = net.routes.get(key)!;
      for (let i = Math.max(0, idx - 60); i < idx; i++) {
        if (r.stops[idx].km - r.stops[i].km < 1) continue;
        for (const st of sst.get(r.stops[i].code) ?? []) {
          const head = fwd.dist.get(st.station);
          if (head === undefined) continue;
          const est = head + walkMin(st.m, profile) + rideEst(key, i, idx) + we + profile.transferPenalty;
          const k2 = `rail+bus:${r.service}`;
          const cur = best.get(k2);
          if (cur && cur.est <= est) continue;
          const headPath = pathTo(fwd, st.station);
          keep(k2, { t: 'rail+bus', acc: { code: headPath[0], m: ctx.accStations.get(headPath[0]) ?? 0 }, path: headPath, xferM: st.m, key, i, j: idx, e: { code: e.BusStopCode, m: e.m } }, est);
        }
      }
    }
  }
  const byType = new Map<string, { spec: Spec; est: number }[]>();
  for (const [k, v] of best) {
    const t = k.split(':')[0];
    byType.set(t, [...(byType.get(t) ?? []), v]);
  }
  for (const list of byType.values()) specs.push(...list.sort((a, b) => a.est - b.est).slice(0, 3));

  const specMap = new Map<string, Spec>();
  const seen = new Set<string>();
  const options: Option[] = [];
  specs.forEach((s, i) => {
    const o = materialize(s.spec, ctx, `o${i}`);
    if (seen.has(o.signature)) return;
    seen.add(o.signature);
    specMap.set(o.id, s.spec);
    options.push(o);
  });
  options.sort((a, b) => a.cost - b.cost);
  return { options, specs: specMap };
}

async function walkGeometry(leg: Leg, p: Profile) {
  const key = `osrm:${leg.from.lat.toFixed(5)},${leg.from.lng.toFixed(5)};${leg.to.lat.toFixed(5)},${leg.to.lng.toFixed(5)}`;
  try {
    const r = await cached(key, 3600_000, async () => {
      const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${leg.from.lng},${leg.from.lat};${leg.to.lng},${leg.to.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3500), headers: { 'User-Agent': 'TransitMate-hackathon/1.0' } });
      if (!res.ok) throw new Error(`osrm ${res.status}`);
      const j = (await res.json()) as { routes?: { distance: number; geometry: { coordinates: [number, number][] } }[] };
      const route = j.routes?.[0];
      if (!route) throw new Error('no route');
      return { m: route.distance, coords: route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LatLng) };
    });
    leg.path = r.coords;
    leg.km = r.m / 1000;
    leg.minutes = r.m / p.walkSpeed;
    leg.min = leg.minutes * 0.9;
    leg.max = leg.minutes * 1.2;
  } catch {
    /* keep the straight-line estimate */
  }
}

async function enrich(o: Option, ctx: Ctx, geometryOnly = false): Promise<Option> {
  await Promise.all(o.legs.filter((l) => l.mode === 'walk' && l.km > 0.05).map((l) => walkGeometry(l, ctx.profile)));
  if (geometryOnly) return score(o, ctx);
  let t = ctx.departAt;
  const liveWindow = Math.abs(ctx.departAt - Date.now()) < 45 * 60_000;
  for (const leg of o.legs) {
    if (leg.mode === 'bus' && leg.from.code && liveWindow) {
      try {
        const arr = await busArrivals(leg.from.code);
        const svc = arr.Services?.find((s) => s.ServiceNo === leg.service);
        const buses = svc ? [svc.NextBus, svc.NextBus2, svc.NextBus3].filter((b) => b?.EstimatedArrival) : [];
        const pick = buses.find((b) => Date.parse(b.EstimatedArrival) >= t - 30_000);
        if (pick) {
          const ride = leg.minutes - leg.waitMin;
          const wait = Math.max(0, (Date.parse(pick.EstimatedArrival) - t) / 60_000);
          leg.waitMin = wait;
          leg.minutes = ride + wait;
          leg.min = ride * 0.8 + Math.max(0, wait - 1);
          leg.max = ride * 1.35 + wait + 2;
          leg.live = { eta: pick.EstimatedArrival, load: pick.Load, wab: pick.Feature === 'WAB', type: pick.Type, monitored: pick.Monitored === 1 };
        }
      } catch {
        /* headway estimate stands */
      }
    }
    if (leg.mode === 'mrt' && leg.from.code) leg.crowd = await crowdAt(leg.from.code, t, ctx.crowd);
    t += leg.minutes * 60_000;
  }
  return score(o, ctx);
}

export interface PlanResult {
  generatedAt: number;
  departAt: number;
  from: Place;
  to: Place;
  profile: ProfileId;
  options: Option[];
  usual: Option | null;
  usualLive: Option | null;
  changed: boolean;
  why: string[];
  weather: { origin: AreaForecast | null; dest: AreaForecast | null };
}

export async function plan(input: {
  from: Place;
  to: Place;
  departAt: number;
  profile: ProfileId;
  conds: Conditions;
  crowd: Map<string, CrowdLevel>;
  wet: { origin: AreaForecast | null; dest: AreaForecast | null };
}): Promise<PlanResult> {
  const profile = PROFILES[input.profile] ?? PROFILES.rachel;
  const stationsNear = (p: Place) =>
    new Map(nearbyStations(p.lat, p.lng, profile.maxWalkM, 5).map((s) => [s.code, s.m] as const));
  let accStations = stationsNear(input.from);
  let egrStations = stationsNear(input.to);
  if (!accStations.size) accStations = new Map(nearbyStations(input.from.lat, input.from.lng, 4000, 2).map((s) => [s.code, s.m] as const));
  if (!egrStations.size) egrStations = new Map(nearbyStations(input.to.lat, input.to.lng, 4000, 2).map((s) => [s.code, s.m] as const));
  const base: Omit<Ctx, 'conds' | 'crowd' | 'wet'> = {
    from: input.from, to: input.to, departAt: input.departAt, profile, peak: isPeak(input.departAt), accStations, egrStations,
  };
  const liveCtx: Ctx = { ...base, conds: input.conds, crowd: input.crowd, wet: input.wet };
  const calmCtx: Ctx = { ...base, conds: buildConditions([]), crowd: new Map(), wet: { origin: null, dest: null } };

  const live = generate(liveCtx);
  const calm = generate(calmCtx);
  const usualSpec = calm.options[0] ? calm.specs.get(calm.options[0].id) : undefined;
  const usual = calm.options[0] ? await enrich(calm.options[0], calmCtx, true) : null;
  const usualLive = usualSpec ? materialize(usualSpec, liveCtx, 'usual') : null;

  // Buses that run the same stop pair are one option ("Bus 650 / 660"), not two near-identical cards.
  const shape = (o: Option) => o.legs.filter((l) => l.mode !== 'walk').map((l) => `${l.mode}:${l.from.code}>${l.to.code}`).join('|');
  const pick: Option[] = [];
  for (const o of live.options.filter((x) => x.feasible)) {
    if (pick.length >= 3) break;
    const twin = pick.find((p) => shape(p) === shape(o));
    if (twin) {
      const tb = twin.legs.find((l) => l.mode === 'bus');
      const ob = o.legs.find((l) => l.mode === 'bus');
      if (tb && ob?.service && ob.service !== tb.service) tb.alsoServices = [...(tb.alsoServices ?? []), ob.service];
      continue;
    }
    const involvesBus = o.kind !== 'rail' && o.kind !== 'walk';
    if (pick.length === 2 && !pick.some((p) => p.kind !== 'rail' && p.kind !== 'walk') && !involvesBus) {
      const alt = live.options.find((x) => x.feasible && x.kind !== 'rail' && x.kind !== 'walk' && !pick.includes(x));
      if (alt && alt.cost < pick[0].cost * 1.6) {
        pick.push(alt);
        continue;
      }
    }
    pick.push(o);
  }
  const enriched = await Promise.all(pick.map((o) => enrich(o, liveCtx)));
  enriched.sort((a, b) => a.cost - b.cost);
  const usualLiveEnriched = usualLive ? await enrich(usualLive, liveCtx) : null;

  const why: string[] = [];
  const bestO = enriched[0];
  let changed = false;
  if (usual && usualLiveEnriched && bestO) {
    const hit = input.conds.disruptions.filter((d) => usualLiveEnriched.legs.some((l) => l.line === d.line && l.affectedPaths?.length) || usualLiveEnriched.legs.some((l) => l.mode === 'shuttle'));
    const plannedHit = hit.find((d) => d.planned);
    if (plannedHit) {
      const day = new Date(input.departAt + 8 * 3600_000).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
      why.push(`Planned closure: ${plannedHit.lineName} is closed on ${day} for ${plannedHit.planned!.reason} (LTA service notice)${usualLiveEnriched.feasible ? ' — shuttle buses replace it' : ''}.`);
    } else if (!usualLiveEnriched.feasible) {
      why.push(`Your usual route (${usual.summary}) is cut: no ${hit[0]?.lineName ?? 'train'} service between ${stationNames(hit[0]?.stations)}.`);
    } else if (usualLiveEnriched.legs.some((l) => l.mode === 'shuttle')) {
      why.push(`Your usual ${usual.summary} ride is broken between ${stationNames(hit[0]?.stations)} — LTA is running free bridging buses there.`);
    } else if (usualLiveEnriched.minutes - usual.minutes >= 3) {
      why.push(`Your usual route is running about ${Math.round(usualLiveEnriched.minutes - usual.minutes)} min slower (${hit[0] ? `${hit[0].lineName} delays` : 'live conditions'}).`);
    }
    if (bestO.signature !== usual.signature) {
      changed = true;
      const delta = Math.round(bestO.minutes - usual.minutes);
      why.push(`Recommended ${bestO.summary}: ${delta >= 0 ? `+${delta}` : delta} min vs a normal day${bestO.tags.includes('free-transfer') ? ', free boarding on the affected stretch' : ''}.`);
    }
    if (input.wet.dest?.wet || input.wet.origin?.wet) {
      const where = [input.wet.origin?.wet ? input.wet.origin.area : null, input.wet.dest?.wet ? input.wet.dest.area : null].filter(Boolean).join(' and ');
      why.push(`${input.wet.dest?.heavy || input.wet.origin?.heavy ? 'Heavy rain' : 'Showers'} forecast at ${where} — routes with less open-air walking rank higher.`);
    }
    const crowdedLeg = bestO.legs.find((l) => l.crowd?.level === 'h');
    if (crowdedLeg) why.push(`${crowdedLeg.from.name} is ${crowdedLeg.crowd?.source === 'forecast' ? 'forecast' : 'currently'} crowded (LTA Station Crowd Density).`);
  }
  for (const o of enriched) roundOption(o);
  if (usual) roundOption(usual);
  if (usualLiveEnriched) roundOption(usualLiveEnriched);
  return {
    generatedAt: Date.now(), departAt: input.departAt, from: input.from, to: input.to, profile: profile.id,
    options: enriched, usual, usualLive: usualLiveEnriched, changed, why, weather: input.wet,
  };
}

function stationNames(codes?: string[]) {
  if (!codes?.length) return 'the affected stations';
  const a = net.stations.get(codes[0])?.name ?? codes[0];
  const b = net.stations.get(codes[codes.length - 1])?.name ?? codes[codes.length - 1];
  return `${a} and ${b}`;
}

function roundOption(o: Option) {
  o.minutes = Math.round(o.minutes);
  o.min = Math.max(1, Math.floor(o.min));
  o.max = Math.ceil(Math.max(o.max, o.minutes));
  o.walkMin = Math.round(o.walkMin);
  o.fare = Math.round(o.fare * 100) / 100;
  o.cost = r1(o.cost);
  for (const l of o.legs) {
    l.minutes = r1(l.minutes);
    l.min = r1(l.min);
    l.max = r1(l.max);
    l.waitMin = r1(l.waitMin);
    l.km = Math.round(l.km * 100) / 100;
  }
}
