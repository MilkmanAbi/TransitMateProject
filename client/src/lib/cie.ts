// Commuter Intelligence Engine: a deterministic rules engine over live feeds + the saved commute.
// No ML — every card can be traced to a DataMall/NEA field and a threshold.
import { co2SavedVsTaxi } from './co2';
import { clock12, hhmm, LINE_META, lineOfStation, todayAt } from './format';
import type {
  AreaForecast,
  CIERecommendation,
  CIESeverity,
  Commute,
  CrowdLevel,
  LiftOutage,
  PlanResult,
  ProfileId,
  RouteOption,
  TaxiCount,
  TrainAlerts,
} from '@/types';

export interface CIEInput {
  now: number;
  alerts: TrainAlerts | null;
  plan: PlanResult | null;
  commute: Commute;
  profile: ProfileId;
  threshold: number;
  weatherOrigin: AreaForecast | null;
  weatherDest: AreaForecast | null;
  crowdAtDeparture: { station: string; level: CrowdLevel; better?: { at: number; level: CrowdLevel } } | null;
  lifts: LiftOutage[];
  taxi: TaxiCount | null;
}

export type Verdict = 'clear' | 'heads-up' | 'act';
export interface CIEOutput {
  verdict: Verdict;
  headline: string;
  sub: string;
  cards: CIERecommendation[];
  quiet: CIERecommendation[];
  commuteLines: string[];
  hero: RouteOption | null;
}

const RANK: Record<CIESeverity, number> = { critical: 0, warning: 1, info: 2, ok: 3 };

export function linesOf(o: RouteOption | null | undefined): string[] {
  if (!o) return [];
  return [...new Set(o.legs.flatMap((l) => (l.mode === 'mrt' && l.line ? [l.line] : l.stations?.map(lineOfStation).filter(Boolean) as string[] ?? [])))];
}

export function firstInstruction(o: RouteOption): string {
  const ride = o.legs.find((l) => l.mode !== 'walk');
  if (!ride) return 'Walk there';
  const walk = o.legs[0]?.mode === 'walk' ? `Walk ${Math.round(o.legs[0].minutes)} min, then ` : '';
  if (ride.mode === 'bus') {
    const eta = ride.live ? ` (next in ${Math.max(0, Math.round((Date.parse(ride.live.eta) - Date.now()) / 60000))} min)` : '';
    return `${walk}bus ${ride.service} from ${ride.from.name}${eta}`;
  }
  return `${walk}${LINE_META[ride.line ?? '']?.name ?? ride.line} from ${ride.from.name} to ${ride.to.name}`;
}

