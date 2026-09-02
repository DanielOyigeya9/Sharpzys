/**
 * services/cacheService.js
 * Wraps NodeCache with a typed interface and structured logging.
 * Cache key includes origin, destination, departureDate and adults
 * so each unique search has its own slot.
 * TTL defaults to 600 s (10 minutes) but is overridable via .env.
 */

import NodeCache from 'node-cache';
import logger from '../utils/logger.js';

const TTL = parseInt(process.env.CACHE_TTL_SECONDS || '600', 10);

// useClones: false — avoid deep-cloning on every get/set for performance.
const cache = new NodeCache({ stdTTL: TTL, useClones: false });

/**
 * Build a deterministic, lowercase cache key from search params.
 * @param {string} origin
 * @param {string} destination
 * @param {string} departureDate   YYYY-MM-DD
 * @param {number} adults
 * @returns {string}
 */
function buildKey(origin, destination, departureDate, adults, returnDate = '') {
  return [
    origin.trim().toUpperCase(),
    destination.trim().toUpperCase(),
    departureDate.trim(),
    returnDate.trim(),
    String(adults),
  ].join('::');
}

/**
 * Retrieve a cached result.
 * @param {string} origin
 * @param {string} destination
 * @param {string} departureDate
 * @param {number} adults
 * @returns {Array|undefined}
 */
function get(origin, destination, departureDate, adults, returnDate = '') {
  const key = buildKey(origin, destination, departureDate, adults, returnDate);
  const value = cache.get(key);
  if (value !== undefined) {
    logger.info('Cache hit', { key });
  } else {
    logger.info('Cache miss', { key });
  }
  return value;
}

/**
 * Store search results in cache.
 * @param {string} origin
 * @param {string} destination
 * @param {string} departureDate
 * @param {number} adults
 * @param {Array}  results
 */
function set(origin, destination, departureDate, adults, results, returnDate = '') {
  const key = buildKey(origin, destination, departureDate, adults, returnDate);
  cache.set(key, results);
  logger.debug('Cache set', { key, ttl: TTL, count: results.length });
}

/**
 * Manually invalidate a cache entry.
 */
function del(origin, destination, departureDate, adults, returnDate = '') {
  const key = buildKey(origin, destination, departureDate, adults, returnDate);
  cache.del(key);
  logger.debug('Cache invalidated', { key });
}

/** Return basic cache statistics (useful for /health). */
function stats() {
  return cache.getStats();
}

export default { get, set, del, stats, buildKey };
