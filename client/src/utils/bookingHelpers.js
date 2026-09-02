export function buildPassengerList({ adults = 0, children = 0, infants = 0 } = {}) {
  const list = [];

  for (let i = 0; i < adults; i += 1) {
    list.push({
      type: 'Adult',
      roleLabel: `Adult ${i + 1}`,
      title: 'Mr',
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'Male',
      nationality: 'Nigerian',
      passportNumber: '',
      phone: '',
      email: '',
    });
  }

  for (let i = 0; i < children; i += 1) {
    list.push({
      type: 'Child',
      roleLabel: `Child ${i + 1}`,
      title: 'Master',
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'Male',
      nationality: 'Nigerian',
      passportNumber: '',
      phone: '',
      email: '',
    });
  }

  for (let i = 0; i < infants; i += 1) {
    list.push({
      type: 'Infant',
      roleLabel: `Infant ${i + 1}`,
      title: 'Master',
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'Male',
      nationality: 'Nigerian',
      passportNumber: '',
      phone: '',
      email: '',
    });
  }

  return list;
}

export function normalizePaymentMethod(value) {
  if (!value) return 'pay_on_site';
  const normalized = String(value).trim().toLowerCase();
  if (['card', 'debit_card', 'credit_card', 'paystack', 'flutterwave', 'stripe', 'paypal'].includes(normalized)) {
    return 'pay_on_site';
  }
  if (['bank', 'bank_transfer', 'direct_bank_transfer'].includes(normalized)) {
    return 'bank_transfer';
  }
  if (normalized === 'pay_on_site') return 'pay_on_site';
  return normalized;
}

export function getPaymentLabel(value) {
  const normalized = normalizePaymentMethod(value);
  if (normalized === 'bank_transfer') return 'Direct Bank Transfer';
  return 'Pay on Site';
}
