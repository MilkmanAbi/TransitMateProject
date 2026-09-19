import { AlertOctagon, ArrowUpDown, CalendarClock, ChevronDown, CloudRain, Leaf, Sun, TrainFront, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ago } from '@/lib/format';
import type { CIERecommendation } from '@/types';

const SEV = {
  critical: { bar: 'bg-alert-critical', icon: 'text-red-400', ring: 'ring-red-500/25' },
  warning: { bar: 'bg-alert-warning', icon: 'text-amber-400', ring: 'ring-amber-500/20' },
  info: { bar: 'bg-alert-info', icon: 'text-cyan-400', ring: 'ring-cyan-500/15' },
  ok: { bar: 'bg-alert-ok', icon: 'text-emerald-400', ring: 'ring-emerald-500/15' },
};
const ICON = {
  disruption: AlertOctagon,
  network: TrainFront,
  crowding: Users,
  weather: CloudRain,
  planned: CalendarClock,
  lift: ArrowUpDown,
  leave: CalendarClock,
};

export function CIECard({ r }: { r: CIERecommendation }) {
  const s = SEV[r.severity];
  const Icon = r.kind === 'weather' && r.severity === 'ok' ? Sun : ICON[r.kind];
  return (
    <article className={`relative animate-rise overflow-hidden rounded-2xl bg-surface-card/80 ring-1 ${s.ring}`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${s.bar}`} />
      <div className="py-3 pl-5 pr-4">
        <div className="flex items-start gap-2.5">
          <Icon size={18} className={`mt-0.5 shrink-0 ${s.icon}`} />
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.875rem] font-semibold leading-snug text-white">
              {r.simulated && <span className="mr-1.5 rounded bg-amber-500 px-1 py-px align-middle text-[0.5625rem] font-black tracking-wider text-black">SIM</span>}
              {r.title}
            </h3>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-slate-300">{r.body}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 pl-7">
          <span className="flex items-center gap-2 text-[0.6875rem] text-slate-500">
            {ago(r.timestamp)}
            {r.co2Delta ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-400/90">
                <Leaf size={11} /> saves {r.co2Delta.toFixed(1)} kg CO₂ vs taxi
              </span>
            ) : null}
          </span>
          {r.action && (
            <Link to={r.action.route} className="-my-2 rounded-full px-3 py-2 text-[0.8125rem] font-semibold text-brand-400 active:bg-white/5">
              {r.action.label} →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function AlertFeed({ cards, quiet }: { cards: CIERecommendation[]; quiet: CIERecommendation[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2.5">
      {cards.map((r) => (
        <CIECard key={r.id} r={r} />
      ))}
      {quiet.length > 0 && (
        <div className="rounded-2xl border border-dashed border-white/10">
          <button onClick={() => setOpen(!open)} className="flex min-h-[48px] w-full items-center gap-2 px-4 text-left text-[0.8125rem] text-slate-400">
            <span className="flex-1">
              {quiet.length} other {quiet.length === 1 ? 'notice' : 'notices'} checked — {cards.length ? 'lower priority' : 'none need you'}
            </span>
            <ChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="space-y-2 px-2 pb-2">
              {quiet.map((r) => (
                <CIECard key={r.id} r={r} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
