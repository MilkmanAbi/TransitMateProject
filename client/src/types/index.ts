export type LoadCode = 'SEA' | 'SDA' | 'LSD' | '';
export type CrowdLevel = 'l' | 'm' | 'h' | 'NA';
export type ProfileId = 'rachel' | 'arjun' | 'lim';
export type LatLng = [number, number];

// ---- DataMall raw shapes -------------------------------------------------
export interface DataMallResponse<T> {
  'odata.metadata': string;
  value: T[];
}
export interface RawNextBus {
  OriginCode: string;
  DestinationCode: string;
  EstimatedArrival: string;
  Monitored: number;
  Latitude: string;
  Longitude: string;
  VisitNumber: string;
  Load: LoadCode;
  Feature: string;
  Type: 'SD' | 'DD' | 'BD' | '';
}
export interface RawBusArrival {
  BusStopCode: string;
  Services: { ServiceNo: string; Operator: string; NextBus: RawNextBus; NextBus2: RawNextBus; NextBus3: RawNextBus }[];
  stop: { code: string; name?: string; road?: string; lat?: number; lng?: number };
  destinations: Record<string, string | null>;
  fetchedAt: number;
}

// ---- Normalised --------------------------------------------------------
export interface BusETA {
  mins: number;
  at: number;
  load: LoadCode;
  type: string;
  wab: boolean;
  monitored: boolean;
}
export interface ServiceArrivals {
  service: string;
  operator: string;
  destination: string | null;
  buses: BusETA[];
}
export interface StopArrivals {
  stop: RawBusArrival['stop'];
  services: ServiceArrivals[];
  fetchedAt: number;
}
export interface StopSummary {
  code: string;
  name: string;
  road: string;
  lat: number;
  lng: number;
  m?: number;
  services?: string[];
}

export interface Disruption {
  line: string;
  lineName: string;
  status: 1 | 2;
  direction: string;
  stations: string[];
  freeBusStations: string[];
  freeBusIslandWide: boolean;
  shuttleStations: string[];
  shuttleDirection: string;
  delayMin: number | null;
}
export interface ServiceMessage {
  content: string;
  created: string;
  lines: string[];
  kind: 'planned' | 'bus' | 'disruption' | 'info';
}
export interface TrainAlerts {
  status: 1 | 2;
  simulated: boolean;
  scenario: string | null;
  scenarioLabel: string | null;
  disruptions: Disruption[];
  messages: ServiceMessage[];
  fetchedAt: number;
}

export interface Place {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  kind?: 'station' | 'place' | 'current';
}

export interface LegEnd {
  name: string;
  lat: number;
  lng: number;
  code?: string;
}
export interface Leg {
  mode: 'walk' | 'mrt' | 'bus' | 'shuttle';
  from: LegEnd;
  to: LegEnd;
  minutes: number;
  min: number;
  max: number;
  waitMin: number;
  km: number;
  line?: string;
  lineName?: string;
  color?: string;
  service?: string;
  alsoServices?: string[];
  headsign?: string;
  stops?: number;
  stations?: string[];
  path: LatLng[];
  affectedPaths?: LatLng[][];
  live?: { eta: string; load: LoadCode; wab: boolean; type: string; monitored: boolean } | null;
  crowd?: { level: CrowdLevel; source: 'realtime' | 'forecast' };
  free?: boolean;
  delayMin?: number;
  blocked?: boolean;
  liftOut?: string[];
  note?: string;
}
export interface RouteOption {
  id: string;
  kind: 'rail' | 'bus' | 'bus+rail' | 'rail+bus' | 'walk';
  summary: string;
  legs: Leg[];
  minutes: number;
  min: number;
  max: number;
  walkMin: number;
  transfers: number;
  fare: number;
  cost: number;
  tags: string[];
  feasible: boolean;
  signature: string;
}
export interface AreaForecast {
  area: string;
  forecast: string;
  wet: boolean;
  heavy: boolean;
}
export interface PlanResult {
  generatedAt: number;
  departAt: number;
  from: Place;
  to: Place;
  profile: ProfileId;
  options: RouteOption[];
  usual: RouteOption | null;
  usualLive: RouteOption | null;
  changed: boolean;
  why: string[];
  weather: { origin: AreaForecast | null; dest: AreaForecast | null };
  simulated: boolean;
  scenarioLabel: string | null;
  disruptions: Disruption[];
}

export interface CrowdForecast {
  line: string;
  stations: Record<string, { start: number; level: CrowdLevel }[]>;
}
export interface LiftOutage {
  Line: string;
  StationCode: string;
  StationName: string;
  LiftID: string;
  LiftDesc: string;
}
export interface TaxiCount {
  total: number;
  near: number | null;
  radiusKm: number;
  fetchedAt: number;
}

export type CIESeverity = 'critical' | 'warning' | 'info' | 'ok';
export interface CIERecommendation {
  id: string;
  severity: CIESeverity;
  kind: 'disruption' | 'crowding' | 'weather' | 'planned' | 'lift' | 'leave' | 'network';
  title: string;
  body: string;
  action?: { label: string; route: string };
  co2Delta?: number;
  timestamp: number;
  simulated?: boolean;
  affectsYou?: boolean;
}

export interface Commute {
  from: Place;
  to: Place;
  departTime: string;
  arriveBy: string;
  days: number[];
}
