import type { CrowdLevel, LoadCode } from '@/types';

export const LINE_META: Record<string, { name: string; short: string; color: string; pcd: string[] }> = {
  NSL: { name: 'North-South Line', short: 'NS', color: '#d42e12', pcd: ['NSL'] },
  EWL: { name: 'East-West Line', short: 'EW', color: '#009645', pcd: ['EWL', 'CGL'] },
  NEL: { name: 'North East Line', short: 'NE', color: '#9900aa', pcd: ['NEL'] },
  CCL: { name: 'Circle Line', short: 'CC', color: '#fa9e0d', pcd: ['CCL', 'CEL'] },
  DTL: { name: 'Downtown Line', short: 'DT', color: '#005ec4', pcd: ['DTL'] },
  TEL: { name: 'Thomson-East Coast Line', short: 'TE', color: '#9d5b25', pcd: ['TEL'] },
  BPL: { name: 'Bukit Panjang LRT', short: 'BP', color: '#748477', pcd: ['BPL'] },
  SKLRT: { name: 'Sengkang LRT', short: 'SK', color: '#748477', pcd: ['SLRT'] },
  PGLRT: { name: 'Punggol LRT', short: 'PG', color: '#748477', pcd: ['PLRT'] },
  SHUTTLE: { name: 'Free bridging bus', short: 'BR', color: '#f59e0b', pcd: [] },
};

// Colour is never the only signal: every load/crowd state also carries a label and an icon count.
export const LOAD_META: Record<LoadCode, { label: string; short: string; cls: string; bars: number }> = {
  SEA: { label: 'Seats available', short: 'Seats', cls: 'text-green-400', bars: 1 },
  SDA: { label: 'Standing room', short: 'Standing', cls: 'text-amber-400', bars: 2 },
  LSD: { label: 'Limited standing', short: 'Packed', cls: 'text-red-400', bars: 3 },
  '': { label: 'No data', short: '—', cls: 'text-slate-400', bars: 0 },
};

export const CROWD_META: Record<CrowdLevel, { label: string; cls: string; bars: number }> = {
  l: { label: 'Not crowded', cls: 'text-green-400', bars: 1 },
  m: { label: 'Moderate', cls: 'text-amber-400', bars: 2 },
  h: { label: 'Crowded', cls: 'text-red-400', bars: 3 },
  NA: { label: 'No data', cls: 'text-slate-400', bars: 0 },
};

const sgt = (ms: number) => new Date(ms + 8 * 3600_000);
export function hhmm(ms: number): string {
  const d = sgt(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
export function clock12(ms: number): string {
  const d = sgt(ms);
  const h = d.getUTCHours();
  return `${((h + 11) % 12) + 1}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}
export function todayAt(hm: string, base = Date.now()): number {
  const [h, m] = hm.split(':').map(Number);
  const d = sgt(base);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m) - 8 * 3600_000;
}
export const sgDay = (ms = Date.now()) => sgt(ms).getUTCDay();
export const mins = (n: number) => `${Math.round(n)} min`;
export const range = (a: number, b: number) => (Math.round(a) === Math.round(b) ? `${Math.round(a)}` : `${Math.round(a)}–${Math.round(b)}`);

export function lineOfStation(code: string): string | undefined {
  const p = code.replace(/\d.*$/, '');
  return (
    { NS: 'NSL', EW: 'EWL', CG: 'EWL', NE: 'NEL', CC: 'CCL', CE: 'CCL', DT: 'DTL', TE: 'TEL', BP: 'BPL', SE: 'SKLRT', SW: 'SKLRT', STC: 'SKLRT', PE: 'PGLRT', PW: 'PGLRT', PTC: 'PGLRT' } as Record<string, string>
  )[p];
}
