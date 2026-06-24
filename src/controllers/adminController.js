const User = require('../models/User')
const Product = require('../models/Product')
const UserInvestment = require('../models/UserInvestment')
const Deposit = require('../models/Deposit')
const Withdrawal = require('../models/Withdrawal')
const Transaction = require('../models/Transaction')
const AppSettings = require('../models/AppSettings')
const { asyncHandler } = require('../middleware/errorHandler')
const {
    SECURITY_QUESTIONS,
    getQuestionById,
} = require('../utils/securityQuestions')
const {
    sendSuccess,
    sendError,
    paginate,
    generateJWT,
} = require('../utils/helpers')
const jwt = require('jsonwebtoken')
const { notify } = require('../utils/userNotify')

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
        vipLevel,
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

    if (vipLevel == null) {
        return sendError(res, 'vipLevel is required')
    }

    const product = await Product.create({
        name,
        image: image || null,
        amount,
        cycleDays,
        dailyIncome,
        vipLevel,
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
        'vipLevel',
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
    const product = await Product.findById(req.params.id)
    if (!product) return sendError(res, 'Product not found', 404)

    // Find all investments tied to this product
    const investments = await UserInvestment.find({ product: product._id })
    const userIds = [...new Set(investments.map((i) => i.user.toString()))]

    // Refund users with in-progress investments
    const inProgress = investments.filter((i) => i.status === 'in_progress')
    await Promise.all(
        inProgress.map(async (inv) => {
            const refundAmount =
                inv.amountPaid ?? inv.productSnapshot?.amount ?? 0
            if (refundAmount > 0) {
                await User.findByIdAndUpdate(inv.user, {
                    $inc: { balance: refundAmount },
                })
                await Transaction.create({
                    user: inv.user,
                    type: 'in',
                    category: 'refund',
                    amountUSD: refundAmount,
                    description: `Refund — product "${product.name}" was deleted by admin`,
                })
            }
        }),
    )

    // Cancel all investments for this product
    await UserInvestment.updateMany(
        { product: product._id },
        { status: 'cancelled', isClaimed: true },
    )

    // Notify affected users
    await Promise.all(
        userIds.map(
            (uid) =>
                notify(uid, 'investment_cancelled', {
                    message: `Your investment in "${product.name}" was cancelled and refunded due to product removal.`,
                }).catch(() => {}), // don't let a notification failure abort the delete
        ),
    )

    // Hard delete the product
    await product.deleteOne()

    console.log(
        `[ADMIN] Product "${product.name}" (${product._id}) deleted by admin ${req.user._id}. ` +
            `${inProgress.length} investments cancelled, ${userIds.length} users affected.`,
    )

    return sendSuccess(
        res,
        {
            deletedProduct: product.name,
            investmentsCancelled: investments.length,
            usersAffected: userIds.length,
            refundsIssued: inProgress.length,
        },
        'Product and all associated investments deleted. Affected users refunded.',
    )
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

    // Overwrite the session cookie so all subsequent withCredentials
    // requests are authenticated as the target user, not the admin
    const cookieName = process.env.JWT_COOKIE_NAME || 'access_token'
    res.cookie(cookieName, impersonationToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 2 * 60 * 60 * 1000, // 2 h — matches token expiry
    })

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
                role: targetUser.role,
                isActive: targetUser.isActive,
            },
        },
        `Now logged in as ${targetUser.maskedPhone()}. Token valid for 2 hours.`,
    )
})

