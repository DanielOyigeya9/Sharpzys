/**
 * dbService.js
 * Persistent storage service for FlyNow booking records.
 * Uses atomic disk persistence to ensure data survives server restarts and page refreshes.
 */

import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = process.env.DATABASE_PATH || join(DATA_DIR, 'bookings.json');

// Ensure database directory and file exist
function ensureDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf8');
      logger.info('dbService: initialized empty bookings database file', { path: DB_FILE });
    }
  } catch (err) {
    logger.error('dbService: failed to ensure database file', { error: err.message });
  }
}

// Initialize database file on module load
ensureDatabase();

/**
 * Get all saved bookings
 * @returns {Array} List of booking records sorted by createdAt desc
 */
export function getAllBookings() {
  ensureDatabase();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const bookings = JSON.parse(raw || '[]');
    return bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    logger.error('dbService: failed to read bookings from database', { error: err.message });
    return [];
  }
}

/**
 * Get a single booking by reference or email
 * @param {string} query Reference code or email
 * @returns {Object|null} Booking record or null
 */
export function getBookingByRef(query) {
  if (!query) return null;
  const q = query.trim().toUpperCase();
  const qEmail = query.trim().toLowerCase();
  const all = getAllBookings();

  return all.find(
    (b) => (b.bookingReference || '').toUpperCase() === q || (b.email || '').toLowerCase() === qEmail
  ) || null;
}

/**
 * Save a new booking record
 * @param {Object} record Booking object
 * @returns {Object} Saved booking record
 */
export function saveBooking(record) {
  ensureDatabase();
  try {
    const all = getAllBookings();
    
    // Check if record with same reference already exists
    const existingIndex = all.findIndex((b) => b.bookingReference === record.bookingReference);
    
    const now = new Date().toISOString();
    const updatedRecord = {
      airlinePnr: null,
      ...record,
      updatedAt: now,
      createdAt: record.createdAt || now,
    };

    if (existingIndex >= 0) {
      all[existingIndex] = updatedRecord;
    } else {
      all.unshift(updatedRecord);
    }

    // Atomic write
    const tempPath = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(all, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_FILE);

    logger.info('dbService: saved booking to database', {
      bookingReference: record.bookingReference,
      status: record.status,
      airlinePnr: updatedRecord.airlinePnr,
      passengerName: record.passengerName,
    });

    return updatedRecord;
  } catch (err) {
    logger.error('dbService: failed to save booking to database', { error: err.message });
    throw err;
  }
}

/**
 * Update booking status
 * @param {string} ref Booking reference code
 * @param {string} status New status ('Pending', 'Approved', 'Confirmed', 'Rejected', 'Cancelled')
 * @param {string} [statusMessage] Optional custom message
 * @returns {Object} Updated booking record
 */
export function updateBookingStatus(ref, status, statusMessage) {
  ensureDatabase();
  const booking = getBookingByRef(ref);
  if (!booking) {
    const err = new Error(`No booking found matching reference "${ref}".`);
    err.statusCode = 404;
    throw err;
  }

  const normalizedStatus = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  
  let defaultMessage = booking.statusMessage;
  if (normalizedStatus === 'Approved') {
    defaultMessage = 'Your booking request has been approved by operations desk. Confirming carrier reservation.';
  } else if (normalizedStatus === 'Confirmed') {
    defaultMessage = booking.airlinePnr
      ? `Your reservation has been confirmed with the carrier. Airline PNR: ${booking.airlinePnr}.`
      : 'Your reservation has been confirmed with the carrier.';
  } else if (normalizedStatus === 'Rejected') {
    defaultMessage = 'Your booking request could not be approved by operations desk. Please contact support.';
  } else if (normalizedStatus === 'Cancelled') {
    defaultMessage = 'Your booking request has been cancelled.';
  } else if (normalizedStatus === 'Pending') {
    defaultMessage = 'Your booking request is pending operations verification.';
  }

  booking.status = normalizedStatus;
  booking.statusMessage = statusMessage || defaultMessage;
  booking.updatedAt = new Date().toISOString();

  return saveBooking(booking);
}

/**
 * Update or set real Airline PNR for a booking record
 * @param {string} ref Booking reference code
 * @param {string|null} pnr Real Airline PNR from carrier
 * @returns {Object} Updated booking record
 */
