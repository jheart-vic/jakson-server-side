const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title:   { type: String, required: true, trim: true },
    body:    { type: String, required: true, trim: true },
    type:    { type: String, enum: ['info', 'success', 'warning', 'bonus'], default: 'info' },
    bonusCode: { type: String, default: null, uppercase: true, trim: true },
    isActive:  { type: Boolean, default: true },
    // Only set if admin explicitly provides durationDays when creating
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ isActive: 1, expiresAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);