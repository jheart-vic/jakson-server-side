const express = require('express');
const router = express.Router();

const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const { approveDeposit, rejectDeposit, getAllDeposits } = require('../controllers/depositController');
const { approveWithdrawal, rejectWithdrawal } = require('../controllers/withdrawController');
const {
  createProduct, getAllProducts, updateProduct, deleteProduct,
  getAllUsers, getUserDetail, suspendUser, unsuspendUser, loginAsUser,
  creditUserWallet, deductUserWallet, getDashboard, assignRole,
} = require('../controllers/adminController');
const AppSettings = require('../models/AppSettings');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess } = require('../utils/helpers');

// All routes below require a valid token + admin role
// (superAdminOnly routes override this per-route)
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
router.put('/withdraw/:id/approve',  approveWithdrawal);
router.put('/withdraw/:id/reject',   rejectWithdrawal);

// ── App Settings ──────────────────────────────────────────
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = await AppSettings.find({});
  return sendSuccess(res, { settings });
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