const express = require('express')
const router  = express.Router()
const { protect } = require('../middleware/auth')
const {
  register, login, adminLogin,
  refresh, logout,
  getMe, changePassword, changeWithdrawPassword,
  getCaptcha, getSecurityQuestions,
  forgotPassword, resetPassword, getUserSecurityQuestion,
  updateProfile,
  verifyPassword,
} = require('../controllers/authController')

// ── Public ────────────────────────────────────────────────────────────────
router.get ('/captcha',                  getCaptcha)
router.get ('/security-questions',       getSecurityQuestions)
router.get ('/security-question/:phone', getUserSecurityQuestion)

router.post('/register',         register)
router.post('/login',            login)
router.post('/admin/login',      adminLogin)
router.post('/forgot-password',  forgotPassword)
router.post('/reset-password',   resetPassword)

// ── Token management (public — cookies are verified internally) ───────────
router.post('/refresh', refresh)   // issues new access token using refresh cookie
router.post('/logout',  logout)    // clears both cookies

// ── Protected ─────────────────────────────────────────────────────────────
router.get('/me',                    protect, getMe)
router.put('/change-password',       protect, changePassword)
router.put('/withdraw-password',     protect, changeWithdrawPassword)
router.put('/profile',         protect, updateProfile)
router.post('/verify-password', protect, verifyPassword)

module.exports = router