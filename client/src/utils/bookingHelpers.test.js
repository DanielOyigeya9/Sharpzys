import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPassengerList, normalizePaymentMethod, getPaymentLabel } from './bookingHelpers.js';

test('buildPassengerList creates one form per passenger type and count', () => {
  const passengers = buildPassengerList({ adults: 2, children: 2, infants: 1 });

  assert.equal(passengers.length, 5);
  assert.deepEqual(passengers.map((p) => p.type), ['Adult', 'Adult', 'Child', 'Child', 'Infant']);
  assert.deepEqual(passengers.map((p) => p.roleLabel), ['Adult 1', 'Adult 2', 'Child 1', 'Child 2', 'Infant 1']);
});

test('payment method values normalize to supported customer choices', () => {
  assert.equal(normalizePaymentMethod('card'), 'pay_on_site');
  assert.equal(normalizePaymentMethod('bank'), 'bank_transfer');
  assert.equal(normalizePaymentMethod('pay_on_site'), 'pay_on_site');
  assert.equal(getPaymentLabel('bank_transfer'), 'Direct Bank Transfer');
  assert.equal(getPaymentLabel('pay_on_site'), 'Pay on Site');
});
