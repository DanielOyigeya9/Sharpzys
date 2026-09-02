import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/auth.css';

function Register() {
  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <div className="auth-page">
      <Navbar />
      <div className="auth-container">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Create SharpzyTravels Account</h1>
          <label>
            Full Name
            <input type="text" placeholder="e.g. Jane Doe" required />
          </label>
          <label>
            Email Address
            <input type="email" placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input type="password" placeholder="••••••••" required />
          </label>
          <button type="submit">Create Account</button>
          <p className="auth-switch-link">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </div>
      <Footer />
    </div>
  );
}

export default Register;
