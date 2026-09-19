import { CheckCircle2, ChevronDown, CloudRain, CloudSun, Footprints, Leaf, RefreshCw, Siren, TriangleAlert, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrivalPanel } from '@/components/Arrivals/ArrivalPanel';
import { AlertFeed } from '@/components/CIE/AlertFeed';
import { CrowdStrip } from '@/components/CIE/CrowdStrip';
import { JourneyBar } from '@/components/Journey/JourneyBar';
import { SettingsSheet } from '@/components/Layout/SettingsSheet';
import { Bars, SectionTitle, Skeleton } from '@/components/ui';
import { type DepartMode, useCommute } from '@/hooks/useCommute';
import { monthSaved } from '@/lib/co2';
import { ago, CROWD_META, hhmm, todayAt } from '@/lib/format';
import { PERSONAS, useStore } from '@/store/useStore';

const TONE = {
  act: { ring: 'ring-red-500/60', glow: 'from-red-600/35 via-red-900/10', icon: Siren, iconCls: 'text-red-400 tm-wiggle', badge: 'bg-red-500 text-white', label: 'Act now', anim: 'tm-act' },
  'heads-up': { ring: 'ring-amber-500/45', glow: 'from-amber-500/25 via-amber-900/5', icon: TriangleAlert, iconCls: 'text-amber-400', badge: 'bg-amber-400 text-black', label: 'Heads-up', anim: 'tm-verdict' },
  clear: { ring: 'ring-emerald-500/35', glow: 'from-emerald-500/20 via-emerald-900/5', icon: CheckCircle2, iconCls: 'text-emerald-400', badge: 'bg-emerald-400 text-black', label: 'All clear', anim: 'tm-verdict' },
};

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[0.75rem] text-slate-200">
      {icon}
      {children}
    </span>
  );
}

