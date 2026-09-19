import { Check, X } from 'lucide-react';
import { hhmm } from '@/lib/format';
import type { RouteOption } from '@/types';
import { JourneyBar } from './JourneyBar';

function Row({ label, o, departAt, win, dead }: { label: string; o: RouteOption; departAt: number; win: boolean; dead: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${win ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : 'bg-black/20 ring-1 ring-white/5'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-semibold text-white">
          {win ? <Check size={15} className="shrink-0 text-emerald-400" /> : dead ? <X size={15} className="shrink-0 text-red-400" /> : <span className="w-[15px]" />}
          <span className="shrink-0 text-slate-400">{label}</span>
          <span className="truncate">{o.summary}</span>
        </p>
        <p className={`shrink-0 text-[1rem] font-bold tabular-nums ${dead ? 'text-red-300' : win ? 'text-emerald-300' : 'text-slate-200'}`}>
          {dead ? 'Not running' : `${o.min}–${o.max} min`}
        </p>
      </div>
      <div className={`mt-2 ${dead ? 'opacity-50' : ''}`}>
        <JourneyBar legs={o.legs} height={22} />
      </div>
      {!dead && <p className="mt-1 text-right text-[0.6875rem] tabular-nums text-slate-400">arrive {hhmm(departAt + o.min * 60_000)}–{hhmm(departAt + o.max * 60_000)}</p>}
    </div>
  );
}

// The explicit "wait it out or reroute?" decision the brief asks for, shown as two comparable rows.
export function StayOrSwitch({ usual, best, departAt }: { usual: RouteOption; best: RouteOption; departAt: number }) {
  const dead = !usual.feasible;
  const switchWins = dead || best.max < usual.max || best.minutes < usual.minutes;
  const delta = Math.round(usual.minutes - best.minutes);
  return (
    <section className="rounded-2xl bg-surface-card/70 p-3 ring-1 ring-white/10">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[0.8125rem] font-bold uppercase tracking-wider text-slate-300">Stay or switch?</h2>
        <p className={`text-[0.8125rem] font-semibold ${switchWins ? 'text-emerald-300' : 'text-amber-300'}`}>
          {dead ? 'Your usual route is cut' : switchWins ? `Switching saves ~${Math.max(1, delta)} min` : `Staying is ${Math.abs(delta)} min faster`}
        </p>
      </div>
      <div className="space-y-2">
        <Row label="Stay" o={usual} departAt={departAt} win={!switchWins} dead={dead} />
        <Row label="Switch" o={best} departAt={departAt} win={switchWins} dead={false} />
      </div>
    </section>
  );
}
