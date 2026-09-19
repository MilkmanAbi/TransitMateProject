import type { RouteOption } from '@/types';

// kg CO2 per passenger-km (approximate, for comparison only — see WRITEUP.md for sources/limits)
export const EMISSIONS = { mrt: 0.0028, bus: 0.0089, taxi: 0.14, car: 0.17, walk: 0 };

const KEY = 'tm_co2_sessions';

export function optionKm(o: RouteOption) {
  let transit = 0;
  let co2 = 0;
  for (const l of o.legs) {
    const km = l.mode === 'mrt' ? (l.stops ?? 1) * 1.35 : l.km;
    if (l.mode === 'walk') continue;
    transit += km;
    co2 += km * (l.mode === 'mrt' ? EMISSIONS.mrt : EMISSIONS.bus);
  }
  return { transit, co2 };
}

// Taxi baseline: the same trip by road is roughly the transit distance (road network ~ rail length here).
export function co2SavedVsTaxi(o: RouteOption) {
  const { transit, co2 } = optionKm(o);
  return Math.max(0, transit * EMISSIONS.taxi - co2);
}

interface Session {
  at: number;
  kg: number;
  summary: string;
}
export function logTrip(o: RouteOption) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Session[];
    all.push({ at: Date.now(), kg: co2SavedVsTaxi(o), summary: o.summary });
    localStorage.setItem(KEY, JSON.stringify(all.slice(-200)));
  } catch {
    /* storage unavailable */
  }
}
export function monthSaved() {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Session[];
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const month = all.filter((s) => s.at >= start);
    return { kg: month.reduce((a, s) => a + s.kg, 0), trips: month.length };
  } catch {
    return { kg: 0, trips: 0 };
  }
}
