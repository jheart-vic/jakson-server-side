const mongoose = require('mongoose');

const userWealthFundSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    wealthFund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WealthFund',
      required: true,
    },

    fundSnapshot: {
      name: String,
      amount: Number,
      maturityAmount: Number,
      durationType: String,
      durationDays: Number,
    },

    investmentAmount: {
      type: Number,
      required: true,
    },

    maturityAmount: {
      type: Number,
      required: true,
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    maturityDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ['in_progress', 'completed', 'cancelled'],
      default: 'in_progress',
    },

    isClaimed: {
      type: Boolean,
      default: false,
    },

    claimedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserWealthFund', userWealthFundSchema);