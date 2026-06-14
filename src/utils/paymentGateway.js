/**
 * Payment Gateway client (Beidou / "四方" style MD5-signed gateway).
 *
 * Handles request signing, callback signature verification, and the
 * collection (deposit / pay-in) + payout (withdrawal / pay-out) endpoints.
 *
 * All config is read from environment variables — see .env.
 *
 * Signing rule (from the integration doc):
 *   1. Take every request parameter EXCEPT `sign` (skip null/undefined).
 *   2. Sort the keys in ascending ASCII order.
 *   3. Concatenate as  key1=value1&key2=value2&...&keyN=valueN
 *   4. Append  &<SECRET_KEY>  at the very end.
 *   5. MD5 the whole string, hex, lowercase  ->  `sign`.
 *
 * The same rule is used to verify inbound callbacks (there the plaintext
 * also includes `signType`, and excludes only `sign`).
 */

const crypto = require('crypto');
const axios = require('axios');

// ─── Config ──────────────────────────────────────────────
const CFG = {
  // e.g. https://yourdomain.com/api/order   (ask upstream for the real domain)
  baseUrl: (process.env.PG_BASE_URL || '').replace(/\/+$/, ''),
  merchantId: process.env.PG_MERCHANT_ID || '',
  secret: process.env.PG_SECRET_KEY || '',
  countryCode: process.env.PG_COUNTRY_CODE || 'NGN',
  // Payment channel codes — MUST be supplied by the upstream provider.
  depositPayType: process.env.PG_DEPOSIT_PAYTYPE || '',
  withdrawPayType: process.env.PG_WITHDRAW_PAYTYPE || '',
  // Public base URL of THIS backend, used to build callback URLs.
  // e.g. https://api.jaksonsolar.com   ->  callback https://api.jaksonsolar.com/api/payment/deposit/callback
  callbackBaseUrl: (process.env.PG_CALLBACK_BASE_URL || process.env.PUBLIC_API_URL || '').replace(/\/+$/, ''),
};

// Resource paths, taken from the "Full address" column of the doc.
// baseUrl is expected to already end with .../api/order
const PATHS = {
  balance: '/amount/balance',
  createCollection: '/api/payOrder/publicCreatePayOrder',
  queryCollection: '/api/payOrder/queryPayOrder',
  createPayout: '/api/order/publicWithdrawal',
  queryPayout: '/api/order/queryWithdrawalOrder',
};

// ─── Order status codes (from the doc) ───────────────────
const COLLECTION_STATUS = { INIT: 0, PENDING: 1, COMPLETED: 3, REFUNDED: 4, FAILED: 5 };
const PAYOUT_STATUS = { PROCESSING: 1, FROZEN: 2, COMPLETED: 3, REFUNDED: 4, FAILED: 5 };

// ─── Signing ─────────────────────────────────────────────

/**
 * Build the signing plaintext from a params object.
 * Skips `sign` and null/undefined values. Includes empty strings.
 */
function buildPlaintext(params, secret) {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign')
    .filter((k) => params[k] !== null && params[k] !== undefined)
    .sort(); // ascending ASCII by key

  const pairs = keys.map((k) => `${k}=${stringifyValue(params[k])}`);
  return pairs.join('&') + '&' + secret;
}

// The gateway treats values as their plain string form.
function stringifyValue(v) {
  if (typeof v === 'string') return v;
  return String(v);
}

function md5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex'); // lowercase hex
}

/** Sign an outgoing request. Returns the sign string. */
function sign(params) {
  return md5(buildPlaintext(params, CFG.secret));
}

/**
 * Verify an inbound callback signature.
 *
 * `rawBody` is the raw JSON text of the request. We use it to preserve the
 * exact formatting of decimal amounts (e.g. "100.00"), because once JSON is
 * parsed into JS numbers the trailing zeros are lost and the signature would
 * never match. Everything else is taken from the parsed body.
 */
