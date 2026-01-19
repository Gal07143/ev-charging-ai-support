-- Migration: Voice Interface Integration
-- Created: 2026-01-19

-- Voice commands
CREATE TABLE IF NOT EXISTS voice_commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  platform TEXT NOT NULL,                  -- alexa, google_assistant
  command_text TEXT NOT NULL,
  intent TEXT,
  response_text TEXT,
  success BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_commands_user ON voice_commands(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_commands_platform ON voice_commands(platform, created_at DESC);
