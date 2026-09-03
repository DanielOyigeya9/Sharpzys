import AirportSelect from './AirportSelect';

function MultiCitySegment({ segments, setSegments }) {
  const handleSegmentChange = (index, field, value) => {
    setSegments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddSegment = () => {
    if (segments.length >= 4) return;
    const lastSeg = segments[segments.length - 1];
    setSegments((prev) => [
      ...prev,
      {
        from: lastSeg ? lastSeg.to : { label: '', code: '' },
        to: { label: '', code: '' },
        departureDate: '',
      },
    ]);
  };

  const handleRemoveSegment = (index) => {
    if (segments.length <= 2) return;
    setSegments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="multicity-container">
      {segments.map((seg, idx) => (
        <div className="multicity-row" key={`segment-${idx}`}>
          <div className="segment-badge">Flight {idx + 1}</div>
          <div className="location-group">
            <AirportSelect
              label="Where from?"
              value={seg.from.label}
              onChange={(val) => handleSegmentChange(idx, 'from', val)}
              placeholder="Origin airport or city"
              excludeValue={seg.to.code}
            />

            <AirportSelect
              label="Where to?"
              value={seg.to.label}
              onChange={(val) => handleSegmentChange(idx, 'to', val)}
              placeholder="Destination airport or city"
              excludeValue={seg.from.code}
            />
          </div>

          <div className="input-box">
            <label>Date</label>
            <input
              type="date"
              value={seg.departureDate}
              onChange={(e) => handleSegmentChange(idx, 'departureDate', e.target.value)}
              required
            />
          </div>

          {segments.length > 2 && (
            <button
              type="button"
              className="remove-segment-btn"
              onClick={() => handleRemoveSegment(idx)}
              aria-label={`Remove Flight ${idx + 1}`}
            >
              ✕
            </button>
          )}
        </div>
      ))}

      {segments.length < 4 && (
        <button type="button" className="add-flight-leg-btn" onClick={handleAddSegment}>
          + Add another flight
        </button>
      )}
    </div>
  );
}

export default MultiCitySegment;
