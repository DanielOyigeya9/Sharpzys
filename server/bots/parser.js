/**
 * bots/parser.js
 *
 * Converts the raw JSON payloads captured from AlternativeAirlines network
 * responses into the normalised FlyNow flight schema.
 *
 * The raw response structures from AlternativeAirlines can arrive in several
 * shapes depending on the endpoint that responded (search results, offers,
 * pricing). This parser handles the known patterns defensively.
 */

import logger from '../utils/logger.js';

const PROVIDER_NAME = 'AlternativeAirlines';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely read a nested value by dot-path */
function dig(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
}

/** Convert minutes (number) to "Xh Ym" string. */
function minutesToDuration(minutes) {
  if (!minutes && minutes !== 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

/** Extract IATA code from various shapes. */
function extractIata(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.trim().toUpperCase();
  return (value.iata || value.code || '').trim().toUpperCase();
}

/** Extract ISO datetime string and strip trailing .000000 to prevent JS from shifting timezones */
function extractDatetime(value) {
  if (!value) return '';
  let dt = typeof value === 'string' ? value : (value.date || value.datetime || value.time || value.timestamp || '');
  return dt.replace(/\.0+$/, '').trim();
}

/** Map class codes to readable strings (M/Y = Economy, etc) */
function mapCabinClass(code) {
  const c = String(code || '').toUpperCase();
  if (['F', 'P', 'A'].includes(c)) return 'First';
  if (['J', 'C', 'D', 'I', 'Z'].includes(c)) return 'Business';
  if (['W', 'E', 'T'].includes(c)) return 'Premium Economy';
  if (c) return 'Economy';
  return 'Economy';
}

/**
 * Airline name + code corrections.
 * The AlternativeAirlines provider (Altair) sometimes uses its own internal
 * airline names that differ from the real operating carrier's brand name.
 * This map corrects those discrepancies so the customer-facing display is accurate.
 */
const AIRLINE_NAME_CORRECTIONS = {
  // Provider "Transaero Airlines" / code "UN" is actually United Nigeria Airlines
  'TRANSAERO AIRLINES': { name: 'United Nigeria Airlines', code: 'UN' },
  // Ensure Air Peace keeps its correct code
  'AIR PEACE': { name: 'Air Peace', code: 'P4' },
  // Ibom Air
  'IBOM AIR': { name: 'Ibom Air', code: 'QI' },
  // Green Africa
  'GREEN AFRICA': { name: 'Green Africa Airways', code: 'Q9' },
  'GREEN AFRICA AIRWAYS': { name: 'Green Africa Airways', code: 'Q9' },
  // Overland Airways
  'OVERLAND AIRWAYS': { name: 'Overland Airways', code: 'OF' },
  // Max Air
  'MAX AIR': { name: 'Max Air', code: 'VM' },
  // ValueJet
  'VALUEJET': { name: 'ValueJet', code: 'VK' },
};

/**
 * Correct airline name and code using provider-to-real-world mapping.
 * @param {string} name  Airline name from provider
 * @param {string} code  Airline IATA code from provider
 * @returns {{ name: string, code: string }}
 */
function normaliseAirline(name, code) {
  const key = (name || '').trim().toUpperCase();
  if (AIRLINE_NAME_CORRECTIONS[key]) {
    return AIRLINE_NAME_CORRECTIONS[key];
  }
  return { name: (name || '').trim(), code: (code || '').trim().toUpperCase() };
}

// ─── Individual record normalizers ───────────────────────────────────────────

/**
 * Normalise a single "priceGroup" object from Altair API.
 * A priceGroup contains multiple completely DIFFERENT flight options (segments) that share the same price.
 * This returns an array of normalised flights.
 */
function normalisePriceGroup(pg) {
  try {
    if (!pg || typeof pg !== 'object') return [];

    // 1. Price & Currency (Total for the requested passengers)
    const rawPrice =
      pg.fare?.total ??
      pg.fare?.fareTotalBeforeRoundUp ??
      pg.fareUnformattedTotalIntText ??
      (pg.fareTotalNoDecimal ? pg.fareTotalNoDecimal / 100 : null);

    const price = parseFloat(rawPrice);
    if (isNaN(price) || price <= 0) return [];

    const currency = (pg.fare?.currencyCode || 'NGN').toUpperCase();

    // 2. Flight Options (Segments)
    // groupSegments[0] represents the outbound journey options.
    const groupSegments = pg.groupSegments || [];
    let flightOptions = [];
    if (groupSegments.length > 0) {
      // Loop through outbound options. If there are return options, they'd be in groupSegments[1],
      // but AlternativeAirlines direct URLs currently only request one-way flights.
      flightOptions = groupSegments[0].segments || [];
    } else if (Array.isArray(pg.segments)) {
      flightOptions = pg.segments;
    }

    if (!flightOptions.length) return [];

    const flights = [];

    for (const option of flightOptions) {
      const legs = option.legs || [];
      if (!legs.length) continue;

      const firstLeg = legs[0];
      const lastLeg  = legs[legs.length - 1];

      // Airline Details — apply real-world name corrections
      const rawAirlineName = (
        firstLeg.displayAirlineName ||
        option.displayAirlineName ||
        option.operatingAirlineName ||
        firstLeg.operatingAirlineName ||
        firstLeg.marketingAirlineName ||
        'Airline'
      ).trim();

      const rawAirlineCode = (
        firstLeg.displayAirlineCode ||
        option.displayAirlineCode ||
        option.operatingAirlineCode ||
        firstLeg.operatingAirlineCode ||
        firstLeg.marketingAirlineCode ||
        ''
      ).trim().toUpperCase();

      const { name: airline, code: airlineCode } = normaliseAirline(rawAirlineName, rawAirlineCode);

      // Flight Number — use corrected code
      const rawFn = String(firstLeg.flightNumber || '').trim();
      const flightNumber = rawFn ? `${airlineCode} ${rawFn}`.trim() : '';

      // Origin & Destination
      const departureAirport = extractIata(firstLeg.departureAirportCode || option.departureAirportCode);
      const arrivalAirport = extractIata(lastLeg.arrivalAirportCode || option.arrivalAirportCode);

      if (!departureAirport || !arrivalAirport) continue;

      // Departure & Arrival Times — prefer the human-readable timeText to avoid
      // any risk of JS timezone coercion when parsing the UTC datetime string.
      // The provider gives matching local-time values in both the datetime object
      // AND in departureTimeText / arrivalTimeText, so we prefer the text form.
      const departureDateStr = option.departureDateText || '';
      const arrivalDateStr   = option.arrivalDateText   || departureDateStr;

      const departureTimeStr = firstLeg.departureTimeText || option.departureTime || '';
      const arrivalTimeStr   = lastLeg.arrivalTimeText   || option.arrivalTime   || '';

      const departureTime = departureDateStr
        ? `${departureDateStr} ${departureTimeStr}`.trim()
        : departureTimeStr;
      const arrivalTime = arrivalDateStr
        ? `${arrivalDateStr} ${arrivalTimeStr}`.trim()
        : arrivalTimeStr;

      // Duration
      let duration = option.eft || firstLeg.duration || '';
      if (!duration && pg.lowestEft) {
        duration = minutesToDuration(pg.lowestEft);
      }

      // Stops
      const stops = typeof option.stops === 'number'
        ? option.stops
        : Math.max(0, legs.length - 1);

      // Aircraft
      const aircraft = String(firstLeg.aircraft || firstLeg.aircraftCode || '').trim();

      // Cabin Class
      const cabinClass = mapCabinClass(firstLeg.class || option.class);

      // ID
      const itineraryId = option.itineraryId || Math.random().toString(36).substring(7);
      const id = pg.resultId ? `${pg.resultId}_${itineraryId}` : `aa_${airlineCode}_${rawFn}_${itineraryId}`;

      flights.push({
        id,
        airline,
        airlineCode,
        flightNumber,
        origin: departureAirport,
        destination: arrivalAirport,
        departureAirport,
        arrivalAirport,
        departureTime,
        arrivalTime,
        duration,
        stops,
        price,
        currency,
        aircraft,
        cabinClass,
        provider: PROVIDER_NAME,
      });
    }

    return flights;
  } catch (err) {
    logger.warn('parser: failed to normalise Altair priceGroup', { error: err.message });
    return [];
  }
}

/**
 * Normalise a single "itinerary" / "offer" object that typically returns in flat format.
 * Returns an array of flights (usually 1).
 */
function normaliseItinerary(raw) {
  if (raw && (raw.groupSegments || (raw.fare && typeof raw.fare === 'object'))) {
    return normalisePriceGroup(raw);
  }

  try {
    const price = parseFloat(raw.price ?? raw.total_price ?? raw.totalPrice ?? raw.amount ?? '');
    if (isNaN(price)) return [];

    const currency = (raw.currency || raw.currency_code || raw.currencyCode || '').toUpperCase();

    const legs = raw.legs || raw.segments || raw.flights || [];
    if (!legs.length) return [];

    const firstLeg = legs[0];
    const lastLeg  = legs[legs.length - 1];

    const airline = (
      dig(firstLeg, 'airline.name') ||
      dig(firstLeg, 'carrier.name') ||
      dig(firstLeg, 'airlineName') ||
      firstLeg.airline ||
      ''
    );
    if (!airline) return [];

    const airlineCode = (
      firstLeg.airlineCode ||
      firstLeg.carrierCode ||
      firstLeg.carrier ||
      ''
    ).trim().toUpperCase();

    const rawFn = (firstLeg.flightNumber || firstLeg.flight_number || firstLeg.number || '').toString().trim();
    const flightNumber = rawFn ? `${airlineCode} ${rawFn}`.trim() : '';

    const departureAirport = extractIata(firstLeg.departure?.airport || firstLeg.departure?.iata || firstLeg.origin || firstLeg.from);
    const arrivalAirport = extractIata(lastLeg.arrival?.airport || lastLeg.arrival?.iata || lastLeg.destination || lastLeg.to);
    if (!departureAirport || !arrivalAirport) return [];

    const departureTime = extractDatetime(firstLeg.departure?.time || firstLeg.departure?.datetime || firstLeg.departureTime || firstLeg.departs_at);
    const arrivalTime = extractDatetime(lastLeg.arrival?.time || lastLeg.arrival?.datetime || lastLeg.arrivalTime || lastLeg.arrives_at);

    let durationMinutes = raw.total_duration ?? raw.totalDuration ?? raw.duration ?? legs.reduce((sum, leg) => sum + (leg.duration || 0), 0);
    const duration = minutesToDuration(durationMinutes);

    const stops = raw.stops ?? raw.stop_count ?? firstLeg.stops ?? Math.max(0, legs.length - 1);

    const aircraft = (firstLeg.aircraft?.name || firstLeg.aircraft?.type || firstLeg.aircraft || firstLeg.aircraftType || '').toString();
    const cabinClass = mapCabinClass(firstLeg.class || firstLeg.cabin || raw.cabin);

    const id = raw.id ? `flat_${raw.id}` : `flat_${airline}_${rawFn}_${departureAirport}_${arrivalAirport}`;

    return [{
      id,
      airline,
      airlineCode,
      flightNumber,
      price,
      currency,
      origin: departureAirport,
      destination: arrivalAirport,
      departureAirport,
      arrivalAirport,
      departureTime,
      arrivalTime,
      duration,
      stops,
      aircraft,
      cabinClass,
      provider: PROVIDER_NAME,
    }];
  } catch (err) {
    logger.warn('parser: failed to normalise itinerary', { error: err.message });
    return [];
  }
}

// ─── Top-level payload unwrapping ────────────────────────────────────────────

function unwrapItineraries(payload) {
  if (!payload) return [];
  if (payload.payload) return unwrapItineraries(payload.payload);
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.priceGroups)) return payload.data.priceGroups;
  if (Array.isArray(payload?.priceGroups))       return payload.priceGroups;
  if (Array.isArray(payload?.results))           return payload.results;
  if (Array.isArray(payload?.flights))           return payload.flights;
  if (Array.isArray(payload?.offers))            return payload.offers;
  if (Array.isArray(payload?.itineraries))       return payload.itineraries;
  if (Array.isArray(payload?.data))              return payload.data;
  if (Array.isArray(payload?.data?.itineraries)) return payload.data.itineraries;
  if (Array.isArray(payload?.data?.flights))     return payload.data.flights;
  if (Array.isArray(payload?.data?.results))     return payload.data.results;
  return [];
}

