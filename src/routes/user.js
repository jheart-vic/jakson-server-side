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
const{
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} = require('../controllers/userNotificationController');

// ── Wallet ────────────────────────────────────────────────
router.get('/wallet/balance',      protect, getBalance);
router.get('/wallet/transactions', protect, getTransactions);

// ── Bank accounts ─────────────────────────────────────────
router.get ('/bank/list',     protect, getBankList);
router.get ('/bank/accounts', protect, getBankAccounts);
router.post('/bank/bind',     protect, bindBankAccount);

// ── Team / Referral ───────────────────────────────────────
router.get('/team/stats',          protect, getTeamStats);
router.get('/team/members/:tier',  protect, getTierMembers);

// ── Rewards & Check-in ────────────────────────────────────
router.post('/reward/redeem', protect, redeemCode);
router.post('/checkin',       protect, dailyCheckin);

// ── User Notifications ────────────────────────────────────
router.get   ('/notifications',              protect, getUserNotifications);
router.get   ('/notifications/unread-count', protect, getUnreadCount);
router.put   ('/notifications/read-all',     protect, markAllAsRead);
router.delete('/notifications/all',          protect, deleteAllNotifications);
router.put   ('/notifications/:id/read',     protect, markAsRead);
router.delete('/notifications/:id',          protect, deleteNotification);

module.exports = router;