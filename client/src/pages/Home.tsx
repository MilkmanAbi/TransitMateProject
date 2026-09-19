import { CheckCircle2, ChevronDown, CloudRain, CloudSun, Leaf, RefreshCw, Siren, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrivalPanel } from '@/components/Arrivals/ArrivalPanel';
import { AlertFeed } from '@/components/CIE/AlertFeed';
import { LegStrip } from '@/components/Journey/LegStrip';
import { SettingsSheet } from '@/components/Layout/SettingsSheet';
import { Bars, SectionTitle, Skeleton } from '@/components/ui';
import { type DepartMode, useCommute } from '@/hooks/useCommute';
import { monthSaved } from '@/lib/co2';
import { ago, CROWD_META, hhmm, todayAt } from '@/lib/format';
import { PERSONAS, useStore } from '@/store/useStore';

const TONE = {
  act: { ring: 'ring-red-500/50', glow: 'from-red-600/30', icon: Siren, iconCls: 'text-red-400', label: 'Action needed' },
  'heads-up': { ring: 'ring-amber-500/40', glow: 'from-amber-500/20', icon: TriangleAlert, iconCls: 'text-amber-400', label: 'Heads-up' },
  clear: { ring: 'ring-emerald-500/30', glow: 'from-emerald-500/15', icon: CheckCircle2, iconCls: 'text-emerald-400', label: 'All clear' },
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-[17px] font-bold tabular-nums leading-tight text-white">{value}</p>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Home() {
  const { savedStops, profile, commute, weather } = useStore();
  const [mode, setMode] = useState<DepartMode>('auto');
  const [settings, setSettings] = useState(false);
  const { plan, cie, dep, loading, updatedAt, stale, refresh } = useCommute(mode);
  const persona = PERSONAS.find((p) => p.id === profile)!;
  const best = cie.hero ?? plan?.options[0];
  const tone = TONE[cie.verdict];
  const leaveBy = best ? todayAt(commute.arriveBy, plan!.departAt) - best.max * 60_000 : null;
  const saved = monthSaved();
  const boardCrowd = best?.legs.find((l) => l.mode === 'mrt')?.crowd;

  return (
    <div className="animate-rise">
      <header className="flex items-center justify-between gap-2 pt-1">
        <button onClick={() => setSettings(true)} className="-ml-1 flex min-h-[44px] items-center gap-2 rounded-full py-1 pl-1 pr-3 active:bg-white/5">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 text-sm font-bold">{persona.name[0]}</span>
          <span className="text-left leading-tight">
            <span className="block text-[12px] text-slate-400">Planning for</span>
            <span className="flex items-center gap-0.5 font-semibold">
              {persona.name} <ChevronDown size={14} />
            </span>
          </span>
        </button>
        {weather && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium ${weather.wet ? 'bg-cyan-500/15 text-cyan-200' : 'bg-white/5 text-slate-300'}`}>
            {weather.wet ? <CloudRain size={15} /> : <CloudSun size={15} />}
            {weather.forecast} · {weather.area}
          </span>
        )}
      </header>

      <section className={`relative mt-3 overflow-hidden rounded-3xl bg-surface-card/80 p-4 ring-1 ${tone.ring}`}>
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow} to-transparent`} />
        <div className="relative">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            {dep.scheduled ? `Your ${commute.departTime} commute · ${dep.label}` : 'Your commute, if you left now'}
          </p>
          <p className="truncate text-[13px] text-slate-400">
            {commute.from.name.replace(/^Home · /, '')} → {commute.to.name.replace(/^(Office|Work) · /, '')}
          </p>
          {!plan ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <>
              <div className="mt-2 flex items-start gap-2">
                <tone.icon size={26} className={`mt-0.5 shrink-0 ${tone.iconCls}`} />
                <h1 className="text-[22px] font-bold leading-tight text-white">{cie.headline}</h1>
              </div>
              <p className="mt-1.5 text-[14px] leading-snug text-slate-300">{cie.sub}</p>
              {best && (
                <>
                  <div className="mt-3">
                    <LegStrip legs={best.legs} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {dep.scheduled ? (
                      <Stat label="Leave by" value={leaveBy ? hhmm(leaveBy) : '—'} sub={<span className="text-[11px] text-slate-400">to make {commute.arriveBy}</span>} />
                    ) : (
                      <Stat label="Depart" value={hhmm(plan.departAt)} sub={<span className="text-[11px] text-slate-400">now</span>} />
                    )}
                    <Stat label="Arrive" value={`${hhmm(plan.departAt + best.min * 60_000)}`} sub={<span className="text-[11px] text-slate-400">latest {hhmm(plan.departAt + best.max * 60_000)}</span>} />
                    <Stat
                      label="Platform"
                      value={boardCrowd ? ({ h: 'Crowded', m: 'Moderate', l: 'Quiet', NA: '—' } as const)[boardCrowd.level] : '—'}
                      sub={boardCrowd && <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Bars n={CROWD_META[boardCrowd.level].bars} cls={CROWD_META[boardCrowd.level].cls} />{boardCrowd.source === 'forecast' ? 'forecast' : 'live'}</span>}
                    />
                  </div>
                </>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex rounded-full bg-black/25 p-0.5 text-[12px]">
                  {(['now', 'usual'] as const).map((m) => {
                    const active = mode === m || (mode === 'auto' && (m === 'usual') === dep.scheduled);
                    return (
                      <button key={m} onClick={() => setMode(m)} className={`h-11 rounded-full px-3.5 font-medium ${active ? 'bg-white/15 text-white' : 'text-slate-400'}`}>
                        {m === 'now' ? 'Leave now' : `At ${commute.departTime}`}
                      </button>
                    );
                  })}
                </div>
                <button onClick={refresh} className="flex h-11 items-center gap-1 rounded-full px-2 text-[11px] text-slate-400 active:bg-white/10" aria-label="Refresh">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  {stale ? 'saved ' : ''}
                  {updatedAt ? ago(updatedAt) : ''}
                </button>
              </div>
            </>
          )}
        </div>
        {plan && (
          <Link to="/plan?commute=1" className="relative mt-3 flex h-12 items-center justify-center rounded-2xl bg-brand-500 text-[15px] font-semibold text-white active:bg-brand-700">
            {cie.verdict === 'act' ? 'Show me the new route' : 'View route & map'}
          </Link>
        )}
      </section>

      <SectionTitle right={<span className="text-[11px] text-slate-500">Commuter Intelligence</span>}>For you</SectionTitle>
      {cie.cards.length === 0 && plan && (
        <p className="mb-2 rounded-2xl bg-emerald-500/5 px-4 py-3 text-[13px] text-emerald-200/90 ring-1 ring-emerald-500/15">
          Nothing on your route needs you right now. TransitMate is watching train alerts, crowding and rain in the background.
        </p>
      )}
      <AlertFeed cards={cie.cards} quiet={cie.quiet} />

      <SectionTitle right={<Link to="/map" className="text-[12px] text-brand-400">Find stops</Link>}>Your stops</SectionTitle>
      <div className="space-y-3">
        {savedStops.map((c) => (
          <ArrivalPanel key={c} code={c} compact limit={4} />
        ))}
      </div>

      {saved.trips > 0 && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-emerald-400/80">
          <Leaf size={13} /> {saved.kg.toFixed(1)} kg CO₂ saved vs taxi this month · {saved.trips} trips
        </p>
      )}
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
