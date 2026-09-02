/**
 * airlineLogos.js
 * Centralized utility for resolving airline logos by name or IATA code.
 * Includes reliable CDN image URLs for domestic and international carriers,
 * plus a generic fallback SVG for unknown airlines.
 */

export const FALLBACK_AIRLINE_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" rx="16" fill="#1d4ed8"/>
  <path d="M74 79L67 46L81 32C83.4 29.6 83 23.6 79 20C75 16.4 69 16 66.6 18.4L52.6 32.4L20 25.2C18 24.8 16.4 25.6 15.2 27.2L12.8 30.4C11.6 32 12 34.4 13.6 35.6L35 52.4L21 66.4L12.2 64C10.6 63.6 9 64.4 8.2 65.6L6.6 67.2C5.8 68.4 6.2 70.4 7.4 71.2L17 78.4L24.2 88C25 89.2 27 89.6 28.2 88.8L29.8 87.2C31 86.4 31.8 84.8 31.4 83.2L29 74.4L43 60.4L61.8 81.6C63 83.2 65.4 83.6 67 82.4L70.2 80C71.8 78.8 72.6 77.2 74 79Z" fill="#ffffff"/>
</svg>
`)}`;

const AIRLINE_LOGO_MAP = {
  // ── Domestic Carriers ───────────────────────────────────────────────────
  P4: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/P4.svg', // Air Peace
  AP: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/P4.svg',
  'AIR PEACE': 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/P4.svg',

  QI: 'https://pics.avs.io/200/60/QI.png', // Ibom Air
  IA: 'https://pics.avs.io/200/60/QI.png',
  'IBOM AIR': 'https://pics.avs.io/200/60/QI.png',

  U5: 'https://pics.avs.io/200/60/U5.png', // United Nigeria
  UN: 'https://pics.avs.io/200/60/U5.png',
  'UNITED NIGERIA': 'https://pics.avs.io/200/60/U5.png',
  'UNITED NIGERIA AIRLINES': 'https://pics.avs.io/200/60/U5.png',

  Q9: 'https://pics.avs.io/200/60/Q9.png', // Green Africa
  GA: 'https://pics.avs.io/200/60/Q9.png',
  'GREEN AFRICA': 'https://pics.avs.io/200/60/Q9.png',
  'GREEN AFRICA AIRWAYS': 'https://pics.avs.io/200/60/Q9.png',

  OF: 'https://pics.avs.io/200/60/OF.png', // Overland Airways
  OA: 'https://pics.avs.io/200/60/OF.png',
  'OVERLAND AIRWAYS': 'https://pics.avs.io/200/60/OF.png',

  W3: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/W3.svg', // Arik Air
  'ARIK AIR': 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/W3.svg',

  VM: 'https://pics.avs.io/200/60/VM.png', // Max Air
  'MAX AIR': 'https://pics.avs.io/200/60/VM.png',

  VK: 'https://pics.avs.io/200/60/VK.png', // ValueJet
  VALUEJET: 'https://pics.avs.io/200/60/VK.png',

  N2: 'https://pics.avs.io/200/60/N2.png', // Aero Contractors
  MN: 'https://pics.avs.io/200/60/N2.png',
  AERO: 'https://pics.avs.io/200/60/N2.png',
  'AERO CONTRACTORS': 'https://pics.avs.io/200/60/N2.png',

  E3: 'https://pics.avs.io/200/60/E3.png', // Enugu Air
  EG: 'https://pics.avs.io/200/60/E3.png',
  'ENUGU AIR': 'https://pics.avs.io/200/60/E3.png',

  RN: 'https://pics.avs.io/200/60/RN.png', // Rano Air
  'RANO AIR': 'https://pics.avs.io/200/60/RN.png',

  // ── Major International Carriers ────────────────────────────────────────
  BA: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/BA.svg',
  'BRITISH AIRWAYS': 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/BA.svg',

  LH: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/LH.svg',
  LUFTHANSA: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/LH.svg',

  EK: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/EK.svg',
  EMIRATES: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/EK.svg',

  QR: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/QR.svg',
  'QATAR AIRWAYS': 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/QR.svg',

  DL: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/DL.svg',
  'DELTA AIR LINES': 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/DL.svg',

  AF: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/AF.svg',
  'AIR FRANCE': 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/AF.svg',

  TK: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/TK.svg',
  'TURKISH AIRLINES': 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/TK.svg',

  ET: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/ET.svg',
  'ETHIOPIAN AIRLINES': 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/ET.svg',

  MS: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/MS.svg',
  EGYPTAIR: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/MS.svg',

  KL: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/KL.svg',
  KLM: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/KL.svg',

  VS: 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/VS.svg',
  'VIRGIN ATLANTIC': 'https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/VS.svg',
};

/**
 * Resolves an airline logo URL based on airline name or code.
 * @param {string} name Airline name (e.g. "Air Peace")
 * @param {string} code Airline IATA/ICAO code (e.g. "P4")
 * @returns {string} Image URL or generic fallback SVG data URL
 */
export function getAirlineLogo(name, code) {
  if (code && AIRLINE_LOGO_MAP[code.toUpperCase()]) {
    return AIRLINE_LOGO_MAP[code.toUpperCase()];
  }
  if (name && AIRLINE_LOGO_MAP[name.toUpperCase()]) {
    return AIRLINE_LOGO_MAP[name.toUpperCase()];
  }
  if (code) {
    return `https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${code.toUpperCase()}.svg`;
  }
  return FALLBACK_AIRLINE_LOGO;
}

export default getAirlineLogo;
