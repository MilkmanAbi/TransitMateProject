# TransitMate — Write-up

NEBULA X 2026 · PS2 Smart Commuter Companion

## 1. Persona: Rachel, the fixed-schedule commuter

We built for **Rachel** (PS2 §2.2): Tampines → Raffles Place on the EWL, leaves 07:40, must be at her desk by 08:45, and doesn't open an app on a normal day.

That shaped four product decisions:

| Rachel's need (from the brief) | What TransitMate does |
|---|---|
| "Interrupted *only* when it matters" | The Home verdict is **All clear** unless her usual trip gets worse by at least her **threshold** (10 min by default, adjustable to 5/15/20) or becomes infeasible. Sub-threshold delays go into a collapsed "N notices checked — none need you" list, not a red card. |
| "Told what to do in one line" | The critical card and hero headline are an instruction ("Take DTL today · Walk 5 min, then Downtown Line from Tampines to Telok Ayer"), not a status ("EWL delays"). |
| A 15-minute delay costs her a meeting | Every option is a **range** (best–worst case). The engine checks the *worst case* against her 08:45 deadline and gives a "Leave by" time. |
| She commutes on a fixed schedule | The commute is saved. Before her usual departure (same day, within 3 h) the app plans *for 07:40*. Otherwise it plans "if you left now" and says so. The "At 07:40" toggle plans the next commute day ("tomorrow") ahead of time. |

The other two personas exist as **profiles over the same engine**, not as separately designed products. We don't claim to serve them fully:

- **Arjun** raises the crowding penalty 5×.
- **Mdm Lim** gets slower walking speed (55 m/min), heavy walk and transfer penalties, a lift-outage penalty and large text.

Switching persona visibly re-ranks the same trip.

## 2. Architecture

```
 Phone browser (React 18 PWA, mobile-first)                  Express server (Node, TypeScript)
 ┌──────────────────────────────────────────┐   /api/*    ┌─────────────────────────────────────────┐
 │ Home: commute verdict + CIE feed          │ ──────────► │ DataMall proxy (AccountKey, TTL cache)   │──► LTA DataMall
 │ Plan: options, map, why-changed           │             │ Network: 5,208 stops · 798 route patterns│
 │ Alerts: live notices, lifts, replay       │             │         · 220-station rail graph (OSM)   │
 │ Map: live station crowding, stops         │             │ Planner: rail Dijkstra + bus/bus↔rail    │──► FOSSGIS OSRM (OSM foot)
 │ lib/cie.ts — rules engine (client)        │             │ Alerts parser + canonical line table     │──► data.gov.sg nowcast
 │ localStorage: commute, last plan, alerts  │             │ Weather, OneMap search, taxi count       │──► OneMap search
 │ Service worker: offline app shell         │             └─────────────────────────────────────────┘
 └──────────────────────────────────────────┘
        ▲ OSM raster tiles (OSM France / HOT), © OpenStreetMap contributors
```

- **Server.** It is stateless apart from TTL caches in memory, plus a 24 h disk cache of the static bus network in `server/.cache/`. The DataMall key only lives here. The API wrapper is ported from the BusTech reference project (`api/lta.js`: AccountKey header injection, pass-through, `/api/lta?path=` compatibility).
- **Client.** It holds no keys. It polls `TrainServiceAlerts` every 60 s, crowding every 120 s, weather every 300 s, bus arrivals every 30 s, and the commute plan every 60 s. Polling pauses when the tab is hidden and refreshes the moment it becomes visible again.

## 3. Route planning (PS2 §3.2.1)

Written in `server/src/lib/planner.ts`. This is not a wrapper around a third-party journey planner.

1. **Rail graph.** Station points and codes (`EW2`, `DT32`, …) come from an **OpenStreetMap Overpass extract** (`scripts/build-mrt.py` → `server/src/data/mrt.json`).
   - Edges link consecutive codes per line, plus the CG branch, the CE/CC34 spur and the LRT loops.
   - Edge time = straight-line distance × 1.15 at 45 km/h (MRT) or 25 km/h (LRT), plus 0.5 min dwell.
   - Interchanges are stations sharing a name (30 groups). A transfer costs 4 min plus the persona's penalty.
