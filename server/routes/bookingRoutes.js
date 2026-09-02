/**
 * routes/bookingRoutes.js
 * Server-persisted handlers for booking requests, admin status approval & PNR management.
 */

import { Router } from 'express';
import logger from '../utils/logger.js';
import {
  getAllBookings,
  getBookingByRef,
  saveBooking,
  updateBookingStatus,
  updateAirlinePnr,
} from '../services/dbService.js';

const router = Router();

function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'FN-';
  for (let i = 0; i < 6; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}

/**
 * POST /api/book
 * Create a new persistent booking request.
 */
router.post('/book', (req, res, next) => {
  try {
    const {
      flight,
      passengerName,
      email,
      phone,
      passengers = [],
      extras = {},
      paymentMethod = 'pay_on_site',
      price,
      currency = 'NGN',
    } = req.body;

    if (!flight || (!passengerName && passengers.length === 0) || !email) {
      const err = new Error('Flight details, passenger name, and email are required.');
      err.statusCode = 400;
      return next(err);
    }

    const bookingReference = generateReference();
    const primaryPassengerName = passengerName || (passengers[0] ? `${passengers[0].firstName} ${passengers[0].lastName}` : 'Passenger');

    const normalizedPaymentMethod = String(paymentMethod || 'pay_on_site').trim().toLowerCase();
    const finalPaymentMethod = normalizedPaymentMethod === 'bank' || normalizedPaymentMethod === 'bank_transfer' || normalizedPaymentMethod === 'direct_bank_transfer'
      ? 'bank_transfer'
      : 'pay_on_site';

    const bookingRecord = {
      bookingReference,
      status: 'Pending',
      statusMessage: 'Your booking request has been received. Our operations team is confirming seat availability and ticketing.',
      passengerName: primaryPassengerName,
      email,
      phone: phone || '',
      passengers: passengers.length > 0 ? passengers : [{ name: primaryPassengerName, email, phone }],
      flight,
      price: price || flight.price,
      currency: currency || flight.currency || 'NGN',
      extras,
      paymentMethod: finalPaymentMethod,
      airlinePnr: null,
      createdAt: new Date().toISOString(),
    };

    // Save to server database
    const saved = saveBooking(bookingRecord);

    logger.info('bookingRoutes: created persistent booking request', {
      bookingReference,
      passengerName: primaryPassengerName,
      origin: flight.origin,
      destination: flight.destination,
      status: 'Pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Booking request created successfully.',
      booking: saved,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bookings
 * Returns persistent list of bookings from database.
 */
router.get('/bookings', (req, res, next) => {
  try {
    const all = getAllBookings();
    return res.status(200).json({
      success: true,
      count: all.length,
      bookings: all,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bookings/:ref
 * Look up a persistent booking by reference or email.
 */
router.get('/bookings/:ref', (req, res, next) => {
  try {
    const booking = getBookingByRef(req.params.ref);
    if (!booking) {
      const err = new Error(`No booking found matching reference "${req.params.ref}".`);
      err.statusCode = 404;
      return next(err);
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/bookings/:ref/status
 * Update booking status (Pending, Approved, Confirmed, Rejected, Cancelled) in database.
 */
router.patch('/bookings/:ref/status', (req, res, next) => {
  try {
    const { status, statusMessage } = req.body;
    if (!status) {
      const err = new Error('Status field is required.');
      err.statusCode = 400;
      return next(err);
    }

    const updated = updateBookingStatus(req.params.ref, status, statusMessage);

    logger.info('bookingRoutes: updated booking status', {
      bookingReference: updated.bookingReference,
      status: updated.status,
    });

    return res.status(200).json({
      success: true,
      message: `Booking status updated to ${updated.status}.`,
      booking: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/bookings/:ref/pnr
 * Add, edit, or clear real Airline PNR in database.
 */
router.patch('/bookings/:ref/pnr', (req, res, next) => {
  try {
    const { airlinePnr } = req.body;
    const updated = updateAirlinePnr(req.params.ref, airlinePnr);

    logger.info('bookingRoutes: updated airline PNR', {
      bookingReference: updated.bookingReference,
      airlinePnr: updated.airlinePnr,
      status: updated.status,
    });

    return res.status(200).json({
      success: true,
      message: updated.airlinePnr ? `Airline PNR updated to ${updated.airlinePnr}.` : 'Airline PNR cleared.',
      booking: updated,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
