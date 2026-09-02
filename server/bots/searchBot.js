/**
 * bots/searchBot.js
 *
 * Playwright browser automation for AlternativeAirlines.
 * Behaves exactly like a real user — opens the site, interacts with the custom
 * search widget (which uses divs instead of inputs), clicks Search, then
 * captures every JSON API response the page receives.
 *
 * NO HTML scraping. Only network-intercepted JSON payloads are returned.
 *
 * CONFIRMED BY LIVE PLAYWRIGHT INSPECTION (2026-08-06):
 *   AlternativeAirlines uses a custom React widget with NO <input> elements.
 *   The form is entirely div-based. Selectors below are verified against the
 *   live page DOM.
 *
 *   Trip type buttons:  button.TripTypes_button__4HzkR
 *   Origin widget:      div.Inputs_input__gSCDv (visible text "Where from?")
 *   Destination widget: div.Inputs_input__gSCDv (visible text "Where to?")
 *   Dates widget:       div.Inputs_input__gSCDv (visible text "Dates")
 *   Passengers widget:  div.Inputs_input__gSCDv (visible text "Passengers")
 *   Search button:      button#aa-search-widget-continue-click
 *   API host:           https://www.altairapi.com/
 */

import { launchBrowser, createContext } from './browser.js';
import logger from '../utils/logger.js';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const BASE_URL   = 'https://www.alternativeairlines.com/';
// This is an end-to-end budget, not a per-wait timeout.  Keeping it below
// 30 seconds ensures a slow provider can never hold the HTTP request open.
// Use a longer configurable window while verifying the live scraping bot.
const TIMEOUT_MS = parseInt(process.env.BROWSER_SEARCH_TIMEOUT_MS || '180000', 10);
const DEBUG_DIR = join(fileURLToPath(new URL('..', import.meta.url)), 'cache', 'provider-failures');
const CAPTURE_DEBUG_DIR = join(fileURLToPath(new URL('..', import.meta.url)), 'debug');

function safeUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    for (const key of ['st', 'token', 'session', 'authorization', 'apiKey', 'api_key']) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function sanitizeForDebug(value, key = '') {
  if (/cookie|authorization|token|session|password|email|phone/i.test(key)) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeForDebug(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [
      childKey, sanitizeForDebug(childValue, childKey),
    ]));
  }
  return value;
}

function payloadSummary(payload) {
  const isArray = Array.isArray(payload);
  const isObject = payload !== null && typeof payload === 'object' && !isArray;
  const keys = isObject ? Object.keys(payload) : [];
  const firstLevel = isObject ? Object.fromEntries(keys.map((key) => {
    const value = payload[key];
    if (Array.isArray(value)) return [key, { type: 'array', length: value.length }];
    if (value && typeof value === 'object') return [key, { type: 'object', keys: Object.keys(value).slice(0, 30) }];
    return [key, { type: typeof value }];
  })) : {};
  return { topLevelType: isArray ? 'array' : typeof payload, topLevelKeys: keys, arrayLength: isArray ? payload.length : null, firstLevel };
}

async function saveCapturedPayloadDebug({ runId, index, kind, url, status, contentType, payload }) {
  const directory = join(CAPTURE_DEBUG_DIR, runId);
  const name = kind === 'results' ? `flight-results-${index}.json` : `captured-${kind}-${index}.json`;
  const path = join(directory, name);
  const summary = payloadSummary(payload);
  await mkdir(directory, { recursive: true });
  await writeFile(path, JSON.stringify({
    url: safeUrl(url), status, contentType, summary, payload: sanitizeForDebug(payload),
  }, null, 2), 'utf8');
  logger.info('searchBot: captured payload summary', { file: path, url: safeUrl(url), status, contentType, ...summary });
}

function timeoutError(stage) {
  const err = new Error(`AlternativeAirlines search exceeded its ${TIMEOUT_MS}ms budget during ${stage}.`);
  err.name = 'TimeoutError';
  err.code = 'TIMEOUT_ERROR';
  err.statusCode = 504;
  return err;
}

