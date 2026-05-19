const WealthFund = require('../models/WealthFund')
const UserWealthFund = require('../models/UserWealthFund')
const User = require('../models/User')
const Transaction = require('../models/Transaction')

const { asyncHandler } = require('../middleware/errorHandler')
const { sendSuccess, sendError, paginate } = require('../utils/helpers')

// @desc Get all active wealth funds
const getWealthFunds = asyncHandler(async (req, res) => {
    const funds = await WealthFund.find().sort({
        sortOrder: 1,
        amount: 1,
    })

    return sendSuccess(res, { funds })
})

// @desc Buy wealth fund
const buyWealthFund = asyncHandler(async (req, res) => {
    const { fundId } = req.params
    const userId = req.user._id

    const fund = await WealthFund.findById(fundId)

    if (!fund || !fund.isActive) {
        return sendError(res, 'Wealth fund not found')
    }

    // Check if user already has an active (unclaimed) investment for this fund
    const existingActive = await UserWealthFund.findOne({
        user: userId,
        wealthFund: fundId,
        isClaimed: false,
        status: 'in_progress',
    })

    if (existingActive) {
        return sendError(
            res,
            'You already have an active investment in this fund. Please wait until it matures and claim it before buying again.',
        )
    }
    const user = await User.findById(userId)

    if (user.balance < fund.amount) {
        return sendError(res, 'Insufficient balance')
    }

    const startDate = new Date()
    const maturityDate = new Date(startDate)
    maturityDate.setDate(maturityDate.getDate() + fund.durationDays)

    const balanceBefore = user.balance
    user.balance -= fund.amount
    await user.save({ validateBeforeSave: false })

    const investment = await UserWealthFund.create({
        user: userId,
        wealthFund: fund._id,
        fundSnapshot: {
            name: fund.name,
            amount: fund.amount,
            maturityAmount: fund.maturityAmount,
            durationType: fund.durationType,
            durationDays: fund.durationDays,
        },
        investmentAmount: fund.amount,
        maturityAmount: fund.maturityAmount,
        startDate,
        maturityDate,
    })

    await Transaction.create({
        user: userId,
        type: 'out',
        category: 'wealth_fund',
        amountUSD: fund.amount,
        balanceBefore,
        balanceAfter: user.balance,
        description: `Purchased wealth fund ${fund.name}`,
        refModel: 'UserWealthFund',
        refId: investment._id,
    })

    return sendSuccess(
        res,
        { investment },
        'Wealth fund purchased successfully',
        201,
    )
})

// @desc Claim matured wealth fund
const claimWealthFund = asyncHandler(async (req, res) => {
    const { investmentId } = req.params
    const userId = req.user._id

    const investment = await UserWealthFund.findOne({
        _id: investmentId,
        user: userId,
    })

    if (!investment) {
        return sendError(res, 'Investment not found')
    }

    if (investment.isClaimed) {
        return sendError(res, 'Already claimed')
    }

    if (new Date() < investment.maturityDate) {
        return sendError(res, 'This fund has not matured yet')
    }

    const user = await User.findById(userId)

    const balanceBefore = user.balance
    user.balance += investment.maturityAmount
    await user.save({ validateBeforeSave: false })

    investment.isClaimed = true
    investment.claimedAt = new Date()
    investment.status = 'completed'

    await investment.save()

    await Transaction.create({
        user: userId,
        type: 'in',
        category: 'wealth_fund_payout',
        amountUSD: investment.maturityAmount,
        balanceBefore,
        balanceAfter: user.balance,
        description: `Claimed wealth fund payout`,
        refModel: 'UserWealthFund',
        refId: investment._id,
    })

    return sendSuccess(res, { investment }, 'Wealth fund claimed successfully')
})

// @desc My wealth funds
const getMyWealthFunds = asyncHandler(async (req, res) => {
    const { page, limit } = req.query
    const { skip, limit: lim, page: pg } = paginate(page, limit)

    const [funds, total] = await Promise.all([
        UserWealthFund.find({ user: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(lim)
            .populate('wealthFund'),
        UserWealthFund.countDocuments({ user: req.user._id }),
    ])

    return sendSuccess(res, {
        funds,
        pagination: {
            total,
            page: pg,
            limit: lim,
            pages: Math.ceil(total / lim),
        },
    })
})

module.exports = {
    getWealthFunds,
    buyWealthFund,
    claimWealthFund,
    getMyWealthFunds,
}
