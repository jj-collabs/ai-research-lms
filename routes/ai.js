const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { logAiInteraction } = require('../utils/logging');
const { callAssistant } = require('../utils/aiClient');

const router = express.Router();

// Keep the assistant available, but stop runaway/automated hammering of the
// upstream API and keep the usage logs meaningful.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent to the assistant. Please slow down.' },
});

const SYSTEM_PROMPT = `You are a study-integrated AI assistant embedded in a Learning Management System.
Students may use you however they like to help with quizzes (including quizzes with coding
questions) - this is intentional: the research study is measuring how and how much students
choose to use you, not restricting it. Be genuinely helpful, the same way you would in any
other context. Keep answers focused and reasonably concise unless the student asks for more detail.`;

function getHistory(userId, contextType, contextId, limit = 20) {
  const rows = db
    .prepare(
      `SELECT role, message FROM ai_interactions
       WHERE user_id = ? AND context_type = ? AND (context_id IS ? OR context_id = ?)
       ORDER BY id ASC LIMIT ?`
    )
    .all(userId, contextType, contextId ?? null, contextId ?? null, limit);
  return rows.map((r) => ({ role: r.role, content: r.message }));
}

router.post('/chat', requireAuth, chatLimiter, async (req, res) => {
  const { message, contextType, contextId } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  const ctxType = ['quiz', 'general'].includes(contextType) ? contextType : 'general';
  const ctxId = contextId ? Number(contextId) : null;

  // Log the student's message first, regardless of what happens next -
  // this is the core "AI usage" signal for the study.
  logAiInteraction({
    userId: req.user.id,
    contextType: ctxType,
    contextId: ctxId,
    role: 'user',
    message: message.trim(),
  });

  try {
    const history = getHistory(req.user.id, ctxType, ctxId);
    const { text, provider, model } = await callAssistant({
      systemPrompt: SYSTEM_PROMPT,
      history,
    });

    logAiInteraction({
      userId: req.user.id,
      contextType: ctxType,
      contextId: ctxId,
      role: 'assistant',
      message: text,
      provider,
      model,
    });

    res.json({ reply: text });
  } catch (err) {
    console.error('AI assistant error:', err.message);
    res.status(502).json({
      error:
        'The AI assistant is not reachable right now (check AI_PROVIDER / API key configuration in .env).',
    });
  }
});

// Lets the frontend redraw the chat panel with prior messages for a given task.
router.get('/history', requireAuth, (req, res) => {
  const contextType = ['quiz', 'general'].includes(req.query.contextType)
    ? req.query.contextType
    : 'general';
  const contextId = req.query.contextId ? Number(req.query.contextId) : null;
  const history = getHistory(req.user.id, contextType, contextId, 200);
  res.json({ history });
});

module.exports = router;
