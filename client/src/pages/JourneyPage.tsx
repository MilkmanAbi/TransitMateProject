import { ArrowDownUp, Clock, Info, Pencil, Search, Siren, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/api/datamall';
import { LegStrip } from '@/components/Journey/LegStrip';
import { PlaceInput } from '@/components/Journey/PlaceInput';
import { RouteCard } from '@/components/Journey/RouteCard';
import { RouteMap } from '@/components/Map/RouteMap';
import { Card, Pill, SectionTitle, Skeleton } from '@/components/ui';
import { departureFor } from '@/hooks/useCommute';
import { ago, hhmm, todayAt } from '@/lib/format';
import { useStore } from '@/store/useStore';
import type { Place, PlanResult } from '@/types';

export default function JourneyPage() {
  const [params] = useSearchParams();
  const { commute, profile, scenario, lastPlan, set, toast } = useStore();
  const isCommute = params.get('commute') === '1';
  const [from, setFrom] = useState<Place | null>(isCommute ? commute.from : (lastPlan?.from ?? commute.from));
  const [to, setTo] = useState<Place | null>(isCommute ? commute.to : (lastPlan?.to ?? null));
  const [when, setWhen] = useState<string>('now');
  const [plan, setPlan] = useState<PlanResult | null>(isCommute ? null : lastPlan);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(!plan);

  const run = async (f = from, t = to) => {
    if (!f || !t) return toast('Choose where you’re starting and going', 'info');
    setLoading(true);
    setEditing(false);
    try {
      const departAt = when === 'now' ? undefined : todayAt(when) < Date.now() ? todayAt(when) + 86_400_000 : todayAt(when);
      const p = await api.plan(f, t, { departAt, profile, scenario });
      setPlan(p);
      setSel(0);
      set({ lastPlan: p });
    } catch (e) {
      toast((e as Error).message);
      if (!plan) setEditing(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isCommute) {
      const dep = departureFor(commute.departTime, commute.days, 'auto');
      if (dep.scheduled) setWhen(commute.departTime);
      run(commute.from, commute.to);
    } else if (plan && Date.now() - plan.generatedAt > 90_000 && navigator.onLine) run(plan.from, plan.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCommute, scenario, profile]);

  const option = plan?.options[sel] ?? null;
  const showUsual = plan && plan.usualLive && plan.usual && plan.options[0] && plan.usual.signature !== plan.options[sel]?.signature;

  return (
    <div className="animate-rise">
      {editing || !plan ? (
        <Card className="relative p-3">
          <div className="relative space-y-2">
            <PlaceInput label="From — address, place or station" value={from} onChange={setFrom} dot="bg-brand-500" />
            <PlaceInput label="To — where are you going?" value={to} onChange={setTo} dot="bg-pink-600" />
            <button
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              className="absolute right-3 top-[38px] z-10 grid h-9 w-9 place-items-center rounded-full bg-surface-raised ring-1 ring-white/10"
              aria-label="Swap origin and destination"
            >
              <ArrowDownUp size={16} />
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <label className="flex h-12 flex-1 items-center gap-2 rounded-xl bg-black/25 px-3 ring-1 ring-white/10">
              <Clock size={16} className="text-slate-400" />
              <select value={when === 'now' ? 'now' : 'at'} onChange={(e) => setWhen(e.target.value === 'now' ? 'now' : commute.departTime)} className="bg-transparent text-[15px] focus:outline-none">
                <option value="now">Leave now</option>
                <option value="at">Leave at…</option>
              </select>
              {when !== 'now' && <input type="time" value={when} onChange={(e) => setWhen(e.target.value)} className="ml-auto bg-transparent text-[15px] focus:outline-none" />}
            </label>
            <button onClick={() => run()} disabled={loading} className="flex h-12 items-center gap-2 rounded-xl bg-brand-500 px-5 font-semibold text-white active:bg-brand-700 disabled:opacity-60">
              <Search size={17} /> Plan
            </button>
          </div>
        </Card>
      ) : (
        <button onClick={() => setEditing(true)} className="flex w-full items-center gap-3 rounded-2xl bg-surface-card/70 px-4 py-3 text-left ring-1 ring-white/10">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-white">
              {plan.from.name} → {plan.to.name}
            </p>
            <p className="text-[12px] text-slate-400">
              {Math.abs(plan.departAt - plan.generatedAt) < 120_000 ? 'Leaving now' : `Leaving ${hhmm(plan.departAt)}`} · planned {ago(plan.generatedAt)}
            </p>
          </div>
          <Pencil size={16} className="text-slate-400" />
        </button>
      )}

      {loading && !plan && (
        <div className="mt-3 space-y-3">
          <Skeleton className="h-[38dvh]" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      )}

      {plan && (
        <div className={`mt-3 space-y-3 ${loading ? 'opacity-60' : ''}`}>
          {plan.why.length > 0 && (
            <section className={`rounded-2xl p-3.5 ring-1 ${plan.changed ? 'bg-red-500/10 ring-red-500/30' : 'bg-amber-500/10 ring-amber-500/25'}`}>
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
                {plan.changed ? <Siren size={17} className="text-red-400" /> : <TriangleAlert size={17} className="text-amber-400" />}
                {plan.changed ? 'Route changed — here’s why' : 'Live conditions on this trip'}
                {plan.simulated && <Pill tone="amber">SIMULATED</Pill>}
              </h2>
              <ul className="mt-1.5 space-y-1 pl-6 text-[13px] leading-relaxed text-slate-200">
                {plan.why.map((w, i) => (
                  <li key={i} className="list-disc">
                    {w}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <RouteMap option={option} usual={showUsual ? plan.usualLive : null} from={plan.from} to={plan.to} />

          {showUsual && plan.usualLive && (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium uppercase tracking-wide text-slate-500">Your usual route today</p>
                <div className="mt-1">
                  <LegStrip legs={plan.usualLive.legs} dim />
                </div>
              </div>
              <div className="text-right">
                {plan.usualLive.feasible ? (
                  <>
                    <p className="text-[18px] font-bold tabular-nums text-slate-300">{plan.usualLive.minutes} min</p>
                    <p className="text-[12px] text-amber-300">+{Math.max(0, plan.usualLive.minutes - (plan.usual?.minutes ?? 0))} vs normal</p>
                  </>
                ) : (
                  <Pill tone="red">Not running</Pill>
                )}
              </div>
            </div>
          )}

          <SectionTitle right={<span className="text-[11px] text-slate-500">ranked for {profile === 'lim' ? 'Mdm Lim' : profile[0].toUpperCase() + profile.slice(1)}</span>}>Options</SectionTitle>
          {plan.options.length === 0 && <p className="text-sm text-slate-400">No route found. Try a nearby landmark or station.</p>}
          <div className="space-y-3">
            {plan.options.map((o, i) => (
              <RouteCard key={o.id} o={o} index={i} selected={i === sel} onSelect={() => setSel(i)} departAt={plan.departAt} />
            ))}
          </div>

          <p className="flex gap-2 px-1 pt-2 text-[11px] leading-relaxed text-slate-500">
            <Info size={14} className="shrink-0" />
            Times are ranges, not promises: train waits use typical headways, bus waits use live LTA arrivals when you’re leaving within 45 min, and ride times carry ±10–35% spread. Walking legs are routed on OpenStreetMap footpaths.
          </p>
        </div>
      )}
    </div>
  );
}
