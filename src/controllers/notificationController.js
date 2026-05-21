const Notification = require('../models/Notification');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendError } = require('../utils/helpers');

// ─────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────

// @desc    Get active, non-expired notifications (for user banner)
// @route   GET /api/settings/notifications
// @access  Public
const getPublicNotifications = asyncHandler(async (req, res) => {
  const now = new Date();
  const notifications = await Notification.find({
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .sort({ createdAt: -1 })
    .select('title body type bonusCode expiresAt createdAt');

  return sendSuccess(res, { notifications });
});

// ─────────────────────────────────────────
// ADMIN CRUD
// ─────────────────────────────────────────

// @desc    Create notification / announcement
// @route   POST /api/admin/notifications
// @access  Admin
const createNotification = asyncHandler(async (req, res) => {
  const { title, body, type, bonusCode, durationDays } = req.body;

  if (!title || !body) {
    return sendError(res, 'title and body are required');
  }

  // durationDays: 0 or null → never expires
  let expiresAt = null;
  if (durationDays && durationDays > 0) {
    expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  }

  const notification = await Notification.create({
    title,
    body,
    type: type || 'info',
    bonusCode: bonusCode?.toUpperCase() || null,
    expiresAt,
    createdBy: req.user._id,
  });

  return sendSuccess(res, { notification }, 'Notification created', 201);
});

// @desc    Get all notifications (admin view, all statuses)
// @route   GET /api/admin/notifications
// @access  Admin
const getAllNotifications = asyncHandler(async (req, res) => {
  const { status } = req.query; // ?status=active|inactive
  const filter = {};
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .populate('createdBy', 'phone');

  return sendSuccess(res, { notifications, total: notifications.length });
});

// @desc    Update notification
// @route   PUT /api/admin/notifications/:id
// @access  Admin
const updateNotification = asyncHandler(async (req, res) => {
  const allowed = ['title', 'body', 'type', 'bonusCode', 'isActive', 'expiresAt'];
  const updates = {};
  allowed.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  // Allow admin to extend duration via durationDays
  if (req.body.durationDays != null && req.body.durationDays > 0) {
    updates.expiresAt = new Date(Date.now() + req.body.durationDays * 24 * 60 * 60 * 1000);
  }
  if (updates.bonusCode) updates.bonusCode = updates.bonusCode.toUpperCase();

  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!notification) return sendError(res, 'Notification not found', 404);
  return sendSuccess(res, { notification }, 'Notification updated');
});

// @desc    Delete notification (hard delete — no history needed)
// @route   DELETE /api/admin/notifications/:id
// @access  Admin
const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndDelete(req.params.id);
  if (!notification) return sendError(res, 'Notification not found', 404);
  return sendSuccess(res, {}, 'Notification deleted');
});

module.exports = {
  getPublicNotifications,
  createNotification,
  getAllNotifications,
  updateNotification,
  deleteNotification,
};