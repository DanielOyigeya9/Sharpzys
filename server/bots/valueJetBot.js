/**
 * bots/valueJetBot.js
 * Live REST API bot for ValueJet (VK).
 *
 * STRICT REAL-DATA RULE: Sharpzy only returns flights confirmed by the live provider.
 * All flight fields (date, time, price, duration) come directly from ValueJet's API.
 * No hardcoded schedules, no fake fallbacks, no invented data of any kind.
 *
 * API endpoint (open, no authentication required):
 *   GET https://api.flyvaluejet.com/ibe/flight/search
 *   Query params: from, to, date (YYYY-MM-DD), adults
 *
 * Response structure:
 *   data._.itineraries -> { CPA_1: { VK200: {...flight...} }, CPA_2: {...}, ... }
 *   Each flight has:
 *     departure.date (YYYY-MM-DD), departure.time (HH:MM:SS), departure.code (IATA)
 *     arrival.date (YYYY-MM-DD), arrival.time (HH:MM:SS), arrival.code (IATA)
 *     duration (HH:MM:SS), number (flight number digits), fares.lite.value (cheapest fare)
 *
 * IMPORTANT: ValueJet's API may return the nearest available date regardless of the
 * requested date param. The strict validator will REJECT any flight whose
 * departure.date does not exactly match the user's requested date. This is correct
 * behavior — we must NEVER substitute the user's requested date for the provider's date.
 */

import { validateAndNormalizeFlights } from '../utils/flightValidator.js';
import logger from '../utils/logger.js';

const SEARCH_URL = 'https://api.flyvaluejet.com/ibe/flight/search';
const PROVIDER_NAME = 'ValueJet';
const TIMEOUT_MS = parseInt(process.env.VALUEJET_TIMEOUT_MS || '45000', 10);

/**
 * Convert ValueJet duration "HH:MM:SS" → human-readable "1h 15m"
 * Returns null if unparseable (never fabricate a duration).
 */
function parseDuration(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const parts = hhmm.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  if (h === 0 && m === 0) return null;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}


/**
 * Parse ValueJet API response into raw flight objects for the validator.
 *
 * ACTUAL API STRUCTURE (confirmed from live inspection):
 *   data._  = Array of journey objects, each representing one fare/journey combination
 *   Each journey:
 *     journey_key: "JR_4"
 *     amount: { base, value, taxes, surcharge, total }  ← full price incl taxes
 *     combinations: Array of flight leg objects (1 for direct, 2+ for connecting)
 *     Each combination leg:
 *       number: "200"              ← flight number digits
 *       from: "LOS"               ← origin IATA
 *       to: "ABV"                 ← destination IATA
 *       departure: { date, time, timeoffset, date_time, code }
 *       arrival: { date, time, timeoffset, date_time, code }
 *       duration: "01:15:00"      ← HH:MM:SS
 *       info: { equipment: "cr9" }
 */
