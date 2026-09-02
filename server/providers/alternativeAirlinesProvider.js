/**
 * providers/alternativeAirlinesProvider.js
 *
 * Provider implementation for AlternativeAirlines.com.
 * Uses Playwright browser automation (searchBot) to capture the JSON
 * responses that the site itself receives during a flight search.
 *
 * Implements the standard provider interface consumed by ProviderManager:
 *   search(params): Promise<NormalisedFlight[]>
 *   get name(): string
 */

import searchBot from '../bots/searchBot.js';
import parser    from '../bots/parser.js';
import logger    from '../utils/logger.js';

class AlternativeAirlinesProvider {
  get name() {
    return 'AlternativeAirlines';
  }

  /**
   * Search for flights using browser automation.
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
   * @returns {Promise<Array<{
   *   airline: string,
   *   flightNumber: string,
   *   price: number,
   *   currency: string,
   *   departureAirport: string,
   *   arrivalAirport: string,
   *   departureTime: string,
   *   arrivalTime: string,
   *   duration: string,
   *   stops: number,
   *   aircraft: string,
   *   provider: string
   * }>>}
   */
  async search(params) {
    const startTime = Date.now();
    logger.info(`${this.name}: stage duration`, { stage: 'Receive Provider Request', durationMs: 0 });

    logger.info(`${this.name}: initiating search`, {
      origin:        params.origin,
      destination:   params.destination,
      departureDate: params.departureDate,
      adults:        params.adults,
    });

    // Run the browser automation — always inside try/finally in searchBot.
    const rawPayloads = await searchBot.runSearch(params);

    const responseTime = Date.now() - startTime;
    logger.info(`${this.name}: browser search completed`, {
      responseTimeMs: responseTime,
      rawPayloads:    rawPayloads.length,
    });

    if (!rawPayloads || rawPayloads.length === 0) {
      logger.warn(`${this.name}: no raw payloads returned from browser`);
      return [];
    }

    // Parse raw captured JSON into the normalised FlyNow schema.
    const parseStartedAt = Date.now();
    const flights = parser.parse(rawPayloads);
    logger.info(`${this.name}: JSON Parsed`, { durationMs: Date.now() - parseStartedAt, count: flights.length });

    logger.info(`${this.name}: parsed flights`, { count: flights.length });

    logger.info(`${this.name}: stage duration`, { stage: 'Return Response', durationMs: Date.now() - startTime });
    return flights;
  }
}

export default AlternativeAirlinesProvider;
