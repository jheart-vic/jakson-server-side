const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getProducts, buyProduct, getMyInvestments, claimInvestmentIncome } = require('../controllers/investController');
const { claimDailyIncome } = require('../controllers/userController');

router.get('/products', protect, getProducts);
router.post('/buy/:productId', protect, buyProduct);
router.get('/my', protect, getMyInvestments);
router.post('/claim-income', protect, claimDailyIncome)
router.post('/:investmentId/claim', protect, claimInvestmentIncome)
module.exports = router;
