# CLAUDE.md — TransitMate

> **Read this before touching any code.** This file is the single source of truth for architecture,
> data sources, feature scope, and conventions. Do not deviate from decisions made here without
> explicit instruction.

---

## Context

**Hackathon:** NEBULA X — The Living Railway (LTA Rail Digitalisation & Guild)
**Problem Statement:** PS2 — Smart Travel Companion
**Mandate:** Build a smart commuter companion app that delivers *proactive* decision support
during planned and unplanned disruption events, tailored to individual commuters.
**Judging criteria:** Technical execution · Problem fit · Ease of use · Real-world impact
**Submission:** 19 Sep 2026, 16:00 SGT — scope accordingly.

**Special prizes available:** Best Aesthetics ($200), Most Unique ($200), Most Popular ($200).
UI quality and the CIE (Commuter Intelligence Engine) uniqueness are worth investing in.

---

## Agent Permissions & Environment

This section defines what Claude Code is explicitly authorised to do autonomously.
**Do not ask for permission before acting on anything listed here. Just do it.**

### Git / GitHub

- **Repo:** `https://github.com/MilkmanAbi/TransitMateProject`
- Git is pre-authenticated to the `MilkmanAbi` GitHub account on this machine.
- You are **fully authorised** to: `git add`, `git commit`, `git push`, `git pull`, `git branch`,
  create PRs, force-push feature branches, delete branches, squash commits — anything.
- Commit often. Commit working states. Do not batch everything into one final commit.
- Suggested commit message format: `feat: <what>`, `fix: <what>`, `chore: <what>`
- `.env` must **never** be committed. `.env.example` must be committed.

### Terminal & System

- Full terminal access is granted. Run any command without asking.
- Network egress is unrestricted. Pull packages, hit APIs, fetch docs, do what you need.
- Use `pnpm` as the package manager throughout. Do not use `npm` or `yarn`.
- If a package install fails, debug it yourself and retry. Do not pause to ask.

### Package Management

- Install any package you judge necessary. No approval needed.
- Prefer well-maintained packages with TypeScript types included or available via `@types/`.
- Do not install packages with known security vulnerabilities if alternatives exist.

### Web Search

- Search the web whenever you are uncertain about an API, a library's behaviour, a DataMall
  quirk, or anything else. Do not guess when you can verify.
- Prefer official docs, GitHub issues, and MDN over SEO-bait articles.

### Browser & Visual Testing

- **Primary browser for testing: Google Chrome.** Do NOT open Edge under any circumstances —
  the default system browser is Edge but it must not be used for dev/testing.
- Vite dev server runs on `http://localhost:5173`. Open it in Chrome.
- Use the **Claude in Chrome** connector to visually inspect the running app: navigate to the
  Vite dev URL, take screenshots, and read them to verify layout, behaviour, and regressions.
- Screenshots taken by Chrome land in:
  `C:\Users\abina\OneDrive\Pictures\Screenshots`
  Read screenshots from that path when visual verification is needed.
- Mobile layout (375px) must be verified using Chrome DevTools device emulation
  (iPhone SE or similar). Do this before calling any UI feature "done".

### Working Style & Decision Authority

The operator is away. **Make every decision yourself and keep moving.**

**Never pause to ask about:**
- Which library to use (pick the best fit and go)
- File naming, folder structure, minor architecture choices within a feature
- Whether to refactor something that's getting messy (do it)
- CSS/design micro-decisions
- Which bus routes to use as demo data
- Whether a commit is "ready" (if it works, push it)
- Any blocker that can be resolved by searching the web or reading existing code

**Only stop and surface a question if ALL of the following are true:**
1. The decision is irreversible or would require significant rework to undo
2. It contradicts something explicitly stated in this CLAUDE.md
3. You have genuinely exhausted web search, the existing BusTech codebase, and
   the NebulaX resources as information sources

If you're on the fence about whether to ask — don't. Make a call, note it in a
`# DECISION:` comment at the top of the relevant file, and move on.

**Code violently.** A working rough feature beats a stalled perfect one every time.
Fix broken things immediately; do not carry forward known breakage.
If reality forces a deviation from the architecture section, adapt, leave a `# DEVIATION:`
comment explaining what changed and why, then keep shipping.

---

## What We're Building

