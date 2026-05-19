const User = require('../models/User')
const Product = require('../models/Product')
const UserInvestment = require('../models/UserInvestment')
const Deposit = require('../models/Deposit')
const Withdrawal = require('../models/Withdrawal')
const Transaction = require('../models/Transaction')
const AppSettings = require('../models/AppSettings')
const { asyncHandler } = require('../middleware/errorHandler')
const {
    sendSuccess,
    sendError,
    paginate,
    generateJWT,
} = require('../utils/helpers')
const jwt = require('jsonwebtoken')

// ═══════════════════════════════════════════════════════════
// PRODUCT MANAGEMENT
// ═══════════════════════════════════════════════════════════

// @desc    Create a new investment product
// @route   POST /api/admin/products
// @access  Admin
const createProduct = asyncHandler(async (req, res) => {
    const {
        name,
        image,
        amount,
        cycleDays,
        dailyIncome,
        maxUnits,
        availableUnits,
        isFree,
        sortOrder,
    } = req.body

    if (!name || cycleDays == null || dailyIncome == null || amount == null) {
        return sendError(
            res,
            'name, amount, cycleDays and dailyIncome are required',
        )
    }

    const product = await Product.create({
        name,
        image: image || null,
        amount,
        cycleDays,
        dailyIncome,
        maxUnits: maxUnits ?? 1,
        availableUnits: availableUnits ?? maxUnits ?? 1,
        isFree: isFree || false,
        sortOrder: sortOrder ?? 0,
    })

    return sendSuccess(res, { product }, 'Product created successfully', 201)
})

// @desc    Get ALL products (including inactive & sold out)
// @route   GET /api/admin/products
// @access  Admin
const getAllProducts = asyncHandler(async (req, res) => {
    const { status } = req.query // ?status=active | inactive | all (default all)

    const filter = {}
    if (status === 'active') filter.isActive = true
    if (status === 'inactive') filter.isActive = false

    const products = await Product.find(filter).sort({
        sortOrder: 1,
        amount: 1,
    })
    return sendSuccess(res, { products, total: products.length })
})

// @desc    Update a product
// @route   PUT /api/admin/products/:id
// @access  Admin
const updateProduct = asyncHandler(async (req, res) => {
    const allowed = [
        'name',
        'image',
        'amount',
        'cycleDays',
        'dailyIncome',
        'maxUnits',
        'availableUnits',
        'isFree',
        'isActive',
        'sortOrder',
    ]

    const updates = {}
    allowed.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field]
    })

    if (Object.keys(updates).length === 0) {
        return sendError(res, 'No valid fields provided to update')
    }

    const product = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true },
    )

    if (!product) return sendError(res, 'Product not found', 404)

    return sendSuccess(res, { product }, 'Product updated successfully')
})

// @desc    Soft-delete a product (sets isActive: false)
// @route   DELETE /api/admin/products/:id
// @access  Admin
const deleteProduct = asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true },
    )

    if (!product) return sendError(res, 'Product not found', 404)

    return sendSuccess(res, { product }, 'Product deactivated successfully')
})

// ═══════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════

// @desc    Get all users with summary stats
// @route   GET /api/admin/users
// @access  Admin
const getAllUsers = asyncHandler(async (req, res) => {
    const { page, limit } = req.query
    const { skip, limit: lim, page: pg } = paginate(page, limit)

    // Optional filters
    const filter = {}
    if (req.query.status === 'active') filter.isActive = true
    if (req.query.status === 'suspended') filter.isActive = false
    if (req.query.phone)
        filter.phone = { $regex: req.query.phone, $options: 'i' }
    if (req.query.vip != null) filter.vipLevel = parseInt(req.query.vip)

    const [users, total] = await Promise.all([
        User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(lim)
            .select(
                '-password -withdrawPassword -securityAnswer -securityQuestionId',
            ),
        User.countDocuments(filter),
    ])

    return sendSuccess(res, {
        users: users.map((u) => ({
            id: u._id,
            phone: u.phone,
            maskedPhone: u.maskedPhone(),
            countryCode: u.countryCode,
            referralCode: u.referralCode,
            vipLevel: u.vipLevel,
            balance: u.balance,
            totalEarnings: u.totalEarnings,
            todayEarnings: u.todayEarnings,
            isActive: u.isActive,
            idVerified: u.idVerified,
            realName: u.realName,
            lastLogin: u.lastLogin,
            createdAt: u.createdAt,
        })),
        pagination: {
            total,
            page: pg,
            limit: lim,
            pages: Math.ceil(total / lim),
        },
    })
})

