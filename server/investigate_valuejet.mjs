/**
 * Investigate ValueJet live API:
 * 1. Navigate to flyvaluejet.com
 * 2. Fill the search form (LOS → ABV, 2026-09-20, 1 adult)
 * 3. Intercept ALL network requests to api.flyvaluejet.com
 * 4. Print every captured URL + method + request body + response snippet
 */
import { chromium } from 'playwright';

const ORIGIN      = 'LOS';
const DESTINATION = 'ABV';
const DATE_STR    = '2026-09-20';  // adjust if needed

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  const captured = [];

  // Intercept every request going to the ValueJet API domain
  page.on('request', req => {
    const url = req.url();
    if (url.includes('flyvaluejet') || url.includes('api.flyvaluejet')) {
      captured.push({ type: 'REQUEST', method: req.method(), url, postData: req.postData() });
      console.log('[REQ]', req.method(), url);
      if (req.postData()) console.log('  body:', req.postData());
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('flyvaluejet') || url.includes('api.flyvaluejet')) {
      let body = '';
      try { body = await res.text(); } catch {}
      const snippet = body.slice(0, 800);
      captured.push({ type: 'RESPONSE', status: res.status(), url, snippet });
      console.log('[RES]', res.status(), url);
      console.log('  body snippet:', snippet);
    }
  });

  console.log('--- Navigating to flyvaluejet.com ---');
  try {
    await page.goto('https://www.flyvaluejet.com/', { waitUntil: 'networkidle', timeout: 30000 });
  } catch(e) {
    console.log('Navigation timeout/error (page may still be usable):', e.message);
  }

  // Take a screenshot to see the page
  await page.screenshot({ path: 'C:/Users/HP/.gemini/antigravity/brain/6500c422-cb0a-4314-b47d-03d8a59adf4f/scratch/valuejet_home.png' });
  console.log('Screenshot saved.');

  // Print all captured so far
  console.log('\n--- Captured requests on homepage load ---');
  for (const c of captured) {
    console.log(JSON.stringify(c, null, 2));
  }

  // Try to find the search form and fill it
  console.log('\n--- Inspecting page for search form ---');
  const allInputs = await page.$$eval('input, select, button', els => els.map(e => ({
    tag: e.tagName,
    type: e.type,
    name: e.name,
    id: e.id,
    placeholder: e.placeholder,
    value: e.value,
    class: e.className?.slice(0,80),
  })));
  console.log('Form elements found:', JSON.stringify(allInputs, null, 2));

  // Also dump visible text to understand page structure
  const bodyText = await page.evaluate(() => document.body.innerText?.slice(0, 2000));
  console.log('\n--- Page body text ---\n', bodyText);

  await browser.close();
  console.log('\n--- Done ---');
})();
