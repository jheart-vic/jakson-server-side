const mongoose = require('mongoose');

const wealthFundSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    image: {
      type: String,
      default: null,
    },

    amount: {
      type: Number,
      required: true,
    },

    maturityAmount: {
      type: Number,
      required: true,
    },

    durationType: {
      type: String,
      enum: ['monthly', 'yearly'],
      required: true,
    },

    durationDays: {
      type: Number,
      required: true, // 30 or 365
    },

    maxUnits: {
      type: Number,
      default: 1,
    },

    availableUnits: {
      type: Number,
      default: 999999,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

wealthFundSchema.virtual('profit').get(function () {
  return this.maturityAmount - this.amount;
});

wealthFundSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('WealthFund', wealthFundSchema);