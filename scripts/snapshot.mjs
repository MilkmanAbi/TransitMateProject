// Records a labelled snapshot of the live API for the static GitHub Pages demo.
// Needs the server running locally with a DataMall key:  node scripts/snapshot.mjs [http://localhost:3001]
// Output: client/snapshot/*.json (public LTA/NEA data only — no credentials).
import fs from 'node:fs';
import path from 'node:path';

const API = `${process.argv[2] ?? 'http://localhost:3001'}/api`;
const OUT = path.resolve('client/snapshot');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'plans'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'arrivals'), { recursive: true });

const get = async (p) => {
  const r = await fetch(`${API}${p}`);
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return r.json();
};
const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data));
export const planKey = (f, t, profile, scenario, at) =>
  `${f.lat.toFixed(4)}_${f.lng.toFixed(4)}__${t.lat.toFixed(4)}_${t.lng.toFixed(4)}__${profile}__${scenario ?? 'live'}__${at ? 'at' : 'now'}`.replace(/[^a-z0-9_]/gi, '');

const SG = 8 * 3600_000;
const sgDay = (ms) => new Date(ms + SG).getUTCDay();
const todayAt = (hm, base) => {
  const [h, m] = hm.split(':').map(Number);
  const d = new Date(base + SG);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m) - SG;
};
const nextCommute = (hm, days, now) => {
  for (let d = 0; d < 8; d++) {
    const at = todayAt(hm, now) + d * 86_400_000;
    if (at > now && days.includes(sgDay(at))) return at;
  }
  return now;
};

const now = Date.now();
const mrt = JSON.parse(fs.readFileSync('client/public/mrt.json', 'utf8'));
const st = (code) => mrt.stations.find((s) => s.code === code);
const PERSONAS = [
  { id: 'rachel', from: { name: 'Home · Tampines Central', lat: 1.35355, lng: 103.94508 }, to: { name: 'Office · One Raffles Place', lat: 1.28437, lng: 103.85122 }, time: '07:40', days: [1, 2, 3, 4, 5], stops: ['75009', '03031'] },
  { id: 'arjun', from: { name: 'Home · Punggol Central', lat: 1.40525, lng: 103.90237 }, to: { name: 'Work · one-north', lat: 1.29983, lng: 103.78752 }, time: '08:30', days: [1, 2, 3, 4, 5], stops: ['65259', '18051'] },
  { id: 'lim', from: { name: 'Home · Bedok North Ave 1', lat: 1.32706, lng: 103.93155 }, to: { name: 'Singapore General Hospital', lat: 1.2795, lng: 103.8348 }, time: '09:00', days: [0, 1, 2, 3, 4, 5, 6], stops: ['84009', '06011'] },
];
const SCENARIOS = [null, 'ewl-track-fault', 'ewl-signal-delay', 'bplrt-planned-closure'];
const place = (p) => encodeURIComponent(`${p.lat},${p.lng},${p.name}`);

const plans = [];
const addPlan = async (from, to, profile, scenario, departAt) => {
  const key = planKey(from, to, profile, scenario, !!departAt);
  const q = `/plan?from=${place(from)}&to=${place(to)}&profile=${profile}${scenario ? `&scenario=${scenario}` : ''}${departAt ? `&depart=${departAt}` : ''}`;
  const p = await get(q);
  write(`plans/${key}.json`, p);
  plans.push({ key, from: from.name, to: to.name, profile, scenario, at: !!departAt });
  process.stdout.write('.');
  return p;
};

const busStops = new Set();
for (const per of PERSONAS) {
  per.stops.forEach((s) => busStops.add(s));
  for (const sc of SCENARIOS) {
    for (const at of [null, nextCommute(per.time, per.days, now)]) {
      const p = await addPlan(per.from, per.to, per.id, sc, at);
      for (const o of p.options) for (const l of o.legs) if (l.mode === 'bus' && l.from.code) busStops.add(l.from.code);
    }
  }
}
// README step 9: Senja LRT → Choa Chu Kang MRT, tomorrow 08:00 (planned BPLRT closure from the live notice)
const senja = { name: 'Senja LRT', lat: st('BP13').lat, lng: st('BP13').lng };
const cck = { name: 'Choa Chu Kang MRT', lat: st('NS4').lat, lng: st('NS4').lng };
const tomorrow8 = todayAt('08:00', now) + 86_400_000;
for (const sc of [null, 'bplrt-planned-closure']) for (const at of [null, tomorrow8]) await addPlan(senja, cck, 'rachel', sc, at);
console.log(`\n${plans.length} plans`);

write('alerts.json', Object.fromEntries(await Promise.all(SCENARIOS.map(async (s) => [s ?? 'live', await get(`/train/alerts${s ? `?scenario=${s}` : ''}`)]))));
write('scenarios.json', await get('/train/scenarios'));
write('crowd-now.json', await get('/train/crowding/now'));
write('lifts.json', await get('/train/lifts'));
const LINES = ['NSL', 'EWL', 'CGL', 'CCL', 'CEL', 'NEL', 'DTL', 'TEL', 'BPL', 'SLRT', 'PLRT'];
write('crowd-forecast.json', Object.fromEntries(await Promise.all(LINES.map(async (l) => [l, (await get(`/train/crowding?line=${l}`)).stations]))));
const taxi = { total: await get('/taxi'), near: {} };
for (const per of PERSONAS) taxi.near[`${per.from.lat.toFixed(3)},${per.from.lng.toFixed(3)}`] = await get(`/taxi?lat=${per.from.lat}&lng=${per.from.lng}&radius=1`);
write('taxi.json', taxi);
const nea = await (await fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast')).json();
write('weather.json', nea);

for (const per of PERSONAS)
  for (const p of [per.from, per.to]) (await get(`/bus/stops/near?lat=${p.lat}&lng=${p.lng}&radius=400`)).slice(0, 6).forEach((s) => busStops.add(s.code));
for (const code of busStops) {
  try {
    write(`arrivals/${code}.json`, await get(`/bus/arrivals?stop=${code}`));
  } catch {
    /* stop without data */
  }
}
console.log(`${busStops.size} stops with arrivals`);

// Compact stop index for search / nearby (code, name, road, lat, lng, services)
const stops = JSON.parse(fs.readFileSync('server/.cache/bus-stops.json', 'utf8'));
const routes = JSON.parse(fs.readFileSync('server/.cache/bus-routes.json', 'utf8'));
const svc = new Map();
for (const r of routes) {
  const set = svc.get(r.BusStopCode) ?? new Set();
  set.add(r.ServiceNo);
  svc.set(r.BusStopCode, set);
}
write('stops.json', stops.filter((s) => s.Latitude).map((s) => [s.BusStopCode, s.Description, s.RoadName, +s.Latitude.toFixed(6), +s.Longitude.toFixed(6), [...(svc.get(s.BusStopCode) ?? [])].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))]));

write('manifest.json', { capturedAt: now, plans, arrivals: [...busStops] });
const size = fs.readdirSync(OUT, { recursive: true }).reduce((a, f) => {
  const p = path.join(OUT, f);
  return a + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0);
}, 0);
console.log(`snapshot written: ${(size / 1024).toFixed(0)} KB`);