**TransitMate** — a mobile-first PWA that makes proactive disruption-aware journey planning
the default, not an afterthought.

The single differentiator vs. Google Maps / MyTransport.SG is **proactivity**: the app pushes
re-routing suggestions, crowding alerts, and weather heads-ups *before* the user asks.
This is implemented as the **Commuter Intelligence Engine (CIE)** — a lightweight polling-based
rules engine, not AI/ML. Keep it simple and demonstrably working.

---

## Read First (Before Writing Code)

```
BusTech-Design-Absolute-Reference/   ← existing project; read for DataMall integration
                                       patterns, existing API wrappers, auth handling
NebulaX-Hackathon-ProblemStatement-main/   ← official datasets, GeoJSON, judging rubric,
                                              any provided starter assets
```

Do **not** duplicate API logic from BusTech. Import or copy over what already works.
Check BusTech for: DataMall AccountKey handling, bus arrival parsing, stop lookup.

---

## Tech Stack

All decisions are final. Do not propose alternatives.

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React 18 + Vite | Fast HMR, minimal config |
| Styling | Tailwind CSS v3 | Utility-first; no component library |
| State | Zustand | Lightweight; one store |
| Routing | React Router v6 | SPA, no SSR |
| Maps | Leaflet.js + React-Leaflet | OpenStreetMap tiles; free |
| Icons | Lucide React | Consistent, tree-shakeable |
| Backend | Node 20 + Express | Thin proxy only |
| Language | TypeScript (strict) | Both frontend and backend |
| HTTP (client) | native fetch with typed wrappers | No axios |
| HTTP (server) | node-fetch or native Node 18+ fetch | |
| Tooling | pnpm | Faster installs |

**Do not** add: Redux, React Query, Prisma, any database, any auth library.
This is a stateless demo. All data comes from DataMall at request time.

---

## Data Sources

### LTA DataMall

**Base URL:** `https://datamall2.mytransport.sg/ltaodataservice`
**Auth:** `AccountKey: <KEY>` header (KEY from `.env` → `DATAMALL_KEY`)
**CORS:** Blocked in-browser. All DataMall calls go through the Express proxy at `/api/*`.
**Rate limits:** Be respectful; batch where possible, cache aggressively.

#### Endpoints Used

| Endpoint | Path | Key Params | Use In App |
|----------|------|------------|------------|
| Bus Arrivals | `/BusArrivalv2` | `BusStopCode` | Live ETA panel, stop view |
| Bus Stops | `/BusStops` | `$skip` (paginated) | Stop search, map markers |
| Bus Services | `/BusServices` | — | Route metadata |
| Bus Routes | `/BusRoutes` | `ServiceNo`, `Direction` | Journey planning |
| Train Service Alerts | `/TrainServiceAlerts` | — | CIE disruption feed |
| Platform Crowding Forecast | `/PCDForecast` | `TrainLine` | Crowding nudges |
| Taxi Availability | `/Taxi-Availability` | — | Fallback suggestion when disrupted |
| Passenger Volume (Bus) | `/PV/Bus` | `Date` (YYYYMM) | Historical crowding (stretch) |
| Passenger Volume (OD Train) | `/PV/OD/Train` | `Date` (YYYYMM) | Historical crowding (stretch) |

> `BusStops` and `BusRoutes` are large paginated datasets. Fetch once on startup and cache in
> memory (or localStorage). Do not re-fetch on every user action.

#### DataMall Response Shape (standard)

```ts
interface DataMallResponse<T> {
  odata: {
    metadata: string;
  };
  value: T[];
}
```

### NEA / data.gov.sg

**Weather API (2-hour nowcast):**
`https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast`
No auth required. Returns area forecasts; match to user's current lat/lng.

**Use:** If forecast for user's area is `Thunderstorm` or `Heavy Rain`, inject a weather alert
card into the CIE feed. No more than this.

### GeoJSON

Rail station GeoJSON is in `NebulaX-Hackathon-ProblemStatement-main/`. Read it from the NebulaX
folder and bundle it as a static asset (`/public/mrt-stations.geojson`).
Use for: map layer rendering MRT station markers. Do not fetch this at runtime.

---

## Architecture

