import type { ReactNode } from 'react';
import { CROWD_META, LINE_META, LOAD_META } from '@/lib/format';
import type { CrowdLevel, LoadCode } from '@/types';

export function Card({ children, className = '', as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' }) {
  return <As className={`rounded border border-surface-border bg-surface-card ${className}`}>{children}</As>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-end justify-between px-1">
      <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-slate-500 border-b border-surface-border pb-1 flex-1">{children}</h2>
      {right}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-700/40 ${className}`} />;
}

export function LineChip({ line, label }: { line: string; label?: string }) {
  const meta = LINE_META[line];
  return (
    <span
      className="inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded px-1.5 font-mono text-[0.75rem] font-bold text-paper"
      style={{ background: meta?.color ?? '#475569' }}
    >
      {label ?? meta?.short ?? line}
    </span>
  );
}

export function BusChip({ service }: { service: string }) {
  return (
    <span className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded-md bg-emerald-600 px-1.5 text-[0.75rem] font-bold tabular-nums text-paper">
      {service}
    </span>
  );
}

// Three bars so load is readable without relying on colour alone.
export function Bars({ n, cls }: { n: number; cls: string }) {
  return (
    <span className={`inline-flex items-end gap-[2px] ${cls}`} aria-hidden>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-[4px] rounded-sm ${i <= n ? 'bg-current' : 'bg-slate-600'}`} style={{ height: 5 + i * 3 }} />
      ))}
    </span>
  );
}

export function LoadTag({ load, compact }: { load: LoadCode; compact?: boolean }) {
  const m = LOAD_META[load] ?? LOAD_META[''];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[0.75rem] font-medium ${m.cls}`}>
      <Bars n={m.bars} cls={m.cls} />
      {compact ? m.short : m.label}
    </span>
  );
}

export function CrowdTag({ level, prefix }: { level: CrowdLevel; prefix?: string }) {
  const m = CROWD_META[level] ?? CROWD_META.NA;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[0.75rem] font-medium ${m.cls}`}>
      <Bars n={m.bars} cls={m.cls} />
      {prefix}
      {m.label}
    </span>
  );
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'red' | 'amber' | 'cyan' | 'green' | 'blue' | 'violet' }) {
  const tones = {
    slate: 'bg-slate-700/50 text-slate-200',
    red: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30',
    amber: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30',
    green: 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30',
    blue: 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-500/30',
    violet: 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${tones[tone]}`}>{children}</span>;
}
