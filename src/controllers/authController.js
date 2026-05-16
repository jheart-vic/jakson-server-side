const User = require('../models/User')
const { asyncHandler } = require('../middleware/errorHandler')
const { sendSuccess, sendError, generateJWT } = require('../utils/helpers')
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

// @desc    Admin login — no captcha, credentials from .env
// @route   POST /api/auth/admin/login
// @access  Public
const adminLogin = asyncHandler(async (req, res) => {
    const { phone, password } = req.body

    if (!phone || !password) {
        return sendError(res, 'Phone and password are required')
    }

    // Check against .env credentials
    if (
        phone !== process.env.ADMIN_PHONE ||
        password !== process.env.ADMIN_PASSWORD
    ) {
        return sendError(res, 'Invalid credentials', 401)
    }

    // Find or auto-create the admin user
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

    if (!admin.isActive) {
        return sendError(res, 'Admin account suspended', 403)
    }

    // Ensure role is superadmin in case it was manually changed
    if (admin.role !== 'superadmin' && admin.role !== 'admin') {
        return sendError(res, 'Not an admin account', 403)
    }

    admin.lastLogin = new Date()
    await admin.save({ validateBeforeSave: false })

    const token = generateJWT(admin._id)

    return sendSuccess(
        res,
        {
            token,
            user: {
                id: admin._id,
                phone: admin.phone,
                role: admin.role,
                vipLevel: admin.vipLevel,
                balance: admin.balance,
            },
        },
        'Admin login successful',
    )
})

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
    const {
        phone,
        password,
        countryCode = '+234',
        referralCode,
        captchaId,
        captchaAnswer,
        securityQuestionId,
        securityAnswer,
    } = req.body

    // Validate captcha first
    const captchaResult = validateCaptcha(captchaId, captchaAnswer)
    if (!captchaResult.valid) {
        return sendError(res, captchaResult.reason)
    }

    if (!phone || !password) {
        return sendError(res, 'Phone and password are required')
    }

    // Validate security question
    if (!securityQuestionId || !securityAnswer) {
        return sendError(res, 'Security question and answer are required')
    }
    if (!getQuestionById(securityQuestionId)) {
        return sendError(res, 'Invalid security question selected')
    }
    if (securityAnswer.trim().length < 2) {
        return sendError(res, 'Security answer must be at least 2 characters')
    }

    const existingUser = await User.findOne({ phone })
    if (existingUser) {
        return sendError(res, 'Phone number already registered')
    }

    let referrer = null
    if (referralCode) {
        referrer = await User.findOne({
            referralCode: referralCode.toUpperCase(),
        })
        if (!referrer) {
            return sendError(res, 'Invalid referral code')
        }
    }

    const user = await User.create({
        phone,
        password,
        countryCode,
        referredBy: referrer ? referrer._id : null,
        securityQuestionId,
        securityAnswer, // will be hashed by pre-save hook
    })

    const token = generateJWT(user._id)

    return sendSuccess(
        res,
        {
            token,
            user: {
                id: user._id,
                phone: user.maskedPhone(),
                referralCode: user.referralCode,
                vipLevel: user.vipLevel,
                balance: user.balance,
            },
        },
        'Registration successful',
        201,
    )
})

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
    const { phone, password, captchaId, captchaAnswer } = req.body

    // Validate captcha first
    const captchaResult = validateCaptcha(captchaId, captchaAnswer)
    if (!captchaResult.valid) {
        return sendError(res, captchaResult.reason)
    }

    if (!phone || !password) {
        return sendError(res, 'Phone and password are required')
    }

    const user = await User.findOne({ phone }).select('+password')
    if (!user) {
        return sendError(res, 'Invalid phone or password', 401)
    }

    if (!user.isActive) {
        return sendError(res, 'Account suspended. Contact support.', 403)
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
        return sendError(res, 'Invalid phone or password', 401)
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save({ validateBeforeSave: false })

    const token = generateJWT(user._id)

    return sendSuccess(
        res,
        {
            token,
            user: {
                id: user._id,
                phone: user.maskedPhone(),
                referralCode: user.referralCode,
                vipLevel: user.vipLevel,
                balance: user.balance,
            },
        },
        'Login successful',
    )
})

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    const user = req.user
    return sendSuccess(res, {
        user: {
            id: user._id,
            phone: user.maskedPhone(),
            referralCode: user.referralCode,
            vipLevel: user.vipLevel,
            balance: user.balance,
            totalEarnings: user.totalEarnings,
            todayEarnings: user.todayEarnings,
            yesterdayEarnings: user.yesterdayEarnings,
            realName: user.realName,
            idVerified: user.idVerified,
            telegramJoined: user.telegramJoined,
            lastCheckin: user.lastCheckin,
            checkinStreak: user.checkinStreak,
            createdAt: user.createdAt,
        },
    })
})

