import { Megaphone, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import { LineChip } from '@/components/ui';
import { ago } from '@/lib/format';
import { addReport, confirmReport, kindLabel, type Report, REPORT_KINDS, type ReportKind } from '@/lib/reports';
import { useStore } from '@/store/useStore';

export function ReportRow({ r }: { r: Report }) {
  const [done, setDone] = useState(false);
  return (
    <li className="flex items-center gap-3 border-b border-surface-border py-2.5 last:border-0">
      <LineChip line={r.line} label={r.station} />
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-semibold text-white">
          {kindLabel(r.kind)} · {r.stationName}
        </p>
        <p className="text-[0.75rem] text-slate-500">
          <span className="tabular-nums">{ago(r.createdAt)}</span>
          {r.confirms > 0 ? ` · ${r.confirms} confirmed` : ''}
          {r.note ? ` · “${r.note}”` : ''}
        </p>
      </div>
      <button
        disabled={done}
        onClick={() => confirmReport(r.id).then(() => setDone(true)).catch(() => undefined)}
        className="flex h-11 items-center gap-1 rounded border border-surface-border px-2.5 text-[0.75rem] font-semibold text-slate-300 disabled:opacity-50"
        aria-label="Still happening"
      >
        <ThumbsUp size={14} /> {done ? 'Thanks' : 'Still true'}
      </button>
    </li>
  );
}

// One tap to tell other commuters what you see; stored in Firestore, visible to everyone in real time.
export function ReportPicker({ station, stationName, line, lat, lng }: { station: string; stationName: string; line: string; lat: number; lng: number }) {
  const toast = useStore((s) => s.toast);
  const [sent, setSent] = useState<ReportKind | null>(null);
  const send = (kind: ReportKind) =>
    addReport({ kind, station, stationName, line, lat, lng })
      .then(() => {
        setSent(kind);
        toast(`Reported “${kindLabel(kind)}” at ${stationName} — shared with other commuters`, 'info');
      })
      .catch((e: Error) => toast(`Couldn’t send report: ${e.message}`));
  return (
    <div className="mt-3 rounded border border-surface-border bg-surface-card p-3">
      <p className="flex items-center gap-1.5 text-[0.8125rem] font-semibold">
        <Megaphone size={15} className="text-brand-400" /> Report what you see here
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {REPORT_KINDS.map((k) => (
          <button
            key={k.kind}
            disabled={!!sent}
            onClick={() => send(k.kind)}
            className={`h-11 rounded border text-[0.8125rem] font-medium ${sent === k.kind ? 'border-brand-400 bg-brand-500' : 'border-surface-border bg-surface-raised text-slate-200'} disabled:opacity-60`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[0.6875rem] text-slate-500">Anonymous. Reports expire after 90 min. Stored in Cloud Firestore (asia-southeast1).</p>
    </div>
  );
}