```
TransitMate/
├── client/           ← Vite React app (PWA)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── store/
│   │   │   └── useStore.ts          ← single Zustand store
│   │   ├── api/
│   │   │   ├── datamall.ts          ← typed fetch wrappers → /api/*
│   │   │   └── weather.ts           ← NEA open API (direct, no proxy needed)
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   │   └── TransitMap.tsx   ← Leaflet map, bus stop + MRT markers
│   │   │   ├── Arrivals/
│   │   │   │   └── ArrivalPanel.tsx ← live ETAs for a bus stop
│   │   │   ├── Journey/
│   │   │   │   ├── JourneyPlanner.tsx
│   │   │   │   └── RouteCard.tsx
│   │   │   ├── CIE/
│   │   │   │   ├── AlertFeed.tsx    ← proactive alert cards
│   │   │   │   ├── DisruptionCard.tsx
│   │   │   │   ├── CrowdingCard.tsx
│   │   │   │   └── WeatherCard.tsx
│   │   │   └── ui/                  ← reusable primitives (Button, Badge, etc.)
│   │   ├── hooks/
│   │   │   ├── useGeolocation.ts
│   │   │   ├── useAlerts.ts         ← polls TrainServiceAlerts every 60s
│   │   │   └── useCrowding.ts       ← polls PCDForecast every 120s
│   │   ├── lib/
│   │   │   ├── cie.ts               ← Commuter Intelligence Engine rules
│   │   │   ├── journey.ts           ← A→B route computation (bus + MRT)
│   │   │   └── co2.ts               ← CO2 savings calculation
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── JourneyPage.tsx
│   │   │   └── StopPage.tsx
│   │   └── types/
│   │       └── index.ts             ← shared types (BusArrival, TrainAlert, etc.)
│   ├── public/
│   │   └── mrt-stations.geojson    ← copy from NebulaX assets
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.ts
│
├── server/           ← Express proxy
│   ├── src/
│   │   ├── index.ts                 ← entry, mounts routes
│   │   ├── routes/
│   │   │   ├── busArrivals.ts
│   │   │   ├── busStops.ts
│   │   │   ├── busRoutes.ts
│   │   │   ├── trainAlerts.ts
│   │   │   ├── crowding.ts
│   │   │   └── taxi.ts
│   │   └── lib/
│   │       ├── datamall.ts          ← base fetch with AccountKey header
│   │       └── cache.ts             ← in-memory TTL cache (Map + timestamp)
│   └── tsconfig.json
│
├── .env                             ← DATAMALL_KEY=... (never commit)
├── .env.example
├── package.json                     ← pnpm workspaces
└── CLAUDE.md                        ← this file
```

---

## Commuter Intelligence Engine (CIE)

The CIE is the core differentiator. It is a **polling-based rules engine** running in the client.
No ML. No AI API calls. Fast, deterministic, demonstrable.

### Polling Schedule

| Data | Hook | Interval |
|------|------|----------|
| `TrainServiceAlerts` | `useAlerts` | 60s |
| `PCDForecast` | `useCrowding` | 120s |
| `BusArrivalv2` (saved stops only) | `useArrival` | 30s |
| NEA weather nowcast | `useWeather` | 300s |

### Rule Engine (`lib/cie.ts`)

Input: current alerts, crowding data, weather, user's saved route (home → work).
Output: array of `CIERecommendation` objects sorted by severity.

```ts
type CIESeverity = 'critical' | 'warning' | 'info';

interface CIERecommendation {
  id: string;
  severity: CIESeverity;
  title: string;
  body: string;
  action?: {
    label: string;
    route: string;   // react-router path to navigate to
  };
  co2Delta?: number;   // kg CO2 saved vs. taxi if user takes suggested alt
  timestamp: number;
}
```

#### Rules (implement all four)

1. **MRT Disruption → Bus Reroute**
   - Trigger: `TrainServiceAlerts.value.length > 0` AND alert affects a line in user's saved route
   - Output: `critical` card with suggested bus service(s) + live ETA + fare delta (flat estimate: $0.30–0.50 cheaper by bus)

2. **Platform Overcrowding**
   - Trigger: `PCDForecast` returns `D` (high density) for a station on user's route at current time window
   - Output: `warning` card — "Platform X is crowded. Next train in N min has lower density."

3. **Rain at Destination**
   - Trigger: NEA forecast for destination area = `Thunderstorm` | `Heavy Rain` | `Moderate Rain`
   - Output: `info` card — "Rain expected at [area]. Factor in shelter time."

