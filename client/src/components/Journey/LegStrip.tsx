import { ChevronRight, Footprints } from 'lucide-react';
import { Fragment } from 'react';
import { BusChip, LineChip } from '@/components/ui';
import type { Leg } from '@/types';

export function LegStrip({ legs, dim }: { legs: Leg[]; dim?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-1 ${dim ? 'opacity-60' : ''}`}>
      {legs.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight size={14} className="text-slate-600" />}
          {l.mode === 'walk' ? (
            <span className="inline-flex items-center gap-0.5 text-[0.75rem] text-slate-400">
              <Footprints size={14} />
              {Math.max(1, Math.round(l.minutes))}
            </span>
          ) : l.mode === 'bus' ? (
            <BusChip service={l.service ?? '?'} />
          ) : (
            <span className={l.blocked ? 'relative' : ''}>
              <LineChip line={l.line ?? ''} label={l.mode === 'shuttle' ? 'Bridge bus' : undefined} />
              {l.blocked && <span className="absolute inset-x-0 top-1/2 h-0.5 -rotate-12 bg-red-500" />}
            </span>
          )}
        </Fragment>
      ))}
    </div>
  );
}