// @desc    Exit impersonation — restore the admin’s own session cookie
// @route   POST /api/admin/users/exit-impersonation
// @access  Called while impersonation cookie is active
const exitImpersonation = asyncHandler(async (req, res) => {
    const adminId = req.adminId
    if (!adminId) return sendError(res, 'Not currently impersonating', 400)

    const admin = await User.findById(adminId).select(
        '-password -withdrawPassword -securityAnswer',
    )
    if (!admin) return sendError(res, 'Admin user not found', 404)

    const adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    })

    const cookieName = process.env.JWT_COOKIE_NAME || 'access_token'
    res.cookie(cookieName, adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    console.log(`[ADMIN] Admin ${admin._id} exited impersonation`)

    return sendSuccess(
        res,
        {
            admin: {
                id: admin._id,
                phone: admin.maskedPhone(),
                role: admin.role,
            },
        },
        'Returned to admin session',
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

    notify(user._id, {
        type: 'admin',
        title: 'Wallet Credited 💰',
        body: `$${amountUSD.toFixed(2)} has been added to your account by admin. Reason: ${reason}.`,
        metadata: { amountUSD, reason },
    })
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

    notify(user._id, {
        type: 'admin',
        title: 'Wallet Adjustment',
        body: `$${amountUSD.toFixed(2)} has been deducted from your account by admin. Reason: ${reason}.`,
        metadata: { amountUSD, reason },
    })
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
const UserWealthFund = require('../models/UserWealthFund')

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

    if (
        !name ||
        amount == null ||
        maturityAmount == null ||
        !durationType ||
        !durationDays
    ) {
        return sendError(
            res,
            'Missing required fields: name, amount, maturityAmount, durationType, durationDays',
        )
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

    return sendSuccess(
        res,
        { wealthFund },
        'Wealth fund created successfully',
        201,
    )
})

// @desc    Get all wealth funds (admin) – includes inactive
// @route   GET /api/admin/wealth-funds
// @access  Admin
const getAllWealthFunds = asyncHandler(async (req, res) => {
    const { status } = req.query // ?status=active | inactive | all
    const filter = {}
    if (status === 'active') filter.isActive = true
    if (status === 'inactive') filter.isActive = false

    const funds = await WealthFund.find(filter).sort({
        sortOrder: 1,
        amount: 1,
    })
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
    allowed.forEach((field) => {
        if (req.body[field] !== undefined) updates[field] = req.body[field]
    })

    if (Object.keys(updates).length === 0) {
        return sendError(res, 'No valid fields provided to update')
    }

    const fund = await WealthFund.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true },
    )

    if (!fund) return sendError(res, 'Wealth fund not found', 404)

    return sendSuccess(
        res,
        { wealthFund: fund },
        'Wealth fund updated successfully',
    )
})

// @desc    Soft delete a wealth fund (set isActive = false)
// @route   DELETE /api/admin/wealth-funds/:id
// @access  Admin
const deactivateWealthFund = asyncHandler(async (req, res) => {
    const fund = await WealthFund.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true },
    )

    if (!fund) return sendError(res, 'Wealth fund not found', 404)

    return sendSuccess(
        res,
        { wealthFund: fund },
        'Wealth fund deactivated successfully',
    )
})
const deleteWealthFund = asyncHandler(async (req, res) => {
    const fund = await WealthFund.findByIdAndDelete(req.params.id)

    //clear all relatedactive investments
    await UserWealthFund.updateMany(
        { wealthFund: fund._id, status: 'in_progress' },
        { status: 'cancelled', isClaimed: true },
    )

    if (!fund) return sendError(res, 'Wealth fund not found', 404)
    // console.log("fund id", fund.id);
    // console.log("fund _id", fund._id);

    return sendSuccess(
        res,
        { wealthFund: fund },
        'Wealth fund deleted successfully',
    )
})

// ═══════════════════════════════════════════════════════════
// BONUS CODE MANAGEMENT
// ═══════════════════════════════════════════════════════════

const BonusCode = require('../models/BonusCode')
const crypto = require('crypto')
const { createResetToken } = require('../utils/resetTokenStore')

// Auto-generate a unique uppercase alphanumeric code
const generateBonusCode = (length = 8) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    const bytes = crypto.randomBytes(length)
    for (let i = 0; i < length; i++) {
        result += chars[bytes[i] % chars.length]
    }
    return result
}

// @desc    Create a bonus code
// @route   POST /api/admin/bonus-codes
// @access  Admin
const createBonusCode = asyncHandler(async (req, res) => {
    const { code, amountUSD, maxUses, expiresAt, autoGenerate } = req.body

    if (!amountUSD || amountUSD <= 0) {
        return sendError(res, 'amountUSD must be a positive number')
    }

    // Use provided code or auto-generate one that doesn't collide
    let finalCode = autoGenerate || !code ? null : code.toUpperCase().trim()

    if (!finalCode) {
        let attempts = 0
        do {
            finalCode = generateBonusCode(8)
            const exists = await BonusCode.findOne({ code: finalCode })
            if (!exists) break
            finalCode = null
            attempts++
        } while (attempts < 10)

        if (!finalCode)
            return sendError(
                res,
                'Could not generate a unique code. Try again.',
            )
    }

    const bonusCode = await BonusCode.create({
        code: finalCode,
        amountUSD,
        maxUses: maxUses ?? 1, // -1 = unlimited
        expiresAt: expiresAt || null,
        isActive: true,
        createdBy: req.user._id,
    })

    return sendSuccess(res, { bonusCode }, 'Bonus code created', 201)
})

