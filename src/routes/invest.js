const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getProducts, buyProduct, getMyInvestments } = require('../controllers/investController');
const { claimDailyIncome } = require('../controllers/userController');

router.get('/products', protect, getProducts);
router.post('/buy/:productId', protect, buyProduct);
router.get('/my', protect, getMyInvestments);
router.post('/invest/claim-income', protect, claimDailyIncome)
module.exports = router;
