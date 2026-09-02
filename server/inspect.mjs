/**
 * inspect.mjs — one-shot DOM inspection of AlternativeAirlines.
 * Run: node inspect.mjs
 * Writes screenshots and HTML dumps to server/cache/inspect-*.
 * Read the output to learn real selectors.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'cache');
mkdirSync(OUT, { recursive: true });

const t0 = Date.now();
const ts = () => `[+${((Date.now() - t0)/1000).toFixed(1)}s]`;

console.log(`${ts()} Launching browser...`);

const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--disable-extensions', '--disable-background-networking',
  ],
});

console.log(`${ts()} Browser launched.`);

const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'en-US',
});

const page = await context.newPage();

// Block heavy resources
await page.route('**/*', async (route) => {
  const t = route.request().resourceType();
  if (['image','media','font','websocket'].includes(t)) return route.abort();
  const u = route.request().url();
  if (/google-analytics|googletagmanager|hotjar|facebook|doubleclick|intercom|crisp|zendesk|adnxs/i.test(u)) return route.abort();
  return route.continue();
});

// Capture all network requests/responses for flight data
const captured = [];
page.on('response', async (resp) => {
  const url = resp.url();
  const ct = resp.headers()['content-type'] || '';
  if (ct.includes('application/json') && !/google|facebook|analytics|hotjar/i.test(url)) {
    try {
      const json = await resp.json();
      captured.push({ url, json });
      console.log(`${ts()} [JSON] ${url.substring(0, 100)}`);
    } catch {}
  }
});

// ─── 1. Load homepage ─────────────────────────────────────────────────────────
console.log(`${ts()} Navigating to homepage...`);
await page.goto('https://www.alternativeairlines.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
console.log(`${ts()} Page loaded. Title: "${await page.title()}"`);

await page.waitForTimeout(2000);
await page.screenshot({ path: join(OUT, 'inspect-01-homepage.png') });

// ─── 2. Dump widget HTML ─────────────────────────────────────────────────────
const widgetHtml = await page.evaluate(() => {
  const el = document.querySelector('#flight-search') 
          || document.querySelector('[class*="SearchWidget"]')
          || document.querySelector('[class*="search-widget"]')
          || document.querySelector('form')
          || document.body;
  return el ? el.outerHTML.substring(0, 8000) : 'NOT FOUND';
});
writeFileSync(join(OUT, 'inspect-widget.html'), widgetHtml);
console.log(`${ts()} Widget HTML saved (${widgetHtml.length} chars). First 400:\n${widgetHtml.substring(0,400)}\n`);

// ─── 3. List all buttons on the page ────────────────────────────────────────
const buttons = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map(b => ({
    text: b.textContent.trim().substring(0,60),
    id: b.id,
    class: b.className.substring(0,80),
    ariaLabel: b.getAttribute('aria-label'),
  }))
);
console.log(`${ts()} Buttons on page (${buttons.length}):`);
buttons.slice(0, 30).forEach(b => console.log('  ', JSON.stringify(b)));

// ─── 4. List all visible divs that look like inputs ─────────────────────────
const inputDivs = await page.evaluate(() =>
  [...document.querySelectorAll('div[class*="input" i], div[class*="Input" i]')]
    .filter(el => el.offsetParent !== null)
    .map(el => ({
      text: el.textContent.trim().substring(0,60),
      class: el.className.substring(0,100),
    }))
);
console.log(`\n${ts()} Input-like divs (${inputDivs.length}):`);
inputDivs.slice(0,15).forEach(d => console.log('  ', JSON.stringify(d)));

// ─── 5. Try clicking the origin widget ───────────────────────────────────────
console.log(`\n${ts()} Attempting to click origin widget...`);
const originWidget = page.locator('div[class*="Inputs_input"]').first();
const originCount = await originWidget.count();
console.log(`${ts()} div[class*="Inputs_input"] count: ${originCount}`);

