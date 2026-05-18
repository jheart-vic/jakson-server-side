const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');

const {
  getWealthFunds,
  buyWealthFund,
  claimWealthFund,
  getMyWealthFunds,
} = require('../controllers/userwealthFundController');

router.get('/', protect, getWealthFunds);

router.post('/buy/:fundId', protect, buyWealthFund);

router.post('/claim/:investmentId', protect, claimWealthFund);

router.get('/my', protect, getMyWealthFunds);

module.exports = router;