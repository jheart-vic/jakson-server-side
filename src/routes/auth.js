const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  register,
  login,
  getMe,
  changePassword,
  changeWithdrawPassword,
  getCaptcha,
  getSecurityQuestions,
  forgotPassword,
  resetPassword,
  getUserSecurityQuestion,
  adminLogin,
} = require('../controllers/authController');

// ── Public ──────────────────────────────────────────
router.get('/captcha',                    getCaptcha);             // GET  fresh captcha image
router.get('/security-questions',         getSecurityQuestions);   // GET  list of questions
router.get('/security-question/:phone',   getUserSecurityQuestion); // GET  question for a phone
router.post('/register',                  register);               // POST register + security Q
router.post('/login',                     login);                  // POST login + captcha
router.post('/forgot-password',           forgotPassword);         // POST verify answer → token
router.post('/reset-password',            resetPassword);          // POST token + new password
router.post('/admin/login', adminLogin); // POST admin login (no captcha, but rate-limited in server.js)

// ── Protected ────────────────────────────────────────
router.get('/me',                   protect, getMe);
router.put('/change-password',      protect, changePassword);
router.put('/withdraw-password',    protect, changeWithdrawPassword);

module.exports = router;