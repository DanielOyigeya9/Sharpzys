/**
 * services/adminAuth.js
 *
 * Hardcoded admin authentication for SharpzyTravels — NO third-party database or
 * auth provider (by design). Credentials come from env vars with safe fallbacks;
 * a signed, self-contained bearer token (HMAC-SHA256) is issued on login and
 * verified statelessly on each admin request. Everything uses Node's built-in
 * `crypto`, so there are zero new npm dependencies.
 *
 * Configuration (env):
 *   ADMIN_USERNAME     default "sharpzy@gmail.com"
 *   ADMIN_PASSWORD     default "Sharpzy2026"  ← override via env in production
 *   ADMIN_JWT_SECRET   signing key; defaults to a build-time constant. Set a long
 *                      random value in production so tokens can't be forged.
 *   ADMIN_TOKEN_TTL_MIN  token lifetime in minutes (default 480 = 8h)
 */

import crypto from 'crypto';
import logger from '../utils/logger.js';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'sharpzy@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Sharpzy2026';
const TOKEN_SECRET =
  process.env.ADMIN_JWT_SECRET || 'sharpzy-static-admin-token-signing-key-change-me';
const TOKEN_TTL_MS = (parseInt(process.env.ADMIN_TOKEN_TTL_MIN || '480', 10) || 480) * 60 * 1000;

// ─── Constant-time string comparison ──────────────────────────────────────────
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Compare against itself to keep timing consistent, then fail.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─── Credential check ─────────────────────────────────────────────────────────
export function verifyCredentials(username, password) {
  // Trim inputs (paste/autocapitalize safety) and treat the email username
  // case-insensitively. The password stays case-sensitive but is trimmed of
  // surrounding whitespace, which is never part of these fixed credentials.
  const u = String(username || '').trim().toLowerCase();
  const p = String(password || '').trim();
  const uOk = safeEqual(u, ADMIN_USERNAME.trim().toLowerCase());
  const pOk = safeEqual(p, ADMIN_PASSWORD.trim());
  // Evaluate both before combining to avoid leaking which field failed via timing.
  return uOk && pOk;
}

// ─── Token sign / verify ──────────────────────────────────────────────────────
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(input) {
  return Buffer.from(String(input).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}
function hmac(data) {
  return crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('hex');
}

/** Issue a signed bearer token embedding role + expiry. */
export function signToken(role = 'admin') {
  const payload = { role, iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = hmac(body);
  return { token: `${body}.${sig}`, expiresAt: payload.exp };
}

/**
 * Verify a bearer token. Returns the payload if valid & unexpired, else null.
 * @param {string|null} token
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = hmac(body);
  if (!safeEqual(sig, expected)) return null;

  try {
    const payload = JSON.parse(unb64url(body));
    if (!payload || payload.role !== 'admin') return null;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function extractBearer(req) {
  const auth = req.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  // Also accept a raw x-admin-token for convenience.
  return (req.get('x-admin-token') || '').trim() || null;
}

/**
 * Express middleware: reject non-admin requests with 401.
 * Attach the decoded payload to req.admin on success.
 */
export function requireAdmin(req, res, next) {
  const payload = verifyToken(extractBearer(req));
  if (payload) {
    req.admin = payload;
    return next();
  }
  logger.warn('adminAuth: unauthorized admin API access attempt', { path: req.path });
  const err = new Error('Admin authentication required.');
  err.statusCode = 401;
  err.code = 'ADMIN_UNAUTHORIZED';
  return next(err);
}

// ─── Login rate limiting (in-memory, per IP) ──────────────────────────────────
// Blunts brute-force / scammer attempts against the hardcoded credentials.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map(); // key -> { count, resetAt }

function clientKey(req) {
  return (req.ip || req.socket?.remoteAddress || 'unknown').toString();
}

/**
 * Returns { allowed, retryAfterSec }. Records a failed attempt.
 */
export function consumeLoginAttempt(req) {
  const key = clientKey(req);
  const now = Date.now();
  const rec = attempts.get(key);

  if (!rec || now > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (rec.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.resetAt - now) / 1000) };
  }
  rec.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** Clear a client's failed-attempt counter after a successful login. */
export function resetLoginAttempts(req) {
  attempts.delete(clientKey(req));
}

export default {
  verifyCredentials,
  signToken,
  verifyToken,
  requireAdmin,
  consumeLoginAttempt,
  resetLoginAttempts,
};
