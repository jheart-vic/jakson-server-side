const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { asyncHandler } = require('../middleware/errorHandler')
const {
    sendSuccess,
    sendError,
    setAuthCookies,
    clearAuthCookies,
} = require('../utils/helpers')
const { generateCaptcha, validateCaptcha } = require('../utils/captcha')
const {
    createResetToken,
    validateResetToken,
    consumeResetToken,
} = require('../utils/resetTokenStore')
const {
    SECURITY_QUESTIONS,
    getQuestionById,
} = require('../utils/securityQuestions')

// ── Shared user shapes ────────────────────────────────────────────────────
const publicUser = (user) => ({
    id: user._id,
    phone: user.maskedPhone(),
    fullName: user.fullName || null,
    userName: user.userName || null,
    displayName: user.displayName(),
    initials: user.initials(),
    referralCode: user.referralCode,
    vipLevel: user.vipLevel,
    balance: user.balance,
    role: user.role,
})

const adminPublicUser = (user) => ({
    id: user._id,
    phone: user.phone,
    role: user.role,
    fullName: user.fullName,
    userName: user.userName,
    vipLevel: user.vipLevel,
    balance: user.balance,
})

// ── Admin login ───────────────────────────────────────────────────────────
const adminLogin = asyncHandler(async (req, res) => {
    const { phone, password } = req.body
    if (!phone || !password)
        return sendError(res, 'Phone and password are required')
    if (
        phone !== process.env.ADMIN_PHONE ||
        password !== process.env.ADMIN_PASSWORD
    )
        return sendError(res, 'Invalid credentials', 401)

    let admin = await User.findOne({ phone }).select('+password')
    if (!admin) {
        admin = await User.create({
            phone,
            password,
            countryCode: '+234',
            role: 'superadmin',
            securityQuestionId: 1,
            securityAnswer: 'admin',
        })
    }
    if (!admin.isActive) return sendError(res, 'Admin account suspended', 403)
    if (admin.role !== 'superadmin' && admin.role !== 'admin')
        return sendError(res, 'Not an admin account', 403)
    admin.lastLogin = new Date()
    await admin.save({ validateBeforeSave: false })
    setAuthCookies(res, admin._id)
    return sendSuccess(
        res,
        { user: adminPublicUser(admin) },
        'Admin login successful',
    )
})

// ── Register ──────────────────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
    const {
        phone,
        password,
        countryCode = '+234',
        fullName,
        userName,
        referralCode,
        captchaId,
        captchaAnswer,
        securityQuestionId,
        securityAnswer,
    } = req.body

    const captchaResult = validateCaptcha(captchaId, captchaAnswer)
    if (!captchaResult.valid) return sendError(res, captchaResult.reason)
    if (!phone || !password)
        return sendError(res, 'Phone and password are required')
    if (!securityQuestionId || !securityAnswer)
        return sendError(res, 'Security question and answer are required')
    if (!getQuestionById(securityQuestionId))
        return sendError(res, 'Invalid security question selected')
    if (securityAnswer.trim().length < 2)
        return sendError(res, 'Security answer must be at least 2 characters')

    // Validate userName uniqueness if provided
    if (userName) {
        const taken = await User.findOne({ userName: userName.trim() })
        if (taken) return sendError(res, 'Username is already taken')
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(userName.trim()))
            return sendError(
                res,
                'Username must be 3-20 characters (letters, numbers, underscores only)',
            )
    }

    const existingUser = await User.findOne({ phone })
    if (existingUser) return sendError(res, 'Phone number already registered')

    let referrer = null
    if (referralCode) {
        referrer = await User.findOne({
            referralCode: referralCode.toUpperCase(),
        })
        if (!referrer) return sendError(res, 'Invalid referral code')
    }

    const user = await User.create({
        phone,
        password,
        countryCode,
        fullName: fullName?.trim() || null,
        userName: userName?.trim() || null,
        referredBy: referrer?._id ?? null,
        securityQuestionId,
        securityAnswer,
    })

    setAuthCookies(res, user._id)
    return sendSuccess(
        res,
        { user: publicUser(user) },
        'Registration successful',
        201,
    )
})

