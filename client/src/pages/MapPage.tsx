import { LocateFixed, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/datamall';
import { ArrivalPanel } from '@/components/Arrivals/ArrivalPanel';
import { Sheet } from '@/components/Layout/Sheet';
import { TransitMap } from '@/components/Map/TransitMap';
import { useStations } from '@/hooks/useStations';
import { useStore } from '@/store/useStore';
import type { StopSummary } from '@/types';

export default function MapPage() {
  const stations = useStations();
  const { crowdNow, alerts, commute, toast } = useStore();
  const [stop, setStop] = useState<StopSummary | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<StopSummary[]>([]);
  const nav = useNavigate();
  const disrupted = useMemo(() => new Set(alerts?.disruptions.flatMap((d) => d.stations) ?? []), [alerts]);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => api.searchStops(q).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(t);
  }, [q]);

  const locate = () =>
    !window.isSecureContext
      ? toast('Location needs HTTPS — open the app via the https:// tunnel URL', 'info')
      : navigator.geolocation?.getCurrentPosition(
      (p) => setFlyTo([p.coords.latitude, p.coords.longitude]),
      () => toast('Could not get your location'),
      { enableHighAccuracy: true, timeout: 8000 },
    );

  return (
    <div className="-mx-4 -mt-3 animate-rise">
      <div className="relative" style={{ height: 'calc(100dvh - 64px - var(--safe-bottom))' }}>
        <TransitMap stations={stations} crowd={crowdNow} disrupted={disrupted} center={[commute.from.lat, commute.from.lng]} flyTo={flyTo} onStop={setStop} />

        <div className="absolute inset-x-3 top-3 z-[600]">
          <label className="flex h-12 items-center gap-2 rounded-2xl bg-surface/90 px-3 shadow-xl ring-1 ring-white/10 backdrop-blur">
            <Search size={18} className="text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search bus stop — name, road or 5-digit code" className="h-full min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-slate-500 focus:outline-none" />
            {q && (
              <button onClick={() => setQ('')} className="grid h-11 w-11 place-items-center" aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </label>
          {results.length > 0 && (
            <ul className="mt-1.5 overflow-hidden rounded-2xl bg-surface-raised shadow-2xl ring-1 ring-white/10">
              {results.map((r) => (
                <li key={r.code}>
                  <button onClick={() => nav(`/stop/${r.code}`)} className="flex min-h-[52px] w-full items-center gap-3 border-b border-white/5 px-4 text-left active:bg-white/5">
                    <span className="rounded-md bg-emerald-600/20 px-1.5 py-0.5 font-mono text-[12px] text-emerald-300">{r.code}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] text-white">{r.name}</span>
                      <span className="block truncate text-[12px] text-slate-500">{r.road}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="absolute bottom-6 left-3 z-[600] rounded-xl bg-surface/85 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
          <p className="mb-1 font-semibold text-slate-200">Station crowd · live</p>
          <p className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" />Low</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Mod</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />High</span>
          </p>
          <p className="mt-1 text-slate-500">Zoom in for bus stops</p>
        </div>
        <button onClick={locate} className="absolute bottom-6 right-3 z-[600] grid h-12 w-12 place-items-center rounded-full bg-brand-500 shadow-xl" aria-label="Go to my location">
          <LocateFixed size={20} />
        </button>
      </div>
      <Sheet open={!!stop} onClose={() => setStop(null)} title="Live arrivals">
        {stop && <ArrivalPanel code={stop.code} />}
      </Sheet>
    </div>
  );
}
