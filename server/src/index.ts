import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { cached } from './lib/cache.js';
import { ltaFetch, UpstreamError } from './lib/datamall.js';
import { loadNetwork, net } from './lib/network.js';
import { bus } from './routes/bus.js';
import { misc } from './routes/misc.js';
import { planner } from './routes/plan.js';
import { train } from './routes/train.js';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env'), quiet: true });

const app = express();
app.use(cors());
app.disable('x-powered-by');

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    network: net.ready,
    stops: net.stops.size,
    routes: net.routes.size,
    keyConfigured: !!(process.env.DATAMALL_KEY || process.env.LTA_ACCOUNT_KEY),
  }),
);

// BusTech-compatible passthrough (/api/lta?path=v3/BusArrival&BusStopCode=75009), limited to the endpoints the app uses.
const ALLOWED = new Set([
  'v3/BusArrival', 'BusStops', 'BusServices', 'BusRoutes', 'TrainServiceAlerts', 'PCDRealTime', 'PCDForecast',
  'Taxi-Availability', 'v2/FacilitiesMaintenance',
]);
app.get('/api/lta', async (req, res, next) => {
  const { path: p, ...query } = req.query as Record<string, string>;
  if (!p || !ALLOWED.has(p)) return void res.status(400).json({ error: 'Missing or unsupported ?path param' });
  try {
    const key = `lta:${p}?${new URLSearchParams(query).toString()}`;
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    res.json(await cached(key, 15_000, () => ltaFetch(p, query)));
  } catch (e) {
    next(e);
  }
});

app.use('/api/bus', bus);
app.use('/api/train', train);
app.use('/api/plan', planner);
app.use('/api', misc);

const dist = path.resolve(here, '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err instanceof UpstreamError ? (err.status >= 500 ? 502 : err.status) : (err.status ?? 500);
  if (status >= 500) console.error('[api]', err.message);
  res.status(status).json({ error: err.message });
});

const KITTY = String.raw`
              ＿＿
　　 　　　🌸＞　　フ
　　　 　　| 　_　 _l
　  　  　／${'`'} ミ＿xノ
　　 　 /　　　 　 |
　　　 /　 ヽ　　 ﾉ
　 　 │　　|　|　|
　／￣|　　 |　|　|
　| (￣ヽ＿_ヽ_)__)
　＼二つ`;

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(KITTY);
  console.log(`\n  TransitMate API  →  http://localhost:${PORT}/api/health`);
  console.log(fs.existsSync(dist) ? `  Serving built app →  http://localhost:${PORT}\n` : '  (client not built — use `pnpm dev` for the Vite app on :5173)\n');
  loadNetwork().catch((e) => console.error('[network] preload failed:', e.message));
});
