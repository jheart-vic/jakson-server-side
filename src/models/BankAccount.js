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
  'ACCESS BANK (DIAMOND)',
  'ALTERNATIVE BANK',
  'CARBON',
  'ECOBANK',
  'EYOWO MFB',
  'FAIRMONEY',
  'FCMB BANK',
  'FIDELITY BANK',
  'FIRST BANK',
  'GLOBUS BANK',
  'GTBANK PLC',
  'HERITAGE BANK',
  'JAIZ BANK',
  'KEYSTONE BANK',
  'KUDA BANK',
  'LOTUS BANK',
  'MONIEPOINT',
  'MOMO PSB',
  'MONEYMASTER PSB',
  '9 PAYMENT SERVICE BANK',
  'NOMBA',
  'OPAY',
  'OPTIMUS BANK',
  'PAGA',
  'PALMPAY',
  'PARALLEX BANK',
  'POLARIS BANK',
  'PREMIUM TRUST BANK',
  'PROVIDUS BANK',
  'RUBIES BANK',
  'SAFE HAVEN MFB',
  'SMARTCASH PSB',
  'SPARKLE',
  'STANBIC IBTC BANK',
  'STANDARD CHARTERED',
  'STERLING BANK',
  'SUNTRUST BANK',
  'TAJ BANK',
  'TANGERINE BANK',
  'TITAN TRUST BANK',
  'UBA BANK',
  'UNION BANK',
  'UNITY BANK',
  'VFD MICROFINANCE BANK',
  'WEMA BANK',
  'ZENITH BANK',
];

bankAccountSchema.statics.NIGERIAN_BANKS = NIGERIAN_BANKS;

module.exports = mongoose.model('BankAccount', bankAccountSchema);