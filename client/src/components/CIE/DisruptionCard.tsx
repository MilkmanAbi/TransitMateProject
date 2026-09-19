import { BusFront, CarTaxiFront, TrainFront } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LineChip, Pill } from '@/components/ui';
import type { Disruption, TaxiCount } from '@/types';

export function DisruptionCard({ d, names, simulated, taxi, affectsYou }: { d: Disruption; names: Record<string, string>; simulated: boolean; taxi: TaxiCount | null; affectsYou: boolean }) {
  const n = (c: string) => names[c] ?? c;
  const a = d.stations[0];
  const b = d.stations[d.stations.length - 1];
  return (
    <article className="relative overflow-hidden rounded-2xl bg-surface-card/80 ring-1 ring-red-500/30">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${d.status === 2 ? 'bg-alert-critical' : 'bg-alert-warning'}`} />
      <div className="py-3 pl-5 pr-4">
        <div className="flex flex-wrap items-center gap-2">
          <LineChip line={d.line} />
          <Pill tone={d.status === 2 ? 'red' : 'amber'}>{d.status === 2 ? 'No train service' : 'Delays'}</Pill>
          {simulated && <Pill tone="amber">SIMULATED</Pill>}
          {affectsYou && <Pill tone="violet">On your route</Pill>}
        </div>
        <h3 className="mt-2 text-[1rem] font-semibold text-white">
          {n(a)} ↔ {n(b)}
        </h3>
        <p className="text-[0.8125rem] text-slate-400">
          {d.lineName} · {d.direction === 'Both' ? 'both directions' : `towards ${d.direction}`}
          {d.delayMin ? ` · +${d.delayMin} min` : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {d.stations.map((s) => (
            <span key={s} className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[0.6875rem] text-red-200">
              {s} {n(s)}
            </span>
          ))}
        </div>
        <ul className="mt-3 space-y-1.5 text-[0.8125rem] text-slate-200">
          {(d.freeBusStations.length > 0 || d.freeBusIslandWide) && (
            <li className="flex gap-2">
              <BusFront size={16} className="mt-0.5 shrink-0 text-emerald-400" />
              Free boarding on regular buses {d.freeBusIslandWide ? 'island-wide' : `at ${d.freeBusStations.map(n).join(', ')}`}
            </li>
          )}
          {d.shuttleStations.length > 0 && (
            <li className="flex gap-2">
              <TrainFront size={16} className="mt-0.5 shrink-0 text-amber-400" />
              Free bridging buses between {n(d.shuttleStations[0])} and {n(d.shuttleStations[d.shuttleStations.length - 1])}
            </li>
          )}
          {taxi && (
            <li className="flex gap-2">
              <CarTaxiFront size={16} className="mt-0.5 shrink-0 text-yellow-300" />
              {taxi.total.toLocaleString()} taxis available island-wide right now (LTA Taxi-Availability)
            </li>
          )}
        </ul>
        {affectsYou && (
          <Link to="/plan?commute=1" className="mt-3 flex h-11 items-center justify-center rounded-xl bg-red-600 text-[0.875rem] font-bold text-white active:bg-red-700">
            See your new route →
          </Link>
        )}
      </div>
    </article>
  );
}
