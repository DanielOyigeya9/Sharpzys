import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TripTabs from '../components/TripTabs';
import PassengerSelect from '../components/PassengerSelect';
import Footer from '../components/Footer';
import AirportSelect from '../components/AirportSelect';
import SearchLoadingOverlay from '../components/SearchLoadingOverlay';
import { getAirlineLogo, FALLBACK_AIRLINE_LOGO } from '../utils/airlineLogos';
import { searchFlights } from '../services/api';
import '../styles/home.css';

// ─── Static data ──────────────────────────────────────────────────────────────

const popularRoutes = [
  { from: 'Lagos', to: 'Abuja',         code: 'LOS–ABV', desc: 'Nigeria\'s most-travelled corridor. Daily frequencies from multiple carriers.' },
  { from: 'Lagos', to: 'Port Harcourt', code: 'LOS–PHC', desc: 'Key business and leisure route in the south.' },
  { from: 'Lagos', to: 'Kano',          code: 'LOS–KAN', desc: 'Northern hub connecting commerce and culture.' },
  { from: 'Abuja', to: 'Enugu',         code: 'ABV–ENU', desc: 'Quick city-to-city connection in under an hour.' },
  { from: 'Enugu', to: 'Lagos',         code: 'ENU–LOS', desc: 'Regular domestic route with live fare checks.' },
  { from: 'Lagos', to: 'Owerri',        code: 'LOS–QOW', desc: 'Southeast gateway served by major carriers.' },
];

const airlines = [
  { name: 'Air Peace',        code: 'AP', color: '#16a34a' },
  { name: 'Ibom Air',         code: 'IA', color: '#0284c7' },
  { name: 'United Nigeria',   code: 'UN', color: '#7c3aed' },
  { name: 'Green Africa',     code: 'GA', color: '#15803d' },
  { name: 'Overland Airways', code: 'OA', color: '#b45309' },
];

const benefits = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
        <path d="M8 12l3 3 5-5"/>
      </svg>
    ),
    title: 'Best available prices',
    text: 'We query live provider inventory so you always see the most current fares.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    ),
    title: 'Secure booking flow',
    text: 'Your personal details and payment data are handled with end-to-end protection.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    ),
    title: 'Real-time results',
    text: 'Flight data is fetched live from the provider at the moment you search.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 2.18h3.09a2 2 0 012 1.72c.13 1.01.36 2 .7 2.95a2 2 0 01-.45 2.11L6.09 10a16 16 0 006.92 6.92l1.04-1.25a2 2 0 012.11-.45c.95.34 1.94.57 2.95.7a2 2 0 011.72 2.03z"/>
      </svg>
    ),
    title: '24/7 support',
    text: 'Our team is available around the clock to help before and after your trip.',
  },
];

const steps = [
  { n: '01', title: 'Search',  desc: 'Enter your route, dates, and passenger details.' },
  { n: '02', title: 'Compare', desc: 'Review live fares side-by-side from verified carriers.' },
  { n: '03', title: 'Book',    desc: 'Complete the secure booking form in under two minutes.' },
  { n: '04', title: 'Fly',     desc: 'Receive your itinerary and travel with confidence.' },
];