// ─── Resource blocking ────────────────────────────────────────────────────────
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'websocket']);

const BLOCKED_URL_PATTERNS = [
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /googlesyndication\.com/i,
  /doubleclick\.net/i,
  /facebook\.net/i,
  /facebook\.com\/tr/i,
  /analytics\./i,
  /segment\.io/i,
  /mixpanel\.com/i,
  /hotjar\.com/i,
  /fullstory\.com/i,
  /intercom\.io/i,
  /intercomcdn\.com/i,
  /crisp\.chat/i,
  /zendesk\.com/i,
  /adservice\./i,
  /adnxs\.com/i,
  /rubiconproject\.com/i,
  /pubmatic\.com/i,
  /outbrain\.com/i,
  /taboola\.com/i,
  /platform\.twitter\.com/i,
  /connect\.facebook\.net/i,
  /platform\.linkedin\.com/i,
  /youtube\.com/i,
  /vimeo\.com/i,
  /\.gif(\?|$)/i,
  /\/ads\//i,
  /\/analytics\//i,
  /\/tracking\//i,
  /trackedweb\.net/i,
  /brandswap\.com/i,
  /bat\.bing\.com/i,
  /mainadv\.com/i,
  /cookiebot\.com/i,
  /prismic\.io/i,
];

// ─── JSON capture patterns ────────────────────────────────────────────────────
// Capture any response from altairapi.com OR matching flight/search keywords.
const CAPTURE_URL_PATTERNS = [
  /altairapi\.com/i,
  /search/i,
  /flight/i,
  /results/i,
  /offer/i,
  /pricing/i,
  /itinerar/i,
  /availability/i,
  /fare/i,
];

function shouldCapture(url) {
  // Never capture analytics/tracking even if they return JSON
  if (BLOCKED_URL_PATTERNS.some((p) => p.test(url))) return false;
  return CAPTURE_URL_PATTERNS.some((p) => p.test(url));
}

function isFlightResultsUrl(url) {
  return /\/api\/search\/flights\/results(?:\?|$)/i.test(url);
}

function shouldBlock(url, resourceType) {
  if (BLOCKED_RESOURCE_TYPES.has(resourceType)) return true;
  return BLOCKED_URL_PATTERNS.some((p) => p.test(url));
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Parse ISO date string into { year, month (1-based), day } */
function parseDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day };
}

// Alternative Airlines accepts this public results URL directly. This avoids
// interacting with the calendar widget when a one-way search is requested.
function buildDirectSearchUrl({ origin, destination, departureDate, adults, children = 0, infants = 0 }) {
  const query = new URLSearchParams({
    outbound: departureDate,
    adults: String(adults),
    children: String(children),
    infants: String(infants),
    class: 'Y',
    currency: process.env.ALTERNATIVE_AIRLINES_CURRENCY || 'NGN',
  });
  return `${BASE_URL}flights/${origin}-${destination}?${query.toString()}`;
}

// ─── Widget helpers ───────────────────────────────────────────────────────────

/**
 * Click an airport widget div (origin or destination), wait for the overlay
 * input to appear, type the IATA code, and select the first suggestion.
 *
 * The widget is a <div class="Inputs_input__gSCDv ..."> with visible label text.
 * After click, an overlay with a real <input> appears for typing.
 */