4. **Generic Alert (no saved route)**
   - Trigger: Any active MRT disruption regardless of user's route
   - Output: `warning` card listing affected line + brief impact + taxi availability count

### CO2 Engine (`lib/co2.ts`)

Simple lookup table per km. Not scientifically rigorous — just plausible and demonstrable.

```ts
// kg CO2 per passenger-km (approximate)
const EMISSIONS = {
  mrt: 0.0028,
  bus: 0.0089,
  taxi: 0.1400,
  car: 0.1700,
  walk: 0.0,
};

// Monthly session accumulates saved emissions: (taxi_distance * taxi_factor) - (transit_distance * transit_factor)
// Store in localStorage under 'tm_co2_sessions'
```

---

## Feature Scope

### MVP — Must Ship

- [ ] **Stop search** — search bus stop by name/road/code; show top 5 results
- [ ] **Live arrivals panel** — given a bus stop code, show all arriving buses with ETA (min), load (seats available / standing / limited)
- [ ] **MRT alert banner** — persistent top banner when `TrainServiceAlerts` returns active alerts
- [ ] **CIE feed** — alert cards from the 4 rules above, shown on home screen
- [ ] **Disruption → alternate route card** — when MRT disrupted, CIE shows bus alternatives with live ETA
- [ ] **Mobile layout** — bottom nav, full-width cards, 375px–430px primary target width
- [ ] **Map view** — Leaflet map with nearby bus stop markers; tap to open arrivals

### Stretch (only if MVP is solid)

- [ ] **A→B journey planner** — text input for origin/destination; returns 2–3 route options (bus + MRT combo)
- [ ] **CO2 dashboard** — monthly savings counter vs. taxi/car
- [ ] **Save home/work routes** — persisted in localStorage; used to personalise CIE
- [ ] **Taxi count widget** — "N taxis available nearby" when MRT disrupted
- [ ] **Crowding heatmap** — colour-coded MRT station markers on map

---

## Express Proxy — Server Contract

All DataMall calls go through `server/`. The client never calls DataMall directly.

Proxy base path: `http://localhost:3001/api`

| Client endpoint | Proxies to |
|-----------------|------------|
| `GET /api/bus/arrivals?stop=<code>` | `/BusArrivalv2?BusStopCode=<code>` |
| `GET /api/bus/stops?skip=<n>` | `/BusStops?$skip=<n>` |
| `GET /api/bus/services` | `/BusServices` |
| `GET /api/bus/routes?service=<no>&dir=<1\|2>` | `/BusRoutes?ServiceNo=<no>&Direction=<dir>` |
| `GET /api/train/alerts` | `/TrainServiceAlerts` |
| `GET /api/train/crowding?line=<code>` | `/PCDForecast?TrainLine=<code>` |
| `GET /api/taxi` | `/Taxi-Availability` |

