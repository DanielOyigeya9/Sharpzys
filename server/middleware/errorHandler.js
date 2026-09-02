/**
 * middleware/errorHandler.js
 *
 * Centralised Express error-handling middleware.
 * Must be registered LAST (after all routes).
 *
 * Maps known error codes/types to HTTP status codes and
 * returns a safe, structured JSON error response.
 * Never leaks provider internals, stack traces, or API keys.
 */

import logger from '../utils/logger.js';

// Map of human-readable error codes to HTTP status codes.
const ERROR_CODE_MAP = {
  VALIDATION_ERROR:   400,
  TIMEOUT_ERROR:      504,
  PROVIDER_UNAVAILABLE: 503,
};

/**
 * Determine the appropriate HTTP status code for an error.
 * Priority: err.statusCode > err.code lookup > default 500.
 * @param {Error} err
 * @returns {number}
 */
function resolveStatus(err) {
  if (err.statusCode && Number.isInteger(err.statusCode)) {
    return err.statusCode;
  }
  if (err.code && ERROR_CODE_MAP[err.code]) {
    return ERROR_CODE_MAP[err.code];
  }
  // Playwright / navigation timeouts
  if (
    err.name === 'TimeoutError' ||
    /timeout/i.test(err.message)
  ) {
    return 504;
  }
  return 500;
}

/**
 * Build a safe, client-facing error message.
 * Never expose internal details in production.
 * @param {Error}  err
 * @param {number} status
 * @returns {string}
 */
function resolveMessage(err, status) {
  const isProduction = process.env.NODE_ENV === 'production';

  const publicMessages = {
    400: 'Invalid request. Please check your search parameters.',
    502: "We couldn't connect to the flight provider.",
    503: "We couldn't connect to the flight provider.",
    504: 'The flight search timed out. Please try again.',
    500: 'An unexpected error occurred. Please try again later.',
  };

  if (isProduction) {
    return publicMessages[status] || publicMessages[500];
  }

  // In development/staging, expose error message or fallback to clean public message
  return err.message || publicMessages[status] || publicMessages[500];
}

/**
 * Express 4-argument error handler.
 * @param {Error}            err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next   (must be declared even if unused)
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status  = resolveStatus(err);
  const message = resolveMessage(err, status);

  logger.error('Request error', {
    status,
    method:  req.method,
    path:    req.path,
    message: err.message,
    code:    err.code,
    // Stack only in non-production
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });

  res.status(status).json({
    success: false,
    status,
    message,
  });
}

export default errorHandler;
