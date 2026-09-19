// Records the README demo journey (Rachel, replayed EWL fault) as phone-sized frames in local Chrome.
// usage: node scripts/demo-capture.mjs <outDir> [baseUrl]   then: python scripts/make-gif.py <outDir>
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? 'docs/frames';
const base = process.argv[3] ?? 'http://localhost:5173';
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 375, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const frame = async (name, hold = 2) => {
  await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}-h${hold}.png` });
  console.log('frame', n, name);
};
const clickText = async (text) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('a,button')].find((e) => e.textContent?.includes(t));
    el?.scrollIntoView({ block: 'center' });
    el?.click();
    return !!el;
  }, text);
  if (!ok) console.warn('not found:', text);
};
const scroll = (y) => page.evaluate((v) => window.scrollTo({ top: v }), y);

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await wait(8000);
await frame('home-live', 3);
await scroll(520); await wait(600); await frame('home-live-feed', 2);
await clickText('Alerts'); await wait(4000); await scroll(0); await wait(300);
await frame('alerts-live', 2);
await scroll(99999); await wait(800); await frame('alerts-replay', 2);
await clickText('EWL track fault'); await wait(4000); await frame('replay-on', 2);
await scroll(0); await wait(500); await frame('alerts-disruption', 3);
await clickText('Home'); await wait(9000); await scroll(0); await wait(300);
await frame('home-sim', 3);
await scroll(560); await wait(600); await frame('home-sim-card', 3);
await clickText('Show me the new route'); await wait(10000); await scroll(0); await wait(400);
await frame('plan-why', 3);
await scroll(640); await wait(600); await frame('plan-options', 3);
await scroll(1150); await wait(600); await frame('plan-steps', 3);
await clickText('Map'); await wait(7000); await frame('map-crowd', 2);
await browser.close();
