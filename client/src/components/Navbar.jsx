import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavClick = (anchor, path = '/') => {
    setMobileMenuOpen(false);
    if (window.location.pathname === path && anchor) {
      const el = document.getElementById(anchor);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    navigate(path + (anchor ? `#${anchor}` : ''));
  };

  return (
    <>
      <header className="site-header">
        <Link className="logo" to="/">
          SHARPZY<span>TRAVELS</span>
        </Link>
        
        <nav className="desktop-nav">
          <a href="/#search" onClick={(e) => { e.preventDefault(); handleNavClick('search', '/'); }}>
            Book flights
          </a>
          <a href="/#destinations" onClick={(e) => { e.preventDefault(); handleNavClick('destinations', '/'); }}>
            Destinations
          </a>
          <a href="/#airlines" onClick={(e) => { e.preventDefault(); handleNavClick('airlines', '/'); }}>
            Airlines
          </a>
          <a href="/#help" onClick={(e) => { e.preventDefault(); handleNavClick('help', '/'); }}>
            Help
          </a>
          <Link to="/manage-booking">
            Manage booking
          </Link>
        </nav>

        <button
          className="menu-btn"
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          ☰
        </button>
      </header>

      {/* Mobile menu overlay */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
          ×
        </button>
        <a href="/#search" onClick={(e) => { e.preventDefault(); handleNavClick('search', '/'); }}>
          Book flights
        </a>
        <a href="/#destinations" onClick={(e) => { e.preventDefault(); handleNavClick('destinations', '/'); }}>
          Destinations
        </a>
        <a href="/#airlines" onClick={(e) => { e.preventDefault(); handleNavClick('airlines', '/'); }}>
          Airlines
        </a>
        <a href="/#help" onClick={(e) => { e.preventDefault(); handleNavClick('help', '/'); }}>
          Help
        </a>
        <Link to="/manage-booking" onClick={() => setMobileMenuOpen(false)}>
          Manage booking
        </Link>
      </div>
    </>
  );
}

export default Navbar;
