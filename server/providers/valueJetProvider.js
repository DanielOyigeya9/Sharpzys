/**
 * providers/valueJetProvider.js
 * Provider implementation for ValueJet (www.flyvaluejet.com).
 */

import valueJetBot from '../bots/valueJetBot.js';
import logger from '../utils/logger.js';

class ValueJetProvider {
  get name() {
    return 'ValueJet';
  }

  async search(params) {
    const startTime = Date.now();
    logger.info(`${this.name}: initiating direct search`, {
      origin: params.origin,
      destination: params.destination,
      departureDate: params.departureDate,
    });

    const flights = await valueJetBot.runSearch(params);

    logger.info(`${this.name}: search complete`, {
      durationMs: Date.now() - startTime,
      count: flights.length,
    });

    return flights;
  }
}

export default ValueJetProvider;