if (originCount) {
  await originWidget.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, 'inspect-02-after-origin-click.png') });

  // What appeared?
  const inputs = await page.evaluate(() =>
    [...document.querySelectorAll('input')].map(i => ({
      type: i.type, placeholder: i.placeholder, value: i.value,
      ariaLabel: i.getAttribute('aria-label'), class: i.className.substring(0,80),
      visible: i.offsetParent !== null,
    }))
  );
  console.log(`${ts()} Inputs after click (${inputs.length}):`);
  inputs.forEach(i => console.log('  ', JSON.stringify(i)));

  // Type LOS
  await page.keyboard.type('Lagos', { delay: 60 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, 'inspect-03-after-type-lagos.png') });

  // What suggestions appeared?
  const suggestions = await page.evaluate(() => {
    const selectors = ['[role="option"]','[role="listitem"]','li','[class*="result" i]','[class*="suggest" i]'];
    for (const sel of selectors) {
      const items = [...document.querySelectorAll(sel)]
        .filter(el => el.offsetParent !== null)
        .map(el => ({ text: el.textContent.trim().substring(0,80), sel, tag: el.tagName, class: el.className.substring(0,80) }));
      if (items.length) return items.slice(0,8);
    }
    return [];
  });
  console.log(`\n${ts()} Suggestions (${suggestions.length}):`);
  suggestions.forEach(s => console.log('  ', JSON.stringify(s)));

  if (suggestions.length) {
    // Click first suggestion
    for (const sel of ['[role="option"]','[role="listitem"]','li']) {
      const first = page.locator(sel).first();
      if (await first.count() && await first.isVisible()) {
        await first.click();
        break;
      }
    }
    await page.waitForTimeout(500);
  }
}

// ─── 6. Try to click dates widget and inspect calendar ───────────────────────
console.log(`\n${ts()} Looking for dates widget...`);
const datesWidget = page.locator('div[class*="Inputs_input"]:has-text("Dates"), div[class*="input" i]:has-text("Dates")').first();
const datesCount = await datesWidget.count();
console.log(`${ts()} Dates widget count: ${datesCount}`);

if (datesCount) {
  await datesWidget.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(OUT, 'inspect-04-calendar.png') });

  // Capture full calendar HTML
  const calHtml = await page.evaluate(() => {
    const selectors = ['[class*="calendar" i]','[class*="Calendar"]','[class*="datepicker" i]','[class*="DatePicker"]'];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el.outerHTML.substring(0, 6000);
    }
    // fallback: find any visible element with month names
    const allEls = [...document.querySelectorAll('*')];
    const monthEl = allEls.find(el => {
      const t = el.textContent.trim();
      return (t.includes('August') || t.includes('September')) && t.length < 300 && el.children.length > 3;
    });
    return monthEl ? monthEl.outerHTML.substring(0,6000) : 'CALENDAR NOT FOUND';
  });
  writeFileSync(join(OUT, 'inspect-calendar.html'), calHtml);
  console.log(`${ts()} Calendar HTML saved (${calHtml.length} chars). First 600:\n${calHtml.substring(0,600)}\n`);

  // List all buttons inside the calendar area
  const calButtons = await page.evaluate(() => {
    const cal = document.querySelector('[class*="calendar" i], [class*="Calendar"], [class*="datepicker" i], [class*="DatePicker"]')
              || document.body;
    return [...cal.querySelectorAll('button')].map(b => ({
      text: b.textContent.trim().substring(0,20),
      class: b.className.substring(0,80),
      ariaLabel: b.getAttribute('aria-label'),
      disabled: b.disabled,
      role: b.getAttribute('role'),
    })).slice(0, 50);
  });
  console.log(`${ts()} Calendar buttons (${calButtons.length}):`);
  calButtons.slice(0,15).forEach(b => console.log('  ', JSON.stringify(b)));

  // List gridcells
  const cells = await page.evaluate(() =>
    [...document.querySelectorAll('[role="gridcell"], td, [class*="day" i]')]
      .filter(el => el.offsetParent !== null)
      .map(el => ({
        text: el.textContent.trim().substring(0,10),
        role: el.getAttribute('role'),
        class: el.className.substring(0,80),
        ariaDisabled: el.getAttribute('aria-disabled'),
        tag: el.tagName,
      })).slice(0, 20)
  );
  console.log(`\n${ts()} Calendar cells (${cells.length}):`);
  cells.forEach(c => console.log('  ', JSON.stringify(c)));
}

// ─── 7. Save all captured JSON ───────────────────────────────────────────────
writeFileSync(join(OUT, 'inspect-network.json'), JSON.stringify(captured, null, 2));
console.log(`\n${ts()} Saved ${captured.length} JSON responses to inspect-network.json`);

await browser.close();
console.log(`${ts()} Done. All artifacts saved to server/cache/`);
