const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const investRoutes = require('./invest');
const depositRoutes = require('./deposit');
const withdrawRoutes = require('./withdraw');
const userRoutes = require('./user');
const adminRoutes = require('./admin');
const wealthFundRoutes = require('./wealthFund');
const settingsRoutes = require('./settings');


router.use('/auth', authRoutes);
router.use('/invest', investRoutes);
router.use('/deposit', depositRoutes);
router.use('/withdraw', withdrawRoutes);
router.use('/', userRoutes);
router.use('/admin', adminRoutes);
router.use('/wealth-fund', wealthFundRoutes);
router.use('/settings', settingsRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Jakson Solar API is running 🌞' });
});

module.exports = router;
