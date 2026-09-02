import { useEffect, useMemo, useRef, useState } from 'react';

// Comprehensive dataset of Nigerian airports across states
const airportOptions = [
  { city: 'Lagos', state: 'Lagos', airport: 'Murtala Muhammed International Airport', code: 'LOS' },
  { city: 'Abuja', state: 'Federal Capital Territory', airport: 'Nnamdi Azikiwe International Airport', code: 'ABV' },
  { city: 'Port Harcourt', state: 'Rivers', airport: 'Port Harcourt International Airport', code: 'PHC' },
  { city: 'Kano', state: 'Kano', airport: 'Mallam Aminu Kano International Airport', code: 'KAN' },
  { city: 'Enugu', state: 'Enugu', airport: 'Akanu Ibiam International Airport', code: 'ENU' },
  { city: 'Owerri', state: 'Imo', airport: 'Sam Mbakwe International Cargo Airport', code: 'QOW' },
  { city: 'Yola', state: 'Adamawa', airport: 'Yola International Airport', code: 'YOL' },
  { city: 'Uyo', state: 'Akwa Ibom', airport: 'Victor Attah International Airport', code: 'QUO' },
  { city: 'Awka', state: 'Anambra', airport: 'Chinua Achebe International Airport', code: 'AWK' },
  { city: 'Bauchi', state: 'Bauchi', airport: 'Sir Abubakar Tafawa Balewa International Airport', code: 'BCU' },
  { city: 'Yenagoa', state: 'Bayelsa', airport: 'Bayelsa International Airport', code: 'YEN' },
  { city: 'Makurdi', state: 'Benue', airport: 'Makurdi Airport', code: 'MDI' },
  { city: 'Maiduguri', state: 'Borno', airport: 'Maiduguri International Airport', code: 'MIU' },
  { city: 'Calabar', state: 'Cross River', airport: 'Margaret Ekpo International Airport', code: 'CBQ' },
  { city: 'Asaba', state: 'Delta', airport: 'Asaba International Airport', code: 'ABB' },
  { city: 'Warri', state: 'Delta', airport: 'Osubi Airstrip', code: 'QRW' },
  { city: 'Abakaliki', state: 'Ebonyi', airport: 'Chuba Okadigbo International Airport', code: 'ABK' },
  { city: 'Benin City', state: 'Edo', airport: 'Benin Airport', code: 'BNI' },
  { city: 'Ado-Ekiti', state: 'Ekiti', airport: 'Ekiti Cargo Airport', code: 'ADE' },
  { city: 'Gombe', state: 'Gombe', airport: 'Gombe Lawanti International Airport', code: 'GMO' },
  { city: 'Dutse', state: 'Jigawa', airport: 'Dutse International Airport', code: 'JBI' },
  { city: 'Kaduna', state: 'Kaduna', airport: 'Kaduna International Airport', code: 'KAD' },
  { city: 'Katsina', state: 'Katsina', airport: 'Umaru Musa Yar\'Adua International Airport', code: 'DKA' },
  { city: 'Birnin Kebbi', state: 'Kebbi', airport: 'Sir Ahmadu Bello International Airport', code: 'KEB' },
  { city: 'Lokoja', state: 'Kogi', airport: 'Confluence Airport', code: 'KOG' },
  { city: 'Ilorin', state: 'Kwara', airport: 'Ilorin International Airport', code: 'ILR' },
  { city: 'Lafia', state: 'Nasarawa', airport: 'Lafia Cargo Airport', code: 'NSA' },
  { city: 'Minna', state: 'Niger', airport: 'Minna International Airport', code: 'MXJ' },
  { city: 'Abeokuta', state: 'Ogun', airport: 'Gateway International Agro-Cargo Airport', code: 'LOS' },
  { city: 'Akure', state: 'Ondo', airport: 'Akure Airport', code: 'AKR' },
  { city: 'Osogbo', state: 'Osun', airport: 'MKO Abiola International Airport', code: 'OSN' },
  { city: 'Ibadan', state: 'Oyo', airport: 'Ibadan Airport', code: 'IBA' },
  { city: 'Jos', state: 'Plateau', airport: 'Yakubu Gowon Airport', code: 'JOS' },
  { city: 'Sokoto', state: 'Sokoto', airport: 'Sadiq Abubakar III International Airport', code: 'SKO' },
  { city: 'Jalingo', state: 'Taraba', airport: 'Danbaba Suntai Airport', code: 'JAL' },
  { city: 'Damaturu', state: 'Yobe', airport: 'Damaturu International Cargo Airport', code: 'DTR' },
  { city: 'Gusau', state: 'Zamfara', airport: 'Gusau Airport', code: 'QUS' },
];

