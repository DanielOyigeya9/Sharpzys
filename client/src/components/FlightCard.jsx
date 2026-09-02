import { useState } from 'react';
import { getAirlineLogo, FALLBACK_AIRLINE_LOGO } from '../utils/airlineLogos';

function formatTime(dateTimeStr) {
  if (!dateTimeStr) return '--:--';
  if (/^\d{2}:\d{2}$/.test(dateTimeStr.trim())) return dateTimeStr.trim();
  try {
    const parts = dateTimeStr.trim().split(/\s+/);
    if (parts.length >= 2 && parts[1].includes(':')) {
      const [h, m] = parts[1].split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour % 12 || 12;
      return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
    }
    const d = new Date(dateTimeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  } catch {
    // Return original string if parsing fails
  }
  return dateTimeStr;
}

function formatDate(dateTimeStr) {
  if (!dateTimeStr) return '';
  try {
    const d = new Date(dateTimeStr.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch {
    // fallback
  }
  return '';
}

function FlightCard({ flight, onSelect }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!flight) return null;

  const currencySymbol = flight.currency === 'NGN' ? '₦' : (flight.currency === 'USD' ? '$' : `${flight.currency || '$'} `);
  const formattedPrice = flight.price ? `${currencySymbol}${Number(flight.price).toLocaleString()}` : 'Price on request';

  const depTimeFormatted = formatTime(flight.departureTime);
  const arrTimeFormatted = formatTime(flight.arrivalTime);
  const depDateFormatted = formatDate(flight.departureTime);
  const arrDateFormatted = formatDate(flight.arrivalTime);

  const stopsText = flight.stops === 0 ? 'Non-stop' : `${flight.stops} Stop${flight.stops > 1 ? 's' : ''}`;
  const airlineCode = flight.airlineCode || flight.airline?.substring(0, 2).toUpperCase() || 'FL';

  const handleCardToggle = (e) => {
    // If user clicks direct 'Continue to Booking' button inside expanded drawer, call onSelect
    if (e.target.closest('.continue-booking-btn')) return;
    setIsExpanded((prev) => !prev);
  };

  return (
    <article className={`flight-card-container ${isExpanded ? 'is-expanded' : ''}`}>
      {/* Primary Summary Row */}
      <div className="flight-card-main" onClick={handleCardToggle}>
        {/* Carrier Info */}
        <div className="card-airline-col">
          <div className="airline-logo-box">
            <img
              src={getAirlineLogo(flight.airline, airlineCode)}
              alt={flight.airline || 'Airline'}
              className="airline-logo-img"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = FALLBACK_AIRLINE_LOGO;
              }}
            />
          </div>
          <div className="airline-meta">
            <h4 className="airline-name">{flight.airline || 'Carrier'}</h4>
            <span className="flight-num">Flight {flight.flightNumber || 'Direct'}</span>
            {flight.aircraft && <span className="aircraft-tag">{flight.aircraft}</span>}
          </div>
        </div>

        {/* Flight Schedule */}
        <div className="card-schedule-col">
          <div className="time-block origin-block">
            <span className="flight-time">{depTimeFormatted}</span>
            <span className="airport-code">{flight.origin || flight.departureAirport}</span>
          </div>

          <div className="route-indicator">
            <span className="duration-label">{flight.duration || 'Direct'}</span>
            <div className="route-line">
              <span className="line-dot start-dot"></span>
              <span className="line-bar"></span>
              <span className="plane-icon" aria-hidden="true">✈</span>
              <span className="line-dot end-dot"></span>
            </div>
            <span className={`stops-badge ${flight.stops === 0 ? 'non-stop' : 'has-stops'}`}>
              {stopsText}
            </span>
          </div>

          <div className="time-block destination-block">
            <span className="flight-time">{arrTimeFormatted}</span>
            <span className="airport-code">{flight.destination || flight.arrivalAirport}</span>
          </div>
        </div>

        {/* Pricing & Selection */}
        <div className="card-pricing-col">
          <div className="price-tag">
            <span className="price-sub">Total fare</span>
            <span className="price-amount">{formattedPrice}</span>
          </div>
          <button
            type="button"
            className={`select-toggle-btn ${isExpanded ? 'expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
          >
            {isExpanded ? 'Hide Details' : 'Select Flight'}
          </button>
        </div>
      </div>

      {/* Expandable Fare Details Drawer */}
      {isExpanded && (
        <div className="flight-details-drawer">
          <div className="drawer-inner">
            <div className="drawer-header">
              <h3>Flight & Fare Details</h3>
              <span className="carrier-badge-sm">{flight.airline} • Flight {flight.flightNumber}</span>
            </div>

            <div className="drawer-grid">
              {/* Itinerary Segment Details */}
              <div className="drawer-section">
                <h4 className="section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sec-icon">
                    <path d="M12 2v20M2 12h20"/>
                  </svg>
                  Itinerary Segment
                </h4>
                <div className="segment-timeline">
                  <div className="timeline-point">
                    <div className="point-dot origin"></div>
                    <div className="point-info">
                      <span className="point-time">{depTimeFormatted}</span>
                      <strong className="point-airport">{flight.origin || flight.departureAirport} Airport</strong>
                      {depDateFormatted && <span className="point-date">{depDateFormatted}</span>}
                    </div>
                  </div>

                  <div className="timeline-line">
                    <span className="segment-duration">Non-stop • {flight.duration || 'Direct flight'}</span>
                    {flight.aircraft && <span className="segment-aircraft">Aircraft: {flight.aircraft}</span>}
                  </div>

                  <div className="timeline-point">
                    <div className="point-dot dest"></div>
                    <div className="point-info">
                      <span className="point-time">{arrTimeFormatted}</span>
                      <strong className="point-airport">{flight.destination || flight.arrivalAirport} Airport</strong>
                      {arrDateFormatted && <span className="point-date">{arrDateFormatted}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fare & Inclusion Rules */}
              <div className="drawer-section">
                <h4 className="section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sec-icon">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                  Inclusions & Fare Rules
                </h4>
                <ul className="inclusions-list">
                  <li>
                    <span className="icon-check">✓</span>
                    <span><strong>Checked Baggage:</strong> 1 x 20kg included in fare</span>
                  </li>
                  <li>
                    <span className="icon-check">✓</span>
                    <span><strong>Cabin Hand Luggage:</strong> 1 x 7kg hand bag</span>
                  </li>
                  <li>
                    <span className="icon-info">i</span>
                    <span><strong>Reschedule Rule:</strong> Permitted subject to carrier fare difference</span>
                  </li>
                  <li>
                    <span className="icon-info">i</span>
                    <span><strong>Cancellation Policy:</strong> Standard airline refund policy applies</span>
                  </li>
                </ul>
              </div>

              {/* Price Breakdown */}
              <div className="drawer-section price-breakdown-section">
                <h4 className="section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sec-icon">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  Price Summary
                </h4>
                <div className="breakdown-rows">
                  <div className="breakdown-row">
                    <span>Base Carrier Fare</span>
                    <span>{formattedPrice}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Airport Taxes & Service Fees</span>
                    <span>Included</span>
                  </div>
                  <div className="breakdown-row total-row">
                    <strong>Total Amount</strong>
                    <strong className="total-price">{formattedPrice}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="drawer-action-bar">
              <span className="guarantee-text">🔒 Verified live inventory locked from carrier</span>
              <button
                type="button"
                className="continue-booking-btn"
                onClick={() => onSelect && onSelect(flight)}
              >
                Continue to Booking →
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function getCarrierColor(code) {
  const map = {
    P4: '#1d4ed8', // Air Peace
    AP: '#1d4ed8',
    IA: '#0284c7', // Ibom Air
    UN: '#7c3aed', // United Nigeria
    GA: '#15803d', // Green Africa
    OA: '#b45309', // Overland
  };
  return map[code] || '#1d4ed8';
}

export default FlightCard;
