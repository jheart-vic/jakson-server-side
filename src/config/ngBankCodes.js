/**
 * Maps the bank names stored on a user's BankAccount to the `bnkCode` value
 * the payment gateway expects for Nigerian payouts.
 *
 * ⚠️  ACTION REQUIRED:
 * The right-hand-side codes below are PLACEHOLDERS. The integration doc does
 * not list the Nigerian bank codes — you must get the official code list from
 * the upstream gateway provider and paste the real codes here.
 *
 * Keys MUST match the bank names in BankAccount.NIGERIAN_BANKS exactly
 * (they are normalised to uppercase before lookup).
 */

const NG_BANK_CODES = {
  'ACCESS BANK': 'ACCESS BANK PLC',
  'ECOBANK': 'ECOBANK NIGERIA PLC',
  'EYOWO MFB': 'EYOWO MICROFINANCE BANK',
  'FCMB BANK': 'FIRST CITY MONUMENT BANK',
  'FIDELITY BANK': 'FIDELITY BANK PLC',
  'FIRST BANK': 'FIRST BANK OF NIGERIA PLC',
  'GTBANK PLC': 'GUARANTY TRUST BANK PLC',
  'GLOBUS BANK': 'Globus Bank',
  'HERITAGE BANK': 'HERITAGE BANK',
  'JAIZ BANK': 'JAIZ BANK',
  'KEYSTONE BANK': 'KEYSTONE BANK PLC',
  'KUDA BANK': 'Kuda Microfinance Bank',
  'MONIEPOINT': 'Moniepoint Microfinance Bank',
  'OPAY': 'OPay',
  'PAGA': 'Paga',
  'PROVIDUS BANK': 'Providus Bank',
  'STANBIC IBTC BANK': 'STANBIC IBTC BANK PLC',
  'STERLING BANK': 'STERLING BANK PLC',
  'SUNTRUST BANK': 'SUNTRUST BANK',
  'TAJ BANK': 'TAJ BANK',
  'TITAN TRUST BANK': 'TITAN TRUST BANK',
  'UBA BANK': 'UNITED BANK FOR AFRICA PLC',
  'UNION BANK': 'UNION BANK OF NIGERIA PLC',
  'UNITY BANK': 'UNITY BANK PLC',
  'WEMA BANK': 'WEMA BANK PLC',
  'ZENITH BANK': 'Zenith Bank',
};

/** Returns the gateway bank code for a stored bank name, or null if unknown/unfilled. */
function getBankCode(bankName) {
  if (!bankName) return null;
  const code = NG_BANK_CODES[bankName.trim().toUpperCase()];
  return code ? code : null;
}

module.exports = { NG_BANK_CODES, getBankCode };