const RECENT_SEARCHES_KEY = 'sharpzytravels-recent-airports';

const normalizeSelection = (option) => ({
  label: `${option.city} — ${option.airport} (${option.code})`,
  code: option.code,
  city: option.city,
  state: option.state,
  airport: option.airport,
});

function AirportSelect({ label, value, onChange, placeholder, excludeValue }) {
  const [query, setQuery] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const containerRef = useRef(null);

  const filteredOptions = useMemo(() => {
    const term = query.toLowerCase().trim();
    const excludedCode = typeof excludeValue === 'string' ? excludeValue : excludeValue?.code || '';

    return airportOptions.filter((option) => {
      const searchable = `${option.city} ${option.state} ${option.airport} ${option.code}`.toLowerCase();
      return searchable.includes(term) && option.code !== excludedCode;
    }).slice(0, 10);
  }, [query, excludeValue]);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const persistRecentSearch = (selection) => {
    if (typeof window === 'undefined') return;
    const nextSearches = [selection, ...recentSearches.filter((item) => item.code !== selection.code)].slice(0, 5);
    setRecentSearches(nextSearches);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextSearches));
  };

  const handleSelect = (option) => {
    const selection = option.code && option.label ? option : normalizeSelection(option);
    onChange(selection);
    setQuery(selection.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
    persistRecentSearch(selection);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    setHighlightedIndex(-1);

    // If user edits text manually, clear selected code so invalid arbitrary text cannot be submitted
    if (val !== value) {
      onChange({ label: val, code: '' });
    }
  };

  const handleClear = () => {
    setQuery('');
    onChange({ label: '', code: '' });
    setIsOpen(true);
  };

  const handleKeyDown = (event) => {
    const options = filteredOptions.length ? filteredOptions : recentSearches;

    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((index) => (index + 1 + options.length) % Math.max(1, options.length));
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((index) => (index - 1 + options.length) % Math.max(1, options.length));
    }

    if (event.key === 'Enter' && highlightedIndex >= 0 && options[highlightedIndex]) {
      event.preventDefault();
      handleSelect(options[highlightedIndex]);
    }
  };

  return (
    <div className="input-box" ref={containerRef}>
      <label>{label}</label>
      <div className="airport-select">
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="airport-clear-btn"
            onClick={handleClear}
            aria-label="Clear location"
          >
            ✕
          </button>
        )}
        {isOpen && (
          <ul className="airport-list" role="listbox">
            {query.trim() ? (
              filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <li
                    key={`${option.code}-${option.city}-${index}`}
                    className={`airport-item ${highlightedIndex === index ? 'active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(option)}
                    role="option"
                    aria-selected={highlightedIndex === index}
                  >
                    <div className="airport-item-header">
                      <strong>{option.city} ({option.code})</strong>
                      <span className="airport-code-badge">{option.code}</span>
                    </div>
                    <span className="airport-subtext">{option.airport} • {option.state}</span>
                  </li>
                ))
              ) : (
                <li className="airport-item-empty">No matching airports found</li>
              )
            ) : (
              <>
                <li className="airport-list-header">Popular / Recent Airports</li>
                {(recentSearches.length ? recentSearches : airportOptions.slice(0, 6)).map((option, index) => (
                  <li
                    key={`${option.code}-${index}`}
                    className={`airport-item ${highlightedIndex === index ? 'active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(option)}
                    role="option"
                  >
                    <div className="airport-item-header">
                      <strong>{option.city || option.label}</strong>
                      {option.code && <span className="airport-code-badge">{option.code}</span>}
                    </div>
                    {option.airport && <span className="airport-subtext">{option.airport}</span>}
                  </li>
                ))}
              </>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AirportSelect;