export function updateAirlinePnr(ref, pnr) {
  ensureDatabase();
  const booking = getBookingByRef(ref);
  if (!booking) {
    const err = new Error(`No booking found matching reference "${ref}".`);
    err.statusCode = 404;
    throw err;
  }

  const cleanedPnr = (pnr || '').trim().toUpperCase();

  if (cleanedPnr) {
    booking.airlinePnr = cleanedPnr;
    // When real Airline PNR is added by admin to an approved or pending booking, update status to Confirmed
    if (booking.status === 'Approved' || booking.status === 'Pending') {
      booking.status = 'Confirmed';
    }
    booking.statusMessage = `Your flight reservation has been confirmed with ${booking.flight?.airline || 'the carrier'}. Airline PNR: ${cleanedPnr}.`;
  } else {
    booking.airlinePnr = null;
    if (booking.status === 'Confirmed') {
      booking.status = 'Approved';
      booking.statusMessage = 'Your booking request is approved by operations.';
    }
  }

  booking.updatedAt = new Date().toISOString();
  return saveBooking(booking);
}

/**
 * Record a customer-submitted bank-transfer transaction reference for verification.
 * Public (customer self-service): attaches the reference and flips the payment
 * status to 'submitted' so the admin panel can verify it. Does NOT change the
 * overall booking status (that stays Pending/Confirmed by admin action).
 * @param {string} ref Booking reference code
 * @param {string} transactionId Bank transfer transaction/reference id from the customer
 * @returns {Object} Updated booking record
 */
export function updatePaymentTransaction(ref, transactionId) {
  ensureDatabase();
  const booking = getBookingByRef(ref);
  if (!booking) {
    const err = new Error(`No booking found matching reference "${ref}".`);
    err.statusCode = 404;
    throw err;
  }

  const cleaned = String(transactionId || '').trim();
  if (!cleaned) {
    const err = new Error('A transaction reference is required.');
    err.statusCode = 400;
    throw err;
  }

  booking.paymentTransactionId = cleaned;
  booking.paymentStatus = 'submitted';
  booking.paymentSubmittedAt = new Date().toISOString();
  booking.updatedAt = booking.paymentSubmittedAt;
  // Only prepend a payment note to the customer-facing message; leave status as-is.
  booking.statusMessage =
    `Payment reference "${cleaned}" received. Our team is verifying the transfer and will confirm shortly.`;

  logger.info('dbService: recorded payment transaction', {
    bookingReference: booking.bookingReference,
    paymentTransactionId: cleaned,
    paymentStatus: booking.paymentStatus,
  });

  return saveBooking(booking);
}

export function verifyPayment(ref, verified = true) {
  ensureDatabase();
  const booking = getBookingByRef(ref);
  if (!booking) {
    const err = new Error(`No booking found matching reference "${ref}".`);
    err.statusCode = 404;
    throw err;
  }

  if (verified) {
    if (!booking.paymentTransactionId) {
      const err = new Error('No payment transaction reference has been submitted for this booking.');
      err.statusCode = 400;
      throw err;
    }
    booking.paymentStatus = 'verified';
    booking.paymentVerifiedAt = new Date().toISOString();
    booking.statusMessage = 'Payment verified by our team. Your booking is being processed.';
  } else {
    // Revert to the pre-verification state so admin can flag a bad reference.
    booking.paymentStatus = booking.paymentTransactionId ? 'submitted' : 'awaiting_payment';
    booking.paymentVerifiedAt = null;
    booking.statusMessage = booking.paymentTransactionId
      ? `Payment reference "${booking.paymentTransactionId}" is pending verification.`
      : 'Awaiting your bank transfer payment.';
  }

  booking.updatedAt = new Date().toISOString();

  logger.info('dbService: admin updated payment verification status', {
    bookingReference: booking.bookingReference,
    paymentStatus: booking.paymentStatus,
    paymentTransactionId: booking.paymentTransactionId,
  });

  return saveBooking(booking);
}

export default {
  getAllBookings,
  getBookingByRef,
  saveBooking,
  updateBookingStatus,
  updateAirlinePnr,
  updatePaymentTransaction,
  verifyPayment,
};
