const mongoose = require('mongoose');

const bonusCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    amountUSD: {
      type: Number,
      required: true,
    },
    maxUses: {
      type: Number,
      default: 1, // -1 = unlimited
    },
    usedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        usedAt: { type: Date, default: Date.now },
      },
    ],
    expiresAt: {
      type: Date,
      default: null, // null = never expires
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Check if code is valid for a given user
bonusCodeSchema.methods.isValidFor = function (userId) {
  if (!this.isActive) return { valid: false, reason: 'Code is inactive' };

  if (this.expiresAt && new Date() > this.expiresAt) {
    return { valid: false, reason: 'Code has expired' };
  }

  if (this.maxUses !== -1 && this.usedBy.length >= this.maxUses) {
    return { valid: false, reason: 'Code has reached max uses' };
  }

  const alreadyUsed = this.usedBy.some(
    (u) => u.user.toString() === userId.toString()
  );
  if (alreadyUsed) {
    return { valid: false, reason: 'You have already used this code' };
  }

  return { valid: true };
};

module.exports = mongoose.model('BonusCode', bonusCodeSchema);
