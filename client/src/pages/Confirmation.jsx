import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { submitBookingPayment } from '../services/api';
import { BANK_DETAILS } from '../config/bankDetails';
import '../styles/confirmation.css';

function Confirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(location.state?.booking ?? null);
  const [txnId, setTxnId] = useState('');
  const [showPaidForm, setShowPaidForm] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState(null);

  const handleSubmitPaid = async (e) => {
    e.preventDefault();
    const value = txnId.trim();
    if (!value) {
      setPaymentMsg({ type: 'error', text: 'Please enter your bank transaction reference / ID.' });
      return;
    }
    setIsSubmittingPayment(true);
    setPaymentMsg(null);
    try {
      const res = await submitBookingPayment(booking.bookingReference, value);
      setBooking(res.booking);
      setShowPaidForm(false);
      setPaymentMsg({ type: 'success', text: 'Payment reference submitted. Our team is verifying your transfer.' });
    } catch (err) {
      setPaymentMsg({
        type: 'error',
        text: err.response?.data?.message || 'Could not submit your payment reference. Please try again.',
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (!booking) {
    return (
      <div className="confirmation-wrapper">
        <Navbar />
        <main className="confirmation-page empty-confirmation">
          <div className="confirmation-card">
            <h2>No booking reference found</h2>
            <p>Please initiate a flight search and complete a booking request.</p>
            <button onClick={() => navigate('/')} type="button" className="primary-btn">
              Go to SharpzyTravels Homepage
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const currencySymbol = booking.currency === 'NGN' ? '₦' : (booking.currency === 'USD' ? '$' : `${booking.currency} `);
  const formattedPrice = `${currencySymbol}${Number(booking.price || 0).toLocaleString()}`;

  const isBankTransfer = booking.paymentMethod === 'bank_transfer' || booking.paymentMethod === 'bank';
  const paymentSubmitted = booking.paymentStatus === 'submitted' || !!booking.paymentTransactionId;
  const paymentVerified = booking.paymentStatus === 'verified';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="confirmation-wrapper">
      <Navbar />

      <main className="confirmation-page">
        <div className="confirmation-container">
          <div className="confirmation-header-banner">
            <div className="success-icon-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h1>Booking Request Received</h1>
            <p className="confirmation-subtitle">
              Your flight reservation request has been submitted to the SharpzyTravels operations desk.
            </p>
          </div>

          {/* Reference Banner Card */}
          <div className="reference-hero-card">
            <div className="ref-left">
              <span className="ref-label">SharpzyTravels Booking Reference</span>
              <strong className="ref-code">{booking.bookingReference}</strong>
            </div>
            <div className="ref-center">
              <span className="ref-label">Airline PNR</span>
              <strong className="ref-pnr-code">
                {booking.airlinePnr ? booking.airlinePnr : 'Pending carrier assignment'}
              </strong>
            </div>
            <div className="ref-right">
              <span className={`status-badge ${(booking.status || 'pending').toLowerCase()}`}>
                ● Status: {booking.status || 'Pending'}
              </span>
            </div>
          </div>

          {/* Status Explanation Alert */}
          <div className="status-info-alert">
            <div className="alert-icon">ℹ️</div>
            <div className="alert-body">
              <strong>What happens next?</strong>
              <p>
                {booking.statusMessage ||
                  'Your booking request has been received. Our team will verify carrier availability and issuance before assigning your official Airline PNR.'}
              </p>
            </div>
          </div>

          {/* Confirmation Details Card */}
          <div className="confirmation-details-card">
            {/* Flight Summary */}
            <div className="conf-section">
              <h3>Flight Itinerary</h3>
              <div className="conf-grid-2">
                <div>
                  <span className="conf-label">Airline & Flight:</span>
                  <strong>{booking.flight?.airline} ({booking.flight?.flightNumber || 'Direct'})</strong>
                </div>
                <div>
                  <span className="conf-label">Route:</span>
                  <strong>{booking.flight?.origin} → {booking.flight?.destination}</strong>
                </div>
                <div>
                  <span className="conf-label">Departure Time:</span>
                  <strong>{booking.flight?.departureTime}</strong>
                </div>
                <div>
                  <span className="conf-label">Arrival Time:</span>
                  <strong>{booking.flight?.arrivalTime}</strong>
                </div>
              </div>
            </div>

            <div className="conf-divider"></div>

            {/* Passenger Summary */}
            <div className="conf-section">
              <h3>Passenger & Contact Details</h3>
              <div className="conf-grid-2">
                <div>
                  <span className="conf-label">Booking Contact:</span>
                  <strong>{booking.passengerName}</strong>
                </div>
                <div>
                  <span className="conf-label">Contact Email:</span>
                  <strong>{booking.email}</strong>
                </div>
                <div>
                  <span className="conf-label">Contact Phone:</span>
                  <strong>{booking.phone}</strong>
                </div>
                <div>
                  <span className="conf-label">Payment Option:</span>
                  <strong>{booking.paymentMethod === 'bank_transfer' || booking.paymentMethod === 'bank' ? 'Direct Bank Transfer' : 'Pay on Site'}</strong>
                </div>
              </div>
            </div>

            <div className="conf-divider"></div>

            {/* Total Fare Summary */}
            <div className="conf-section">
              <h3>Total Summary</h3>
              <div className="conf-price-row">
                <span>Total Amount:</span>
                <strong className="conf-price-amount">{formattedPrice}</strong>
              </div>
            </div>
          </div>

          {/* Bank Transfer Payment Panel (only for bank transfer bookings) */}
          {isBankTransfer && (
            <div className="conf-section" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem', margin: '1.25rem 0' }}>
              <h3 style={{ marginTop: 0 }}>Complete Your Payment — Bank Transfer</h3>
              <p style={{ color: '#475569', marginTop: 0 }}>{BANK_DETAILS.instructions}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.9rem', background: '#ffffff', borderRadius: '12px', padding: '1.1rem', border: '1px solid #e2e8f0' }}>
                <div>
                  <span className="conf-label">Bank Name</span>
                  <strong style={{ display: 'block', fontSize: '1.05rem' }}>{BANK_DETAILS.bankName}</strong>
                </div>
                <div>
                  <span className="conf-label">Account Name</span>
                  <strong style={{ display: 'block', fontSize: '1.05rem' }}>{BANK_DETAILS.accountName}</strong>
                </div>
                <div>
                  <span className="conf-label">Account Number</span>
                  <strong style={{ display: 'block', fontSize: '1.3rem', letterSpacing: '1px', fontFamily: 'monospace' }}>{BANK_DETAILS.accountNumber}</strong>
                </div>
                <div>
                  <span className="conf-label">Amount to Pay</span>
                  <strong style={{ display: 'block', fontSize: '1.05rem', color: '#16a34a' }}>{formattedPrice}</strong>
                </div>
                <div>
                  <span className="conf-label">Payment Reference (use as narration)</span>
                  <strong style={{ display: 'block', fontSize: '1.05rem', fontFamily: 'monospace' }}>{booking.bookingReference}</strong>
                </div>
              </div>

              {paymentMsg && (
                <p style={{ marginTop: '1rem', padding: '0.6rem 0.8rem', borderRadius: '8px', background: paymentMsg.type === 'success' ? '#dcfce7' : '#fee2e2', color: paymentMsg.type === 'success' ? '#166534' : '#991b1b' }}>
                  {paymentMsg.text}
                </p>
              )}

              {paymentSubmitted ? (
                <div style={{ marginTop: '1rem', padding: '1rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px' }}>
                  <strong style={{ color: '#047857' }}>
                    {paymentVerified ? '✓ Payment verified by our team' : '✓ Payment submitted — awaiting verification'}
                  </strong>
                  <div style={{ marginTop: '0.35rem' }}>
                    <span className="conf-label">Transaction Reference: </span>
                    <strong style={{ fontFamily: 'monospace' }}>{booking.paymentTransactionId}</strong>
                  </div>
                  <p style={{ color: '#475569', marginBottom: 0, marginTop: '0.5rem' }}>
                    {paymentVerified
                      ? 'Your transfer has been confirmed. Our team is issuing your airline ticket and will update your booking status and PNR shortly.'
                      : 'Our operations team is confirming your transfer. You will be notified once your booking is verified and your airline PNR is issued.'}
                  </p>
                </div>
              ) : showPaidForm ? (
                <form onSubmit={handleSubmitPaid} style={{ marginTop: '1rem' }}>
                  <label className="conf-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Bank Transaction Reference / ID</label>
                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={txnId}
                      onChange={(e) => setTxnId(e.target.value)}
                      placeholder="e.g. 8745120934 or NIP reference"
                      style={{ flex: '1 1 240px', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      autoFocus
                    />
                    <button type="submit" className="btn-primary" disabled={isSubmittingPayment}>
                      {isSubmittingPayment ? 'Submitting...' : 'Submit for Verification'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => { setShowPaidForm(false); setPaymentMsg(null); }}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className="btn-success" style={{ marginTop: '1rem' }} onClick={() => setShowPaidForm(true)}>
                  💳 I Have Paid — Submit Transaction Reference
                </button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="confirmation-actions">
            <button type="button" className="btn-secondary" onClick={handlePrint}>
              🖨️ Print Summary
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/manage-booking')}>
              📋 Manage Booking
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/')}>
              ✈️ Back to SharpzyTravels
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Confirmation;
