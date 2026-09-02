import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/auth.css';

function Login() {
  const handleSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <div className="auth-page">
      <Navbar />
      <div className="auth-container">
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Sign In to SharpzyTravels</h1>
          <label>
            Email Address
            <input type="email" placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input type="password" placeholder="••••••••" required />
          </label>
          <button type="submit">Sign In</button>
          <p className="auth-switch-link">
            Don't have an account? <Link to="/register">Sign up</Link>
          </p>
        </form>
      </div>
      <Footer />
    </div>
  );
}

export default Login;
