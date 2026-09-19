// Dev helper: phone-emulated screenshots of the running app in the locally installed Google Chrome.
// usage: node scripts/shot.mjs <path> <out.png> [--w 375 --h 667] [--wait ms] [--js "code"] [--full]
import puppeteer from 'puppeteer-core';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const [path, out] = args;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars'] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: +opt('w', 375), height: +opt('h', 667), deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const pre = opt('pre');
if (pre) { await page.goto(`http://localhost:5173/`, { waitUntil: 'domcontentloaded' }); await page.evaluate(pre); }
await page.goto(`http://localhost:5173${path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('nav', { timeout: 25000 }).catch(() => errors.push('nav never rendered'));
await new Promise((r) => setTimeout(r, +opt('wait', 1500)));
const js = opt('js');
if (js) { await page.evaluate(js); await new Promise((r) => setTimeout(r, +opt('wait2', 1500))); }
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
await page.screenshot({ path: out, fullPage: args.includes('--full') });
console.log(`saved ${out} scrollWidth=${sw}`, errors.length ? `ERRORS: ${errors.join(' | ')}` : '');
await browser.close();
