import axios from 'axios';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiBaseUrl = rawApiUrl ? `${rawApiUrl}/api` : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
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

export default api;
