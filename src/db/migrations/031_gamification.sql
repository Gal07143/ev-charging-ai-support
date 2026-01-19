-- Migration: Gamification & Rewards
-- Created: 2026-01-19

-- User points
CREATE TABLE IF NOT EXISTS user_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  badges TEXT,                             -- JSON: array of badges
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id)
);

-- Points transactions
CREATE TABLE IF NOT EXISTS points_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  achievement_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  points_reward INTEGER,
  icon TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON points_transactions(user_id, created_at DESC);

-- Seed achievements
INSERT OR IGNORE INTO achievements (achievement_id, name, description, points_reward) VALUES
  ('first_charge', 'First Charge', 'Complete your first charging session', 100),
  ('eco_warrior', 'Eco Warrior', 'Charge 50 times', 500),
  ('helper', 'Helper', 'Provide helpful feedback 10 times', 200);