const destinations = [
  { name: 'Lagos',         tag: 'Commercial hub',  image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=80' },
  { name: 'Abuja',         tag: 'Federal capital',  image: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=900&q=80' },
  { name: 'Port Harcourt', tag: 'Oil city',          image: 'https://images.unsplash.com/photo-1518548419970-58e3b53332da?auto=format&fit=crop&w=900&q=80' },
  { name: 'Enugu',         tag: 'Coal city',          image: 'https://images.unsplash.com/photo-1499856871958-2b5f3caa3f4d?auto=format&fit=crop&w=900&q=80' },
  { name: 'Kano',          tag: 'Ancient city',       image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=80' },
  { name: 'Owerri',        tag: 'Southeast gateway',  image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80' },
];

const faqs = [
  {
    question: 'How does flight search work?',
    answer: 'Enter your origin, destination, travel date, and passenger count. SharpzyTravels queries the provider in real time and returns available fares.',
  },
  {
    question: 'Which routes does SharpzyTravels cover?',
    answer: 'We cover popular domestic routes across Nigeria including Lagos, Abuja, Port Harcourt, Kano, Enugu, Owerri, and more.',
  },
  {
    question: 'Is my booking information secure?',
    answer: 'Yes. Bookings are submitted through a secure flow and your data is never shared with third parties.',
  },
  {
    question: 'What if no flights are found?',
    answer: 'This can happen if the provider has no inventory for that date or route. Try a different date or nearby airport.',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

function Home() {
  const navigate = useNavigate();

  // ── Search form state ─────────────────────────────────────────────────────
  const [tripType, setTripType]           = useState('round');
  const [adults, setAdults]               = useState(1);
  const [children, setChildren]           = useState(0);
  const [infants, setInfants]             = useState(0);
  const [from, setFrom]                   = useState({ label: '', code: '' });
  const [to, setTo]                       = useState({ label: '', code: '' });
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate]       = useState('');
  const [travelClass, setTravelClass]     = useState('Economy');
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [isSearching, setIsSearching]     = useState(false);
  const [errorMessage, setErrorMessage]   = useState('');

  const handleSwapAirports = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!from.code || !to.code || !departureDate) {
      setErrorMessage('Please select departure and destination airports from suggestions and choose a departure date.');
      return;
    }
    if (from.code === to.code) {
      setErrorMessage('Origin and destination cannot be the same.');
      return;
    }

    setIsSearching(true);
    setErrorMessage('');

    try {
      const response = await searchFlights({
        origin:        from.code,
        destination:   to.code,
        departureDate,
        returnDate:    tripType === 'oneway' ? '' : returnDate,
        adults,
        children,
        infants,
        cabinClass:    travelClass,
        flexibleDates,
        tripType,
      });

      navigate('/results', {
        state: {
          search: {
            origin:       from.label,
            destination:  to.label,
            departureDate,
            returnDate:   tripType === 'oneway' ? '' : returnDate,
            adults,
            children,
            infants,
            cabinClass:   travelClass,
          },
          flights: response.flights || [],
        },
      });
    } catch (error) {
      const detail = error.response?.data?.message || 'Unable to search for flights right now. Please try again.';
      setErrorMessage(detail);
    } finally {
      setIsSearching(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="home">
      <Navbar />
      <SearchLoadingOverlay isVisible={isSearching} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero" aria-label="Flight search">
        <div className="hero-backdrop" aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-heading">
            <p className="eyebrow">Domestic flights · Nigeria</p>
            <h1>Search, compare and book smarter.</h1>
            <p className="hero-sub">Live fares from trusted Nigerian carriers — Lagos, Abuja, Port Harcourt and beyond.</p>
          </div>

          <div className="booking-card">
            <TripTabs activeTrip={tripType} onChange={setTripType} />

            <form onSubmit={handleSearch}>
              <div className="grid">
                <div className="location-group">
                  <AirportSelect
                    label="From"
                    value={from.label}
                    onChange={(selection) => setFrom(selection)}
                    placeholder="Search departure airport"
                    excludeValue={to.code}
                  />

                  <button type="button" className="swap-btn-inline" onClick={handleSwapAirports} aria-label="Swap airports">
                    ⇌
                  </button>

                  <AirportSelect
                    label="To"
                    value={to.label}
                    onChange={(selection) => setTo(selection)}
                    placeholder="Search destination airport"
                    excludeValue={from.code}
                  />
                </div>

                <div className="input-box">
                  <label>Departure</label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(event) => setDepartureDate(event.target.value)}
                    required
                  />
                </div>

                <div className="input-box">
                  <label>Return</label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(event) => setReturnDate(event.target.value)}
                    disabled={tripType === 'oneway'}
                    style={{ opacity: tripType === 'oneway' ? 0.55 : 1 }}
                  />
                </div>

                <PassengerSelect
                  adults={adults}
                  setAdults={setAdults}
                  children={children}
                  setChildren={setChildren}
                  infants={infants}
                  setInfants={setInfants}
                  cabinClass={travelClass}
                  setCabinClass={setTravelClass}
                />

                <div className="input-box checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={flexibleDates}
                      onChange={(event) => setFlexibleDates(event.target.checked)}
                    />
                    Flexible with dates
                  </label>
                </div>
              </div>

              {errorMessage && <p className="form-status error">{errorMessage}</p>}

              <button className="search-btn" type="submit" disabled={isSearching}>
                {isSearching ? 'Searching flights...' : 'Search flights'}
              </button>
            </form>
          </div>
          {/* ── END search box ─────────────────────────────────────────── */}

          <div className="hero-trust">
            <span>Trusted carriers</span>
            {airlines.map((a) => (
              <span key={a.name} className="trust-badge" style={{ '--badge-color': a.color }}>{a.code}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <main className="page-body">

        {/* Popular routes */}
        <section className="section" aria-labelledby="routes-heading">
          <div className="section-header">
            <p className="label-tag">Popular routes</p>
            <h2 id="routes-heading">Top Nigerian domestic routes</h2>
            <p className="section-sub">High-frequency corridors with live inventory from verified carriers.</p>
          </div>
          <div className="routes-grid">
            {popularRoutes.map((r) => (
              <article className="route-card" key={r.code}>
                <div className="route-card-airports">
                  <span className="route-city">{r.from}</span>
                  <span className="route-arrow" aria-hidden="true">→</span>
                  <span className="route-city">{r.to}</span>
                </div>
                <p className="route-code">{r.code}</p>
                <p className="route-desc">{r.desc}</p>
                <button type="button" className="card-btn" onClick={() => navigate('/')}>Search route</button>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="section section--tinted" aria-labelledby="steps-heading">
          <div className="section-header">
            <p className="label-tag">How it works</p>
            <h2 id="steps-heading">Book a flight in four steps</h2>
          </div>
          <div className="steps-grid">
            {steps.map((s) => (
              <article className="step-card" key={s.n}>
                <span className="step-n" aria-hidden="true">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Destinations */}
        <section className="section" aria-labelledby="dest-heading">
          <div className="section-header">
            <p className="label-tag">Destinations</p>
            <h2 id="dest-heading">Cities travellers fly to most</h2>
          </div>
          <div className="dest-grid">
            {destinations.map((d) => (
              <article
                key={d.name}
                className="dest-card"
                style={{ backgroundImage: `url(${d.image})` }}
                aria-label={`${d.name} — ${d.tag}`}
              >
                <div className="dest-overlay" aria-hidden="true" />
                <div className="dest-info">
                  <p className="dest-tag">{d.tag}</p>
                  <h3>{d.name}</h3>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Why SharpzyTravels */}
        <section className="section section--tinted" aria-labelledby="benefits-heading">
          <div className="section-header">
            <p className="label-tag">Why SharpzyTravels</p>
            <h2 id="benefits-heading">Built for Nigerian travellers</h2>
            <p className="section-sub">Everything you need to find and book domestic flights with confidence.</p>
          </div>
          <div className="benefits-grid">
            {benefits.map((b) => (
              <article className="benefit-card" key={b.title}>
                <div className="benefit-icon" aria-hidden="true">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Carriers */}
        <section className="section" aria-labelledby="carriers-heading">
          <div className="section-header">
            <p className="label-tag">Carriers</p>
            <h2 id="carriers-heading">Airlines we search</h2>
          </div>
          <div className="carriers-grid">
            {airlines.map((a) => (
              <article className="carrier-card" key={a.name}>
                <div className="carrier-logo-box">
                  <img
                    src={getAirlineLogo(a.name, a.code)}
                    alt={a.name}
                    className="carrier-logo-img"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = FALLBACK_AIRLINE_LOGO;
                    }}
                  />
                </div>
                <p className="carrier-name">{a.name}</p>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="section section--tinted" aria-labelledby="faq-heading">
          <div className="section-header">
            <p className="label-tag">FAQ</p>
            <h2 id="faq-heading">Common questions</h2>
          </div>
          <div className="faq-list">
            {faqs.map((f) => (
              <details className="faq-item" key={f.question}>
                <summary className="faq-summary">{f.question}</summary>
                <p className="faq-answer">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="section cta-section" aria-labelledby="cta-heading">
          <div className="cta-inner">
            <p className="label-tag">Get started</p>
            <h2 id="cta-heading">Ready to find your next flight?</h2>
            <p>Search live fares across Nigeria's domestic network right now.</p>
            <button type="button" className="cta-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              Search flights
            </button>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

export default Home;
