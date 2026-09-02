import Navbar from "../components/Navbar";
import BookingForm from "../components/BookingForm";
import "../styles/home.css";

function Home() {
    return (
        <div className="home">
            <Navbar />

            <section className="hero">
                <div className="overlay"></div>

                <div className="hero-content">
                    <h1 className="desktop-hero-title">Flight Ticket Booking</h1>
                    <p className="desktop-hero-desc">Best prices · Flexible options · 500+ airlines worldwide</p>

                    <BookingForm />

                    {/* ── Trustpilot / Reviews section ── */}
                    <div className="trust-section">
                        <p className="trust-title">Loved by millions worldwide</p>
                        <div className="trust-row">
                            <div className="trust-stars-group">
                                <span className="green-star-box">★</span>
                                <span className="green-star-box">★</span>
                                <span className="green-star-box">★</span>
                                <span className="green-star-box">★</span>
                                <span className="green-star-box">★</span>
                            </div>
                            <div className="trust-text-details">
                                <span className="reviews-count">31,447 reviews on</span>
                                <span className="trustpilot-brand">
                                    <span className="tp-star">★</span> Trustpilot
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <footer>
                © 2026 FlyNow. All Rights Reserved.
            </footer>
        </div>
    );
}

export default Home;