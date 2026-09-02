import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getBookings, updateBookingStatus, updateAirlinePnr } from '../services/api';
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

  // PNR Edit inline modal/prompt state
  const [pnrModalBooking, setPnrModalBooking] = useState(null);
  const [pnrInput, setPnrInput] = useState('');

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getBookings();
      setBookings(response.bookings || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load booking requests from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
            <span>Flights / Supported</span>
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
              <strong>Operations Desk</strong>
              <p>Server DB Synced</p>
            </div>
          </div>
          <Link to="/" className="exit-admin-btn">← Back to Site</Link>
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
              {activeTab === 'customers' && 'Customer Records'}
            </h1>
          </div>

          <div className="header-right">
            <button
              type="button"
              className="refresh-btn"
              onClick={fetchDashboardData}
              title="Refresh Data from Server DB"
              disabled={isLoading}
            >
              🔄 {isLoading ? 'Syncing...' : 'Refresh DB'}
            </button>
            <div className="admin-user-badge">
              <div className="avatar">OP</div>
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
              <p>Fetching server-persisted booking records</p>
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
                    <span className="stat-sub">Real PNR assigned</span>
                  </div>
                </div>
              </section>

              {/* ── Tab Views: Dashboard & Booking Requests ───────────────── */}
              {(activeTab === 'dashboard' || activeTab === 'bookings') && (
                <section className="table-section-card">
                  <div className="table-header-bar">
                    <div>
                      <h2>Booking Requests & Airline PNR Management</h2>
                      <p>Review booking requests, approve requests, and enter real carrier Airline PNRs.</p>
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
                            <th>Status</th>
                            <th>Airline PNR</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBookings.map((b) => {
                            const statusLower = (b.status || '').toLowerCase();
                            const isPending = statusLower === 'pending';
                            const isApproved = statusLower === 'approved';
                            const isConfirmed = ['confirmed', 'ticketed', 'completed'].includes(statusLower);
                            const isRejected = ['rejected', 'cancelled'].includes(statusLower);
                            const isUpdating = updatingRef === b.bookingReference;

                            return (
                              <tr key={b.bookingReference || Math.random()}>
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
                                </td>
                                <td>{b.flight?.departureTime || b.flight?.departureDate || 'N/A'}</td>
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
                      <h2>Supported Airlines System</h2>
                      <p>Flight search results are strictly restricted to these 5 supported carriers.</p>
                    </div>
                  </div>
                  <div className="supported-airlines-grid">
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>Air Peace (P4 / AP)</h3>
                      <p>Full support for domestic routes across Nigeria.</p>
                    </div>
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>Ibom Air (QI / IA)</h3>
                      <p>Uyo, Lagos, Abuja, Calabar, Enugu, Port Harcourt hubs.</p>
                    </div>
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>Aero Contractors (N2 / MN)</h3>
                      <p>Aero regional and domestic flight networks.</p>
                    </div>
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>ValueJet (VK)</h3>
                      <p>ValueJet modern domestic passenger flights.</p>
                    </div>
                    <div className="airline-card-supported">
                      <div className="icon">✈</div>
                      <h3>Enugu Air (E3 / EG)</h3>
                      <p>Enugu regional connection flights.</p>
                    </div>
                  </div>
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
                      <p>Customer contact details will be automatically compiled as bookings are created.</p>
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
                <span className="ref-tag">SharpzyTravels Booking ID: {selectedBooking.bookingReference}</span>
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
                  <span className="detail-label">SHARPZYTRAVELS BOOKING ID</span>
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
                  <span className="detail-label">Primary Passenger</span>
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
                  <span className="detail-label">Flight Route</span>
                  <strong className="detail-val">{selectedBooking.flight?.origin} → {selectedBooking.flight?.destination}</strong>
                </div>

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
                  <strong>Passengers:</strong>
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
                  Enter the official reservation <strong>Airline PNR</strong> code received from <strong>{pnrModalBooking.flight?.airline || 'the carrier'}</strong> for SharpzyTravels Booking ID <code>{pnrModalBooking.bookingReference}</code>.
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
