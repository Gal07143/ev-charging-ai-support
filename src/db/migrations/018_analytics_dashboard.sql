-- Migration: Analytics Dashboard System
-- Created: 2026-01-19
-- Description: Dashboard metrics, aggregations, and export functionality

-- Dashboard metrics aggregation table (daily rollup)
CREATE TABLE IF NOT EXISTS dashboard_daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  
  -- Conversation metrics
  total_conversations INTEGER DEFAULT 0,
  resolved_conversations INTEGER DEFAULT 0,
  unresolved_conversations INTEGER DEFAULT 0,
  escalated_conversations INTEGER DEFAULT 0,
  resolution_rate DECIMAL(5,2),
  
  -- Efficiency metrics
  total_messages INTEGER DEFAULT 0,
  avg_messages_per_conversation DECIMAL(5,2),
  avg_conversation_duration_minutes DECIMAL(8,2),
  median_response_time_seconds INTEGER,
  
  -- Quality metrics
  avg_quality_score DECIMAL(5,2),
  conversations_grade_a INTEGER DEFAULT 0,
  conversations_grade_b INTEGER DEFAULT 0,
  conversations_grade_c INTEGER DEFAULT 0,
  conversations_grade_d INTEGER DEFAULT 0,
  conversations_grade_f INTEGER DEFAULT 0,
  
  -- User satisfaction
  avg_sentiment_score DECIMAL(3,2),
  positive_conversations INTEGER DEFAULT 0,
  neutral_conversations INTEGER DEFAULT 0,
  negative_conversations INTEGER DEFAULT 0,
  
  -- Tool usage
  total_tool_calls INTEGER DEFAULT 0,
  avg_tools_per_conversation DECIMAL(5,2),
  most_used_tool VARCHAR(100),
  tool_success_rate DECIMAL(5,2),
  
  -- Escalation metrics
  escalation_rate DECIMAL(5,2),
  avg_escalation_time_minutes DECIMAL(8,2),
  safety_escalations INTEGER DEFAULT 0,
  sentiment_escalations INTEGER DEFAULT 0,
  timeout_escalations INTEGER DEFAULT 0,
  
  -- Predictive metrics
  predictions_made INTEGER DEFAULT 0,
  predictions_accurate INTEGER DEFAULT 0,
  prediction_accuracy DECIMAL(5,2),
  anomalies_detected INTEGER DEFAULT 0,
  fraud_attempts_blocked INTEGER DEFAULT 0,
  
  -- Media metrics
  images_uploaded INTEGER DEFAULT 0,
  audio_uploaded INTEGER DEFAULT 0,
  video_uploaded INTEGER DEFAULT 0,
  ocr_processed INTEGER DEFAULT 0,
  transcriptions_processed INTEGER DEFAULT 0,
  
  -- Station metrics
  unique_stations_accessed INTEGER DEFAULT 0,
  station_resets_performed INTEGER DEFAULT 0,
  connector_unlocks_performed INTEGER DEFAULT 0,
  avg_station_response_time_ms INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(date),
  INDEX idx_dashboard_date (date)
);

-- Hourly metrics for real-time dashboard
CREATE TABLE IF NOT EXISTS dashboard_hourly_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  hour INTEGER NOT NULL, -- 0-23
  
  -- Key real-time metrics
  conversations_started INTEGER DEFAULT 0,
  conversations_resolved INTEGER DEFAULT 0,
  conversations_escalated INTEGER DEFAULT 0,
  avg_quality_score DECIMAL(5,2),
  avg_messages DECIMAL(5,2),
  tool_calls INTEGER DEFAULT 0,
  
  -- Performance
  avg_response_time_ms INTEGER,
  cache_hit_rate DECIMAL(5,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(date, hour),
  INDEX idx_hourly_date_hour (date, hour)
);

-- Geographic analytics (station-level aggregation)
CREATE TABLE IF NOT EXISTS geographic_analytics (
  id SERIAL PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  
  -- Location data
  region VARCHAR(100),
  city VARCHAR(100),
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  
  -- Station usage
  total_sessions INTEGER DEFAULT 0,
  total_conversations INTEGER DEFAULT 0,
  issues_reported INTEGER DEFAULT 0,
  
  -- Issue breakdown
  charging_failures INTEGER DEFAULT 0,
  payment_issues INTEGER DEFAULT 0,
  connector_problems INTEGER DEFAULT 0,
  slow_charging_reports INTEGER DEFAULT 0,
  
  -- Resolution metrics
  issues_resolved INTEGER DEFAULT 0,
  issues_escalated INTEGER DEFAULT 0,
  avg_resolution_time_minutes DECIMAL(8,2),
  
  -- Station health
  uptime_percentage DECIMAL(5,2),
  error_count INTEGER DEFAULT 0,
  reset_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(station_id, date),
  INDEX idx_geo_station (station_id),
  INDEX idx_geo_date (date),
  INDEX idx_geo_region (region)
);

-- Tool effectiveness tracking
CREATE TABLE IF NOT EXISTS tool_effectiveness_metrics (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  
  -- Usage metrics
  total_calls INTEGER DEFAULT 0,
  successful_calls INTEGER DEFAULT 0,
  failed_calls INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2),
  
  -- Performance metrics
  avg_execution_time_ms INTEGER,
  min_execution_time_ms INTEGER,
  max_execution_time_ms INTEGER,
  
  -- Impact metrics
  conversations_with_tool INTEGER DEFAULT 0,
  resolved_with_tool INTEGER DEFAULT 0,
  tool_resolution_contribution DECIMAL(5,2),
  
  -- User feedback
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tool_name, date),
  INDEX idx_tool_name (tool_name),
  INDEX idx_tool_date (date)
);

