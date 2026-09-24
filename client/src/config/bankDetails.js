/**
 * client/src/config/bankDetails.js
 *
 * ════════════════════════════════════════════════════════════════════════════
 *  ██  BANK TRANSFER ACCOUNT DETAILS — EDIT THIS SECTION  ██
 *
 *  These values are shown to customers who choose "Direct Bank Transfer" on the
 *  Confirmation page. The account number below is a PLACEHOLDER — replace it
 *  with your real receiving account before going live.
 * ════════════════════════════════════════════════════════════════════════════
 */
export const BANK_DETAILS = {
  bankName: 'Stanbic Ibtc Bank',
  accountName: 'Erastus Ekeh',
  accountNumber: '0026604913', // ← CHANGE THIS: your real account number
  instructions:
    'Transfer the exact total amount, then submit your bank transaction reference so our team can verify and confirm your booking.',
};

export default BANK_DETAILS;
