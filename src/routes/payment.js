const express = require('express');
const router = express.Router();

const { handleCollectionCallback } = require('../controllers/depositController');
const { handlePayoutCallback } = require('../controllers/withdrawController');

// IPs the gateway calls us from (from .env). Empty => check disabled.
const ALLOWED_IPS = (process.env.PG_CALLBACK_IPS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Normalise IPv6-mapped IPv4 (e.g. ::ffff:47.236.175.174 -> 47.236.175.174)
const normaliseIp = (ip) => (ip || '').replace(/^::ffff:/, '');

// Extra guard on top of MD5 signature verification: only let the gateway's
// known IP(s) reach the callbacks. Skipped entirely if PG_CALLBACK_IPS is unset.
function restrictToGatewayIps(req, res, next) {
  if (ALLOWED_IPS.length === 0) return next();

  const candidates = [
    normaliseIp(req.ip),
    normaliseIp((req.headers['x-forwarded-for'] || '').split(',')[0].trim()),
    normaliseIp(req.socket && req.socket.remoteAddress),
  ].filter(Boolean);

  if (candidates.some((ip) => ALLOWED_IPS.includes(ip))) return next();

  console.warn('⚠️  Payment callback from unauthorised IP', candidates);
  return res.status(403).send('forbidden');
}

// Gateway -> us. Public endpoints, secured by IP allowlist + MD5 signature
// verification inside the handlers. Each replies with the literal text
// "success" so the gateway stops retrying.
router.post('/deposit/callback', restrictToGatewayIps, handleCollectionCallback);
router.post('/withdraw/callback', restrictToGatewayIps, handlePayoutCallback);

module.exports = router;