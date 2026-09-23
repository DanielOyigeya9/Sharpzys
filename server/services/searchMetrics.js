/**
 * services/searchMetrics.js
 *
 * Lightweight in-memory provider-health + search-analytics store with best-effort
 * atomic disk persistence (survives restarts on persistent volumes; Render's
 * ephemeral filesystem simply loses the snapshot, which is acceptable).
 *
 * Recorded:
 *   - Per search transaction: total / successful / with-results / empty / failed.
 *   - Per provider: outcome counts (SUCCESS / NO_RESULTS / VERIFICATION_REQUIRED /
 *     ERROR), last status, last response time, rolling average response time,
 *     last success timestamp, last error (type + message) timestamp.
 *
 * This store holds ONLY operational metadata — no customer PII, no credentials,
 * no raw provider responses. It is surfaced exclusively through the admin endpoint.
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const METRICS_FILE = process.env.METRICS_PATH || join(DATA_DIR, 'metrics.json');

/** Provider outcome categories. */
export const STATUS = {
  SUCCESS: 'SUCCESS',
  NO_RESULTS: 'NO_RESULTS',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  ERROR: 'ERROR',
};

const state = {
  startedAt: new Date().toISOString(),
  searches: {
    total: 0,
    successful: 0, // search endpoint returned 200 (with or without results)
    failed: 0, // search errored out (500/503/504)
    withResults: 0, // returned >= 1 flight
    empty: 0, // returned 0 flights successfully
    lastAt: null,
  },
  /** @type {Record<string, object>} provider name -> record */
  providers: {},
};

function ensureDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    logger.error('searchMetrics: failed to create data dir', { error: e.message });
  }
}

function newProviderRecord(name) {
  return {
    provider: name,
    total: 0,
    success: 0,
    noResults: 0,
    verification: 0,
    error: 0,
    lastStatus: null,
    lastCount: null,
    lastResponseTimeMs: null,
    lastAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorType: null,
    lastErrorMessage: null,
    _rtSum: 0,
    _rtN: 0,
  };
}

function getProvider(name) {
  const key = String(name || 'Unknown');
  if (!state.providers[key]) state.providers[key] = newProviderRecord(key);
  return state.providers[key];
}

// ─── Persistence (debounced, atomic) ──────────────────────────────────────────

let saveTimer = null;
function schedulePersist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persist();
  }, 2000);
}

function persist() {
  try {
    ensureDir();
    const tmp = `${METRICS_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(publicSnapshot(), null, 2), 'utf8');
    fs.renameSync(tmp, METRICS_FILE);
  } catch (e) {
    logger.error('searchMetrics: failed to persist metrics snapshot', { error: e.message });
  }
}

// ─── Recording API ────────────────────────────────────────────────────────────

/**
 * Record one end-to-end search transaction.
 * @param {{ ok: boolean, totalFlights?: number }} result
 */
export function recordSearch({ ok, totalFlights = 0 }) {
  state.searches.total += 1;
  state.searches.lastAt = new Date().toISOString();
  if (ok) {
    state.searches.successful += 1;
    if (totalFlights > 0) state.searches.withResults += 1;
    else state.searches.empty += 1;
  } else {
    state.searches.failed += 1;
  }
  schedulePersist();
}

/**
 * Record a single provider's outcome within a search.
 * @param {{
 *   provider: string,
 *   status: 'SUCCESS'|'NO_RESULTS'|'VERIFICATION_REQUIRED'|'ERROR',
 *   count?: number,
 *   durationMs?: number,
 *   errorType?: string|null,
 *   error?: string|null,
 * }} result
 */
export function recordProviderResult({ provider, status, count = 0, durationMs = 0, errorType = null, error = null }) {
  const p = getProvider(provider);
  const now = new Date().toISOString();

  p.total += 1;
  p.lastStatus = status;
  p.lastCount = count;
  p.lastAt = now;

  if (typeof durationMs === 'number' && durationMs > 0) {
    p.lastResponseTimeMs = Math.round(durationMs);
    p._rtSum += durationMs;
    p._rtN += 1;
  }

  switch (status) {
    case STATUS.SUCCESS:
      p.success += 1;
      p.lastSuccessAt = now;
      break;
    case STATUS.NO_RESULTS:
      p.noResults += 1;
      p.lastSuccessAt = now; // completed cleanly, just empty
      break;
    case STATUS.VERIFICATION_REQUIRED:
      p.verification += 1;
      break;
    case STATUS.ERROR:
    default:
      p.error += 1;
      p.lastErrorAt = now;
      p.lastErrorType = errorType || 'ERROR';
      p.lastErrorMessage = error ? String(error).slice(0, 300) : null;
      break;
  }

  schedulePersist();
}

// ─── Read API ─────────────────────────────────────────────────────────────────

function publicSnapshot() {
  const providers = Object.values(state.providers).map((p) => ({
    provider: p.provider,
    total: p.total,
    success: p.success,
    noResults: p.noResults,
    verification: p.verification,
    error: p.error,
    successRate: p.total > 0 ? Math.round((p.success / p.total) * 100) : null,
    lastStatus: p.lastStatus,
    lastCount: p.lastCount,
    lastResponseTimeMs: p.lastResponseTimeMs,
    avgResponseTimeMs: p._rtN > 0 ? Math.round(p._rtSum / p._rtN) : null,
    lastAt: p.lastAt,
    lastSuccessAt: p.lastSuccessAt,
    lastErrorAt: p.lastErrorAt,
    lastErrorType: p.lastErrorType,
    lastErrorMessage: p.lastErrorMessage,
    health: deriveHealth(p),
  }));

  return {
    startedAt: state.startedAt,
    generatedAt: new Date().toISOString(),
    searches: { ...state.searches },
    providers,
  };
}

function deriveHealth(p) {
  if (p.total === 0) return 'UNKNOWN';
  const recentFail =
    p.lastStatus === STATUS.ERROR &&
    p.lastErrorAt &&
    Date.now() - new Date(p.lastErrorAt).getTime() < 15 * 60 * 1000;
  if (recentFail) return 'DEGRADED';
  if (p.success > 0) return 'HEALTHY';
  return p.lastStatus === STATUS.VERIFICATION_REQUIRED ? 'AWAITING_VERIFICATION' : 'IDLE';
}

/** Return the current aggregated snapshot (safe to render in the admin UI). */
export function getMetrics() {
  return publicSnapshot();
}

export default { STATUS, recordSearch, recordProviderResult, getMetrics };
