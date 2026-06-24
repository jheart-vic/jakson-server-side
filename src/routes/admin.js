const express = require('express');
const router = express.Router();

const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const { approveDeposit, rejectDeposit, getAllDeposits } = require('../controllers/depositController');
const { approveWithdrawal, rejectWithdrawal, getAllWithdrawals } = require('../controllers/withdrawController');
const {
  createProduct, getAllProducts, updateProduct, deleteProduct,
  getAllUsers, getUserDetail, suspendUser, unsuspendUser, loginAsUser,
  creditUserWallet, deductUserWallet, getDashboard, assignRole,
  createWealthFund, getAllWealthFunds, updateWealthFund, deleteWealthFund, deactivateWealthFund,
  createBonusCode, getAllBonusCodes, toggleBonusCode, deleteBonusCode,
  exitImpersonation,
  getUserSecurity,
  adminVerifySecurityAnswer,
  adminResetUserPassword,
} = require('../controllers/adminController');

const AppSettings = require('../models/AppSettings');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess } = require('../utils/helpers');
const { createNotification, getAllNotifications, updateNotification, deleteNotification } = require('../controllers/notificationController');
router.post('/users/exit-impersonation', protect, exitImpersonation);


router.use(protect, adminOnly);

// ── Dashboard ─────────────────────────────────────────────
router.get('/dashboard', getDashboard);

// ── Product Management ────────────────────────────────────
router.get   ('/products',        getAllProducts);
router.post  ('/products',        createProduct);
router.put   ('/products/:id',    updateProduct);
router.delete('/products/:id',    deleteProduct);

// ── User Management ───────────────────────────────────────
router.get ('/users',                getAllUsers);
router.get ('/users/:id',            getUserDetail);
router.put ('/users/:id/suspend',    suspendUser);
router.put ('/users/:id/unsuspend',  unsuspendUser);
router.post('/users/:id/login-as',   loginAsUser);
router.get ('/users/:id/security',        getUserSecurity);
router.post('/users/:id/verify-security-answer', adminVerifySecurityAnswer);
router.post('/users/:id/reset-password',  adminResetUserPassword);

// ── Role Assignment (superadmin only) ─────────────────────
router.put('/users/:id/role', superAdminOnly, assignRole);

// ── Wallet Operations ─────────────────────────────────────
router.post('/users/:id/credit',  creditUserWallet);
router.post('/users/:id/deduct',  deductUserWallet);

// ── Deposit Management ────────────────────────────────────
router.get('/deposits',              getAllDeposits);
router.put('/deposits/:id/approve',  approveDeposit);
router.put('/deposits/:id/reject',   rejectDeposit);

// ── Withdrawal Management ─────────────────────────────────
router.get('/withdrawals',           getAllWithdrawals);
router.put('/withdraw/:id/approve',  approveWithdrawal);
router.put('/withdraw/:id/reject',   rejectWithdrawal);

// ── Wealth Funds ──────────────────────────────────────────
router.post  ('/wealth-funds',     createWealthFund);
router.get   ('/wealth-funds',     getAllWealthFunds);
router.put   ('/wealth-funds/:id', updateWealthFund);
router.patch('/wealth-funds/:id/deactivate', deactivateWealthFund);
router.delete('/wealth-funds/:id', deleteWealthFund);

// ── Bonus Codes ───────────────────────────────────────────
router.post  ('/bonus-codes',          createBonusCode);
router.get   ('/bonus-codes',          getAllBonusCodes);
router.put   ('/bonus-codes/:id/toggle', toggleBonusCode);
router.delete('/bonus-codes/:id',      deleteBonusCode);

// ── Notifications / Announcements ─────────────────────────
router.post  ('/notifications',     createNotification);
router.get   ('/notifications',     getAllNotifications);
router.put   ('/notifications/:id', updateNotification);
router.delete('/notifications/:id', deleteNotification);

// ── App Settings ──────────────────────────────────────────
// Canonical defaults — keys MUST match withdrawController.js and usePublicSettings.js
const SETTING_DEFAULTS = {
  usd_to_ngn_rate:          1560,
  min_deposit:              11.5,
  min_withdrawal:           11.5,
  withdrawal_fee_below:     16,
  withdrawal_fee_above:     10,
  withdrawal_fee_threshold: 100,
  withdrawal_days:          'Monday to Sunday',
  withdrawal_hours:         '10:00 AM – 05:00 PM',
  payment_bank_account: { bankName: '', accountNumber: '', accountName: '' },
};

router.get('/settings', asyncHandler(async (req, res) => {
  const settingsArray = await AppSettings.find({});
  const dbSettings = {};
  settingsArray.forEach(s => { dbSettings[s.key] = s.value; });
  // DB values win; SETTING_DEFAULTS fill any gaps
  const settings = { ...SETTING_DEFAULTS, ...dbSettings };
  return sendSuccess(res, settings);
}));

router.put('/settings', asyncHandler(async (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ success: false, message: 'key and value are required' });
  }
  const setting = await AppSettings.set(key, value);
  return sendSuccess(res, { setting }, 'Setting updated');
}));

module.exports = router;