function isRecognisedResultPayload(payload) {
  if (!payload) return false;
  if (payload.payload) return isRecognisedResultPayload(payload.payload);
  return [
    payload,
    payload?.results,
    payload?.flights,
    payload?.offers,
    payload?.itineraries,
    payload?.data,
    payload?.priceGroups,
    payload?.data?.priceGroups,
    payload?.data?.itineraries,
    payload?.data?.flights,
    payload?.data?.results,
  ].some(Array.isArray);
}

// ─── Public API ──────────────────────────────────────────────────────────────

function parse(rawPayloads) {
  if (!Array.isArray(rawPayloads) || rawPayloads.length === 0) {
    logger.warn('parser: received empty rawPayloads array');
    return [];
  }

  const seen    = new Set();
  const results = [];
  let resultPayloads = 0;
  let payloadsContainingFlights = 0;

  for (const payload of rawPayloads) {
    const itineraries = unwrapItineraries(payload);

    if (!isRecognisedResultPayload(payload)) {
      continue;
    }

    resultPayloads++;
    if (itineraries.length === 0) continue;

    let normalisedFromPayload = 0;

    for (const raw of itineraries) {
      const parsedFlights = normaliseItinerary(raw) || [];
      for (const flight of parsedFlights) {
        // Deduplicate by airline + flightNumber + departureTime + price + origin + destination
        const dedupKey = `${flight.airline}|${flight.flightNumber}|${flight.departureTime}|${flight.price}|${flight.origin}|${flight.destination}`;
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);

        results.push(flight);
        normalisedFromPayload++;
      }
    }

    if (normalisedFromPayload > 0) payloadsContainingFlights++;
  }

  logger.info('parser: normalisation complete', {
    inputPayloads: rawPayloads.length,
    resultPayloads,
    payloadsContainingFlights,
    normalizedFlights: results.length,
  });

  return results;
}

export default { parse };

