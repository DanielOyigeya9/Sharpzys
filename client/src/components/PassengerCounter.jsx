function PassengerCounter({ label, value, onIncrease, onDecrease }) {
  return (
    <div className="input-box">
      <label>{label}</label>
      <div className="passenger-counter-btn">
        <button type="button" className="counter-btn" onClick={onDecrease} aria-label={`Decrease ${label}`}>
          –
        </button>
        <span className="counter-value">{value}</span>
        <button type="button" className="counter-btn" onClick={onIncrease} aria-label={`Increase ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

export default PassengerCounter;
