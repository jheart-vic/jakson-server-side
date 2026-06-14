const Withdrawal = require('../models/Withdrawal');
const BankAccount = require('../models/BankAccount');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppSettings = require('../models/AppSettings');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendError, calcWithdrawalFee, paginate } = require('../utils/helpers');
const { notify } = require('../utils/userNotify');
const gateway = require('../utils/paymentGateway');
const { getBankCode } = require('../config/ngBankCodes');

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || '127.0.0.1';

/**
 * Refund a withdrawal back to the user's wallet. Idempotent: only refunds when
 * the withdrawal is still pending/processing, so repeated callbacks are safe.
 */
async function refundWithdrawal(withdrawal, reason) {
  if (!['pending', 'processing'].includes(withdrawal.status)) return withdrawal;

  const user = await User.findById(withdrawal.user);
  const balanceBefore = user.balance;
  user.balance += withdrawal.amountUSD;
  await user.save({ validateBeforeSave: false });

  withdrawal.status = 'rejected';
  withdrawal.rejectedReason = reason || 'Payout failed';
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  await Transaction.create({
    user: withdrawal.user,
    type: 'in',
    category: 'refund',
    amountUSD: withdrawal.amountUSD,
    balanceBefore,
    balanceAfter: user.balance,
    description: `Withdrawal refunded: ${reason || 'Payout failed'}`,
    refModel: 'Withdrawal',
    refId: withdrawal._id,
  });

  notify(withdrawal.user, {
    type: 'withdrawal',
    title: 'Withdrawal Failed ❌',
    body: `Your withdrawal of $${withdrawal.amountUSD.toFixed(2)} could not be completed and has been refunded. Reason: ${reason || 'Payout failed'}.`,
    metadata: { amountUSD: withdrawal.amountUSD, withdrawalId: withdrawal._id },
  });

  return withdrawal;
}

async function completeWithdrawal(withdrawal) {
  if (withdrawal.status === 'completed') return withdrawal;

  withdrawal.status = 'completed';
  withdrawal.processedAt = new Date();
  await withdrawal.save();

  notify(withdrawal.user, {
    type: 'withdrawal',
    title: 'Withdrawal Completed ✅',
    body: `Your withdrawal of $${withdrawal.netAmountUSD.toFixed(2)} to ${withdrawal.bankSnapshot.bankName} has been paid out.`,
    metadata: { netAmountUSD: withdrawal.netAmountUSD, withdrawalId: withdrawal._id },
  });

  return withdrawal;
}

// @desc    Submit a withdrawal (sends a gateway payout order)
// @route   POST /api/withdraw
// @access  Private
const createWithdrawal = asyncHandler(async (req, res) => {
  const { amountUSD, withdrawPassword } = req.body;

  if (!amountUSD || !withdrawPassword) {
    return sendError(res, 'Amount and withdrawal password are required');
  }

  if (!gateway.isConfigured()) {
    return sendError(res, 'Payment gateway is not configured. Please try again later.', 503);
  }

  // ── Settings ──
  const minWithdrawal = (await AppSettings.get('min_withdrawal'))          || 11.5;
  const feeLow        = (await AppSettings.get('withdrawal_fee_below'))     || 16;
  const feeHigh       = (await AppSettings.get('withdrawal_fee_above'))     || 10;
  const threshold     = (await AppSettings.get('withdrawal_fee_threshold')) || 100;
  const rate          = (await AppSettings.get('usd_to_ngn_rate'))          || 1560;

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

  // Daily withdrawal limit (1 per day)
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

  // Default bank account
  const bankAccount = await BankAccount.findOne({ user: req.user._id, isDefault: true });
  if (!bankAccount) {
    return sendError(res, 'Please bind a bank account first');
  }

  // Bank code required by the gateway for Nigerian payouts
  const bnkCode = getBankCode(bankAccount.bankName);
  if (!bnkCode) {
    return sendError(
      res,
      `Withdrawals to ${bankAccount.bankName} are not available right now. Please contact support.`
    );
  }

  // Fee + net amounts
  const { feePercent, feeAmount, netAmount } = calcWithdrawalFee(amountUSD, feeLow, feeHigh, threshold);
  const netAmountNGN = +(netAmount * rate).toFixed(2);
  const payoutNGN = Math.round(netAmountNGN); // Nigeria requires whole numbers

  // Deduct from balance up-front
  const balanceBefore = user.balance;
  user.balance -= amountUSD;
  await user.save({ validateBeforeSave: false });

  // Create withdrawal record (status pending until the gateway accepts it)
  const withdrawal = await Withdrawal.create({
    user: req.user._id,
    bankAccount: bankAccount._id,
    bankSnapshot: {
      bankName: bankAccount.bankName,
      accountName: bankAccount.accountName,
      accountNumber: bankAccount.accountNumber,
    },
    amountUSD,
    amountNGN: +(amountUSD * rate).toFixed(2),
    exchangeRate: rate,
    feePercent,
    feeAmountUSD: feeAmount,
    netAmountUSD: netAmount,
    netAmountNGN,
  });

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

  // Submit payout to the gateway
  try {
    const result = await gateway.createPayoutOrder({
      merchantOrderId: withdrawal._id.toString(),
      amount: payoutNGN,
      account: bankAccount.accountNumber,
      name: bankAccount.accountName,
      bnkCode,
      ip: clientIp(req),
    });

    if (!result.ok) {
      const reason = (result.raw && result.raw.msg) || 'Gateway rejected the payout';
      await refundWithdrawal(withdrawal, reason);
      return sendError(res, `Withdrawal could not be processed: ${reason}`);
    }

    withdrawal.status = 'processing';
    await withdrawal.save();
  } catch (err) {
    await refundWithdrawal(withdrawal, 'Gateway error: ' + err.message);
    return sendError(res, 'Payment gateway is temporarily unavailable. Your balance was not charged.', 502);
  }

  notify(req.user._id, {
    type: 'withdrawal',
    title: 'Withdrawal Submitted 📤',
    body: `Your withdrawal of $${amountUSD.toFixed(2)} (net $${netAmount.toFixed(2)}) to ${bankAccount.bankName} is being processed.`,
    metadata: { amountUSD, netAmountUSD: netAmount, withdrawalId: withdrawal._id },
  });

  return sendSuccess(
    res,
    {
      withdrawal: {
        id: withdrawal._id,
        amountUSD,
        feePercent,
        feeAmountUSD: feeAmount,
        netAmountUSD: netAmount,
        netAmountNGN,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
      },
    },
    'Withdrawal request submitted successfully',
    201
  );
});

