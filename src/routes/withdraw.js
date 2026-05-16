const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createWithdrawal, getWithdrawalLog } = require('../controllers/withdrawController');

router.post('/', protect, createWithdrawal);
router.get('/log', protect, getWithdrawalLog);

module.exports = router;
