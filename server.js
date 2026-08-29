require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

require('./db/db'); // ensures schema is created on boot

const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quizzes');
const aiRoutes = require('./routes/ai');
const activityRoutes = require('./routes/activity');
const adminRoutes = require('./routes/admin');

const app = express();
app.set('trust proxy', 1);

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 });
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/register-admin', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Fallback: any non-API GET returns index.html (simple client-side routing).
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Research LMS listening on http://localhost:${PORT}`);
});
