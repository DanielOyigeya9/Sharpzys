/**
 * providers/providerManager.js
 *
 * Central registry for all flight data providers.
 * Adding a new provider (OAG, Amadeus, Duffel, etc.) requires only:
 *   1. Implement a class with search(params) and a name getter.
 *   2. Register it here via registerProvider().
 *   3. Zero frontend or controller changes needed.
 *
 * Search strategy:
 *   - All enabled providers are queried in parallel.
 *   - Results are merged and deduplicated.
 *   - If ALL providers fail, an error is thrown so the controller
 *     can return a 503 to the client.
 *   - If SOME providers fail, partial results are returned and failures
 *     are logged — the frontend still gets data.
 */

import AlternativeAirlinesProvider from './alternativeAirlinesProvider.js';
import logger from '../utils/logger.js';

class ProviderManager {
  constructor() {
    /** @type {Map<string, object>} name → provider instance */
    this._providers = new Map();

    // Register default providers
    this.registerProvider(new AlternativeAirlinesProvider());

    // Future providers can be registered here:
    // this.registerProvider(new OAGProvider());
    // this.registerProvider(new AmadeusProvider());
    // this.registerProvider(new DuffelProvider());
  }

  /**
   * Register a provider instance.
   * Each provider must expose:
   *   - get name(): string
   *   - async search(params): Promise<NormalisedFlight[]>
   *
   * @param {object} provider
   */
  registerProvider(provider) {
    if (typeof provider.name !== 'string' || !provider.name.trim()) {
      throw new Error('Provider must expose a non-empty string name getter.');
    }
    if (typeof provider.search !== 'function') {
      throw new Error(`Provider "${provider.name}" must implement a search() method.`);
    }
    this._providers.set(provider.name, provider);
    logger.info('ProviderManager: registered provider', { provider: provider.name });
  }

  /**
   * Deregister a provider by name (useful for testing or dynamic toggling).
   * @param {string} name
   */
  deregisterProvider(name) {
    this._providers.delete(name);
    logger.info('ProviderManager: deregistered provider', { provider: name });
  }

  /** @returns {string[]} List of registered provider names. */
  get providerNames() {
    return [...this._providers.keys()];
  }

  /**
   * Search across all registered providers in parallel.
   * Returns the merged, deduplicated list of normalised flights.
   *
   * @param {{
   *   origin: string,
   *   destination: string,
   *   departureDate: string,
   *   returnDate?: string,
   *   adults: number
   * }} params
   *
   * @returns {Promise<Array>}
   * @throws {Error} with code 503 if all providers fail.
   */
  async search(params) {
    if (this._providers.size === 0) {
      const err = new Error('No flight providers are registered.');
      err.statusCode = 503;
      throw err;
    }

    logger.info('ProviderManager: dispatching search to providers', {
      providers: this.providerNames,
      params,
    });

    const entries = [...this._providers.values()];

    // Run all providers in parallel; capture results and errors separately.
    const outcomes = await Promise.allSettled(
      entries.map((provider) => provider.search(params))
    );

    const allFlights = [];
    let failCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const outcome  = outcomes[i];
      const provider = entries[i];

      if (outcome.status === 'fulfilled') {
        const flights = outcome.value;
        logger.info('ProviderManager: provider returned results', {
          provider: provider.name,
          count: flights.length,
        });
        allFlights.push(...flights);
      } else {
        failCount++;
        logger.error('ProviderManager: provider search failed', {
          provider: provider.name,
          error: outcome.reason?.message,
          stack: outcome.reason?.stack,
          code: outcome.reason?.code,
          statusCode: outcome.reason?.statusCode,
        });
      }
    }

    // All providers failed → 503
    if (failCount === entries.length) {
      const failedIndex = outcomes.findIndex((outcome) => outcome.status === 'rejected');
      const failure = failedIndex >= 0 ? outcomes[failedIndex].reason : null;
      const botName = failedIndex >= 0 ? entries[failedIndex].name : 'Flight search';
      const err = new Error(`${botName} bot failed: ${failure?.message || 'unknown scraping error'}`);
      err.code = failure?.code || 'BOT_SCRAPE_FAILED';
      err.statusCode = failure?.statusCode || 502;
      throw err;
    }

    // Deduplicate across providers (same airline + flightNumber + departureTime)
    const seen   = new Set();
    const merged = [];
    for (const flight of allFlights) {
      const key = `${flight.airline}|${flight.flightNumber}|${flight.departureTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(flight);
      }
    }

    logger.info('ProviderManager: search complete', {
      totalFlights: merged.length,
      providersFailed: failCount,
    });

    return merged;
  }
}

// Export a singleton — the same manager is shared across all requests.
export default new ProviderManager();