// @desc    Gateway payout (withdrawal) callback
// @route   POST /api/payment/withdraw/callback
// @access  Public (signature-verified)
const handlePayoutCallback = asyncHandler(async (req, res) => {
  const ok = gateway.verifyCallback(req.body, req.rawBody);
  if (!ok) {
    console.warn('⚠️  Withdrawal callback signature verification FAILED', req.body);
    return res.status(400).send('sign error');
  }

  const { merchantOrderId, orderStatus, remark } = req.body;
  const withdrawal = await Withdrawal.findById(merchantOrderId);
  if (!withdrawal) return res.send('success'); // ack unknown records

  const status = Number(orderStatus);
  if (status === gateway.PAYOUT_STATUS.COMPLETED) {
    await completeWithdrawal(withdrawal);
  } else if (
    status === gateway.PAYOUT_STATUS.FAILED ||
    status === gateway.PAYOUT_STATUS.REFUNDED
  ) {
    await refundWithdrawal(withdrawal, remark || 'Payout failed at gateway');
  }
  // status 1 (processing) / 2 (frozen) -> leave as processing, just acknowledge.

  return res.send('success');
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

// @desc    Admin: Mark withdrawal completed (manual override / reconciliation)
// @route   PUT /api/admin/withdraw/:id/approve
// @access  Admin
const approveWithdrawal = asyncHandler(async (req, res) => {
  const withdrawal = await Withdrawal.findById(req.params.id);
  if (!withdrawal) return sendError(res, 'Withdrawal not found', 404);
  if (!['pending', 'processing'].includes(withdrawal.status)) {
    return sendError(res, `Cannot complete a withdrawal with status: ${withdrawal.status}`);
  }

  await completeWithdrawal(withdrawal);
  return sendSuccess(res, { withdrawal }, 'Withdrawal marked completed');
});

// @desc    Admin: Reject withdrawal (refund balance)
// @route   PUT /api/admin/withdraw/:id/reject
// @access  Admin
const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const withdrawal = await Withdrawal.findById(req.params.id);
  if (!withdrawal) return sendError(res, 'Withdrawal not found', 404);
  if (!['pending', 'processing'].includes(withdrawal.status)) {
    return sendError(res, `Cannot reject a withdrawal with status: ${withdrawal.status}`);
  }

  await refundWithdrawal(withdrawal, reason || 'Rejected by admin');
  return sendSuccess(res, { withdrawal }, 'Withdrawal rejected and balance refunded');
});

module.exports = {
  createWithdrawal,
  handlePayoutCallback,
  getWithdrawalLog,
  approveWithdrawal,
  rejectWithdrawal,
  getAllWithdrawals,
};
