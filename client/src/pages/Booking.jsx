import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { createBooking } from '../services/api';
import { buildPassengerList, normalizePaymentMethod, getPaymentLabel } from '../utils/bookingHelpers';
import '../styles/booking.css';

function Booking() {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedFlight = location.state?.flight;
  const searchParams = location.state?.search;

  const totalPassengerCount = useMemo(() => {
    const adults = Number(searchParams?.adults || 1);
    const children = Number(searchParams?.children || 0);
    const infants = Number(searchParams?.infants || 0);
    return adults + children + infants;
  }, [searchParams]);

  const [currentStep, setCurrentStep] = useState(1);
  const [passengers, setPassengers] = useState(() => buildPassengerList({
    adults: Number(searchParams?.adults || 1),
    children: Number(searchParams?.children || 0),
    infants: Number(searchParams?.infants || 0),
  }));

  const [contactInfo, setContactInfo] = useState({
    email: '',
    phone: '',
    countryCode: '+234',
  });

  const [extras, setExtras] = useState({
    seatPreference: 'Any seat',
    mealPreference: 'Standard meal',
    specialAssistance: 'None',
  });

  const [paymentMethod, setPaymentMethod] = useState('pay_on_site');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const nextPassengers = buildPassengerList({
      adults: Number(searchParams?.adults || 1),
      children: Number(searchParams?.children || 0),
      infants: Number(searchParams?.infants || 0),
    });

    setPassengers((prev) => {
      if (prev.length === nextPassengers.length) {
        return prev;
      }
      return nextPassengers;
    });
  }, [searchParams]);

  const updatePassenger = (index, field, value) => {
    setPassengers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleNextFromPassengers = (e) => {
    e.preventDefault();
    setErrorMessage('');

    const firstIncomplete = passengers.findIndex((passenger) => {
      const requiredType = passenger.type === 'Child' || passenger.type === 'Infant' ? 'firstName' : 'firstName';
      return !passenger.firstName?.trim() || !passenger.lastName?.trim() || (passenger.type === 'Adult' && !passenger.dateOfBirth);
    });

    if (firstIncomplete >= 0) {
      const passenger = passengers[firstIncomplete];
      const label = passenger.roleLabel || `${passenger.type} ${firstIncomplete + 1}`;
      setErrorMessage(`Please complete ${label}'s information.`);
      return;
    }

    if (!contactInfo.email.trim() || !contactInfo.phone.trim()) {
      setErrorMessage('Please fill in the contact email and phone number.');
      return;
    }

    setCurrentStep(3);
  };

  const handleSubmitBookingRequest = async (e) => {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMessage('Please accept the booking terms & conditions before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const primaryPassengerName = passengers.length > 0
      ? `${(passengers[0].firstName || '').trim()} ${(passengers[0].lastName || '').trim()}`.trim()
      : 'Passenger';

    try {
      const response = await createBooking({
        flight: selectedFlight,
        passengerName: primaryPassengerName,
        email: contactInfo.email.trim(),
        phone: `${contactInfo.countryCode} ${contactInfo.phone.trim()}`,
        passengers,
        extras,
        paymentMethod: normalizedPaymentMethod,
        price: selectedFlight.price,
        currency: selectedFlight.currency || 'NGN',
      });

      navigate('/confirmation', {
        state: {
          booking: response.booking,
        },
      });
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Booking submission failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!selectedFlight) {
    return (
      <div className="booking-wrapper">
        <Navbar />
        <main className="booking-page empty-booking">
          <div className="no-flight-card">
            <h2>No flight selected</h2>
            <p>Please search for a flight and click "Select" to start your booking.</p>
            <button className="primary-btn" onClick={() => navigate('/')}>
              Search Flights
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const currencySymbol = selectedFlight.currency === 'NGN' ? '₦' : (selectedFlight.currency === 'USD' ? '$' : `${selectedFlight.currency} `);
  const formattedPrice = `${currencySymbol}${Number(selectedFlight.price || 0).toLocaleString()}`;

  return (
    <div className="booking-wrapper">
      <Navbar />

      <main className="booking-page">
        {/* ── Progress Indicator Bar ──────────────────────────────────── */}
        <section className="booking-progress-bar">
          <div className="progress-inner">
            <div className={`step-item ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
              <span className="step-num">{currentStep > 1 ? '✓' : '1'}</span>
              <span className="step-label">Flight</span>
            </div>
            <div className="step-divider"></div>

            <div className={`step-item ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
              <span className="step-num">{currentStep > 2 ? '✓' : '2'}</span>
              <span className="step-label">Passengers</span>
            </div>
            <div className="step-divider"></div>

            <div className={`step-item ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
              <span className="step-num">{currentStep > 3 ? '✓' : '3'}</span>
              <span className="step-label">Extras</span>
            </div>
            <div className="step-divider"></div>

            <div className={`step-item ${currentStep >= 4 ? 'active' : ''} ${currentStep > 4 ? 'completed' : ''}`}>
              <span className="step-num">{currentStep > 4 ? '✓' : '4'}</span>
              <span className="step-label">Review</span>
            </div>
            <div className="step-divider"></div>

            <div className={`step-item ${currentStep >= 5 ? 'active' : ''}`}>
              <span className="step-num">5</span>
              <span className="step-label">Payment</span>
            </div>
          </div>
        </section>

        <div className="booking-container">
          <div className="booking-layout">
            {/* ── Left Step Form Area ─────────────────────────────────── */}
            <div className="booking-step-content">
              {/* ── STEP 1: Flight Selection Summary ───────────────────── */}
              {currentStep === 1 && (
                <div className="step-card">
                  <div className="step-card-header">
                    <h2>Step 1: Confirm Selected Flight</h2>
                    <p>Review itinerary details before entering passenger info.</p>
                  </div>

                  <div className="selected-flight-summary-box">
                    <div className="flight-box-header">
                      <span className="airline-tag">{selectedFlight.airline}</span>
                      <span className="flight-num-tag">Flight {selectedFlight.flightNumber}</span>
                    </div>

                    <div className="route-box">
                      <div className="route-endpoint">
                        <strong>{selectedFlight.origin}</strong>
                        <span>{selectedFlight.departureTime}</span>
                      </div>
                      <div className="route-mid">
                        <span>{selectedFlight.duration || 'Direct'}</span>
                        <div className="route-bar"></div>
                        <span>{selectedFlight.stops === 0 ? 'Non-stop' : `${selectedFlight.stops} Stop`}</span>
                      </div>
                      <div className="route-endpoint">
                        <strong>{selectedFlight.destination}</strong>
                        <span>{selectedFlight.arrivalTime}</span>
                      </div>
                    </div>

                    <div className="inclusions-mini">
                      <span>✓ 1 x 20kg Checked Luggage</span>
                      <span>✓ 1 x 7kg Carry-on Hand Bag</span>
                    </div>
                  </div>

                  <div className="step-actions">
                    <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                      ← Back to Results
                    </button>
                    <button type="button" className="btn-primary" onClick={() => setCurrentStep(2)}>
                      Proceed to Passengers →
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Passenger Details ─────────────────────────── */}
              {currentStep === 2 && (
                <form onSubmit={handleNextFromPassengers} className="step-card">
                  <div className="step-card-header">
                    <h2>Step 2: Passenger & Contact Information</h2>
                    <p>Enter details exactly as they appear on your government-issued ID.</p>
                  </div>

                  {passengers.map((p, idx) => (
                    <fieldset key={`${p.type}-${p.roleLabel}-${idx}`} className="passenger-fieldset">
                      <legend>
                        {p.roleLabel || `Passenger ${idx + 1}`} · {p.type}
                      </legend>

                      <div className="form-grid-3">
                        <div className="form-group">
                          <label>Title *</label>
                          <select value={p.title} onChange={(e) => updatePassenger(idx, 'title', e.target.value)}>
                            <option>Mr</option>
                            <option>Mrs</option>
                            <option>Ms</option>
                            <option>Master</option>
                            <option>Miss</option>
                            <option>Dr</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>First Name *</label>
                          <input
                            type="text"
                            placeholder={p.type === 'Adult' ? 'e.g. Chukwuma' : 'e.g. Daniel'}
                            value={p.firstName}
                            onChange={(e) => updatePassenger(idx, 'firstName', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Last Name *</label>
                          <input
                            type="text"
                            placeholder={p.type === 'Adult' ? 'e.g. Adebayo' : 'e.g. Adebayo'}
                            value={p.lastName}
                            onChange={(e) => updatePassenger(idx, 'lastName', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="form-grid-3">
                        <div className="form-group">
                          <label>Date of Birth</label>
                          <input
                            type="date"
                            value={p.dateOfBirth}
                            onChange={(e) => updatePassenger(idx, 'dateOfBirth', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Gender</label>
                          <select value={p.gender} onChange={(e) => updatePassenger(idx, 'gender', e.target.value)}>
                            <option>Male</option>
                            <option>Female</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Nationality</label>
                          <input
                            type="text"
                            value={p.nationality}
                            onChange={(e) => updatePassenger(idx, 'nationality', e.target.value)}
                          />
                        </div>
                      </div>
                    </fieldset>
                  ))}

                  {/* Contact Details */}
                  <fieldset className="passenger-fieldset">
                    <legend>Contact Information for E-Ticket</legend>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label>Email Address *</label>
                        <input
                          type="email"
                          placeholder="your.email@domain.com"
                          value={contactInfo.email}
                          onChange={(e) => setContactInfo((prev) => ({ ...prev, email: e.target.value }))}
                          required
                        />
                        <span className="help-text">E-ticket confirmation will be sent here</span>
                      </div>

                      <div className="form-group">
                        <label>Phone Number *</label>
                        <div className="phone-input-wrap">
                          <select
                            value={contactInfo.countryCode}
                            onChange={(e) => setContactInfo((prev) => ({ ...prev, countryCode: e.target.value }))}
                          >
                            <option value="+234">🇳🇬 +234</option>
                            <option value="+44">🇬🇧 +44</option>
                            <option value="+1">🇺🇸 +1</option>
                          </select>
                          <input
                            type="tel"
                            placeholder="8012345678"
                            value={contactInfo.phone}
                            onChange={(e) => setContactInfo((prev) => ({ ...prev, phone: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </fieldset>

                  {errorMessage && <p className="step-error">{errorMessage}</p>}

                  <div className="step-actions">
                    <button type="button" className="btn-secondary" onClick={() => setCurrentStep(1)}>
                      ← Back to Flight
                    </button>
                    <button type="submit" className="btn-primary">
                      Proceed to Extras →
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 3: Extras & Preferences ──────────────────────── */}
              {currentStep === 3 && (
                <div className="step-card">
                  <div className="step-card-header">
                    <h2>Step 3: Travel Preferences & Extras</h2>
                    <p>Select preferences to be passed to the carrier desk upon ticket issuance.</p>
                  </div>

                  <div className="extras-grid">
                    <div className="extra-item-card">
                      <div className="extra-icon">💺</div>
                      <div className="extra-details">
                        <h4>Seat Preference</h4>
                        <p>Request window, aisle, or extra legroom positioning.</p>
                        <select
                          value={extras.seatPreference}
                          onChange={(e) => setExtras((prev) => ({ ...prev, seatPreference: e.target.value }))}
                        >
                          <option>Any available seat (Free)</option>
                          <option>Window seat request</option>
                          <option>Aisle seat request</option>
                          <option>Front row seat request</option>
                        </select>
                      </div>
                    </div>

                    <div className="extra-item-card">
                      <div className="extra-icon">🍽️</div>
                      <div className="extra-details">
                        <h4>Meal Preference</h4>
                        <p>Special meal requests for flights with inflight catering.</p>
                        <select
                          value={extras.mealPreference}
                          onChange={(e) => setExtras((prev) => ({ ...prev, mealPreference: e.target.value }))}
                        >
                          <option>Standard inflight catering</option>
                          <option>Halal meal request</option>
                          <option>Vegetarian meal request</option>
                          <option>Child meal request</option>
                        </select>
                      </div>
                    </div>

                    <div className="extra-item-card">
                      <div className="extra-icon">♿</div>
                      <div className="extra-details">
                        <h4>Special Assistance</h4>
                        <p>Notify carrier of wheelchair or mobility requirements.</p>
                        <select
                          value={extras.specialAssistance}
                          onChange={(e) => setExtras((prev) => ({ ...prev, specialAssistance: e.target.value }))}
                        >
                          <option>None required</option>
                          <option>Wheelchair assistance at origin/dest</option>
                          <option>Priority boarding request</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="extras-disclaimer">
                    ℹ️ Special requests are submitted directly to the airline operations team during ticketing verification.
                  </div>

                  <div className="step-actions">
                    <button type="button" className="btn-secondary" onClick={() => setCurrentStep(2)}>
                      ← Back to Passengers
                    </button>
                    <button type="button" className="btn-primary" onClick={() => setCurrentStep(4)}>
                      Proceed to Review →
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Review Trip ───────────────────────────────── */}
              {currentStep === 4 && (
                <div className="step-card">
                  <div className="step-card-header">
                    <h2>Step 4: Review Your Booking</h2>
                    <p>Verify all details before submitting your ticketing request.</p>
                  </div>

                  <div className="review-sections">
                    {/* Flight Summary */}
                    <div className="review-section">
                      <h3>Flight Itinerary</h3>
                      <div className="review-data-row">
                        <span>Carrier:</span>
                        <strong>{selectedFlight.airline} ({selectedFlight.flightNumber})</strong>
                      </div>
                      <div className="review-data-row">
                        <span>Route:</span>
                        <strong>{selectedFlight.origin} → {selectedFlight.destination}</strong>
                      </div>
                      <div className="review-data-row">
                        <span>Departure Time:</span>
                        <strong>{selectedFlight.departureTime}</strong>
                      </div>
                      <div className="review-data-row">
                        <span>Arrival Time:</span>
                        <strong>{selectedFlight.arrivalTime}</strong>
                      </div>
                    </div>

                    {/* Passenger Summary */}
                    <div className="review-section">
                      <h3>Passenger & Contact Details</h3>
                      {passengers.map((p, idx) => (
                        <div className="review-data-row" key={`${p.type}-${p.roleLabel}-${idx}`}>
                          <span>{p.roleLabel || `Passenger ${idx + 1}`}:</span>
                          <strong>{p.type} · {p.title} {p.firstName} {p.lastName}</strong>
                        </div>
                      ))}
                      <div className="review-data-row">
                        <span>Contact Email:</span>
                        <strong>{contactInfo.email}</strong>
                      </div>
                      <div className="review-data-row">
                        <span>Contact Phone:</span>
                        <strong>{contactInfo.countryCode} {contactInfo.phone}</strong>
                      </div>
                    </div>

                    {/* Extras */}
                    <div className="review-section">
                      <h3>Selected Preferences</h3>
                      <div className="review-data-row">
                        <span>Seat Request:</span>
                        <strong>{extras.seatPreference}</strong>
                      </div>
                      <div className="review-data-row">
                        <span>Meal Request:</span>
                        <strong>{extras.mealPreference}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Terms acceptance */}
                  <div className="terms-checkbox-wrap">
                    <label>
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                      />
                      I confirm that passenger names match official IDs and agree to airline fare rules.
                    </label>
                  </div>

                  {errorMessage && <p className="step-error">{errorMessage}</p>}

                  <div className="step-actions">
                    <button type="button" className="btn-secondary" onClick={() => setCurrentStep(3)}>
                      ← Back to Extras
                    </button>
                    <button type="button" className="btn-primary" onClick={() => setCurrentStep(5)}>
                      Proceed to Payment →
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 5: Payment / Booking Request Submission ─────── */}
              {currentStep === 5 && (
                <form onSubmit={handleSubmitBookingRequest} className="step-card">
                  <div className="step-card-header">
                    <h2>Step 5: Complete Booking Request</h2>
                    <p>Select your payment preference. Your booking reference will be generated immediately.</p>
                  </div>

                  <div className="payment-notice-box">
                    <div className="notice-icon">🛡️</div>
                    <div className="notice-text">
                      <h4>Verified Ticketing Desk</h4>
                      <p>Your booking request will be verified directly with the carrier desk. No unauthorized charges occur until seat availability is locked.</p>
                    </div>
                  </div>

                  <div className="payment-options">
                    <label className={`payment-option-card ${paymentMethod === 'pay_on_site' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'pay_on_site'}
                        onChange={() => setPaymentMethod('pay_on_site')}
                      />
                      <div className="option-info">
                        <strong>Pay on Site</strong>
                        <span>Pay directly at our office.</span>
                      </div>
                    </label>

                    <label className={`payment-option-card ${paymentMethod === 'bank_transfer' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="payment"
                        checked={paymentMethod === 'bank_transfer'}
                        onChange={() => setPaymentMethod('bank_transfer')}
                      />
                      <div className="option-info">
                        <strong>Direct Bank Transfer</strong>
                        <span>Complete payment using our bank transfer instructions.</span>
                      </div>
                    </label>
                  </div>

                  {errorMessage && <p className="step-error">{errorMessage}</p>}

                  <div className="step-actions">
                    <button type="button" className="btn-secondary" onClick={() => setCurrentStep(4)}>
                      ← Back to Review
                    </button>
                    <button type="submit" className="btn-success" disabled={isSubmitting}>
                      {isSubmitting ? 'Generating Booking Reference…' : 'Submit Booking Request →'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* ── Right Price & Trip Summary Sidebar ───────────────────── */}
            <aside className="booking-summary-sidebar">
              <div className="sticky-sidebar-card">
                <h3>Price Summary</h3>
                <div className="sidebar-airline-badge">
                  <span>{selectedFlight.airline}</span>
                </div>

                <div className="sidebar-price-row">
                  <span>Base Airfare ({totalPassengerCount} Pax)</span>
                  <span>{formattedPrice}</span>
                </div>
                <div className="sidebar-price-row">
                  <span>Taxes & Carrier Surcharges</span>
                  <span>Included</span>
                </div>
                <div className="sidebar-price-row">
                  <span>Booking Processing</span>
                  <span className="free-tag">FREE</span>
                </div>

                <div className="sidebar-divider"></div>

                <div className="sidebar-total-row">
                  <span>Total Amount</span>
                  <strong className="total-amount">{formattedPrice}</strong>
                </div>

                <div className="sidebar-features">
                  <span>🔒 256-bit Secure Request</span>
                  <span>⚡ Instant Booking Reference</span>
                  <span>📞 24/7 Operations Support</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Booking;
