// Records the showcase video (phone viewport, captions, tap markers) with puppeteer screencast + ffmpeg.
// usage: node scripts/record-demo.mjs <out.webm> <ffmpegPath> [baseUrl]
import puppeteer from 'puppeteer-core';

const [out, ffmpegPath, base = 'http://localhost:5173'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars'] });
const pg = await b.newPage();
await pg.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const w = (s) => new Promise((r) => setTimeout(r, s * 1000));

// warm caches so the recording has no cold-start spinners
await pg.goto(`${base}/`, { waitUntil: 'networkidle2' }).catch(() => {});
await pg.evaluate(() => localStorage.clear());
await pg.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await w(8);

const cap = (t) =>
  pg.evaluate((t) => {
    let c = document.getElementById('cap');
    if (!c) {
      c = document.createElement('div');
      c.id = 'cap';
      c.style.cssText = 'position:fixed;left:10px;right:10px;bottom:74px;z-index:99999;pointer-events:none;background:rgba(31,28,23,.92);color:#f1ece2;font:600 13px/1.35 "Segoe UI",system-ui;padding:9px 12px;border-radius:4px;border-left:4px solid #3a5f8a';
      document.body.appendChild(c);
    }
    c.textContent = t;
    c.style.display = t ? 'block' : 'none';
  }, t);
const tap = async (text, sel = 'a,button') => {
  const ok = await pg.evaluate((t, sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent?.includes(t) || e.getAttribute('aria-label') === t);
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }, text, sel);
  if (!ok) return console.warn('missing', text);
  await w(0.6);
  await pg.evaluate((t, sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent?.includes(t) || e.getAttribute('aria-label') === t);
    const r = el.getBoundingClientRect();
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;z-index:99998;left:${r.left + r.width / 2 - 20}px;top:${r.top + r.height / 2 - 20}px;width:40px;height:40px;border-radius:50%;background:rgba(58,95,138,.35);border:3px solid #3a5f8a;pointer-events:none;transition:transform .35s,opacity .35s`;
    document.body.appendChild(d);
    setTimeout(() => { d.style.transform = 'scale(1.6)'; d.style.opacity = '0'; }, 250);
    setTimeout(() => d.remove(), 700);
    el.click();
  }, text, sel);
};
const scroll = (y) => pg.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), y);

const rec = await pg.screencast({ path: out, ffmpegPath });

await cap('TransitMate — tells Rachel before she leaves if today is different, and what to do.');
await w(6);
await scroll(640); await cap('Live LTA crowd forecast for her platform. When nothing needs her, it stays quiet.');
await w(6);
await scroll(0); await w(1);
await cap('One tap replays an EWL track fault (clearly labelled as a replay).');
await w(2.5);
await tap('Simulate EWL fault');
await w(3.5);
await cap('The verdict flips: “Take DTL today” — one action, one reason.');
await w(5);
await scroll(330); await cap('Staying on the EWL vs switching — switching saves ~26 min.');
await w(5);
await scroll(0); await w(1);
await tap('Show me the new route');
await cap('Route changed — here’s why. Usual route dashed, the cut section in red.');
await w(7);
await scroll(470); await cap('Stay or switch? Both options side by side, as honest time ranges.');
await w(6);
await scroll(1020); await cap('Door-to-door steps: OSM walking paths, live bus ETAs, crowding, fare, CO₂.');
await w(6);
await tap('take this');
await cap('Trip mode: one step at a time, big text, one thumb — keeps working underground.');
await w(6);
await tap('next step');
await w(3.5);
await tap('Map');
await cap('The whole rail network, every station coloured by live LTA crowding. Disruption in red.');
await w(6.5);
await pg.evaluate(() => {
  const ps = [...document.querySelectorAll('path.leaflet-interactive')].filter((p) => p.getAttribute('stroke-width') === '4' && p.getAttribute('stroke') === '#ef4444');
  (ps[2] || ps[0])?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await cap('Tap a station: live crowd, 3-hour forecast, lifts, and what LTA is doing about it.');
await w(5.5);
await pg.evaluate(() => document.querySelector('[role=dialog]')?.scrollTo({ top: 9999, behavior: 'smooth' }));
await cap('Commuters report what they see — shared instantly through Firebase Cloud Firestore.');
await w(3);
await tap('Platform packed');
await w(4);
await tap('Close');
await w(1);
await tap('Alerts');
await cap('Network at a glance, plus LTA’s own mitigation: free buses and bridging buses.');
await w(6);
await scroll(720); await cap('The commuter report is already here, for everyone, in real time.');
await w(6);
await scroll(1250); await cap('Planned works from LTA’s live feed, dated — and routed around on the day.');
await w(5.5);
await scroll(0); await w(0.5);
await tap('Home');
await w(1.5);
await tap('Change persona and commute', 'button');
await cap('Same engine, different person.');
await w(2.5);
await tap('Mdm Lim');
await w(1);
await tap('Close');
await cap('Mdm Lim: slower walking, fewer transfers, large text — she gets Bus 155 → TEL instead.');
await w(7);
await scroll(260); await w(4);
await scroll(0);
await cap('TransitMate · LTA DataMall · OpenStreetMap · NEA · Firestore · designed with PaperDesign');
await w(5);
await rec.stop();
await b.close();
console.log('saved', out);
