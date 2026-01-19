-- Migration: Smart Routing & Recommendations
-- Created: 2026-01-19

-- Agent routing rules
CREATE TABLE IF NOT EXISTS routing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL UNIQUE,
  conditions TEXT NOT NULL,                -- JSON: routing conditions
  target_agent TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1
);

-- Recommendations
CREATE TABLE IF NOT EXISTS user_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,
  recommendation_data TEXT NOT NULL,
  score REAL,
  shown_at DATETIME,
  clicked BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recommendations_user ON user_recommendations(user_id, created_at DESC);