-- Export logs (track dashboard exports)
CREATE TABLE IF NOT EXISTS dashboard_exports (
  id SERIAL PRIMARY KEY,
  export_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- Export details
  export_type VARCHAR(50), -- csv, pdf, excel
  report_type VARCHAR(100), -- daily_metrics, geographic, tool_effectiveness, etc.
  
  -- Filters applied
  date_from DATE,
  date_to DATE,
  filters JSONB, -- Additional filters (region, station, etc.)
  
  -- User details
  requested_by VARCHAR(100),
  requested_at TIMESTAMP DEFAULT NOW(),
  
  -- Export status
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  file_url TEXT,
  file_size_bytes BIGINT,
  row_count INTEGER,
  
  -- Timestamps
  completed_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  INDEX idx_export_status (status),
  INDEX idx_export_requested (requested_at)
);

-- Real-time dashboard subscriptions (for WebSocket updates)
CREATE TABLE IF NOT EXISTS dashboard_subscriptions (
  id SERIAL PRIMARY KEY,
  subscription_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- User details
  user_id VARCHAR(100) NOT NULL,
  connection_id VARCHAR(100),
  
  -- Subscription settings
  metrics_subscribed JSONB, -- Array of metric names
  update_interval_seconds INTEGER DEFAULT 30,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_update_sent TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  INDEX idx_sub_user (user_id),
  INDEX idx_sub_active (is_active)
);

-- Create views for common dashboard queries

-- Overall performance summary view
CREATE OR REPLACE VIEW dashboard_performance_summary AS
SELECT 
  date,
  resolution_rate,
  avg_messages_per_conversation,
  avg_quality_score,
  escalation_rate,
  avg_sentiment_score,
  tool_success_rate,
  prediction_accuracy
FROM dashboard_daily_metrics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- Real-time metrics view (last 24 hours)
CREATE OR REPLACE VIEW dashboard_realtime_metrics AS
SELECT 
  date,
  hour,
  conversations_started,
  conversations_resolved,
  conversations_escalated,
  avg_quality_score,
  avg_messages,
  tool_calls,
  avg_response_time_ms
FROM dashboard_hourly_metrics
WHERE date >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY date DESC, hour DESC;

-- Geographic hotspots view (stations with most issues)
CREATE OR REPLACE VIEW geographic_hotspots AS
SELECT 
  station_id,
  region,
  city,
  latitude,
  longitude,
  SUM(issues_reported) as total_issues,
  AVG(issues_resolved::DECIMAL / NULLIF(issues_reported, 0)) as resolution_rate,
  AVG(uptime_percentage) as avg_uptime
FROM geographic_analytics
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY station_id, region, city, latitude, longitude
HAVING SUM(issues_reported) > 0
ORDER BY total_issues DESC
LIMIT 50;

-- Top performing tools view
CREATE OR REPLACE VIEW top_performing_tools AS
SELECT 
  tool_name,
  SUM(total_calls) as total_calls,
  AVG(success_rate) as avg_success_rate,
  AVG(avg_execution_time_ms) as avg_exec_time_ms,
  SUM(resolved_with_tool) as total_resolutions
FROM tool_effectiveness_metrics
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tool_name
ORDER BY avg_success_rate DESC, total_calls DESC;

-- Trend analysis view (week-over-week comparison)
CREATE OR REPLACE VIEW dashboard_trend_analysis AS
WITH current_week AS (
  SELECT 
    AVG(resolution_rate) as resolution_rate,
    AVG(avg_messages_per_conversation) as avg_messages,
    AVG(avg_quality_score) as avg_quality,
    AVG(escalation_rate) as escalation_rate
  FROM dashboard_daily_metrics
  WHERE date >= CURRENT_DATE - INTERVAL '7 days'
),
previous_week AS (
  SELECT 
    AVG(resolution_rate) as resolution_rate,
    AVG(avg_messages_per_conversation) as avg_messages,
    AVG(avg_quality_score) as avg_quality,
    AVG(escalation_rate) as escalation_rate
  FROM dashboard_daily_metrics
  WHERE date >= CURRENT_DATE - INTERVAL '14 days'
    AND date < CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
  cw.resolution_rate as current_resolution_rate,
  pw.resolution_rate as previous_resolution_rate,
  cw.resolution_rate - pw.resolution_rate as resolution_rate_change,
  cw.avg_messages as current_avg_messages,
  pw.avg_messages as previous_avg_messages,
  cw.avg_messages - pw.avg_messages as avg_messages_change,
  cw.avg_quality as current_quality,
  pw.avg_quality as previous_quality,
  cw.avg_quality - pw.avg_quality as quality_change,
  cw.escalation_rate as current_escalation_rate,
  pw.escalation_rate as previous_escalation_rate,
  cw.escalation_rate - pw.escalation_rate as escalation_rate_change
FROM current_week cw, previous_week pw;

-- Comments
COMMENT ON TABLE dashboard_daily_metrics IS 'Daily rollup of all dashboard metrics';
COMMENT ON TABLE dashboard_hourly_metrics IS 'Hourly metrics for real-time dashboard updates';
COMMENT ON TABLE geographic_analytics IS 'Station-level geographic aggregation of issues and performance';
COMMENT ON TABLE tool_effectiveness_metrics IS 'Track effectiveness and performance of each tool';
COMMENT ON TABLE dashboard_exports IS 'Log of CSV/PDF exports requested from dashboard';
COMMENT ON TABLE dashboard_subscriptions IS 'WebSocket subscriptions for real-time dashboard updates';
