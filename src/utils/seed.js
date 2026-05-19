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
image: "https://i.pinimg.com/1200x/cc/40/0a/cc400a98dd1a9007ba2f20aa57dda0a8.jpg",
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
image: "https://i.pinimg.com/1200x/d4/57/af/d457afad29b2807168c6479b884884cd.jpg",
    maxUnits: 1,
    availableUnits: 9999,
    sortOrder: 2,
  },
  {
    name: 'VIP 3',
    amount: 260000,
    cycleDays: 80,
    dailyIncome: 9036,
image: "https://i.pinimg.com/1200x/9a/6e/95/9a6e958b3f5868c9a2abd5e7b7c5a97f.jpg",
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
    image: "https://i.pinimg.com/1200x/96/f8/80/96f880d10fb85ce847bbfef30da87f51.jpg",
    maturityAmount: 50000,
    durationType: 'monthly',
    durationDays: 30,
    isActive:false,
    availableUnits: 9999,
    sortOrder: 1,
  },
  {
    name: 'Wealth Fund Premium',
    amount: 92000,
    image: "https://i.pinimg.com/1200x/36/18/9f/36189f76f03a2b7bf9cccabfdbc8ab1e.jpg",
    maturityAmount: 122000,
    durationType: 'monthly',
    durationDays: 30,
    isActive:false,
    availableUnits: 9999,
    sortOrder: 2,
  },
  {
    name: 'Wealth Fund Elite',
    amount: 260000,
    image: "https://i.pinimg.com/1200x/a0/ad/b1/a0adb18072d40f8a1d06482854302ee6.jpg",
    maturityAmount: 360000,
    durationType: 'yearly',
    durationDays: 365,
    isActive:false,
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