import { Briefcase, Home, LocateFixed, MapPin, TrainFront } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/datamall';
import { useStore } from '@/store/useStore';
import type { Place } from '@/types';

export function PlaceInput({ label, value, onChange, dot }: { label: string; value: Place | null; onChange: (p: Place) => void; dot: string }) {
  const [q, setQ] = useState(value?.name ?? '');
  const [focus, setFocus] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const [locating, setLocating] = useState(false);
  const commute = useStore((s) => s.commute);
  const toast = useStore((s) => s.toast);
  const timer = useRef<number>();

  useEffect(() => setQ(value?.name ?? ''), [value?.name]);
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!focus || q.trim().length < 2 || q === value?.name) return setResults([]);
    timer.current = window.setTimeout(() => {
      api.geoSearch(q).then(setResults).catch(() => setResults([]));
    }, 280);
  }, [q, focus, value?.name]);

  const pick = (p: Place) => {
    onChange(p);
    setQ(p.name);
    setFocus(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const locate = () => {
    if (!window.isSecureContext) return toast('Location needs HTTPS — open the app via the https:// tunnel URL, or pick Home/Work', 'info');
    if (!navigator.geolocation) return toast('Location not available on this device');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        pick({ name: 'Current location', lat: pos.coords.latitude, lng: pos.coords.longitude, kind: 'current' });
      },
      () => {
        setLocating(false);
        toast('Could not get your location');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="relative">
      <label className="flex h-14 items-center gap-3 rounded-xl bg-sunken px-3 ring-1 ring-white/10 focus-within:ring-brand-400">
        <span className={`h-3 w-3 shrink-0 rounded-full ${dot}`} />
        <span className="sr-only">{label}</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={(e) => {
            setFocus(true);
            e.target.select();
          }}
          onBlur={() => setTimeout(() => setFocus(false), 200)}
          placeholder={label}
          className="h-full min-w-0 flex-1 bg-transparent text-[1rem] text-white placeholder:text-slate-400 focus:outline-none"
          enterKeyHint="search"
          autoComplete="off"
        />
      </label>
      {focus && (
        <div className="absolute inset-x-0 top-[60px] z-[1200] overflow-hidden rounded-xl bg-surface-raised shadow-2xl ring-1 ring-white/10">
          <div className="flex gap-2 overflow-x-auto p-2 no-scrollbar">
            <button onMouseDown={(e) => e.preventDefault()} onClick={locate} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-500/15 px-3 text-[0.8125rem] font-medium text-brand-300">
              <LocateFixed size={15} /> {locating ? 'Locating…' : 'Current location'}
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(commute.from)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-3 text-[0.8125rem] text-slate-200">
              <Home size={15} /> Home
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(commute.to)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/5 px-3 text-[0.8125rem] text-slate-200">
              <Briefcase size={15} /> Work
            </button>
          </div>
          {results.map((r, i) => (
            <button key={i} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)} className="flex min-h-[52px] w-full items-center gap-3 border-t border-white/5 px-3 py-2 text-left active:bg-white/5">
              {r.kind === 'station' ? <TrainFront size={18} className="shrink-0 text-brand-400" /> : <MapPin size={18} className="shrink-0 text-slate-400" />}
              <span className="min-w-0">
                <span className="block truncate text-[0.875rem] text-white">{r.name}</span>
                <span className="block truncate text-[0.75rem] text-slate-400">{r.address}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
