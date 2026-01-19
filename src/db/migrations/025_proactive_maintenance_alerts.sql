-- Migration: Proactive Maintenance Alerts System
-- Created: 2026-01-19
-- Scope: Charger health scoring, predictive failure alerts, maintenance scheduling
--
-- Features:
-- - Charger health scoring (0-100)
-- - Predictive failure detection (48-hour window)
-- - Automatic maintenance scheduling
-- - Mobile push notifications
-- - Maintenance history tracking

-- ============================================================================
-- Charger Health Monitoring
-- ============================================================================

-- Charger health scores
CREATE TABLE IF NOT EXISTS charger_health_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  connector_id TEXT,
  
  -- Health score (0-100)
  health_score REAL NOT NULL,              -- Overall health
  previous_score REAL,                     -- Previous score for trend
  score_trend TEXT,                        -- improving, stable, declining, critical
  
  -- Component scores
  hardware_score REAL,                     -- Hardware health
  software_score REAL,                     -- Software health
  connectivity_score REAL,                 -- Network connectivity
  usage_score REAL,                        -- Usage patterns (overuse, underuse)
  
  -- Risk factors
  failure_risk TEXT DEFAULT 'low',         -- low, medium, high, critical
  risk_factors TEXT,                       -- JSON: array of risk factors
  predicted_failure_date DATE,             -- Predicted failure date
  confidence REAL,                         -- Prediction confidence (0-1)
  
  -- Recommendations
  recommended_actions TEXT,                -- JSON: array of recommended actions
  maintenance_urgency TEXT DEFAULT 'low',  -- low, medium, high, critical
  
  -- Timestamps
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  next_check_at DATETIME,
  
  UNIQUE (station_id, connector_id, calculated_at)
);

-- Maintenance alerts
CREATE TABLE IF NOT EXISTS maintenance_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_id TEXT NOT NULL UNIQUE,           -- UUID
  
  -- Target
  station_id TEXT NOT NULL,
  connector_id TEXT,
  
  -- Alert details
  alert_type TEXT NOT NULL,                -- predictive_failure, health_declining, overdue_maintenance
  severity TEXT NOT NULL,                  -- low, medium, high, critical
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Prediction
  predicted_failure_window_hours INTEGER,  -- Hours until predicted failure
  failure_probability REAL,                -- 0-1
  
  -- Recommended action
  recommended_action TEXT NOT NULL,        -- inspect, repair, replace, schedule_maintenance
  action_deadline DATETIME,                -- When action should be taken by
  estimated_downtime_hours REAL,
  estimated_cost REAL,
  
  -- Status
  status TEXT DEFAULT 'pending',           -- pending, acknowledged, scheduled, completed, dismissed
  acknowledged_by TEXT,
  acknowledged_at DATETIME,
  
  -- Notification
  notification_sent BOOLEAN DEFAULT 0,
  notification_channels TEXT,              -- JSON: [email, sms, push, dashboard]
  notification_sent_at DATETIME,
  
  -- Resolution
  resolved_by TEXT,
  resolved_at DATETIME,
  resolution_notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled maintenance
CREATE TABLE IF NOT EXISTS scheduled_maintenance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  maintenance_id TEXT NOT NULL UNIQUE,     -- UUID
  
  -- Target
  station_id TEXT NOT NULL,
  connector_id TEXT,
  
  -- Schedule
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  estimated_duration_hours REAL,
  
  -- Maintenance details
  maintenance_type TEXT NOT NULL,          -- preventive, corrective, inspection
  description TEXT NOT NULL,
  tasks TEXT,                              -- JSON: array of tasks
  
  -- Assignment
  assigned_to TEXT,                        -- Technician ID
  assigned_team TEXT,
  
  -- Status
  status TEXT DEFAULT 'scheduled',         -- scheduled, in_progress, completed, cancelled
  started_at DATETIME,
  completed_at DATETIME,
  
  -- Results
  completion_notes TEXT,
  issues_found TEXT,                       -- JSON: array of issues
  parts_replaced TEXT,                     -- JSON: array of parts
  next_maintenance_date DATE,
  
  -- Cost tracking
  labor_cost REAL,
  parts_cost REAL,
  total_cost REAL,
  
  -- Related alert
  alert_id TEXT,                           -- FK to maintenance_alerts
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (alert_id) REFERENCES maintenance_alerts(alert_id) ON DELETE SET NULL
);

