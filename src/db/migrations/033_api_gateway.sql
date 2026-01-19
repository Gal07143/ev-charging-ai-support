-- Migration: API Gateway for Partners
-- Created: 2026-01-19

-- API partners
CREATE TABLE IF NOT EXISTS api_partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id TEXT NOT NULL UNIQUE,
  partner_name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  tier TEXT DEFAULT 'basic',
  rate_limit_per_hour INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT 1,
  allowed_endpoints TEXT,                  -- JSON: array of endpoints
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API requests log
CREATE TABLE IF NOT EXISTS api_requests_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API analytics
CREATE TABLE IF NOT EXISTS api_analytics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  partner_id TEXT NOT NULL,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  avg_response_time_ms REAL,
  UNIQUE (date, partner_id)
);

CREATE INDEX IF NOT EXISTS idx_api_partners_key ON api_partners(api_key);
CREATE INDEX IF NOT EXISTS idx_api_requests_partner ON api_requests_log(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_analytics_date ON api_analytics_daily(date DESC, partner_id);
