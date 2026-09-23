/**
 * providers/aeroProvider.js
 * Provider implementation for Aero Contractors (flyaero.com).
 */

import aeroBot from '../bots/aeroBot.js';
import logger from '../utils/logger.js';

class AeroProvider {
  get name() {
    return 'Aero';
  }

  async search(params) {
    const startTime = Date.now();
    logger.info(`${this.name}: initiating direct search`, {
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
    });

    const flights = await aeroBot.runSearch(params);

    logger.info(`${this.name}: search complete`, {
      durationMs: Date.now() - startTime,
      count: flights.length,
    });

    return flights;
  }
}

export default AeroProvider;
