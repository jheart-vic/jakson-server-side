const Deposit = require('../models/Deposit');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppSettings = require('../models/AppSettings');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendError, paginate } = require('../utils/helpers');

// @desc    Initiate a deposit
// @route   POST /api/deposit
// @access  Private
const createDeposit = asyncHandler(async (req, res) => {
  const { amountUSD } = req.body;

  const minDeposit = (await AppSettings.get('min_deposit')) || 11.5;
  if (!amountUSD || amountUSD < minDeposit) {
    return sendError(res, `Minimum deposit amount is $${minDeposit.toFixed(2)}`);
  }

  // Get current exchange rate from settings
  const rate = (await AppSettings.get('usd_to_ngn_rate')) || 1560;
  const amountNGN = +(amountUSD * rate).toFixed(2);

  // Get payment bank details from settings (rotated for each deposit)
  const paymentAccount = await AppSettings.get('payment_bank_account');

  const deposit = await Deposit.create({
    user: req.user._id,
    method: 'bank',
    amountUSD,
    amountNGN,
    exchangeRate: rate,
    assignedBankName: paymentAccount?.bankName || 'OTPay',
    assignedAccountNumber: paymentAccount?.accountNumber || null,
    assignedAccountName: paymentAccount?.accountName || null,
  });

  return sendSuccess(
    res,
    {
      deposit: {
        id: deposit._id,
        amountUSD: deposit.amountUSD,
        amountNGN: deposit.amountNGN,
        exchangeRate: deposit.exchangeRate,
        bankName: deposit.assignedBankName,
        accountNumber: deposit.assignedAccountNumber,
        accountName: deposit.assignedAccountName,
        status: deposit.status,
        createdAt: deposit.createdAt,
      },
    },
    'Deposit initiated. Please complete the bank transfer.',
    201
  );
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

// @desc    Admin: Approve a deposit
// @route   PUT /api/deposit/:id/approve
// @access  Admin
const approveDeposit = asyncHandler(async (req, res) => {
  const deposit = await Deposit.findById(req.params.id);
  if (!deposit) return sendError(res, 'Deposit not found', 404);
  if (deposit.status !== 'pending') {
    return sendError(res, `Cannot approve a deposit with status: ${deposit.status}`);
  }

  const user = await User.findById(deposit.user);
  const balanceBefore = user.balance;

  // Credit user balance
  user.balance += deposit.amountUSD;
  await user.save({ validateBeforeSave: false });

  deposit.status = 'approved';
  deposit.approvedAt = new Date();
  await deposit.save();

  // Record transaction
  await Transaction.create({
    user: deposit.user,
    type: 'in',
    category: 'deposit',
    amountUSD: deposit.amountUSD,
    balanceBefore,
    balanceAfter: user.balance,
    description: `Bank deposit approved`,
    refModel: 'Deposit',
    refId: deposit._id,
  });

  return sendSuccess(res, { deposit }, 'Deposit approved successfully');
});

// @desc    Admin: Reject a deposit
// @route   PUT /api/deposit/:id/reject
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

module.exports = { createDeposit, getDepositLog, approveDeposit, rejectDeposit, getAllDeposits };
