const UserNotification = require('../models/UserNotification');

/**
 * Create a user notification silently — never throws, so it can be
 * fire-and-forgotten without breaking the main request flow.
 *
 * @param {string|ObjectId} userId
 * @param {{ type: string, title: string, body: string, metadata?: object }} payload
 */
const notify = async (userId, { type, title, body, metadata = {} }) => {
  try {
    await UserNotification.create({ user: userId, type, title, body, metadata });
  } catch (err) {
    // Log but never propagate — notifications must not fail transactions
    console.error(`[notify] Failed for user ${userId}:`, err.message);
  }
};

module.exports = { notify };