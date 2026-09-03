import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { createBooking } from '../services/api';
import { buildPassengerList, normalizePaymentMethod } from '../utils/bookingHelpers';
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
    contactName: '',
    email: '',
    phone: '',
    country: 'Nigeria',
    countryCode: '+234',
  });

  const [extras, setExtras] = useState({
    seatPreference: 'Any available seat',
    mealPreference: 'Standard meal',
    specialAssistance: 'None',
  });

  const [paymentMethod, setPaymentMethod] = useState('pay_on_site');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const targetCount = Number(searchParams?.adults || 1) + Number(searchParams?.children || 0) + Number(searchParams?.infants || 0);
  const [prevCount, setPrevCount] = useState(targetCount);
  if (targetCount !== prevCount) {
    setPrevCount(targetCount);
    setPassengers(
      buildPassengerList({
        adults: Number(searchParams?.adults || 1),
        children: Number(searchParams?.children || 0),
        infants: Number(searchParams?.infants || 0),
      })
    );
  }

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
      return !passenger.firstName?.trim() || !passenger.lastName?.trim() || (passenger.type === 'Adult' && !passenger.dateOfBirth);
    });

    if (firstIncomplete >= 0) {
      const passenger = passengers[firstIncomplete];
      const label = passenger.roleLabel || `${passenger.type} ${firstIncomplete + 1}`;
      setErrorMessage(`Please fill out ${label}'s form completely.`);
      return;
    }

    if (!contactInfo.email.trim() || !contactInfo.phone.trim()) {
      setErrorMessage('Please complete the Booking contact details (Email and Phone).');
      return;
    }

    setCurrentStep(3);
  };

  const handleSubmitBookingRequest = async (e) => {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMessage('Please accept SharpzyTravels booking terms & conditions before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);
    const primaryPassengerName = contactInfo.contactName.trim() || (
      passengers.length > 0
        ? `${(passengers[0].firstName || '').trim()} ${(passengers[0].lastName || '').trim()}`.trim()
        : 'Passenger'
    );

    try {
      const response = await createBooking({
        flight: selectedFlight,
        passengerName: primaryPassengerName,
        email: contactInfo.email.trim(),
        phone: `${contactInfo.countryCode} ${contactInfo.phone.trim()}`,
        passengers,
        contactInfo,
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
              <span className="step-label">Passenger Details</span>
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
                      <span className="flight-num-tag">Flight {selectedFlight.flightNumber || 'Direct'}</span>
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
                  </div>

                  <div className="step-actions">
                    <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
                      ← Back to Results
                    </button>
                    <button type="button" className="btn-primary" onClick={() => setCurrentStep(2)}>
                      Proceed to Passenger Details →
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: Separate Passenger Forms & Booking Contact ──── */}
              {currentStep === 2 && (
                <form onSubmit={handleNextFromPassengers} className="step-card">
                  <div className="step-card-header">
                    <h2>Step 2: Passenger Details & Contact Information</h2>
                    <p>Each passenger must have their own separate form. Fill details as on official ID.</p>
                  </div>

                  {/* SEPARATE FORM FOR EACH PASSENGER */}
                  <div className="passenger-forms-container">
                    <h3 className="sub-heading">Passenger details</h3>
                    {passengers.map((p, idx) => (
                      <fieldset key={`${p.type}-${p.roleLabel}-${idx}`} className="passenger-fieldset">
                        <legend>
                          Form for {p.roleLabel || `Passenger ${idx + 1}`} ({p.type})
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
                            <label>First name *</label>
                            <input
                              type="text"
                              placeholder={p.type === 'Adult' ? 'e.g. Chukwuma' : 'e.g. Daniel'}
                              value={p.firstName}
                              onChange={(e) => updatePassenger(idx, 'firstName', e.target.value)}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label>Last name *</label>
                            <input
                              type="text"
                              placeholder={p.type === 'Adult' ? 'e.g. Adebayo' : 'e.g. Adebayo'}
                              value={p.lastName}
                              onChange={(e) => updatePassenger(idx, 'lastName', e.target.value)}
                              required
                            />
                          </div>
                        </div>

                        <div className="form-grid-3">
                          <div className="form-group">
                            <label>Date of birth {p.type === 'Adult' ? '*' : ''}</label>
                            <input
                              type="date"
                              value={p.dateOfBirth}
                              onChange={(e) => updatePassenger(idx, 'dateOfBirth', e.target.value)}
                              required={p.type === 'Adult'}
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
                  </div>

                  {/* SEPARATE BOOKING CONTACT FORM */}
                  <fieldset className="passenger-fieldset contact-fieldset">
                    <legend>Booking contact</legend>
                    <p className="contact-subtitle">We will send your SharpzyTravels booking confirmation and updates here.</p>
                    
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label>Contact name</label>
                        <input
                          type="text"
                          placeholder="e.g. Chukwuma Adebayo"
                          value={contactInfo.contactName}
                          onChange={(e) => setContactInfo((prev) => ({ ...prev, contactName: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label>Country of residence</label>
                        <input
                          type="text"
                          placeholder="e.g. Nigeria"
                          value={contactInfo.country}
                          onChange={(e) => setContactInfo((prev) => ({ ...prev, country: e.target.value }))}
                        />
                      </div>

                      <div className="form-group">
                        <label>Email address *</label>
                        <input
                          type="email"
                          placeholder="your.email@domain.com"
                          value={contactInfo.email}
                          onChange={(e) => setContactInfo((prev) => ({ ...prev, email: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label>Phone number *</label>
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
                    <p>Select optional seat and meal preferences for your flight.</p>
                  </div>

                  <div className="extras-grid">
                    <div className="extra-item-card">
                      <div className="extra-icon">💺</div>
                      <div className="extra-details">
                        <h4>Seat Preference</h4>
                        <p>Request window, aisle, or front row seating.</p>
                        <select
                          value={extras.seatPreference}
                          onChange={(e) => setExtras((prev) => ({ ...prev, seatPreference: e.target.value }))}
                        >
                          <option>Any available seat</option>
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
                        <p>Inflight catering preferences.</p>
                        <select
                          value={extras.mealPreference}
                          onChange={(e) => setExtras((prev) => ({ ...prev, mealPreference: e.target.value }))}
                        >
                          <option>Standard meal</option>
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
                        <p>Notify airline of wheelchair requirements.</p>
                        <select
                          value={extras.specialAssistance}
                          onChange={(e) => setExtras((prev) => ({ ...prev, specialAssistance: e.target.value }))}
                        >
                          <option>None</option>
                          <option>Wheelchair assistance</option>
                          <option>Priority boarding request</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="step-actions">
                    <button type="button" className="btn-secondary" onClick={() => setCurrentStep(2)}>
                      ← Back to Passenger Details
                    </button>
                    <button type="button" className="btn-primary" onClick={() => setCurrentStep(4)}>
                      Proceed to Review →
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 4: Review Booking ─────────────────────────────── */}
              {currentStep === 4 && (
                <div className="step-card">
                  <div className="step-card-header">
                    <h2>Step 4: Review Your Booking</h2>
                    <p>Verify all passenger and contact information before submitting.</p>
                  </div>

                  <div className="review-sections">
                    {/* Flight Summary */}
                    <div className="review-section">
                      <h3>Flight Itinerary</h3>
                      <div className="review-data-row">
                        <span>Airline:</span>
                        <strong>{selectedFlight.airline} ({selectedFlight.flightNumber || 'Direct'})</strong>
                      </div>
                      <div className="review-data-row">
                        <span>Route:</span>
                        <strong>{selectedFlight.origin} → {selectedFlight.destination}</strong>
                      </div>
                      <div className="review-data-row">
                        <span>Schedule:</span>
                        <strong>{selectedFlight.departureTime} – {selectedFlight.arrivalTime}</strong>
                      </div>
                    </div>

                    {/* Passenger Forms Review */}
                    <div className="review-section">
                      <h3>Passenger Forms ({passengers.length})</h3>
                      {passengers.map((p, idx) => (
                        <div className="review-data-row" key={`${p.type}-${p.roleLabel}-${idx}`}>
                          <span>{p.roleLabel || `Passenger ${idx + 1}`}:</span>
                          <strong>{p.title} {p.firstName} {p.lastName} ({p.type})</strong>
                        </div>
                      ))}
                    </div>

                    {/* Booking Contact Review */}
                    <div className="review-section">
                      <h3>Booking Contact</h3>
                      <div className="review-data-row">
                        <span>Email:</span>
                        <strong>{contactInfo.email}</strong>
                      </div>
                      <div className="review-data-row">
                        <span>Phone:</span>
                        <strong>{contactInfo.countryCode} {contactInfo.phone}</strong>
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
                      I confirm that passenger names match official IDs and agree to SharpzyTravels booking terms.
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

              {/* ── STEP 5: Payment Options (No Cards) ───────────────── */}
              {currentStep === 5 && (
                <form onSubmit={handleSubmitBookingRequest} className="step-card">
                  <div className="step-card-header">
                    <h2>Step 5: Select Payment Method</h2>
                    <p>Select your payment option to complete your SharpzyTravels booking request.</p>
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
                        <strong>PAY ON SITE</strong>
                        <span>Pay directly according to SharpzyTravels's instructions.</span>
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
                        <strong>DIRECT BANK TRANSFER</strong>
                        <span>Complete payment directly via SharpzyTravels bank transfer details.</span>
                      </div>
                    </label>
                  </div>

                  {errorMessage && <p className="step-error">{errorMessage}</p>}

                  <div className="step-actions">
                    <button type="button" className="btn-secondary" onClick={() => setCurrentStep(4)}>
                      ← Back to Review
                    </button>
                    <button type="submit" className="btn-success" disabled={isSubmitting}>
                      {isSubmitting ? 'Submitting SharpzyTravels Booking...' : 'Submit Booking Request →'}
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

                <div className="sidebar-divider"></div>

                <div className="sidebar-total-row">
                  <span>Total Amount</span>
                  <strong className="total-amount">{formattedPrice}</strong>
                </div>

                <div className="sidebar-features">
                  <span>🔒 SharpzyTravels Secure Booking</span>
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
