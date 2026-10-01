/**
 * providers/providerManager.js
 *
 * Central registry for all direct flight data providers:
 *   1. Air Peace (AirPeaceProvider)
 *   2. Ibom Air (IbomAirProvider)
 *   3. ValueJet (ValueJetProvider)
 *   4. Aero Contractors (AeroProvider)
 *   5. Enugu Air (EnuguAirProvider)
 *
 * AlternativeAirlinesProvider remains in the repository as a fallback implementation
 * but is disabled from active production search list per requirements.
 */

import AirPeaceProvider from './airPeaceProvider.js';
import IbomAirProvider from './ibomAirProvider.js';
import ValueJetProvider from './valueJetProvider.js';
import AeroProvider from './aeroProvider.js';
import EnuguAirProvider from './enuguAirProvider.js';
import logger from '../utils/logger.js';
import { recordProviderResult, STATUS } from '../services/searchMetrics.js';

// Hard per-provider ceiling so a single slow/hanging provider (e.g. the
// Chromium-based scraper) can never stall the whole aggregate search. Each
// outcome is isolated, so remaining providers still contribute results.
const PROVIDER_TIMEOUT_MS = parseInt(process.env.PROVIDER_TIMEOUT_MS || '30000', 10);

class ProviderManager {
  constructor() {
    /** @type {Map<string, object>} name → provider instance */
    this._providers = new Map();

    // Register active direct airline providers
    this.registerProvider(new AirPeaceProvider());
    this.registerProvider(new IbomAirProvider());
    this.registerProvider(new ValueJetProvider());
    this.registerProvider(new AeroProvider());
    this.registerProvider(new EnuguAirProvider());
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
   * Deregister a provider by name.
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
   * Search across all registered direct providers.
   * Returns merged normalised flights.
   *
   * @param {{
   *   origin: string,
   *   destination: string,
   *   departureDate: string,
   *   returnDate?: string,
   *   adults: number,
   *   children?: number,
   *   infants?: number
   * }} params
   *
   * @returns {Promise<Array>}
   */
  async search(params) {
    if (this._providers.size === 0) {
      const err = new Error('No flight providers are registered.');
      err.statusCode = 503;
      throw err;
    }

    let entries = [...this._providers.values()];

    // Provider targeting filter
    if (params.provider) {
      const target = entries.find((p) => p.name.toLowerCase() === params.provider.toLowerCase());
      if (target) {
        entries = [target];
      }
    } else if (params.excludeProviders && Array.isArray(params.excludeProviders)) {
      const excludeSet = new Set(params.excludeProviders.map((p) => p.toLowerCase()));
      entries = entries.filter((p) => !excludeSet.has(p.name.toLowerCase()));
    }

    logger.info('ProviderManager: dispatching search to direct providers', {
      providers: entries.map((p) => p.name),
      params,
    });

    const allFlights = [];
    let failCount = 0;

    // Execute provider searches with provider isolation (one failure does not break
    // others). Each provider is individually timed so the admin health view can show
    // a true per-provider response time rather than the shared wall-clock.
    const outcomes = await Promise.allSettled(
      entries.map(async (provider) => {
        const t0 = Date.now();
        let timer;
        try {
          const flights = await Promise.race([
            provider.search(params),
            new Promise((_, reject) => {
              timer = setTimeout(() => {
                const e = new Error(`${provider.name} did not respond within ${PROVIDER_TIMEOUT_MS}ms`);
                e.code = 'PROVIDER_TIMEOUT';
                reject(e);
              }, PROVIDER_TIMEOUT_MS);
            }),
          ]);
          return { flights: flights || [], durationMs: Date.now() - t0 };
        } catch (err) {
          if (err && typeof err === 'object') err._durationMs = Date.now() - t0;
          throw err;
        } finally {
          if (timer) clearTimeout(timer);
        }
      })
    );

    for (let i = 0; i < entries.length; i++) {
      const outcome = outcomes[i];
      const provider = entries[i];

      if (outcome.status === 'fulfilled') {
        const flights = outcome.value.flights || [];
        const durationMs = outcome.value.durationMs;
        logger.info('ProviderManager: provider returned results', {
          provider: provider.name,
          count: flights.length,
          durationMs,
        });
        recordProviderResult({
          provider: provider.name,
          status: flights.length > 0 ? STATUS.SUCCESS : STATUS.NO_RESULTS,
          count: flights.length,
          durationMs,
        });
        allFlights.push(...flights);
      } else {
        failCount++;
        const reason = outcome.reason || {};
        const isVerification =
          reason.providerStatus === STATUS.VERIFICATION_REQUIRED ||
          reason.code === 'VERIFICATION_REQUIRED';
        logger.error('ProviderManager: provider search failed', {
          provider: provider.name,
          error: reason.message,
          stack: reason.stack,
        });
        recordProviderResult({
          provider: provider.name,
          status: isVerification ? STATUS.VERIFICATION_REQUIRED : STATUS.ERROR,
          count: 0,
          durationMs: reason._durationMs || 0,
          errorType: reason.errorType || reason.code || 'ERROR',
          error: reason.message,
        });
      }
    }

    // Deduplicate identical flights across providers using a stable key that
    // intentionally EXCLUDES price (two different flights can share a price).
    const seen = new Set();
    const merged = [];
    for (const flight of allFlights) {
      const key = [
        flight.source || flight.provider,
        flight.airline,
        flight.flightNumber,
        flight.origin,
        flight.destination,
        flight.departureDate,
        flight.departureTime,
      ].join('|').toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(flight);
      }
    }

    logger.info('ProviderManager: search complete', {
      totalFlights: merged.length,
      providersFailed: failCount,
      totalProviders: entries.length,
    });

    return merged;
  }
}

export default new ProviderManager();
