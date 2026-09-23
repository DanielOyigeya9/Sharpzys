/**
 * bots/enuguAirBot.js
 *
 * Enugu Air provider via FlyNaija (https://www.flynaija.ng).
 *
 * FlyNaija is a MULTI-AIRLINE Nigerian flight comparison platform. It exposes a
 * structured JSON search API:
 *   GET https://www.flynaija.ng/api/flights/search?origin&destination&departDate&passengers
 *
 * This bot queries that API and returns ONLY flights confidently identified as
 * "Enugu Air" (airline id / name / carrier codes). Every other airline in the
 * FlyNaija result set is discarded. No browser is required — this is a targeted
 * single HTTP request per search (Render-friendly).
 *
 * Error policy:
 *   - Malformed / empty / non-JSON response  -> PROVIDER_ERROR (never "no results")
 *   - Valid response with zero Enugu flights -> NO_RESULTS (empty array)
 */

import axios from 'axios';
import { validateAndNormalizeFlights } from '../utils/flightValidator.js';
import logger from '../utils/logger.js';

const SEARCH_API = 'https://www.flynaija.ng/api/flights/search';
const TIMEOUT_MS = parseInt(process.env.ENUGUAIR_TIMEOUT_MS || '20000', 10);
const PROVIDER_NAME = 'EnuguAir';
const SOURCE = 'flynaija-enugu';

// Identifiers that unambiguously mean "Enugu Air" within FlyNaija data.
const ENUGU_NAME_RE = /\benugu\s*air(lines)?\b/i;
const ENUGU_IDS = new Set(['enugu-air', 'enuguair', 'enugu']);
const ENUGU_CARRIER_CODES = new Set(['EU', 'E3', 'EG', 'EE']);

function isEnuguAir(flight) {
  const a = flight?.airline || {};
  const name = String(a.name || '');
  const id = String(a.id || a.code || '').toLowerCase();
  const iata = String(a.iataCode || '').toUpperCase();
  const carrier = String((flight.segments?.[0]?.carrierCode) || '').toUpperCase();

  if (ENUGU_IDS.has(id)) return true;
  if (ENUGU_NAME_RE.test(name)) return true;
  if (ENUGU_CARRIER_CODES.has(iata) || ENUGU_CARRIER_CODES.has(carrier)) return true;
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
  // "2026-09-23T19:10:00" -> "19:10"
  const m = String(iso || '').match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}
function toDateOnly(iso) {
  // "2026-09-23T19:10:00" -> "2026-09-23"
  const m = String(iso || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/** Map a FlyNaija flight into the raw shape the validator normalizes/validates. */
function mapEnuguFlight(f) {
  const segs = Array.isArray(f.segments) ? f.segments : [];
  const first = segs[0] || {};
  const last = segs[segs.length - 1] || first;
  const a = f.airline || {};

  return {
    airline: 'Enugu Air',
    airlineCode: first.carrierCode || a.iataCode || 'EU',
    flightNumber: String(first.flightNumber || '').trim(),
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
    bookingUrl: f.deepLink || a.bookingUrl || 'https://booking.enuguairlines.ng/',
    availabilityStatus: 'AVAILABLE',
    rawOfferId: f.id || null,
    metadata: {
      flynaijaAirlineId: a.id || null,
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

  logger.info('EnuguAirBot: querying FlyNaija search API', { origin, destination, departureDate, adults });

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
    // Guard against a 200 that returned a non-JSON/HTML body.
    if (typeof res.data !== 'object' || res.data === null) {
      throw providerError('FlyNaija returned a non-JSON response', 'INVALID_RESPONSE');
    }
    if (!Array.isArray(res.data.flights)) {
      throw providerError('FlyNaija response missing "flights" array', 'INVALID_RESPONSE');
    }
    data = res.data;
  } catch (err) {
    if (err.name === 'ProviderError') throw err;
    // axios errors (timeout / non-2xx / JSON parse "Unexpected end of JSON input")
    const errType = /timeout|ECONN|ETIMEDOUT/i.test(err.code || err.message || '')
      ? 'TIMEOUT'
      : 'INVALID_RESPONSE';
    logger.warn('EnuguAirBot: FlyNaija request failed — PROVIDER_ERROR', { errorType: errType, error: err.message });
    throw providerError(`FlyNaija request failed: ${err.message}`, errType);
  }

  // Filter strictly to Enugu Air, then map into raw shapes.
  const enuguRaw = (data.flights || []).filter(isEnuguAir).map(mapEnuguFlight);

  logger.info('EnuguAirBot: FlyNaija results filtered to Enugu Air', {
    totalFromFlyNaija: (data.flights || []).length,
    enuguCount: enuguRaw.length,
  });

  // Strictly validate & normalize against requested route/date (discards mismatches).
  const { validFlights } = validateAndNormalizeFlights(enuguRaw, params, PROVIDER_NAME, SOURCE);

  logger.info('EnuguAirBot: search completed', { durationMs: Date.now() - startedAt, count: validFlights.length });
  return validFlights;
}

export default { runSearch };
