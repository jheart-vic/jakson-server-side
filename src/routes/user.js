const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getBankAccounts,
  getBankList,
  bindBankAccount,
  getBalance,
  getTransactions,
  getTeamStats,
  getTierMembers,
  redeemCode,
  dailyCheckin,
} = require('../controllers/userController');

// Wallet
router.get('/wallet/balance', protect, getBalance);
router.get('/wallet/transactions', protect, getTransactions);

// Bank accounts
router.get('/bank/list', protect, getBankList);
router.get('/bank/accounts', protect, getBankAccounts);
router.post('/bank/bind', protect, bindBankAccount);

// Team / Referral
router.get('/team/stats', protect, getTeamStats);
router.get('/team/members/:tier', protect, getTierMembers);

// Rewards & Checkin
router.post('/reward/redeem', protect, redeemCode);
router.post('/checkin', protect, dailyCheckin);

module.exports = router;
