import { ArrowUpDown, CheckCircle2, ChevronDown, FlaskConical, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/api/datamall';
import { DisruptionCard } from '@/components/CIE/DisruptionCard';
import { ReportRow } from '@/components/CIE/Reports';
import { useReports } from '@/lib/reports';
import { Card, LineChip, Pill, SectionTitle, Skeleton } from '@/components/ui';
import { usePoll } from '@/hooks/usePoll';
import { stationNames, useStations } from '@/hooks/useStations';
import { linesOf } from '@/lib/cie';
import { ago, LINE_META } from '@/lib/format';
import { STATIC } from '@/api/static';
import { PERSONAS, useStore } from '@/store/useStore';
import type { LiftOutage, TaxiCount } from '@/types';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// Dates named in a planned notice, as chips ("Tomorrow · Sun 20 Sep"), so planned works read at a glance.
function noticeDates(content: string) {
  const year = Number(content.match(/(20\d\d)/)?.[1] ?? new Date().getFullYear());
  const seen = new Set<string>();
  const out: { label: string; soon: boolean; past: boolean }[] = [];
  const range = content.match(/from\s+(\d{1,2}\s+[a-z]{3})[a-z]*\s+to\s+(\d{1,2}\s+[a-z]{3})/i);
  if (range) {
    const end = new Date(year, MONTHS.indexOf(range[2].slice(-3).toLowerCase()), Number(range[2].split(/\s+/)[0]));
    return [{ label: `${range[1]} – ${range[2]}${end.getTime() >= Date.now() ? ' (ongoing)' : ''}`, soon: end.getTime() >= Date.now(), past: end.getTime() < Date.now() }];
  }
  for (const m of content.matchAll(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi)) {
    const d = new Date(year, MONTHS.indexOf(m[2].toLowerCase()), Number(m[1]));
    const key = d.toDateString();
    if (seen.has(key)) continue;
    seen.add(key);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    const day = d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
    out.push({ label: diff === 0 ? `Today · ${day}` : diff === 1 ? `Tomorrow · ${day}` : day, soon: diff >= 0 && diff <= 1, past: diff < 0 });
  }
  return out;
}

const KIND = { planned: ['Planned', 'blue'], bus: ['Bus diversion', 'cyan'], disruption: ['Disruption', 'red'], info: ['Notice', 'slate'] } as const;

export default function AlertsPage() {
  const { alerts, alertsError, scenario, set, lastCommutePlan, profile } = useStore();
  const stations = useStations();
  const names = stationNames(stations);
  const [scenarios, setScenarios] = useState<{ id: string; label: string }[]>([]);
  const [liftsOpen, setLiftsOpen] = useState(false);
  const { reports, error: reportsError } = useReports();
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
      <h1 className="pt-1 font-serif text-[1.5rem] font-semibold">Network alerts</h1>
      <p className="text-[0.8125rem] text-slate-400">
        {STATIC ? 'LTA TrainServiceAlerts · recorded snapshot (static demo)' : `LTA TrainServiceAlerts · polled every 60 s${alerts ? ` · updated ${ago(alerts.fetchedAt)}` : ''}`}
      </p>

      {alerts && (
        <div className="mt-3 grid grid-cols-3 gap-1.5" role="list" aria-label="Line status">
          {['NSL', 'EWL', 'NEL', 'CCL', 'DTL', 'TEL', 'BPL', 'SKLRT', 'PGLRT'].map((id) => {
            const d = alerts.disruptions.find((x) => x.line === id);
            const planned = alerts.messages.some((m) => m.kind === 'planned' && m.lines.includes(id));
            const state = d ? (d.status === 2 ? 'No service' : 'Delays') : planned ? 'Planned works' : 'Normal';
            return (
              <div key={id} role="listitem" className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ring-1 ${d ? 'bg-red-500/15 ring-red-500/40' : planned ? 'bg-blue-500/10 ring-blue-400/25' : 'bg-white/[0.03] ring-white/5'}`}>
                <span className="h-6 w-1.5 shrink-0 rounded-full" style={{ background: LINE_META[id].color }} />
                <span className="min-w-0 leading-tight">
                  <span className="block text-[0.6875rem] font-bold text-white">{LINE_META[id].short === 'SK' ? 'SKLRT' : LINE_META[id].short === 'PG' ? 'PGLRT' : LINE_META[id].short === 'BP' ? 'BPLRT' : id}</span>
                  <span className={`block truncate text-[0.625rem] ${d ? 'font-semibold text-red-300' : planned ? 'text-blue-200' : 'text-slate-400'}`}>
                    {d ? '✕ ' : planned ? '◷ ' : '✓ '}
                    {state}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
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

      <SectionTitle right={<span className="text-[0.6875rem] text-slate-400">Firestore · real time</span>}>From commuters · last 90 min</SectionTitle>
      <Card className="px-3">
        {reportsError ? (
          <p className="py-3 text-[0.8125rem] text-amber-300">Commuter reports unavailable: {reportsError}</p>
        ) : reports.length === 0 ? (
          <p className="py-3 text-[0.8125rem] text-slate-400">No commuter reports right now. Tap any station on the Map to report what you see.</p>
        ) : (
          <ul>
            {reports.map((r) => (
              <ReportRow key={r.id} r={r} />
            ))}
          </ul>
        )}
      </Card>

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
              {m.kind === 'planned' && noticeDates(m.content).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {noticeDates(m.content).map((d) => (
                    <span key={d.label} className={`rounded-md px-2 py-0.5 text-[0.75rem] font-semibold ${d.soon ? 'bg-blue-500 text-white' : d.past ? 'bg-white/5 text-slate-400 line-through' : 'bg-blue-500/15 text-blue-200'}`}>
                      {d.label}
                    </span>
                  ))}
                </div>
              )}
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
              className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left text-[0.875rem] ${scenario === s.id ? 'bg-amber-500/20 ring-1 ring-amber-500/50' : 'bg-sunken'}`}
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
