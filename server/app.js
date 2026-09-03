/**
 * app.js
 * SharpzyTravels server — single entry point.
 *
 * Middleware stack (in order):
 *   helmet       → security headers
 *   compression  → gzip response bodies
 *   express.static → React production build  ← BEFORE cors, so asset requests
 *                                               never hit the CORS middleware
 *   cors         → cross-origin policy (API routes only)
 *   morgan       → HTTP request logging
 *   express.json → parse JSON request bodies
 *
 * Routes:
 *   GET  /health             → JSON liveness probe
 *   POST /api/flights/search → flight search
 *   GET  *                   → React app (client/dist/index.html)
 */

import 'dotenv/config';
import express          from 'express';
import helmet           from 'helmet';
import compression      from 'compression';
import cors             from 'cors';
import morgan           from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

import flightRoutes  from './routes/flights.js';
import bookingRoutes from './routes/bookingRoutes.js';
import errorHandler  from './middleware/errorHandler.js';
import cacheService  from './services/cacheService.js';
import queueService  from './services/queueService.js';
import logger        from './utils/logger.js';

// ─── Paths ────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Vite writes the production build to client/dist (one level above /server)
const CLIENT_DIST = join(__dirname, '..', 'client', 'dist');

// ─── App ──────────────────────────────────────────────────────────────────────

const app  = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const ENV  = process.env.NODE_ENV || 'development';

// ─── Trusted origins (for API CORS only) ──────────────────────────────────────
//
// Build from env vars first, then add a hard-coded production fallback so that
// the Render deployment always allows its own frontend even when the env var is
// not yet set.  localhost origins are included for local development only.
const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.ALLOWED_ORIGINS,
].filter(Boolean);

const allowedOrigins = configuredOrigins
  .flatMap((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean));

// Production fallback — always allow the deployed frontend.
// This is safe because it is a specific origin, not a wildcard.
if (!allowedOrigins.includes('https://sharpzys.onrender.com')) {
  allowedOrigins.push('https://sharpzys.onrender.com');
}

if (ENV !== 'production') {
  // Vite dev server + common local ports
  allowedOrigins.push(
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000',
  );
}

const corsOptions = {
  origin(requestOrigin, callback) {
    // Requests with no Origin header (same-origin, curl, Postman) are allowed.
    if (!requestOrigin) return callback(null, true);

    // Normalise: strip any trailing slash the browser might send.
    const normalisedOrigin = requestOrigin.replace(/\/$/, '');

    if (allowedOrigins.includes(normalisedOrigin)) return callback(null, true);
    callback(new Error(`CORS: Origin "${requestOrigin}" is not allowed.`));
  },
  methods:              ['GET', 'POST', 'OPTIONS'],
  allowedHeaders:       ['Content-Type', 'Authorization'],
  credentials:          true,
  optionsSuccessStatus: 204,
};

// ─── Security headers ─────────────────────────────────────────────────────────
//
// crossOriginResourcePolicy: 'cross-origin'
//   Vite's production build emits:
//     <script type="module" crossorigin src="/assets/index-*.js">
//     <link rel="stylesheet" crossorigin href="/assets/index-*.css">
//   The `crossorigin` attribute causes the browser to make a CORS-mode fetch
//   even for same-origin URLs.  Helmet's default CORP value of `same-origin`
//   causes Chrome/Firefox to block those requests, so the JS bundle never
//   executes and the page stays blank.  Setting this to `cross-origin`
//   allows the browser to load the assets normally.
//
// contentSecurityPolicy directives
//   styleSrc  → fonts.googleapis.com  : global.css uses @import url(Google Fonts)
//   fontSrc   → fonts.gstatic.com     : actual font binary files are served there
//   imgSrc    → https:                : Home.jsx loads Unsplash images by URL
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        scriptSrc:  ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc:    ["'self'", 'data:', 'https://fonts.gstatic.com'],
      },
    },
  })
);

app.use(compression());

// ─── Static assets (React production build) ──────────────────────────────────
// Placed BEFORE the cors() middleware intentionally.
//
// When the browser fetches /assets/index-*.js with `crossorigin`, it sends
// an Origin header.  If express.static is placed after cors(), the cors()
// middleware runs first and rejects the request with a 500 because
// http://localhost:5000 was not in the allowedOrigins list.
//
// Placing express.static here means asset requests are served and the
// response is returned before cors() ever runs.  No CORS header is needed
// for assets served from the same origin as the page.
app.use(express.static(CLIENT_DIST));

// ─── CORS (API routes only) ───────────────────────────────────────────────────
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── HTTP request logging ─────────────────────────────────────────────────────
const morganFormat = ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status:   'ok',
    provider: 'AlternativeAirlines',
    cache:    'enabled',
    queue:    'enabled',
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/flights', flightRoutes);
app.use('/api', bookingRoutes);

// ─── React catch-all ──────────────────────────────────────────────────────────
// Any request that didn't match /health or /api/* is a React Router path.
// Return index.html so the client-side router handles it — this prevents 404s
// when a user refreshes /booking, /results, /login, etc.
app.get('*', (req, res) => {
  res.sendFile(join(CLIENT_DIST, 'index.html'));
});

// ─── Centralised error handler (must be last) ─────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info('FlyNow server started', {
    port:        PORT,
    environment: ENV,
    pid:         process.pid,
    endpoints:   ['GET /health', 'POST /api/flights/search', 'GET * → React app'],
    serving:     CLIENT_DIST,
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

export default app;
