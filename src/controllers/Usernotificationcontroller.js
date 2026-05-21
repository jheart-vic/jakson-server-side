const UserNotification = require('../models/UserNotification');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendSuccess, sendError, paginate } = require('../utils/helpers');

// Allowed type values (mirrors the model enum)
const VALID_TYPES = [
  'deposit', 'withdrawal', 'bonus_code', 'daily_income',
  'referral_bonus', 'invitee', 'checkin', 'admin', 'system',
];

// ─────────────────────────────────────────
// GET /api/notifications
const getUserNotifications = asyncHandler(async (req, res) => {
  const { filter, type, page, limit } = req.query;
  const { skip, limit: lim, page: pg } = paginate(page, limit);

  const query = { user: req.user._id };

  if (filter === 'unread') query.isRead = false;
  if (filter === 'read')   query.isRead = true;
  if (type && VALID_TYPES.includes(type)) query.type = type;

  const [notifications, total, unreadCount] = await Promise.all([
    UserNotification.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim),
    UserNotification.countDocuments(query),
    UserNotification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  return sendSuccess(res, {
    notifications,
    unreadCount,
    pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) },
  });
});

// ─────────────────────────────────────────
// GET /api/notifications/unread-count
// ─────────────────────────────────────────
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await UserNotification.countDocuments({
    user: req.user._id,
    isRead: false,
  });
  return sendSuccess(res, { count });
});

// ─────────────────────────────────────────
// PUT /api/notifications/:id/read
// ─────────────────────────────────────────
const markAsRead = asyncHandler(async (req, res) => {
  const notif = await UserNotification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead: true },
    { new: true }
  );
  if (!notif) return sendError(res, 'Notification not found', 404);
  return sendSuccess(res, { notification: notif }, 'Marked as read');
});

// ─────────────────────────────────────────
// PUT /api/notifications/read-all
// ─────────────────────────────────────────
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await UserNotification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true }
  );
  return sendSuccess(res, { updated: result.modifiedCount }, 'All notifications marked as read');
});

// ─────────────────────────────────────────
// DELETE /api/notifications/:id
// ─────────────────────────────────────────
const deleteNotification = asyncHandler(async (req, res) => {
  const notif = await UserNotification.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });
  if (!notif) return sendError(res, 'Notification not found', 404);
  return sendSuccess(res, {}, 'Notification deleted');
});

// ─────────────────────────────────────────
// DELETE /api/notifications/all
// ─────────────────────────────────────────
const deleteAllNotifications = asyncHandler(async (req, res) => {
  const result = await UserNotification.deleteMany({ user: req.user._id });
  return sendSuccess(res, { deleted: result.deletedCount }, 'All notifications deleted');
});

module.exports = {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};