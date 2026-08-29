const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'lms_session';
const SECRET = process.env.JWT_SECRET;

if (!SECRET || SECRET === 'change_this_to_a_long_random_string') {
  console.warn(
    '[WARN] JWT_SECRET is not set to a unique value. Set a strong random JWT_SECRET in .env before deploying.'
  );
}

function issueSession(res, user) {
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    SECRET,
    { expiresIn: '8h' }
  );
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
  });
}

function clearSession(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expired, please log in again.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    next();
  };
}

module.exports = { issueSession, clearSession, requireAuth, requireRole, COOKIE_NAME };
