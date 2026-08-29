const db = require('../db/db');

const insertActivity = db.prepare(`
  INSERT INTO activity_logs (user_id, context_type, context_id, event_type, meta)
  VALUES (?, ?, ?, ?, ?)
`);

function logActivity({ userId, contextType, contextId, eventType, meta }) {
  insertActivity.run(
    userId,
    contextType,
    contextId ?? null,
    eventType,
    meta ? JSON.stringify(meta) : null
  );
}

const insertAiInteraction = db.prepare(`
  INSERT INTO ai_interactions (user_id, context_type, context_id, role, message, char_count, provider, model)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

function logAiInteraction({ userId, contextType, contextId, role, message, provider, model }) {
  insertAiInteraction.run(
    userId,
    contextType,
    contextId ?? null,
    role,
    message,
    (message || '').length,
    provider || null,
    model || null
  );
}

module.exports = { logActivity, logAiInteraction };
