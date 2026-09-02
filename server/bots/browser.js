/**
 * bots/browser.js
 * Factory that launches a Chromium browser via Playwright with
 * low-memory, performance-oriented launch arguments.
 * The browser instance is ALWAYS closed in a finally block by the caller.
 */

import { chromium } from 'playwright';
import logger from '../utils/logger.js';

const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false'; // default true

/**
 * Chromium launch arguments tuned for server-side automation:
 *  - Disables GPU, sandbox, shared memory requirements
 *  - Reduces memory footprint
 *  - Disables extensions, background timers, etc.
 */
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-update',
  '--disable-default-apps',
  '--disable-domain-reliability',
  '--disable-features=AudioServiceOutOfProcess',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-notifications',
  '--disable-offer-store-unmasked-wallet-cards',
  '--disable-popup-blocking',
  '--disable-print-preview',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--disable-translate',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-first-run',
  '--safebrowsing-disable-auto-update',
  '--password-store=basic',
  '--use-mock-keychain',
  // Reduce animation overhead
  '--animation-duration-scale=0',
  '--force-prefers-reduced-motion',
];

/**
 * Launch a new Chromium browser instance.
 * @returns {Promise<import('playwright').Browser>}
 */
async function launchBrowser() {
  logger.info('Launching Chromium browser', { headless: HEADLESS });

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: LAUNCH_ARGS,
  });

  logger.info('Chromium browser launched successfully');
  return browser;
}

/**
 * Create a new browser context with sensible defaults:
 *  - Standard desktop viewport
 *  - Real-looking user agent
 *  - Locale and timezone matching a typical traveller
 * @param {import('playwright').Browser} browser
 * @returns {Promise<import('playwright').BrowserContext>}
 */
async function createContext(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Do not save any storage so each search is clean
    storageState: undefined,
  });

  return context;
}

export { launchBrowser, createContext };
