/**
 * routes/adminRoutes.js
 *
 * Admin auth + operational endpoints. Surfaces provider health + search analytics
 * that must NEVER be shown to customers, so every route below is guarded by the
 * hardcoded admin auth (see services/adminAuth.js). No third-party DB/provider.
 *
 *   POST /api/admin/login   → verify hardcoded creds, return a signed bearer token
 *   GET  /api/admin/health  → provider health + search analytics (admin token required)
 */

import { Router } from 'express';
import logger from '../utils/logger.js';
import { getMetrics } from '../services/searchMetrics.js';
import {
  verifyCredentials,
  signToken,
  requireAdmin,
  consumeLoginAttempt,
  resetLoginAttempts,
} from '../services/adminAuth.js';

const router = Router();

/**
 * POST /api/admin/login
 * Body: { username, password }. Rate-limited per IP to blunt brute force.
 */
router.post('/login', (req, res, next) => {
  const { allowed, retryAfterSec } = consumeLoginAttempt(req);
  if (!allowed) {
    logger.warn('adminRoutes: login rate limit hit', { ip: req.ip });
    const err = new Error(`Too many login attempts. Try again in ${retryAfterSec}s.`);
    err.statusCode = 429;
    err.code = 'ADMIN_RATE_LIMIT';
    return next(err);
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    const err = new Error('Username and password are required.');
    err.statusCode = 400;
    return next(err);
  }

  if (!verifyCredentials(username, password)) {
    logger.warn('adminRoutes: failed login attempt', { username: String(username).slice(0, 40) });
    const err = new Error('Invalid admin credentials.');
    err.statusCode = 401;
    err.code = 'ADMIN_UNAUTHORIZED';
    return next(err);
  }

  resetLoginAttempts(req);
  const { token, expiresAt } = signToken('admin');
  logger.info('adminRoutes: admin login success', { username: String(username).slice(0, 40) });
  return res.status(200).json({ success: true, token, expiresAt, role: 'admin' });
});

/**
 * GET /api/admin/health
 * Aggregated provider health + search analytics (admin-only).
 */
router.get('/health', requireAdmin, (req, res) => {
  res.status(200).json({ success: true, metrics: getMetrics() });
});

export default router;
