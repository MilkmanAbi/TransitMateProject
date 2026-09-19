import { ArrowRight, BusFront, CheckCircle2, ChevronLeft, Flag, Footprints, Radio, RotateCcw, Siren, TrainFront, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { JourneyBar } from '@/components/Journey/JourneyBar';
import { BusChip, Card, CrowdTag, LineChip, LoadTag } from '@/components/ui';
import { useArrivals } from '@/hooks/useArrivals';
import { useOnline } from '@/hooks/useOnline';
import { hhmm } from '@/lib/format';
import { useStore } from '@/store/useStore';
import type { Leg } from '@/types';

const place = (e: Leg['to']) => (!e.code ? e.name : /^\d{5}$/.test(e.code) ? `${e.name} (stop ${e.code})` : `${e.name} station`);

function instruction(l: Leg): { title: string; detail: string } {
  if (l.mode === 'walk') return { title: `Walk to ${place(l.to)}`, detail: `${Math.max(1, Math.round(l.minutes))} min${l.km ? ` · ${Math.round(l.km * 1000)} m` : ''}${l.note ? ` · ${l.note}` : ''}` };
  if (l.mode === 'bus') return { title: `Bus ${l.service} to ${l.to.name}`, detail: `Board at ${l.from.name} · towards ${l.headsign} · ${l.stops} stops${l.alsoServices?.length ? ` · or bus ${l.alsoServices.join(', ')}` : ''}` };
  if (l.mode === 'shuttle') return { title: `Free bridging bus to ${l.to.name}`, detail: `From ${l.from.name} · follow station signs to the bridging bus stop` };
  return { title: `${l.lineName} to ${l.to.name}`, detail: `Board at ${l.from.name} · ride ${l.stops} stop${l.stops === 1 ? '' : 's'}, alight at ${l.to.name}` };
}

function LiveBus({ leg }: { leg: Leg }) {
  const { data } = useArrivals(leg.from.code);
  const svc = data?.services.find((s) => s.service === leg.service || leg.alsoServices?.includes(s.service));
  if (!data) return <p className="mt-2 text-[0.875rem] text-slate-400">Checking live arrivals…</p>;
  if (!svc) return <p className="mt-2 text-[0.875rem] text-amber-300">No live arrival for bus {leg.service} right now — check the stop display.</p>;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-500/10 px-3 py-2.5 ring-1 ring-emerald-500/30">
      <Radio size={18} className="text-emerald-300" />
      <div className="flex-1">
        <p className="text-[1.125rem] font-bold text-white">
          Bus {svc.service} {svc.buses[0].mins <= 0 ? 'arriving now' : `in ${svc.buses[0].mins} min`}
          {svc.buses[1] && <span className="text-[0.875rem] font-medium text-slate-300"> · then {svc.buses[1].mins} min</span>}
        </p>
        <LoadTag load={svc.buses[0].load} />
      </div>
    </div>
  );
}

