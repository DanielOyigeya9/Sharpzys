/**
 * utils/flightValidator.js
 *
 * Strict validation and normalization pipeline for scraped flight objects.
 * Enforces:
 *   - Route matching (Origin & Destination IATA codes)
 *   - Departure date matching (YYYY-MM-DD)
 *   - Price validity & normalization (removes currency symbols, commas, decimals)
 *   - Supported airline verification
 *   - Deduplication using compound key
 *   - Structured debug logging (SEARCH REQUEST, RAW, NORMALIZED, VALID, REJECTED)
 */

import { normalizeIataCode } from './airportMapper.js';
import { isSupportedAirline } from '../services/supportedAirlines.js';
import logger from './logger.js';

/**
 * Clean and parse price strings into exact integers (e.g. "₦150,000" -> 150000).
 *
 * @param {string|number} rawPrice
 * @returns {number|null}
 */
export function parseCleanPrice(rawPrice) {
  if (rawPrice === null || rawPrice === undefined) return null;

  if (typeof rawPrice === 'number') {
    return isNaN(rawPrice) || rawPrice <= 0 ? null : Math.round(rawPrice);
  }

  const str = String(rawPrice).trim();
  if (!str) return null;

  // Extract digits and optional decimal point
  // e.g., "₦150,000.00" -> "150000.00" or "NGN 150,000" -> "150000"
  const cleaned = str.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;

  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return null;

  return Math.round(num);
}

/**
 * Extract YYYY-MM-DD date string from various datetime formats without timezone drift.
 *
 * @param {string} dtStr
 * @returns {string} Date string YYYY-MM-DD
 */
export function extractIsoDate(dtStr) {
  if (!dtStr || typeof dtStr !== 'string') return '';
  const clean = dtStr.trim();

  // 1. Matches YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // 2. Matches DD.MM.YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmyMatch) {
    const day = String(dmyMatch[1]).padStart(2, '0');
    const month = String(dmyMatch[2]).padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // 3. Fallback: Parse JS Date with UTC getters to prevent timezone drift
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}

  return '';
}

/**
 * Validate and normalize flight results returned by a provider against search params.
 *
 * @param {Array} rawFlights - Array of raw flight objects scraped/intercepted
 * @param {{ origin: string, destination: string, departureDate: string, adults: number }} searchParams
 * @param {string} providerName - Provider identifier name
 * @param {string} [source] - Canonical provider source identity (e.g. "flynaija-enugu")
 * @returns {{ validFlights: Array, rejectedFlights: Array }}
 */
