const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const userSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, trim: true },
    countryCode: { type: String, default: '+234' },
    // ── Identity ──────────────────────────────────────────
    fullName: { type: String, default: null, trim: true },
    userName: { type: String, default: null, trim: true, unique: true, sparse: true },
    // ── Auth ──────────────────────────────────────────────
    password:         { type: String, required: true, minlength: 6, select: false },
    withdrawPassword: { type: String, minlength: 6, select: false },
    securityQuestionId: { type: Number, default: null, select: false },
    securityAnswer:     { type: String, default: null, select: false },
    // ── Role ──────────────────────────────────────────────
    role: { type: String, enum: ['user', 'admin', 'superadmin'], default: 'user' },
    // ── Referral ──────────────────────────────────────────
    referralCode: { type: String, unique: true, uppercase: true },
    referredBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    vipLevel:     { type: Number, default: 0 },
    // ── Balance ───────────────────────────────────────────
    balance:           { type: Number, default: 0 },
    totalEarnings:     { type: Number, default: 0 },
    todayEarnings:     { type: Number, default: 0 },
    yesterdayEarnings: { type: Number, default: 0 },
    lastEarningsReset: { type: Date, default: null },
    // ── Claimable daily income (pending until user claims) ─
    pendingDailyIncome: { type: Number, default: 0 },
    lastIncomeClaim:    { type: Date, default: null },
    // ── Profile ───────────────────────────────────────────
    realName:    { type: String, default: null },
    idVerified:  { type: Boolean, default: false },
    isActive:    { type: Boolean, default: true  },
    lastLogin:   { type: Date, default: null },
    // ── Check-in ──────────────────────────────────────────
    lastCheckin:   { type: Date, default: null },
    checkinStreak: { type: Number, default: 0  },
    telegramJoined: { type: Boolean, default: false },
  },
  { timestamps: true },
)

// ── Pre-save hooks ────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (this.isModified('password'))
    this.password = await bcrypt.hash(this.password, 12)

  if (this.isModified('withdrawPassword') && this.withdrawPassword)
    this.withdrawPassword = await bcrypt.hash(this.withdrawPassword, 12)

  if (this.isModified('securityAnswer') && this.securityAnswer)
    this.securityAnswer = await bcrypt.hash(this.securityAnswer.toLowerCase().trim(), 12)

  if (!this.referralCode) this.referralCode = generateCode(8)
  next()
})

// ── Methods ───────────────────────────────────────────────
userSchema.methods.comparePassword        = async function (c) { return bcrypt.compare(c, this.password) }
userSchema.methods.compareSecurityAnswer  = async function (c) { return bcrypt.compare(c.toLowerCase().trim(), this.securityAnswer) }
userSchema.methods.compareWithdrawPassword= async function (c) { return bcrypt.compare(c, this.withdrawPassword) }

userSchema.methods.maskedPhone = function () {
  const p = this.phone
  if (p.length <= 6) return p
  return p.slice(0, 2) + '***' + p.slice(-4)
}

// Display name: userName > fullName > maskedPhone
userSchema.methods.displayName = function () {
  return this.userName || this.fullName || this.maskedPhone()
}

// Initials for avatar: from fullName if available, else first char of phone
userSchema.methods.initials = function () {
  if (this.fullName) {
    const parts = this.fullName.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0][0].toUpperCase()
  }
  return this.phone.charAt(0).toUpperCase()
}

function generateCode (length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let r = ''
  for (let i = 0; i < length; i++) r += chars.charAt(Math.floor(Math.random() * chars.length))
  return r
}

module.exports = mongoose.model('User', userSchema)