2. **Access and egress.** Up to 5 stations within the persona's walking radius (1.1 km for Rachel) and up to 12 bus stops within 500 m of each end.
3. **Candidates.**
   - **Rail:** multi-source Dijkstra from the access stations, with two more "penalised" runs to find genuinely different alternatives (e.g. DTL vs EWL).
   - **Direct bus:** every DataMall `BusRoutes` pattern that serves an access stop and then, later in its sequence, an egress stop.
   - **Bus → rail and rail → bus:** a bus leg to or from any stop within 350 m of a station, joined to a forward or reverse Dijkstra tree. Bus ride time comes from `BusRoutes.Distance` at 18 km/h (peak) or 21 km/h, and the wait from `BusServices` headways.
4. **Live conditions.**
   - `TrainServiceAlerts`:
     - `Status 2` segments block rail edges. Where `FreeMRTShuttle` is listed, a slower **bridging-bus** edge replaces them (2.4× rail time).
     - Delay segments add the delay parsed from the message ("add 20 mins"), or 10 min if none is stated.
     - `FreePublicBus` stations mark bus legs that board and alight near them as **free**.
   - `PCDRealTime` / `PCDForecast` add a persona-weighted penalty when the boarding station is `h`.
   - The NEA nowcast raises the cost of open-air walking at a wet end.
   - `v2/FacilitiesMaintenance` lift outages penalise transfers there for Mdm Lim.
5. **Ranking** uses a generalised cost:
   `minutes + walk penalty + rain·walk + transfers·penalty + spread·(max−min) + crowd + lift`.
   Buses that serve the same stop pair are merged into one option ("Bus 650 · or bus 660").
6. **Enrichment of the top 3.**
   - Walking legs are routed on **OSM footpaths** (FOSSGIS OSRM `routed-foot`), giving real geometry and distance.
   - If you leave within 45 min, the bus wait is replaced by the **live `v3/BusArrival` ETA** of the first bus you can catch, with its `Load`, `WAB` and `Monitored` flag.
   - Boarding-station crowding comes from the forecast (departures more than 20 min away) or real-time.
7. **"Why it changed".** The planner also runs with *no* live conditions to get the **usual** route. It then re-evaluates that route under live conditions (`usualLive`: infeasible, bridged or slower) and compares it with the new best. The difference is written out in plain language and drawn on the map: usual route dashed, affected stretch red, recommendation solid.

**Uncertainty.** Each leg carries a min/max:
- rail: 0.95–1.1× ride time, plus up to one headway of waiting (2.5 min peak / 5 min off-peak; LRT 3.5/6); delays widen the range by 1.6×
- bus ride: 0.8–1.35×
- live bus wait: ETA −1/+2 min
- timetable-only bus wait: 1 min to one full headway
- walking: 0.9–1.2×

The UI leads with the range and shows the expected value second.

## 4. Commuter Intelligence Engine (`client/src/lib/cie.ts`)

A deterministic rules engine. Every card traces back to a feed field and a threshold.

| Rule | Input | Fires when | Output |
|---|---|---|---|
| Reroute | `TrainServiceAlerts` (live or planned closure) + plan | Usual route infeasible or bridged, or a line on it is slower by ≥ the commuter's threshold | **critical**: one-line instruction, minutes vs normal, free-bus note, CO₂ |
| Below threshold | same | Line on route affected but extra < threshold | quiet: "under your N-min threshold, not interrupting you", plus the alternative if one is better |
| Better option | plan (rain/crowd weighting) | Recommended route differs with no disruption on the route | info card: "Today X suits you better than Y" (no interruption) |
| Other lines | `TrainServiceAlerts` | Disruption off your route | warning (quiet if already rerouting) + taxi count |
| Crowding | `PCDForecast` at boarding station and time | Level `h` | warning + nearest time (±60 min) with a lower forecast |
| Rain | NEA 2-h nowcast, both ends | Rain / showers / thunder | info (warning if heavy) + end-walk minutes |
| Planned notices | `TrainServiceAlerts.Message` | Mentions a line on your route (line codes, names, `BP-`/`SK-` prefixes) | warning; otherwise quiet |
| Lift outage | `v2/FacilitiesMaintenance` | Station on the plan | warning for Mdm Lim, quiet otherwise |
| Deadline | plan + arrive-by | Worst-case arrival > arrive-by | warning / critical + "leave by" |

