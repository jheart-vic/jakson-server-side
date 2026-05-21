const BankAccount = require('../models/BankAccount');
const User = require('../models/User');
const UserInvestment = require('../models/UserInvestment');
const Transaction = require('../models/Transaction');
const BonusCode = require('../models/BonusCode');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendError, paginate } = require('../utils/helpers');
const { notify } = require('../utils/userNotify');

// ─────────────────────────────────────────
// BANK ACCOUNT
// ─────────────────────────────────────────

// @desc    Get user's withdrawal accounts
// @route   GET /api/bank/accounts
// @access  Private
const getBankAccounts = asyncHandler(async (req, res) => {
  const accounts = await BankAccount.find({ user: req.user._id });
  return sendSuccess(res, { accounts });
});

// @desc    Get list of supported Nigerian banks
// @route   GET /api/bank/list
// @access  Private
const getBankList = asyncHandler(async (req, res) => {
  return sendSuccess(res, { banks: BankAccount.NIGERIAN_BANKS });
});

// @desc    Bind a bank account
// @route   POST /api/bank/bind
// @access  Private
const bindBankAccount = asyncHandler(async (req, res) => {
  const { bankName, accountName, accountNumber } = req.body;

  if (!bankName || !accountName || !accountNumber) {
    return sendError(res, 'Bank name, account name and account number are required');
  }

  if (!BankAccount.NIGERIAN_BANKS.includes(bankName.toUpperCase())) {
    return sendError(res, 'Unsupported bank. Please select from the list.');
  }

  // Unset previous default
  await BankAccount.updateMany({ user: req.user._id }, { isDefault: false });

  const account = await BankAccount.create({
    user: req.user._id,
    bankName: bankName.toUpperCase(),
    accountName,
    accountNumber,
    isDefault: true,
  });

  return sendSuccess(res, { account }, 'Bank account bound successfully', 201);
});

// ─────────────────────────────────────────
// WALLET / TRANSACTIONS
// ─────────────────────────────────────────

// @desc    Get wallet balance + today/yesterday earnings
// @route   GET /api/wallet/balance
// @access  Private
const getBalance = asyncHandler(async (req, res) => {
  const user = req.user;
  return sendSuccess(res, {
    balance: user.balance,
    totalEarnings: user.totalEarnings,
    todayEarnings: user.todayEarnings,
    yesterdayEarnings: user.yesterdayEarnings,
  });
});

// @desc    Get funding history (All / In / Out)
// @route   GET /api/wallet/transactions
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const { type, page, limit } = req.query; // type: 'in' | 'out' | undefined
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  const filter = { user: req.user._id };
  if (type === 'in' || type === 'out') filter.type = type;

  const [transactions, total] = await Promise.all([
    Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim),
    Transaction.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    transactions,
    pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
  });
});

// ─────────────────────────────────────────
// TEAM / REFERRAL
// ─────────────────────────────────────────

// @desc    Get team stats + member counts per tier
// @route   GET /api/team/stats
// @access  Private
const getTeamStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Tier 1: directly referred by user
  const tier1Members = await User.find({ referredBy: userId }).select('_id phone createdAt');

  // Tier 2: referred by tier1
  const tier1Ids = tier1Members.map((u) => u._id);
  const tier2Members = await User.find({ referredBy: { $in: tier1Ids } }).select('_id');

  // Tier 3: referred by tier2
  const tier2Ids = tier2Members.map((u) => u._id);
  const tier3Members = await User.find({ referredBy: { $in: tier2Ids } }).select('_id');

  return sendSuccess(res, {
    inviteLink: `${process.env.FRONTEND_URL}/register?c=${req.user.referralCode}`,
    referralCode: req.user.referralCode,
    totalEarnings: req.user.totalEarnings,
    todayEarnings: req.user.todayEarnings,
    yesterdayEarnings: req.user.yesterdayEarnings,
    team: {
      tier1: { count: tier1Members.length, commission: '8%' },
      tier2: { count: tier2Members.length, commission: '3%' },
      tier3: { count: tier3Members.length, commission: '1%' },
      totalPeople: tier1Members.length + tier2Members.length + tier3Members.length,
    },
  });
});