export default function Home() {
  const { savedStops, profile, commute, weather, alerts, notify, onboarded, set, trip } = useStore();
  const [mode, setMode] = useState<DepartMode>('auto');
  const [settings, setSettings] = useState(false);
  const { plan, cie, dep, crowdSlots, loading, updatedAt, stale, refresh } = useCommute(mode);
  const persona = PERSONAS.find((p) => p.id === profile)!;
  const best = cie.hero ?? plan?.options[0];
  const tone = TONE[cie.verdict];
  const leaveBy = best && plan ? todayAt(commute.arriveBy, plan.departAt) - best.max * 60_000 : null;
  const saved = monthSaved();
  const boardCrowd = best?.legs.find((l) => l.mode === 'mrt')?.crowd;
  const lastNotified = useRef<string | null>(null);
  const usualLive = plan?.usualLive;
  // The reroute is already the hero; repeating it as a card is noise.
  const feed = cie.cards.filter((c) => c.id !== 'reroute');
  const showStay = cie.verdict === 'act' && usualLive && best && usualLive.signature !== best.signature;

  // A local notification (not Web Push) the moment the verdict turns red for a new reason.
  useEffect(() => {
    const key = cie.verdict === 'act' && best ? `${best.signature}|${plan?.why[0] ?? ''}` : null;
    if (!key || !notify || key === lastNotified.current || !('Notification' in window) || Notification.permission !== 'granted') return;
    lastNotified.current = key;
    const body = `${cie.sub}${plan?.simulated ? ' (simulated disruption)' : ''}`;
    const opts = { body, tag: 'tm-commute', icon: '/icon.svg' };
    const fallback = () => void new Notification(cie.headline, opts);
    if (!navigator.serviceWorker) return fallback();
    navigator.serviceWorker.getRegistration().then((reg) => (reg ? reg.showNotification(cie.headline, opts) : fallback())).catch(fallback);
  }, [cie.verdict, cie.headline, cie.sub, best, plan, notify]);

  return (
    <div className="animate-rise">
      <div className="flex items-center justify-between pt-1">
        <span className="flex items-center gap-2">
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          <span className="text-[1.0625rem] font-extrabold tracking-tight">
            Transit<span className="text-brand-400">Mate</span>
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[0.6875rem] text-slate-400">
          <span className={`h-2 w-2 rounded-full ${alerts && !stale ? 'bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400' : 'bg-slate-500'}`} />
          {alerts && !stale ? `Live · LTA ${ago(alerts.fetchedAt)}` : 'Saved data'}
        </span>
      </div>

      <header className="mt-2 flex items-center justify-between gap-2">
        <button onClick={() => setSettings(true)} className="-ml-1 flex min-h-[44px] items-center gap-2 rounded-full py-1 pl-1 pr-3 active:bg-white/5" aria-label="Change persona and commute">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 text-sm font-bold">{persona.name[0]}</span>
          <span className="text-left leading-tight">
            <span className="block text-[0.75rem] text-slate-400">Planning for</span>
            <span className="flex items-center gap-0.5 font-semibold">
              {persona.name} <ChevronDown size={14} />
            </span>
          </span>
        </button>
        {weather && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.75rem] font-medium ${weather.wet ? 'bg-cyan-500/15 text-cyan-200' : 'bg-white/5 text-slate-300'}`}>
            {weather.wet ? <CloudRain size={15} /> : <CloudSun size={15} />}
            {weather.forecast} · {weather.area}
          </span>
        )}
      </header>

      {trip && (
        <Link to="/trip" className="mt-3 flex items-center gap-3 rounded-2xl bg-brand-500 px-4 py-3 font-semibold text-white shadow-lg shadow-brand-900/40">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" /></span>
          <span className="flex-1 truncate text-[0.875rem]">Trip in progress · {trip.option.summary} to {trip.to.name.replace(/^(Office|Work|Home) · /, '')}</span>
          <span className="text-[0.8125rem]">Resume →</span>
        </Link>
      )}
      {!onboarded && (
        <button onClick={() => { setSettings(true); set({ onboarded: true }); }} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-brand-500/10 px-4 py-3 text-left ring-1 ring-brand-400/30">
          <span className="flex-1 text-[0.8125rem] leading-snug text-brand-50">
            <b className="text-white">Demo: planning for Rachel</b>, Tampines → Raffles Place on the EWL. Tap to switch persona or set your own home, work and times.
          </span>
          <ChevronDown size={16} className="-rotate-90 text-brand-300" />
        </button>
      )}

      <section key={cie.verdict} className={`relative mt-3 overflow-hidden rounded-3xl bg-surface-card/85 p-4 ring-1 ${tone.ring} ${plan ? tone.anim : ''}`}>
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow} to-transparent`} />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            {plan ? <span className={`rounded-full px-2.5 py-0.5 text-[0.6875rem] font-black uppercase tracking-wider ${tone.badge}`}>{tone.label}</span> : <span />}
            <span className="truncate text-[0.75rem] font-medium text-slate-300">{dep.scheduled ? `Your ${commute.departTime} commute · ${dep.label}` : 'If you left now'}</span>
          </div>
          <p className="mt-2 truncate text-[0.8125rem] text-slate-400">
            {commute.from.name.replace(/^Home · /, '')} → {commute.to.name.replace(/^(Office|Work) · /, '')}
          </p>
          {!plan ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-7" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <>
              <div className="mt-1 flex items-start gap-2">
                <tone.icon size={28} className={`mt-0.5 shrink-0 ${tone.iconCls}`} />
                <h1 className="text-[1.5rem] font-extrabold leading-tight tracking-tight text-white">{cie.headline}</h1>
              </div>
              <p className="mt-1.5 text-[0.875rem] leading-snug text-slate-200">{cie.sub}</p>
              {cie.verdict === 'act' && plan.why[0] && (
                <p className="mt-1.5 text-[0.8125rem] leading-snug text-red-200/90">
                  <b className="font-semibold text-red-300">Why: </b>
                  {plan.why[0]}
                  {plan.simulated && <span className="ml-1 rounded bg-amber-500 px-1 py-px align-middle text-[0.5625rem] font-black tracking-wider text-black">SIM</span>}
                </p>
              )}
              {best && (
                <>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Arrive</p>
                      <p className="text-[1.75rem] font-extrabold tabular-nums leading-none text-white">
                        {hhmm(plan.departAt + best.min * 60_000)}
                        <span className="text-[1rem] font-semibold text-slate-400">–{hhmm(plan.departAt + best.max * 60_000)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Door to door</p>
                      <p className="text-[1.125rem] font-bold tabular-nums text-white">
                        {best.min}–{best.max} <span className="text-[0.8125rem] font-medium text-slate-400">min</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <JourneyBar legs={best.legs} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {dep.scheduled && leaveBy && (
                      <Meta icon={<span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}>
                        Leave by <b className="tabular-nums">{hhmm(leaveBy)}</b> for {commute.arriveBy}
                      </Meta>
                    )}
                    {boardCrowd && boardCrowd.level !== 'NA' && (
                      <Meta icon={<Bars n={CROWD_META[boardCrowd.level].bars} cls={CROWD_META[boardCrowd.level].cls} />}>
                        {best.legs.find((l) => l.mode === 'mrt')?.from.name} {CROWD_META[boardCrowd.level].label.toLowerCase()}
                      </Meta>
                    )}
                    <Meta icon={<Footprints size={13} />}>{best.walkMin} min walk</Meta>
                    {best.transfers > 0 && <Meta icon={<Users size={13} />}>{best.transfers} transfer{best.transfers > 1 ? 's' : ''}</Meta>}
                  </div>
                  {showStay && usualLive && (
                    <p className="mt-2.5 rounded-xl bg-black/25 px-3 py-2 text-[0.8125rem] text-slate-300">
                      Staying on {usualLive.summary.replace(/ → Bridging bus → /, ' + bridging bus + ')}:{' '}
                      {usualLive.feasible ? (
                        <b className="tabular-nums text-red-300">
                          {usualLive.min}–{usualLive.max} min
                        </b>
                      ) : (
                        <b className="text-red-300">not running</b>
                      )}
                      {usualLive.feasible && best && <span className="text-emerald-300"> · switching saves ~{Math.max(0, Math.round(usualLive.minutes - best.minutes))} min</span>}
                    </p>
                  )}
                </>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex rounded-full bg-black/30 p-0.5 text-[0.75rem]" role="group" aria-label="When to plan for">
                  {(['now', 'usual'] as const).map((m) => {
                    const active = mode === m || (mode === 'auto' && (m === 'usual') === dep.scheduled);
                    return (
                      <button key={m} onClick={() => setMode(m)} aria-pressed={active} className={`h-11 rounded-full px-3.5 font-semibold ${active ? 'bg-white/15 text-white' : 'text-slate-400'}`}>
                        {m === 'now' ? 'Leave now' : `At ${commute.departTime}`}
                      </button>
                    );
                  })}
                </div>
                <button onClick={refresh} className="flex h-11 items-center gap-1 rounded-full px-2 text-[0.6875rem] text-slate-400 active:bg-white/10" aria-label="Refresh">
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  {stale ? 'saved ' : ''}
                  {updatedAt ? ago(updatedAt) : ''}
                </button>
              </div>
            </>
          )}
        </div>
        {plan && (
          <Link
            to="/plan?commute=1"
            className={`relative mt-2 flex h-12 items-center justify-center rounded-2xl text-[0.9375rem] font-bold text-white ${cie.verdict === 'act' ? 'bg-red-600 active:bg-red-700' : 'bg-brand-500 active:bg-brand-700'}`}
          >
            {cie.verdict === 'act' ? 'Show me the new route' : 'View route & map'}
          </Link>
        )}
      </section>

      {crowdSlots && <CrowdStrip data={crowdSlots} />}

      <SectionTitle right={<span className="text-[0.6875rem] text-slate-400">Commuter Intelligence</span>}>For you</SectionTitle>
      {feed.length === 0 && plan && (
        <p className="mb-2 rounded-2xl bg-emerald-500/5 px-4 py-3 text-[0.8125rem] text-emerald-200/90 ring-1 ring-emerald-500/15">
          {cie.verdict === 'act' ? 'Nothing else needs you — the card above is the one action to take.' : 'Nothing on your route needs you right now. TransitMate is watching train alerts, crowding and rain in the background.'}
        </p>
      )}
      <AlertFeed cards={feed} quiet={cie.quiet} />

      <SectionTitle right={<Link to="/map" className="text-[0.75rem] text-brand-400">Find stops</Link>}>Your stops</SectionTitle>
      <div className="space-y-3">
        {savedStops.map((c) => (
          <ArrivalPanel key={c} code={c} compact limit={4} />
        ))}
      </div>

      {saved.trips > 0 && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-[0.75rem] text-emerald-400/80">
          <Leaf size={13} /> {saved.kg.toFixed(1)} kg CO₂ saved vs taxi this month · {saved.trips} trips
        </p>
      )}
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
