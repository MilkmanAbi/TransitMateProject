import { Check, ShieldCheck } from 'lucide-react';
import { PERSONAS, useStore } from '@/store/useStore';
import { Sheet } from './Sheet';

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, setPersona, commute, setCommute, threshold, largeText, set } = useStore();
  return (
    <Sheet open={open} onClose={onClose} title="You & your commute">
      <p className="mb-2 text-[0.8125rem] text-slate-400">Who is TransitMate planning for? Each persona re-weights the same live data differently.</p>
      <div className="space-y-2">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPersona(p.id)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${profile === p.id ? 'border-brand-400 bg-brand-500/10' : 'border-white/10 bg-surface-card/50'}`}
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 text-sm font-bold">{p.name[0]}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.name}</p>
              <p className="text-[0.75rem] text-slate-400">{p.blurb}</p>
              <p className="truncate text-[0.75rem] text-slate-500">
                {p.commute.from.name.replace(/^Home · /, '')} → {p.commute.to.name.replace(/^(Office|Work) · /, '')}
              </p>
            </div>
            {profile === p.id && <Check size={18} className="text-brand-400" />}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[0.75rem] font-medium text-slate-400">Usually leave at</span>
          <input type="time" value={commute.departTime} onChange={(e) => setCommute({ departTime: e.target.value })} className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-surface-card px-3 text-base" />
        </label>
        <label className="block">
          <span className="text-[0.75rem] font-medium text-slate-400">Must arrive by</span>
          <input type="time" value={commute.arriveBy} onChange={(e) => setCommute({ arriveBy: e.target.value })} className="mt-1 h-12 w-full rounded-xl border border-white/10 bg-surface-card px-3 text-base" />
        </label>
      </div>

      <p className="mt-5 text-[0.75rem] font-medium text-slate-400">Interrupt me when my trip is longer by at least</p>
      <div className="mt-1.5 grid grid-cols-4 gap-2">
        {[5, 10, 15, 20].map((n) => (
          <button key={n} onClick={() => set({ threshold: n })} className={`h-11 rounded-xl text-sm font-semibold ${threshold === n ? 'bg-brand-500 text-white' : 'bg-surface-card text-slate-300'}`}>
            {n} min
          </button>
        ))}
      </div>

      <button onClick={() => set({ largeText: !largeText })} className="mt-5 flex min-h-[52px] w-full items-center justify-between rounded-xl bg-surface-card px-4">
        <span className="text-[0.9375rem]">Large text</span>
        <span className={`relative h-7 w-12 rounded-full transition ${largeText ? 'bg-brand-500' : 'bg-slate-600'}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${largeText ? 'left-6' : 'left-1'}`} />
        </span>
      </button>

      <p className="mt-5 flex gap-2 text-[0.75rem] leading-relaxed text-slate-500">
        <ShieldCheck size={16} className="shrink-0 text-emerald-500" />
        Your commute, saved stops and last journey stay in this browser's local storage only. Nothing is sent anywhere except the origin/destination coordinates needed to plan a route.
      </p>
    </Sheet>
  );
}
