import '../styles/loading-overlay.css';

/**
 * SearchLoadingOverlay
 * A simple full-screen loading indicator shown while a flight search runs.
 * (Air Peace is now a normal provider — there is no interactive verification flow.)
 */
function SearchLoadingOverlay({ isVisible }) {
  if (!isVisible) return null;

  return (
    <div className="search-loading-overlay" role="dialog" aria-label="Flight search progress">
      <div className="loading-card-minimal">
        <div className="subtle-spinner-wrap">
          <div className="subtle-spinner" />
          <span className="spinner-plane-icon" aria-hidden="true">✈</span>
        </div>
        <h3 className="loading-title-minimal">Searching flights...</h3>
        <p className="loading-subtitle-minimal">
          Finding available options across airlines...
        </p>
      </div>
    </div>
  );
}

export default SearchLoadingOverlay;
