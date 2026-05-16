require('dotenv').config();
const connectDB = require('../config/db');
const Product = require('../models/Product');
const AppSettings = require('../models/AppSettings');

const products = [
  {
    name: 'Free Product',
    amount: 0,
    cycleDays: 3,
    dailyIncome: 0.55,
    maxUnits: 1,
    availableUnits: 9999,
    isFree: true,
    sortOrder: 0,
  },
  {
    name: 'Helia NXT Bifacial',
    amount: 7,
    cycleDays: 35,
    dailyIncome: 0.40,
    maxUnits: 3,
    availableUnits: 100,
    sortOrder: 1,
  },
  {
    name: 'Helia Monofacial',
    amount: 12,
    cycleDays: 40,
    dailyIncome: 0.62,
    maxUnits: 3,
    availableUnits: 0,
    sortOrder: 2,
  },
  {
    name: 'Jakson All Black',
    amount: 30,
    cycleDays: 40,
    dailyIncome: 1.50,
    maxUnits: 3,
    availableUnits: 50,
    sortOrder: 3,
  },
  {
    name: 'On-Grid Inverters',
    amount: 200,
    cycleDays: 40,
    dailyIncome: 8.70,
    maxUnits: 2,
    availableUnits: 0,
    sortOrder: 4,
  },
  {
    name: 'MonoPerc DCR BETA',
    amount: 350,
    cycleDays: 40,
    dailyIncome: 16.30,
    maxUnits: 2,
    availableUnits: 0,
    sortOrder: 5,
  },
  {
    name: 'Polycrystalline PV BETA',
    amount: 500,
    cycleDays: 40,
    dailyIncome: 22.80,
    maxUnits: 2,
    availableUnits: 0,
    sortOrder: 6,
  },
];

const settings = [
  { key: 'usd_to_ngn_rate', value: 1365, description: 'USD to NGN exchange rate' },
  {
    key: 'payment_bank_account',
    value: {
      bankName: 'OTPay',
      accountNumber: '0000000000',
      accountName: 'Jakson Solar',
    },
    description: 'Payment bank account for deposits',
  },
  { key: 'min_deposit', value: 5, description: 'Minimum deposit in USD' },
  { key: 'min_withdrawal', value: 2, description: 'Minimum withdrawal in USD' },
  { key: 'withdrawal_fee_low', value: 10, description: 'Fee % for withdrawals below $500' },
  { key: 'withdrawal_fee_high', value: 20, description: 'Fee % for withdrawals $500+' },
  { key: 'withdrawal_days', value: 'Monday to Friday', description: 'Withdrawal allowed days' },
  { key: 'withdrawal_hours', value: '10:00 AM - 06:00 PM', description: 'Withdrawal allowed hours' },
];

const seed = async () => {
  await connectDB();
  console.log('🌱 Seeding database...');

  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log(`✅ ${products.length} products seeded`);

  for (const s of settings) {
    await AppSettings.set(s.key, s.value);
  }
  console.log(`✅ ${settings.length} settings seeded`);

  console.log('🎉 Seed complete!');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
