const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        countryCode: {
            type: String,
            default: '+234',
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false,
        },
        withdrawPassword: {
            type: String,
            minlength: 6,
            select: false,
        },
        // ── Security Question (for password reset) ──────────────
        securityQuestionId: {
            type: Number, // references SECURITY_QUESTIONS[].id
            default: null,
            select: false,
        },
        securityAnswer: {
            type: String, // bcrypt-hashed answer (lowercased before hash)
            default: null,
            select: false,
        },
        role: {
            type: String,
            enum: ['user', 'admin', 'superadmin'],
            default: 'user',
        },
        referralCode: {
            type: String,
            unique: true,
            uppercase: true,
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        vipLevel: {
            type: Number,
            default: 0, // VIP0, VIP1, VIP2 ...
        },
        balance: {
            type: Number,
            default: 0, // stored in USD cents → display as USD
        },
        totalEarnings: {
            type: Number,
            default: 0,
        },
        todayEarnings: {
            type: Number,
            default: 0,
        },
        yesterdayEarnings: {
            type: Number,
            default: 0,
        },
        lastEarningsReset: {
            type: Date,
            default: null,
        },
        realName: {
            type: String,
            default: null,
        },
        idVerified: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: {
            type: Date,
            default: null,
        },
        lastCheckin: {
            type: Date,
            default: null,
        },
        checkinStreak: {
            type: Number,
            default: 0,
        },
        telegramJoined: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
)

// Generate referral code before save
userSchema.pre('save', async function (next) {
    // Hash password
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 12)
    }

    // Hash withdraw password
    if (this.isModified('withdrawPassword') && this.withdrawPassword) {
        this.withdrawPassword = await bcrypt.hash(this.withdrawPassword, 12)
    }

    // Hash security answer (normalize to lowercase before hashing)
    if (this.isModified('securityAnswer') && this.securityAnswer) {
        this.securityAnswer = await bcrypt.hash(
            this.securityAnswer.toLowerCase().trim(),
            12,
        )
    }

    // Generate unique referral code
    if (!this.referralCode) {
        this.referralCode = generateCode(8)
    }

    next()
})

// Compare passwords
userSchema.methods.comparePassword = async function (candidate) {
    return bcrypt.compare(candidate, this.password)
}

// Compare security answer (case-insensitive)
userSchema.methods.compareSecurityAnswer = async function (candidate) {
    return bcrypt.compare(candidate.toLowerCase().trim(), this.securityAnswer)
}

userSchema.methods.compareWithdrawPassword = async function (candidate) {
    return bcrypt.compare(candidate, this.withdrawPassword)
}

// Mask phone for display e.g. 90***2820
userSchema.methods.maskedPhone = function () {
    const p = this.phone
    if (p.length <= 6) return p
    return p.slice(0, 2) + '***' + p.slice(-4)
}

function generateCode(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

module.exports = mongoose.model('User', userSchema)
