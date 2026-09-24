import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { submitBookingPayment } from '../services/api';
import { BANK_DETAILS } from '../config/bankDetails';
import '../styles/payment.css';

function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const booking = location.state?.booking ?? null;

  const [txnId, setTxnId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedField, setCopiedField] = useState('');

  if (!booking) {
    return (
      <div className="payment-wrapper">
        <Navbar />
        <main className="payment-page">
          <div className="payment-empty-card">
            <h2>No payment session found</h2>
            <p>Please start a flight search and complete a booking request to make a payment.</p>
            <button type="button" className="btn-primary" onClick={() => navigate('/')}>
              Go to SharpzyTravels Homepage
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const currencySymbol = booking.currency === 'NGN' ? '₦' : (booking.currency === 'USD' ? '$' : `${booking.currency} `);
  const formattedAmount = `${currencySymbol}${Number(booking.price || 0).toLocaleString()}`;
  const isRoundTrip = booking.tripType === 'roundTrip' || !!booking.returnFlight;

  const copyToClipboard = async (value, field) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 1800);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    const value = txnId.trim();
    if (!value) {
      setErrorMsg('Please enter your bank transaction reference / ID.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const res = await submitBookingPayment(booking.bookingReference, value);
      navigate('/confirmation', {
        state: { booking: res.booking || { ...booking, paymentTransactionId: value, paymentStatus: 'submitted' } },
      });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Could not submit your payment reference. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="payment-wrapper">
      <Navbar />

      <main className="payment-page">
        <div className="payment-container">
          {/* Header */}
          <div className="payment-hero">
            <div className="payment-hero-icon">🏦</div>
            <div>
              <h1>Complete Your Payment</h1>
              <p>Send the exact amount via bank transfer, then submit your transaction reference so our team can verify and confirm your booking.</p>
            </div>
          </div>

          {/* Amount due banner */}
          <div className="payment-amount-banner">
            <div className="amount-left">
              <span className="amount-label">Amount to Pay</span>
              <strong className="amount-value">{formattedAmount}</strong>
            </div>
            <div className="amount-right">
              <span className="amount-label">Booking Reference</span>
              <button
                type="button"
                className="amount-ref"
                onClick={() => copyToClipboard(booking.bookingReference, 'ref')}
                title="Click to copy"
              >
                {booking.bookingReference}
                <span className="copy-hint">{copiedField === 'ref' ? '✓ Copied' : '⧉ Copy'}</span>
              </button>
            </div>
          </div>

          <div className="payment-grid">
            {/* Left: bank details + steps */}
            <section className="payment-card">
              <h2 className="payment-card-title">Step 1 · Transfer the funds</h2>
              <p className="payment-card-sub">{BANK_DETAILS.instructions}</p>

              <div className="bank-details">
                <div className="bank-row">
                  <span className="bank-key">Bank Name</span>
                  <span className="bank-val">{BANK_DETAILS.bankName}</span>
                </div>
                <div className="bank-row">
                  <span className="bank-key">Account Name</span>
                  <span className="bank-val">{BANK_DETAILS.accountName}</span>
                </div>
                <div className="bank-row bank-row-acct">
                  <span className="bank-key">Account Number</span>
                  <span className="bank-val acct-num">{BANK_DETAILS.accountNumber}</span>
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => copyToClipboard(BANK_DETAILS.accountNumber, 'acct')}
                  >
                    {copiedField === 'acct' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <div className="bank-row">
                  <span className="bank-key">Amount</span>
                  <span className="bank-val amount-highlight">{formattedAmount}</span>
                </div>
                <div className="bank-row">
                  <span className="bank-key">Narration / Reference</span>
                  <span className="bank-val mono">{booking.bookingReference}</span>
                </div>
              </div>

              <div className="payment-trip-summary">
                <span className="summary-tag">{isRoundTrip ? 'Round trip' : 'One way'}</span>
                <span>
                  <strong>{booking.flight?.airline || 'Carrier'}</strong> · {booking.flight?.origin} → {booking.flight?.destination}
                </span>
                {booking.passengerName && <span className="summary-passenger">For {booking.passengerName}</span>}
              </div>
            </section>

            {/* Right: submit reference */}
            <section className="payment-card payment-submit-card">
              <h2 className="payment-card-title">Step 2 · Confirm your transfer</h2>
              <p className="payment-card-sub">Enter the bank transaction reference from your payment receipt or banking app.</p>

              <form onSubmit={handleSubmitPayment} className="payment-form">
                <label htmlFor="txnRef" className="payment-field-label">Bank Transaction Reference / ID</label>
                <input
                  id="txnRef"
                  type="text"
                  value={txnId}
                  onChange={(e) => setTxnId(e.target.value)}
                  placeholder="e.g. 8745120934 or NIP reference"
                  autoFocus
                />

                {errorMsg && <p className="payment-error">{errorMsg}</p>}

                <button type="submit" className="btn-success payment-submit-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting for verification...' : 'I Have Paid — Submit Reference'}
                </button>
              </form>

              <p className="payment-footnote">
                Not ready to transfer now? Your booking is already saved. Our team will hold your reservation while payment is pending.
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Payment;
