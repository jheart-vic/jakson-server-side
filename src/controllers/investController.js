const Product = require('../models/Product')
const UserInvestment = require('../models/UserInvestment')
const Transaction = require('../models/Transaction')
const User = require('../models/User')
const { asyncHandler } = require('../middleware/errorHandler')
const { sendSuccess, sendError, paginate } = require('../utils/helpers')
const { notify } = require('../utils/userNotify')

// @desc    Get all active products
// @route   GET /api/products
// @access  Private
const getProducts = asyncHandler(async (req, res) => {
    const products = await Product.find({ isActive: true }).sort({
        sortOrder: 1,
        amount: 1,
    })
    return sendSuccess(res, { products })
})

// @desc    Buy/invest in a product
// @route   POST /api/invest/:productId
// @access  Private
const buyProduct = asyncHandler(async (req, res) => {
    const { productId } = req.params
    const userId = req.user._id

    const product = await Product.findById(productId)
    if (!product || !product.isActive) {
        return sendError(res, 'Product not found or unavailable')
    }

    if (product.availableUnits <= 0) {
        return sendError(res, 'This product is sold out')
    }

    // Check how many times user already bought this product
    const existingCount = await UserInvestment.countDocuments({
        user: userId,
        product: productId,
        status: 'in_progress',
    })

    if (existingCount >= product.maxUnits) {
        return sendError(
            res,
            `You can only purchase ${product.maxUnits} unit(s) of this product`,
        )
    }

    // Check balance (free product is $0)
    const user = await User.findById(userId)
    if (product.amount > 0 && user.balance < product.amount) {
        return sendError(
            res,
            'Insufficient balance. Please recharge your account.',
        )
    }

    const totalInvestmentsBefore = await UserInvestment.countDocuments({ user: userId })
    const isFirstInvestment = totalInvestmentsBefore === 0

    // Calculate expiration date
    const startDate = new Date()
    const expirationDate = new Date(startDate)
    expirationDate.setDate(expirationDate.getDate() + product.cycleDays)

    // Deduct balance (if paid product)
    const balanceBefore = user.balance
    if (product.amount > 0) {
        user.balance -= product.amount
    }

    // Upgrade VIP level if needed
    if (product.vipLevel > user.vipLevel) {
        user.vipLevel = product.vipLevel
    }

    await user.save({ validateBeforeSave: false })

    // Create investment record
    const investment = await UserInvestment.create({
        user: userId,
        product: productId,
        productSnapshot: {
            name: product.name,
            amount: product.amount,
            cycleDays: product.cycleDays,
            dailyIncome: product.dailyIncome,
        },
        investmentAmount: product.amount,
        dailyIncome: product.dailyIncome,
        startDate,
        expirationDate,
    })

    // Reduce available units
    if (!product.isFree) {
        product.availableUnits -= 1
        await product.save()
    }

    // Record transaction (out) for the investment
    if (product.amount > 0) {
        await Transaction.create({
            user: userId,
            type: 'out',
            category: 'investment',
            amountUSD: product.amount,
            balanceBefore,
            balanceAfter: user.balance,
            description: `Invested in ${product.name}`,
            refModel: 'UserInvestment',
            refId: investment._id,
        })
    }

    // ─────────────────────────────────────────────────────────
    // REFERRAL REWARDS – Only for the user's first investment
    // ─────────────────────────────────────────────────────────
    if (isFirstInvestment && product.amount > 0) {
        const investmentAmount = product.amount

        const creditReferrer = async (referrerId, percentage, level) => {
            if (!referrerId) return false
            const referrer = await User.findById(referrerId)
            if (!referrer || !referrer.isActive) return false

            const reward = investmentAmount * (percentage / 100)
            if (reward <= 0) return false

            const before = referrer.balance
            referrer.balance += reward
            referrer.totalEarnings += reward
            referrer.todayEarnings += reward
            await referrer.save()

            await Transaction.create({
                user: referrerId,
                type: 'in',
                category: 'referral',
                amountUSD: reward,
                balanceBefore: before,
                balanceAfter: referrer.balance,
                description: `Tier ${level} referral commission from ${user.phone} (first investment)`,
                refModel: 'User',
                refId: userId,
            })
            return true
        }

        // Level 1: direct referrer (8%)
        if (user.referredBy) {
            await creditReferrer(user.referredBy, 8, 1)

            notify(user.referredBy, {
                type: 'invitee',
                title: 'Your Invitee Invested! 🎉',
                body: `Someone you referred just made their first investment of $${product.amount.toFixed(2)}. Your referral commission has been credited.`,
                metadata: { investmentAmount: product.amount },
            })

            // Level 2: referrer of the referrer (3%)
            const level1Referrer = await User.findById(user.referredBy).select('referredBy')
            if (level1Referrer && level1Referrer.referredBy) {
                await creditReferrer(level1Referrer.referredBy, 3, 2)

                // Level 3: next level (1%)
                const level2Referrer = await User.findById(level1Referrer.referredBy).select('referredBy')
                if (level2Referrer && level2Referrer.referredBy) {
                    await creditReferrer(level2Referrer.referredBy, 1, 3)
                }
            }
        }
    }

    notify(userId, {
        type: 'system',
        title: 'Investment Activated 📈',
        body: `You invested $${product.amount.toFixed(2)} in ${product.name}. Daily income of $${product.dailyIncome.toFixed(4)} starts tomorrow.`,
        metadata: { productName: product.name, amount: product.amount, dailyIncome: product.dailyIncome },
    })

    return sendSuccess(res, { investment }, 'Investment successful', 201)
})

