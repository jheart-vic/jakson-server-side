/**
 * Reset Token Store
 * ─────────────────
 * Short-lived in-memory store for password reset tokens.
 * No DB or Redis needed.
 *
 * Flow:
 *   1. User answers security question correctly
 *   2. Server generates a resetToken and stores it here (15 min TTL)
 *   3. Client sends resetToken + newPassword to /reset-password
 *   4. Token is validated, deleted (one-shot), password updated
 */

const { v4: uuidv4 } = require('uuid');

const store = new Map(); // { resetToken → { userId, expiresAt } }
const TTL_MS = 15 * 60 * 1000; // 15 minutes

// Auto-cleanup every 20 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of store.entries()) {
    if (now > data.expiresAt) store.delete(token);
  }
}, 20 * 60 * 1000);

const createResetToken = (userId) => {
  const resetToken = uuidv4();
  store.set(resetToken, {
    userId: userId.toString(),
    expiresAt: Date.now() + TTL_MS,
  });
  return resetToken;
};

const validateResetToken = (resetToken) => {
  if (!resetToken) return { valid: false, reason: 'Reset token is required' };

  const entry = store.get(resetToken);
  if (!entry) return { valid: false, reason: 'Invalid or expired reset token. Please start over.' };

  if (Date.now() > entry.expiresAt) {
    store.delete(resetToken);
    return { valid: false, reason: 'Reset token has expired. Please start over.' };
  }

  return { valid: true, userId: entry.userId };
};

const consumeResetToken = (resetToken) => {
  store.delete(resetToken); // one-shot
};

module.exports = { createResetToken, validateResetToken, consumeResetToken };