// @desc    Get all bonus codes (admin)
// @route   GET /api/admin/bonus-codes
// @access  Admin
const getAllBonusCodes = asyncHandler(async (req, res) => {
    const { status } = req.query // active | inactive
    const filter = {}
    if (status === 'active') filter.isActive = true
    if (status === 'inactive') filter.isActive = false

    const codes = await BonusCode.find(filter)
        .sort({ createdAt: -1 })
        .populate('createdBy', 'phone')

    return sendSuccess(res, { codes, total: codes.length })
})

// @desc    Toggle active/inactive
// @route   PUT /api/admin/bonus-codes/:id/toggle
// @access  Admin
const toggleBonusCode = asyncHandler(async (req, res) => {
    const bc = await BonusCode.findById(req.params.id)
    if (!bc) return sendError(res, 'Bonus code not found', 404)

    bc.isActive = !bc.isActive
    await bc.save()

    return sendSuccess(
        res,
        { bonusCode: bc },
        `Code ${bc.isActive ? 'activated' : 'deactivated'}`,
    )
})

// @desc    Delete a bonus code (hard delete)
// @route   DELETE /api/admin/bonus-codes/:id
// @access  Admin
const deleteBonusCode = asyncHandler(async (req, res) => {
    const bc = await BonusCode.findByIdAndDelete(req.params.id)
    if (!bc) return sendError(res, 'Bonus code not found', 404)
    return sendSuccess(res, {}, 'Bonus code deleted')
})

// @desc    Get a user's security question and answer (admin only)
// @route   GET /api/admin/users/:id/security
// @access  Admin
const getUserSecurity = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(
    '+securityQuestionId +securityAnswer'
  )
  if (!user) return sendError(res, 'User not found', 404)

  const question = getQuestionById(user.securityQuestionId)

  return sendSuccess(res, {
    question:          question?.question ?? null,
    hasSecurityAnswer: !!user.securityAnswer,
  })
})

// @desc    Admin verifies a customer's spoken security answer
// @route   POST /api/admin/users/:id/verify-security-answer
// @access  Admin
const adminVerifySecurityAnswer = asyncHandler(async (req, res) => {
    const { securityAnswer } = req.body
    if (!securityAnswer)
        return sendError(res, 'Security answer is required')

    const user = await User.findById(req.params.id).select(
        '+securityQuestionId +securityAnswer'
    )
    if (!user) return sendError(res, 'User not found', 404)
    if (!user.securityAnswer)
        return sendError(res, 'This user has no security answer on file')

    const isMatch = await user.compareSecurityAnswer(securityAnswer)
    if (!isMatch)
        return sendError(res, 'Security answer does not match', 401)

    // Issue a short-lived reset token the admin can immediately use
    const resetToken = createResetToken(user._id)

    console.log(
        `[ADMIN] Security answer verified for ${user.phone} by admin ${req.user._id}`
    )

    return sendSuccess(res, {
        verified: true,
        resetToken,   // pass this straight into adminResetUserPassword
    }, 'Answer verified. Use the resetToken to reset the password.')
})

// @desc    Admin force-resets a user's password (bypasses security question)
// @route   POST /api/admin/users/:id/reset-password
// @access  Admin
const adminResetUserPassword = asyncHandler(async (req, res) => {
    const { newPassword, reason } = req.body

    if (!newPassword || newPassword.length < 6)
        return sendError(res, 'New password must be at least 6 characters')
    if (!reason || reason.trim().length < 5)
        return sendError(res, 'Please provide a reason for this password reset (audit purposes)')

    const user = await User.findById(req.params.id)
    if (!user) return sendError(res, 'User not found', 404)

    user.password = newPassword
    await user.save()

    // Audit log
    await Transaction.create({
        user: user._id,
        type: 'in',
        category: 'refund', // reuse closest available category
        amountUSD: 0,
        description: `[ADMIN PASSWORD RESET] Reason: ${reason.trim()} — by admin ${req.user._id}`,
    })

    console.log(
        `[ADMIN] Force password reset for ${user.phone} by admin ${req.user._id}. Reason: ${reason}`
    )

    notify(user._id, {
        type: 'admin',
        title: 'Password Reset',
        body: 'Your login password has been reset by an administrator. Please contact support if you did not request this.',
    }).catch(() => {})

    return sendSuccess(
        res,
        { userId: user._id, phone: user.maskedPhone() },
        `Password reset successfully for ${user.maskedPhone()}`
    )
})

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
    exitImpersonation,
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
    deactivateWealthFund,
    deleteWealthFund,
    // Bonus Codes
    createBonusCode,
    getAllBonusCodes,
    toggleBonusCode,
    deleteBonusCode,
    // Security
    getUserSecurity,
    adminVerifySecurityAnswer,
    adminResetUserPassword
}
