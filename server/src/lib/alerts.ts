import { cached } from './cache.js';
import { ltaFetch } from './datamall.js';
import { lineFromAnyCode, LINES } from './lines.js';

interface RawSegment {
  Line: string;
  Direction: string;
  Stations: string;
  FreePublicBus: string;
  FreeMRTShuttle: string;
  MRTShuttleDirection: string;
}
interface RawMessage {
  Content: string;
  CreatedDate: string;
}
// TrainServiceAlerts is the one DataMall endpoint whose `value` is an object, not an array.
export interface RawTrainAlerts {
  value: { Status: number; AffectedSegments: RawSegment[]; Message: RawMessage[] };
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
export type MessageKind = 'planned' | 'bus' | 'disruption' | 'info';
export interface ServiceMessage {
  content: string;
  created: string;
  lines: string[];
  kind: MessageKind;
}
export interface TrainAlertsView {
  status: 1 | 2;
  simulated: boolean;
  scenario: string | null;
  scenarioLabel: string | null;
  disruptions: Disruption[];
  messages: ServiceMessage[];
  fetchedAt: number;
}

const split = (s: string | undefined) =>
  (s ?? '')
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter((x) => /^[A-Z]{2,3}\d*[A-Z]?$/.test(x));

const PREFIX_LINE: Record<string, string> = {
  BP: 'BPL', SK: 'SKLRT', PG: 'PGLRT', EW: 'EWL', NS: 'NSL', NE: 'NEL', CC: 'CCL', DT: 'DTL', TE: 'TEL',
};
const NAME_PATTERNS: [RegExp, string][] = [
  [/\bEWL\b|east[- ]west/i, 'EWL'],
  [/\bNSL\b|north[- ]south/i, 'NSL'],
  [/\bNEL\b|north[- ]east line/i, 'NEL'],
  [/\bCCL\b|circle line/i, 'CCL'],
  [/\bDTL\b|downtown line/i, 'DTL'],
  [/\bTEL\b|thomson/i, 'TEL'],
  [/\bBPLRT\b|bukit panjang lrt/i, 'BPL'],
  [/sengkang (west |east )?lrt|\bSKLRT\b/i, 'SKLRT'],
  [/punggol (west |east )?lrt|\bPGLRT\b/i, 'PGLRT'],
];

function classify(content: string): ServiceMessage {
  const lines = new Set<string>();
  const prefix = content.match(/^\s*\d{1,2}:\d{2}-([A-Z]{2})-/);
  if (prefix && PREFIX_LINE[prefix[1]]) lines.add(PREFIX_LINE[prefix[1]]);
  for (const [re, id] of NAME_PATTERNS) if (re.test(content)) lines.add(id);
  let kind: MessageKind = 'info';
  if (/no train service|delay|fault|disrupt|additional .* travel time/i.test(content)) kind = 'disruption';
  else if (/planned|closed|closure|renewal|adjust/i.test(content)) kind = 'planned';
  else if (/bus services?\b.*(divert|skip|amend)/i.test(content)) kind = 'bus';
  return { content, created: '', lines: [...lines], kind };
}

export function normaliseAlerts(raw: RawTrainAlerts, scenario: Scenario | null): TrainAlertsView {
  const v = raw.value;
  const messages = (v.Message ?? []).map((m) => ({ ...classify(m.Content), created: m.CreatedDate }));
  const disruptions: Disruption[] = (v.AffectedSegments ?? []).map((s) => {
    const line = lineFromAnyCode(s.Line);
    const related = messages.find((m) => line && m.lines.includes(line.id) && m.kind === 'disruption');
    const delay = related?.content.match(/(\d+)\s*min/i);
    return {
      line: line?.id ?? s.Line,
      lineName: line?.name ?? s.Line,
      status: v.Status === 2 ? 2 : 1,
      direction: s.Direction,
      stations: split(s.Stations),
      freeBusStations: split(s.FreePublicBus),
      freeBusIslandWide: /island ?wide/i.test(s.FreePublicBus ?? ''),
      shuttleStations: split(s.FreeMRTShuttle),
      shuttleDirection: s.MRTShuttleDirection,
      delayMin: delay ? Number(delay[1]) : null,
    };
  });
  return {
    status: v.Status === 2 ? 2 : 1,
    simulated: !!scenario,
    scenario: scenario?.id ?? null,
    scenarioLabel: scenario?.label ?? null,
    disruptions,
    messages,
    fetchedAt: Date.now(),
  };
}

// Replay scenarios. AffectedSegments is empty on a normal day (PS2 §2.6), so the major-disruption
// path is demonstrated with injected data. The live Message stream is still merged in underneath, and
// every response carries simulated:true so the UI can label it.
export interface Scenario {
  id: string;
  label: string;
  build: (now: Date) => RawTrainAlerts['value'];
}
const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`, hm: `${p(d.getHours())}:${p(d.getMinutes())}` };
};
export const SCENARIOS: Scenario[] = [
  {
    id: 'ewl-track-fault',
    label: 'EWL track fault · Tanah Merah ↔ Paya Lebar (no service)',
    build: (now) => {
      const t = stamp(new Date(now.getTime() - 9 * 60000));
      return {
        Status: 2,
        AffectedSegments: [
          {
            Line: 'EWL',
            Direction: 'Both',
            Stations: 'EW4,EW5,EW6,EW7,EW8',
            FreePublicBus: 'EW4,EW5,EW6,EW7,EW8',
            FreeMRTShuttle: 'EW4,EW5,EW6,EW7,EW8',
            MRTShuttleDirection: 'Both',
          },
        ],
        Message: [
          {
            Content: `${t.hm}-EWL: No train service between Tanah Merah and Paya Lebar in both directions due to a track fault. Free regular bus services and free bridging bus services are available at designated bus stops near affected stations. Estimated additional travel time of 30 mins.`,
            CreatedDate: t.date,
          },
        ],
      };
    },
  },
  {
    id: 'ewl-signal-delay',
    label: 'EWL signalling fault · +20 min Pasir Ris ↔ Paya Lebar (delays)',
    build: (now) => {
      const t = stamp(new Date(now.getTime() - 6 * 60000));
      return {
        Status: 1,
        AffectedSegments: [
          { Line: 'EWL', Direction: 'Both', Stations: 'EW1,EW2,EW3,EW4,EW5,EW6,EW7,EW8', FreePublicBus: '', FreeMRTShuttle: '', MRTShuttleDirection: '' },
        ],
        Message: [
          {
            Content: `${t.hm}-EWL: Due to a signalling fault, please add 20 mins train travel time between Pasir Ris and Paya Lebar.`,
            CreatedDate: t.date,
          },
        ],
      };
    },
  },
];
export const scenarioById = (id: string | undefined | null) => SCENARIOS.find((s) => s.id === id) ?? null;

export async function getTrainAlerts(scenarioId?: string | null): Promise<TrainAlertsView> {
  const live = await cached('TrainServiceAlerts', 30_000, () => ltaFetch<RawTrainAlerts>('TrainServiceAlerts'));
  const scenario = scenarioById(scenarioId);
  if (!scenario) return normaliseAlerts(live, null);
  const inj = scenario.build(new Date());
  return normaliseAlerts(
    { value: { Status: inj.Status, AffectedSegments: inj.AffectedSegments, Message: [...inj.Message, ...(live.value.Message ?? [])] } },
    scenario,
  );
}

export const allLineIds = () => LINES.map((l) => l.id);
