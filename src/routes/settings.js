const express = require('express');
const router = express.Router();
const AppSettings = require('../models/AppSettings');
const { getPublicNotifications } = require('../controllers/notificationController');
const { sendSuccess } = require('../utils/helpers');

// ── Public settings (used by usePublicSettings hook) ──────
router.get('/public', async (req, res) => {
  const KEYS = [
    'usd_to_ngn_rate',
    'min_deposit',
    'min_withdrawal',
    'withdrawal_fee_below',     // % when amount < threshold  (was withdrawal_fee_low)
    'withdrawal_fee_above',     // % when amount >= threshold (was withdrawal_fee_high)
    'withdrawal_fee_threshold',
    'withdrawal_days',
    'withdrawal_hours',
  ];

  const DEFAULTS = {
    usd_to_ngn_rate:          1560,
    min_deposit:              11.5,
    min_withdrawal:           11.5,
    withdrawal_fee_below:     16,
    withdrawal_fee_above:     10,
    withdrawal_fee_threshold: 100,
    withdrawal_days:          'Monday to Sunday',
    withdrawal_hours:         '10:00 AM – 05:00 PM',
  };

  const settings = { ...DEFAULTS };
  for (const key of KEYS) {
    const val = await AppSettings.get(key);
    if (val != null) settings[key] = val;
  }

  return sendSuccess(res, settings);
});

// ── Public notifications (user banner) ────────────────────
router.get('/notifications', getPublicNotifications);

module.exports = router;