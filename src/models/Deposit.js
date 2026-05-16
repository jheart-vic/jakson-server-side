const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    method: {
      type: String,
      enum: ['bank'],
      default: 'bank',
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
      required: true, // rate used at time of deposit
    },
    // OTPay / payment processor fields
    paymentRef: {
      type: String,
      default: null,
    },
    paymentOrderId: {
      type: String,
      default: null,
    },
    // Bank details assigned for this deposit
    assignedBankName: {
      type: String,
      default: null,
    },
    assignedAccountNumber: {
      type: String,
      default: null,
    },
    assignedAccountName: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending',
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedReason: {
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

module.exports = mongoose.model('Deposit', depositSchema);