export function runCIE(i: CIEInput): CIEOutput {
  const cards: CIERecommendation[] = [];
  const quiet: CIERecommendation[] = [];
  const sim = !!i.alerts?.simulated;
  const plan = i.plan;
  const best = plan?.options[0] ?? null;
  const usual = plan?.usual ?? null;
  const usualLive = plan?.usualLive ?? null;
  const commuteLines = linesOf(usual);
  const disruptions = i.alerts?.disruptions ?? [];

  // Rule 1 — MRT disruption on the saved route → reroute with live ETA
  const onRoute = disruptions.filter((d) => commuteLines.includes(d.line));
  const extra = usual && usualLive ? usualLive.minutes - usual.minutes : 0;
  const cut = usualLive && (!usualLive.feasible || usualLive.legs.some((l) => l.mode === 'shuttle'));
  let verdict: Verdict = 'clear';
  // Interrupt only if the usual trip is cut, or worse by at least the commuter's own threshold.
  const mustAct = !!(plan && best && (cut || (onRoute.length > 0 && extra >= i.threshold)));
  if (plan && best && mustAct) {
    const delta = usual ? Math.round(best.minutes - usual.minutes) : 0;
    verdict = 'act';
    cards.push({
      id: 'reroute',
      kind: 'disruption',
      severity: 'critical',
      title: `Take ${best.summary} instead${delta > 0 ? ` · +${delta} min` : ''}`,
      body: `${plan.why[0] ?? 'Your usual route is affected.'} ${firstInstruction(best)}.${onRoute.some((d) => d.freeBusStations.length) ? ' Free public bus boarding is active at affected stations.' : ''}`,
      action: { label: 'See route', route: '/plan?commute=1' },
      co2Delta: co2SavedVsTaxi(best),
      timestamp: i.alerts?.fetchedAt ?? i.now,
      simulated: sim,
      affectsYou: true,
    });
  } else if (onRoute.length) {
    quiet.push({
      id: 'minor',
      kind: 'disruption',
      severity: 'info',
      title: `${onRoute[0].lineName}: +${Math.max(0, Math.round(extra))} min on your route`,
      body: `Below your ${i.threshold}-min threshold, so TransitMate isn't interrupting you.${plan?.changed && best ? ` If you'd rather avoid it: ${best.summary} (${best.min}–${best.max} min).` : ' Leave as usual.'}`,
      action: plan?.changed ? { label: 'Compare', route: '/plan?commute=1' } : undefined,
      timestamp: i.now,
      simulated: sim,
      affectsYou: true,
    });
  } else if (plan?.changed && best && usual) {
    cards.push({
      id: 'better',
      kind: 'leave',
      severity: 'info',
      title: `Today ${best.summary} suits you better than ${usual.summary}`,
      body: plan.why.slice(-1)[0] ?? 'Live conditions favour a different route.',
      action: { label: 'Compare', route: '/plan?commute=1' },
      timestamp: i.now,
      affectsYou: true,
    });
  }

  // Rule 4 — any other MRT disruption (not on your route): brief, with taxi supply
  for (const d of disruptions.filter((x) => !commuteLines.includes(x.line))) {
    const a = d.stations[0];
    const b = d.stations[d.stations.length - 1];
    const card: CIERecommendation = {
      id: `net-${d.line}`,
      kind: 'network',
      severity: 'warning',
      title: `${d.lineName}: ${d.status === 2 ? 'no service' : 'delays'} ${a}–${b}`,
      body: `Not on your usual route.${d.freeBusStations.length || d.freeBusIslandWide ? ' Free bus boarding at affected stations.' : ''}${i.taxi ? ` ${i.taxi.near ?? i.taxi.total} taxis available ${i.taxi.near !== null ? `within ${i.taxi.radiusKm} km` : 'island-wide'}.` : ''}`,
      action: { label: 'Details', route: '/alerts' },
      timestamp: i.alerts?.fetchedAt ?? i.now,
      simulated: sim,
    };
    (verdict === 'act' ? quiet : cards).push(card);
  }

  // Rule 2 — platform crowding forecast at your departure window
  if (i.crowdAtDeparture?.level === 'h') {
    const c = i.crowdAtDeparture;
    cards.push({
      id: 'crowd',
      kind: 'crowding',
      severity: 'warning',
      title: `${c.station} forecast crowded when you board`,
      body: c.better
        ? `LTA's crowd forecast drops to ${c.better.level === 'l' ? 'low' : 'moderate'} at ${clock12(c.better.at)}. ${i.profile === 'arjun' ? 'Worth leaving then.' : 'Consider shifting your departure.'}`
        : 'Expect a crush on the platform; stand clear of the busiest doors.',
      action: { label: 'Plan', route: '/plan?commute=1' },
      timestamp: i.now,
      affectsYou: true,
    });
    if (verdict === 'clear') verdict = 'heads-up';
  }

  // Rule 3 — rain at either end of the commute
  const wet = [i.weatherOrigin, i.weatherDest].filter((w): w is AreaForecast => !!w?.wet);
  if (wet.length) {
    const lastWalk = best?.legs[best.legs.length - 1];
    cards.push({
      id: 'rain',
      kind: 'weather',
      severity: wet.some((w) => w.heavy) ? 'warning' : 'info',
      title: `${wet[0].forecast} expected at ${wet.map((w) => w.area).join(' & ')}`,
      body: `Factor in shelter time${lastWalk?.mode === 'walk' ? ` — ${Math.round(lastWalk.minutes)} min walk at the end` : ''}. Routes with less open-air walking are ranked higher while it's wet.`,
      timestamp: i.now,
      affectsYou: true,
    });
    if (verdict === 'clear' && wet.some((w) => w.heavy)) verdict = 'heads-up';
  } else if (i.weatherOrigin) {
    quiet.push({ id: 'dry', kind: 'weather', severity: 'ok', title: `${i.weatherOrigin.forecast} at ${i.weatherOrigin.area}`, body: 'No rain in the 2-hour nowcast for your route.', timestamp: i.now });
  }

  // Planned notices from the live TrainServiceAlerts Message stream
  for (const m of i.alerts?.messages ?? []) {
    if (m.kind === 'disruption' && disruptions.length) continue;
    const mine = m.lines.some((l) => commuteLines.includes(l));
    const card: CIERecommendation = {
      id: `msg-${m.created}-${m.content.slice(0, 12)}`,
      kind: 'planned',
      severity: mine ? 'warning' : 'info',
      title: m.kind === 'planned' ? `Planned: ${m.lines.map((l) => LINE_META[l]?.name ?? l).join(', ') || 'service change'}` : m.kind === 'bus' ? 'Bus diversion' : 'Service notice',
      body: m.content.replace(/^\s*[\d/]*\s*\d{1,2}:\d{2}-([A-Z]{2}-)?/, ''),
      timestamp: Date.parse(m.created.replace(' ', 'T') + '+08:00') || i.now,
      affectsYou: mine,
    };
    (mine ? cards : quiet).push(card);
    if (mine && verdict === 'clear') verdict = 'heads-up';
  }

  // Lift outages (Mdm Lim): warn when a lift at a station on the plan is out of service
  const planStations = new Set((best?.legs ?? []).filter((l) => l.mode === 'mrt').flatMap((l) => [l.from.code, l.to.code]));
  const liftHits = i.lifts.filter((l) => planStations.has(l.StationCode));
  if (liftHits.length) {
    const c: CIERecommendation = {
      id: 'lift',
      kind: 'lift',
      severity: i.profile === 'lim' ? 'warning' : 'info',
      title: `Lift out of service at ${liftHits[0].StationName}`,
      body: `${liftHits[0].LiftDesc}. ${i.profile === 'lim' ? 'Use another exit or allow extra time — your route avoids this where possible.' : ''}`,
      timestamp: i.now,
      affectsYou: true,
    };
    (i.profile === 'lim' ? cards : quiet).push(c);
    if (i.profile === 'lim' && verdict === 'clear') verdict = 'heads-up';
  }

  // Deadline check: will the worst case still make the arrive-by time?
  if (plan && best && plan.departAt >= i.now - 60_000) {
    const deadline = todayAt(i.commute.arriveBy, plan.departAt);
    const latest = plan.departAt + best.max * 60_000;
    if (deadline > plan.departAt && latest > deadline) {
      cards.push({
        id: 'late',
        kind: 'leave',
        severity: verdict === 'act' ? 'critical' : 'warning',
        title: `You may miss ${i.commute.arriveBy} by up to ${Math.round((latest - deadline) / 60_000)} min`,
        body: `Worst case you arrive ${hhmm(latest)}. Leave by ${hhmm(deadline - best.max * 60_000)} to be safe.`,
        timestamp: i.now,
        affectsYou: true,
      });
      if (verdict === 'clear') verdict = 'heads-up';
    }
  }

  cards.sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.timestamp - a.timestamp);

  let headline = 'Checking your commute…';
  let sub = '';
  // Below the threshold the hero keeps showing the usual route (as it runs today), not the alternative.
  let hero: RouteOption | null = best;
  if (plan && best && usual) {
    if (verdict === 'act') {
      headline = `Take ${best.summary} today`;
      sub = `${firstInstruction(best)}. ${best.min}–${best.max} min door to door.`;
    } else {
      hero = plan.changed ? (usualLive ?? usual) : best;
      if (onRoute.length) {
        headline = 'Leave as usual';
        sub = `${onRoute[0].lineName} +${Math.max(0, Math.round(extra))} min — under your ${i.threshold}-min threshold · ${hero.min}–${hero.max} min door to door`;
      } else {
        headline = verdict === 'clear' ? 'All clear — leave as usual' : 'Heads-up on your commute';
        sub = `${hero.summary} · ${hero.min}–${hero.max} min door to door`;
      }
    }
  }
  return { verdict, headline, sub, cards, quiet, commuteLines, hero };
}
