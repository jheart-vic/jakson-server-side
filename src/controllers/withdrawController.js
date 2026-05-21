const Withdrawal = require('../models/Withdrawal');
const BankAccount = require('../models/BankAccount');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppSettings = require('../models/AppSettings');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendError, calcWithdrawalFee, paginate } = require('../utils/helpers');

// @desc    Submit a withdrawal request
// @route   POST /api/withdraw
// @access  Private
const createWithdrawal = asyncHandler(async (req, res) => {
  const { amountUSD, withdrawPassword } = req.body;

  if (!amountUSD || !withdrawPassword) {
    return sendError(res, 'Amount and withdrawal password are required');
  }

  // ── Settings (all keys now match frontend & admin panel) ──
  const minWithdrawal = (await AppSettings.get('min_withdrawal'))           || 11.5;
  const feeLow        = (await AppSettings.get('withdrawal_fee_below'))      || 16;
  const feeHigh       = (await AppSettings.get('withdrawal_fee_above'))      || 10;
  const threshold     = (await AppSettings.get('withdrawal_fee_threshold'))  || 100;
  const rate          = (await AppSettings.get('usd_to_ngn_rate'))           || 1560;

  if (amountUSD < minWithdrawal) {
    return sendError(res, `Minimum withdrawal amount is $${minWithdrawal.toFixed(2)}`);
  }

  // Verify withdrawal password
  const user = await User.findById(req.user._id).select('+withdrawPassword');
  if (!user.withdrawPassword) {
    return sendError(res, 'Please set your withdrawal password first');
  }

  const isMatch = await user.compareWithdrawPassword(withdrawPassword);
  if (!isMatch) {
    return sendError(res, 'Incorrect withdrawal password');
  }

  // Check balance
  if (user.balance < amountUSD) {
    return sendError(res, 'Insufficient balance');
  }

  // Check daily withdrawal limit (1 per day)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayWithdrawal = await Withdrawal.findOne({
    user: req.user._id,
    createdAt: { $gte: today },
    status: { $in: ['pending', 'processing', 'completed'] },
  });

  if (todayWithdrawal) {
    return sendError(res, 'You can only withdraw once per day');
  }

  // Get default bank account
  const bankAccount = await BankAccount.findOne({ user: req.user._id, isDefault: true });
  if (!bankAccount) {
    return sendError(res, 'Please bind a bank account first');
  }

  // Calculate fee:
  //   amount < threshold  → feeLow  (e.g. 16%)
  //   amount >= threshold → feeHigh (e.g. 10%)
  const { feePercent, feeAmount, netAmount } = calcWithdrawalFee(amountUSD, feeLow, feeHigh, threshold);
  const netAmountNGN = +(netAmount * rate).toFixed(2);

  // Deduct from balance
  const balanceBefore = user.balance;
  user.balance -= amountUSD;
  await user.save({ validateBeforeSave: false });

  // Create withdrawal record
  const withdrawal = await Withdrawal.create({
    user: req.user._id,
    bankAccount: bankAccount._id,
    bankSnapshot: {
      bankName:      bankAccount.bankName,
      accountName:   bankAccount.accountName,
      accountNumber: bankAccount.accountNumber,
    },
    amountUSD,
    amountNGN:    +(amountUSD * rate).toFixed(2),
    exchangeRate: rate,
    feePercent,
    feeAmountUSD: feeAmount,
    netAmountUSD: netAmount,
    netAmountNGN,
  });

  // Record transaction
  await Transaction.create({
    user: req.user._id,
    type: 'out',
    category: 'withdrawal',
    amountUSD,
    balanceBefore,
    balanceAfter: user.balance,
    description: `Withdrawal to ${bankAccount.bankName} - ${bankAccount.accountNumber}`,
    refModel: 'Withdrawal',
    refId: withdrawal._id,
  });

  return sendSuccess(
    res,
    {
      withdrawal: {
        id:           withdrawal._id,
        amountUSD,
        feePercent,
        feeAmountUSD: feeAmount,
        netAmountUSD: netAmount,
        netAmountNGN,
        bankName:     bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        status:       withdrawal.status,
        createdAt:    withdrawal.createdAt,
      },
    },
    'Withdrawal request submitted successfully',
    201
  );
});

// @desc    Admin: Get all withdrawals
// @route   GET /api/admin/withdrawals
// @access  Admin
const getAllWithdrawals = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = status ? { status } : {};

  const [withdrawals, total] = await Promise.all([
    Withdrawal.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('user', 'phone'),
    Withdrawal.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    withdrawals,
    pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
  });
});

// @desc    Get withdrawal history
// @route   GET /api/withdraw/log
// @access  Private
const getWithdrawalLog = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  const [withdrawals, total] = await Promise.all([
    Withdrawal.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim),
    Withdrawal.countDocuments({ user: req.user._id }),
  ]);

  return sendSuccess(res, {
    withdrawals,
    pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
  });
});

// @desc    Admin: Approve withdrawal
// @route   PUT /api/admin/withdraw/:id/approve
// @access  Admin
const approveWithdrawal = asyncHandler(async (req, res) => {
  const withdrawal = await Withdrawal.findById(req.params.id);
  if (!withdrawal) return sendError(res, 'Withdrawal not found', 404);
  if (withdrawal.status !== 'pending') {
    return sendError(res, `Cannot approve a withdrawal with status: ${withdrawal.status}`);
  }

  withdrawal.status      = 'completed';
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  return sendSuccess(res, { withdrawal }, 'Withdrawal approved');
});

// @desc    Admin: Reject withdrawal (refund balance)
// @route   PUT /api/admin/withdraw/:id/reject
// @access  Admin
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const withdrawal = await Withdrawal.findById(req.params.id);
  if (!withdrawal) return sendError(res, 'Withdrawal not found', 404);
  if (withdrawal.status !== 'pending') {
    return sendError(res, `Cannot reject a withdrawal with status: ${withdrawal.status}`);
  }

  // Refund user balance
  const user = await User.findById(withdrawal.user);
  const balanceBefore = user.balance;
  user.balance += withdrawal.amountUSD;
  await user.save({ validateBeforeSave: false });

  withdrawal.status         = 'rejected';
  withdrawal.rejectedReason = reason || 'Rejected by admin';
  withdrawal.processedAt    = new Date();
  await withdrawal.save();

  // Record refund transaction
  await Transaction.create({
    user: withdrawal.user,
    type: 'in',
    category: 'refund',
    amountUSD: withdrawal.amountUSD,
    balanceBefore,
    balanceAfter: user.balance,
    description: `Withdrawal refunded: ${reason || 'Rejected'}`,
    refModel: 'Withdrawal',
    refId: withdrawal._id,
  });

  return sendSuccess(res, { withdrawal }, 'Withdrawal rejected and balance refunded');
});

module.exports = { createWithdrawal, getWithdrawalLog, approveWithdrawal, rejectWithdrawal, getAllWithdrawals };