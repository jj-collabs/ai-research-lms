const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// --- High-level stats: AI usage per student, vs quiz attempts completed without AI ---
router.get('/stats/ai-usage', (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT
      u.id AS userId,
      u.name,
      u.email,
      COUNT(DISTINCT CASE WHEN a.role = 'user' THEN a.id END) AS aiMessagesSent,
      COUNT(DISTINCT CASE WHEN a.context_type = 'quiz' THEN a.context_id END) AS quizAttemptsWithAiUse,
      MIN(a.created_at) AS firstAiUse,
      MAX(a.created_at) AS lastAiUse
    FROM users u
    LEFT JOIN ai_interactions a ON a.user_id = u.id
    WHERE u.role = 'student'
    GROUP BY u.id
    ORDER BY aiMessagesSent DESC
  `
    )
    .all();

  const quizTotals = db
    .prepare(
      `SELECT user_id AS userId, COUNT(*) AS totalAttempts
       FROM quiz_attempts WHERE status = 'submitted' GROUP BY user_id`
    )
    .all();

  const quizMap = Object.fromEntries(quizTotals.map((r) => [r.userId, r.totalAttempts]));

  const combined = rows.map((r) => ({
    ...r,
    totalQuizAttempts: quizMap[r.userId] || 0,
    quizAttemptsWithoutAi: Math.max((quizMap[r.userId] || 0) - r.quizAttemptsWithAiUse, 0),
  }));

  res.json({ students: combined });
});

// --- Raw AI interaction log, filterable, for qualitative review ---
router.get('/logs/ai-interactions', (req, res) => {
  const { userId, contextType, limit } = req.query;
  let sql = `
    SELECT ai.*, u.name AS userName, u.email AS userEmail
    FROM ai_interactions ai JOIN users u ON u.id = ai.user_id
    WHERE 1=1
  `;
  const params = [];
  if (userId) {
    sql += ' AND ai.user_id = ?';
    params.push(userId);
  }
  if (contextType) {
    sql += ' AND ai.context_type = ?';
    params.push(contextType);
  }
  sql += ' ORDER BY ai.id DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 200, 2000));
  res.json({ interactions: db.prepare(sql).all(...params) });
});

// --- Raw proctoring/focus-loss log ---
router.get('/logs/activity', (req, res) => {
  const { userId, eventType, limit } = req.query;
  let sql = `
    SELECT al.*, u.name AS userName, u.email AS userEmail
    FROM activity_logs al JOIN users u ON u.id = al.user_id
    WHERE 1=1
  `;
  const params = [];
  if (userId) {
    sql += ' AND al.user_id = ?';
    params.push(userId);
  }
  if (eventType) {
    sql += ' AND al.event_type = ?';
    params.push(eventType);
  }
  sql += ' ORDER BY al.id DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 200, 2000));
  res.json({ events: db.prepare(sql).all(...params) });
});

router.get('/students', (req, res) => {
  const students = db
    .prepare(`SELECT id, name, email, student_number, created_at FROM users WHERE role = 'student' ORDER BY name`)
    .all();
  res.json({ students });
});

function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

// --- CSV export for analysis in SPSS/R/Excel etc. ---
router.get('/export/:table.csv', (req, res) => {
  const allowed = {
    'ai-interactions': `SELECT ai.*, u.name AS userName, u.email AS userEmail
      FROM ai_interactions ai JOIN users u ON u.id = ai.user_id ORDER BY ai.id`,
    'activity-log': `SELECT al.*, u.name AS userName, u.email AS userEmail
      FROM activity_logs al JOIN users u ON u.id = al.user_id ORDER BY al.id`,
    'quiz-attempts': `SELECT qa.*, u.name AS userName, u.email AS userEmail, q.title AS quizTitle
      FROM quiz_attempts qa JOIN users u ON u.id = qa.user_id JOIN quizzes q ON q.id = qa.quiz_id
      ORDER BY qa.id`,
  };
  const key = req.params.table;
  if (!allowed[key]) return res.status(404).json({ error: 'Unknown export.' });
  const rows = db.prepare(allowed[key]).all();
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${key}.csv"`);
  res.send(csv);
});

module.exports = router;
