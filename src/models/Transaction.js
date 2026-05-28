const mongoose = require('mongoose')

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['in', 'out'],
            required: true,
        },
        category: {
            type: String,
            enum: [
                'deposit', // recharge/top-up
                'withdrawal', // withdraw funds
                'investment', // buying a product (out)
                'daily_income', // earning from investment (in)
                'referral_bonus', // team referral earning (in)
                'team_commission', // team commission (in)
                'reward_code', // redeem bonus code (in)
                'daily_checkin', // check-in reward (in)
                'refund', // refund (in)
                'wealth_fund',
                'wealth_fund_payout',
            ],
            required: true,
        },
        amountUSD: {
            type: Number,
            required: true,
        },
        balanceBefore: {
            type: Number,
            default: 0,
        },
        balanceAfter: {
            type: Number,
            default: 0,
        },
        description: {
            type: String,
            default: '',
        },
        // Reference to source document
        refModel: {
            type: String,
            enum: [
                'Deposit',
                'Withdrawal',
                'UserInvestment',
                'BonusCode',
                'WealthFund',
                'UserWealthFund',
                null,
            ],
            default: null,
        },
        refId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
    },
    { timestamps: true },
)

module.exports = mongoose.model('Transaction', transactionSchema)
