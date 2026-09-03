import '../styles/loading-overlay.css';

function SearchLoadingOverlay({ isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="search-loading-overlay" role="dialog" aria-label="Searching flights">
      <div className="loading-card-minimal">
        {/* Subtle, elegant flight spinner */}
        <div className="subtle-spinner-wrap">
          <div className="subtle-spinner"></div>
          <span className="spinner-plane-icon" aria-hidden="true">✈</span>
        </div>

        {/* Minimal text messaging */}
        <h3 className="loading-title-minimal">Searching flights</h3>
        <p className="loading-subtitle-minimal">Finding available options...</p>
      </div>
    </div>
  );
}

export default SearchLoadingOverlay;
