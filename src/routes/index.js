const express = require('express');
const router = express.Router();

const authRoutes = require('./auth');
const investRoutes = require('./invest');
const depositRoutes = require('./deposit');
const withdrawRoutes = require('./withdraw');
const userRoutes = require('./user');
const adminRoutes = require('./admin');

router.use('/auth', authRoutes);
router.use('/invest', investRoutes);
router.use('/deposit', depositRoutes);
router.use('/withdraw', withdrawRoutes);
router.use('/', userRoutes);
router.use('/admin', adminRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Jakson Solar API is running 🌞' });
});

module.exports = router;
