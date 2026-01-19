-- Migration: Predictive Issue Detection System
-- Created: 2026-01-19
-- Description: Pattern analysis, anomaly detection, and fraud prevention

-- User behavior patterns table
CREATE TABLE IF NOT EXISTS user_behavior_patterns (
  id SERIAL PRIMARY KEY,
  discord_user_id VARCHAR(50) NOT NULL,
  
  -- Session statistics
  total_sessions INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  avg_messages_per_session DECIMAL(5,2),
  avg_session_duration_seconds INTEGER,
  
  -- Issue patterns
  common_issues JSONB, -- Array of issue types with counts
  resolution_rate DECIMAL(3,2),
  escalation_rate DECIMAL(3,2),
  
  -- Time patterns
  preferred_contact_hours JSONB, -- Array of hours (0-23)
  avg_response_time_seconds INTEGER,
  
  -- Behavioral indicators
  frustration_frequency DECIMAL(3,2), -- % of sessions with frustration
  repeat_issue_frequency DECIMAL(3,2), -- % of sessions with repeat issues
  
  -- Risk scores
  fraud_risk_score INTEGER DEFAULT 0, -- 0-100
  churn_risk_score INTEGER DEFAULT 0, -- 0-100
  
  -- Last activity
  last_session_date TIMESTAMP,
  last_issue_type VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(discord_user_id),
  INDEX idx_user_patterns_user (discord_user_id),
  INDEX idx_user_patterns_fraud (fraud_risk_score),
  INDEX idx_user_patterns_churn (churn_risk_score)
);

-- Session predictions table
CREATE TABLE IF NOT EXISTS session_predictions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(100) UNIQUE NOT NULL,
  discord_user_id VARCHAR(50) NOT NULL,
  
  -- Prediction types
  escalation_probability DECIMAL(3,2), -- 0.00 to 1.00
  failure_probability DECIMAL(3,2),
  fraud_probability DECIMAL(3,2),
  
  -- Predicted outcomes
  predicted_escalation BOOLEAN DEFAULT false,
  predicted_failure BOOLEAN DEFAULT false,
  predicted_fraud BOOLEAN DEFAULT false,
  
  -- Actual outcomes (filled in after session)
  actual_escalation BOOLEAN,
  actual_failure BOOLEAN,
  actual_fraud BOOLEAN,
  
  -- Prediction accuracy
  prediction_correct BOOLEAN,
  
  -- Contributing factors
  risk_factors JSONB, -- Array of identified risk factors
  confidence_score DECIMAL(3,2),
  
  -- Proactive actions taken
  proactive_actions JSONB, -- Actions triggered by prediction
  prevented_escalation BOOLEAN DEFAULT false,
  
  predicted_at TIMESTAMP DEFAULT NOW(),
  session_end TIMESTAMP,
  
  INDEX idx_predictions_session (session_id),
  INDEX idx_predictions_user (discord_user_id),
  INDEX idx_predictions_escalation (predicted_escalation),
  INDEX idx_predictions_fraud (predicted_fraud),
  INDEX idx_predictions_date (predicted_at)
);

-- Anomaly detection events table
CREATE TABLE IF NOT EXISTS anomaly_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(100) UNIQUE NOT NULL,
  discord_user_id VARCHAR(50) NOT NULL,
  
  -- Anomaly details
  anomaly_type VARCHAR(50) NOT NULL, -- unusual_frequency, account_takeover, payment_fraud, location_anomaly, etc.
  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  description TEXT,
  
  -- Detection details
  detected_value JSONB, -- What triggered the anomaly
  expected_value JSONB, -- What was expected
  deviation_score DECIMAL(5,2), -- How far from normal
  
  -- Context
  session_id VARCHAR(100),
  related_data JSONB,
  
  -- Response
  status VARCHAR(20) DEFAULT 'open', -- open, investigating, resolved, false_positive
  action_taken TEXT,
  reviewed_by VARCHAR(100),
  
  -- Timestamps
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  
  INDEX idx_anomaly_user (discord_user_id),
  INDEX idx_anomaly_type (anomaly_type),
  INDEX idx_anomaly_severity (severity),
  INDEX idx_anomaly_status (status),
  INDEX idx_anomaly_detected (detected_at)
);

-- Fraud detection table
CREATE TABLE IF NOT EXISTS fraud_detection_events (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(100) UNIQUE NOT NULL,
  discord_user_id VARCHAR(50) NOT NULL,
  
  -- Fraud type
  fraud_type VARCHAR(50) NOT NULL, -- session_hijacking, payment_fraud, account_sharing, free_charging_abuse, etc.
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  
  -- Evidence
  evidence JSONB, -- Array of evidence items
  indicators JSONB, -- What triggered detection
  
  -- User impact
  estimated_loss_amount DECIMAL(10,2),
  affected_sessions INTEGER DEFAULT 1,
  
  -- Investigation
  status VARCHAR(20) DEFAULT 'detected', -- detected, investigating, confirmed, dismissed
  investigated_by VARCHAR(100),
  investigation_notes TEXT,
  
  -- Actions
  user_blocked BOOLEAN DEFAULT false,
  account_suspended BOOLEAN DEFAULT false,
  refund_issued BOOLEAN DEFAULT false,
  
  -- Timestamps
  detected_at TIMESTAMP DEFAULT NOW(),
  investigated_at TIMESTAMP,
  resolved_at TIMESTAMP,
  
  INDEX idx_fraud_user (discord_user_id),
  INDEX idx_fraud_type (fraud_type),
  INDEX idx_fraud_status (status),
  INDEX idx_fraud_detected (detected_at)
);