async function fillAirport(page, labelText, iataCode, fieldName) {
  // Locate the widget div by its visible text
  const widget = page.locator(`div.Inputs_input__gSCDv:has-text("${labelText}")`).first();

  if (!await widget.count()) {
    throw new Error(
      `searchBot: cannot find ${fieldName} widget (label: "${labelText}")`
    );
  }

  logger.info(`searchBot: clicking ${fieldName} widget`);
  await widget.click();
  await page.waitForTimeout(700);

  // After click, wait for an overlay input to appear
  const overlayInputSelectors = [
    'input[placeholder*="Search" i]',
    'input[placeholder*="airport" i]',
    'input[placeholder*="city" i]',
    'input[placeholder*="Where" i]',
    'input[aria-label*="origin" i]',
    'input[aria-label*="destination" i]',
    'input[aria-label*="airport" i]',
    'input[role="combobox"]',
    '[class*="AirportSearch"] input',
    '[class*="airportSearch"] input',
    '[class*="overlay" i] input',
    '[class*="modal" i] input',
    '[class*="dropdown" i] input',
    '[class*="autocomplete" i] input',
    'input:focus',
  ];

  let overlayInput = null;
  for (const sel of overlayInputSelectors) {
    const el = await page.$(sel);
    if (el && await el.isVisible()) {
      overlayInput = el;
      break;
    }
  }

  if (!overlayInput) {
    throw new Error(
      `searchBot: ${fieldName} overlay input did not appear after widget click`
    );
  }

  logger.info(`searchBot: typing ${fieldName}`, { iataCode });
  await overlayInput.type(iataCode, { delay: 80 });
  await page.waitForTimeout(1000);

  // Pick the first suggestion
  const suggestionSelectors = [
    '[role="option"]',
    '[role="listitem"]',
    'li[class*="suggestion" i]',
    'li[class*="result" i]',
    '[class*="AirportResult"]',
    '[class*="airportResult"]',
    '[class*="airport-item" i]',
    'li',
  ];

  let picked = false;
  for (const sel of suggestionSelectors) {
    const first = page.locator(sel).first();
    if (await first.count() && await first.isVisible()) {
      logger.info(`searchBot: selecting first ${fieldName} suggestion`);
      await first.click();
      picked = true;
      break;
    }
  }

  if (!picked) {
    logger.info(`searchBot: no suggestion found for ${fieldName} — using ArrowDown+Enter`);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(400);
}

/**
 * Navigate the calendar overlay to the correct month and click the day.
 */
async function selectCalendarDate(page, isoDate, label) {
  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];
  const { year, month, day } = parseDate(isoDate);
  const targetMonth = MONTHS[month - 1];
  const targetYear  = String(year);

  logger.info(`searchBot: navigating calendar → ${targetMonth} ${targetYear} (${label})`);

  // Navigate forward up to 24 months
  for (let attempt = 0; attempt < 24; attempt++) {
    const header = await getCalendarHeader(page);
    if (header.includes(targetMonth) && header.includes(targetYear)) break;

    const nextBtn = await page.$(
      '[aria-label="Next month"], [aria-label="next month"], ' +
      '[aria-label="Go to next month"], ' +
      '[class*="nextMonth"], [class*="NextMonth"], [class*="next-month"], ' +
      'button[class*="next"]'
    );
    if (!nextBtn) { logger.warn(`searchBot: next-month button not found (attempt ${attempt})`); break; }
    await nextBtn.click();
    await page.waitForTimeout(300);
  }

  const verifiedHeader = await getCalendarHeader(page);
  if (!verifiedHeader.includes(targetMonth) || !verifiedHeader.includes(targetYear)) {
    throw new Error(`searchBot: calendar month verification failed; expected ${targetMonth} ${targetYear}, found "${verifiedHeader}"`);
  }

  // Click only a cell that exposes the full target date. Never select a day
  // using its text alone: duplicate day numbers can belong to adjacent months.
  const dayStr = String(day);
  const cells  = await page.locator(
    `[data-date="${isoDate}"], [data-value="${isoDate}"]`
  ).all();

  let clicked = false;
  for (const cell of cells) {
    if (await cell.isVisible() && await cell.isEnabled()) {
      logger.info(`searchBot: clicking verified date ${isoDate} (${label})`);
      await cell.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    throw new Error(
      `searchBot: could not click day ${dayStr} in calendar for ${label}`
    );
  }

  await page.waitForTimeout(400);
}

async function getCalendarHeader(page) {
  const selectors = [
    '[class*="calendarHeader" i]',
    '[class*="month-header" i]',
    '[class*="MonthHeader"]',
    '[aria-live="polite"]',
    '[class*="calendar" i] h2',
    '[class*="datepicker" i] h2',
  ];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      const txt = (await el.textContent() || '').trim();
      if (txt) return txt;
    }
  }
  return '';
}