function verifyCallback(parsedBody, rawBody) {
  if (!parsedBody || !parsedBody.sign) return false;

  const params = { ...parsedBody };
  delete params.sign;

  // Preserve raw formatting for known decimal field(s).
  const rawTransAmt = extractRawNumber(rawBody, 'transAmt');
  if (rawTransAmt !== null) params.transAmt = rawTransAmt;

  const expected = md5(buildPlaintext(params, CFG.secret));
  const provided = String(parsedBody.sign).toLowerCase();

  // constant-time-ish compare
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/** Pull the raw numeric token for a key out of the raw JSON text. */
function extractRawNumber(rawBody, key) {
  if (!rawBody || typeof rawBody !== 'string') return null;
  const m = rawBody.match(new RegExp('"' + key + '"\\s*:\\s*("?)([0-9]+(?:\\.[0-9]+)?)\\1'));
  return m ? m[2] : null;
}

// ─── HTTP ────────────────────────────────────────────────

async function post(path, payload) {
  if (!CFG.baseUrl) throw new Error('PG_BASE_URL is not configured');
  if (!CFG.secret) throw new Error('PG_SECRET_KEY is not configured');

  const body = { ...payload, sign: sign(payload) };
  const url = CFG.baseUrl + path;

  const { data } = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
  });
  return data; // { code, msg, data }
}

// ─── Public API ──────────────────────────────────────────

/**
 * Create a collection (deposit / pay-in) order.
 * Returns { ok, payUrl, raw }. payUrl is the hosted page to redirect the user to.
 */
async function createCollectionOrder({ merchantOrderId, amount, ip, orderRemark }) {
  const payload = {
    merchantId: CFG.merchantId,
    merchantOrderId,
    transAmt: amount, // local currency (NGN) amount
    payType: CFG.depositPayType,
    countryCode: CFG.countryCode,
    ip: ip || '127.0.0.1',
  };
  if (orderRemark) payload.orderRemark = orderRemark;
  if (CFG.callbackBaseUrl) payload.callbackUrl = CFG.callbackBaseUrl + '/api/payment/deposit/callback';

  const res = await post(PATHS.createCollection, payload);
  return { ok: res && res.code === 200, payUrl: res && res.data, raw: res };
}

/**
 * Create a payout (withdrawal / pay-out) order.
 * Returns { ok, raw }.
 */
async function createPayoutOrder({ merchantOrderId, amount, account, name, bnkCode, ip, remark }) {
  const payload = {
    merchantId: CFG.merchantId,
    merchantOrderId,
    transAmt: amount, // NOTE: Nigeria payouts must be whole numbers
    account,
    name,
    bnkCode,
    payType: CFG.withdrawPayType,
    countryCode: CFG.countryCode,
    ip: ip || '127.0.0.1',
  };
  if (remark) payload.remark = remark;
  if (CFG.callbackBaseUrl) payload.callbackUrl = CFG.callbackBaseUrl + '/api/payment/withdraw/callback';

  const res = await post(PATHS.createPayout, payload);
  return { ok: res && res.code === 200, raw: res };
}

async function queryCollectionOrder(merchantOrderId) {
  return post(PATHS.queryCollection, { merchantId: CFG.merchantId, merchantOrderId });
}

async function queryPayoutOrder(merchantOrderId) {
  return post(PATHS.queryPayout, { merchantId: CFG.merchantId, merchantOrderId });
}

async function getBalance() {
  return post(PATHS.balance, { merchantId: CFG.merchantId, countryCode: CFG.countryCode });
}

function isConfigured() {
  return Boolean(CFG.baseUrl && CFG.merchantId && CFG.secret);
}

module.exports = {
  CFG,
  COLLECTION_STATUS,
  PAYOUT_STATUS,
  sign,
  verifyCallback,
  createCollectionOrder,
  createPayoutOrder,
  queryCollectionOrder,
  queryPayoutOrder,
  getBalance,
  isConfigured,
};
