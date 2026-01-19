-- Migration: Advanced Analytics & BI
-- Created: 2026-01-19

-- Business intelligence reports
CREATE TABLE IF NOT EXISTS bi_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL UNIQUE,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  query_sql TEXT NOT NULL,
  parameters TEXT,
  schedule TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Report executions
CREATE TABLE IF NOT EXISTS bi_report_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL,
  execution_time_ms INTEGER,
  row_count INTEGER,
  result_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- KPI tracking
CREATE TABLE IF NOT EXISTS kpi_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  target_value REAL,
  unit TEXT,
  UNIQUE (date, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_bi_reports_active ON bi_reports(is_active, report_type);
CREATE INDEX IF NOT EXISTS idx_bi_executions_report ON bi_report_executions(report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_metrics_date ON kpi_metrics(date DESC, metric_name);

-- Seed KPI definitions
INSERT OR IGNORE INTO bi_reports (report_id, report_name, report_type, query_sql) VALUES
  ('daily_summary', 'Daily Performance Summary', 'operational', 
   'SELECT COUNT(*) as conversations, AVG(satisfaction_score) as avg_satisfaction FROM conversation_summaries WHERE date(ended_at) = date(''now'')');