/**
 * Prefer real date inputs if Alternative Airlines introduces them in a future
 * widget version. The currently captured form has none, so this returns false
 * and the caller can use the controlled fallback.
 */
async function setEditableDates(page, departureDate, returnDate) {
  const dateInputs = page.locator('input[type="date"]');
  const count = await dateInputs.count();
  logger.info('searchBot: inspected editable date inputs', { count });
  if (count < 1 || (returnDate && count < 2)) return false;

  await dateInputs.nth(0).fill(departureDate);
  if (returnDate) await dateInputs.nth(1).fill(returnDate);

  const departureValue = await dateInputs.nth(0).inputValue();
  const returnValue = returnDate ? await dateInputs.nth(1).inputValue() : '';
  if (departureValue !== departureDate || (returnDate && returnValue !== returnDate)) {
    throw new Error(`searchBot: editable date input verification failed (departure=${departureValue}, return=${returnValue})`);
  }
  logger.info('searchBot: editable dates set and verified', { departureDate, returnDate: returnDate || null });
  return true;
}

function dateDisplayToken(isoDate) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', timeZone: 'UTC',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

async function verifyDisplayedDates(page, departureDate, returnDate) {
  const widget = page.locator('div.Inputs_input__gSCDv:has-text("Dates")').first();
  const text = (await widget.textContent() || '').replace(/\s+/g, ' ').trim();
  const expected = [dateDisplayToken(departureDate)];
  if (returnDate) expected.push(dateDisplayToken(returnDate));
  const missing = expected.filter((token) => !text.includes(token));
  if (missing.length) {
    throw new Error(`searchBot: date display verification failed; expected ${expected.join(', ')}, found "${text}"`);
  }
  logger.info('searchBot: date display verified', { expected, displayed: text });
}

async function saveFailureArtifacts(page, consoleLogs, failedRequests, reason) {
  if (!page) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = join(DEBUG_DIR, stamp);
  try {
    await mkdir(DEBUG_DIR, { recursive: true });
    await Promise.all([
      writeFile(`${base}.html`, await page.content(), 'utf8'),
      page.screenshot({ path: `${base}.png`, fullPage: true }),
      writeFile(`${base}.console.json`, JSON.stringify({ reason, consoleLogs, failedRequests }, null, 2), 'utf8'),
    ]);
    logger.warn('searchBot: saved failure artifacts', { html: `${base}.html`, screenshot: `${base}.png`, console: `${base}.console.json` });
  } catch (err) {
    logger.error('searchBot: could not save failure artifacts', { error: err.message });
  }
}

/**
 * Click the Dates widget div and interact with the calendar overlay.
 */
async function fillDates(page, departureDate, returnDate) {
  const isRoundTrip = Boolean(returnDate && returnDate.trim());

  if (await setEditableDates(page, departureDate, isRoundTrip ? returnDate : null)) {
    return;
  }

  const datesWidget = page.locator('div.Inputs_input__gSCDv:has-text("Dates")').first();
  if (!await datesWidget.count()) {
    throw new Error('searchBot: cannot find Dates widget');
  }

  logger.info('searchBot: clicking Dates widget');
  await datesWidget.click();
  await page.waitForTimeout(800);

  await selectCalendarDate(page, departureDate, 'departure');

  if (isRoundTrip) {
    await page.waitForTimeout(500);
    await selectCalendarDate(page, returnDate, 'return');
  }

  // Close calendar
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await verifyDisplayedDates(page, departureDate, isRoundTrip ? returnDate : null);
}

