const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Supported Nigerian banks list — sourced directly from the app UI
const NIGERIAN_BANKS = [
  'ACCESS BANK',
  'ECOBANK',
  'EYOWO MFB',
  'FCMB BANK',
  'FIDELITY BANK',
  'FIRST BANK',
  'GTBANK PLC',
  'GLOBUS BANK',
  'HERITAGE BANK',
  'JAIZ BANK',
  'KEYSTONE BANK',
  'KUDA BANK',
  'MONIEPOINT',
  'OPAY',
  'PAGA',
  'PROVIDUS BANK',
  'STANBIC IBTC BANK',
  'STERLING BANK',
  'SUNTRUST BANK',
  'TAJ BANK',
  'TITAN TRUST BANK',
  'UBA BANK',
  'UNION BANK',
  'UNITY BANK',
  'WEMA BANK',
  'ZENITH BANK',
];

bankAccountSchema.statics.NIGERIAN_BANKS = NIGERIAN_BANKS;

module.exports = mongoose.model('BankAccount', bankAccountSchema);