-- Maintenance history
CREATE TABLE IF NOT EXISTS maintenance_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  connector_id TEXT,
  
  -- Event details
  event_type TEXT NOT NULL,                -- scheduled_maintenance, emergency_repair, inspection, part_replacement
  description TEXT NOT NULL,
  
  -- Timing
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  duration_hours REAL,
  
  -- Work performed
  tasks_completed TEXT,                    -- JSON: array
  parts_replaced TEXT,                     -- JSON: array
  issues_resolved TEXT,                    -- JSON: array
  
  -- Personnel
  performed_by TEXT,
  team TEXT,
  
  -- Outcome
  success BOOLEAN DEFAULT 1,
  post_maintenance_health_score REAL,
  notes TEXT,
  
  -- Cost
  cost REAL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Predictive failure patterns
CREATE TABLE IF NOT EXISTS failure_prediction_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Pattern identification
  pattern_name TEXT NOT NULL UNIQUE,
  pattern_type TEXT NOT NULL,              -- usage_spike, connectivity_degradation, error_frequency
  
  -- Conditions
  conditions TEXT NOT NULL,                -- JSON: pattern conditions
  
  -- Prediction
  failure_probability REAL NOT NULL,       -- Historical probability
  average_time_to_failure_hours INTEGER,   -- Average time from detection to failure
  
  -- Recommendation
  recommended_action TEXT NOT NULL,
  urgency_level TEXT NOT NULL,
  
  -- Statistics
  times_detected INTEGER DEFAULT 0,
  times_confirmed INTEGER DEFAULT 0,       -- Actual failures
  false_positives INTEGER DEFAULT 0,
  accuracy_rate REAL,
  
  -- Status
  is_active BOOLEAN DEFAULT 1,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notification queue
CREATE TABLE IF NOT EXISTS maintenance_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id TEXT NOT NULL UNIQUE,
  
  -- Target
  alert_id TEXT NOT NULL,                  -- FK to maintenance_alerts
  recipient_id TEXT NOT NULL,              -- User ID, team ID, or phone
  recipient_type TEXT NOT NULL,            -- user, team, phone, email
  
  -- Channel
  channel TEXT NOT NULL,                   -- email, sms, push, webhook
  
  -- Content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',          -- low, medium, high, critical
  
  -- Status
  status TEXT DEFAULT 'pending',           -- pending, sent, failed, delivered
  sent_at DATETIME,
  delivered_at DATETIME,
  error_message TEXT,
  
  -- Retry
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (alert_id) REFERENCES maintenance_alerts(alert_id) ON DELETE CASCADE
);

