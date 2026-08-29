const express = require('express');
const db = require('../db/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logActivity } = require('../utils/logging');

const router = express.Router();

// --- Admin: create a quiz with questions ---
router.post('/', requireAuth, requireRole('admin'), (req, res) => {
  const { title, description, timeLimitSeconds, questions } = req.body || {};
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Title and at least one question are required.' });
  }
  const insertQuiz = db.prepare(
    `INSERT INTO quizzes (title, description, time_limit_seconds, created_by) VALUES (?,?,?,?)`
  );
  const insertQ = db.prepare(`
    INSERT INTO quiz_questions
      (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, points, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);

  const tx = db.transaction(() => {
    const info = insertQuiz.run(title, description || null, timeLimitSeconds || null, req.user.id);
    const quizId = info.lastInsertRowid;
    questions.forEach((q, idx) => {
      insertQ.run(
        quizId,
        q.questionText,
        q.optionA,
        q.optionB,
        q.optionC,
        q.optionD,
        q.correctOption,
        q.points || 1,
        idx
      );
    });
    return quizId;
  });

  const quizId = tx();
  res.json({ id: quizId });
});

// --- List quizzes (both roles; students see it as the catalogue) ---
router.get('/', requireAuth, (req, res) => {
  const quizzes = db
    .prepare(
      `SELECT id, title, description, time_limit_seconds, created_at FROM quizzes ORDER BY created_at DESC`
    )
    .all();
  res.json({ quizzes });
});

// --- Get one quiz. Students get it without correct answers. ---
router.get('/:id', requireAuth, (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });
  const questions = db
    .prepare('SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC')
    .all(quiz.id);

  if (req.user.role === 'admin') {
    return res.json({ quiz, questions });
  }
  const safeQuestions = questions.map(({ correct_option, ...rest }) => rest);
  res.json({ quiz, questions: safeQuestions });
});

// --- Student: start an attempt ---
router.post('/:id/start', requireAuth, requireRole('student'), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

  const existing = db
    .prepare(
      `SELECT * FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? AND status = 'in_progress'`
    )
    .get(req.user.id, quiz.id);
  if (existing) return res.json({ attemptId: existing.id, resumed: true });

  const info = db
    .prepare(`INSERT INTO quiz_attempts (user_id, quiz_id, max_score) VALUES (?, ?, ?)`)
    .run(
      req.user.id,
      quiz.id,
      db.prepare('SELECT COALESCE(SUM(points),0) AS s FROM quiz_questions WHERE quiz_id = ?').get(quiz.id).s
    );
  res.json({ attemptId: info.lastInsertRowid, resumed: false });
});

// --- Student: submit an attempt ---
router.post('/attempts/:attemptId/submit', requireAuth, requireRole('student'), (req, res) => {
  const attempt = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(req.params.attemptId);
  if (!attempt || attempt.user_id !== req.user.id) {
    return res.status(404).json({ error: 'Attempt not found.' });
  }
  if (attempt.status === 'submitted') {
    return res.status(409).json({ error: 'This attempt was already submitted.' });
  }

  const { answers } = req.body || {}; // { questionId: 'a'|'b'|'c'|'d' }
  const questions = db
    .prepare('SELECT * FROM quiz_questions WHERE quiz_id = ?')
    .all(attempt.quiz_id);

  const insertAnswer = db.prepare(
    `INSERT INTO quiz_answers (attempt_id, question_id, selected_option, is_correct) VALUES (?,?,?,?)`
  );

  let score = 0;
  const tx = db.transaction(() => {
    for (const q of questions) {
      const selected = answers ? answers[q.id] : null;
      const correct = selected === q.correct_option;
      if (correct) score += q.points;
      insertAnswer.run(attempt.id, q.id, selected || null, correct ? 1 : 0);
    }
    db.prepare(
      `UPDATE quiz_attempts SET status = 'submitted', submitted_at = datetime('now'), score = ? WHERE id = ?`
    ).run(score, attempt.id);
  });
  tx();

  logActivity({
    userId: req.user.id,
    contextType: 'quiz',
    contextId: attempt.id,
    eventType: 'submit',
    meta: { score, maxScore: attempt.max_score },
  });

  res.json({ score, maxScore: attempt.max_score });
});

module.exports = router;
