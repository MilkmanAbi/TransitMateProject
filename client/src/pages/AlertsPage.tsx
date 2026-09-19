import { ArrowUpDown, CheckCircle2, ChevronDown, FlaskConical, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/api/datamall';
import { DisruptionCard } from '@/components/CIE/DisruptionCard';
import { Card, LineChip, Pill, SectionTitle, Skeleton } from '@/components/ui';
import { usePoll } from '@/hooks/usePoll';
import { stationNames, useStations } from '@/hooks/useStations';
import { linesOf } from '@/lib/cie';
import { ago } from '@/lib/format';
import { PERSONAS, useStore } from '@/store/useStore';
import type { LiftOutage, TaxiCount } from '@/types';

const KIND = { planned: ['Planned', 'blue'], bus: ['Bus diversion', 'cyan'], disruption: ['Disruption', 'red'], info: ['Notice', 'slate'] } as const;

export default function AlertsPage() {
  const { alerts, alertsError, scenario, set, lastCommutePlan, profile } = useStore();
  const stations = useStations();
  const names = stationNames(stations);
  const [scenarios, setScenarios] = useState<{ id: string; label: string }[]>([]);
  const [liftsOpen, setLiftsOpen] = useState(false);
  const planned = linesOf(lastCommutePlan?.usual);
  const myLines = planned.length ? planned : (PERSONAS.find((p) => p.id === profile)?.lines ?? []);
  const disrupted = (alerts?.disruptions.length ?? 0) > 0;
  const taxi = usePoll<TaxiCount>(disrupted ? () => api.taxi() : null, 60_000, [disrupted]);
  const lifts = usePoll<LiftOutage[]>(() => api.lifts(), 10 * 60_000, []);

  useEffect(() => {
    api.scenarios().then(setScenarios).catch(() => undefined);
  }, []);

  return (
    <div className="animate-rise">
      <h1 className="pt-1 text-[1.375rem] font-bold">Network alerts</h1>
      <p className="text-[0.8125rem] text-slate-400">
        LTA TrainServiceAlerts · polled every 60 s{alerts ? ` · updated ${ago(alerts.fetchedAt)}` : ''}
      </p>

      {!alerts && !alertsError && <Skeleton className="mt-4 h-24" />}
      {alerts && (
        <div className="mt-4 space-y-3">
          {!disrupted ? (
            <Card className="flex items-center gap-3 p-4">
              <CheckCircle2 size={28} className="shrink-0 text-emerald-400" />
              <div>
                <p className="font-semibold text-white">No unplanned disruptions right now</p>
                <p className="text-[0.8125rem] text-slate-400">No affected segments in the live feed. Planned works are listed under Service notices and applied automatically when you plan a trip on that date.</p>
              </div>
            </Card>
          ) : (
            alerts.disruptions.map((d) => (
              <DisruptionCard key={d.line + d.stations[0]} d={d} names={names} simulated={alerts.simulated} taxi={taxi.data} affectsYou={myLines.includes(d.line)} />
            ))
          )}
        </div>
      )}

      <SectionTitle right={<span className="text-[0.6875rem] text-slate-400">{alerts?.messages.length ?? 0} live</span>}>Service notices</SectionTitle>
      <div className="space-y-2">
        {alerts?.messages.length === 0 && <p className="px-1 text-[0.8125rem] text-slate-400">No notices in the feed.</p>}
        {alerts?.messages.map((m, i) => {
          const mine = m.lines.some((l) => myLines.includes(l));
          const [label, tone] = KIND[m.kind];
          const injected = alerts.simulated && i === 0 && m.kind === 'disruption';
          return (
            <Card key={i} className="p-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={tone}>{label}</Pill>
                {m.lines.map((l) => (
                  <LineChip key={l} line={l} />
                ))}
                {mine ? <Pill tone="violet">On your route</Pill> : <span className="text-[0.6875rem] text-slate-400">not on your route</span>}
                {injected && <Pill tone="amber">SIMULATED</Pill>}
              </div>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-slate-200">{m.content}</p>
              <p className="mt-1 text-[0.6875rem] text-slate-400">{m.created}</p>
            </Card>
          );
        })}
      </div>

      <SectionTitle>Lifts under maintenance</SectionTitle>
      <Card className="overflow-hidden">
        <button onClick={() => setLiftsOpen(!liftsOpen)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left">
          <ArrowUpDown size={18} className="text-amber-400" />
          <span className="flex-1 text-[0.875rem]">
            {lifts.data ? `${lifts.data.length} lifts out of service` : 'Loading…'}
            {profile === 'lim' && <span className="block text-[0.75rem] text-amber-300">Mdm Lim’s routes avoid transfers at these stations</span>}
          </span>
          <ChevronDown size={16} className={`transition ${liftsOpen ? 'rotate-180' : ''}`} />
        </button>
        {liftsOpen && (
          <ul className="divide-y divide-white/5 border-t border-white/5">
            {lifts.data?.map((l, i) => (
              <li key={i} className="flex gap-3 px-4 py-2.5 text-[0.8125rem]">
                <LineChip line={l.Line === 'BPLRT' ? 'BPL' : l.Line} label={l.StationCode} />
                <span>
                  <span className="font-medium text-white">{l.StationName}</span>
                  <span className="block text-slate-400">{l.LiftDesc}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <SectionTitle>Demo: replay a disruption</SectionTitle>
      <Card className="p-4">
        <p className="flex gap-2 text-[0.8125rem] leading-relaxed text-slate-300">
          <FlaskConical size={18} className="shrink-0 text-amber-400" />
          The live feed’s AffectedSegments is empty on a normal day. To show the major-disruption path, inject a recorded-format alert. Everything it touches is labelled <span className="font-bold text-amber-300">SIMULATED</span>; bus arrivals, crowding and weather stay live.
        </p>
        <div className="mt-3 space-y-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => set({ scenario: scenario === s.id ? null : s.id })}
              className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-[0.875rem] ${scenario === s.id ? 'bg-amber-500/20 ring-1 ring-amber-500/50' : 'bg-black/25'}`}
            >
              {scenario === s.id ? <Square size={16} className="text-amber-300" /> : <Play size={16} className="text-slate-300" />}
              <span className="flex-1">{s.label}</span>
              {scenario === s.id && <span className="text-[0.75rem] font-semibold text-amber-300">Stop</span>}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