Server-side cache TTLs:
- `/bus/arrivals` → **20s** (real-time; don't cache too long)
- `/bus/stops` → **1h** (static reference data)
- `/bus/routes` → **1h**
- `/train/alerts` → **30s**
- `/train/crowding` → **60s**
- `/taxi` → **30s**

Cache implementation: simple `Map<string, { data: unknown; expires: number }>`.
Key = full request URL. Evict on read if `Date.now() > expires`.

---

## Design System

Mobile-first. Every component must be usable at 375px width.

**Colour tokens (Tailwind custom config):**
```js
// tailwind.config.ts
colors: {
  brand: {
    50:  '#eef6ff',
    500: '#2563eb',   // primary — LTA blue adjacent
    700: '#1d4ed8',
    900: '#1e3a8a',
  },
  alert: {
    critical: '#dc2626',   // red-600
    warning:  '#d97706',   // amber-600
    info:     '#0891b2',   // cyan-600
  },
  surface: {
    DEFAULT: '#0f172a',    // dark background (dark mode default)
    card:    '#1e293b',
    border:  '#334155',
  }
}
```

**Typography:** System font stack. No Google Fonts (offline resilience).

**Bottom Nav (mobile):** Home · Plan · Alerts · Map — 4 items, icon + label, fixed bottom.

**Card anatomy (CIE cards):**
- Left accent bar coloured by severity
- Title (14px semibold) + body (13px regular)
- Optional action button (text, right-aligned)
- Timestamp (11px muted, bottom-right)

**Loading states:** Skeleton shimmer (Tailwind `animate-pulse`) for arrivals panel and map.
Do not show spinners.

---

## Conventions

- **Naming:** PascalCase components, camelCase hooks/utils, kebab-case files under `pages/`
- **Imports:** Absolute from `src/` using `@/` alias (configure in `vite.config.ts`)
- **Types:** All DataMall response shapes typed in `client/src/types/index.ts`
- **Env vars:** Frontend uses `VITE_API_BASE=http://localhost:3001` (no keys exposed to client)
- **Errors:** All API errors surface as toasts (minimal; implement a single `useToast` hook). No error boundaries needed for hackathon scope.
- **No comments explaining *what* the code does.** Only comment *why* when non-obvious.
- **No placeholder UI.** If a feature isn't built, don't show empty wireframe panels for it.

---

## Bus Load Encoding

DataMall `BusArrivalv2` returns load as a string. Map to UI labels:

| DataMall value | Display | Colour |
|---------------|---------|--------|
| `SEA` | Seats available | green-400 |
| `SDA` | Standing room | amber-400 |
| `LSD` | Limited standing | red-400 |
| `` (empty) | No data | slate-400 |

---

## MRT Line Codes

For `PCDForecast` `TrainLine` parameter and display mapping:

| Code | Line |
|------|------|
| `NSL` | North South Line |
| `EWL` | East West Line |
| `NEL` | North East Line |
| `CCL` | Circle Line |
| `DTL` | Downtown Line |
| `TEL` | Thomson-East Coast Line |
| `CRL` | Cross Island Line |
| `PGL` | Punggol Line |
| `BPLRT` | Bukit Panjang LRT |
| `SKLRT` | Sengkang LRT |
| `PGLRT` | Punggol LRT |

---

## What Not to Build

- No user accounts / login
- No database (localStorage only for user preferences)
- No real fare calculation (DataMall doesn't expose real-time fares; use flat estimates)
- No AI/LLM calls (CIE is rules-based; don't add complexity that can fail in demo)
- No push notifications (Web Push requires a service worker + VAPID; skip for deadline)
- No server-side rendering
- No unit tests (hackathon, ship it)
- No Docker / containerisation

---

## Start Here

```bash
# 1. Clone / confirm repo is present
git remote -v   # should show MilkmanAbi/TransitMateProject

# 2. Bootstrap workspace
pnpm init                         # root package.json with workspaces
mkdir -p client server

# 3. Client (Vite + React)
cd client
pnpm create vite . --template react-ts
pnpm add react-router-dom zustand leaflet react-leaflet lucide-react
pnpm add -D @types/leaflet tailwindcss autoprefixer postcss
npx tailwindcss init -p
cd ..

# 4. Server (Express proxy)
cd server
pnpm init
pnpm add express cors dotenv
pnpm add -D typescript @types/express @types/node ts-node-dev
cd ..

# 5. Copy .env
cp .env.example .env   # fill in DATAMALL_KEY

# 6. Open Chrome on Vite dev server (do NOT use Edge)
# Run server: cd server && pnpm dev
# Run client: cd client && pnpm dev
# Then open http://localhost:5173 in Chrome
```

**Build order — follow this exactly:**

1. `server/src/lib/datamall.ts` — base fetch wrapper with `AccountKey` header
2. `server/src/routes/busArrivals.ts` — proxy `/BusArrivalv2`
3. `server/src/index.ts` — mount all routes, start on port 3001
4. `client/src/api/datamall.ts` — typed client wrappers calling `/api/*`
5. `client/src/store/useStore.ts` — Zustand store: arrivals, alerts, userRoute
6. `client/src/components/Arrivals/ArrivalPanel.tsx` — render live ETAs

**Gate:** Do not proceed past step 6 until a real bus arrival time is visible in Chrome at
`localhost:5173`. Take a Chrome screenshot and verify it before moving on.

Everything else is decoration until live data flows end-to-end.

```bash
# After each meaningful milestone, commit and push
git add -A
git commit -m "feat: <what just started working>"
git push origin main
```

Include the ASCII art from Kitty.txt in random areas for the sake of fun.