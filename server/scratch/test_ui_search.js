import searchBot from '../bots/searchBot.js';
import parser from '../bots/parser.js';

async function test() {
  console.log('--- STARTING WIDGET FORM SEARCH: LOS -> ABV (2026-08-20) ---');
  // Pass returnDate as undefined but force form search test
  const searchParams = {
    origin: 'LOS',
    destination: 'ABV',
    departureDate: '2026-08-20',
    adults: 1,
    returnDate: '2026-08-27' // force interactive form path
  };

  const rawPayloads = await searchBot.runSearch(searchParams);
  console.log('RAW PAYLOADS CAPTURED:', rawPayloads.length);

  const flights = parser.parse(rawPayloads);
  console.log('PARSED FLIGHTS COUNT:', flights.length);

  if (flights.length > 0) {
    console.log('SAMPLE FLIGHT 1:', JSON.stringify(flights[0], null, 2));
  }
}

test().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
