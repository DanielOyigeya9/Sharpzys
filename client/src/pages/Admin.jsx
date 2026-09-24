import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getBookings, updateBookingStatus, updateAirlinePnr, getAdminHealth, adminLogin, getAdminToken, clearAdminToken, verifyBookingPayment } from '../services/api';
import '../styles/admin.css';

function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [updatingRef, setUpdatingRef] = useState(null);

  // Provider health + search analytics (admin-only diagnostics)
  const [metrics, setMetrics] = useState(null);
  const [healthError, setHealthError] = useState(null);

  // PNR Edit inline modal state
  const [pnrModalBooking, setPnrModalBooking] = useState(null);
  const [pnrInput, setPnrInput] = useState('');

  // ── Admin auth (hardcoded login; no third-party DB/provider) ──
  const [isAuthed, setIsAuthed] = useState(() => !!getAdminToken());
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const forceLogout = () => {
    clearAdminToken();
    setIsAuthed(false);
    setBookings([]);
    setMetrics(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    try {
      await adminLogin(loginUsername, loginPassword);
      setIsAuthed(true);
      setLoginPassword('');
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getBookings();
      setBookings(response.bookings || []);
    } catch (err) {
      if (err.response?.status === 401) { forceLogout(); return; }
      setError(err.response?.data?.message || err.message || 'Failed to load booking requests from database.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHealthData = async () => {
    setHealthError(null);
    try {
      const response = await getAdminHealth();
      setMetrics(response.metrics || null);
    } catch (err) {
      if (err.response?.status === 401) { forceLogout(); return; }
      setHealthError(err.response?.data?.message || err.message || 'Failed to load provider health metrics.');
    }
  };

  useEffect(() => {
    if (!isAuthed) {
      setIsLoading(false);
      return;
    }
    fetchDashboardData();
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    fetchHealthData();
    const timer = setInterval(fetchHealthData, 30000);
    return () => clearInterval(timer);
  }, [isAuthed]);

  const handleStatusChange = async (ref, newStatus) => {
    setUpdatingRef(ref);
    try {
      const response = await updateBookingStatus(ref, newStatus);
      const updated = response.booking;
      setBookings((prev) =>
        prev.map((b) => (b.bookingReference === ref ? updated : b))
      );
      if (selectedBooking && selectedBooking.bookingReference === ref) {
        setSelectedBooking(updated);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update booking status in database.';
      alert(msg);
    } finally {
      setUpdatingRef(null);
    }
  };

  const handlePnrSubmit = async (e) => {
    e?.preventDefault();
    if (!pnrModalBooking) return;
    const ref = pnrModalBooking.bookingReference;
    setUpdatingRef(ref);

    try {
      const response = await updateAirlinePnr(ref, pnrInput);
      const updated = response.booking;
      setBookings((prev) =>
        prev.map((b) => (b.bookingReference === ref ? updated : b))
      );
      if (selectedBooking && selectedBooking.bookingReference === ref) {
        setSelectedBooking(updated);
      }
      setPnrModalBooking(null);
      setPnrInput('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update Airline PNR in database.');
    } finally {
      setUpdatingRef(null);
    }
  };

  const handleVerifyPayment = async (ref, verified = true) => {
    setUpdatingRef(ref);
    try {
      const response = await verifyBookingPayment(ref, verified);
      const updated = response.booking;
      setBookings((prev) =>
        prev.map((b) => (b.bookingReference === ref ? updated : b))
      );
      if (selectedBooking && selectedBooking.bookingReference === ref) {
        setSelectedBooking(updated);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update payment verification.');
    } finally {
      setUpdatingRef(null);
    }
  };

  const openPnrModal = (booking) => {
    setPnrModalBooking(booking);
    setPnrInput(booking.airlinePnr || '');
  };

  // Compute statistics from database records
  const stats = useMemo(() => {
    const total = bookings.length;
    const pending = bookings.filter((b) => (b.status || '').toLowerCase() === 'pending').length;
    const approved = bookings.filter((b) => (b.status || '').toLowerCase() === 'approved').length;
    const confirmed = bookings.filter((b) => ['confirmed', 'ticketed', 'completed'].includes((b.status || '').toLowerCase())).length;
    const rejected = bookings.filter((b) => ['rejected', 'cancelled'].includes((b.status || '').toLowerCase())).length;

    return {
      total,
      pending,
      approved,
      confirmed,
      rejected,
    };
  }, [bookings]);

  // Filter bookings list based on search query
  const filteredBookings = useMemo(() => {
    if (!searchFilter.trim()) return bookings;
    const query = searchFilter.toLowerCase();
    return bookings.filter((b) => {
      const searchables = [
        b.bookingReference,
        b.airlinePnr,
        b.passengerName,
        b.email,
        b.phone,
        b.flight?.origin,
        b.flight?.destination,
        b.flight?.airline,
        b.flight?.flightNumber,
        b.status,
      ].map((v) => (v || '').toLowerCase());

      return searchables.some((s) => s.includes(query));
    });
  }, [bookings, searchFilter]);

  if (!isAuthed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '1rem' }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '380px', background: '#ffffff', borderRadius: '16px', padding: '2rem', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.75rem' }}>✈</span>
            <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', color: '#0f172a' }}>SharpzyTravels Admin</h1>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>Restricted — authorized staff only</p>
          </div>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#334155' }}>
            Username
            <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} autoComplete="username" required style={{ width: '100%', marginTop: '0.25rem', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
          </label>
          <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.85rem', color: '#334155' }}>
            Password
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" required style={{ width: '100%', marginTop: '0.25rem', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }} />
          </label>
          {loginError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{loginError}</p>}
          <button type="submit" disabled={isLoggingIn} style={{ width: '100%', padding: '0.7rem', borderRadius: '8px', border: 'none', background: '#1d4ed8', color: '#fff', fontSize: '0.95rem', fontWeight: 600, cursor: isLoggingIn ? 'not-allowed' : 'pointer', opacity: isLoggingIn ? 0.7 : 1 }}>
            {isLoggingIn ? 'Signing in…' : 'Sign In'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link to="/" style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'none' }}>← Back to site</Link>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* ── Sidebar Navigation ────────────────────────────────────────── */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="admin-logo">
            <span className="logo-icon">✈</span>
            <div className="logo-text">
              <strong>SharpzyTravels</strong>
              <span className="admin-tag">Admin Panel</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={forceLogout}
            aria-label="Sign out of admin"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', borderRadius: '8px', padding: '4px 10px', fontSize: '0.72rem', cursor: 'pointer', marginLeft: 'auto' }}
          >
            Sign out
          </button>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            type="button"
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('bookings'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">📋</span>
            <span>Booking Requests</span>
            {stats.pending > 0 && <span className="badge-count">{stats.pending}</span>}
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'searches' ? 'active' : ''}`}
            onClick={() => { setActiveTab('searches'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">🔍</span>
            <span>Supported Airlines</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'health' ? 'active' : ''}`}
            onClick={() => { setActiveTab('health'); setSidebarOpen(false); fetchHealthData(); }}
          >
            <span className="nav-icon">🩺</span>
            <span>Provider Health</span>
          </button>

          <button
            type="button"
            className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => { setActiveTab('customers'); setSidebarOpen(false); }}
          >
            <span className="nav-icon">👥</span>
            <span>Customers</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="ops-status">
            <span className="status-dot green"></span>
            <div>
              <strong>SharpzyTravels Ops Desk</strong>
              <p>Database Synced</p>
            </div>
          </div>
          <Link to="/" className="exit-admin-btn">← Back to SharpzyTravels</Link>
        </div>
      </aside>

      {/* ── Main Dashboard Content ────────────────────────────────────── */}
      <div className="admin-main">
        {/* Top Header */}
        <header className="admin-header">
          <div className="header-left">
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <h1 className="header-title">
              {activeTab === 'dashboard' && 'Dashboard Overview'}
              {activeTab === 'bookings' && 'Flight Booking Requests'}
              {activeTab === 'searches' && 'Supported Airlines & Routes'}
              {activeTab === 'health' && 'Provider Health & Search Analytics'}
              {activeTab === 'customers' && 'Customer Records'}
            </h1>
          </div>

          <div className="header-right">
            <button
              type="button"
              className="refresh-btn"
              onClick={() => { fetchDashboardData(); fetchHealthData(); }}
              title="Refresh Data from Server DB"
              disabled={isLoading}
            >
              🔄 {isLoading ? 'Syncing...' : 'Refresh DB'}
            </button>
            <div className="admin-user-badge">
              <div className="avatar">ST</div>
              <div className="user-info">
                <strong>SharpzyTravels Ops</strong>
                <span>Administrator</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="admin-body">
          {/* Loading State */}
          {isLoading && (
            <div className="admin-loading-state">
              <div className="admin-spinner"></div>
              <h3>Loading dashboard...</h3>
              <p>Fetching server-persisted database records</p>
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="admin-error-banner">
              <div className="error-icon">⚠️</div>
              <div className="error-text">
                <h3>Error Fetching Database Records</h3>
                <p>{error}</p>
              </div>
              <button type="button" className="retry-btn" onClick={fetchDashboardData}>
                Try Again
              </button>
            </div>
          )}

          {/* Main Dashboard Views (when not loading) */}
          {!isLoading && !error && (
            <>
              {/* ── Statistics Summary Cards ───────────────────────────────── */}
              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon blue">📋</div>
                  <div className="stat-content">
                    <span className="stat-label">Total Bookings</span>
                    <strong className="stat-value">{stats.total}</strong>
                    <span className="stat-sub">Persistent DB records</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon orange">⏳</div>
                  <div className="stat-content">
                    <span className="stat-label">Pending Requests</span>
                    <strong className="stat-value">{stats.pending}</strong>
                    <span className="stat-sub">Awaiting admin review</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon blue">👍</div>
                  <div className="stat-content">
                    <span className="stat-label">Approved</span>
                    <strong className="stat-value">{stats.approved}</strong>
                    <span className="stat-sub">Approved by ops</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon green">✅</div>
                  <div className="stat-content">
                    <span className="stat-label">Confirmed (PNR)</span>
                    <strong className="stat-value">{stats.confirmed}</strong>
                    <span className="stat-sub">Airline PNR assigned</span>
                  </div>
                </div>
              </section>

              {/* ── Search Analytics (Dashboard only) ─────────────────────── */}
              {activeTab === 'dashboard' && metrics && (
                <section className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon blue">🔎</div>
                    <div className="stat-content">
                      <span className="stat-label">Total Searches</span>
                      <strong className="stat-value">{metrics.searches.total}</strong>
                      <span className="stat-sub">Since server start</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon green">✅</div>
                    <div className="stat-content">
                      <span className="stat-label">Successful Searches</span>
                      <strong className="stat-value">{metrics.searches.successful}</strong>
                      <span className="stat-sub">{metrics.searches.withResults} with results · {metrics.searches.empty} empty</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon orange">⚠️</div>
                    <div className="stat-content">
                      <span className="stat-label">Failed Searches</span>
                      <strong className="stat-value">{metrics.searches.failed}</strong>
                      <span className="stat-sub">Errors / timeouts</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon blue">🩺</div>
                    <div className="stat-content">
                      <span className="stat-label">Providers Healthy</span>
                      <strong className="stat-value">
                        {metrics.providers.filter((p) => p.health === 'HEALTHY').length}/{metrics.providers.length}
                      </strong>
                      <span className="stat-sub">See Provider Health tab</span>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Tab Views: Dashboard & Booking Requests ───────────────── */}
              {(activeTab === 'dashboard' || activeTab === 'bookings') && (
                <section className="table-section-card">
                  <div className="table-header-bar">
                    <div>
                      <h2>Booking Requests & Airline PNR Management</h2>
                      <p>Review booking requests, approve requests, and assign real Airline PNRs.</p>
                    </div>

                    <div className="table-search-box">
                      <input
                        type="text"
                        placeholder="Search Booking ID, PNR, passenger, email, route..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Empty State */}
                  {filteredBookings.length === 0 ? (
                    <div className="admin-empty-state">
                      <div className="empty-illustration">📄</div>
                      <h3>No booking requests found.</h3>
                      <p>When customers submit flight booking requests on SharpzyTravels, they will be persisted to the database and appear here.</p>
                    </div>
                  ) : (
                    /* Booking Requests Data Table */
                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>SharpzyTravels Booking ID</th>
                            <th>Customer</th>
                            <th>Airline</th>
                            <th>Route</th>
                            <th>Travel Date</th>
                            <th>Payment</th>
                            <th>Status</th>
                            <th>Airline PNR</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBookings.map((b, idx) => {
                            const statusLower = (b.status || '').toLowerCase();
                            const isPending = statusLower === 'pending';
                            const isApproved = statusLower === 'approved';
                            const isConfirmed = ['confirmed', 'ticketed', 'completed'].includes(statusLower);
                            const isRejected = ['rejected', 'cancelled'].includes(statusLower);
                            const isUpdating = updatingRef === b.bookingReference;

                            return (
                              <tr key={b.bookingReference || idx}>
                                <td>
                                  <span className="ref-code">{b.bookingReference}</span>
                                </td>
                                <td>
                                  <strong>{b.passengerName || 'N/A'}</strong>
                                  <div className="sub-text">{b.email}</div>
                                </td>
                                <td>
                                  <span className="airline-badge">{b.flight?.airline || 'Carrier'}</span>
                                </td>
                                <td>
                                  <span className="airport-badge">{b.flight?.origin || 'N/A'} → {b.flight?.destination || 'N/A'}</span>
                                  {(b.tripType === 'roundTrip' || b.returnFlight) && (
                                    <div style={{ marginTop: 3 }}>
                                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4338ca', background: '#eef2ff', borderRadius: 6, padding: '1px 6px' }}>RT · {b.returnFlight?.origin || '?'}→{b.returnFlight?.destination || '?'}</span>
                                    </div>
                                  )}
                                </td>
                                <td>{b.flight?.departureTime || b.flight?.departureDate || 'N/A'}</td>
                                <td>
                                  <span className="sub-text">
                                    {b.paymentMethod === 'bank_transfer' || b.paymentMethod === 'bank' ? 'Bank Transfer' : 'Pay on Site'}
                                  </span>
                                  {b.paymentTransactionId && (
                                    <div style={{ marginTop: 2 }}>
                                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: b.paymentStatus === 'verified' ? '#047857' : '#b45309' }}>
                                        💳 {b.paymentTransactionId}{b.paymentStatus === 'submitted' ? ' · Verify' : ''}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <span className={`status-pill ${statusLower}`}>
                                    ● {b.status || 'Pending'}
                                  </span>
                                </td>
                                <td>
                                  {b.airlinePnr ? (
                                    <span className="pnr-badge-assigned">{b.airlinePnr}</span>
                                  ) : (
                                    <span className="pnr-badge-unassigned">Not assigned</span>
                                  )}
                                </td>
                                <td>
                                  {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'N/A'}
                                </td>
                                <td>
                                  <div className="action-buttons-cell">
                                    {b.paymentStatus === 'submitted' && (
                                      <button
                                        type="button"
                                        className="approve-btn"
                                        style={{ background: '#0ea5e9' }}
                                        onClick={() => handleVerifyPayment(b.bookingReference, true)}
                                        disabled={isUpdating}
                                        title="Confirm the bank transfer matches your statement"
                                      >
                                        {isUpdating ? '...' : '✓ Verify Payment'}
                                      </button>
                                    )}
                                    {b.paymentStatus === 'verified' && (
                                      <button
                                        type="button"
                                        className="pnr-btn"
                                        onClick={() => handleVerifyPayment(b.bookingReference, false)}
                                        disabled={isUpdating}
                                        title="Payment verified — click to revert"
                                      >
                                        ✓ Paid
                                      </button>
                                    )}
                                    {isPending && (
                                      <>
                                        <button
                                          type="button"
                                          className="approve-btn"
                                          onClick={() => handleStatusChange(b.bookingReference, 'Approved')}
                                          disabled={isUpdating}
                                        >
                                          {isUpdating ? '...' : 'Approve'}
                                        </button>
                                        <button
                                          type="button"
                                          className="reject-btn"
                                          onClick={() => handleStatusChange(b.bookingReference, 'Rejected')}
                                          disabled={isUpdating}
                                        >
                                          {isUpdating ? '...' : 'Reject'}
                                        </button>
                                      </>
                                    )}

                                    {isApproved && (
                                      <>
                                        <button
                                          type="button"
                                          className="pnr-btn"
                                          onClick={() => openPnrModal(b)}
                                          disabled={isUpdating}
                                        >
                                          + Add PNR
                                        </button>
                                        <button
                                          type="button"
                                          className="reject-btn"
                                          onClick={() => handleStatusChange(b.bookingReference, 'Rejected')}
                                          disabled={isUpdating}
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}

                                    {isConfirmed && (
                                      <button
                                        type="button"
                                        className="pnr-btn edit"
                                        onClick={() => openPnrModal(b)}
                                        disabled={isUpdating}
                                      >
                                        Edit PNR
                                      </button>
                                    )}

                                    {isRejected && (
                                      <button
                                        type="button"
                                        className="approve-btn"
                                        onClick={() => handleStatusChange(b.bookingReference, 'Approved')}
                                        disabled={isUpdating}
                                      >
                                        Re-Approve
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="view-details-btn"
                                      onClick={() => setSelectedBooking(b)}
                                    >
                                      Details
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* ── Tab View: Supported Airlines & Routes ─────────────────── */}
              {activeTab === 'searches' && (
                <section className="table-section-card">
                  <div className="table-header-bar">
                    <div>
                      <h2>SharpzyTravels Supported Airlines Focus</h2>
                      <p>Domestic carrier focus configured for SharpzyTravels.</p>
                    </div>
                  </div>
                  <div className="supported-airlines-grid">
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>Air Peace (P4 / AP)</h3>
                      <p>Air Peace domestic route network.</p>
                    </div>
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>Ibom Air (QI / IA)</h3>
                      <p>Ibom Air Uyo, Lagos, Abuja regional routes.</p>
                    </div>
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>Aero Contractors (N2 / MN)</h3>
                      <p>Aero domestic passenger flights.</p>
                    </div>
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>ValueJet (VK)</h3>
                      <p>ValueJet modern domestic passenger flights.</p>
                    </div>
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>Enugu Air (E3 / EG)</h3>
                      <p>Enugu regional regional flight routes.</p>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Tab View: Provider Health & Search Analytics ─────────── */}
              {activeTab === 'health' && (
                <section className="table-section-card">
                  <div className="table-header-bar">
                    <div>
                      <h2>Live Provider Health Monitoring</h2>
                      <p>Per-provider operational status. Technical diagnostics are visible to admins only — customers always see friendly messages.</p>
                    </div>
                    <div className="table-search-box">
                      <button type="button" className="retry-btn" onClick={fetchHealthData}>Refresh</button>
                    </div>
                  </div>

                  {healthError && (
                    <div className="admin-error-banner">
                      <div className="error-icon">⚠️</div>
                      <div className="error-text"><h3>Provider health unavailable</h3><p>{healthError}</p></div>
                    </div>
                  )}

                  {metrics && (
                    <>
                      <div className="supported-airlines-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="airline-card-supported">
                          <div className="icon">🔎</div>
                          <h3>{metrics.searches.total} searches</h3>
                          <p>{metrics.searches.successful} successful · {metrics.searches.failed} failed · {metrics.searches.withResults} returned flights</p>
                        </div>
                      </div>

                      {metrics.providers.length === 0 ? (
                        <div className="admin-empty-state">
                          <div className="empty-illustration">🩺</div>
                          <h3>No provider activity recorded yet.</h3>
                          <p>Provider health will appear once flight searches have been run against the live carriers.</p>
                        </div>
                      ) : (
                        <div className="table-responsive">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th>Provider</th>
                                <th>Health</th>
                                <th>Last Status</th>
                                <th>Success / Errors</th>
                                <th>Avg Response</th>
                                <th>Last Success</th>
                                <th>Last Error (admin)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {metrics.providers.map((p) => (
                                <tr key={p.provider}>
                                  <td><strong>{p.provider}</strong><div className="sub-text">{p.total} invocations</div></td>
                                  <td>
                                    <span className={`status-pill ${(p.health || 'unknown').toLowerCase()}`}>
                                      ● {p.health}
                                    </span>
                                  </td>
                                  <td>
                                    {p.lastStatus || '—'}
                                    {p.lastCount != null && p.lastStatus === 'SUCCESS' && (
                                      <div className="sub-text">{p.lastCount} flights</div>
                                    )}
                                  </td>
                                  <td>
                                    <span style={{ color: '#16a34a' }}>{p.success}</span> /{' '}
                                    <span style={{ color: '#dc2626' }}>{p.error}</span>
                                    <div className="sub-text">{p.noResults} empty · {p.verification} awaiting verification</div>
                                  </td>
                                  <td>{p.avgResponseTimeMs != null ? `${p.avgResponseTimeMs} ms` : '—'}</td>
                                  <td>{p.lastSuccessAt ? new Date(p.lastSuccessAt).toLocaleString() : '—'}</td>
                                  <td>
                                    {p.lastErrorAt ? (
                                      <>
                                        <div>{new Date(p.lastErrorAt).toLocaleString()}</div>
                                        <div className="sub-text">{p.lastErrorType}{p.lastErrorMessage ? ` · ${p.lastErrorMessage}` : ''}</div>
                                      </>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}

                  {!metrics && !healthError && (
                    <div className="admin-empty-state">
                      <div className="admin-spinner"></div>
                      <p>Loading provider health…</p>
                    </div>
                  )}
                </section>
              )}

              {/* ── Tab View: Customers ───────────────────────────────────── */}
              {activeTab === 'customers' && (
                <section className="table-section-card">
                  <div className="table-header-bar">
                    <div>
                      <h2>Customer Directory</h2>
                      <p>Unique customer profiles extracted from database records.</p>
                    </div>
                  </div>
                  {bookings.length === 0 ? (
                    <div className="admin-empty-state">
                      <div className="empty-illustration">👥</div>
                      <h3>No customer records found.</h3>
                      <p>Customer contact details will be compiled automatically as bookings are created.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Customer Name</th>
                            <th>Email Address</th>
                            <th>Phone Number</th>
                            <th>Bookings Count</th>
                            <th>Latest Booking ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(new Set(bookings.map((b) => b.email))).map((email) => {
                            const customerBookings = bookings.filter((b) => b.email === email);
                            const latest = customerBookings[0];
                            return (
                              <tr key={email}>
                                <td><strong>{latest?.passengerName}</strong></td>
                                <td>{email}</td>
                                <td>{latest?.phone || 'N/A'}</td>
                                <td>{customerBookings.length}</td>
                                <td><span className="ref-code">{latest?.bookingReference}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Booking Detail Modal ──────────────────────────────────────── */}
      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="ref-tag">SharpzyTravels Booking Reference: {selectedBooking.bookingReference}</span>
                <h2>Booking Detail Record</h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedBooking(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item highlighted-field">
                  <span className="detail-label">SHARPZYTRAVELS BOOKING REFERENCE</span>
                  <strong className="detail-val ref-code-lg">{selectedBooking.bookingReference}</strong>
                </div>

                <div className="detail-item highlighted-field">
                  <span className="detail-label">AIRLINE PNR</span>
                  <strong className="detail-val pnr-val">
                    {selectedBooking.airlinePnr ? selectedBooking.airlinePnr : 'Not assigned'}
                  </strong>
                </div>

                <div className="detail-item">
                  <span className="detail-label">AIRLINE CARRIER</span>
                  <strong className="detail-val">{selectedBooking.flight?.airline} ({selectedBooking.flight?.flightNumber || 'Direct'})</strong>
                </div>

                <div className="detail-item">
                  <span className="detail-label">BOOKING STATUS</span>
                  <span className={`status-pill ${(selectedBooking.status || 'pending').toLowerCase()}`}>
                    ● {selectedBooking.status || 'Pending'}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Payment Method</span>
                  <strong className="detail-val">{selectedBooking.paymentMethod === 'bank_transfer' || selectedBooking.paymentMethod === 'bank' ? 'Direct Bank Transfer' : 'Pay on Site'}</strong>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Payment Status</span>
                  <strong className="detail-val">
                    {selectedBooking.paymentStatus === 'submitted'
                      ? 'Payment submitted — VERIFY'
                      : selectedBooking.paymentStatus === 'verified'
                        ? 'Payment verified ✓'
                        : selectedBooking.paymentStatus === 'awaiting_payment'
                          ? 'Awaiting payment'
                          : selectedBooking.paymentStatus === 'pay_on_site'
                            ? 'Pay on site (cash)'
                            : (selectedBooking.paymentStatus || '—')}
                  </strong>
                </div>

                {selectedBooking.paymentTransactionId && (
                  <div className="detail-item highlighted-field">
                    <span className="detail-label">BANK TRANSACTION REFERENCE (verify against your statement)</span>
                    <strong className="detail-val" style={{ fontFamily: 'monospace' }}>{selectedBooking.paymentTransactionId}</strong>
                    {selectedBooking.paymentSubmittedAt && (
                      <span className="sub-text">Submitted {new Date(selectedBooking.paymentSubmittedAt).toLocaleString()}</span>
                    )}
                  </div>
                )}

                <div className="detail-item">
                  <span className="detail-label">Booking Contact</span>
                  <strong className="detail-val">{selectedBooking.passengerName}</strong>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Contact Email</span>
                  <strong className="detail-val">{selectedBooking.email}</strong>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Phone Number</span>
                  <strong className="detail-val">{selectedBooking.phone || 'N/A'}</strong>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Trip Type</span>
                  <strong className="detail-val">{(selectedBooking.tripType === 'roundTrip' || selectedBooking.returnFlight) ? 'Round trip' : 'One way'}</strong>
                </div>

                <div className="detail-item">
                  <span className="detail-label">{(selectedBooking.tripType === 'roundTrip' || selectedBooking.returnFlight) ? 'Outbound Route' : 'Flight Route'}</span>
                  <strong className="detail-val">{selectedBooking.flight?.origin} → {selectedBooking.flight?.destination}</strong>
                </div>

                {(selectedBooking.tripType === 'roundTrip' || selectedBooking.returnFlight) && selectedBooking.returnFlight && (
                  <div className="detail-item highlighted-field">
                    <span className="detail-label">Return Route</span>
                    <strong className="detail-val">{selectedBooking.returnFlight.origin} → {selectedBooking.returnFlight.destination}</strong>
                    <span className="sub-text">
                      {selectedBooking.returnFlight.airline} {selectedBooking.returnFlight.flightNumber || ''} · {selectedBooking.returnFlight.departureDate || selectedBooking.returnFlight.departureTime || ''}
                    </span>
                  </div>
                )}

                <div className="detail-item">
                  <span className="detail-label">Departure Date</span>
                  <strong className="detail-val">{selectedBooking.flight?.departureTime || selectedBooking.flight?.departureDate || 'N/A'}</strong>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Total Fare</span>
                  <strong className="detail-val highlight">
                    {selectedBooking.currency === 'NGN' ? '₦' : '$'}
                    {Number(selectedBooking.price || 0).toLocaleString()}
                  </strong>
                </div>
              </div>

              {(selectedBooking.passengers?.length || 0) > 0 && (
                <div className="modal-note-box">
                  <strong>Passenger Forms ({selectedBooking.passengers.length}):</strong>
                  <div className="passenger-list-admin">
                    {selectedBooking.passengers.map((passenger, idx) => (
                      <div key={`${passenger.roleLabel || passenger.type || 'passenger'}-${idx}`} className="admin-passenger-entry">
                        <strong>{passenger.roleLabel || `${passenger.type || 'Passenger'} ${idx + 1}`}</strong>
                        <span>{passenger.title || 'Mr'} {passenger.firstName || ''} {passenger.lastName || ''}</span>
                        <small>{passenger.dateOfBirth ? `DOB: ${passenger.dateOfBirth}` : ''}</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedBooking.statusMessage && (
                <div className="modal-note-box">
                  ℹ️ {selectedBooking.statusMessage}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {selectedBooking.paymentStatus === 'submitted' && (
                <button
                  type="button"
                  className="approve-btn modal-btn"
                  style={{ background: '#0ea5e9' }}
                  onClick={() => handleVerifyPayment(selectedBooking.bookingReference, true)}
                  disabled={updatingRef === selectedBooking.bookingReference}
                >
                  {updatingRef === selectedBooking.bookingReference ? '...' : '✓ Verify Payment'}
                </button>
              )}
              {selectedBooking.paymentStatus === 'verified' && (
                <button
                  type="button"
                  className="pnr-btn modal-btn"
                  onClick={() => handleVerifyPayment(selectedBooking.bookingReference, false)}
                  disabled={updatingRef === selectedBooking.bookingReference}
                >
                  {updatingRef === selectedBooking.bookingReference ? '...' : '✓ Payment Verified (revert)'}
                </button>
              )}
              <button
                type="button"
                className="pnr-btn modal-btn"
                onClick={() => {
                  const b = selectedBooking;
                  setSelectedBooking(null);
                  openPnrModal(b);
                }}
              >
                {selectedBooking.airlinePnr ? '✏️ Edit Airline PNR' : '➕ Add Airline PNR'}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => window.print()}
              >
                🖨️ Print Record
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedBooking(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Airline PNR Input Modal ───────────────────────────────────── */}
      {pnrModalBooking && (
        <div className="modal-overlay" onClick={() => setPnrModalBooking(null)}>
          <div className="modal-card modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Airline PNR</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPnrModalBooking(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePnrSubmit}>
              <div className="modal-body">
                <p className="pnr-modal-desc">
                  Enter the official reservation <strong>Airline PNR</strong> code received from <strong>{pnrModalBooking.flight?.airline || 'the carrier'}</strong> for SharpzyTravels Booking Reference <code>{pnrModalBooking.bookingReference}</code>.
                </p>

                <div className="form-group">
                  <label htmlFor="airline-pnr-input">Official Airline PNR Code</label>
                  <input
                    id="airline-pnr-input"
                    type="text"
                    className="pnr-input-field"
                    placeholder="e.g. ABC123"
                    value={pnrInput}
                    onChange={(e) => setPnrInput(e.target.value.toUpperCase())}
                    autoFocus
                  />
                  <span className="field-help">This will save to the database and update status to Confirmed.</span>
                </div>
              </div>

              <div className="modal-footer">
                {pnrModalBooking.airlinePnr && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={async () => {
                      setPnrInput('');
                      await updateAirlinePnr(pnrModalBooking.bookingReference, '');
                      fetchDashboardData();
                      setPnrModalBooking(null);
                    }}
                  >
                    Clear PNR
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setPnrModalBooking(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={updatingRef === pnrModalBooking.bookingReference}
                >
                  {updatingRef === pnrModalBooking.bookingReference ? 'Saving...' : 'Save Airline PNR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
