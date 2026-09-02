import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { getBookingByRef } from '../services/api';
import '../styles/manage-booking.css';

function ManageBooking() {
  const navigate = useNavigate();
  const [bookingRef, setBookingRef] = useState('');
  const [email, setEmail] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [retrievedBooking, setRetrievedBooking] = useState(null);

  const handleSearchBooking = async (e) => {
    e.preventDefault();
    if (!bookingRef.trim()) {
      setError('Please enter a valid Booking Reference (e.g. FN-849210).');
      return;
    }

    setIsSearching(true);
    setError('');
    setRetrievedBooking(null);

    try {
      const response = await getBookingByRef(bookingRef.trim(), email.trim());
      setRetrievedBooking(response.booking);
    } catch (err) {
      setError(err.response?.data?.message || `No booking found for reference "${bookingRef}". Please check details and try again.`);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="manage-booking-wrapper">
      <Navbar />

      <main className="manage-booking-page">
        <div className="manage-container">
          <div className="manage-header">
            <h1>Manage Your Booking</h1>
            <p>Retrieve, review, or update your SharpzyTravels flight booking request.</p>
          </div>

          {/* Search Form Card */}
          <div className="lookup-card">
            <form onSubmit={handleSearchBooking} className="lookup-form">
              <div className="form-group">
                <label>Booking Reference *</label>
                <input
                  type="text"
                  placeholder="e.g. FN-849210"
                  value={bookingRef}
                  onChange={(e) => setBookingRef(e.target.value.toUpperCase())}
                  required
                />
                <span className="help-text">6-character code from your e-ticket confirmation</span>
              </div>

              <div className="form-group">
                <label>Contact Email (Optional)</label>
                <input
                  type="email"
                  placeholder="your.email@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button type="submit" className="lookup-submit-btn" disabled={isSearching}>
                {isSearching ? 'Retrieving Booking…' : 'Find Booking'}
              </button>
            </form>

            {error && <p className="lookup-error">{error}</p>}
          </div>

          {/* Retrieved Booking Results */}
          {retrievedBooking && (
            <div className="retrieved-booking-card">
              <div className="booking-status-header">
                <div>
                  <span className="ref-tag">SharpzyTravels Booking ID: {retrievedBooking.bookingReference}</span>
                  <h2>{retrievedBooking.flight?.origin} → {retrievedBooking.flight?.destination}</h2>
                </div>
                <span className={`status-pill ${(retrievedBooking.status || 'pending').toLowerCase()}`}>
                  ● {retrievedBooking.status || 'Pending Verification'}
                </span>
              </div>

              <div className="details-grid">
                <div className="detail-item">
                  <span>SharpzyTravels Booking ID</span>
                  <strong className="ref-code">{retrievedBooking.bookingReference}</strong>
                </div>

                <div className="detail-item">
                  <span>Airline PNR</span>
                  <strong>{retrievedBooking.airlinePnr ? retrievedBooking.airlinePnr : 'Not yet assigned'}</strong>
                </div>

                <div className="detail-item">
                  <span>Airline & Flight</span>
                  <strong>{retrievedBooking.flight?.airline} ({retrievedBooking.flight?.flightNumber})</strong>
                </div>

                <div className="detail-item">
                  <span>Departure Schedule</span>
                  <strong>{retrievedBooking.flight?.departureTime}</strong>
                </div>

                <div className="detail-item">
                  <span>Primary Passenger</span>
                  <strong>{retrievedBooking.passengerName}</strong>
                </div>

                <div className="detail-item">
                  <span>Contact Email</span>
                  <strong>{retrievedBooking.email}</strong>
                </div>

                <div className="detail-item">
                  <span>Total Fare</span>
                  <strong>{retrievedBooking.currency === 'NGN' ? '₦' : '$'}{Number(retrievedBooking.price || 0).toLocaleString()}</strong>
                </div>

                <div className="detail-item">
                  <span>Request Created</span>
                  <strong>{new Date(retrievedBooking.createdAt).toLocaleDateString()}</strong>
                </div>
              </div>

              <div className="status-note-box">
                ℹ️ {retrievedBooking.statusMessage || 'Our operations desk is processing ticket issuance with the carrier.'}
              </div>

              <div className="booking-card-actions">
                <button type="button" className="btn-secondary" onClick={() => window.print()}>
                  🖨️ Print Booking Detail
                </button>
                <button type="button" className="btn-primary" onClick={() => navigate('/confirmation', { state: { booking: retrievedBooking } })}>
                  View Full Summary →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default ManageBooking;