// @desc    Get single user — full profile + all activity
// @route   GET /api/admin/users/:id
// @access  Admin
const getUserDetail = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
        .select(
            '-password -withdrawPassword -securityAnswer -securityQuestionId',
        )
        .populate('referredBy', 'phone referralCode')

    if (!user) return sendError(res, 'User not found', 404)

    // Parallel fetch of all activity
    const [investments, deposits, withdrawals, transactions, teamCount] =
        await Promise.all([
            UserInvestment.find({ user: user._id })
                .sort({ createdAt: -1 })
                .limit(20)
                .populate('product', 'name'),
            Deposit.find({ user: user._id }).sort({ createdAt: -1 }).limit(20),
            Withdrawal.find({ user: user._id })
                .sort({ createdAt: -1 })
                .limit(20),
            Transaction.find({ user: user._id })
                .sort({ createdAt: -1 })
                .limit(20),
            User.countDocuments({ referredBy: user._id }),
        ])

    return sendSuccess(res, {
        user: {
            id: user._id,
            phone: user.phone,
            maskedPhone: user.maskedPhone(),
            countryCode: user.countryCode,
            referralCode: user.referralCode,
            referredBy: user.referredBy,
            vipLevel: user.vipLevel,
            balance: user.balance,
            totalEarnings: user.totalEarnings,
            todayEarnings: user.todayEarnings,
            yesterdayEarnings: user.yesterdayEarnings,
            isActive: user.isActive,
            idVerified: user.idVerified,
            realName: user.realName,
            telegramJoined: user.telegramJoined,
            lastLogin: user.lastLogin,
            lastCheckin: user.lastCheckin,
            checkinStreak: user.checkinStreak,
            createdAt: user.createdAt,
        },
        stats: {
            totalInvestments: investments.length,
            activeInvestments: investments.filter(
                (i) => i.status === 'in_progress',
            ).length,
            totalDeposited: deposits
                .filter((d) => d.status === 'approved')
                .reduce((s, d) => s + d.amountUSD, 0),
            totalWithdrawn: withdrawals
                .filter((w) => w.status === 'completed')
                .reduce((s, w) => s + w.amountUSD, 0),
            directReferrals: teamCount,
        },
        activity: {
            investments: investments.slice(0, 10),
            deposits: deposits.slice(0, 10),
            withdrawals: withdrawals.slice(0, 10),
            transactions: transactions.slice(0, 10),
        },
    })
})

// @desc    Suspend a user (blocks all actions)
// @route   PUT /api/admin/users/:id/suspend
// @access  Admin
const suspendUser = asyncHandler(async (req, res) => {
    const { reason } = req.body

    if (req.params.id === req.user._id.toString()) {
        return sendError(res, 'You cannot suspend yourself')
    }

    const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true },
    ).select('-password -withdrawPassword -securityAnswer')

    if (!user) return sendError(res, 'User not found', 404)

    // Log the action as a transaction note (optional audit trail)
    console.log(
        `[ADMIN] User ${user.phone} suspended by admin ${req.user._id}. Reason: ${reason || 'none'}`,
    )

    return sendSuccess(
        res,
        {
            user: { id: user._id, phone: user.phone, isActive: user.isActive },
        },
        `User ${user.maskedPhone()} has been suspended`,
    )
})

// @desc    Unsuspend / reactivate a user
// @route   PUT /api/admin/users/:id/unsuspend
// @access  Admin
const unsuspendUser = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
        req.params.id,
        { isActive: true },
        { new: true },
    ).select('-password -withdrawPassword -securityAnswer')

    if (!user) return sendError(res, 'User not found', 404)

    return sendSuccess(
        res,
        {
            user: { id: user._id, phone: user.phone, isActive: user.isActive },
        },
        `User ${user.maskedPhone()} has been reactivated`,
    )
})

// @desc    Login AS a user (impersonation for support)
// @route   POST /api/admin/users/:id/login-as
// @access  Admin
const loginAsUser = asyncHandler(async (req, res) => {
    const targetUser = await User.findById(req.params.id).select(
        '-password -withdrawPassword -securityAnswer',
    )

    if (!targetUser) return sendError(res, 'User not found', 404)

    // Generate a special impersonation token
    // It carries the target user's id but also flags the admin
    const impersonationToken = jwt.sign(
        {
            id: targetUser._id,
            isImpersonating: true,
            adminId: req.user._id,
        },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }, // shorter lifetime for safety
    )

    console.log(
        `[ADMIN] Admin ${req.user._id} is impersonating user ${targetUser.phone} (${targetUser._id})`,
    )

    return sendSuccess(
        res,
        {
            token: impersonationToken,
            isImpersonating: true,
            adminId: req.user._id,
            targetUser: {
                id: targetUser._id,
                phone: targetUser.maskedPhone(),
                balance: targetUser.balance,
                vipLevel: targetUser.vipLevel,
                referralCode: targetUser.referralCode,
            },
        },
        `Now logged in as ${targetUser.maskedPhone()}. Token valid for 2 hours.`,
    )
})