export default function TripPage() {
  const { trip, alerts, set } = useStore();
  const nav = useNavigate();
  const online = useOnline();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const legs = trip?.option.legs ?? [];
  // Auto-advance by elapsed time (no GPS needed underground); the commuter can always step manually.
  const auto = useMemo(() => {
    if (!trip) return 0;
    let t = trip.startedAt;
    for (let i = 0; i < legs.length; i++) {
      t += legs[i].minutes * 60_000;
      if (now < t) return i;
    }
    return legs.length - 1;
  }, [trip, legs, now]);
  const step = Math.max(auto, trip?.step ?? 0);

  if (!trip)
    return (
      <div className="animate-rise pt-10 text-center">
        <Flag size={40} className="mx-auto text-slate-500" />
        <p className="mt-3 text-lg font-semibold">No trip in progress</p>
        <p className="mt-1 text-sm text-slate-400">Plan a journey and tap “I’ll take this” to get step-by-step guidance.</p>
        <Link to="/plan" className="mt-5 inline-flex h-12 items-center rounded-2xl bg-brand-500 px-6 font-semibold">
          Plan a journey
        </Link>
      </div>
    );

  const remaining = legs.slice(step);
  const remainingMin = remaining.reduce((a, l, i) => a + (i === 0 ? Math.max(0, l.minutes - Math.max(0, (now - trip.startedAt) / 60_000 - legs.slice(0, step).reduce((x, y) => x + y.minutes, 0))) : l.minutes), 0);
  const arriveLo = trip.startedAt + trip.option.min * 60_000;
  const arriveHi = trip.startedAt + trip.option.max * 60_000;
  // Re-check the rest of the journey against the live feed every time alerts refresh.
  const ahead = (alerts?.disruptions ?? []).find((d) => remaining.some((l) => l.mode === 'mrt' && l.line === d.line && (l.stations ?? []).some((s) => d.stations.includes(s))));
  const cur = legs[step];
  const ins = instruction(cur);
  const Icon = cur.mode === 'walk' ? Footprints : cur.mode === 'mrt' ? TrainFront : BusFront;
  const done = step >= legs.length - 1 && now > arriveLo;

  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between">
        <button onClick={() => nav(-1)} className="-ml-2 flex h-11 items-center gap-1 rounded-full px-2 text-sm text-slate-300 active:bg-white/10">
          <ChevronLeft size={20} /> Back
        </button>
        <button onClick={() => { set({ trip: null }); nav('/'); }} className="flex h-11 items-center gap-1 rounded-full px-3 text-sm text-slate-300 active:bg-white/10">
          <X size={16} /> End trip
        </button>
      </div>

      <Card className="p-4">
        <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-slate-400">On your way to</p>
        <p className="truncate text-[1.125rem] font-bold">{trip.to.name}</p>
        <div className="mt-2 flex items-end justify-between">
          <p className="text-[1.75rem] font-extrabold tabular-nums leading-none">
            {hhmm(arriveLo)}
            <span className="text-[1rem] font-semibold text-slate-400">–{hhmm(arriveHi)}</span>
          </p>
          <p className="text-right text-[0.8125rem] text-slate-300">~{Math.max(1, Math.round(remainingMin))} min left</p>
        </div>
        <div className="mt-3">
          <JourneyBar legs={legs} height={24} />
        </div>
        {!online && <p className="mt-2 text-[0.75rem] text-amber-300">No signal — following your saved plan; times are estimates.</p>}
      </Card>

      {ahead && (
        <div className="mt-3 rounded-2xl bg-red-500/15 p-4 ring-1 ring-red-500/40">
          <p className="flex items-center gap-2 font-bold text-white">
            <Siren size={18} className="text-red-400" /> Disruption ahead on your route
            {alerts?.simulated && <span className="rounded bg-amber-500 px-1 text-[0.5625rem] font-black text-black">SIM</span>}
          </p>
          <p className="mt-1 text-[0.875rem] text-red-100">
            {ahead.lineName}: {ahead.status === 2 ? 'no service' : 'delays'} {ahead.stations[0]}–{ahead.stations[ahead.stations.length - 1]}.
          </p>
          <button
            onClick={() => {
              set({ lastPlan: null });
              nav(`/plan?from=${encodeURIComponent(JSON.stringify(cur.from))}&to=${encodeURIComponent(JSON.stringify(trip.to))}`);
            }}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 font-bold"
          >
            <RotateCcw size={17} /> Re-plan from {cur.from.name}
          </button>
        </div>
      )}

      <section className="mt-3 rounded-3xl bg-surface-card/85 p-5 ring-2 ring-brand-400/60">
        <p className="text-[0.75rem] font-bold uppercase tracking-wider text-brand-300">
          {done ? 'Arriving' : `Now · step ${step + 1} of ${legs.length}`}
        </p>
        {done ? (
          <p className="mt-2 flex items-center gap-2 text-[1.5rem] font-extrabold">
            <CheckCircle2 className="text-emerald-400" /> You’re there
          </p>
        ) : (
          <>
            <div className="mt-2 flex items-start gap-3">
              <span className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                <Icon size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-[1.375rem] font-extrabold leading-tight">{ins.title}</p>
                <p className="mt-1 text-[0.9375rem] text-slate-300">{ins.detail}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {cur.mode === 'mrt' && <LineChip line={cur.line ?? ''} />}
              {cur.mode === 'bus' && <BusChip service={cur.service ?? ''} />}
              {cur.crowd && cur.crowd.level !== 'NA' && <CrowdTag level={cur.crowd.level} prefix="Platform: " />}
              {cur.delayMin ? <span className="text-[0.8125rem] text-amber-300">+{cur.delayMin} min delay</span> : null}
            </div>
            {cur.mode === 'bus' && cur.from.code && <LiveBus leg={cur} />}
          </>
        )}
      </section>

      {legs[step + 1] && (
        <p className="mt-3 flex items-center gap-2 px-1 text-[0.875rem] text-slate-300">
          <span className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-400">Then</span>
          <ArrowRight size={14} />
          <span className="truncate">{instruction(legs[step + 1]).title}</span>
        </p>
      )}

      <ol className="mt-4 space-y-1.5 border-l-2 border-white/10 pl-4">
        {legs.map((l, i) => (
          <li key={i} className={`text-[0.8125rem] ${i < step ? 'text-slate-500 line-through' : i === step ? 'font-semibold text-white' : 'text-slate-400'}`}>
            {instruction(l).title}
          </li>
        ))}
      </ol>

      {!done && step < legs.length - 1 && (
        <button
          onClick={() => set({ trip: { ...trip, step: step + 1 } })}
          className="sticky bottom-20 mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-500 text-[1.0625rem] font-bold shadow-xl shadow-black/40 active:bg-brand-700"
        >
          Done — next step <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
}
