import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api/datamall';
import { runCIE } from '@/lib/cie';
import { sgDay, todayAt } from '@/lib/format';
import { useStore } from '@/store/useStore';
import type { CrowdLevel, LiftOutage, PlanResult, TaxiCount } from '@/types';
import { usePoll } from './usePoll';

export type DepartMode = 'auto' | 'now' | 'usual';

// Before the usual departure (same day, within 3 h) we plan for that time — the proactive case.
// Otherwise we plan "if you left now", and say so on screen.
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function departureFor(departTime: string, days: number[], mode: DepartMode, now = Date.now()) {
  const usual = todayAt(departTime, now);
  if (mode === 'now') return { at: now, scheduled: false, label: 'now' };
  if (mode === 'usual') {
    for (let d = 0; d < 8; d++) {
      const at = usual + d * 86_400_000;
      if (at > now && days.includes(sgDay(at))) return { at, scheduled: true, label: d === 0 ? 'today' : d === 1 ? 'tomorrow' : DAY[sgDay(at)] };
    }
  }
  const upcoming = days.includes(sgDay(now)) && usual >= now && usual - now < 3 * 3600_000;
  return { at: upcoming ? usual : now, scheduled: upcoming, label: upcoming ? 'today' : 'now' };
}

const PCD_PREFIX: Record<string, string> = {
  NS: 'NSL', EW: 'EWL', CG: 'CGL', NE: 'NEL', CC: 'CCL', DT: 'DTL', TE: 'TEL', BP: 'BPL', SE: 'SLRT', SW: 'SLRT', PE: 'PLRT', PW: 'PLRT',
};
function pcdKey(code: string) {
  if (code === 'CC34') return { line: 'CEL', station: 'CE1' };
  if (code === 'CC33') return { line: 'CEL', station: 'CE2' };
  const line = PCD_PREFIX[code.replace(/\d.*$/, '')];
  return line ? { line, station: code } : null;
}

export function useCommute(mode: DepartMode = 'auto') {
  const { commute, profile, threshold, scenario, alerts, weather, weatherDest, lastCommutePlan, set } = useStore();
  const [tick, setTick] = useState(0);
  const dep = departureFor(commute.departTime, commute.days, mode);

  const planQ = usePoll(
    () => api.plan(commute.from, commute.to, { departAt: dep.scheduled ? dep.at : undefined, profile, scenario }),
    60_000,
    [commute.from.lat, commute.to.lat, commute.departTime, profile, scenario, dep.scheduled, tick],
  );
  useEffect(() => {
    if (planQ.data) set({ lastCommutePlan: planQ.data });
  }, [planQ.data, set]);
  const plan: PlanResult | null = planQ.data ?? lastCommutePlan;

  const liftsQ = usePoll(() => api.lifts(), 10 * 60_000, []);
  const disrupted = (alerts?.disruptions.length ?? 0) > 0;
  const taxiQ = usePoll<TaxiCount>(disrupted ? () => api.taxi(commute.from.lat, commute.from.lng, 1) : null, 60_000, [disrupted]);

  const board = plan?.options[0]?.legs.find((l) => l.mode === 'mrt');
  const boardAt = plan ? plan.departAt + (plan.options[0]?.legs[0]?.mode === 'walk' ? plan.options[0].legs[0].minutes * 60_000 : 0) : 0;
  const key = board?.from.code ? pcdKey(board.from.code) : null;
  const [crowd, setCrowd] = useState<{ station: string; level: CrowdLevel; better?: { at: number; level: CrowdLevel } } | null>(null);
  useEffect(() => {
    if (!key || !board) return setCrowd(null);
    let alive = true;
    api
      .crowdForecast(key.line, key.station)
      .then((fc) => {
        const slots = (fc.stations[key.station] ?? []).sort((a, b) => a.start - b.start);
        const cur = [...slots].reverse().find((s) => s.start <= boardAt);
        if (!cur || !alive) return;
        const rank = { l: 0, m: 1, h: 2, NA: 3 };
        const better = slots
          .filter((s) => Math.abs(s.start - boardAt) <= 60 * 60_000 && s.start > Date.now() && rank[s.level] < rank[cur.level])
          .sort((a, b) => Math.abs(a.start - boardAt) - Math.abs(b.start - boardAt))[0];
        setCrowd({ station: board.from.name, level: cur.level, better: better ? { at: better.start, level: better.level } : undefined });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key?.station, Math.round(boardAt / 1_800_000)]);

  const cie = useMemo(
    () =>
      runCIE({
        now: Date.now(),
        alerts,
        plan,
        commute,
        profile,
        threshold,
        weatherOrigin: weather,
        weatherDest,
        crowdAtDeparture: crowd,
        lifts: (liftsQ.data as LiftOutage[] | null) ?? [],
        taxi: taxiQ.data,
      }),
    [alerts, plan, commute, profile, threshold, weather, weatherDest, crowd, liftsQ.data, taxiQ.data],
  );

  return { plan, cie, dep, loading: planQ.loading, updatedAt: planQ.updatedAt ?? plan?.generatedAt ?? null, stale: !planQ.data && !!lastCommutePlan, refresh: () => setTick((t) => t + 1) };
}
