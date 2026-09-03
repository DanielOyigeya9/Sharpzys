function TripTabs({ activeTrip, onChange }) {
  const tabs = [
    { key: 'round', label: 'Round trip' },
    { key: 'oneway', label: 'One way' },
    { key: 'multicity', label: 'Multi-city' },
  ];

  return (
    <div className="trip-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={activeTrip === tab.key ? 'trip-tab-btn active' : 'trip-tab-btn'}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default TripTabs;