/**
 * Click the Passengers widget and adjust passengers (adults, children, infants).
 * Default on the site is 1 adult — interact if different from default.
 */
async function fillPassengers(page, adults, children = 0, infants = 0) {
  // If everything is at default (1 adult, 0 children, 0 infants), no need to click
  if (adults === 1 && children === 0 && infants === 0) return;

  const paxWidget = page.locator(
    'div.Inputs_input__gSCDv:has-text("Passengers")'
  ).first();

  if (!await paxWidget.count()) {
    logger.warn('searchBot: Passengers widget not found — leaving at default');
    return;
  }

  logger.info('searchBot: clicking Passengers widget');
  await paxWidget.click();
  await page.waitForTimeout(600);

  // Increment adults if needed (default is 1)
  if (adults > 1) {
    const incSelectors = [
      '[aria-label="Increase adults"]',
      '[aria-label="Add adult"]',
      '[aria-label="increment adults"]',
      'button[aria-label*="adult" i]',
      '[class*="increment"][class*="adult" i]',
      '[class*="adult" i] button:has-text("+")',
      '[class*="passenger" i] button:has-text("+")',
    ];

    let incBtn = null;
    for (const sel of incSelectors) {
      const el = await page.$(sel);
      if (el && await el.isVisible()) { incBtn = el; break; }
    }

    if (incBtn) {
      for (let i = 1; i < adults; i++) {
        logger.info(`searchBot: incrementing adults → ${i + 1}`);
        await incBtn.click();
        await page.waitForTimeout(250);
      }
    } else {
      logger.warn('searchBot: adult increment button not found');
    }
  }

  // Handle children if any
  if (children > 0) {
    const childSelectors = [
      '[aria-label*="child" i] button:has-text("+")',
      'button[aria-label*="children" i]',
      'button[aria-label*="child" i]',
      '[class*="children" i] button:has-text("+")',
      '[class*="child" i] button:has-text("+")',
    ];

    let childIncBtn = null;
    for (const sel of childSelectors) {
      const el = await page.$(sel);
      if (el && await el.isVisible()) { childIncBtn = el; break; }
    }

    if (childIncBtn) {
      for (let i = 0; i < children; i++) {
        logger.info(`searchBot: incrementing children → ${i + 1}`);
        await childIncBtn.click();
        await page.waitForTimeout(250);
      }
    } else {
      logger.warn('searchBot: children increment button not found');
    }
  }

  // Handle infants if any
  if (infants > 0) {
    const infantSelectors = [
      '[aria-label*="infant" i] button:has-text("+")',
      'button[aria-label*="infants" i]',
      'button[aria-label*="infant" i]',
      '[class*="infants" i] button:has-text("+")',
      '[class*="infant" i] button:has-text("+")',
    ];

    let infantIncBtn = null;
    for (const sel of infantSelectors) {
      const el = await page.$(sel);
      if (el && await el.isVisible()) { infantIncBtn = el; break; }
    }

    if (infantIncBtn) {
      for (let i = 0; i < infants; i++) {
        logger.info(`searchBot: incrementing infants → ${i + 1}`);
        await infantIncBtn.click();
        await page.waitForTimeout(250);
      }
    } else {
      logger.warn('searchBot: infants increment button not found');
    }
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

// ─── Main exported search function ───────────────────────────────────────────

/**
 * Perform a complete flight search on AlternativeAirlines as a real user would.
 *
 * @param {{
 *   origin: string,
 *   destination: string,
 *   departureDate: string,
 *   returnDate?: string,
 *   adults: number,
 *   children?: number,
 *   infants?: number
 * }} searchParams
 * @returns {Promise<object[]>} Raw JSON payloads captured from network responses.
 */
async function runSearch(searchParams) {
  const { origin, destination, departureDate, returnDate, adults, children = 0, infants = 0 } = searchParams;
  const startedAt = Date.now();
  const consoleLogs = [];
  const failedRequests = [];
  const captureRunId = new Date().toISOString().replace(/[:.]/g, '-');
  let captureIndex = 0;
  let resultResponseCount = 0;
  let lastResultResponseAt = 0;
  const timings = {};
  let currentStage = 'Launch Browser';
  const remaining = () => TIMEOUT_MS - (Date.now() - startedAt);
  const runStage = async (name, action) => {
    currentStage = name;
    const stageStartedAt = Date.now();
    if (remaining() <= 0) throw timeoutError(name);
    try { return await action(); }
    finally {
      timings[name] = Date.now() - stageStartedAt;
      logger.info('searchBot: stage duration', { stage: name, durationMs: timings[name], remainingMs: Math.max(0, remaining()) });
    }
  };

  logger.info('searchBot: starting browser search', {
    origin,
    destination,
    departureDate,
    returnDate: returnDate || 'none',
    adults,
    children,
    infants,
  });

  const capturedPayloads = [];
  const flightResultPayloads = [];
  let initResponsesCaptured = 0;
  let currencyResponsesCaptured = 0;
  let resultFileIndex = 0;
  const logCaptureSummary = () => logger.info('searchBot: capture summary before parsing', {
    resultsResponsesCaptured: resultResponseCount,
    initResponsesCaptured,
    currencyResponsesCaptured,
    flightResultPayloads: flightResultPayloads.length,
  });
  let browser = null;
  let page = null;

  try {
    browser = await runStage('Launch Browser', launchBrowser);
    logger.info('searchBot: Browser Launched');
    const context = await createContext(browser);
    page = await runStage('New Page Created', () => context.newPage());
    page.setDefaultTimeout(Math.min(30000, Math.max(1000, remaining())));
    page.on('console', (message) => {
      const entry = { type: message.type(), text: message.text() };
      consoleLogs.push(entry);
      if (entry.type === 'error') logger.error('searchBot: browser console error', entry);
    });
    page.on('requestfailed', (request) => {
      const entry = { url: safeUrl(request.url()), method: request.method(), failure: request.failure()?.errorText || 'unknown failure' };
      failedRequests.push(entry);
      logger.error('searchBot: failed network request', entry);
    });

    // ── Block noise resources ────────────────────────────────────────────
    await page.route('**/*', async (route) => {
      const req = route.request();
      if (shouldBlock(req.url(), req.resourceType())) {
        await route.abort();
      } else {
        await route.continue();
      }
    });

    // ── Capture flight JSON responses ────────────────────────────────────
    page.on('request', (request) => {
      if (shouldCapture(request.url())) {
        logger.info('searchBot: matching network request', { url: safeUrl(request.url()), method: request.method() });
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      const ct  = response.headers()['content-type'] || '';
      if (!shouldCapture(url)) return;
      logger.info('searchBot: Matching Response Found', { url: safeUrl(url), status: response.status(), contentType: ct });
      if (!ct.includes('application/json')) return;
      try {
        const status = response.status();
        if (status < 200 || status >= 300) return;
        const json = await response.json();
        if (json && typeof json === 'object') {
          const resultUrl = isFlightResultsUrl(url);
          const initUrl = /\/api\/search\/flights\/init(?:\?|$)/i.test(url);
          const currencyUrl = /\/api\/currencies(?:\?|$)/i.test(url);
          const kind = resultUrl ? 'results' : initUrl ? 'init' : currencyUrl ? 'currencies' : 'other';
          captureIndex += 1;
          await saveCapturedPayloadDebug({
            runId: captureRunId,
            index: resultUrl ? ++resultFileIndex : captureIndex,
            kind,
            url,
            status,
            contentType: ct,
            payload: json,
          });
          logger.info('searchBot: JSON captured', { url: safeUrl(url), payloadCount: capturedPayloads.length + 1 });
          capturedPayloads.push(json);
          if (resultUrl) {
            resultResponseCount += 1;
            lastResultResponseAt = Date.now();
            flightResultPayloads.push(json);
            logger.info('searchBot: flight-results payload captured', { resultResponseCount, url: safeUrl(url) });
          } else if (initUrl) {
            initResponsesCaptured += 1;
          } else if (currencyUrl) {
            currencyResponsesCaptured += 1;
          }
        }
      } catch { /* non-JSON body — skip */ }
    });

    // ── Navigate ─────────────────────────────────────────────────────────
    // A verified public one-way results URL is more reliable than the custom
    // date-picker UI and triggers the same site-side flight search.
    if (!returnDate || !returnDate.trim()) {
      const directUrl = buildDirectSearchUrl({ origin, destination, departureDate, adults, children, infants });
      logger.info('searchBot: using direct Alternative Airlines search URL', { directUrl });
      await runStage('Alternative Airlines Opened', () => page.goto(directUrl, {
        waitUntil: 'domcontentloaded',
        timeout: Math.max(1000, remaining()),
      }));
      logger.info('searchBot: Search Form Completed', { mode: 'direct-url' });
      logger.info('searchBot: Search Button Clicked', { mode: 'direct-url' });
      logger.info('searchBot: Waiting For Network Responses');

      const resultsStartedAt = Date.now();
      const maxWaitWindowMs  = Math.min(15000, Math.max(8000, remaining()));
      const deadline         = resultsStartedAt + maxWaitWindowMs;

      const hasFlights = (payloads) => payloads.some((p) => {
        const pgs = p?.data?.priceGroups || p?.priceGroups || p?.payload?.data?.priceGroups;
        if (Array.isArray(pgs) && pgs.length > 0) return true;
        const itins = p?.results || p?.flights || p?.offers || p?.data?.results;
        return Array.isArray(itins) && itins.length > 0;
      });

      while (Date.now() < deadline) {
        const foundFlights = hasFlights(flightResultPayloads);
        const quietMs = Date.now() - lastResultResponseAt;

        // If we captured non-empty flight offers and network has settled for 2.5s, exit early
        if (foundFlights && resultResponseCount > 0 && quietMs >= 2500) {
          logger.info('searchBot: captured non-empty flight offers — resolving early', {
            resultResponseCount,
            quietMs,
          });
          break;
        }

        // If results are quiet for 6s even if empty, exit loop
        if (resultResponseCount > 0 && quietMs >= 6000) {
          logger.info('searchBot: results quiet for 6s — proceeding to parse', {
            resultResponseCount,
            foundFlights,
          });
          break;
        }

        await page.waitForTimeout(500);
      }

      if (hasFlights(flightResultPayloads)) {
        logger.info('searchBot: direct URL search returned valid flights', { payloads: capturedPayloads.length, resultResponseCount });
        timings['Wait For Results'] = Date.now() - resultsStartedAt;
        logger.info('searchBot: search timing summary', { totalMs: Date.now() - startedAt, timings });
        logCaptureSummary();
        return flightResultPayloads;
      }

      logger.info('searchBot: direct URL returned zero flight offers — falling back to interactive widget search on homepage');
    }

    logger.info('searchBot: navigating to AlternativeAirlines');
    await runStage('Alternative Airlines Opened', () => page.goto(BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: Math.max(1000, remaining()),
    }));

    // Wait for the widget container
    await page.waitForSelector('#flight-search', { timeout: 20000 }).catch(() => {
      logger.warn('searchBot: #flight-search not found — continuing');
    });
    await page.waitForTimeout(1500);

    // ── Trip type ────────────────────────────────────────────────────────
    const isRoundTrip = Boolean(returnDate && returnDate.trim());
    const tripLabel   = isRoundTrip ? 'Return' : 'One way';
    logger.info(`searchBot: selecting trip type: ${tripLabel}`);

    const tripBtn = page.locator(
      `button.TripTypes_button__4HzkR:has-text("${tripLabel}")`
    ).first();
    if (await tripBtn.count()) {
      await tripBtn.click();
      await page.waitForTimeout(400);
    } else {
      logger.warn(`searchBot: trip-type button "${tripLabel}" not found — using page default`);
    }

    // ── Origin ────────────────────────────────────────────────────────────
    await runStage('Fill Search Form: Origin', () => fillAirport(page, 'Where from?', origin, 'origin'));

    // ── Destination ───────────────────────────────────────────────────────
    await runStage('Fill Search Form: Destination', () => fillAirport(page, 'Where to?', destination, 'destination'));

    // ── Dates ─────────────────────────────────────────────────────────────
    await runStage('Fill Search Form: Dates', () => fillDates(page, departureDate, isRoundTrip ? returnDate : null));

    // ── Passengers ────────────────────────────────────────────────────────
    await runStage('Fill Search Form: Passengers', () => fillPassengers(page, adults, children, infants));
    logger.info('searchBot: Search Form Completed');

    // ── Click Search ──────────────────────────────────────────────────────
    logger.info('searchBot: clicking search button');
    const searchBtn = await page.$('#aa-search-widget-continue-click');
    if (!searchBtn) {
      throw new Error(
        'searchBot: search button (#aa-search-widget-continue-click) not found'
      );
    }
    await runStage('Click Search', () => searchBtn.click());
    logger.info('searchBot: Search Button Clicked');

    // ── Collect results ───────────────────────────────────────────────────
    logger.info('searchBot: waiting for results...');
    logger.info('searchBot: Waiting For Network Responses');
    const resultsStartedAt = Date.now();
    const maxWaitWindowMs  = Math.min(15000, Math.max(8000, remaining()));
    const deadline         = resultsStartedAt + maxWaitWindowMs;

    const hasFlights = (payloads) => payloads.some((p) => {
      const pgs = p?.data?.priceGroups || p?.priceGroups || p?.payload?.data?.priceGroups;
      if (Array.isArray(pgs) && pgs.length > 0) return true;
      const itins = p?.results || p?.flights || p?.offers || p?.data?.results;
      return Array.isArray(itins) && itins.length > 0;
    });

    while (Date.now() < deadline) {
      const foundFlights = hasFlights(flightResultPayloads);
      const quietMs = Date.now() - lastResultResponseAt;

      if (foundFlights && resultResponseCount > 0 && quietMs >= 2500) {
        logger.info('searchBot: captured non-empty flight offers — resolving early', {
          resultResponseCount,
          quietMs,
        });
        break;
      }

      if (resultResponseCount > 0 && quietMs >= 6000) {
        logger.info('searchBot: results quiet for 6s — proceeding to parse', {
          resultResponseCount,
          foundFlights,
        });
        break;
      }

      await page.waitForTimeout(500);
    }

    if (resultResponseCount === 0) {
      logger.warn('searchBot: no flight-results JSON payloads captured within timeout', { totalJsonPayloads: capturedPayloads.length });
      await saveFailureArtifacts(page, consoleLogs, failedRequests, 'No /api/search/flights/results JSON response captured after search click');
    } else {
      logger.info('searchBot: search complete', { payloads: capturedPayloads.length, resultResponseCount, hasFlights: hasFlights(flightResultPayloads) });
    }

    timings['Wait For Results'] = Date.now() - resultsStartedAt;
    logger.info('searchBot: search timing summary', { totalMs: Date.now() - startedAt, timings });
    logCaptureSummary();
    return flightResultPayloads;

  } catch (err) {
    logger.error('searchBot: search failed', { stage: currentStage, totalMs: Date.now() - startedAt, timings, error: err.message, stack: err.stack });
    await saveFailureArtifacts(page, consoleLogs, failedRequests, `${currentStage}: ${err.message}`);
    if (Date.now() - startedAt >= TIMEOUT_MS || err.name === 'TimeoutError') throw timeoutError(currentStage);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
      logger.info('searchBot: Browser Closed');
    }
  }
}

export default { runSearch };