function parseValueJetResponse(data, requiredAdults = 1) {
  const results = [];
  try {
    const journeys = data?.data?.['_'];
    if (!Array.isArray(journeys) || journeys.length === 0) return results;

    for (const journey of journeys) {
      if (!journey || typeof journey !== 'object') continue;

      const combinations = journey.combinations;
      if (!Array.isArray(combinations) || combinations.length === 0) continue;

      // Only handle direct (non-stop) flights — skip connecting journeys
      if (combinations.length > 1) continue;

      const leg = combinations[0];
      if (!leg || typeof leg !== 'object') continue;

      // Strict Seat Availability Rule:
      // leg.count is the number of remaining bookable seats in this fare class.
      // If count is 0 or less than the requested adult passengers, this fare tier is SOLD OUT.
      if (typeof leg.count === 'number' && leg.count < requiredAdults) {
        continue;
      }

      // Extract departure — only from provider-supplied fields, never invented
      const depDate = leg.departure?.date || null;
      const depTime = leg.departure?.time || null;
      const depCode = leg.departure?.code || leg.from || null;

      // Extract arrival — only from provider-supplied fields
      const arrDate = leg.arrival?.date || null;
      const arrTime = leg.arrival?.time || null;
      const arrCode = leg.arrival?.code || leg.to || null;

      // Flight number: API provides digits e.g. "200" → prefix "VK"
      const rawNum = (leg.number || '').toString().trim();
      const flightNumber = rawNum ? `VK${rawNum}` : null;

      // Duration from provider (e.g. "01:15:00")
      const duration = parseDuration(leg.duration || null);

      // Price matching ValueJet website display:
      //   The website shows "Starting at X NGN — Excluding taxes"
      //   This is leg.amount.base (the base fare before taxes/surcharges).
      //   journey.amount.total = full checkout price incl. QT + NG + YQ surcharges.
      //   We display leg.amount.base to match the website exactly.
      const basePrice = leg.amount?.base || null;   // "Starting at" price (excluding taxes)
      const totalPrice = journey.amount?.total || null; // Full checkout total

      // Use base price as the displayed price to match ValueJet website
      const price = basePrice || totalPrice;

      // Aircraft equipment type
      const aircraft = leg.info?.equipment || null;

      // Skip if any critical field is missing
      if (!depDate || !depCode || !arrCode || !flightNumber || !price) continue;

      results.push({
        airline: PROVIDER_NAME,
        airlineCode: 'VK',
        flightNumber,
        origin: depCode,
        destination: arrCode,
        departureDate: depDate,
        departureTime: depTime || null,
        arrivalDate: arrDate || null,
        arrivalTime: arrTime || null,
        duration,
        stops: 0,
        cabinClass: 'Economy',
        price,           // base fare — matches "Starting at X NGN Excluding taxes" on website
        totalPrice,      // full checkout total including all taxes and surcharges
        seatsAvailable: typeof leg.count === 'number' ? leg.count : null,
        currency: 'NGN',
        aircraft,
        provider: PROVIDER_NAME,
        bookingUrl: `https://www.flyvaluejet.com/flight-result?c=from:${depCode};to:${arrCode};on:${depDate}`,
      });
    }
  } catch (e) {
    logger.warn('ValueJetBot: error parsing API response', { error: e.message });
  }
  return results;
}


export async function runSearch(params) {
  const { origin, destination, departureDate, adults = 1, children = 0, infants = 0 } = params;
  const startedAt = Date.now();

  logger.info('ValueJetBot: starting live API search', { origin, destination, departureDate, adults, children, infants });

  const url = `${SEARCH_URL}?from=${encodeURIComponent(origin.toUpperCase())}&to=${encodeURIComponent(destination.toUpperCase())}&on=${encodeURIComponent(departureDate)}&adult=${adults}&child=${children}&infant=${infants}`;

  let rawFlights = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      logger.warn('ValueJetBot: API returned non-200', { status: res.status, url });
      return [];
    }

    const json = await res.json();
    logger.info('ValueJetBot: API response received', { count: json?.count, url });

    rawFlights = parseValueJetResponse(json, adults);
    logger.info('ValueJetBot: parsed raw flights', { rawCount: rawFlights.length });

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('ValueJetBot: API request timed out', { url, timeoutMs: TIMEOUT_MS });
    } else {
      logger.warn('ValueJetBot: API request failed', { error: err.message, url });
    }
    return [];
  }

  // Sort raw flights by price ascending so deduplication keeps the lowest available fare tier
  rawFlights.sort((a, b) => (a.price || 0) - (b.price || 0));

  // Strict validator: rejects flights whose date/route/price don't match search params
  const { validFlights } = validateAndNormalizeFlights(rawFlights, params, PROVIDER_NAME);

  logger.info('ValueJetBot: search completed', {
    durationMs: Date.now() - startedAt,
    rawCount: rawFlights.length,
    validCount: validFlights.length,
  });

  return validFlights;
}

export default { runSearch };
