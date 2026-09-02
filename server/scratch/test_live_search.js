import AlternativeAirlinesProvider from '../providers/alternativeAirlinesProvider.js';

async function test() {
  const provider = new AlternativeAirlinesProvider();
  console.log('--- STARTING TEST SEARCH: LOS -> ABV ---');
  const results = await provider.search({
    origin: 'LOS',
    destination: 'ABV',
    departureDate: '2026-08-15',
    adults: 1
  });

  console.log('--- SEARCH COMPLETE ---');
  console.log('TOTAL FLIGHTS RETURNED:', results.length);
  if (results.length > 0) {
    console.log('FIRST 3 FLIGHTS:');
    console.log(JSON.stringify(results.slice(0, 3), null, 2));
  }
}

test().catch((err) => {
  console.error('SEARCH TEST ERROR:', err);
  process.exit(1);
});
