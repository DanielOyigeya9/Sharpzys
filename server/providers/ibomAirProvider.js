/**
 * providers/ibomAirProvider.js
 * Provider implementation for Ibom Air (www.ibomair.com).
 */

import ibomAirBot from '../bots/ibomAirBot.js';
import logger from '../utils/logger.js';

class IbomAirProvider {
  get name() {
    return 'IbomAir';
  }

  async search(params) {
    const startTime = Date.now();
    logger.info(`${this.name}: initiating direct search`, {
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
    });

    const flights = await ibomAirBot.runSearch(params);

    logger.info(`${this.name}: search complete`, {
      durationMs: Date.now() - startTime,
      count: flights.length,
    });

    return flights;
  }
}

export default IbomAirProvider;
