import { BusFront, Footprints, TrainFront } from 'lucide-react';
import { LINE_META } from '@/lib/format';
import type { Leg } from '@/types';

interface Seg {
  kind: 'walk' | 'wait' | 'ride';
  min: number;
  color: string;
  label: string;
  leg: Leg;
}

function segments(legs: Leg[]): Seg[] {
  const out: Seg[] = [];
  for (const l of legs) {
    if (l.mode === 'walk') {
      out.push({ kind: 'walk', min: l.minutes, color: '#475569', label: `${Math.max(1, Math.round(l.minutes))}`, leg: l });
      continue;
    }
    const color = l.blocked ? '#dc2626' : l.mode === 'bus' ? '#059669' : l.mode === 'shuttle' ? '#d97706' : (l.color ?? LINE_META[l.line ?? '']?.color ?? '#2563eb');
    if (l.waitMin >= 0.5) out.push({ kind: 'wait', min: l.waitMin, color, label: '', leg: l });
    const ride = Math.max(0.5, l.minutes - l.waitMin);
    const name = l.mode === 'bus' ? l.service ?? '' : l.mode === 'shuttle' ? 'Bridge' : (LINE_META[l.line ?? '']?.short ?? l.line ?? '');
    out.push({ kind: 'ride', min: ride, color, label: `${name} ${Math.round(ride)}′`, leg: l });
  }
  return out;
}

// Proportional door-to-door timeline: walking (grey), waiting (hatched), riding (line colour).
// Each segment also carries an icon/label, so the bar never relies on colour alone.
export function JourneyBar({ legs, height = 30 }: { legs: Leg[]; height?: number }) {
  const segs = segments(legs);
  const total = segs.reduce((a, s) => a + s.min, 0) || 1;
  return (
    <div className="flex w-full gap-[2px] overflow-hidden rounded-lg" style={{ height }} role="img" aria-label={legs.map((l) => (l.mode === 'walk' ? `walk ${Math.round(l.minutes)} min` : `${l.mode === 'bus' ? `bus ${l.service}` : l.lineName} ${Math.round(l.minutes)} min`)).join(', then ')}>
      {segs.map((s, i) => {
        const pct = (s.min / total) * 100;
        const narrow = pct < 11;
        const style: React.CSSProperties = { flexGrow: s.min, flexBasis: 0, minWidth: s.kind === 'wait' ? 6 : 18 };
        if (s.kind === 'walk')
          return (
            <div key={i} className="flex items-center justify-center gap-0.5 bg-slate-600/70 text-[0.6875rem] font-semibold text-slate-100" style={style}>
              <Footprints size={12} />
              {!narrow && s.label}
            </div>
          );
        if (s.kind === 'wait')
          return (
            <div
              key={i}
              className="opacity-70"
              title={`wait ~${Math.round(s.min)} min`}
              style={{ ...style, background: `repeating-linear-gradient(-45deg, ${s.color} 0 3px, transparent 3px 7px)` }}
            />
          );
        const Icon = s.leg.mode === 'bus' || s.leg.mode === 'shuttle' ? BusFront : TrainFront;
        return (
          <div
            key={i}
            className={`relative flex items-center justify-center gap-1 overflow-hidden whitespace-nowrap px-1 text-[0.75rem] font-bold text-white ${s.leg.blocked ? 'line-through' : ''}`}
            style={{ ...style, background: s.color, backgroundImage: s.leg.mode === 'shuttle' ? 'repeating-linear-gradient(90deg, transparent 0 8px, rgba(0,0,0,.18) 8px 12px)' : undefined }}
          >
            <Icon size={13} className="shrink-0" />
            {!narrow && <span className="truncate">{s.label}</span>}
          </div>
        );
      })}
    </div>
  );
}
