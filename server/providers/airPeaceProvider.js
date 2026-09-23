/**
 * providers/airPeaceProvider.js
 *
 * Direct provider for Air Peace (flyairpeace.com).
 * Exposes the standard Sharpzy provider interface.
 */

import airPeaceBot from '../bots/airPeaceBot.js';
import logger from '../utils/logger.js';

class AirPeaceProvider {
  get name() {
    return 'AirPeace';
  }

  /**
   * Search for Air Peace flights.
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
   * @returns {Promise<Array>} Normalized flight objects
   */
  async search(params) {
    const startTime = Date.now();
    logger.info(`${this.name}: initiating direct flight search`, {
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
      adults: params.adults,
    });

    const flights = await airPeaceBot.runSearch(params);

    logger.info(`${this.name}: search complete`, {
      durationMs: Date.now() - startTime,
      count: flights.length,
    });

    return flights;
  }
}

export default AirPeaceProvider;
