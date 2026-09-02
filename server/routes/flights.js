/**
 * routes/flights.js
 * Flight-related route definitions.
 * Kept thin — all logic lives in the controller.
 */

import { Router } from 'express';
import flightController from '../controllers/flightController.js';

const router = Router();

/**
 * POST /api/flights/search
 *
 * Body (JSON):
 *   {
 *     "origin":        "LOS",
 *     "destination":   "ABV",
 *     "departureDate": "2026-09-10",
 *     "returnDate":    "",          // optional, omit or leave empty for one-way
 *     "adults":        1
 *   }
 *
 * Response 200:
 *   {
 *     "success":  true,
 *     "source":   "live" | "cache",
 *     "count":    number,
 *     "flights":  NormalisedFlight[]
 *   }
 *
 * Errors:
 *   400 — validation failure
 *   503 — provider(s) unavailable
 *   504 — browser search timed out
 *   500 — unexpected server error
 */
router.post('/search', flightController.searchFlights);

export default router;
