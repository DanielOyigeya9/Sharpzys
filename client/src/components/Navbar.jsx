import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const links = [
    { to: '/', label: 'Search Flights' },
    { to: '/results', label: 'Flight Results' },
    { to: '/manage-booking', label: 'Manage Booking' },
    { to: '/admin', label: 'Admin' },
  ];

  return (
    <header className="navbar">
      <nav className="navbar-inner">
        <Link to="/" className="logo" aria-label="SharpzyTravels home">
          <span className="brand-name">SharpzyTravels</span>
        </Link>

        {/* Desktop nav */}
        <ul className="nav-links" role="list">
          {links.map(({ to, label }) => (
            <li key={to}>
              <Link
                to={to}
                className={`nav-link${location.pathname === to ? ' nav-link--active' : ''}`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <Link to="/manage-booking" className="nav-secondary-btn">
            Manage Booking
          </Link>
          <Link to="/login" className="nav-cta-btn">
            Sign In
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="nav-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className={`hamburger ${menuOpen ? 'hamburger--open' : ''}`} aria-hidden="true" />
        </button>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="nav-drawer" role="navigation" aria-label="Mobile navigation">
          <ul role="list">
            {links.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={`nav-drawer-link${location.pathname === to ? ' active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/manage-booking"
                className="nav-drawer-link"
                onClick={() => setMenuOpen(false)}
              >
                Manage Booking
              </Link>
            </li>
            <li className="drawer-actions">
              <Link
                to="/login"
                className="nav-cta-btn full-width"
                onClick={() => setMenuOpen(false)}
              >
                Sign In
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

export default Navbar;
