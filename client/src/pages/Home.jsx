import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SearchLoadingOverlay from '../components/SearchLoadingOverlay';
import { searchFlights } from '../services/api';
import '../styles/home.css';

const AIRPORTS = [
  { city: 'Lagos', name: 'Murtala Muhammed International Airport', code: 'LOS' },
  { city: 'Abuja', name: 'Nnamdi Azikiwe International Airport', code: 'ABV' },
  { city: 'Uyo', name: 'Victor Attah International Airport', code: 'QUO' },
  { city: 'Enugu', name: 'Akanu Ibiam International Airport', code: 'ENU' },
  { city: 'Calabar', name: 'Margaret Ekpo International Airport', code: 'CBQ' },
  { city: 'Port Harcourt', name: 'Port Harcourt International Airport', code: 'PHC' },
  { city: 'Owerri', name: 'Sam Mbakwe Airport', code: 'QOW' },
  { city: 'Benin City', name: 'Benin Airport', code: 'BNI' },
];

function Home() {
  const navigate = useNavigate();

  // ── State ─────────────────────────────────────────────────────────────────
  const [trip, setTrip] = useState('oneway'); // 'oneway' | 'return'
  const [fromQuery, setFromQuery] = useState('Lagos (LOS)');
  const [fromCode, setFromCode] = useState('LOS');
  const [fromSuggestionsOpen, setFromSuggestionsOpen] = useState(false);

  const [toQuery, setToQuery] = useState('Abuja (ABV)');
  const [toCode, setToCode] = useState('ABV');
  const [toSuggestionsOpen, setToSuggestionsOpen] = useState(false);

  const [departureDate, setDepartureDate] = useState(() => {
    return new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10);
  });
  const [returnDate, setReturnDate] = useState('');

  // Passengers & Class
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabin, setCabin] = useState('Economy');
  const [passengerPopoverOpen, setPassengerPopoverOpen] = useState(false);


  // Loading and Toast state
  const [isSearching, setIsSearching] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const fromRef = useRef(null);
  const toRef = useRef(null);

  // Show Toast helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  // Close airport suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (fromRef.current && !fromRef.current.contains(e.target)) {
        setFromSuggestionsOpen(false);
      }
      if (toRef.current && !toRef.current.contains(e.target)) {
        setToSuggestionsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Filter airports for autocomplete
  const getMatches = (q) => {
    const query = (q || '').trim().toLowerCase();
    return AIRPORTS.filter(
      (a) =>
        !query ||
        a.city.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query) ||
        a.code.toLowerCase().includes(query)
    ).slice(0, 6);
  };

  // Swap airports
  const handleSwap = () => {
    const tempQ = fromQuery;
    const tempC = fromCode;
    setFromQuery(toQuery);
    setFromCode(toCode);
    setToQuery(tempQ);
    setToCode(tempC);
  };

  // Counter change handler
  const handleCounter = (type, dir) => {
    if (type === 'adults') {
      const next = Math.max(1, adults + dir);
      if (infants > next) {
        showToast('Infants cannot exceed adults.');
        return;
      }
      setAdults(next);
    } else if (type === 'children') {
      setChildren(Math.max(0, children + dir));
    } else if (type === 'infants') {
      const next = Math.max(0, infants + dir);
      if (next > adults) {
        showToast('Infants cannot exceed adults.');
        return;
      }
      setInfants(next);
    }
  };

  // Format passenger summary
  const getPassengerSummary = () => {
    const parts = [`${adults} Adult${adults !== 1 ? 's' : ''}`];
    if (children > 0) parts.push(`${children} Child${children !== 1 ? 'ren' : ''}`);
    if (infants > 0) parts.push(`${infants} Infant${infants !== 1 ? 's' : ''}`);
    return `${parts.join(', ')}, ${cabin}`;
  };

  // Form submit search handler — orchestrates the search transaction
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!fromCode || !toCode) {
      showToast('Please select your departure and destination airports.');
      return;
    }
    if (fromCode === toCode) {
      showToast('Departure and destination cannot be the same.');
      return;
    }
    if (!departureDate) {
      showToast('Please select a valid departure date.');
      return;
    }

    const originCode = fromCode;
    const destCode = toCode;
    const depDate = departureDate;
    const retDate = trip === 'return' ? returnDate : undefined;

    const searchPayload = {
      tripType: trip === 'oneway' ? 'oneWay' : 'roundTrip',
      origin: originCode,
      destination: destCode,
      departureDate: depDate,
      returnDate: retDate,
      adults,
      children,
      infants,
      travelClass: cabin,
    };

    const searchStateData = {
      origin: originCode,
      originCode,
      destination: destCode,
      destinationCode: destCode,
      departureDate: depDate,
      returnDate: retDate || '',
      adults,
      children,
      infants,
      cabinClass: cabin,
      tripType: searchPayload.tripType,
    };

    setIsSearching(true);

    try {
      // Air Peace is now a normal provider — search all providers in a single call.
      const res = await searchFlights(searchPayload);
      const flights = res?.flights || [];
      setIsSearching(false);
      navigate('/results', {
        state: {
          flights,
          search: searchStateData,
        },
      });
    } catch (err) {
      console.warn('[Sharpzy] Flight search error:', err);
      setIsSearching(false);
      showToast('We could not complete the search. Please try again.');
    }
  };

  return (
    <div className="home">
      <Navbar />

      <main>
        {/* Hero Section */}
        <section className="hero" id="search">
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <p className="eyebrow">YOUR JOURNEY STARTS HERE</p>
            <h1>
              Book flights.<br />
              <span>Travel your way.</span>
            </h1>
            <p className="hero-copy">
              Search flights, compare options and send your booking directly to the SharpzyTravels team.
            </p>

            <div className="search-shell">
              {/* Trip Tabs */}
              <div className="trip-tabs" role="tablist">
                <button
                  type="button"
                  className={`trip-tab ${trip === 'oneway' ? 'active' : ''}`}
                  onClick={() => setTrip('oneway')}
                >
                  One way
                </button>
                <button
                  type="button"
                  className={`trip-tab ${trip === 'return' ? 'active' : ''}`}
                  onClick={() => setTrip('return')}
                >
                  Return
                </button>
              </div>

              {/* Standard Search Form */}
              <form id="flightForm" className="flight-form" onSubmit={handleFormSubmit}>
                  {/* From Field */}
                  <div className="field airport-field" id="fromField" ref={fromRef}>
                    <label htmlFor="fromInput">Where from?</label>
                    <input
                      id="fromInput"
                      type="text"
                      autoComplete="off"
                      placeholder="City or airport"
                      value={fromQuery}
                      onChange={(e) => {
                        setFromQuery(e.target.value);
                        setFromSuggestionsOpen(true);
                      }}
                      onFocus={() => setFromSuggestionsOpen(true)}
                      required
                    />
                    <input type="hidden" id="fromCode" value={fromCode} />
                    {fromSuggestionsOpen && (
                      <div className="suggestions" style={{ display: 'block' }}>
                        {getMatches(fromQuery).map((a) => (
                          <div
                            key={a.code}
                            className="suggestion"
                            onClick={() => {
                              setFromQuery(`${a.city} (${a.code})`);
                              setFromCode(a.code);
                              setFromSuggestionsOpen(false);
                            }}
                          >
                            <b>{a.city} ({a.code})</b>
                            <span>{a.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Swap Button */}
                  <button
                    type="button"
                    className="swap-btn"
                    id="swapBtn"
                    aria-label="Swap airports"
                    onClick={handleSwap}
                  >
                    ↕
                  </button>

                  {/* To Field */}
                  <div className="field airport-field" id="toField" ref={toRef}>
                    <label htmlFor="toInput">Where to?</label>
                    <input
                      id="toInput"
                      type="text"
                      autoComplete="off"
                      placeholder="City or airport"
                      value={toQuery}
                      onChange={(e) => {
                        setToQuery(e.target.value);
                        setToSuggestionsOpen(true);
                      }}
                      onFocus={() => setToSuggestionsOpen(true)}
                      required
                    />
                    <input type="hidden" id="toCode" value={toCode} />
                    {toSuggestionsOpen && (
                      <div className="suggestions" style={{ display: 'block' }}>
                        {getMatches(toQuery).map((a) => (
                          <div
                            key={a.code}
                            className="suggestion"
                            onClick={() => {
                              setToQuery(`${a.city} (${a.code})`);
                              setToCode(a.code);
                              setToSuggestionsOpen(false);
                            }}
                          >
                            <b>{a.city} ({a.code})</b>
                            <span>{a.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Departure Date */}
                  <div className="field date-field">
                    <label htmlFor="departureDate">Departure</label>
                    <input
                      type="date"
                      id="departureDate"
                      min={today}
                      value={departureDate}
                      onChange={(e) => {
                        setDepartureDate(e.target.value);
                        if (returnDate && returnDate < e.target.value) {
                          setReturnDate(e.target.value);
                        }
                      }}
                      required
                    />
                  </div>

                  {/* Return Date */}
                  {trip === 'return' && (
                    <div className="field date-field return-date" id="returnWrap">
                      <label htmlFor="returnDate">Return</label>
                      <input
                        type="date"
                        id="returnDate"
                        min={departureDate || today}
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        required={trip === 'return'}
                      />
                    </div>
                  )}

                  {/* Passengers & Class Trigger */}
                  <button
                    type="button"
                    className="field passenger-field"
                    id="passengerBtn"
                    onClick={() => setPassengerPopoverOpen((v) => !v)}
                  >
                    <span>
                      <small>Passengers & class</small>
                      <strong id="passengerSummary">{getPassengerSummary()}</strong>
                    </span>
                    <span>⌄</span>
                  </button>

                  {/* Search Submit Button */}
                  <button className="search-btn" type="submit" disabled={isSearching}>
                    {isSearching ? 'Searching...' : 'Search flights'} <span>→</span>
                  </button>
                </form>

              {/* Passenger Popover */}
              <div className={`passenger-popover ${passengerPopoverOpen ? 'open' : ''}`} id="passengerPopover">
                <div className="popover-head">
                  <strong>Passengers</strong>
                  <button type="button" id="closePassengers" onClick={() => setPassengerPopoverOpen(false)}>
                    ×
                  </button>
                </div>

                <div className="counter-row">
                  <div>
                    <strong>Adults</strong>
                    <small>12+</small>
                  </div>
                  <div className="counter">
                    <button type="button" onClick={() => handleCounter('adults', -1)}>−</button>
                    <b id="adultCount">{adults}</b>
                    <button type="button" onClick={() => handleCounter('adults', 1)}>+</button>
                  </div>
                </div>

                <div className="counter-row">
                  <div>
                    <strong>Children</strong>
                    <small>2–11</small>
                  </div>
                  <div className="counter">
                    <button type="button" onClick={() => handleCounter('children', -1)}>−</button>
                    <b id="childCount">{children}</b>
                    <button type="button" onClick={() => handleCounter('children', 1)}>+</button>
                  </div>
                </div>

                <div className="counter-row">
                  <div>
                    <strong>Infants</strong>
                    <small>0–1</small>
                  </div>
                  <div className="counter">
                    <button type="button" onClick={() => handleCounter('infants', -1)}>−</button>
                    <b id="infantCount">{infants}</b>
                    <button type="button" onClick={() => handleCounter('infants', 1)}>+</button>
                  </div>
                </div>

                <label className="class-select">
                  Cabin class
                  <select id="cabin" value={cabin} onChange={(e) => setCabin(e.target.value)}>
                    <option>Economy</option>
                    <option>Premium Economy</option>
                    <option>Business</option>
                    <option>First</option>
                  </select>
                </label>

                <button type="button" className="done-btn" id="donePassengers" onClick={() => setPassengerPopoverOpen(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Strip */}
        <section className="trust-strip">
          <div>
            <strong>Simple booking</strong>
            <span>Clear flight choices</span>
          </div>
          <div>
            <strong>Human support</strong>
            <span>Your booking goes to SharpzyTravels</span>
          </div>
          <div>
            <strong>Flexible payment</strong>
            <span>Pay on site or bank transfer</span>
          </div>
        </section>

        {/* Feature Section */}
        <section className="feature-section">
          <div className="section-heading">
            <p className="eyebrow">SHARPZYTRAVELS</p>
            <h2>Everything you need to plan your trip.</h2>
          </div>
          <div className="feature-grid">
            <article>
              <div className="icon">✈</div>
              <h3>Search flights</h3>
              <p>Find available flights through the existing SharpzyTravels search system.</p>
            </article>
            <article>
              <div className="icon">✓</div>
              <h3>Book with confidence</h3>
              <p>Enter passenger details and submit your booking to the SharpzyTravels team.</p>
            </article>
            <article>
              <div className="icon">☎</div>
              <h3>Real support</h3>
              <p>Get help when you need it, from booking through your journey.</p>
            </article>
          </div>
        </section>

        {/* Popular Destinations */}
        <section className="destinations" id="destinations">
          <div className="section-heading">
            <p className="eyebrow">EXPLORE</p>
            <h2>Popular destinations</h2>
          </div>
          <div className="destination-grid">
            <article
              className="destination-card lagos"
              onClick={() => {
                setFromQuery('Abuja (ABV)');
                setFromCode('ABV');
                setToQuery('Lagos (LOS)');
                setToCode('LOS');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Lagos</span>
              <small>LOS</small>
            </article>
            <article
              className="destination-card abuja"
              onClick={() => {
                setFromQuery('Lagos (LOS)');
                setFromCode('LOS');
                setToQuery('Abuja (ABV)');
                setToCode('ABV');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Abuja</span>
              <small>ABV</small>
            </article>
            <article
              className="destination-card uyo"
              onClick={() => {
                setFromQuery('Lagos (LOS)');
                setFromCode('LOS');
                setToQuery('Uyo (QUO)');
                setToCode('QUO');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Uyo</span>
              <small>QUO</small>
            </article>
            <article
              className="destination-card enugu"
              onClick={() => {
                setFromQuery('Abuja (ABV)');
                setFromCode('ABV');
                setToQuery('Enugu (ENU)');
                setToCode('ENU');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ cursor: 'pointer' }}
            >
              <span>Enugu</span>
              <small>ENU</small>
            </article>
          </div>
        </section>

        {/* Airlines We Work With */}
        <section className="airlines" id="airlines">
          <div className="section-heading">
            <p className="eyebrow">AIRLINES</p>
            <h2>Airlines we work with</h2>
          </div>
          <div className="airline-row">
            <div className="airline-pill">AIR PEACE</div>
            <div className="airline-pill">IBOM AIR</div>
            <div className="airline-pill">AERO</div>
            <div className="airline-pill">VALUEJET</div>
            <div className="airline-pill">ENUGU AIR</div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section className="faq" id="help">
          <div className="section-heading">
            <p className="eyebrow">HELP</p>
            <h2>Frequently asked questions</h2>
          </div>
          <details>
            <summary>How does SharpzyTravels booking work?</summary>
            <p>
              Search for a flight, select an option, enter passenger details and submit the booking. The SharpzyTravels team handles the next steps.
            </p>
          </details>
          <details>
            <summary>How can I pay?</summary>
            <p>SharpzyTravels currently supports pay on site and direct bank transfer.</p>
          </details>
          <details>
            <summary>Where can I find my booking?</summary>
            <p>Use the Manage Booking area with your SharpzyTravels booking reference.</p>
          </details>
        </section>
      </main>

      <Footer />

      {/* Toast Notification */}
      <div className={`toast ${toastMessage ? 'show' : ''}`} id="toast">
        {toastMessage}
      </div>

      {/* Standard Search Loading Overlay */}
      <SearchLoadingOverlay isVisible={isSearching} sessionState={null} />
    </div>
  );
}

export default Home;
