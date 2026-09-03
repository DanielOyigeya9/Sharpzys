import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/confirmation.css';

function Confirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const booking = location.state?.booking;

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
