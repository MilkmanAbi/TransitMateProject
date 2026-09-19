import { Accessibility, RefreshCw, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useArrivals } from '@/hooks/useArrivals';
import { ago } from '@/lib/format';
import { useStore } from '@/store/useStore';
import { BusChip, Card, LoadTag, Skeleton } from '@/components/ui';
import type { BusETA } from '@/types';

// "≈" marks a timetable estimate (Monitored=0) rather than a GPS-tracked bus.
function Eta({ bus, big }: { bus: BusETA; big?: boolean }) {
  const label = bus.mins <= 0 ? 'Arr' : `${bus.mins}`;
  return (
    <span className={`whitespace-nowrap tabular-nums ${big ? 'text-2xl font-bold' : 'text-sm font-semibold text-slate-400'} ${bus.monitored ? '' : 'opacity-80'}`}>
      {!bus.monitored && <span className="text-slate-500">≈</span>}
      {label}
      {bus.mins > 0 && <span className={big ? 'ml-0.5 text-xs font-medium text-slate-400' : 'text-[11px] text-slate-500'}>{big ? 'min' : 'm'}</span>}
    </span>
  );
}

export function ArrivalPanel({ code, compact, limit, title }: { code: string; compact?: boolean; limit?: number; title?: boolean }) {
  const { data, loading, error, updatedAt, refresh } = useArrivals(code);
  const { savedStops, toggleStop } = useStore();
  const saved = savedStops.includes(code);
  const services = data?.services.slice(0, limit ?? 99) ?? [];

  return (
    <Card className="overflow-hidden">
      {title !== false && (
        <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
          <div className="min-w-0 flex-1">
            <Link to={`/stop/${code}`} className="block truncate text-[15px] font-semibold text-white">
              {data?.stop.name ?? `Stop ${code}`}
            </Link>
            <p className="truncate text-[12px] text-slate-400">
              {code}
              {data?.stop.road ? ` · ${data.stop.road}` : ''}
              {updatedAt ? ` · updated ${ago(updatedAt)}` : ''}
            </p>
          </div>
          <button onClick={refresh} className="grid h-10 w-10 place-items-center rounded-full text-slate-400 active:bg-white/10" aria-label="Refresh arrivals">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => toggleStop(code)} className="grid h-10 w-10 place-items-center rounded-full active:bg-white/10" aria-label={saved ? 'Unsave stop' : 'Save stop'}>
            <Star size={18} className={saved ? 'fill-amber-400 text-amber-400' : 'text-slate-400'} />
          </button>
        </div>
      )}
      {!data && loading && (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}
      {data && services.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No buses arriving right now.</p>}
      {error && !data && <p className="px-4 py-6 text-center text-sm text-red-300">Couldn't load live arrivals.</p>}
      <ul className="divide-y divide-white/5">
        {services.map((s) => (
          <li key={s.service} className="flex items-center gap-3 px-4 py-2.5">
            <BusChip service={s.service} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-slate-300">{s.destination ? `to ${s.destination}` : s.operator}</p>
              <div className="mt-0.5 flex items-center gap-2 whitespace-nowrap">
                <LoadTag load={s.buses[0].load} compact />
                {s.buses[0].wab && <Accessibility size={14} className="shrink-0 text-sky-300" aria-label="Wheelchair accessible" />}
                {s.buses[0].type === 'DD' && <span className="rounded bg-slate-700/60 px-1 text-[10px] font-semibold text-slate-300" title="Double deck">DD</span>}
              </div>
            </div>
            <div className="flex shrink-0 items-baseline gap-3 text-right">
              <Eta bus={s.buses[0]} big />
              {!compact && s.buses[1] && <Eta bus={s.buses[1]} />}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