// @desc    Claim income for a specific investment
// @route   POST /api/invest/:investmentId/claim
// @access  Private
const claimInvestmentIncome = asyncHandler(async (req, res) => {
    const { investmentId } = req.params
    const userId = req.user._id

    const investment = await UserInvestment.findOne({
        _id: investmentId,
        user: userId,
        status: 'in_progress',
    })

    if (!investment) {
        return sendError(res, 'Investment not found')
    }

    if (!investment.pendingIncome || investment.pendingIncome <= 0) {
        return sendError(
            res,
            'No income available to claim for this investment. Income is queued on weekdays — check back tomorrow.',
        )
    }

    // Prevent double-claiming on the same day
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (investment.lastIncomeClaim) {
        const lastClaim = new Date(investment.lastIncomeClaim)
        lastClaim.setHours(0, 0, 0, 0)
        if (lastClaim.getTime() === today.getTime()) {
            return sendError(
                res,
                "You've already claimed this investment's income today. Come back tomorrow!",
            )
        }
    }

    const amount = investment.pendingIncome
    const user = await User.findById(userId)
    const balanceBefore = user.balance

    // Credit user
    user.balance += amount
    user.totalEarnings += amount
    user.todayEarnings += amount
    // Subtract from the aggregate pending pool (floor at 0 to avoid drift)
    user.pendingDailyIncome = Math.max(0, (user.pendingDailyIncome || 0) - amount)
    await user.save({ validateBeforeSave: false })

    // Clear this investment's pending income and record claim time
    investment.pendingIncome = 0
    investment.lastIncomeClaim = new Date()
    await investment.save()

    await Transaction.create({
        user: userId,
        type: 'in',
        category: 'daily_income',
        amountUSD: amount,
        balanceBefore,
        balanceAfter: user.balance,
        description: `Daily income claimed for ${investment.productSnapshot.name} ($${amount.toFixed(4)})`,
        refModel: 'UserInvestment',
        refId: investment._id,
    })

    notify(userId, {
        type: 'system',
        title: 'Income Claimed! 💰',
        body: `$${amount.toFixed(4)} from ${investment.productSnapshot.name} has been added to your balance.`,
        metadata: { amount, productName: investment.productSnapshot.name },
    })

    return sendSuccess(
        res,
        {
            amountClaimed: amount,
            newBalance: user.balance,
        },
        `$${amount.toFixed(4)} successfully credited!`,
    )
})

// @desc    Get user's investments
// @route   GET /api/invest/my
// @access  Private
const getMyInvestments = asyncHandler(async (req, res) => {
    const { page, limit } = req.query
    const { skip, limit: lim, page: pg } = paginate(page, limit)

    const [investments, total] = await Promise.all([
        UserInvestment.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(lim)
            .populate('product', 'name image'),
        UserInvestment.countDocuments({ user: req.user._id }),
    ])

    return sendSuccess(res, {
        investments,
        pagination: {
            total,
            page: pg,
            limit: lim,
            pages: Math.ceil(total / lim),
        },
    })
})

module.exports = { getProducts, buyProduct, claimInvestmentIncome, getMyInvestments }