const mongoose = require('mongoose')
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

    const user = await User.findById(userId)
    if (product.amount > 0 && user.balance < product.amount) {
        return sendError(res, 'Insufficient balance. Please recharge your account.')
    }

    const totalInvestmentsBefore = await UserInvestment.countDocuments({ user: userId })
    const isFirstInvestment = totalInvestmentsBefore === 0

    const startDate = new Date()
    const expirationDate = new Date(startDate)
    expirationDate.setDate(expirationDate.getDate() + product.cycleDays)

    const balanceBefore = user.balance
    if (product.amount > 0) user.balance -= product.amount
    if (product.vipLevel > user.vipLevel) user.vipLevel = product.vipLevel
    await user.save({ validateBeforeSave: false })

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

    if (!product.isFree) {
        product.availableUnits -= 1
        await product.save()
    }

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
                category: 'referral_bonus',
                amountUSD: reward,
                balanceBefore: before,
                balanceAfter: referrer.balance,
                description: `Tier ${level} referral commission from ${user.phone} (first investment)`,
                refModel: 'UserInvestment',
                refId: investment._id,
            })
            return true
        }

        if (user.referredBy) {
            await creditReferrer(user.referredBy, 8, 1)
            notify(user.referredBy, {
                type: 'invitee',
                title: 'Your Invitee Invested! 🎉',
                body: `Someone you referred just made their first investment of $${product.amount.toFixed(2)}. Your referral commission has been credited.`,
                metadata: { investmentAmount: product.amount },
            })

            const level1Referrer = await User.findById(user.referredBy).select('referredBy')
            if (level1Referrer?.referredBy) {
                await creditReferrer(level1Referrer.referredBy, 3, 2)
                const level2Referrer = await User.findById(level1Referrer.referredBy).select('referredBy')
                if (level2Referrer?.referredBy) {
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

/**
 * Pay referral commissions up 3 tiers when a referee claims daily income.
 * Runs inside the caller's MongoDB session so it rolls back if the claim fails.
 *
 * Tiers match the daily income commission rates (3% / 2% / 1%).
 *
 * @param {ObjectId}     userId       - The investor who just claimed
 * @param {number}       claimAmount  - The amount they claimed
 * @param {ObjectId}     investmentId - The UserInvestment _id for traceability
 * @param {ClientSession} session     - Mongoose session from the claim transaction
 */
const payReferralCommissions = async (userId, claimAmount, investmentId, session) => {
    const TIERS = [{ percent: 0.03 }, { percent: 0.02 }, { percent: 0.01 }]
    let currentUserId = userId

    for (const tier of TIERS) {
        const user = await User.findById(currentUserId).session(session)
        if (!user || !user.referredBy) break

        const referrer = await User.findById(user.referredBy).session(session)
        if (!referrer || !referrer.isActive) break

        const commission = +(claimAmount * tier.percent).toFixed(6)
        if (commission <= 0) continue

        const balanceBefore = referrer.balance
        referrer.balance += commission
        referrer.totalEarnings += commission
        referrer.todayEarnings += commission
        await referrer.save({ validateBeforeSave: false, session })

        await Transaction.create(
            [{
                user: referrer._id,
                type: 'in',
                category: 'referral_bonus',
                amountUSD: commission,
                balanceBefore,
                balanceAfter: referrer.balance,
                description: `Referral commission (${(tier.percent * 100).toFixed(0)}%) from daily income claim`,
                refModel: 'UserInvestment',
                refId: investmentId,
            }],
            { session },
        )

        // Fire-and-forget — notify outside the transaction concern
        notify(referrer._id, {
            type: 'referral_bonus',
            title: 'Referral Commission Earned 🤝',
            body: `You earned $${commission.toFixed(6)} (${(tier.percent * 100).toFixed(0)}%) from your team's daily income claim.`,
            metadata: { commission, percent: tier.percent * 100 },
        })

        currentUserId = referrer._id
    }
}

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

    if (!investment) return sendError(res, 'Investment not found')

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
    let newBalance = 0

    // Wrap claim + referral commissions in a single transaction so that
    // if referral credit fails, the user's balance is also rolled back —
    // no partial state where user was paid but referrers weren't or vice versa.
    const session = await mongoose.startSession()
    try {
        await session.withTransaction(async () => {
            const user = await User.findById(userId).session(session)
            const balanceBefore = user.balance

            user.balance += amount
            user.totalEarnings += amount
            user.todayEarnings += amount
            user.pendingDailyIncome = Math.max(0, (user.pendingDailyIncome || 0) - amount)
            await user.save({ validateBeforeSave: false, session })

            investment.pendingIncome = 0
            investment.lastIncomeClaim = new Date()
            await investment.save({ session })

            await Transaction.create(
                [{
                    user: userId,
                    type: 'in',
                    category: 'daily_income',
                    amountUSD: amount,
                    balanceBefore,
                    balanceAfter: user.balance,
                    description: `Daily income claimed for ${investment.productSnapshot.name} ($${amount.toFixed(4)})`,
                    refModel: 'UserInvestment',
                    refId: investment._id,
                }],
                { session },
            )

            // Pay referral commissions now that real money has moved
            await payReferralCommissions(userId, amount, investment._id, session)

            newBalance = user.balance
        })
    } finally {
        await session.endSession()
    }

    // Notifications outside the transaction — fire-and-forget
    notify(userId, {
        type: 'system',
        title: 'Income Claimed! 💰',
        body: `$${amount.toFixed(4)} from ${investment.productSnapshot.name} has been added to your balance.`,
        metadata: { amount, productName: investment.productSnapshot.name },
    })

    return sendSuccess(
        res,
        { amountClaimed: amount, newBalance },
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