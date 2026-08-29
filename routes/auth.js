const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/db');
const { issueSession, clearSession, requireAuth } = require('../middleware/auth');
const { logActivity } = require('../utils/logging');

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// --- Student self-registration (requires explicit research consent) ---
router.post('/register', (req, res) => {
  const { name, email, password, studentNumber, consent } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (!consent) {
    return res.status(400).json({
      error:
        'You must consent to participation and data collection before registering, per the study\'s ethical requirements.',
    });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare(
      `INSERT INTO users (name, email, student_number, password_hash, role, consent_given)
       VALUES (?, ?, ?, ?, 'student', 1)`
    )
    .run(name, email, studentNumber || null, hash);

  const user = { id: info.lastInsertRowid, role: 'student', name, email };
  issueSession(res, user);
  logActivity({ userId: user.id, contextType: 'general', contextId: null, eventType: 'register' });
  res.json({ user: { id: user.id, name, email, role: 'student' } });
});

// --- Admin registration, gated by an invite code so students can't self-promote ---
router.post('/register-admin', (req, res) => {
  const { name, email, password, inviteCode } = req.body || {};
  const expected = process.env.ADMIN_INVITE_CODE;

  if (!expected || inviteCode !== expected) {
    return res.status(403).json({ error: 'Invalid admin invite code.' });
  }
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 12);
  const info = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, consent_given)
       VALUES (?, ?, ?, 'admin', 1)`
    )
    .run(name, email, hash);

  const user = { id: info.lastInsertRowid, role: 'admin', name, email };
  issueSession(res, user);
  res.json({ user: { id: user.id, name, email, role: 'admin' } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  issueSession(res, user);
  logActivity({ userId: user.id, contextType: 'general', contextId: null, eventType: 'login' });
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

router.post('/logout', requireAuth, (req, res) => {
  logActivity({ userId: req.user.id, contextType: 'general', contextId: null, eventType: 'logout' });
  clearSession(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
