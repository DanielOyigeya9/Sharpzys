import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          {/* Col 1: Brand & Reassurance */}
          <div className="footer-brand-col">
            <Link to="/" className="footer-logo">
              <span>SharpzyTravels</span>
            </Link>
            <p className="footer-mission">
              SharpzyTravels elevates your journey with curated domestic flights, competitive pricing, and exceptional service. Experience premium travel made simple.
            </p>
            <div className="footer-payment-badges">
              <span className="payment-badge">Mastercard</span>
              <span className="payment-badge">Visa</span>
              <span className="payment-badge">Verve</span>
              <span className="payment-badge">Bank Transfer</span>
            </div>
          </div>

          {/* Col 2: Popular Domestic Routes */}
          <div className="footer-col">
            <h4 className="footer-heading">Top Routes</h4>
            <ul className="footer-links">
              <li><Link to="/">Lagos to Abuja (LOS–ABV)</Link></li>
              <li><Link to="/">Lagos to Port Harcourt (LOS–PHC)</Link></li>
              <li><Link to="/">Lagos to Kano (LOS–KAN)</Link></li>
              <li><Link to="/">Abuja to Enugu (ABV–ENU)</Link></li>
              <li><Link to="/">Lagos to Owerri (LOS–QOW)</Link></li>
            </ul>
          </div>

          {/* Col 3: Services & Support */}
          <div className="footer-col">
            <h4 className="footer-heading">Travel Services</h4>
            <ul className="footer-links">
              <li><Link to="/manage-booking">Manage Booking</Link></li>
              <li><Link to="/results">Search Flights</Link></li>
              <li><Link to="/">Baggage Allowance</Link></li>
              <li><Link to="/">Airline Directory</Link></li>
              <li><Link to="/">Customer Help Center</Link></li>
            </ul>
          </div>

          {/* Col 4: Trust & Contact */}
          <div className="footer-col">
            <h4 className="footer-heading">Customer Desk</h4>
            <p className="footer-contact-item">
              <strong>Help & Enquiries:</strong><br />
              support@sharpzytravels.com
            </p>
            <p className="footer-contact-item">
              <strong>Operating Hours:</strong><br />
              Mon – Sun: 24/7 Availability
            </p>
            <div className="security-tag">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sec-icon">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <span>256-Bit SSL Encrypted</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} SharpzyTravels. All rights reserved.</p>
          <div className="footer-legal-links">
            <Link to="/">Privacy Policy</Link>
            <span className="dot">•</span>
            <Link to="/">Terms of Service</Link>
            <span className="dot">•</span>
            <Link to="/">Carrier Rules</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
