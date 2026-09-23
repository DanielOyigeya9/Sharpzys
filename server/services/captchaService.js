/**
 * services/captchaService.js
 *
 * Automated Cloudflare Turnstile and CAPTCHA solving service.
 * Supports 2Captcha, CapSolver, and custom solver protocol.
 */

import axios from 'axios';
import logger from '../utils/logger.js';

const API_KEY = process.env.CAPTCHA_SOLVER_KEY || '';
const SOLVER_PROVIDER = (process.env.CAPTCHA_SOLVER_PROVIDER || '2captcha').toLowerCase();
const SOLVER_ENDPOINT = process.env.CAPTCHA_SOLVER_ENDPOINT || 'https://2captcha.com';

/**
 * Solve a Cloudflare Turnstile challenge.
 *
 * @param {string} sitekey - Turnstile sitekey found on page
 * @param {string} pageUrl - Target URL (e.g. https://book-airpeace.crane.aero/ibe/availability)
 * @returns {Promise<string|null>} Solved token string or null if solver unavailable
 */
export async function solveTurnstile(sitekey, pageUrl) {
  if (!API_KEY && !process.env.CAPTCHA_SOLVER_ENDPOINT) {
    logger.warn('CaptchaService: CAPTCHA_SOLVER_KEY not set. Automated solver skipped.');
    return null;
  }

  const startedAt = Date.now();
  logger.info('CaptchaService: requesting Turnstile solve', { sitekey, pageUrl, provider: SOLVER_PROVIDER });

  try {
    if (SOLVER_PROVIDER === 'capsolver') {
      return await solveViaCapSolver(sitekey, pageUrl);
    } else {
      return await solveVia2Captcha(sitekey, pageUrl);
    }
  } catch (err) {
    logger.error('CaptchaService: solver error', { error: err.message });
    return null;
  } finally {
    logger.info('CaptchaService: solve attempt duration', { durationMs: Date.now() - startedAt });
  }
}

/**
 * Solve Turnstile via 2Captcha API.
 */
async function solveVia2Captcha(sitekey, pageUrl) {
  // 1. Submit task
  const submitRes = await axios.post(`${SOLVER_ENDPOINT}/in.php`, null, {
    params: {
      key: API_KEY,
      method: 'turnstile',
      sitekey: sitekey,
      pageurl: pageUrl,
      json: 1,
    },
    timeout: 10000,
  });

  if (submitRes.data?.status !== 1) {
    throw new Error(`2Captcha task submission failed: ${submitRes.data?.request || 'unknown error'}`);
  }

  const taskId = submitRes.data.request;
  logger.info('CaptchaService: 2Captcha task submitted', { taskId });

  // 2. Poll result
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await axios.get(`${SOLVER_ENDPOINT}/res.php`, {
      params: {
        key: API_KEY,
        action: 'get',
        id: taskId,
        json: 1,
      },
      timeout: 10000,
    });

    if (pollRes.data?.status === 1) {
      logger.info('CaptchaService: Turnstile token solved successfully via 2Captcha');
      return pollRes.data.request;
    }

    if (pollRes.data?.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`2Captcha solving error: ${pollRes.data?.request}`);
    }
  }

  throw new Error('2Captcha solving timed out after 60 seconds.');
}

/**
 * Solve Turnstile via CapSolver API.
 */
async function solveViaCapSolver(sitekey, pageUrl) {
  const submitRes = await axios.post('https://api.capsolver.com/createTask', {
    clientKey: API_KEY,
    task: {
      type: 'AntiTurnstileTaskProxyLess',
      websiteURL: pageUrl,
      websiteKey: sitekey,
    },
  }, { timeout: 10000 });

  if (submitRes.data?.errorId !== 0) {
    throw new Error(`CapSolver task creation failed: ${submitRes.data?.errorDescription || 'unknown'}`);
  }

  const taskId = submitRes.data.taskId;
  logger.info('CaptchaService: CapSolver task submitted', { taskId });

  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await axios.post('https://api.capsolver.com/getTaskResult', {
      clientKey: API_KEY,
      taskId: taskId,
    }, { timeout: 10000 });

    if (pollRes.data?.status === 'ready') {
      logger.info('CaptchaService: Turnstile token solved successfully via CapSolver');
      return pollRes.data.solution?.token;
    }

    if (pollRes.data?.status === 'failed') {
      throw new Error(`CapSolver task failed: ${pollRes.data?.errorDescription}`);
    }
  }

  throw new Error('CapSolver solving timed out after 60 seconds.');
}

export default { solveTurnstile };