-- Proactive notifications table
CREATE TABLE IF NOT EXISTS proactive_notifications (
  id SERIAL PRIMARY KEY,
  notification_id VARCHAR(100) UNIQUE NOT NULL,
  discord_user_id VARCHAR(50) NOT NULL,
  
  -- Notification details
  notification_type VARCHAR(50) NOT NULL, -- predicted_issue, maintenance_alert, usage_tip, fraud_warning
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  
  -- Trigger
  triggered_by VARCHAR(100), -- What prediction/detection triggered it
  trigger_data JSONB,
  
  -- Delivery
  sent_at TIMESTAMP,
  delivery_method VARCHAR(20), -- discord, email, sms
  delivered BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  
  -- User response
  user_action VARCHAR(50), -- dismissed, acted, ignored
  user_response_text TEXT,
  
  -- Effectiveness
  prevented_issue BOOLEAN DEFAULT false,
  user_satisfaction INTEGER, -- 1-5 rating
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_notification_user (discord_user_id),
  INDEX idx_notification_type (notification_type),
  INDEX idx_notification_sent (sent_at),
  INDEX idx_notification_delivered (delivered)
);

-- Prediction model performance tracking
CREATE TABLE IF NOT EXISTS prediction_model_performance (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  
  -- Prediction counts
  total_predictions INTEGER DEFAULT 0,
  true_positives INTEGER DEFAULT 0,
  false_positives INTEGER DEFAULT 0,
  true_negatives INTEGER DEFAULT 0,
  false_negatives INTEGER DEFAULT 0,
  
  -- Calculated metrics
  accuracy DECIMAL(3,2),
  precision DECIMAL(3,2),
  recall DECIMAL(3,2),
  f1_score DECIMAL(3,2),
  
  -- By prediction type
  escalation_accuracy DECIMAL(3,2),
  fraud_accuracy DECIMAL(3,2),
  failure_accuracy DECIMAL(3,2),
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(model_name, date),
  INDEX idx_model_perf_model (model_name),
  INDEX idx_model_perf_date (date)
);

-- Create views for common queries

-- High-risk users view
CREATE OR REPLACE VIEW high_risk_users AS
SELECT 
  ubp.discord_user_id,
  ubp.fraud_risk_score,
  ubp.churn_risk_score,
  ubp.escalation_rate,
  ubp.repeat_issue_frequency,
  ubp.last_session_date,
  COUNT(ae.id) as anomaly_count,
  COUNT(fde.id) as fraud_event_count
FROM user_behavior_patterns ubp
LEFT JOIN anomaly_events ae ON ae.discord_user_id = ubp.discord_user_id 
  AND ae.detected_at >= NOW() - INTERVAL '30 days'
LEFT JOIN fraud_detection_events fde ON fde.discord_user_id = ubp.discord_user_id 
  AND fde.detected_at >= NOW() - INTERVAL '30 days'
WHERE ubp.fraud_risk_score >= 70 
   OR ubp.churn_risk_score >= 70
   OR ubp.escalation_rate >= 0.5
GROUP BY ubp.discord_user_id, ubp.fraud_risk_score, ubp.churn_risk_score, 
         ubp.escalation_rate, ubp.repeat_issue_frequency, ubp.last_session_date
ORDER BY ubp.fraud_risk_score DESC, ubp.churn_risk_score DESC;

-- Active anomalies view
CREATE OR REPLACE VIEW active_anomalies AS
SELECT 
  ae.event_id,
  ae.discord_user_id,
  ae.anomaly_type,
  ae.severity,
  ae.description,
  ae.deviation_score,
  ae.status,
  ae.detected_at,
  EXTRACT(EPOCH FROM (NOW() - ae.detected_at))::INTEGER as age_seconds
FROM anomaly_events ae
WHERE ae.status IN ('open', 'investigating')
ORDER BY ae.severity DESC, ae.detected_at DESC;

-- Prediction accuracy view
CREATE OR REPLACE VIEW prediction_accuracy_summary AS
SELECT 
  model_name,
  AVG(accuracy) as avg_accuracy,
  AVG(precision) as avg_precision,
  AVG(recall) as avg_recall,
  AVG(f1_score) as avg_f1,
  MAX(date) as last_evaluated
FROM prediction_model_performance
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY model_name;

-- Proactive notification effectiveness view
CREATE OR REPLACE VIEW notification_effectiveness AS
SELECT 
  notification_type,
  COUNT(*) as total_sent,
  SUM(CASE WHEN delivered THEN 1 ELSE 0 END) as delivered_count,
  SUM(CASE WHEN read THEN 1 ELSE 0 END) as read_count,
  SUM(CASE WHEN prevented_issue THEN 1 ELSE 0 END) as prevented_count,
  AVG(user_satisfaction) as avg_satisfaction,
  (SUM(CASE WHEN delivered THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) as delivery_rate,
  (SUM(CASE WHEN read THEN 1 ELSE 0 END)::DECIMAL / NULLIF(SUM(CASE WHEN delivered THEN 1 ELSE 0 END), 0)) as read_rate,
  (SUM(CASE WHEN prevented_issue THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) as prevention_rate
FROM proactive_notifications
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY notification_type;

-- Comments
COMMENT ON TABLE user_behavior_patterns IS 'Historical behavior patterns for each user';
COMMENT ON TABLE session_predictions IS 'ML predictions for each session';
COMMENT ON TABLE anomaly_events IS 'Detected anomalies and unusual patterns';
COMMENT ON TABLE fraud_detection_events IS 'Suspected fraud events';
COMMENT ON TABLE proactive_notifications IS 'Proactive alerts sent to users';
COMMENT ON TABLE prediction_model_performance IS 'Model accuracy tracking';
