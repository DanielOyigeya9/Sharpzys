import axios from 'axios';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiBaseUrl = rawApiUrl ? `${rawApiUrl}/api` : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Admin auth token (hardcoded admin login, no third-party provider) ─────────
const ADMIN_TOKEN_KEY = 'sharpzy_admin_token';

export const getAdminToken = () => {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAdminToken = (token) => {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* storage unavailable (SSR/private mode) — ignore */
  }
};

export const clearAdminToken = () => setAdminToken(null);

// Attach the admin bearer token to admin/booking-management requests so the
// server-side requireAdmin middleware accepts them. Public customer calls are
// left untouched.
api.interceptors.request.use((config) => {
  const url = config.url || '';
  const isAdminRoute = /\/(admin|bookings)/.test(url) && !/\/admin\/login$/.test(url);
  const token = getAdminToken();
  if (isAdminRoute && token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const searchFlights = async (payload) => {
  const response = await api.post('/flights/search', payload);
  return response.data;
};

export const createBooking = async (payload) => {
  const response = await api.post('/book', payload);
  return response.data;
};

export const getBookings = async () => {
  const response = await api.get('/bookings');
  return response.data;
};

export const getBookingByRef = async (ref, email) => {
  const params = email ? `?email=${encodeURIComponent(email)}` : '';
  const response = await api.get(`/bookings/${encodeURIComponent(ref)}${params}`);
  return response.data;
};

export const updateBookingStatus = async (ref, status, statusMessage) => {
  const response = await api.patch(`/bookings/${encodeURIComponent(ref)}/status`, {
    status,
    statusMessage,
  });
  return response.data;
};

export const updateAirlinePnr = async (ref, airlinePnr) => {
  const response = await api.patch(`/bookings/${encodeURIComponent(ref)}/pnr`, {
    airlinePnr,
  });
  return response.data;
};

// Customer self-service: submit the bank-transfer transaction reference after
// clicking "I have paid". Public route (no admin token required).
export const submitBookingPayment = async (ref, transactionId) => {
  const response = await api.post(`/bookings/${encodeURIComponent(ref)}/payment`, {
    transactionId,
  });
  return response.data;
};

// Admin-only: mark a submitted bank-transfer payment as verified (or revert).
export const verifyBookingPayment = async (ref, verified = true) => {
  const response = await api.patch(`/bookings/${encodeURIComponent(ref)}/verify-payment`, {
    verified,
  });
  return response.data;
};

// ─── Admin login + health ──────────────────────────────────────────────────────
export const adminLogin = async (username, password) => {
  const response = await api.post('/admin/login', { username, password });
  if (response.data?.token) setAdminToken(response.data.token);
  return response.data;
};

export const adminLogout = () => clearAdminToken();

export const getAdminHealth = async () => {
  const response = await api.get('/admin/health');
  return response.data;
};

export default api;
