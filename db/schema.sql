-- AI Research LMS schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  student_number TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')) DEFAULT 'student',
  consent_given INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  time_limit_seconds INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('a', 'b', 'c', 'd')),
  points INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  score INTEGER,
  max_score INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted'))
);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id INTEGER NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
  selected_option TEXT CHECK (selected_option IN ('a', 'b', 'c', 'd')),
  is_correct INTEGER
);

-- Every single message exchanged with the integrated AI assistant.
-- This is the core data source for "how much students use the AI vs. don't".
CREATE TABLE IF NOT EXISTS ai_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  context_type TEXT NOT NULL CHECK (context_type IN ('quiz', 'general')),
  context_id INTEGER, -- quiz_attempts.id, nullable for 'general'
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  provider TEXT,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Proctoring / focus-loss signals. Cannot *prevent* a student from opening
-- another window, but records every time the tab loses focus, is hidden,
-- fullscreen is exited, or a paste event occurs, so it becomes usable
-- research data instead of an unenforceable restriction.
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  context_type TEXT NOT NULL CHECK (context_type IN ('quiz', 'general')),
  context_id INTEGER,
  event_type TEXT NOT NULL, -- visibility_hidden | visibility_visible | window_blur | window_focus | fullscreen_exit | fullscreen_enter | paste | copy | login | logout
  meta TEXT, -- JSON blob, e.g. {"awaySeconds": 12}
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_user ON ai_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_context ON ai_interactions(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_context ON activity_logs(context_type, context_id);
