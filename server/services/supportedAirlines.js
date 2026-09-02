/**
 * supportedAirlines.js
 * Centralized configuration & filtering layer for the 5 supported Nigerian airlines:
 * 1. Air Peace
 * 2. Ibom Air
 * 3. Aero / Aero Contractors
 * 4. ValueJet
 * 5. Enugu Air
 */

export const SUPPORTED_AIRLINES = [
  {
    name: 'Air Peace',
    codes: ['P4', 'AP'],
    keywords: ['air peace', 'airpeace', 'p4', 'ap'],
  },
  {
    name: 'Ibom Air',
    codes: ['QI', 'IA'],
    keywords: ['ibom air', 'ibomair', 'qi', 'ia'],
  },
  {
    name: 'Aero Contractors',
    codes: ['N2', 'MN'],
    keywords: ['aero', 'aero contractors', 'aerocontractors', 'n2', 'mn'],
  },
  {
    name: 'ValueJet',
    codes: ['VK'],
    keywords: ['valuejet', 'value jet', 'vk'],
  },
  {
    name: 'Enugu Air',
    codes: ['E3', 'EG'],
    keywords: ['enugu air', 'enuguair', 'e3', 'eg'],
  },
];

/**
 * Check if an airline name or code matches one of the 5 supported airlines.
 * @param {string} airlineName 
 * @param {string} airlineCode 
 * @returns {boolean}
 */
export function isSupportedAirline(airlineName = '', airlineCode = '') {
  const nameClean = (airlineName || '').toLowerCase().trim();
  const codeClean = (airlineCode || '').toUpperCase().trim();

  return SUPPORTED_AIRLINES.some((supported) => {
    if (codeClean && supported.codes.includes(codeClean)) {
      return true;
    }
    if (nameClean && supported.keywords.some((kw) => nameClean.includes(kw))) {
      return true;
    }
    return false;
  });
}

/**
 * Filters an array of flights to keep ONLY those belonging to the 5 supported airlines.
 * @param {Array} flights List of flight objects returned from provider
 * @returns {Array} Filtered list of flights
 */
export function filterSupportedFlights(flights = []) {
  if (!Array.isArray(flights)) return [];
  return flights.filter((flight) => {
    const name = flight.airline || flight.carrierName || '';
    const code = flight.airlineCode || flight.carrierCode || flight.code || '';
    return isSupportedAirline(name, code);
  });
}

export default {
  SUPPORTED_AIRLINES,
  isSupportedAirline,
  filterSupportedFlights,
};