// @desc    Change login password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
        return sendError(res, 'Current and new password are required')
    }

    const user = await User.findById(req.user._id).select('+password')
    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
        return sendError(res, 'Current password is incorrect', 401)
    }

    user.password = newPassword
    await user.save()

    return sendSuccess(res, {}, 'Password changed successfully')
})

// @desc    Set/change withdrawal password
// @route   PUT /api/auth/withdraw-password
// @access  Private
const changeWithdrawPassword = asyncHandler(async (req, res) => {
    const { newWithdrawPassword, loginPassword } = req.body

    if (!newWithdrawPassword || !loginPassword) {
        return sendError(
            res,
            'Login password and new withdrawal password required',
        )
    }

    if (newWithdrawPassword.length !== 6) {
        return sendError(res, 'Withdrawal password must be exactly 6 digits')
    }

    const user = await User.findById(req.user._id).select('+password')
    const isMatch = await user.comparePassword(loginPassword)
    if (!isMatch) {
        return sendError(res, 'Login password is incorrect', 401)
    }

    user.withdrawPassword = newWithdrawPassword
    await user.save()

    return sendSuccess(res, {}, 'Withdrawal password set successfully')
})

// @desc    Generate a new captcha image
// @route   GET /api/auth/captcha
// @access  Public
const getCaptcha = asyncHandler(async (req, res) => {
    const { captchaId, image } = generateCaptcha()
    return sendSuccess(
        res,
        {
            captchaId,
            image, // SVG data URI — render in <img src={image} />
        },
        'Captcha generated',
    )
})

// @desc    Get list of security questions
// @route   GET /api/auth/security-questions
// @access  Public
const getSecurityQuestions = asyncHandler(async (req, res) => {
    return sendSuccess(res, { questions: SECURITY_QUESTIONS })
})

// @desc    Verify security answer → issue a reset token
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
    const { phone, securityQuestionId, securityAnswer } = req.body

    if (!phone || !securityQuestionId || !securityAnswer) {
        return sendError(
            res,
            'Phone, security question and answer are required',
        )
    }

    // Find user with security fields
    const user = await User.findOne({ phone }).select(
        '+securityQuestionId +securityAnswer',
    )

    // Generic error — never reveal whether phone exists
    const genericError = 'Incorrect answer. Please try again.'

    if (!user) return sendError(res, genericError, 401)

    if (!user.securityAnswer) {
        return sendError(
            res,
            'No security question set for this account. Contact support.',
        )
    }

    // Check question matches
    if (parseInt(securityQuestionId) !== user.securityQuestionId) {
        return sendError(res, genericError, 401)
    }

    // Check answer (case-insensitive, bcrypt)
    const isMatch = await user.compareSecurityAnswer(securityAnswer)
    if (!isMatch) return sendError(res, genericError, 401)

    // Generate a 15-minute reset token
    const resetToken = createResetToken(user._id)

    return sendSuccess(
        res,
        { resetToken },
        'Answer verified. You may now reset your password.',
    )
})

// @desc    Reset password using a valid reset token
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
    const { resetToken, newPassword } = req.body

    if (!resetToken || !newPassword) {
        return sendError(res, 'Reset token and new password are required')
    }

    if (newPassword.length < 6) {
        return sendError(res, 'Password must be at least 6 characters')
    }

    // Validate the token
    const { valid, reason, userId } = validateResetToken(resetToken)
    if (!valid) return sendError(res, reason, 401)

    // Find and update user
    const user = await User.findById(userId)
    if (!user) return sendError(res, 'User not found', 404)

    user.password = newPassword // pre-save hook hashes it
    await user.save()

    // Consume (delete) the token — one-shot
    consumeResetToken(resetToken)

    return sendSuccess(
        res,
        {},
        'Password reset successfully. Please log in with your new password.',
    )
})

// @desc    Get the security question for a given phone (for the forgot-password UI)
// @route   GET /api/auth/security-question/:phone
// @access  Public
const getUserSecurityQuestion = asyncHandler(async (req, res) => {
    const { phone } = req.params

    const user = await User.findOne({ phone }).select('+securityQuestionId')

    // Generic response — never reveal whether the phone is registered
    if (!user || !user.securityQuestionId) {
        return sendSuccess(res, {
            question: null,
            message:
                'If this phone is registered, a security question will be shown.',
        })
    }

    const q = getQuestionById(user.securityQuestionId)
    return sendSuccess(res, {
        question: q ? q.question : null,
        questionId: user.securityQuestionId,
    })
})

module.exports = {
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
}
