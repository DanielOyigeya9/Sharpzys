/**
 * providers/enuguAirProvider.js
 * Provider implementation for Enugu Air (enuguairlines.com).
 */

import enuguAirBot from '../bots/enuguAirBot.js';
import logger from '../utils/logger.js';

class EnuguAirProvider {
  get name() {
    return 'EnuguAir';
  }

  async search(params) {
    const startTime = Date.now();
    logger.info(`${this.name}: initiating direct search`, {
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
    });

    const flights = await enuguAirBot.runSearch(params);

    logger.info(`${this.name}: search complete`, {
      durationMs: Date.now() - startTime,
      count: flights.length,
    });

    return flights;
  }
}

export default EnuguAirProvider;
