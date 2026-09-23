/**
 * bots/browser.js
 * Stealth browser factory for Playwright Chromium.
 * Includes anti-bot detection bypass flags and Cloudflare challenge context.
 */

import { chromium } from 'playwright';
import logger from '../utils/logger.js';

const HEADLESS = process.env.PLAYWRIGHT_HEADLESS !== 'false'; // default true

const LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-web-security',
  '--allow-running-insecure-content',
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
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-notifications',
  '--disable-popup-blocking',
  '--disable-print-preview',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--disable-translate',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-first-run',
  '--password-store=basic',
  '--use-mock-keychain',
  '--window-size=1920,1080',
];

/**
 * Launch a new stealth Chromium browser instance.
 * @returns {Promise<import('playwright').Browser>}
 */
async function launchBrowser() {
  logger.info('Launching Stealth Chromium browser', { headless: HEADLESS });

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: LAUNCH_ARGS,
  });

  logger.info('Stealth Chromium browser launched successfully');
  return browser;
}

/**
 * Create a new stealth browser context:
 *  - Masks navigator.webdriver
 *  - Sets realistic user agent and headers
 *  - Sets Lagos/West Africa timezone
 *
 * @param {import('playwright').Browser} browser
 * @returns {Promise<import('playwright').BrowserContext>}
 */
async function createContext(browser) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Africa/Lagos',
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Ch-Ua': '"Not-A.Brand";v="99", "Chromium";v="124", "Google Chrome";v="124"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
    },
  });

  // Inject init script to mask automation properties
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    window.chrome = { runtime: {} };
  });

  return context;
}

export { launchBrowser, createContext };
