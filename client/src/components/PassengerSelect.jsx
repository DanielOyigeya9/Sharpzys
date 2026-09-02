import { useState, useRef, useEffect } from 'react';
import '../styles/passenger-select.css';

function PassengerSelect({
  adults = 1,
  setAdults,
  children = 0,
  setChildren,
  infants = 0,
  setInfants,
  cabinClass = 'Economy',
  setCabinClass,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showInfantError, setShowInfantError] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers with validation rules
  const handleIncreaseAdults = () => {
    setAdults((prev) => Math.min(9, prev + 1));
    setShowInfantError(false);
  };

  const handleDecreaseAdults = () => {
    if (adults <= 1) return;
    const newAdults = adults - 1;
    setAdults(newAdults);
    // If infants now exceed adults, reduce infants to match adults
    if (infants > newAdults) {
      setInfants(newAdults);
    }
    setShowInfantError(false);
  };

  const handleIncreaseChildren = () => {
    setChildren((prev) => Math.min(9, prev + 1));
  };

  const handleDecreaseChildren = () => {
    setChildren((prev) => Math.max(0, prev - 1));
  };

  const handleIncreaseInfants = () => {
    if (infants >= adults) {
      setShowInfantError(true);
      return;
    }
    setInfants((prev) => prev + 1);
    setShowInfantError(false);
  };

  const handleDecreaseInfants = () => {
    setInfants((prev) => Math.max(0, prev - 1));
    setShowInfantError(false);
  };

  // Generate concise summary text for trigger field
  const getSummaryText = () => {
    const parts = [];
    parts.push(adults + ' ' + (adults === 1 ? 'Adult' : 'Adults'));
    if (children > 0) {
      parts.push(children + ' ' + (children === 1 ? 'Child' : 'Children'));
    }
    if (infants > 0) {
      parts.push(infants + ' ' + (infants === 1 ? 'Infant' : 'Infants'));
    }
    return parts.join(', ') + ' \u00B7 ' + cabinClass;
  };

  return (
    <div className="input-box passenger-select-container" ref={containerRef}>
      <label id="passenger-select-label">Passengers &amp; Class</label>

      {/* Summary Trigger Button */}
      <button
        type="button"
        className={'passenger-select-trigger' + (isOpen ? ' is-active' : '')}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-labelledby="passenger-select-label"
      >
        <span className="passenger-summary-text">{getSummaryText()}</span>
        <span className="dropdown-caret" aria-hidden="true">
          {isOpen ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div className="passenger-dropdown-panel" role="dialog" aria-label="Passengers and Cabin Class">
          {/* Header */}
          <div className="passenger-dropdown-header">
            <h3>Passengers</h3>
            <button
              type="button"
              className="passenger-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close passenger selection dropdown"
            >
              {'\u2715'}
            </button>
          </div>

          {/* Passenger Types List */}
          <div className="passenger-rows-list">
            {/* Adults (12+) */}
            <div className="passenger-row">
              <div className="passenger-type-info">
                <strong className="passenger-type-title">Adults</strong>
                <span className="passenger-type-age">12+ years</span>
              </div>
              <div className="counter-controls">
                <button
                  type="button"
                  className="counter-circle-btn"
                  onClick={handleDecreaseAdults}
                  disabled={adults <= 1}
                  aria-label="Decrease adults"
                >
                  {'\u2212'}
                </button>
                <span className="counter-number-val">{adults}</span>
                <button
                  type="button"
                  className="counter-circle-btn"
                  onClick={handleIncreaseAdults}
                  disabled={adults >= 9}
                  aria-label="Increase adults"
                >
                  +
                </button>
              </div>
            </div>

            {/* Children (2-11) */}
            <div className="passenger-row">
              <div className="passenger-type-info">
                <strong className="passenger-type-title">Children</strong>
                <span className="passenger-type-age">2{'\u201311'} years</span>
              </div>
              <div className="counter-controls">
                <button
                  type="button"
                  className="counter-circle-btn"
                  onClick={handleDecreaseChildren}
                  disabled={children <= 0}
                  aria-label="Decrease children"
                >
                  {'\u2212'}
                </button>
                <span className="counter-number-val">{children}</span>
                <button
                  type="button"
                  className="counter-circle-btn"
                  onClick={handleIncreaseChildren}
                  disabled={children >= 9}
                  aria-label="Increase children"
                >
                  +
                </button>
              </div>
            </div>

            {/* Infants (0-1) */}
            <div className="passenger-row">
              <div className="passenger-type-info">
                <strong className="passenger-type-title">Infants</strong>
                <span className="passenger-type-age">0{'\u20131'} years</span>
              </div>
              <div className="counter-controls">
                <button
                  type="button"
                  className="counter-circle-btn"
                  onClick={handleDecreaseInfants}
                  disabled={infants <= 0}
                  aria-label="Decrease infants"
                >
                  {'\u2212'}
                </button>
                <span className="counter-number-val">{infants}</span>
                <button
                  type="button"
                  className="counter-circle-btn"
                  onClick={handleIncreaseInfants}
                  disabled={infants >= 9 || infants >= adults}
                  aria-label="Increase infants"
                >
                  +
                </button>
              </div>
            </div>

            {/* Subtle Infant Limit Note */}
            {showInfantError && (
              <div className="infant-validation-note">
                Each infant must travel with an adult.
              </div>
            )}
          </div>

          <div className="passenger-dropdown-divider"></div>

          {/* Cabin Class Selection */}
          <div className="cabin-class-section">
            <label htmlFor="cabin-class-select" className="cabin-class-label">Cabin Class</label>
            <select
              id="cabin-class-select"
              className="cabin-class-dropdown-select"
              value={cabinClass}
              onChange={(e) => setCabinClass(e.target.value)}
            >
              <option value="Economy">Economy</option>
              <option value="Premium Economy">Premium Economy</option>
              <option value="Business">Business</option>
              <option value="First Class">First Class</option>
            </select>
          </div>

          {/* Done Action Button */}
          <div className="passenger-dropdown-footer">
            <button
              type="button"
              className="passenger-done-btn"
              onClick={() => setIsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PassengerSelect;
