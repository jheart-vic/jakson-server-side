const mongoose = require('mongoose');

const userNotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'deposit',        // deposit approved / rejected
        'withdrawal',     // withdrawal submitted / approved / rejected
        'bonus_code',     // bonus code redeemed
        'daily_income',   // daily investment income (summary)
        'referral_bonus', // commission earned when referral earns
        'invitee',        // someone you referred made their first investment
        'checkin',        // daily check-in reward
        'admin',          // admin credited or deducted wallet
        'system',         // generic system message
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    body:  { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false, index: true },
    // Optional structured data (amount, code, etc.)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// Compound index — most queries are per-user sorted by date
userNotificationSchema.index({ user: 1, createdAt: -1 });
userNotificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model('UserNotification', userNotificationSchema);