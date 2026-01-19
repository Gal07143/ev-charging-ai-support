-- Migration: User Profile System
-- Created: 2026-01-19

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  preferred_language TEXT DEFAULT 'en',
  vehicle_model TEXT,
  home_station_id TEXT,
  subscription_tier TEXT DEFAULT 'free',
  preferences TEXT,                        -- JSON: notification prefs, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User activity
CREATE TABLE IF NOT EXISTS user_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  activity_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id, created_at DESC);
