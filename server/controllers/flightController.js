/**
 * controllers/flightController.js
 *
 * Handles POST /api/flights/search.
 */

import cacheService from '../services/cacheService.js';
import queueService from '../services/queueService.js';
import providerManager from '../providers/providerManager.js';
import logger from '../utils/logger.js';

const IATA_REGEX = /^[A-Za-z]{3}$/;

/** Date: YYYY-MM-DD */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// Use a longer configurable window while verifying the live scraping bot.
const SEARCH_TIMEOUT_MS = parseInt(process.env.FLIGHT_SEARCH_TIMEOUT_MS || '180000', 10);

function gatewayTimeout() {
  const err = new Error(`Flight provider did not complete within ${SEARCH_TIMEOUT_MS}ms.`);
  err.name = 'TimeoutError';
  err.code = 'TIMEOUT_ERROR';
  err.statusCode = 504;
  return err;
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(gatewayTimeout()), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Validate the flight search request body.
 * @param {{origin, destination, departureDate, adults, returnDate, children, infants}} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validate(body) {
  const errors = [];

  const { origin, destination, departureDate, adults, returnDate, children = 0, infants = 0 } = body;

  // Origin
  if (!origin || typeof origin !== 'string' || !IATA_REGEX.test(origin.trim())) {
    errors.push('origin must be a valid 3-letter IATA airport code (e.g. "LOS").');
  }

  // Destination
  if (!destination || typeof destination !== 'string' || !IATA_REGEX.test(destination.trim())) {
    errors.push('destination must be a valid 3-letter IATA airport code (e.g. "ABV").');
  }

  // Origin !== destination
  if (
    origin && destination &&
    origin.trim().toUpperCase() === destination.trim().toUpperCase()
  ) {
    errors.push('origin and destination must be different airports.');
  }

  // Departure date
  if (!departureDate || !DATE_REGEX.test(departureDate.trim())) {
    errors.push('departureDate must be a valid date in YYYY-MM-DD format.');
  } else {
    const depDate = new Date(departureDate.trim());
    const today   = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(depDate.getTime())) {
      errors.push('departureDate is not a valid calendar date.');
    } else if (depDate < today) {
      errors.push('departureDate must not be in the past.');
    }
  }

  // Return date (optional — only validate if supplied and non-empty)
  if (returnDate && returnDate.trim()) {
    if (!DATE_REGEX.test(returnDate.trim())) {
      errors.push('returnDate must be a valid date in YYYY-MM-DD format.');
    } else {
      const retDate = new Date(returnDate.trim());
      const depDate = new Date(departureDate?.trim() || '');
      if (isNaN(retDate.getTime())) {
        errors.push('returnDate is not a valid calendar date.');
      } else if (!isNaN(depDate.getTime()) && retDate <= depDate) {
        errors.push('returnDate must be after departureDate.');
      }
    }
  }

  // Adults
  const adultsNum = Number(adults);
  if (!Number.isInteger(adultsNum) || adultsNum < 1 || adultsNum > 9) {
    errors.push('adults must be an integer between 1 and 9.');
  }

  // Children
  const childrenNum = Number(children);
  if (!Number.isInteger(childrenNum) || childrenNum < 0 || childrenNum > 9) {
    errors.push('children must be an integer between 0 and 9.');
  }

  // Infants
  const infantsNum = Number(infants);
  if (!Number.isInteger(infantsNum) || infantsNum < 0 || infantsNum > 9) {
    errors.push('infants must be an integer between 0 and 9.');
  }

  // Infants cannot exceed adults
  if (infantsNum > adultsNum) {
    errors.push('infants cannot exceed the number of adults.');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * POST /api/flights/search
 */
async function searchFlights(req, res, next) {
  const requestStartedAt = Date.now();
  const logStage = (stage, startedAt) => logger.info('flightController: stage duration', {
    stage, durationMs: Date.now() - startedAt, totalMs: Date.now() - requestStartedAt,
  });
  try {
    logStage('Request Received', requestStartedAt);
    const {
      origin,
      destination,
      departureDate,
      returnDate = '',
      adults,
      children = 0,
      infants = 0,
    } = req.body;

    // ── 1. Validate ───────────────────────────────────────────────────────────
    const { valid, errors } = validate({ origin, destination, departureDate, returnDate, adults, children, infants });
    logger.info('flightController: Validation Complete', { valid, errorCount: errors.length });

    if (!valid) {
      logger.warn('flightController: validation failed', { errors, body: req.body });
      const err = new Error(errors.join(' '));
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      return next(err);
    }

    const normOrigin      = origin.trim().toUpperCase();
    const normDestination = destination.trim().toUpperCase();
    const normDepDate     = departureDate.trim();
    const normAdults      = Number(adults);
    const normChildren    = Number(children);
    const normInfants     = Number(infants);
    const normRetDate     = returnDate?.trim() || '';

    // ── 2. Cache check ────────────────────────────────────────────────────────
    const cacheStartedAt = Date.now();
    const cached = cacheService.get(normOrigin, normDestination, normDepDate, normAdults, normRetDate);
    logStage('Cache Checked', cacheStartedAt);

    if (cached !== undefined) {
      logger.info('flightController: returning cached results', {
        origin: normOrigin,
        destination: normDestination,
        count: cached.length,
      });

      logStage('Return Response', requestStartedAt);
      return res.status(200).json({
        success:  true,
        source:   'cache',
        count:    cached.length,
        flights:  cached,
      });
    }

    // ── 3. Enqueue browser search ─────────────────────────────────────────────
    logger.info('flightController: no cache, enqueueing browser search', {
      queueSize:    queueService.size(),
      queuePending: queueService.pending(),
    });

    const searchParams = {
      origin:        normOrigin,
      destination:   normDestination,
      departureDate: normDepDate,
      returnDate:    normRetDate,
      adults:        normAdults,
      children:      normChildren,
      infants:       normInfants,
    };

    const queueStartedAt = Date.now();
    logger.info('flightController: Queue Entered', { queueSize: queueService.size(), queuePending: queueService.pending() });
    const rawFlights = await withTimeout(queueService.enqueue(() => {
      logStage('Queue Wait', queueStartedAt);
      return providerManager.search(searchParams);
    }), Math.max(1, SEARCH_TIMEOUT_MS - (Date.now() - requestStartedAt)));
    logStage('Provider Search', queueStartedAt);

    const flights = rawFlights || [];

    // ── 4. Validate result ────────────────────────────────────────────────────
    if (!flights || flights.length === 0) {
      logger.warn('flightController: provider returned no flights', searchParams);
      // Return a 200-style response with empty flights array
      logStage('Return Response', requestStartedAt);
      return res.status(200).json({
        success: true,
        source:  'live',
        count:   0,
        flights: [],
        message: 'No flights are currently available for this route and date.',
      });
    }

    // ── 5. Cache and respond ──────────────────────────────────────────────────
    const cacheWriteStartedAt = Date.now();
    cacheService.set(normOrigin, normDestination, normDepDate, normAdults, flights, normRetDate);
    logStage('Cache Write', cacheWriteStartedAt);
    logger.info('flightController: returning live results', {
      count: flights.length,
    });

    logStage('Return Response', requestStartedAt);
    return res.status(200).json({
      success: true,
      source:  'live',
      count:   flights.length,
      flights,
    });

  } catch (err) {
    // Playwright TimeoutError
    if (err.name === 'TimeoutError' || /timeout/i.test(err.message)) {
      err.statusCode = 504;
    }
    next(err);
  }
}

export default { searchFlights };

