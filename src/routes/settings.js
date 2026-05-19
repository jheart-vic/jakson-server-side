const express = require('express');
const router = express.Router();
const AppSettings = require('../models/AppSettings');
const { sendSuccess } = require('../utils/helpers');

router.get('/public', async (req, res) => {
  const keys = [
    'usd_to_ngn_rate',
    'min_deposit',
    'min_withdrawal',
    'withdrawal_fee_low',
    'withdrawal_fee_high',
    'withdrawal_fee_threshold',
    'withdrawal_days',
    'withdrawal_hours'
  ];
  const settings = {};
  for (const key of keys) {
    settings[key] = await AppSettings.get(key);
  }
  // defaults
  if (!settings.usd_to_ngn_rate) settings.usd_to_ngn_rate = 1560;
  if (!settings.min_deposit) settings.min_deposit = 11.5;
  if (!settings.min_withdrawal) settings.min_withdrawal = 11.5;
  if (!settings.withdrawal_fee_low) settings.withdrawal_fee_low = 10;
  if (!settings.withdrawal_fee_high) settings.withdrawal_fee_high = 20;
  if (!settings.withdrawal_fee_threshold) settings.withdrawal_fee_threshold = 500;
  if (!settings.withdrawal_days) settings.withdrawal_days = "Monday to Friday";
  if (!settings.withdrawal_hours) settings.withdrawal_hours = "10:00 AM – 06:00 PM";

  return sendSuccess(res, settings);
});

module.exports = router;