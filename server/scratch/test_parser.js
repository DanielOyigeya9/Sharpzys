import parser from '../bots/parser.js';
import fs from 'fs';

const path = './server/debug/2026-08-08T11-59-44-110Z/flight-results-10.json';
const raw = fs.readFileSync(path, 'utf8');
const json = JSON.parse(raw);

const flights = parser.parse([json]);
console.log('PARSED TOTAL FLIGHTS:', flights.length);
if (flights.length > 0) {
  console.log('SAMPLE FLIGHT 1:', JSON.stringify(flights[0], null, 2));
  console.log('SAMPLE FLIGHT 2:', JSON.stringify(flights[1], null, 2));
}