// ═══════════════════════════════════════════════════════════
// WALLET OPERATIONS
// ═══════════════════════════════════════════════════════════

// @desc    Credit a user's wallet
// @route   POST /api/admin/users/:id/credit
// @access  Admin
const creditUserWallet = asyncHandler(async (req, res) => {
    const { amountUSD, reason } = req.body

    if (!amountUSD || amountUSD <= 0) {
        return sendError(res, 'Amount must be a positive number')
    }
    if (!reason || reason.trim().length < 3) {
        return sendError(res, 'A reason is required for manual wallet credit')
    }

    const user = await User.findById(req.params.id)
    if (!user) return sendError(res, 'User not found', 404)

    const balanceBefore = user.balance
    user.balance += amountUSD
    user.totalEarnings += amountUSD
    await user.save({ validateBeforeSave: false })

    await Transaction.create({
        user: user._id,
        type: 'in',
        category: 'refund', // closest category; extend enum if needed
        amountUSD,
        balanceBefore,
        balanceAfter: user.balance,
        description: `[ADMIN CREDIT] ${reason} — by admin ${req.user._id}`,
    })

    console.log(
        `[ADMIN] Credited $${amountUSD} to ${user.phone}. Reason: ${reason}. Admin: ${req.user._id}`,
    )

    return sendSuccess(
        res,
        {
            userId: user._id,
            phone: user.maskedPhone(),
            amountCredited: amountUSD,
            balanceBefore,
            balanceAfter: user.balance,
        },
        `$${amountUSD} credited to ${user.maskedPhone()} successfully`,
    )
})

// @desc    Deduct from a user's wallet
// @route   POST /api/admin/users/:id/deduct
// @access  Admin
const deductUserWallet = asyncHandler(async (req, res) => {
    const { amountUSD, reason } = req.body

    if (!amountUSD || amountUSD <= 0) {
        return sendError(res, 'Amount must be a positive number')
    }
    if (!reason || reason.trim().length < 3) {
        return sendError(
            res,
            'A reason is required for manual wallet deduction',
        )
    }

    const user = await User.findById(req.params.id)
    if (!user) return sendError(res, 'User not found', 404)

    if (user.balance < amountUSD) {
        return sendError(
            res,
            `Insufficient balance. User only has $${user.balance.toFixed(4)}`,
        )
    }

    const balanceBefore = user.balance
    user.balance -= amountUSD
    await user.save({ validateBeforeSave: false })

    await Transaction.create({
        user: user._id,
        type: 'out',
        category: 'withdrawal', // closest category for deductions
        amountUSD,
        balanceBefore,
        balanceAfter: user.balance,
        description: `[ADMIN DEDUCT] ${reason} — by admin ${req.user._id}`,
    })

    console.log(
        `[ADMIN] Deducted $${amountUSD} from ${user.phone}. Reason: ${reason}. Admin: ${req.user._id}`,
    )

    return sendSuccess(
        res,
        {
            userId: user._id,
            phone: user.maskedPhone(),
            amountDeducted: amountUSD,
            balanceBefore,
            balanceAfter: user.balance,
        },
        `$${amountUSD} deducted from ${user.maskedPhone()} successfully`,
    )
})

// ═══════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════

// @desc    Admin dashboard overview
// @route   GET /api/admin/dashboard
// @access  Admin
const getDashboard = asyncHandler(async (req, res) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        newUsersToday,
        totalProducts,
        activeProducts,
        pendingDeposits,
        pendingWithdrawals,
        totalDepositedResult,
        totalWithdrawnResult,
    ] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isActive: false }),
        User.countDocuments({ createdAt: { $gte: today } }),
        Product.countDocuments({}),
        Product.countDocuments({ isActive: true }),
        Deposit.countDocuments({ status: 'pending' }),
        Withdrawal.countDocuments({ status: 'pending' }),
        Deposit.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: null, total: { $sum: '$amountUSD' } } },
        ]),
        Withdrawal.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amountUSD' } } },
        ]),
    ])

    return sendSuccess(res, {
        users: {
            total: totalUsers,
            active: activeUsers,
            suspended: suspendedUsers,
            newToday: newUsersToday,
        },
        products: { total: totalProducts, active: activeProducts },
        finance: {
            pendingDeposits,
            pendingWithdrawals,
            totalDeposited: totalDepositedResult[0]?.total || 0,
            totalWithdrawn: totalWithdrawnResult[0]?.total || 0,
        },
    })
})

