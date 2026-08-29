const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/logging');

const router = express.Router();

const ALLOWED_EVENTS = new Set([
  'visibility_hidden',
  'visibility_visible',
  'window_blur',
  'window_focus',
  'fullscreen_exit',
  'fullscreen_enter',
  'paste',
  'copy',
]);

const activityLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', requireAuth, activityLimiter, (req, res) => {
  const { contextType, contextId, eventType, meta } = req.body || {};
  if (!ALLOWED_EVENTS.has(eventType)) {
    return res.status(400).json({ error: 'Unknown event type.' });
  }
  const ctxType = ['quiz', 'general'].includes(contextType) ? contextType : 'general';
  logActivity({
    userId: req.user.id,
    contextType: ctxType,
    contextId: contextId ? Number(contextId) : null,
    eventType,
    meta,
  });
  res.json({ ok: true });
});

module.exports = router;