**Use of AI (PS2 §3.3.1).** We deliberately used rules, not a model. Every recommendation must be explainable in one sentence, reproducible by a judge from the same feed, and must keep working offline. Nothing needs a paid API. AI (Claude Code) was used to *build* the app, not inside it.

## 5. Planned vs unplanned events

- **Planned closures are routed, not just listed.** `plannedClosuresOn()` reads whole-line closures with dates out of the live notice stream (e.g. *"Bukit Panjang LRT will be closed on 20 Sep and 27 Sep 2026 … use shuttle and regular bus services"*). When the departure date matches, the planner blocks that line and adds bridging-bus edges.
  - A trip from Senja to Choa Chu Kang **tomorrow** is rerouted to bus 190 with *"Planned closure: … closed on Sun 20 Sept for renewal works"*. The same trip **today** uses the LRT.
  - Partial closures (a single loop direction, an exit or a lift) are shown but not routed around.
- **Planned: live, not simulated.** Today's feed carried a real bus diversion (170/170X), a **Bukit Panjang LRT closure on 20 and 27 Sep**, and a **Sengkang West LRT inner-loop closure until 18 Oct**. The Alerts tab classifies these as *Planned* or *Bus diversion*, tags the line, and marks each one "on your route" or not. For Rachel (EWL) they sit in the quiet list, because not interrupting her is the correct behaviour. The raw capture is in `fixtures/train-alerts-2026-09-19-live.json`.
- **Unplanned (major).** `AffectedSegments` was empty all day, so this path is shown by **replay**. `server/src/lib/alerts.ts` defines two scenarios in the exact `TrainServiceAlerts` shape: an EWL track fault Tanah Merah–Paya Lebar with free bus and bridging bus, and an EWL signalling fault with +20 min. They are enabled from the Alerts tab.
  - Every response carries `simulated: true`, and the UI labels each touched element **SIMULATED** (striped banner, card badges).
  - The replay is merged *on top of* the live `Message` stream. Bus arrivals, crowding, weather and taxis stay live throughout.

## 6. Underground / no signal (PS2 §2.6)

- **Decision:** cache and say so plainly.
- A **service worker** caches the app shell. The API uses network-first with a 6 s timeout, and map tiles are cache-first.
- The **last commute plan, last planned journey and last alerts** are persisted in `localStorage`, so reopening the app underground still shows the full journey and map.
- An **Offline** banner appears. The hero shows "saved · N min ago" instead of a live refresh time, and every card carries its age.

## 7. Privacy

- **In the browser:** the commute (two coordinates, times, threshold), saved stop codes, the last plan, and the CO₂ trip log (`tm_co2_sessions`), all in **localStorage on the device**. Clearing site data removes everything.
- **On the server:** nothing is stored. Plan requests carry origin and destination coordinates. The server passes them to the OSM foot router and caches results in memory only, keyed by coordinates, for 1 h. There is no request logging, analytics or accounts.
- **Location:** only read when the user taps "Current location", and never stored beyond the plan.

## 8. Assumptions

- **Operating stations.** Stations known to be unopened are excluded by hand: CC18, TE10, TE21, TE22A, NS3A, the whole JRL (J\*) and CRL (CR\*/CP\*). OSM tags and even LTA's PCD feed list some unopened stations, so neither can be used as a filter. CCL6 (CC30–32), TEL (TE30–31) and DTL (DT36–37) are **assumed open** because LTA's PCD feed reports live crowd levels for them. Rachel's journey doesn't depend on this.
- **Canonical line table.** The same line has different codes across feeds (`server/src/lib/lines.ts`):
  - Alerts use `STL`/`PTL`/`BPL` (with CG and CE folded into `EWL`/`CCL`).
  - Station Crowd Density uses `SLRT`/`PLRT`/`CGL`/`CEL`.
  - OSM now numbers Bayfront and Marina Bay CC34/CC33, which we map back to CE1/CE2 for crowding.
