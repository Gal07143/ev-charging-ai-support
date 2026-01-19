-- Migration: Conversation Quality Scoring System
-- Created: 2026-01-19
-- Description: Tables for quality metrics, A/B testing, and continuous improvement

-- Conversation quality scores table
CREATE TABLE IF NOT EXISTS conversation_quality_scores (
  id SERIAL PRIMARY KEY,
  conversation_id VARCHAR(100) UNIQUE NOT NULL,
  discord_user_id VARCHAR(50) NOT NULL,
  discord_username VARCHAR(100),
  
  -- Overall quality score (0-100)
  overall_score INTEGER NOT NULL,
  quality_grade VARCHAR(10), -- A+, A, B, C, D, F
  
  -- Component scores (0-100 each)
  resolution_score INTEGER DEFAULT 0, -- Did we solve the issue?
  efficiency_score INTEGER DEFAULT 0, -- Message count, duration
  sentiment_score INTEGER DEFAULT 0, -- Sentiment progression
  tool_usage_score INTEGER DEFAULT 0, -- Right tools used?
  satisfaction_score INTEGER DEFAULT 0, -- Customer satisfaction
  
  -- Conversation metrics
  message_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  tools_used JSONB, -- Array of tool names
  issue_resolved BOOLEAN DEFAULT false,
  escalated BOOLEAN DEFAULT false,
  
  -- Sentiment tracking
  initial_sentiment VARCHAR(20),
  final_sentiment VARCHAR(20),
  sentiment_improved BOOLEAN,
  negative_sentiment_count INTEGER DEFAULT 0,
  
  -- Quality flags
  is_low_quality BOOLEAN DEFAULT false,
  quality_issues JSONB, -- Array of identified issues
  improvement_suggestions JSONB, -- What could be better
  
  -- A/B testing
  prompt_variant VARCHAR(50), -- Which prompt version was used
  experiment_id VARCHAR(100), -- A/B test identifier
  
  -- Timestamps
  conversation_start TIMESTAMP,
  conversation_end TIMESTAMP,
  scored_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_quality_user (discord_user_id),
  INDEX idx_quality_score (overall_score),
  INDEX idx_quality_grade (quality_grade),
  INDEX idx_quality_resolved (issue_resolved),
  INDEX idx_quality_low (is_low_quality),
  INDEX idx_quality_experiment (experiment_id),
  INDEX idx_quality_scored (scored_at)
);

-- A/B testing experiments table
CREATE TABLE IF NOT EXISTS ab_test_experiments (
  id SERIAL PRIMARY KEY,
  experiment_id VARCHAR(100) UNIQUE NOT NULL,
  experiment_name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Variants
  control_variant JSONB NOT NULL, -- { id: 'A', prompt: '...', config: {...} }
  test_variants JSONB NOT NULL, -- Array of variants
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- draft, active, paused, completed
  winner_variant VARCHAR(50), -- Declared winner
  
  -- Metrics
  total_conversations INTEGER DEFAULT 0,
  metrics_by_variant JSONB, -- { A: { count: 10, avg_score: 85 }, B: {...} }
  
  -- Configuration
  traffic_split JSONB, -- { A: 0.5, B: 0.5 } - percentage allocation
  success_metric VARCHAR(50) DEFAULT 'overall_score', -- What to optimize
  minimum_sample_size INTEGER DEFAULT 100,
  confidence_threshold DECIMAL(3,2) DEFAULT 0.95, -- 95% confidence
  
  -- Timestamps
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_experiment_status (status),
  INDEX idx_experiment_id (experiment_id)
);

-- Quality analytics table (daily aggregations)
CREATE TABLE IF NOT EXISTS quality_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  
  -- Volume
  total_conversations INTEGER DEFAULT 0,
  scored_conversations INTEGER DEFAULT 0,
  
  -- Quality distribution
  grade_distribution JSONB, -- { 'A+': 5, 'A': 20, 'B': 30, ... }
  avg_overall_score DECIMAL(5,2),
  median_overall_score INTEGER,
  
  -- Component averages
  avg_resolution_score DECIMAL(5,2),
  avg_efficiency_score DECIMAL(5,2),
  avg_sentiment_score DECIMAL(5,2),
  avg_tool_usage_score DECIMAL(5,2),
  avg_satisfaction_score DECIMAL(5,2),
  
  -- Outcomes
  resolution_rate DECIMAL(3,2), -- Percentage resolved
  escalation_rate DECIMAL(3,2), -- Percentage escalated
  avg_message_count DECIMAL(5,2),
  avg_duration_seconds INTEGER,
  
  -- Quality flags
  low_quality_count INTEGER DEFAULT 0,
  low_quality_rate DECIMAL(3,2),
  
  -- Sentiment
  sentiment_improvement_rate DECIMAL(3,2), -- % that improved
  negative_sentiment_rate DECIMAL(3,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(date),
  INDEX idx_analytics_date (date)
);

