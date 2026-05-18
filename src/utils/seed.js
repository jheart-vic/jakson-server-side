require('dotenv').config();
const connectDB = require('../config/db');

const Product = require('../models/Product');
const WealthFund = require('../models/WealthFund');
const AppSettings = require('../models/AppSettings');

const products = [
  {
    name: 'VIP 1',
    amount: 17980,
    cycleDays: 60,
    dailyIncome: 584,
    vipLevel: 1,
    maxUnits: 1,
    availableUnits: 9999,
    sortOrder: 1,
  },
  {
    name: 'VIP 2',
    amount: 92400,
    cycleDays: 72,
    dailyIncome: 3172,
    vipLevel: 2,
    maxUnits: 1,
    availableUnits: 9999,
    sortOrder: 2,
  },
  {
    name: 'VIP 3',
    amount: 260000,
    cycleDays: 80,
    dailyIncome: 9036,
    vipLevel: 3,
    maxUnits: 1,
    availableUnits: 9999,
    sortOrder: 3,
  },
];

const wealthFunds = [
  {
    name: 'Wealth Fund Basic',
    amount: 30000,
    maturityAmount: 50000,
    durationType: 'monthly',
    durationDays: 30,
    availableUnits: 9999,
    sortOrder: 1,
  },
  {
    name: 'Wealth Fund Premium',
    amount: 92000,
    maturityAmount: 122000,
    durationType: 'monthly',
    durationDays: 30,
    availableUnits: 9999,
    sortOrder: 2,
  },
  {
    name: 'Wealth Fund Elite',
    amount: 260000,
    maturityAmount: 360000,
    durationType: 'yearly',
    durationDays: 365,
    availableUnits: 9999,
    sortOrder: 3,
  },
];

const seed = async () => {
  await connectDB();

  console.log('🌱 Seeding database...');

  await Product.deleteMany({});
  await WealthFund.deleteMany({});

  await Product.insertMany(products);
  console.log(`✅ ${products.length} VIP products seeded`);

  await WealthFund.insertMany(wealthFunds);
  console.log(`✅ ${wealthFunds.length} wealth funds seeded`);

  console.log('🎉 Seed complete!');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});