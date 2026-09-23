/**
 * utils/airportMapper.js
 *
 * Primary IATA airport code mapping dictionary for Nigerian & international airports.
 * Maps city names, airport names, and code variations to canonical 3-letter IATA codes.
 */

const IATA_MAP = {
  // Lagos
  'LOS': 'LOS',
  'LAGOS': 'LOS',
  'MURTALA MUHAMMED': 'LOS',
  'MURTALA': 'LOS',
  
  // Abuja
  'ABV': 'ABV',
  'ABUJA': 'ABV',
  'NNAMDI AZIKIWE': 'ABV',

  // Port Harcourt
  'PHC': 'PHC',
  'PORT HARCOURT': 'PHC',
  'PORTHARCOURT': 'PHC',

  // Enugu
  'ENU': 'ENU',
  'ENUGU': 'ENU',
  'AKANU IBIAM': 'ENU',

  // Uyo
  'QUO': 'QUO',
  'UYO': 'QUO',
  'VICTOR ATTAH': 'QUO',

  // Kano
  'KAN': 'KAN',
  'KANO': 'KAN',
  'MALLAM AMINU': 'KAN',

  // Calabar
  'CBQ': 'CBQ',
  'CALABAR': 'CBQ',

  // Benin
  'BNI': 'BNI',
  'BENIN': 'BNI',
  'BENIN CITY': 'BNI',

  // Owerri
  'QOW': 'QOW',
  'OWR': 'QOW',   // legacy alias — correct code is QOW
  'OWERRI': 'QOW',
  'SAM MBAKWE': 'QOW',

  // Asaba
  'ABB': 'ABB',
  'ASABA': 'ABB',

  // Ilorin
  'ILR': 'ILR',
  'ILORIN': 'ILR',

  // Akure
  'AKR': 'AKR',
  'AKURE': 'AKR',

  // Ibadan
  'IBA': 'IBA',
  'IBADAN': 'IBA',

  // Yola
  'YOL': 'YOL',
  'YOLA': 'YOL',

  // Maiduguri
  'MIU': 'MIU',
  'MAIDUGURI': 'MIU',

  // Sokoto
  'SKO': 'SKO',
  'SOKOTO': 'SKO',
};

/**
 * Normalize an airport code, city name, or raw string to a canonical 3-letter IATA code.
 *
 * @param {string} input - Raw city name or code
 * @returns {string} 3-letter uppercase IATA code or uppercase trimmed input if unknown
 */
export function normalizeIataCode(input) {
  if (!input || typeof input !== 'string') return '';
  const clean = input.trim().toUpperCase();

  if (IATA_MAP[clean]) {
    return IATA_MAP[clean];
  }

  // Check if input contains known airport key
  for (const [key, code] of Object.entries(IATA_MAP)) {
    if (clean.includes(key)) {
      return code;
    }
  }

  return clean.slice(0, 3);
}

export default { normalizeIataCode, IATA_MAP };
