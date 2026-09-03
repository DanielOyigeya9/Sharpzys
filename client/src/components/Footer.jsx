import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer id="manage">
      <div className="footer-main">
        <div>
          <Link className="logo" to="/">
            SHARPZY<span>TRAVELS</span>
          </Link>
          <p>Simple flight booking with human support.</p>
        </div>
        <div>
          <h4>Book</h4>
          <a href="/#search">Search flights</a>
          <a href="/#destinations">Destinations</a>
        </div>
        <div>
          <h4>Support</h4>
          <a href="/#help">FAQs</a>
          <a href="/#help">Contact us</a>
        </div>
        <div>
          <h4>Manage</h4>
          <Link to="/manage-booking">Manage booking</Link>
          <a href="/#help">Terms</a>
        </div>
      </div>
      <div className="footer-bottom">© {new Date().getFullYear()} SharpzyTravels. All rights reserved.</div>
    </footer>
  );
}

export default Footer;
