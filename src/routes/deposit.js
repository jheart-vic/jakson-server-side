const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createDeposit,
  getDepositLog,
} = require('../controllers/depositController');

router.post('/', protect, createDeposit);
router.get('/log', protect, getDepositLog);

module.exports = router;
