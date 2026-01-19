-- Migration: Escalation System
-- Created: 2026-01-19
-- Description: Tables for smart escalation detection and ticket management

-- Escalation tickets table
CREATE TABLE IF NOT EXISTS escalation_tickets (
  id SERIAL PRIMARY KEY,
  ticket_id VARCHAR(100) UNIQUE NOT NULL, -- External ticket system ID (e.g., Zendesk)
  discord_user_id VARCHAR(50) NOT NULL,
  discord_username VARCHAR(100),
  
  -- Classification
  issue_type VARCHAR(50) NOT NULL, -- technical, billing, account, general
  issue_category VARCHAR(100), -- specific category (e.g., charging_failure, payment_error)
  urgency_level VARCHAR(20) NOT NULL, -- low, medium, high, critical
  priority_score INTEGER DEFAULT 0, -- 0-100
  
  -- Context
  conversation_summary TEXT,
  conversation_context JSONB, -- Full conversation history
  diagnostic_results JSONB, -- Results from workflows
  technical_details JSONB, -- Station, charger, error codes
  user_sentiment VARCHAR(20), -- frustrated, angry, neutral, satisfied
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'open', -- open, assigned, in_progress, resolved, closed
  assigned_to VARCHAR(100), -- Human agent username
  resolution_time_seconds INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  escalated_at TIMESTAMP DEFAULT NOW(),
  assigned_at TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,
  
  -- Metadata
  escalation_reason TEXT,
  escalation_triggers JSONB, -- What triggered the escalation
  customer_satisfaction_score INTEGER, -- 1-5 after resolution
  
  -- Indexes
  INDEX idx_escalation_user (discord_user_id),
  INDEX idx_escalation_status (status),
  INDEX idx_escalation_urgency (urgency_level),
  INDEX idx_escalation_created (created_at),
  INDEX idx_escalation_ticket_id (ticket_id)
);

-- Escalation triggers table (what causes escalation)
CREATE TABLE IF NOT EXISTS escalation_triggers (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES escalation_tickets(id) ON DELETE CASCADE,
  
  trigger_type VARCHAR(50) NOT NULL, -- timeout, repeated_issue, negative_sentiment, explicit_request, workflow_failure, safety_concern
  trigger_details JSONB,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_trigger_ticket (ticket_id),
  INDEX idx_trigger_type (trigger_type)
);

-- Escalation analytics table
CREATE TABLE IF NOT EXISTS escalation_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  
  -- Volumes
  total_escalations INTEGER DEFAULT 0,
  escalations_by_type JSONB, -- { technical: 10, billing: 5, ... }
  escalations_by_urgency JSONB, -- { low: 3, medium: 8, high: 4, critical: 0 }
  
  -- Resolution metrics
  avg_resolution_time_seconds INTEGER,
  median_resolution_time_seconds INTEGER,
  resolved_count INTEGER DEFAULT 0,
  unresolved_count INTEGER DEFAULT 0,
  
  -- Quality metrics
  avg_customer_satisfaction DECIMAL(3,2),
  first_contact_resolution_rate DECIMAL(3,2),
  
  -- Trigger analysis
  top_triggers JSONB, -- Most common escalation reasons
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(date),
  INDEX idx_analytics_date (date)
);

-- Conversation context snapshots (for ticket creation)
CREATE TABLE IF NOT EXISTS conversation_contexts (
  id SERIAL PRIMARY KEY,
  discord_user_id VARCHAR(50) NOT NULL,
  ticket_id INTEGER REFERENCES escalation_tickets(id) ON DELETE CASCADE,
  
  -- Context data
  message_count INTEGER DEFAULT 0,
  conversation_duration_seconds INTEGER,
  messages JSONB, -- Array of { role, content, timestamp }
  
  -- Technical context
  stations_involved JSONB, -- Array of station IDs
  errors_encountered JSONB, -- Array of error codes
  actions_taken JSONB, -- Array of actions (reset, unlock, etc.)
  
  -- Sentiment tracking
  sentiment_history JSONB, -- Array of { timestamp, sentiment, score }
  overall_sentiment VARCHAR(20),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_context_user (discord_user_id),
  INDEX idx_context_ticket (ticket_id)
);

-- Escalation notes (for human agents)
CREATE TABLE IF NOT EXISTS escalation_notes (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES escalation_tickets(id) ON DELETE CASCADE,
  
  note_type VARCHAR(50), -- internal, customer_visible, resolution
  note_text TEXT NOT NULL,
  author VARCHAR(100), -- Agent username or 'system'
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_notes_ticket (ticket_id),
  INDEX idx_notes_created (created_at)
);

-- Create views for common queries

-- Active escalations view
CREATE OR REPLACE VIEW active_escalations AS
SELECT 
  et.id,
  et.ticket_id,
  et.discord_username,
  et.issue_type,
  et.urgency_level,
  et.priority_score,
  et.status,
  et.assigned_to,
  et.escalated_at,
  EXTRACT(EPOCH FROM (NOW() - et.escalated_at))::INTEGER as age_seconds,
  cc.message_count,
  cc.overall_sentiment
FROM escalation_tickets et
LEFT JOIN conversation_contexts cc ON cc.ticket_id = et.id
WHERE et.status IN ('open', 'assigned', 'in_progress')
ORDER BY et.priority_score DESC, et.escalated_at ASC;

-- Escalation performance view
CREATE OR REPLACE VIEW escalation_performance AS
SELECT 
  DATE(escalated_at) as date,
  COUNT(*) as total_escalations,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
  COUNT(CASE WHEN status IN ('open', 'assigned', 'in_progress') THEN 1 END) as active,
  AVG(resolution_time_seconds) as avg_resolution_time,
  AVG(priority_score) as avg_priority,
  AVG(customer_satisfaction_score) as avg_satisfaction
FROM escalation_tickets
WHERE escalated_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(escalated_at)
ORDER BY date DESC;

-- Comments
COMMENT ON TABLE escalation_tickets IS 'Main escalation tracking table';
COMMENT ON TABLE escalation_triggers IS 'Records what triggered each escalation';
COMMENT ON TABLE escalation_analytics IS 'Daily aggregated escalation metrics';
COMMENT ON TABLE conversation_contexts IS 'Conversation snapshots for ticket context';
COMMENT ON TABLE escalation_notes IS 'Notes added by human agents during resolution';