export function validateAndNormalizeFlights(rawFlights = [], searchParams, providerName = 'Unknown', source = '') {
  const reqOrigin = normalizeIataCode(searchParams.origin);
  const reqDestination = normalizeIataCode(searchParams.destination);
  const reqDate = extractIsoDate(searchParams.departureDate);

  const validFlights = [];
  const rejectedFlights = [];
  const seenKeys = new Set();

  logger.info(`[DEBUG MODE] SEARCH REQUEST`, {
    provider: providerName,
    origin: reqOrigin,
    destination: reqDestination,
    departureDate: reqDate,
    rawCount: Array.isArray(rawFlights) ? rawFlights.length : 0,
  });

  if (!Array.isArray(rawFlights) || rawFlights.length === 0) {
    logger.info(`[DEBUG MODE] ${providerName} - RAW RESULTS: 0 | NORMALIZED: 0 | VALID: 0 | REJECTED: 0`);
    return { validFlights: [], rejectedFlights: [] };
  }

  for (const raw of rawFlights) {
    const origin = normalizeIataCode(raw.origin || raw.departureAirport || raw.from);
    const destination = normalizeIataCode(raw.destination || raw.arrivalAirport || raw.to);
    
    // Explicit departure date extraction — NEVER fallback to reqDate!
    const depTime = raw.departureTime || raw.depTime || '';
    const explicitDepDate = raw.departureDate ? extractIsoDate(raw.departureDate) : extractIsoDate(depTime);
    
    const price = parseCleanPrice(raw.price ?? raw.totalPrice ?? raw.amount);
    const flightNum = (raw.flightNumber || raw.number || raw.code || '').toString().trim();
    const airline = (raw.airline || raw.carrier || providerName).trim();
    const airlineCode = (raw.airlineCode || raw.carrierCode || '').trim().toUpperCase();

    // 1. Verify Explicit Departure Date Presence (Phase 5 & Phase 9)
    if (!explicitDepDate) {
      rejectedFlights.push({
        raw,
        reason: 'MISSING_DEPARTURE_DATE',
        details: 'Provider did not supply a trustworthy departure date',
      });
      continue;
    }

    // 2. Verify Route Match (Phase 5)
    if (origin !== reqOrigin || destination !== reqDestination) {
      rejectedFlights.push({
        raw,
        reason: 'ROUTE_MISMATCH',
        details: `Requested ${reqOrigin}->${reqDestination}, got ${origin}->${destination}`,
      });
      continue;
    }

    // 3. Verify Date Match (Phase 5)
    if (explicitDepDate !== reqDate) {
      rejectedFlights.push({
        raw,
        reason: 'DATE_MISMATCH',
        details: `Requested ${reqDate}, got ${explicitDepDate}`,
      });
      continue;
    }

    // 4. Verify Price Validity (Phase 4 & Phase 10 - No Fake Prices)
    if (price === null || price <= 0) {
      rejectedFlights.push({
        raw,
        reason: 'INVALID_PRICE',
        details: `Unparseable or non-positive price: ${raw.price}`,
      });
      continue;
    }

    // 5. Verify Flight Number (Step 9)
    if (!flightNum) {
      rejectedFlights.push({
        raw,
        reason: 'MISSING_FLIGHT_NUMBER',
        details: 'Flight number is empty',
      });
      continue;
    }

    // 6. Verify Supported Airline (Phase 12)
    if (!isSupportedAirline(airline, airlineCode)) {
      rejectedFlights.push({
        raw,
        reason: 'INVALID_AIRLINE',
        details: `Unsupported airline: ${airline} (${airlineCode})`,
      });
      continue;
    }

    // 7. Deduplication (Phase 8 & 10) — stable key WITHOUT price so legitimately
    //    different fares/flights on the same schedule are never dropped.
    const dedupKey = `${airlineCode || airline}_${flightNum}_${origin}_${destination}_${explicitDepDate}_${depTime}`.toLowerCase();
    if (seenKeys.has(dedupKey)) {
      rejectedFlights.push({
        raw,
        reason: 'DUPLICATE',
        details: `Duplicate flight key: ${dedupKey}`,
      });
      continue;
    }
    seenKeys.add(dedupKey);

    // Form standardized normalized flight object with explicit departureDate and arrivalDate (Phase 8)
    const arrTime = raw.arrivalTime || raw.arrTime || '';
    const explicitArrDate = raw.arrivalDate ? extractIsoDate(raw.arrivalDate) : (extractIsoDate(arrTime) || explicitDepDate);

    const normalizedFlight = {
      id: raw.id || `${(source || providerName).toLowerCase()}_${flightNum.replace(/\s+/g, '')}_${explicitDepDate}_${Math.random().toString(36).substring(7)}`,
      provider: providerName,
      source: source || providerName.toLowerCase(),
      airline: airline,
      airlineCode: airlineCode || 'AP',
      flightNumber: flightNum,
      origin: origin,
      destination: destination,
      departureAirport: origin,
      arrivalAirport: destination,
      departureDate: explicitDepDate, // Explicit YYYY-MM-DD
      departureTime: depTime || `${explicitDepDate} (Time unlisted)`,
      arrivalDate: explicitArrDate,   // Explicit YYYY-MM-DD
      arrivalTime: arrTime || '',
      duration: raw.duration || '',
      stops: typeof raw.stops === 'number' ? raw.stops : 0,
      cabinClass: raw.cabinClass || 'Economy',
      price: price,                            // base/displayed price (excluding taxes for VK)
      totalPrice: raw.totalPrice || null,      // full checkout total (incl. all taxes/surcharges)
      seatsAvailable: raw.seatsAvailable != null ? raw.seatsAvailable : null,
      currency: (raw.currency || 'NGN').toUpperCase(),
      aircraft: raw.aircraft || '',
      bookingUrl: raw.bookingUrl || '',
      availabilityStatus: raw.availabilityStatus || 'AVAILABLE',
      rawOfferId: raw.rawOfferId || raw.offerId || raw.itemId || null,
      metadata: raw.metadata || {},
    };

    validFlights.push(normalizedFlight);
  }

  logger.info(`[DEBUG MODE] ${providerName} SEARCH SUMMARY`, {
    rawCount: rawFlights.length,
    validCount: validFlights.length,
    rejectedCount: rejectedFlights.length,
    rejectedReasons: rejectedFlights.map((r) => r.reason),
  });

  return { validFlights, rejectedFlights };
}

export default { parseCleanPrice, extractIsoDate, validateAndNormalizeFlights };
