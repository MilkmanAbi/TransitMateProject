import { ArrowUpDown, Navigation, Siren } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/datamall';
import { CrowdStrip } from '@/components/CIE/CrowdStrip';
import { ReportPicker, ReportRow } from '@/components/CIE/Reports';
import { useReports } from '@/lib/reports';
import { Sheet } from '@/components/Layout/Sheet';
import { CrowdTag, LineChip } from '@/components/ui';
import type { Station } from '@/hooks/useStations';
import { useStore } from '@/store/useStore';
import type { CrowdLevel, LiftOutage } from '@/types';

const PCD: Record<string, string> = { NS: 'NSL', EW: 'EWL', CG: 'CGL', NE: 'NEL', CC: 'CCL', DT: 'DTL', TE: 'TEL', BP: 'BPL', SE: 'SLRT', SW: 'SLRT', PE: 'PLRT', PW: 'PLRT' };
const pcdKey = (code: string) =>
  code === 'CC34' ? { line: 'CEL', station: 'CE1' } : code === 'CC33' ? { line: 'CEL', station: 'CE2' } : PCD[code.replace(/\d.*$/, '')] ? { line: PCD[code.replace(/\d.*$/, '')], station: code } : null;

// A station is only worth a tap if it answers "should I go through here right now?"
export function StationSheet({ station, siblings, onClose }: { station: Station | null; siblings: Station[]; onClose: () => void }) {
  const { crowdNow, alerts } = useStore();
  const { reports } = useReports();
  const nav = useNavigate();
  const [fc, setFc] = useState<{ station: string; boardAt: number; slots: { start: number; level: CrowdLevel }[] } | null>(null);
  const [lifts, setLifts] = useState<LiftOutage[]>([]);
  const codes = station ? [station.code, ...siblings.filter((s) => s.name === station.name && s.code !== station.code).map((s) => s.code)] : [];

  useEffect(() => {
    setFc(null);
    if (!station) return;
    const k = pcdKey(station.code);
    if (k)
      api
        .crowdForecast(k.line, k.station)
        .then((r) => {
          const now = Date.now();
          const slots = (r.stations[k.station] ?? []).filter((s) => s.start >= now - 60 * 60_000 && s.start <= now + 180 * 60_000);
          setFc({ station: station.name, boardAt: now, slots });
        })
        .catch(() => undefined);
    api.lifts().then((l) => setLifts(l.filter((x) => codes.includes(x.StationCode)))).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station?.code]);

  if (!station) return null;
  const hits = (alerts?.disruptions ?? []).filter((d) => codes.some((c) => d.stations.includes(c)));
  const place = encodeURIComponent(JSON.stringify({ name: `${station.name} station`, lat: station.lat, lng: station.lng }));
  return (
    <Sheet open onClose={onClose} title={`${station.name}`}>
      <div className="flex flex-wrap items-center gap-2">
        {codes.map((c) => {
          const line = siblings.find((s) => s.code === c)?.line ?? station.line;
          const k = pcdKey(c);
          return (
            <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 py-1 pl-1 pr-2.5">
              <LineChip line={line} label={c} />
              <CrowdTag level={(k && crowdNow[k.station]) || 'NA'} prefix="now: " />
            </span>
          );
        })}
      </div>
      {hits.map((d) => (
        <p key={d.line} className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-[0.875rem] text-red-100 ring-1 ring-red-500/30">
          <Siren size={16} className="mt-0.5 shrink-0 text-red-400" />
          {d.lineName}: {d.status === 2 ? 'no train service' : 'delays'} at this station{alerts?.simulated ? ' (simulated)' : ''}.
          {d.freeBusStations.some((s) => codes.includes(s)) ? ' Free bus boarding here.' : ''}
        </p>
      ))}
      {reports.filter((r) => codes.includes(r.station)).length > 0 && (
        <ul className="mt-3 rounded border border-surface-border bg-surface-card px-3">
          {reports.filter((r) => codes.includes(r.station)).map((r) => (
            <ReportRow key={r.id} r={r} />
          ))}
        </ul>
      )}
      {fc && fc.slots.length > 2 && <CrowdStrip data={fc} when="right now" />}
      <ReportPicker station={station.code} stationName={station.name} line={station.line} lat={station.lat} lng={station.lng} />
      <div className="mt-3 rounded-2xl bg-surface-card/60 p-3.5 ring-1 ring-white/[0.07]">
        <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold">
          <ArrowUpDown size={15} className="text-amber-400" /> Lifts
        </p>
        {lifts.length ? (
          <ul className="mt-1 space-y-1 text-[0.8125rem] text-amber-200">
            {lifts.map((l, i) => (
              <li key={i}>Out of service: {l.LiftDesc}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[0.8125rem] text-slate-300">No lift maintenance reported (LTA FacilitiesMaintenance).</p>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => nav(`/plan?from=${place}`)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white/10 font-semibold active:bg-white/15">
          <Navigation size={16} /> From here
        </button>
        <button onClick={() => nav(`/plan?to=${place}`)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 font-semibold active:bg-brand-700">
          <Navigation size={16} className="rotate-90" /> Go here
        </button>
      </div>
    </Sheet>
  );
}
