-- Migration: Fraud Detection & Security
-- Created: 2026-01-19

-- Fraud detection events
CREATE TABLE IF NOT EXISTS fraud_detection_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  event_type TEXT NOT NULL,
  risk_score REAL NOT NULL,                -- 0-1
  risk_factors TEXT,                       -- JSON
  status TEXT DEFAULT 'pending',
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  ip_address TEXT,
  user_agent TEXT,
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fraud_events_user ON fraud_detection_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_events_risk ON fraud_detection_events(risk_score DESC, status);
CREATE INDEX IF NOT EXISTS idx_security_audit_user ON security_audit_log(user_id, created_at DESC);
