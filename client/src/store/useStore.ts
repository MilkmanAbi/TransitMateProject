import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AreaForecast, Commute, CrowdLevel, PlanResult, ProfileId, TrainAlerts } from '@/types';

export interface Persona {
  id: ProfileId;
  name: string;
  blurb: string;
  commute: Commute;
  threshold: number;
  largeText: boolean;
  lines: string[];
  stops: string[];
}

// The three personas from the PS2 brief. Rachel is the one we build and demo for; the others show that the
// same engine re-weights decisions (crowds for Arjun, step-free and walking for Mdm Lim).
export const PERSONAS: Persona[] = [
  {
    id: 'rachel',
    name: 'Rachel',
    blurb: 'Fixed schedule · EWL · only interrupt me when it matters',
    threshold: 10,
    largeText: false,
    lines: ['EWL'],
    stops: ['75009', '03031'],
    commute: {
      from: { name: 'Home · Tampines Central', lat: 1.35355, lng: 103.94508 },
      to: { name: 'Office · One Raffles Place', lat: 1.28437, lng: 103.85122 },
      departTime: '07:40',
      arriveBy: '08:45',
      days: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'arjun',
    name: 'Arjun',
    blurb: 'Flexible start · avoids crowds · will leave later for comfort',
    threshold: 15,
    largeText: false,
    lines: ['PGLRT', 'NEL', 'CCL'],
    stops: ['65259', '18051'],
    commute: {
      from: { name: 'Home · Punggol Central', lat: 1.40525, lng: 103.90237 },
      to: { name: 'Work · one-north', lat: 1.29983, lng: 103.78752 },
      departTime: '08:30',
      arriveBy: '10:00',
      days: [1, 2, 3, 4, 5],
    },
  },
  {
    id: 'lim',
    name: 'Mdm Lim',
    blurb: 'Step-free · slow walker · warn me the day before',
    threshold: 5,
    largeText: true,
    lines: ['EWL'],
    stops: ['84009', '06011'],
    commute: {
      from: { name: 'Home · Bedok North Ave 1', lat: 1.32706, lng: 103.93155 },
      to: { name: 'Singapore General Hospital', lat: 1.27950, lng: 103.83480 },
      departTime: '09:00',
      arriveBy: '10:30',
      days: [0, 1, 2, 3, 4, 5, 6],
    },
  },
];

export interface Toast {
  id: number;
  text: string;
  tone: 'error' | 'info';
}

interface State {
  profile: ProfileId;
  commute: Commute;
  threshold: number;
  largeText: boolean;
  savedStops: string[];
  scenario: string | null;
  onboarded: boolean;
  lastCommutePlan: PlanResult | null;
  lastPlan: PlanResult | null;

  alerts: TrainAlerts | null;
  alertsError: boolean;
  crowdNow: Record<string, CrowdLevel>;
  weather: AreaForecast | null;
  weatherDest: AreaForecast | null;
  toasts: Toast[];

  setPersona: (id: ProfileId) => void;
  setCommute: (c: Partial<Commute>) => void;
  set: (p: Partial<State>) => void;
  toggleStop: (code: string) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: 'rachel',
      commute: PERSONAS[0].commute,
      threshold: PERSONAS[0].threshold,
      largeText: false,
      savedStops: ['75009', '03031'],
      scenario: null,
      onboarded: false,
      lastCommutePlan: null,
      lastPlan: null,

      alerts: null,
      alertsError: false,
      crowdNow: {},
      weather: null,
      weatherDest: null,
      toasts: [],

      setPersona: (id) => {
        const p = PERSONAS.find((x) => x.id === id) ?? PERSONAS[0];
        set({ profile: p.id, commute: p.commute, threshold: p.threshold, largeText: p.largeText, savedStops: p.stops, lastCommutePlan: null });
      },
      setCommute: (c) => set({ commute: { ...get().commute, ...c }, lastCommutePlan: null }),
      set: (p) => set(p),
      toggleStop: (code) => {
        const s = get().savedStops;
        set({ savedStops: s.includes(code) ? s.filter((x) => x !== code) : [code, ...s].slice(0, 6) });
      },
      toast: (text, tone = 'error') => {
        const id = ++toastId;
        if (get().toasts.some((t) => t.text === text)) return;
        set({ toasts: [...get().toasts, { id, text, tone }] });
        setTimeout(() => get().dismissToast(id), 4500);
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
    }),
    {
      name: 'tm_state_v1',
      storage: createJSONStorage(() => localStorage),
      // Journeys are cached so the app still shows the plan underground with no signal (PS2 §2.6).
      partialize: (s) => ({
        profile: s.profile,
        commute: s.commute,
        threshold: s.threshold,
        largeText: s.largeText,
        savedStops: s.savedStops,
        scenario: s.scenario,
        onboarded: s.onboarded,
        lastCommutePlan: s.lastCommutePlan,
        lastPlan: s.lastPlan,
        alerts: s.alerts,
      }),
    },
  ),
);