// @desc    Get members of a specific tier
// @route   GET /api/team/members/:tier
// @access  Private
const getTierMembers = asyncHandler(async (req, res) => {
  const tier = parseInt(req.params.tier);
  const userId = req.user._id;
  const { page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  let memberIds = [];

  if (tier === 1) {
    memberIds = [userId];
  } else if (tier === 2) {
    const t1 = await User.find({ referredBy: userId }).select('_id');
    memberIds = t1.map((u) => u._id);
  } else if (tier === 3) {
    const t1 = await User.find({ referredBy: userId }).select('_id');
    const t1Ids = t1.map((u) => u._id);
    const t2 = await User.find({ referredBy: { $in: t1Ids } }).select('_id');
    memberIds = t2.map((u) => u._id);
  } else {
    return sendError(res, 'Tier must be 1, 2, or 3');
  }

  const referByFilter = tier === 1 ? userId : { $in: memberIds };

  const [members, total] = await Promise.all([
    User.find({ referredBy: referByFilter })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .select('phone createdAt vipLevel'),
    User.countDocuments({ referredBy: referByFilter }),
  ]);

  return sendSuccess(res, {
    tier,
    members: members.map((m) => ({
      phone: m.maskedPhone(),
      vipLevel: m.vipLevel,
      joinedAt: m.createdAt,
    })),
    pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
  });
});

// ─────────────────────────────────────────
// REWARD CODE
// ─────────────────────────────────────────

// @desc    Redeem a bonus/reward code
// @route   POST /api/reward/redeem
// @access  Private
const redeemCode = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) return sendError(res, 'Please enter a reward code');

  const bonusCode = await BonusCode.findOne({ code: code.toUpperCase() });
  if (!bonusCode) return sendError(res, 'Invalid reward code');

  const { valid, reason } = bonusCode.isValidFor(req.user._id);
  if (!valid) return sendError(res, reason);

  // Credit user
  const user = await User.findById(req.user._id);
  const balanceBefore = user.balance;
  user.balance       += bonusCode.amountUSD;
  user.totalEarnings += bonusCode.amountUSD;
  user.todayEarnings += bonusCode.amountUSD; // ← fix: count redemption as today's earning
  await user.save({ validateBeforeSave: false });

  // Mark code as used
  bonusCode.usedBy.push({ user: req.user._id });
  await bonusCode.save();

  // Record transaction
  await Transaction.create({
    user: req.user._id,
    type: 'in',
    category: 'reward_code',
    amountUSD: bonusCode.amountUSD,
    balanceBefore,
    balanceAfter: user.balance,
    description: `Reward code redeemed: ${code.toUpperCase()}`,
    refModel: 'BonusCode',
    refId: bonusCode._id,
  });

    notify(req.user._id, {
      type: 'bonus_code',
      title: 'Bonus Code Redeemed 🎉',
      body: `Code ${code.toUpperCase()} accepted — $${bonusCode.amountUSD.toFixed(2)} has been added to your balance.`,
      metadata: { amountUSD: bonusCode.amountUSD, code: code.toUpperCase() },
    });

  return sendSuccess(res, {
    amountCredited: bonusCode.amountUSD,
    newBalance: user.balance,
  }, `$${bonusCode.amountUSD.toFixed(2)} credited to your account!`);


});

// ─────────────────────────────────────────
// DAILY CHECK-IN
// ─────────────────────────────────────────

// @desc    Daily check-in
// @route   POST /api/checkin
// @access  Private
const dailyCheckin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (user.lastCheckin) {
    const lastDate = new Date(user.lastCheckin);
    lastDate.setHours(0, 0, 0, 0);
    if (lastDate.getTime() === today.getTime()) {
      return sendError(res, 'You have already checked in today');
    }
  }

  // Small reward for checking in
  const reward = 0.01; // $0.01 per checkin
  const balanceBefore = user.balance;

  user.lastCheckin = new Date();
  user.checkinStreak += 1;
  user.balance       += reward;
  user.totalEarnings += reward;
  user.todayEarnings += reward;   // ← fix: count check-in as today's earning
  await user.save({ validateBeforeSave: false });

  await Transaction.create({
    user: user._id,
    type: 'in',
    category: 'daily_checkin',
    amountUSD: reward,
    balanceBefore,
    balanceAfter: user.balance,
    description: `Daily check-in reward (Day ${user.checkinStreak})`,
  });

  notify(user._id, {
    type: 'checkin',
    title: 'Daily Check-in Reward 🎯',
    body: `Day ${user.checkinStreak} streak! $${reward.toFixed(2)} has been credited to your account.`,
    metadata: { reward, streak: user.checkinStreak },
  });
  return sendSuccess(res, {
    reward,
    streak: user.checkinStreak,
    newBalance: user.balance,
  }, 'Check-in successful!');


});

module.exports = {
  getBankAccounts,
  getBankList,
  bindBankAccount,
  getBalance,
  getTransactions,
  getTeamStats,
  getTierMembers,
  redeemCode,
  dailyCheckin,
};