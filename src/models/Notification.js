const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    // Controls the banner colour / icon on the frontend
    type: {
      type: String,
      enum: ['info', 'success', 'warning', 'bonus'],
      default: 'info',
    },
    // Optional: when set, a "Copy code" button appears in the banner
    bonusCode: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // null → never expires; otherwise the banner hides after this date
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

// Index so the public query is fast
notificationSchema.index({ isActive: 1, expiresAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);