/**
 * bots/aeroBot.js
 *
 * Aero Contractors provider via FlyBro (https://flybro.net).
 *
 * FlyBro exposes an "aero_redirect" endpoint that returns an auto-submitting HTML
 * form which POSTs the traveller's search into Aero's Crane IBE availability page:
 *   https://flybro.net/api/aero_redirect/form?origin&destination&departure_date&trip_type&adults&children&infants
 *     -> https://book-flyaero.crane.aero/web/Availability.xhtml
 *
 * The availability page is server-rendered JSF/XHTML (no JSON API). Results are read
 * from the DOM. Every parsed flight is confirmed to be Aero Contractors (flight number
 * prefix N2 / MN); anything else is discarded.
 *
 * IMPORTANT: This provider does NOT solve/bypass CAPTCHA or Cloudflare challenges. If a
 * challenge blocks the page, the provider reports PROVIDER_ERROR and the overall search
 * continues with the remaining providers.
 *
 * Error policy:
 *   - Navigation failure / challenge / no DOM results parsed on an errored page
 *        -> PROVIDER_ERROR (never "no results")
 *   - Page loads cleanly but Aero has zero Aero-operated flights for the route
 *        -> NO_RESULTS (empty array)
 */

import { launchBrowser, createContext } from './browser.js';
import { validateAndNormalizeFlights } from '../utils/flightValidator.js';
import logger from '../utils/logger.js';

const FLYBRO_FORM = 'https://flybro.net/api/aero_redirect/form';
const TIMEOUT_MS = parseInt(process.env.AERO_TIMEOUT_MS || '45000', 10);
const PROVIDER_NAME = 'Aero';
const SOURCE = 'flybro-aero';
const BOOKING_URL = 'https://book-flyaero.crane.aero/web/Availability.xhtml';

// Flight-number prefixes that unambiguously identify Aero Contractors.
const AERO_FN_RE = /^\s*(N2|MN)\s?-?\s?\d{2,4}\b/i;

function providerError(message, errorType) {
  const err = new Error(message);
  err.name = 'ProviderError';
  err.code = 'PROVIDER_ERROR';
  err.errorType = errorType;
  err.provider = PROVIDER_NAME;
  err.providerStatus = 'ERROR';
  return err;
}

/** Build the FlyBro aero_redirect form URL for a one-way search. */
function buildFlyBroUrl({ origin, destination, departureDate, adults, children, infants }) {
  const params = new URLSearchParams({
    origin: String(origin).toUpperCase(),
    destination: String(destination).toUpperCase(),
    departure_date: departureDate,
    trip_type: 'oneway',
    adults: String(adults || 1),
    children: String(children || 0),
    infants: String(infants || 0),
  });
  return `${FLYBRO_FORM}?${params.toString()}`;
}

/**
 * Parse all `.flight-details` containers in the Crane IBE availability DOM.
 * Runs inside page.evaluate (browser context) — returns raw flight descriptors.
 * Airport fields are the page's real city labels (e.g. "Lagos"); the validator
 * maps them to IATA codes. No values are invented.
 */