// ═══════════════════════════════════════════════════════════
// ROLE MANAGEMENT  (superadmin only)
// ═══════════════════════════════════════════════════════════

// @desc    Assign a role to a user
// @route   PUT /api/admin/users/:id/role
// @access  Superadmin only
const assignRole = asyncHandler(async (req, res) => {
    const { role } = req.body
    const allowed = ['user', 'admin', 'superadmin']

    if (!role || !allowed.includes(role)) {
        return sendError(res, `Role must be one of: ${allowed.join(', ')}`)
    }

    // Prevent self-demotion
    if (req.params.id === req.user._id.toString() && role !== 'superadmin') {
        return sendError(res, 'You cannot demote yourself')
    }

    const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        { new: true },
    ).select('phone role vipLevel')

    if (!user) return sendError(res, 'User not found', 404)

    console.log(
        `[ADMIN] Role '${role}' assigned to ${user.phone} by superadmin ${req.user._id}`,
    )

    return sendSuccess(
        res,
        {
            user: { id: user._id, phone: user.maskedPhone(), role: user.role },
        },
        `Role updated to '${role}' successfully`,
    )
})


// ============================================================
// WEALTH FUND MANAGEMENT (Admin)
// ============================================================

const WealthFund = require('../models/WealthFund')

// @desc    Create a new wealth fund
// @route   POST /api/admin/wealth-funds
// @access  Admin
const createWealthFund = asyncHandler(async (req, res) => {
  const {
    name,
    image,
    amount,
    maturityAmount,
    durationType,
    durationDays,
    maxUnits,
    availableUnits,
    isActive,
    sortOrder,
  } = req.body

  if (!name || amount == null || maturityAmount == null || !durationType || !durationDays) {
    return sendError(res, 'Missing required fields: name, amount, maturityAmount, durationType, durationDays')
  }

  const wealthFund = await WealthFund.create({
    name,
    image: image || null,
    amount,
    maturityAmount,
    durationType,
    durationDays,
    maxUnits: maxUnits ?? 1,
    availableUnits: availableUnits ?? 999999,
    isActive: isActive ?? true,
    sortOrder: sortOrder ?? 0,
  })

  return sendSuccess(res, { wealthFund }, 'Wealth fund created successfully', 201)
})

// @desc    Get all wealth funds (admin) – includes inactive
// @route   GET /api/admin/wealth-funds
// @access  Admin
const getAllWealthFunds = asyncHandler(async (req, res) => {
  const { status } = req.query // ?status=active | inactive | all
  const filter = {}
  if (status === 'active') filter.isActive = true
  if (status === 'inactive') filter.isActive = false

  const funds = await WealthFund.find(filter).sort({ sortOrder: 1, amount: 1 })
  return sendSuccess(res, { funds, total: funds.length })
})

// @desc    Update a wealth fund
// @route   PUT /api/admin/wealth-funds/:id
// @access  Admin
const updateWealthFund = asyncHandler(async (req, res) => {
  const allowed = [
    'name',
    'image',
    'amount',
    'maturityAmount',
    'durationType',
    'durationDays',
    'maxUnits',
    'availableUnits',
    'isActive',
    'sortOrder',
  ]

  const updates = {}
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field]
  })

  if (Object.keys(updates).length === 0) {
    return sendError(res, 'No valid fields provided to update')
  }

  const fund = await WealthFund.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  )

  if (!fund) return sendError(res, 'Wealth fund not found', 404)

  return sendSuccess(res, { wealthFund: fund }, 'Wealth fund updated successfully')
})

// @desc    Soft delete a wealth fund (set isActive = false)
// @route   DELETE /api/admin/wealth-funds/:id
// @access  Admin
const deleteWealthFund = asyncHandler(async (req, res) => {
  const fund = await WealthFund.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  )

  if (!fund) return sendError(res, 'Wealth fund not found', 404)

  return sendSuccess(res, { wealthFund: fund }, 'Wealth fund deactivated successfully')
})

// (Optional) Hard delete – if needed, but soft delete is safer
module.exports = {
    // Products
    createProduct,
    getAllProducts,
    updateProduct,
    deleteProduct,
    // Users
    getAllUsers,
    getUserDetail,
    suspendUser,
    unsuspendUser,
    loginAsUser,
    // Wallet
    creditUserWallet,
    deductUserWallet,
    // Dashboard
    getDashboard,
    // Roles
    assignRole,

  createWealthFund,
  getAllWealthFunds,
  updateWealthFund,
  deleteWealthFund,
}