-- Low-quality conversation patterns (for learning)
CREATE TABLE IF NOT EXISTS quality_patterns (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(50) NOT NULL, -- too_long, tool_misuse, sentiment_drop, etc.
  pattern_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Pattern definition
  detection_rules JSONB, -- Rules to identify this pattern
  severity VARCHAR(20), -- low, medium, high, critical
  
  -- Occurrences
  occurrence_count INTEGER DEFAULT 0,
  last_seen TIMESTAMP,
  
  -- Recommendations
  improvement_suggestion TEXT,
  recommended_action TEXT,
  
  -- Examples
  example_conversation_ids JSONB, -- Array of conversation IDs showing this pattern
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_pattern_type (pattern_type),
  INDEX idx_pattern_severity (severity)
);

-- Tool usage effectiveness tracking
CREATE TABLE IF NOT EXISTS tool_effectiveness (
  id SERIAL PRIMARY KEY,
  tool_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  
  -- Usage stats
  usage_count INTEGER DEFAULT 0,
  successful_usage INTEGER DEFAULT 0,
  failed_usage INTEGER DEFAULT 0,
  
  -- Performance
  avg_resolution_contribution DECIMAL(3,2), -- How much it helps resolution
  avg_efficiency_impact DECIMAL(3,2), -- Positive or negative impact
  
  -- Quality correlation
  conversations_with_tool INTEGER DEFAULT 0,
  avg_quality_score_with_tool DECIMAL(5,2),
  avg_quality_score_without_tool DECIMAL(5,2),
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(tool_name, date),
  INDEX idx_tool_name (tool_name),
  INDEX idx_tool_date (date)
);

-- Create views for common queries

-- High-quality conversations view
CREATE OR REPLACE VIEW high_quality_conversations AS
SELECT 
  conversation_id,
  discord_username,
  overall_score,
  quality_grade,
  message_count,
  duration_seconds,
  issue_resolved,
  tools_used,
  conversation_start
FROM conversation_quality_scores
WHERE overall_score >= 80
  AND is_low_quality = false
ORDER BY overall_score DESC;

-- Low-quality conversations view
CREATE OR REPLACE VIEW low_quality_conversations AS
SELECT 
  conversation_id,
  discord_username,
  overall_score,
  quality_grade,
  quality_issues,
  improvement_suggestions,
  message_count,
  duration_seconds,
  issue_resolved,
  escalated,
  conversation_start
FROM conversation_quality_scores
WHERE is_low_quality = true
ORDER BY scored_at DESC;

-- A/B test performance view
CREATE OR REPLACE VIEW ab_test_performance AS
SELECT 
  e.experiment_id,
  e.experiment_name,
  e.status,
  e.total_conversations,
  e.winner_variant,
  COUNT(cqs.id) as scored_conversations,
  AVG(cqs.overall_score) as avg_score,
  AVG(CASE WHEN cqs.issue_resolved THEN 1 ELSE 0 END) as resolution_rate
FROM ab_test_experiments e
LEFT JOIN conversation_quality_scores cqs ON cqs.experiment_id = e.experiment_id
WHERE e.status IN ('active', 'completed')
GROUP BY e.experiment_id, e.experiment_name, e.status, e.total_conversations, e.winner_variant;

-- Tool effectiveness summary view
CREATE OR REPLACE VIEW tool_effectiveness_summary AS
SELECT 
  tool_name,
  SUM(usage_count) as total_usage,
  AVG(avg_quality_score_with_tool) as avg_quality_with,
  AVG(avg_quality_score_without_tool) as avg_quality_without,
  AVG(avg_quality_score_with_tool) - AVG(avg_quality_score_without_tool) as quality_delta,
  MAX(date) as last_analyzed
FROM tool_effectiveness
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tool_name
ORDER BY quality_delta DESC;

-- Comments
COMMENT ON TABLE conversation_quality_scores IS 'Quality scores for each conversation';
COMMENT ON TABLE ab_test_experiments IS 'A/B testing experiments for prompt optimization';
COMMENT ON TABLE quality_analytics IS 'Daily aggregated quality metrics';
COMMENT ON TABLE quality_patterns IS 'Common low-quality conversation patterns';
COMMENT ON TABLE tool_effectiveness IS 'Tool usage effectiveness tracking';
