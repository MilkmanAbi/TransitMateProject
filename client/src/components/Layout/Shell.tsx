import { Bell, Home, Map, Route, WifiOff, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useOnline } from '@/hooks/useOnline';
import { ago } from '@/lib/format';
import { useStore } from '@/store/useStore';

const NAV = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/plan', label: 'Plan', icon: Route },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/map', label: 'Map', icon: Map },
];

function BottomNav() {
  const alerts = useStore((s) => s.alerts);
  const badge = (alerts?.disruptions.length ?? 0) > 0;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[1000] border-t border-white/10 bg-surface/90 backdrop-blur-xl" style={{ paddingBottom: 'var(--safe-bottom)' }}>
      <div className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium ${isActive ? 'text-brand-400' : 'text-slate-400'}`}
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute top-0 h-[3px] w-10 rounded-b-full bg-brand-400" />}
                <span className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                  {label === 'Alerts' && badge && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-surface" />}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function StatusBanners() {
  const { alerts, scenario, set } = useStore();
  const online = useOnline();
  const loc = useLocation();
  const live = alerts?.disruptions ?? [];
  return (
    <div className="sticky top-0 z-[1001] bg-surface" style={{ paddingTop: 'var(--safe-top)' }}>
      {!online && (
        <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 text-[0.8125rem] text-slate-200">
          <WifiOff size={16} /> Offline — showing your last saved journey{alerts ? ` (alerts from ${ago(alerts.fetchedAt)})` : ''}.
        </div>
      )}
      {scenario && (
        <div className="sim-stripes flex items-center gap-2 border-b border-amber-500/40 px-4 py-1.5 text-[0.75rem] font-semibold text-amber-200">
          <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[0.625rem] font-black tracking-wider text-black">SIMULATED</span>
          <span className="flex-1 truncate">Replay: {alerts?.scenarioLabel ?? 'injected disruption'}</span>
          <button onClick={() => set({ scenario: null })} className="-my-1.5 grid h-11 w-11 place-items-center rounded-full active:bg-white/10" aria-label="End simulation">
            <X size={16} />
          </button>
        </div>
      )}
      {live.length > 0 && loc.pathname !== '/alerts' && (
        <NavLink to="/alerts" className="flex items-center gap-2 bg-red-600 px-4 py-2 text-[0.8125rem] font-semibold text-white">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          <span className="flex-1 truncate">
            {live.map((d) => `${d.lineName}: ${d.status === 2 ? 'no service' : 'delays'} ${d.stations[0]}–${d.stations[d.stations.length - 1]}`).join(' · ')}
          </span>
          <span className="text-[0.75rem] underline">Details</span>
        </NavLink>
      )}
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[1002] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`pointer-events-auto max-w-md animate-rise rounded-xl px-4 py-2.5 text-[0.8125rem] font-medium shadow-xl ${t.tone === 'error' ? 'bg-red-600/95 text-white' : 'bg-slate-700/95 text-slate-100'}`}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <StatusBanners />
      <main className="mx-auto max-w-md px-4 pb-28 pt-3">{children}</main>
      <Toasts />
      <BottomNav />
    </div>
  );
}
