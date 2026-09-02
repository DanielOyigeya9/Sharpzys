/**
 * utils/logger.js
 * Centralised logger for SharpzyTravels server.
 * Uses console with structured JSON-style output so logs are
 * easily ingested by any log aggregator (Datadog, CloudWatch, etc.).
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
const activeLevel = LEVELS[configured] ?? LEVELS.info;

/**
 * Format a log entry as a single-line JSON string.
 * @param {string} level
 * @param {string} message
 * @param {object} [meta]
 */
function format(level, message, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    service: 'sharpzytravels-server',
    message,
    ...meta,
  };
  return JSON.stringify(entry);
}

function write(level, message, meta) {
  if (LEVELS[level] > activeLevel) return;
  const line = format(level, message, meta);
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

const logger = {
  error: (message, meta) => write('error', message, meta),
  warn:  (message, meta) => write('warn',  message, meta),
  info:  (message, meta) => write('info',  message, meta),
  debug: (message, meta) => write('debug', message, meta),
};

export default logger;