-- Maintenance analytics (daily)
CREATE TABLE IF NOT EXISTS maintenance_analytics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  
  -- Alerts
  total_alerts INTEGER DEFAULT 0,
  critical_alerts INTEGER DEFAULT 0,
  alerts_acknowledged INTEGER DEFAULT 0,
  alerts_resolved INTEGER DEFAULT 0,
  
  -- Predictions
  predictions_made INTEGER DEFAULT 0,
  predictions_accurate INTEGER DEFAULT 0,
  false_positives INTEGER DEFAULT 0,
  avg_prediction_accuracy REAL,
  
  -- Maintenance
  scheduled_maintenances INTEGER DEFAULT 0,
  completed_maintenances INTEGER DEFAULT 0,
  emergency_repairs INTEGER DEFAULT 0,
  avg_maintenance_duration_hours REAL,
  total_maintenance_cost REAL,
  
  -- Health scores
  avg_health_score REAL,
  stations_at_risk INTEGER DEFAULT 0,      -- Health score < 50
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (date)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_charger_health_scores_station 
  ON charger_health_scores(station_id, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_charger_health_scores_risk 
  ON charger_health_scores(failure_risk, health_score);

CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_station 
  ON maintenance_alerts(station_id, status, severity DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_status 
  ON maintenance_alerts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_maintenance_date 
  ON scheduled_maintenance(scheduled_date, status);

CREATE INDEX IF NOT EXISTS idx_scheduled_maintenance_station 
  ON scheduled_maintenance(station_id, status);

CREATE INDEX IF NOT EXISTS idx_maintenance_history_station 
  ON maintenance_history(station_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_notifications_status 
  ON maintenance_notifications(status, created_at DESC);

-- ============================================================================
-- Views for Easy Access
-- ============================================================================

-- Critical alerts requiring immediate attention
CREATE VIEW IF NOT EXISTS v_critical_alerts AS
SELECT 
  ma.*,
  chs.health_score,
  chs.score_trend,
  ROUND((JULIANDAY(ma.action_deadline) - JULIANDAY('now')) * 24, 1) as hours_until_deadline
FROM maintenance_alerts ma
LEFT JOIN (
  SELECT station_id, connector_id, health_score, score_trend,
    ROW_NUMBER() OVER (PARTITION BY station_id, connector_id ORDER BY calculated_at DESC) as rn
  FROM charger_health_scores
) chs ON ma.station_id = chs.station_id 
  AND (ma.connector_id = chs.connector_id OR (ma.connector_id IS NULL AND chs.connector_id IS NULL))
  AND chs.rn = 1
WHERE ma.status = 'pending'
  AND ma.severity IN ('high', 'critical')
ORDER BY ma.severity DESC, ma.created_at ASC;

-- Upcoming scheduled maintenance
CREATE VIEW IF NOT EXISTS v_upcoming_maintenance AS
SELECT 
  sm.*,
  (SELECT health_score FROM charger_health_scores 
   WHERE station_id = sm.station_id 
   ORDER BY calculated_at DESC LIMIT 1
  ) as current_health_score,
  ROUND((JULIANDAY(sm.scheduled_date || ' ' || COALESCE(sm.scheduled_time, '00:00:00')) - JULIANDAY('now')) * 24, 1) as hours_until_maintenance
FROM scheduled_maintenance sm
WHERE sm.status IN ('scheduled', 'in_progress')
  AND sm.scheduled_date >= date('now')
ORDER BY sm.scheduled_date ASC, sm.scheduled_time ASC;

-- Charger health dashboard
CREATE VIEW IF NOT EXISTS v_charger_health_dashboard AS
SELECT 
  chs.station_id,
  chs.connector_id,
  chs.health_score,
  chs.score_trend,
  chs.failure_risk,
  chs.maintenance_urgency,
  chs.predicted_failure_date,
  (SELECT COUNT(*) FROM maintenance_alerts 
   WHERE station_id = chs.station_id 
     AND status = 'pending'
  ) as pending_alerts,
  (SELECT MAX(scheduled_date) FROM scheduled_maintenance 
   WHERE station_id = chs.station_id 
     AND status != 'cancelled'
  ) as next_maintenance_date,
  chs.calculated_at as last_check
FROM (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY station_id, connector_id ORDER BY calculated_at DESC) as rn
  FROM charger_health_scores
) chs
WHERE chs.rn = 1
ORDER BY chs.health_score ASC, chs.failure_risk DESC;

-- ============================================================================
-- Seed Data: Failure Prediction Patterns
-- ============================================================================

INSERT OR IGNORE INTO failure_prediction_patterns (pattern_name, pattern_type, conditions, failure_probability, average_time_to_failure_hours, recommended_action, urgency_level) VALUES
  ('connectivity_degradation', 'connectivity_degradation', '{"metric": "connection_stability", "threshold": 0.7, "duration_hours": 24}', 0.65, 48, 'Check network equipment and connections', 'high'),
  ('error_frequency_spike', 'error_frequency', '{"metric": "error_rate", "threshold": 0.15, "window_hours": 6}', 0.75, 36, 'Inspect charger hardware and logs', 'high'),
  ('usage_overload', 'usage_spike', '{"metric": "session_count", "threshold_multiplier": 2.5, "window_hours": 24}', 0.55, 72, 'Schedule preventive maintenance', 'medium'),
  ('temperature_anomaly', 'usage_spike', '{"metric": "operating_temperature", "threshold": 60, "duration_minutes": 30}', 0.80, 24, 'Immediate inspection required', 'critical');

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

-- This schema enables:
-- 1. Health Scoring: Continuous monitoring of charger health (0-100)
-- 2. Predictive Alerts: 48-hour advance warning of potential failures
-- 3. Automated Scheduling: Smart maintenance scheduling based on predictions
-- 4. Multi-Channel Notifications: Email, SMS, push notifications
-- 5. Cost Tracking: Labor and parts cost tracking
-- 6. Pattern Recognition: Learn from historical failures
