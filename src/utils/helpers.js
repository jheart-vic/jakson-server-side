const sendSuccess = (res, data = {}, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data,
  });
};

const sendError = (res, message = 'Error', statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};

const generateJWT = (id) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Calculate withdrawal fee
const calcWithdrawalFee = (amountUSD) => {
  const feePercent = amountUSD >= 500 ? 20 : 10;
  const feeAmount = +(amountUSD * (feePercent / 100)).toFixed(4);
  const netAmount = +(amountUSD - feeAmount).toFixed(4);
  return { feePercent, feeAmount, netAmount };
};

// Paginate helper
const paginate = (page = 1, limit = 20) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(100, Math.max(1, parseInt(limit)));
  return {
    skip: (p - 1) * l,
    limit: l,
    page: p,
  };
};

module.exports = { sendSuccess, sendError, generateJWT, calcWithdrawalFee, paginate };
