const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bankAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      required: true,
    },
    // Snapshot of bank details at time of withdrawal
    bankSnapshot: {
      bankName: String,
      accountName: String,
      accountNumber: String,
    },
    amountUSD: {
      type: Number,
      required: true,
    },
    amountNGN: {
      type: Number,
      required: true,
    },
    exchangeRate: {
      type: Number,
      required: true,
    },
    // Fees
    feePercent: {
      type: Number,
      required: true, // 10 or 20
    },
    feeAmountUSD: {
      type: Number,
      required: true,
    },
    netAmountUSD: {
      type: Number,
      required: true, // amount after fee
    },
    netAmountNGN: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'rejected'],
      default: 'pending',
    },
    processedAt: {
      type: Date,
      default: null,
    },
    rejectedReason: {
      type: String,
      default: null,
    },
    // OTPay payout reference
    payoutRef: {
      type: String,
      default: null,
    },
    adminNote: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
