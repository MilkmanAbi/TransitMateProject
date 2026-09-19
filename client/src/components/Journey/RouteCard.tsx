import { Accessibility, ArrowUpDown, BusFront, ChevronDown, CloudRain, Footprints, Leaf, Radio, TrainFront, Users } from 'lucide-react';
import { useState } from 'react';
import { BusChip, CrowdTag, LineChip, LoadTag, Pill } from '@/components/ui';
import { co2SavedVsTaxi, logTrip } from '@/lib/co2';
import { hhmm, range } from '@/lib/format';
import { useStore } from '@/store/useStore';
import type { Leg, RouteOption } from '@/types';
import { JourneyBar } from './JourneyBar';

function LegRow({ l }: { l: Leg }) {
  if (l.mode === 'walk')
    return (
      <div className="flex gap-3 py-2">
        <Footprints size={18} className="mt-0.5 shrink-0 text-slate-400" />
        <p className="text-[0.8125rem] text-slate-300">
          Walk {Math.max(1, Math.round(l.minutes))} min{l.km ? ` · ${Math.round(l.km * 1000)} m` : ''} to <span className="font-medium text-white">{l.to.name}</span>
          {l.note ? <span className="text-slate-400"> · {l.note}</span> : null}
        </p>
      </div>
    );
  const liveMins = l.live ? Math.max(0, Math.round((Date.parse(l.live.eta) - Date.now()) / 60000)) : null;
  return (
    <div className="flex gap-3 py-2">
      {l.mode === 'bus' || l.mode === 'shuttle' ? <BusFront size={18} className="mt-0.5 shrink-0 text-emerald-400" /> : <TrainFront size={18} className="mt-0.5 shrink-0" style={{ color: l.color }} />}
      <div className="min-w-0 flex-1 text-[0.8125rem]">
        <div className="flex flex-wrap items-center gap-1.5">
          {l.mode === 'bus' ? <BusChip service={l.service ?? ''} /> : <LineChip line={l.line ?? ''} label={l.mode === 'shuttle' ? 'Bridge' : undefined} />}
          <span className="font-medium text-white">
            {l.from.name} → {l.to.name}
          </span>
        </div>
        <p className="mt-0.5 text-slate-400">
          {l.mode === 'bus' ? `towards ${l.headsign}${l.alsoServices?.length ? ` · or bus ${l.alsoServices.join(', ')}` : ''} · ` : l.mode === 'shuttle' ? 'Free bridging bus · ' : `${l.lineName} · `}
          {l.stops} stop{l.stops === 1 ? '' : 's'} · {range(l.min, l.max)} min
          {l.note ? ` · ${l.note}` : ''}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {l.live && (
            <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-emerald-300">
              <Radio size={12} /> next bus {liveMins === 0 ? 'arriving' : `in ${liveMins} min`}
              {!l.live.monitored && ' (sched)'}
            </span>
          )}
          {l.live && <LoadTag load={l.live.load} />}
          {l.live?.wab && <Accessibility size={14} className="text-sky-300" aria-label="Wheelchair accessible bus" />}
          {l.mode === 'bus' && !l.live && <span className="text-[0.75rem] text-slate-400">wait ~{Math.round(l.waitMin)} min (timetable)</span>}
          {l.crowd && l.crowd.level !== 'NA' && <CrowdTag level={l.crowd.level} prefix={`${l.from.name} ${l.crowd.source === 'forecast' ? '(forecast): ' : 'now: '}`} />}
          {l.delayMin ? <Pill tone="amber">+{l.delayMin} min delay</Pill> : null}
          {l.blocked && <Pill tone="red">No train service</Pill>}
          {l.free && <Pill tone="green">Free boarding</Pill>}
          {l.liftOut?.length ? (
            <span className="inline-flex items-center gap-1 text-[0.75rem] text-amber-300">
              <ArrowUpDown size={12} /> Lift out: {l.liftOut[0]}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function RouteCard({ o, index, selected, onSelect, departAt }: { o: RouteOption; index: number; selected: boolean; onSelect: () => void; departAt: number }) {
  const [open, setOpen] = useState(index === 0);
  const toast = useStore((s) => s.toast);
  const co2 = co2SavedVsTaxi(o);
  const firstBus = o.legs.find((l) => l.mode === 'bus' && l.live);
  const crowded = o.legs.find((l) => l.crowd?.level === 'h');
  return (
    <article className={`overflow-hidden rounded-2xl bg-surface-card/80 ring-1 transition ${selected ? 'ring-2 ring-brand-400' : 'ring-white/10'}`}>
      <button onClick={onSelect} className="block w-full px-4 pt-3 text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {index === 0 && <Pill tone="blue">Best for you</Pill>}
              {o.tags.includes('free-transfer') && <Pill tone="green">Free boarding</Pill>}
              {o.tags.includes('delayed') && <Pill tone="amber">Delays</Pill>}
            </div>
            <p className="mt-1 text-[1.625rem] font-bold tabular-nums leading-none text-white">
              {range(o.min, o.max)}
              <span className="ml-1 text-[0.875rem] font-semibold text-slate-400">min</span>
            </p>
            <p className="mt-1 text-[0.75rem] text-slate-400">
              Arrive {hhmm(departAt + o.min * 60_000)}–{hhmm(departAt + o.max * 60_000)} · expected {o.minutes} min
            </p>
          </div>
          <div className="text-right text-[0.75rem] text-slate-400">
            <p className="text-[0.9375rem] font-semibold text-slate-200">${o.fare.toFixed(2)}</p>
            <p>est. fare</p>
            {co2 > 0.05 && (
              <p className="mt-1 inline-flex items-center gap-0.5 text-emerald-400">
                <Leaf size={11} />−{co2.toFixed(1)} kg
              </p>
            )}
          </div>
        </div>
        <div className="mt-2.5">
          <JourneyBar legs={o.legs} height={26} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem]">
          <span className="text-slate-400">
            {o.walkMin} min walk · {o.transfers} transfer{o.transfers === 1 ? '' : 's'}
          </span>
          {firstBus?.live && (
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <Radio size={12} /> Bus {firstBus.service} live
            </span>
          )}
          {crowded && (
            <span className="inline-flex items-center gap-1 text-red-300">
              <Users size={12} /> {crowded.from.name} crowded
            </span>
          )}
          {o.tags.includes('wet-walk') && (
            <span className="inline-flex items-center gap-1 text-cyan-300">
              <CloudRain size={12} /> wet walk
            </span>
          )}
        </div>
      </button>
      <div className="mt-2 flex items-center border-t border-white/5">
        <button onClick={() => setOpen(!open)} className="flex h-11 flex-1 items-center gap-1 px-4 text-[0.8125rem] font-medium text-slate-300">
          {open ? 'Hide steps' : 'Show steps'} <ChevronDown size={15} className={`transition ${open ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => {
            logTrip(o);
            toast(`Taking ${o.summary} — ${co2.toFixed(1)} kg CO₂ saved vs taxi`, 'info');
          }}
          className="h-11 px-4 text-[0.8125rem] font-semibold text-brand-400"
        >
          I’ll take this
        </button>
      </div>
      {open && (
        <div className="divide-y divide-white/5 border-t border-white/5 px-4 pb-2">
          {o.legs.map((l, i) => (
            <LegRow key={i} l={l} />
          ))}
        </div>
      )}
    </article>
  );
}
