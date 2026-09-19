import { useEffect } from 'react';
import { api } from '@/api/datamall';
import { nowcast } from '@/api/weather';
import { useStore } from '@/store/useStore';

function useInterval(fn: () => void, ms: number, deps: unknown[]) {
  useEffect(() => {
    fn();
    const t = setInterval(() => document.visibilityState === 'visible' && fn(), ms);
    const onVis = () => document.visibilityState === 'visible' && fn();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// TrainServiceAlerts every 60 s (CIE rule inputs 1, 4 and planned notices).
export function useAlerts() {
  const scenario = useStore((s) => s.scenario);
  useInterval(() => {
    api
      .trainAlerts(scenario)
      .then((alerts) => useStore.getState().set({ alerts, alertsError: false }))
      .catch((e: Error) => {
        useStore.getState().set({ alertsError: true });
        useStore.getState().toast(`Train alerts: ${e.message}`);
      });
  }, 60_000, [scenario]);
}

// Station Crowd Density real-time every 120 s.
export function useCrowding() {
  useInterval(() => {
    api
      .crowdNow()
      .then((r) => useStore.getState().set({ crowdNow: r.stations }))
      .catch(() => undefined);
  }, 120_000, []);
}

// NEA 2-hour nowcast every 300 s, at both ends of the saved commute.
export function useWeather() {
  const commute = useStore((s) => s.commute);
  useInterval(() => {
    Promise.all([nowcast(commute.from.lat, commute.from.lng), nowcast(commute.to.lat, commute.to.lng)])
      .then(([weather, weatherDest]) => useStore.getState().set({ weather, weatherDest }))
      .catch(() => undefined);
  }, 300_000, [commute.from.lat, commute.to.lat]);
}

export function useLiveFeeds() {
  useAlerts();
  useCrowding();
  useWeather();
}
