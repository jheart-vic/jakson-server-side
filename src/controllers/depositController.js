const Deposit = require('../models/Deposit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppSettings = require('../models/AppSettings');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendError, paginate, getClientIp } = require('../utils/helpers');
const { notify } = require('../utils/userNotify');
const gateway = require('../utils/paymentGateway');

/**
 * Credit a completed deposit to the user's wallet. Idempotent: a deposit that
 * is already 'approved' is a no-op, so repeated gateway callbacks are safe.
 */
async function creditDeposit(deposit, { note } = {}) {
  if (deposit.status === 'approved') return deposit; // already credited

  const user = await User.findById(deposit.user);
  if (!user) throw new Error('User not found for deposit ' + deposit._id);

  const balanceBefore = user.balance;
  user.balance += deposit.amountUSD;
  await user.save({ validateBeforeSave: false });

  deposit.status = 'approved';
  deposit.approvedAt = new Date();
  if (note) deposit.adminNote = note;
  await deposit.save();

  await Transaction.create({
    user: deposit.user,
    type: 'in',
    category: 'deposit',
    amountUSD: deposit.amountUSD,
    balanceBefore,
    balanceAfter: user.balance,
    description: 'Deposit completed via payment gateway',
    refModel: 'Deposit',
    refId: deposit._id,
  });

  notify(deposit.user, {
    type: 'deposit',
    title: 'Deposit Approved ✅',
    body: `Your deposit of $${deposit.amountUSD.toFixed(2)} has been credited to your account.`,
    metadata: { amountUSD: deposit.amountUSD, depositId: deposit._id },
  });

  return deposit;
}

// @desc    Initiate a deposit (creates a gateway collection order)
// @route   POST /api/deposit
// @access  Private
const createDeposit = asyncHandler(async (req, res) => {
  const { amountUSD } = req.body;

  if (!gateway.isConfigured()) {
    return sendError(res, 'Payment gateway is not configured. Please try again later.', 503);
  }

  const minDeposit = (await AppSettings.get('min_deposit')) || 11.5;
  if (!amountUSD || amountUSD < minDeposit) {
    return sendError(res, `Minimum deposit amount is $${minDeposit.toFixed(2)}`);
  }

  const rate = (await AppSettings.get('usd_to_ngn_rate')) || 1560;
  // Nigeria collection amount as a whole NGN number.
  const amountNGN = Math.round(amountUSD * rate);

  // Create the local record first so its _id can serve as the merchantOrderId.
  const deposit = await Deposit.create({
    user: req.user._id,
    method: 'bank',
    amountUSD,
    amountNGN,
    exchangeRate: rate,
    status: 'pending',
  });

  try {
    const result = await gateway.createCollectionOrder({
      merchantOrderId: deposit._id.toString(),
      amount: amountNGN,
      ip: getClientIp(req),
    });

    if (!result.ok || !result.payUrl) {
      deposit.status = 'rejected';
      deposit.rejectedReason = (result.raw && result.raw.msg) || 'Gateway rejected the order';
      await deposit.save();
      return sendError(res, `Could not start payment: ${deposit.rejectedReason}`);
    }

    // payUrl typically looks like https://host/placeAnOrder?orderId=...
    const match = String(result.payUrl).match(/orderId=([^&]+)/);
    if (match) deposit.paymentOrderId = match[1];
    await deposit.save();

    return sendSuccess(
      res,
      {
        deposit: {
          id: deposit._id,
          amountUSD: deposit.amountUSD,
          amountNGN: deposit.amountNGN,
          exchangeRate: deposit.exchangeRate,
          status: deposit.status,
          payUrl: result.payUrl,
          createdAt: deposit.createdAt,
        },
      },
      'Deposit initiated. Redirect the user to payUrl to complete payment.',
      201
    );
  } catch (err) {
    deposit.status = 'rejected';
    deposit.rejectedReason = 'Gateway error: ' + err.message;
    await deposit.save();
    return sendError(res, 'Payment gateway is temporarily unavailable. Please try again.', 502);
  }
});

// @desc    Gateway collection (deposit) callback
// @route   POST /api/payment/deposit/callback
// @access  Public (signature-verified)
const handleCollectionCallback = asyncHandler(async (req, res) => {
  const ok = gateway.verifyCallback(req.body, req.rawBody);
  if (!ok) {
    console.warn('⚠️  Deposit callback signature verification FAILED', req.body);
    return res.status(400).send('sign error');
  }

  const { merchantOrderId, orderStatus } = req.body;
  const deposit = await Deposit.findById(merchantOrderId);
  // Always ack so the gateway stops retrying on records we can't act on.
  if (!deposit) return res.send('success');

  const status = Number(orderStatus);
  if (status === gateway.COLLECTION_STATUS.COMPLETED) {
    await creditDeposit(deposit);
  } else if (
    status === gateway.COLLECTION_STATUS.FAILED ||
    status === gateway.COLLECTION_STATUS.REFUNDED
  ) {
    if (deposit.status === 'pending') {
      deposit.status = 'rejected';
      deposit.rejectedReason = 'Payment failed/refunded at gateway';
      await deposit.save();
    }
  }
  // status 0/1 -> still in progress, just acknowledge.

  return res.send('success');
});

// @desc    Get user's deposit history
// @route   GET /api/deposit/log
// @access  Private
const getDepositLog = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  const [deposits, total] = await Promise.all([
    Deposit.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .select('-assignedAccountNumber -assignedAccountName'),
    Deposit.countDocuments({ user: req.user._id }),
  ]);

  return sendSuccess(res, {
    deposits,
    pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
  });
});

// @desc    Admin: Manually approve a deposit (fallback / reconciliation)
// @route   PUT /api/admin/deposits/:id/approve
// @access  Admin
const approveDeposit = asyncHandler(async (req, res) => {
  const deposit = await Deposit.findById(req.params.id);
  if (!deposit) return sendError(res, 'Deposit not found', 404);
  if (deposit.status !== 'pending') {
    return sendError(res, `Cannot approve a deposit with status: ${deposit.status}`);
  }

  await creditDeposit(deposit, { note: 'Manually approved by admin' });
  return sendSuccess(res, { deposit }, 'Deposit approved successfully');
});

// @desc    Admin: Reject a deposit
// @route   PUT /api/admin/deposits/:id/reject
// @access  Admin
const rejectDeposit = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const deposit = await Deposit.findById(req.params.id);
  if (!deposit) return sendError(res, 'Deposit not found', 404);
  if (deposit.status !== 'pending') {
    return sendError(res, `Cannot reject a deposit with status: ${deposit.status}`);
  }

  deposit.status = 'rejected';
  deposit.rejectedReason = reason || 'No reason provided';
  await deposit.save();

  notify(deposit.user, {
    type: 'deposit',
    title: 'Deposit Rejected ❌',
    body: `Your deposit of $${deposit.amountUSD.toFixed(2)} was rejected. Reason: ${reason || 'No reason provided'}.`,
    metadata: { amountUSD: deposit.amountUSD, depositId: deposit._id },
  });

  return sendSuccess(res, { deposit }, 'Deposit rejected');
});

// @desc    Admin: Get all deposits
// @route   GET /api/admin/deposits
// @access  Admin
const getAllDeposits = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);
  const filter = status ? { status } : {};

  const [deposits, total] = await Promise.all([
    Deposit.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('user', 'phone'),
    Deposit.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    deposits,
    pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
  });
});

module.exports = {
  createDeposit,
  handleCollectionCallback,
  getDepositLog,
  approveDeposit,
  rejectDeposit,
  getAllDeposits,
};
