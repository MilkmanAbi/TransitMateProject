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
// hold is in tenths of a second
const frame = async (name, hold = 20) => {
  await page.screenshot({ path: `${out}/${String(++n).padStart(3, '0')}-${name}-h${hold}.png` });
};
let y = 0;
const glide = async (to, name) => {
  const from = y;
  for (let k = 1; k <= 5; k++) {
    await page.evaluate((v) => window.scrollTo({ top: v }), Math.round(from + ((to - from) * k) / 5));
    await wait(120);
    await frame(`${name}-s${k}`, 3);
  }
  y = to;
};
// Draws a tap ripple where the next click lands, so the GIF reads as a walkthrough.
const tap = async (text) => {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll('a,button')].find((e) => e.textContent?.includes(t));
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const d = document.createElement('div');
    d.id = 'tap';
    d.style.cssText = `position:fixed;z-index:99999;left:${r.left + r.width / 2 - 22}px;top:${r.top + r.height / 2 - 22}px;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.35);border:3px solid #fff;pointer-events:none`;
    document.body.appendChild(d);
  }, text);
  await wait(150);
  await frame(`tap-${text.slice(0, 10).replace(/\W/g, '')}`, 8);
  await page.evaluate(() => document.getElementById('tap')?.remove());
  await clickText(text);
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
const scroll = (v) => { y = v; return page.evaluate((t) => window.scrollTo({ top: t }), v); };

await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
await wait(8000);
await frame('home-live', 30);
await glide(520, 'home-feed'); await frame('home-live-feed', 15);
await scroll(0);
await tap('Alerts'); await wait(4000); await scroll(0); await wait(300);
await frame('alerts-live', 20);
await glide(1400, 'alerts-down'); await scroll(99999); await wait(500); await frame('alerts-replay', 20);
await tap('EWL track fault'); await wait(4000); await frame('replay-on', 15);
await scroll(0); await wait(500); await frame('alerts-disruption', 30);
await tap('Home'); await wait(9000); await scroll(0); await wait(300);
await frame('home-sim', 35);
await glide(560, 'home-sim-down'); await frame('home-sim-card', 30);
await scroll(0); await wait(300);
await tap('Show me the new route'); await wait(10000); await scroll(0); await wait(400);
await frame('plan-why', 35);
await glide(640, 'plan-down'); await frame('plan-options', 30);
await glide(1150, 'plan-steps-down'); await frame('plan-steps', 30);
await tap('Map'); await wait(7000); await frame('map-crowd', 25);
await browser.close();
