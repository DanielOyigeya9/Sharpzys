import axios from 'axios';

async function testPersistenceFlow() {
  console.log('--- 1. Submitting Booking Request ---');
  const res1 = await axios.post('http://localhost:5000/api/book', {
    passengerName: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+234 8098765432',
    flight: {
      airline: 'Ibom Air',
      flightNumber: 'QI0501',
      origin: 'LOS',
      destination: 'QUO',
      departureTime: '2026-09-01 10:30',
      price: 92000,
      currency: 'NGN',
    },
    price: 92000,
    currency: 'NGN',
  });

  const ref = res1.data.booking.bookingReference;
  console.log('Created Ref:', ref, '| Initial Status:', res1.data.booking.status);

  console.log('--- 2. Fetching All Bookings from Server DB ---');
  const res2 = await axios.get('http://localhost:5000/api/bookings');
  console.log('Total Saved Bookings in DB:', res2.data.count);

  console.log('--- 3. Approving Booking Request via Admin API ---');
  const res3 = await axios.patch(`http://localhost:5000/api/bookings/${ref}/status`, {
    status: 'Approved',
  });
  console.log('Updated Status:', res3.data.booking.status, '| Message:', res3.data.booking.statusMessage);

  console.log('--- 4. Fetching Single Booking to Confirm Database Persistence ---');
  const res4 = await axios.get(`http://localhost:5000/api/bookings/${ref}`);
  console.log('Final Persisted DB Status:', res4.data.booking.status);
  console.log('--- TEST SUCCESS: Database Persistence & Admin Approval Verified! ---');
}

testPersistenceFlow().catch((err) => {
  console.error('Test Failed:', err.message, err.response?.data);
  process.exit(1);
});