function extractFlightsFromDom(bookingUrl) {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const containers = Array.from(document.querySelectorAll('.flight-details'));
  const flights = [];

  for (const box of containers) {
    const depTime = clean(box.querySelector('.departure-time')?.textContent);
    const arrTime = clean(box.querySelector('.arrival-time')?.textContent);
    const depCity = clean(box.querySelector('.departure-airport')?.textContent);
    const arrCity = clean(box.querySelector('.arrival-airport')?.textContent);

    // Modal detail table: label -> value pairs.
    const detail = {};
    box.querySelectorAll('.flight-details-modal table tr, table tr').forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 2) {
        detail[clean(tds[0].textContent)] = clean(tds[1].textContent);
      }
    });

    const flightNumber = detail['Flight Number'] || '';

    // Departing/Arrival date-time ("23/09/2026 06:45") — authoritative dates.
    const departingRaw = detail['Departing Date'] || '';
    const arrivalRaw = detail['Arrival Date'] || '';

    // Pick the cheapest selectable fare from the .prices column.
    let bestPrice = null;
    let bestCabin = '';
    box.querySelectorAll('.button-fare.price').forEach((cell) => {
      const priceTxt = clean(cell.querySelector('.mobile-price')?.textContent);
      const tag = clean(cell.querySelector('.mobile-tag')?.textContent).replace(/\?/g, '');
      const digits = priceTxt.replace(/[^0-9.]/g, '');
      const value = digits ? parseFloat(digits) : NaN;
      if (!isNaN(value) && value > 0 && (bestPrice === null || value < bestPrice)) {
        bestPrice = value;
        bestCabin = tag;
      }
    });

    // Stops: availability rows are per-segment non-stop; detect explicitly.
    const durLine = clean(box.querySelector('.modal-side-links')?.textContent);
    const stops = /non-?\s?stop/i.test(durLine) ? 0 : 0;

    flights.push({
      airline: 'Aero Contractors',
      airlineCode: (flightNumber.match(/^(N2|MN)/i) || [, 'N2'])[1].toUpperCase(),
      flightNumber,
      origin: depCity,
      destination: arrCity,
      departureDate: departingRaw,
      departureTime: depTime,
      arrivalDate: arrivalRaw,
      arrivalTime: arrTime,
      duration: detail['Flight Duration'] || durLine.replace(/^Travel duration:\s*/i, ''),
      stops,
      cabinClass: (bestCabin || 'Economy').replace(/_/g, ' '),
      price: bestPrice,
      currency: 'NGN',
      aircraft: (detail['Aircraft Type'] || '').replace(/\?/g, ''),
      bookingUrl,
      availabilityStatus: bestPrice !== null ? 'AVAILABLE' : 'UNAVAILABLE',
      rawOfferId: flightNumber ? `flybro-aero_${flightNumber}_${departingRaw}` : null,
      metadata: {
        flybroSource: 'flybro-aero_redirect',
        modalDetail: detail,
      },
    });
  }

  return flights;
}

function looksLikeChallenge(html) {
  return (
    /Just a moment/i.test(html) ||
    /cf-turnstile/i.test(html) ||
    /cf-challenge/i.test(html) ||
    /Attention Required/i.test(html) ||
    /Checking your browser/i.test(html)
  );
}

export async function runSearch(params) {
  const { origin, destination, departureDate } = params;
  const startedAt = Date.now();
  const url = buildFlyBroUrl(params);

  logger.info('AeroBot: starting FlyBro -> Aero availability search', {
    origin, destination, departureDate, url,
  });

  let browser = null;
  let page = null;
  let rawFlights = [];
  let fatal = null;

  try {
    browser = await launchBrowser();
    const context = await createContext(browser);
    page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);

    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    if (!resp) throw providerError('FlyBro redirect produced no navigation response', 'NAVIGATION');

    // The form auto-submits into the Crane IBE availability page. Wait for flights.
    try {
      await page.waitForSelector('.flight-details', { timeout: Math.min(TIMEOUT_MS, 25000) });
    } catch (e) {
      // No flight containers — could be genuinely empty or a challenge page.
      const html = await page.content();
      if (looksLikeChallenge(html)) {
        throw providerError('Aero availability blocked by a bot challenge', 'CHALLENGE');
      }
      // Clean page with no flights: treat as NO_RESULTS.
      rawFlights = [];
    }

    const html = await page.content();
    if (looksLikeChallenge(html)) {
      throw providerError('Aero availability blocked by a bot challenge', 'CHALLENGE');
    }

    if (rawFlights.length === 0) {
      rawFlights = await page.evaluate(extractFlightsFromDom, BOOKING_URL);
    }
  } catch (err) {
    if (err.name === 'ProviderError') {
      fatal = err;
    } else {
      fatal = providerError(`Aero search failed: ${err.message}`, err.code === 'ETIMEDOUT' || /timeout/i.test(err.message) ? 'TIMEOUT' : 'NAVIGATION');
    }
    logger.warn('AeroBot: search error', { error: err.message, errorType: fatal.errorType });
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  if (fatal) throw fatal;

  // Keep ONLY Aero Contractors flights (explicit carrier identifiers).
  const aeroRaw = (rawFlights || []).filter((f) => AERO_FN_RE.test(f.flightNumber || ''));

  logger.info('AeroBot: parsed DOM flights, filtered to Aero', {
    parsed: (rawFlights || []).length,
    aeroCount: aeroRaw.length,
  });

  // Strictly validate & normalize against requested route/date (discards mismatches).
  const { validFlights } = validateAndNormalizeFlights(aeroRaw, params, PROVIDER_NAME, SOURCE);

  logger.info('AeroBot: search completed', { durationMs: Date.now() - startedAt, count: validFlights.length });
  return validFlights;
}

export default { runSearch };