// ── Login ─────────────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
    const { phone, password, captchaId, captchaAnswer } = req.body
    const captchaResult = validateCaptcha(captchaId, captchaAnswer)
    if (!captchaResult.valid) return sendError(res, captchaResult.reason)
    if (!phone || !password)
        return sendError(res, 'Phone and password are required')

    const user = await User.findOne({ phone }).select('+password')
    if (!user) return sendError(res, 'Invalid phone or password', 401)
    if (!user.isActive)
        return sendError(res, 'Account suspended. Contact support.', 403)

    const isMatch = await user.comparePassword(password)
    if (!isMatch) return sendError(res, 'Invalid phone or password', 401)

    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })
    setAuthCookies(res, user._id)
    return sendSuccess(res, { user: publicUser(user) }, 'Login successful')
})

// ── Refresh ───────────────────────────────────────────────────────────────
const refresh = asyncHandler(async (req, res) => {
    const token = req.cookies?.refresh_token
    if (!token) return sendError(res, 'No refresh token', 401)
    let decoded
    try {
        decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
    } catch {
        clearAuthCookies(res)
        return sendError(
            res,
            'Refresh token expired or invalid. Please log in again.',
            401,
        )
    }
    const user = await User.findById(decoded.id)
    if (!user || !user.isActive) {
        clearAuthCookies(res)
        return sendError(res, 'User not found or suspended', 401)
    }
    setAuthCookies(res, user._id)
    return sendSuccess(res, {}, 'Token refreshed')
})

// ── Logout ────────────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
    clearAuthCookies(res)
    return sendSuccess(res, {}, 'Logged out successfully')
})

// ── Get current user ──────────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
    const user = req.user
    return sendSuccess(res, {
        user: {
            id: user._id,
            phone: user.maskedPhone(),
            fullName: user.fullName || null,
            userName: user.userName || null,
            displayName: user.displayName(),
            initials: user.initials(),
            referralCode: user.referralCode,
            vipLevel: user.vipLevel,
            balance: user.balance,
            pendingDailyIncome: user.pendingDailyIncome,
            totalEarnings: user.totalEarnings,
            todayEarnings: user.todayEarnings,
            yesterdayEarnings: user.yesterdayEarnings,
            realName: user.realName,
            idVerified: user.idVerified,
            telegramJoined: user.telegramJoined,
            lastCheckin: user.lastCheckin,
            checkinStreak: user.checkinStreak,
            lastIncomeClaim: user.lastIncomeClaim,
            role: user.role,
            createdAt: user.createdAt,
        },
    })
})

// ── Update profile (fullName + userName) ─────────────────────────────────
// @route PUT /api/auth/profile
const updateProfile = asyncHandler(async (req, res) => {
    const { fullName, userName } = req.body

    const updates = {}

    if (fullName !== undefined) {
        updates.fullName = fullName?.trim() || null
    }

    if (userName !== undefined) {
        const cleaned = userName?.trim() || null
        if (cleaned) {
            if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleaned))
                return sendError(
                    res,
                    'Username must be 3-20 characters (letters, numbers, underscores only)',
                )
            const taken = await User.findOne({
                userName: cleaned,
                _id: { $ne: req.user._id },
            })
            if (taken) return sendError(res, 'Username is already taken')
        }
        updates.userName = cleaned
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
    })
    return sendSuccess(
        res,
        {
            user: {
                fullName: user.fullName,
                userName: user.userName,
                displayName: user.displayName(),
                initials: user.initials(),
            },
        },
        'Profile updated successfully',
    )
})