- **Timing model.** Train timing uses typical headways and distance-based speeds, not a timetable; nothing public exposes MRT timetables. Bus ride speed is 18/21 km/h, and bus headways come from `BusServices` frequency bands.
- **Disruption direction.** An affected segment is treated as blocked in both directions, even when `Direction` names one. This is conservative.
- **Estimates.**
  - Fares: `0.99 + 0.075 × km`, capped at $2.37. This is an estimate: DataMall has no fare API.
  - CO₂: fixed per-km factors (MRT 0.0028, bus 0.0089, taxi 0.14 kg/pkm). The taxi baseline assumes the same distance by road. These are illustrative, not audited.
- **Peak hours.** Weekdays 07:00–09:30 and 17:00–20:00 SGT.

## 9. Numbers we quote, and how we got them

| Claim | How it was measured |
|---|---|
| 5,208 bus stops · 798 route patterns · 220 rail stations | Server start-up log (`[network] …`) after loading DataMall `BusStops`/`BusRoutes`/`BusServices` and `mrt.json` on 19 Sep 2026 |
| 30 interchange groups, 217 rail edges | Output of `python scripts/build-mrt.py` |
| Plan latency 0.2–1.2 s | `curl -w %{time_total}` against `/api/plan`, 5 trips (Tampines–Raffles Place, Punggol–one-north, Jurong East–Changi Airport, Woodlands–HarbourFront, Bedok North–SGH) on the dev laptop. The first request of a trip includes OSM foot routing; repeats hit the cache. |
| "Take DTL, +1 min vs a normal day" (EWL fault replay) and "+6 min" (signalling-fault replay) | Planner output for Tampines Central → One Raffles Place at the time of the run. The value changes with live bus/crowd data and departure time. |
| Sample routes are sensible | Planner output on the 5 trips above: Punggol→one-north = NEL→CCL via Serangoon, Woodlands→HarbourFront = TEL→NEL via Outram Park, Jurong East→Changi Airport = EWL direct. Checked by hand against the network map. **Ride times were not validated against a timetable.** |

## 10. Known limitations

- **Transfers.** At most one bus leg per journey (no bus→bus transfers) and at most one change of mode between bus and rail.
- **Inside stations.** No routing through station interiors (which exit, lift location). Lift outages affect ranking but not an exit-level path.
- **Forecast horizon.** `PCDForecast` covers today only; for a "tomorrow" plan the crowd hint falls back to real-time.
- **Third-party services.**
  - Walking geometry uses the public FOSSGIS OSRM demo server and falls back to straight lines (×1.25) if it's slow.
  - Tiles are OSM France / HOT community tiles. Production should self-host tiles and OSRM (GraphHopper or Valhalla on a Geofabrik extract).
  - OneMap search is used without a token and may need registration in future. Station names still resolve locally.
- **No push notifications.** Proactivity is in-app (verdict, cards, banner). A production version would add Web Push at "leave-by − 15 min".
- **HTTPS for location.** "Current location" needs HTTPS on phones; see README for a tunnel.
- **Not a native app.** Tested in Chrome with iPhone-SE-sized (375 px) emulation. It still needs a pass on a physical phone.

## 11. Beyond the brief

- **Interruption threshold with quiet mode.** The engine proves *why it stayed silent* (e.g. "EWL +4 min on your route — below your 10-min threshold").
- **Usual vs live comparison.** Every recommendation is justified against what she would normally do, both on the map and in words.
- **The mitigation is in the feed.** Free public bus stations and bridging buses from `TrainServiceAlerts` become routable, free legs.
- **Lift outages** from `v2/FacilitiesMaintenance` feed the step-free profile.
- **CO₂ saved vs taxi** per option, with a monthly counter.
- **Station footprints.** The NebulaX GeoJSON footprints appear on the Map tab when zoomed in, with ground level (underground/elevated) in the tooltip.
