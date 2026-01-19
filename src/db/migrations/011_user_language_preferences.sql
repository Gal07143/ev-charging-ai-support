-- User Language Preferences
-- Auto-detects and stores user preferred language for consistent multi-language experience

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  language_code TEXT NOT NULL CHECK (language_code IN ('he', 'en', 'ru', 'ar')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_language ON user_preferences(language_code);

-- Add comments
COMMENT ON TABLE user_preferences IS 'Stores user language preferences for multi-language support';
COMMENT ON COLUMN user_preferences.user_id IS 'Discord user ID';
COMMENT ON COLUMN user_preferences.language_code IS 'Preferred language: he (Hebrew), en (English), ru (Russian), ar (Arabic)';
