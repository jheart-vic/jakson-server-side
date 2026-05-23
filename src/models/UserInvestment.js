const mongoose = require('mongoose')

const userInvestmentSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productSnapshot: {
      name:        String,
      amount:      Number,
      cycleDays:   Number,
      dailyIncome: Number,
    },
    investmentAmount: { type: Number, required: true },
    dailyIncome:      { type: Number, required: true },
    startDate:        { type: Date, default: Date.now },
    expirationDate:   { type: Date, required: true },
    status:           { type: String, enum: ['in_progress', 'completed', 'cancelled'], default: 'in_progress' },
    totalEarned:      { type: Number, default: 0 },
    daysElapsed:      { type: Number, default: 0 },
    lastIncomeDate:   { type: Date, default: null },
    // Income queued by the cron — not yet claimed by the user
    pendingIncome:    { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('UserInvestment', userInvestmentSchema)