// ── Change login password ─────────────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword)
        return sendError(res, 'Current and new password are required')
    const user = await User.findById(req.user._id).select('+password')
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) return sendError(res, 'Current password is incorrect', 401)
    user.password = newPassword
    await user.save()
    return sendSuccess(res, {}, 'Password changed successfully')
})

// ── Change withdrawal password ────────────────────────────────────────────
const changeWithdrawPassword = asyncHandler(async (req, res) => {
    const { newWithdrawPassword, loginPassword } = req.body
    if (!newWithdrawPassword || !loginPassword)
        return sendError(
            res,
            'Login password and new withdrawal password required',
        )
    if (newWithdrawPassword.length !== 6)
        return sendError(res, 'Withdrawal password must be exactly 6 digits')
    const user = await User.findById(req.user._id).select('+password')
    const isMatch = await user.comparePassword(loginPassword)
    if (!isMatch) return sendError(res, 'Login password is incorrect', 401)
    user.withdrawPassword = newWithdrawPassword
    await user.save()
    return sendSuccess(res, {}, 'Withdrawal password set successfully')
})

// ── Captcha ───────────────────────────────────────────────────────────────
const getCaptcha = asyncHandler(async (req, res) => {
    const { captchaId, image } = generateCaptcha()
    return sendSuccess(res, { captchaId, image }, 'Captcha generated')
})

const getSecurityQuestions = asyncHandler(async (req, res) =>
    sendSuccess(res, { questions: SECURITY_QUESTIONS }),
)

// ── Forgot / Reset password ───────────────────────────────────────────────
const forgotPassword = asyncHandler(async (req, res) => {
    const { phone, securityQuestionId, securityAnswer } = req.body
    if (!phone || !securityQuestionId || !securityAnswer)
        return sendError(
            res,
            'Phone, security question and answer are required',
        )
    const user = await User.findOne({ phone }).select(
        '+securityQuestionId +securityAnswer',
    )
    const genericError = 'Incorrect answer. Please try again.'
    if (!user) return sendError(res, genericError, 401)
    if (!user.securityAnswer)
        return sendError(
            res,
            'No security question set for this account. Contact support.',
        )
    if (parseInt(securityQuestionId) !== user.securityQuestionId)
        return sendError(res, genericError, 401)
    const isMatch = await user.compareSecurityAnswer(securityAnswer)
    if (!isMatch) return sendError(res, genericError, 401)
    const resetToken = createResetToken(user._id)
    return sendSuccess(
        res,
        { resetToken },
        'Answer verified. You may now reset your password.',
    )
})

const resetPassword = asyncHandler(async (req, res) => {
    const { resetToken, newPassword } = req.body
    if (!resetToken || !newPassword)
        return sendError(res, 'Reset token and new password are required')
    if (newPassword.length < 6)
        return sendError(res, 'Password must be at least 6 characters')
    const { valid, reason, userId } = validateResetToken(resetToken)
    if (!valid) return sendError(res, reason, 401)
    const user = await User.findById(userId)
    if (!user) return sendError(res, 'User not found', 404)
    user.password = newPassword
    await user.save()
    consumeResetToken(resetToken)
    return sendSuccess(
        res,
        {},
        'Password reset successfully. Please log in with your new password.',
    )
})

const getUserSecurityQuestion = asyncHandler(async (req, res) => {
    const { phone } = req.params
    const user = await User.findOne({ phone }).select('+securityQuestionId')
    if (!user || !user.securityQuestionId)
        return sendSuccess(res, {
            question: null,
            message:
                'If this phone is registered, a security question will be shown.',
        })
    const q = getQuestionById(user.securityQuestionId)
    return sendSuccess(res, {
        question: q?.question ?? null,
        questionId: user.securityQuestionId,
    })
})

module.exports = {
    register,
    login,
    adminLogin,
    refresh,
    logout,
    getMe,
    updateProfile,
    changePassword,
    changeWithdrawPassword,
    getCaptcha,
    getSecurityQuestions,
    forgotPassword,
    resetPassword,
    getUserSecurityQuestion,
}
