/**
 * bots/airPeaceBot.js
 *
 * Air Peace provider via FlyNaija (https://www.flynaija.ng) — a MULTI-AIRLINE
 * Nigerian flight-comparison JSON API:
 *   GET https://www.flynaija.ng/api/flights/search?origin&destination&departDate&passengers
 *
 * Air Peace's own Crane IBE (book-airpeace.crane.aero) is behind a Cloudflare
 * managed challenge that blocks every automated client (verified headless AND in
 * a real headed browser), so it cannot be scraped reliably from Vercel/Render.
 * FlyNaija exposes the same Air Peace schedule/fares over plain JSON, which works
 * server-side with no browser.
 *
 * This bot queries FlyNaija and returns ONLY flights confidently identified as
 * Air Peace (id `air-peace` / IATA `P4` / carrier `P4` / name "Air Peace").
 * Every other airline in the result set is discarded. No fabrication: nothing is
 * ever invented or defaulted.
 *
 * Error policy (mirrors EnuguAir):
 *   - Malformed / empty / non-JSON / network failure -> PROVIDER_ERROR (never "no results")
 *   - Valid response with zero Air Peace flights      -> NO_RESULTS (empty array)
 */

import axios from 'axios';
import { validateAndNormalizeFlights } from '../utils/flightValidator.js';
import logger from '../utils/logger.js';

const SEARCH_API = 'https://www.flynaija.ng/api/flights/search';
const TIMEOUT_MS = parseInt(process.env.AIRPEACE_TIMEOUT_MS || '20000', 10);
const PROVIDER_NAME = 'AirPeace';
const SOURCE = 'flynaija-airpeace';

// Identifiers that unambiguously mean "Air Peace" within FlyNaija data.
const AP_NAME_RE = /\bair\s*peace\b/i;
const AP_IDS = new Set(['air-peace', 'airpeace']);
const AP_CARRIER_CODES = new Set(['P4', 'AP']);
const DEFAULT_BOOKING_URL = 'https://www.flyairpeace.com/';

function isAirPeace(flight) {
  const a = flight?.airline || {};
  const name = String(a.name || '');
  const id = String(a.id || a.code || '').toLowerCase();
  const iata = String(a.iataCode || '').toUpperCase();
  const carrier = String((flight.segments?.[0]?.carrierCode) || '').toUpperCase();
  if (AP_IDS.has(id)) return true;
  if (AP_NAME_RE.test(name)) return true;
  if (AP_CARRIER_CODES.has(iata) || AP_CARRIER_CODES.has(carrier)) return true;
  return false;
}

/** Build a provider error carrying structured status for admin health monitoring. */
function providerError(message, errorType) {
  const err = new Error(message);
  err.name = 'ProviderError';
  err.code = 'PROVIDER_ERROR';
  err.errorType = errorType;
  err.provider = PROVIDER_NAME;
  err.providerStatus = 'ERROR';
  return err;
}

function toTimeOnly(iso) {
  const m = String(iso || '').match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}
function toDateOnly(iso) {
  const m = String(iso || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/** Normalize FlyNaija's concatenated flight number (e.g. "P47128") into "P4 7128". */
function normalizeFlightNumber(raw) {
  const fn = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!fn) return '';
  const digits = fn.replace(/^P4/, '').replace(/^AP/, '');
  return digits ? `P4 ${digits}` : fn;
}

/** Map a FlyNaija flight into the raw shape the validator normalizes/validates. */
function mapAirPeaceFlight(f) {
  const segs = Array.isArray(f.segments) ? f.segments : [];
  const first = segs[0] || {};
  const last = segs[segs.length - 1] || first;
  const a = f.airline || {};

  return {
    airline: 'Air Peace',
    airlineCode: 'P4',
    flightNumber: normalizeFlightNumber(first.flightNumber || first.carrierCode),
    origin: first.departure?.iataCode || '',
    destination: last.arrival?.iataCode || '',
    departureDate: toDateOnly(first.departure?.time),
    departureTime: toTimeOnly(first.departure?.time),
    arrivalDate: toDateOnly(last.arrival?.time),
    arrivalTime: toTimeOnly(last.arrival?.time),
    duration: f.totalDuration ?? first.duration ?? '',
    stops: typeof f.stops === 'number' ? f.stops : Math.max(0, segs.length - 1),
    cabinClass: f.cabinClass || 'Economy',
    price: f.price ?? null,
    currency: (f.currency || 'NGN').toUpperCase(),
    bookingUrl: f.deepLink || a.bookingUrl || DEFAULT_BOOKING_URL,
    availabilityStatus: 'AVAILABLE',
    rawOfferId: f.id || null,
    metadata: {
      flynaijaAirlineId: a.id || null,
      flynaijaIataCode: a.iataCode || null,
      flynaijaSource: f.source || null,
      lastUpdated: f.lastUpdated || null,
      deepLink: f.deepLink || null,
      segments: segs.map((s) => ({
        flightNumber: s.flightNumber,
        carrierCode: s.carrierCode,
        from: s.departure?.iataCode,
        to: s.arrival?.iataCode,
        depTime: s.departure?.time,
        arrTime: s.arrival?.time,
      })),
    },
  };
}

export async function runSearch(params) {
  const { origin, destination, departureDate, adults = 1 } = params;
  const startedAt = Date.now();

  logger.info('AirPeaceBot: querying FlyNaija search API', { origin, destination, departureDate, adults });

  const query = {
    origin: String(origin).toUpperCase(),
    destination: String(destination).toUpperCase(),
    departDate: departureDate,
    passengers: adults,
  };

  let data;
  try {
    const res = await axios.get(SEARCH_API, {
      params: query,
      timeout: TIMEOUT_MS,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      responseType: 'json',
      validateStatus: (s) => s >= 200 && s < 300,
    });
    if (typeof res.data !== 'object' || res.data === null) {
      throw providerError('FlyNaija returned a non-JSON response', 'INVALID_RESPONSE');
    }
    if (!Array.isArray(res.data.flights)) {
      throw providerError('FlyNaija response missing "flights" array', 'INVALID_RESPONSE');
    }
    data = res.data;
  } catch (err) {
    if (err.name === 'ProviderError') throw err;
    const errType = /timeout|ECONN|ETIMEDOUT/i.test(err.code || err.message || '')
      ? 'TIMEOUT'
      : 'INVALID_RESPONSE';
    logger.warn('AirPeaceBot: FlyNaija request failed — PROVIDER_ERROR', { errorType: errType, error: err.message });
    throw providerError(`FlyNaija request failed: ${err.message}`, errType);
  }

  // Filter strictly to Air Peace, then map into raw shapes.
  const apRaw = (data.flights || []).filter(isAirPeace).map(mapAirPeaceFlight);

  logger.info('AirPeaceBot: FlyNaija results filtered to Air Peace', {
    totalFromFlyNaija: (data.flights || []).length,
    airPeaceCount: apRaw.length,
  });

  // Strictly validate & normalize against requested route/date (discards mismatches).
  const { validFlights } = validateAndNormalizeFlights(apRaw, params, PROVIDER_NAME, SOURCE);

  logger.info('AirPeaceBot: search completed', { durationMs: Date.now() - startedAt, count: validFlights.length });
  return validFlights;
}

export default { runSearch };
