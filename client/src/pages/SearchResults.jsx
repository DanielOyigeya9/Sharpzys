import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FlightCard from '../components/FlightCard';
import AirportSelect from '../components/AirportSelect';
import PassengerSelect from '../components/PassengerSelect';
import SearchLoadingOverlay from '../components/SearchLoadingOverlay';
import { searchFlights } from '../services/api';
import '../styles/search-results.css';

function SearchResults() {
  const location = useLocation();
  const navigate = useNavigate();

  const searchState = location.state?.search || {
    origin: 'Lagos — Murtala Muhammed International Airport (LOS)',
    originCode: 'LOS',
    destination: 'Abuja — Nnamdi Azikiwe International Airport (ABV)',
    destinationCode: 'ABV',
    departureDate: new Date().toISOString().split('T')[0],
    returnDate: '',
    adults: 1,
    children: 0,
    infants: 0,
    cabinClass: 'Economy',
  };

  const initialFlights = location.state?.flights || [];
  const [flights, setFlights] = useState(initialFlights);
  const [searchParams, setSearchParams] = useState(searchState);
  const [isModifying, setIsModifying] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // ── Filters State ────────────────────────────────────────────────────────
  const [selectedStops, setSelectedStops] = useState('all'); // 'all', '0', '1+'
  const [selectedAirline, setSelectedAirline] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all'); // 'all', 'morning', 'afternoon', 'evening'
  const [maxPriceFilter, setMaxPriceFilter] = useState(0);

  // ── Sort State ───────────────────────────────────────────────────────────
  const [sortBy, setSortBy] = useState('cheapest'); // 'cheapest', 'fastest', 'earliest'

  // Mobile filter modal state
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Compute available airlines from returned flights
  const availableAirlines = useMemo(() => {
    const set = new Set();
    flights.forEach((f) => { if (f.airline) set.add(f.airline); });
    return Array.from(set);
  }, [flights]);

  // Compute price range bounds
  const priceBounds = useMemo(() => {
    if (!flights.length) return { min: 0, max: 500000 };
    const prices = flights.map((f) => Number(f.price) || 0).filter((p) => p > 0);
    if (!prices.length) return { min: 0, max: 500000 };
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [flights]);

  // Filtered & Sorted flights
  const filteredFlights = useMemo(() => {
    let list = [...flights];

    // Filter by stops
    if (selectedStops === '0') {
      list = list.filter((f) => f.stops === 0);
    } else if (selectedStops === '1+') {
      list = list.filter((f) => f.stops > 0);
    }

    // Filter by airline
    if (selectedAirline !== 'all') {
      list = list.filter((f) => f.airline === selectedAirline);
    }

    // Filter by price
    if (maxPriceFilter > 0) {
      list = list.filter((f) => (Number(f.price) || 0) <= maxPriceFilter);
    }

    // Filter by departure time range
    if (selectedTimeRange !== 'all') {
      list = list.filter((f) => {
        const timeStr = f.departureTime || '';
        let hour = 12;
        const match = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (match) hour = parseInt(match[1], 10);
        if (selectedTimeRange === 'morning') return hour >= 0 && hour < 12;
        if (selectedTimeRange === 'afternoon') return hour >= 12 && hour < 18;
        if (selectedTimeRange === 'evening') return hour >= 18 && hour <= 23;
        return true;
      });
    }

    // Sort list
    if (sortBy === 'cheapest') {
      list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === 'fastest') {
      list.sort((a, b) => (a.duration || '').localeCompare(b.duration || ''));
    } else if (sortBy === 'earliest') {
      list.sort((a, b) => (a.departureTime || '').localeCompare(b.departureTime || ''));
    }

    return list;
  }, [flights, selectedStops, selectedAirline, maxPriceFilter, selectedTimeRange, sortBy]);

  const handleSwapAirports = () => {
    setSearchParams((prev) => ({
      ...prev,
      origin: prev.destination,
      originCode: prev.destinationCode,
      destination: prev.origin,
      destinationCode: prev.originCode,
    }));
  };

  const handleSelectFlight = (flight) => {
    navigate('/booking', {
      state: {
        flight,
        search: searchParams,
      },
    });
  };

  const handleModifySubmit = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    setSearchError('');

    const originCode = searchParams.originCode || extractCode(searchParams.origin) || 'LOS';
    const destCode = searchParams.destinationCode || extractCode(searchParams.destination) || 'ABV';

    try {
      const response = await searchFlights({
        origin: originCode,
        destination: destCode,
        departureDate: searchParams.departureDate,
        returnDate: searchParams.returnDate,
        adults: searchParams.adults || 1,
        children: searchParams.children || 0,
        infants: searchParams.infants || 0,
        cabinClass: searchParams.cabinClass || 'Economy',
      });

      setFlights(response.flights || []);
      setIsModifying(false);
    } catch (err) {
      setSearchError(err.response?.data?.message || err.message || 'Flight search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const resetFilters = () => {
    setSelectedStops('all');
    setSelectedAirline('all');
    setSelectedTimeRange('all');
    setMaxPriceFilter(0);
  };

  return (
    <div className="results-wrapper">
      <Navbar />
      <SearchLoadingOverlay isVisible={isSearching} />

      <main className="results-page">
        {/* ── Top Bar (Search Summary & Modify Toggle) ── */}
        <section className="search-summary-section">
          <div className="summary-content">
            <div className="summary-text-col">
              <h1>{searchState.originCode} <span className="arrow">→</span> {searchState.destinationCode}</h1>
              <p>
                {searchState.departureDate}
                {searchState.returnDate ? ` - ${searchState.returnDate}` : ''}
                <span className="divider">•</span>
                {searchState.adults} Adult{searchState.adults > 1 ? 's' : ''}
                {searchState.children > 0 ? `, ${searchState.children} Child${searchState.children > 1 ? 'ren' : ''}` : ''}
                {searchState.infants > 0 ? `, ${searchState.infants} Infant${searchState.infants > 1 ? 's' : ''}` : ''}
                <span className="divider">•</span>
                {searchState.cabinClass}
              </p>
            </div>
            <button
              type="button"
              className="modify-search-btn"
              onClick={() => setIsModifying((v) => !v)}
            >
              {isModifying ? 'Close Form' : '🔍 Modify Search'}
            </button>
          </div>

          {/* Inline Modify Search Form */}
          {isModifying && (
            <div className="modify-form-drawer">
              <form onSubmit={handleModifySubmit} className="modify-form-grid">
                <div className="location-group">
                  <AirportSelect
                    label="From"
                    value={searchParams.origin}
                    onChange={(val) => setSearchParams((prev) => ({ ...prev, origin: val.label, originCode: val.code }))}
                    placeholder="Departure airport"
                  />

                  <button type="button" className="swap-btn-inline" onClick={handleSwapAirports} aria-label="Swap airports">
                    ⇌
                  </button>

                  <AirportSelect
                    label="To"
                    value={searchParams.destination}
                    onChange={(val) => setSearchParams((prev) => ({ ...prev, destination: val.label, destinationCode: val.code }))}
                    placeholder="Destination airport"
                  />
                </div>

                <div className="input-box">
                  <label>Departure Date</label>
                  <input
                    type="date"
                    value={searchParams.departureDate}
                    onChange={(e) => setSearchParams((prev) => ({ ...prev, departureDate: e.target.value }))}
                    required
                  />
                </div>

                  <PassengerSelect
                    adults={searchParams.adults || 1}
                    setAdults={(val) => setSearchParams((prev) => ({ ...prev, adults: typeof val === 'function' ? val(prev.adults || 1) : val }))}
                    children={searchParams.children || 0}
                    setChildren={(val) => setSearchParams((prev) => ({ ...prev, children: typeof val === 'function' ? val(prev.children || 0) : val }))}
                    infants={searchParams.infants || 0}
                    setInfants={(val) => setSearchParams((prev) => ({ ...prev, infants: typeof val === 'function' ? val(prev.infants || 0) : val }))}
                    cabinClass={searchParams.cabinClass || 'Economy'}
                    setCabinClass={(val) => setSearchParams((prev) => ({ ...prev, cabinClass: typeof val === 'function' ? val(prev.cabinClass || 'Economy') : val }))}
                  />

                <div className="modify-actions">
                  <button type="submit" className="update-search-btn" disabled={isSearching}>
                    {isSearching ? 'Searching…' : 'Update Search'}
                  </button>
                </div>
              </form>

              {searchError && <p className="modify-error">{searchError}</p>}
            </div>
          )}
        </section>

        {/* ── Main Results Content Layout ─────────────────────────────── */}
        <div className="results-container">
          {/* Mobile Filter Button */}
          <div className="mobile-filter-bar">
            <button
              type="button"
              className="mobile-filter-btn"
              onClick={() => setShowMobileFilters(true)}
            >
              ⚙️ Filters ({filteredFlights.length} flights)
            </button>
          </div>

          <div className="results-grid-layout">
            {/* ── Left Filters Sidebar ─────────────────────────────────── */}
            <aside className={`filters-sidebar ${showMobileFilters ? 'mobile-show' : ''}`}>
              <div className="filters-header">
                <h3>Filter Results</h3>
                {showMobileFilters && (
                  <button type="button" className="close-filters-btn" onClick={() => setShowMobileFilters(false)}>
                    ✕
                  </button>
                )}
              </div>

              {/* Filter 1: Stops */}
              <div className="filter-group">
                <h4 className="filter-title">Stops</h4>
                <div className="filter-options">
                  <label className="filter-radio">
                    <input
                      type="radio"
                      name="stops"
                      checked={selectedStops === 'all'}
                      onChange={() => setSelectedStops('all')}
                    />
                    <span>All Flights</span>
                  </label>
                  <label className="filter-radio">
                    <input
                      type="radio"
                      name="stops"
                      checked={selectedStops === '0'}
                      onChange={() => setSelectedStops('0')}
                    />
                    <span>Non-stop only</span>
                  </label>
                  <label className="filter-radio">
                    <input
                      type="radio"
                      name="stops"
                      checked={selectedStops === '1+'}
                      onChange={() => setSelectedStops('1+')}
                    />
                    <span>1+ Stops</span>
                  </label>
                </div>
              </div>

              {/* Filter 2: Airlines */}
              {availableAirlines.length > 0 && (
                <div className="filter-group">
                  <h4 className="filter-title">Airlines</h4>
                  <div className="filter-options">
                    <label className="filter-radio">
                      <input
                        type="radio"
                        name="airline"
                        checked={selectedAirline === 'all'}
                        onChange={() => setSelectedAirline('all')}
                      />
                      <span>All Carriers ({availableAirlines.length})</span>
                    </label>
                    {availableAirlines.map((airline) => (
                      <label className="filter-radio" key={airline}>
                        <input
                          type="radio"
                          name="airline"
                          checked={selectedAirline === airline}
                          onChange={() => setSelectedAirline(airline)}
                        />
                        <span>{airline}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter 3: Departure Time */}
              <div className="filter-group">
                <h4 className="filter-title">Departure Time</h4>
                <div className="filter-options">
                  <label className="filter-radio">
                    <input
                      type="radio"
                      name="time"
                      checked={selectedTimeRange === 'all'}
                      onChange={() => setSelectedTimeRange('all')}
                    />
                    <span>Any time</span>
                  </label>
                  <label className="filter-radio">
                    <input
                      type="radio"
                      name="time"
                      checked={selectedTimeRange === 'morning'}
                      onChange={() => setSelectedTimeRange('morning')}
                    />
                    <span>Morning (00:00 – 12:00)</span>
                  </label>
                  <label className="filter-radio">
                    <input
                      type="radio"
                      name="time"
                      checked={selectedTimeRange === 'afternoon'}
                      onChange={() => setSelectedTimeRange('afternoon')}
                    />
                    <span>Afternoon (12:00 – 18:00)</span>
                  </label>
                  <label className="filter-radio">
                    <input
                      type="radio"
                      name="time"
                      checked={selectedTimeRange === 'evening'}
                      onChange={() => setSelectedTimeRange('evening')}
                    />
                    <span>Evening (18:00 – 24:00)</span>
                  </label>
                </div>
              </div>

              {/* Filter 4: Max Price */}
              {priceBounds.max > priceBounds.min && (
                <div className="filter-group">
                  <h4 className="filter-title">Max Price</h4>
                  <div className="price-slider-wrap">
                    <input
                      type="range"
                      min={priceBounds.min}
                      max={priceBounds.max}
                      step={5000}
                      value={maxPriceFilter || priceBounds.max}
                      onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                    />
                    <div className="price-range-labels">
                      <span>₦{priceBounds.min.toLocaleString()}</span>
                      <strong>₦{(maxPriceFilter || priceBounds.max).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              )}

              <button type="button" className="reset-filters-btn" onClick={resetFilters}>
                Reset Filters
              </button>
            </aside>

            {/* ── Main Flights Area ───────────────────────────────────── */}
            <div className="results-main-content">
              {/* Sort & Count Header */}
              <div className="sort-bar">
                <div className="results-count-badge">
                  <span>Showing <strong>{filteredFlights.length}</strong> of <strong>{flights.length}</strong> live offers</span>
                </div>

                <div className="sort-tabs">
                  <span className="sort-label">Sort by:</span>
                  <button
                    type="button"
                    className={`sort-tab ${sortBy === 'cheapest' ? 'active' : ''}`}
                    onClick={() => setSortBy('cheapest')}
                  >
                    Cheapest
                  </button>
                  <button
                    type="button"
                    className={`sort-tab ${sortBy === 'fastest' ? 'active' : ''}`}
                    onClick={() => setSortBy('fastest')}
                  >
                    Fastest
                  </button>
                  <button
                    type="button"
                    className={`sort-tab ${sortBy === 'earliest' ? 'active' : ''}`}
                    onClick={() => setSortBy('earliest')}
                  >
                    Earliest
                  </button>
                </div>
              </div>

              {/* Skeleton loading state */}
              {isSearching && (
                <div className="skeleton-cards-list">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="skeleton-card">
                      <div className="skeleton-line shimmer"></div>
                      <div className="skeleton-line short shimmer"></div>
                    </div>
                  ))}
                </div>
              )}

              {/* No Flights Found State */}
              {!isSearching && filteredFlights.length === 0 && (
                <div className="results-empty-card">
                  <div className="empty-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="empty-svg">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M8 12h8M12 8v8"/>
                    </svg>
                  </div>
                  <h3>No flights found for this route and date</h3>
                  <p>Try searching different travel dates or nearby airports to see available carrier inventory.</p>
                  <button type="button" className="primary-action-btn" onClick={resetFilters}>
                    Reset All Filters
                  </button>
                </div>
              )}

              {/* Real Flight Cards List */}
              {!isSearching && filteredFlights.length > 0 && (
                <div className="flights-cards-list">
                  {filteredFlights.map((flight, index) => (
                    <FlightCard
                      key={flight.id || `${flight.airline}-${flight.flightNumber}-${index}`}
                      flight={flight}
                      onSelect={handleSelectFlight}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function getCity(airportStr) {
  if (!airportStr) return 'Airport';
  return airportStr.split('—')[0].trim() || airportStr;
}

function extractCode(str) {
  if (!str) return '';
  const m = str.match(/\(([A-Z]{3})\)/);
  return m ? m[1] : '';
}

export default SearchResults;
