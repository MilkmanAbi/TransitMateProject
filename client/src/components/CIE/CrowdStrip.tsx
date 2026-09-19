import { Users } from 'lucide-react';
import { Bars } from '@/components/ui';
import { clock12, CROWD_META, hhmm } from '@/lib/format';
import type { CrowdLevel } from '@/types';

const FILL: Record<CrowdLevel, string> = { l: 'bg-emerald-500/85', m: 'bg-amber-500/90', h: 'bg-red-500/90', NA: 'bg-slate-600/60' };
const RANK: Record<CrowdLevel, number> = { l: 0, m: 1, h: 2, NA: 3 };

// LTA's 30-minute Station Crowd Density forecast for the boarding platform around departure time —
// the one input that lets the app say "leave 20 min later" before anything has gone wrong.
export function CrowdStrip({ data, when = 'when you board' }: { data: { station: string; boardAt: number; slots: { start: number; level: CrowdLevel }[] }; when?: string }) {
  const { slots, boardAt, station } = data;
  if (slots.length < 3) return null;
  const curIdx = slots.reduce((acc, s, i) => (s.start <= boardAt ? i : acc), 0);
  const cur = slots[curIdx];
  const better = slots
    .filter((s) => s.start > Date.now() - 30 * 60_000 && RANK[s.level] < RANK[cur.level])
    .sort((a, b) => Math.abs(a.start - boardAt) - Math.abs(b.start - boardAt))[0];
  const verdict =
    cur.level === 'NA'
      ? 'No forecast for this slot'
      : better
        ? `${CROWD_META[cur.level].label} ${when} · ${CROWD_META[better.level].label.toLowerCase()} at ${clock12(better.start)}`
        : `${CROWD_META[cur.level].label} ${when}${cur.level === 'l' && when === 'when you board' ? ' — no need to shift' : ''}`;
  return (
    <section className="mt-3 rounded-2xl bg-surface-card/60 p-3.5 ring-1 ring-white/[0.07]">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-white">
          <Users size={15} className="text-slate-300" /> {station} platform
        </p>
        <span className="text-[0.6875rem] text-slate-400">LTA crowd forecast</span>
      </div>
      <p className={`mt-0.5 text-[0.8125rem] ${CROWD_META[cur.level].cls}`}>{verdict}</p>
      <div className="mt-2.5 flex gap-1" role="img" aria-label={slots.map((s) => `${hhmm(s.start)} ${CROWD_META[s.level].label}`).join(', ')}>
        {slots.map((s, i) => (
          <div key={s.start} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className={`flex h-9 w-full items-end justify-center rounded-md pb-1 ${FILL[s.level]} ${i === curIdx ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-card' : ''} ${better && s.start === better.start ? 'ring-2 ring-emerald-300' : ''}`}>
              <Bars n={CROWD_META[s.level].bars} cls="text-white" />
            </div>
            <span className={`text-[0.625rem] tabular-nums ${i === curIdx ? 'font-bold text-white' : 'text-slate-400'}`}>{i % 2 === curIdx % 2 ? hhmm(s.start) : ''}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
