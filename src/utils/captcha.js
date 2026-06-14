/**
 * Captcha Utility
 * ───────────────
 * Generates a 4-digit image captcha (SVG).
 * Stores answers in-memory with a 5-minute TTL — no Redis needed.
 *
 * Flow:
 *   1. Client calls  GET /api/auth/captcha
 *      → receives { captchaId, image (SVG base64) }
 *
 *   2. Client displays the image, user types the 4 digits.
 *
 *   3. Client sends { captchaId, captchaAnswer } with login/register.
 *
 *   4. Server calls  validateCaptcha(captchaId, captchaAnswer)
 *      → returns true/false; deletes the entry on first use (one-shot).
 */

const svgCaptcha = require('svg-captcha');
const { v4: uuidv4 } = require('uuid');

// ── In-memory store: { captchaId → { answer, expiresAt } } ──────────────────
const store = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of store.entries()) {
    if (now > data.expiresAt) store.delete(id);
  }
}, 10 * 60 * 1000);

// ── Generate ─────────────────────────────────────────────────────────────────
const generateCaptcha = () => {
  const captcha = svgCaptcha.create({
    size: 4,           // exactly 4 characters
    ignoreChars: 'oOiIlL10',  // avoid ambiguous chars
    noise: 3,          // noise lines
    color: true,
    background: '#f0f8ff',
    fontSize: 52,
    width: 120,
    height: 48,
    charPreset: '0123456789', // digits only → matches the UI
  });

  const captchaId = uuidv4();
  store.set(captchaId, {
    answer: captcha.text.toLowerCase(),
    expiresAt: Date.now() + TTL_MS,
  });

  // Return SVG as a data URI so the frontend can render it in an <img> tag
  const imageDataUri = `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`;
console.log('Captcha Answer:', captcha.text.toLowerCase());
  return { captchaId, image: imageDataUri };
};

// ── Validate ─────────────────────────────────────────────────────────────────
/**
 * @param {string} captchaId   - the id returned by generateCaptcha()
 * @param {string} userAnswer  - what the user typed
 * @returns {{ valid: boolean, reason?: string }}
 */
const validateCaptcha = (captchaId, userAnswer) => {
  if (!captchaId || !userAnswer) {
    return { valid: false, reason: 'Captcha ID and answer are required' };
  }

  const entry = store.get(captchaId);

  if (!entry) {
    return { valid: false, reason: 'Captcha expired or not found. Please refresh.' };
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(captchaId);
    return { valid: false, reason: 'Captcha has expired. Please refresh.' };
  }

  const isCorrect = entry.answer === userAnswer.toLowerCase().trim();

  // One-shot: delete after first attempt (correct or not) to prevent brute force
  store.delete(captchaId);

  if (!isCorrect) {
    return { valid: false, reason: 'Incorrect captcha. Please try again.' };
  }

  return { valid: true };
};

module.exports = { generateCaptcha, validateCaptcha };