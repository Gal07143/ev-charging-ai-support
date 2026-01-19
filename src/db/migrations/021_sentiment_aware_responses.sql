-- Migration: Sentiment-Aware Response System
-- Created: 2026-01-19
-- Scope: Real-time sentiment analysis, tone adjustment, escalation triggers
--
-- Features:
-- - Real-time sentiment analysis of user messages
-- - Sentiment trajectory tracking across conversations
-- - Tone and response adjustment based on user emotion
-- - Early escalation triggers for negative sentiment trends
-- - Sentiment analytics and reporting

-- ============================================================================
-- Sentiment Analysis
-- ============================================================================

-- User message sentiment
CREATE TABLE IF NOT EXISTS message_sentiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,           -- FK to conversations
  message_id TEXT NOT NULL,                -- Individual message ID
  user_id TEXT,                            -- User identifier
  
  -- Message content
  message_text TEXT NOT NULL,              -- Original user message
  message_length INTEGER,                  -- Character count
  word_count INTEGER,                      -- Word count
  
  -- Sentiment scores (0.0 - 1.0)
  sentiment_label TEXT NOT NULL,           -- positive, negative, neutral, mixed
  positive_score REAL NOT NULL,            -- Confidence for positive
  negative_score REAL NOT NULL,            -- Confidence for negative
  neutral_score REAL NOT NULL,             -- Confidence for neutral
  compound_score REAL NOT NULL,            -- Overall sentiment (-1.0 to 1.0)
  
  -- Emotion detection
  primary_emotion TEXT,                    -- joy, anger, sadness, fear, surprise, etc.
  emotion_confidence REAL,                 -- Confidence in emotion detection
  
  -- Context
  is_first_message BOOLEAN DEFAULT 0,      -- First message in conversation
  previous_sentiment TEXT,                 -- Sentiment of previous message
  sentiment_change REAL,                   -- Change from previous (-2.0 to 2.0)
  
  -- Response adaptation
  suggested_tone TEXT,                     -- empathetic, professional, apologetic, etc.
  urgency_level TEXT,                      -- low, medium, high, critical
  escalation_recommended BOOLEAN DEFAULT 0,
  escalation_reason TEXT,
  
  -- Analysis metadata
  analysis_model TEXT DEFAULT 'vader',     -- vader, huggingface, gpt-4
  analysis_time_ms INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (conversation_id, message_id)
);

-- Conversation sentiment trajectory
CREATE TABLE IF NOT EXISTS conversation_sentiment_trajectory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL UNIQUE,    -- FK to conversations
  user_id TEXT,
  
  -- Sentiment progression
  initial_sentiment TEXT,                  -- First message sentiment
  current_sentiment TEXT,                  -- Latest message sentiment
  sentiment_trend TEXT,                    -- improving, declining, stable, volatile
  
  -- Aggregate scores
  avg_positive_score REAL,                 -- Average positive score
  avg_negative_score REAL,                 -- Average negative score
  avg_compound_score REAL,                 -- Average compound score
  
  -- Volatility metrics
  sentiment_volatility REAL,               -- Standard deviation of compound scores
  negative_streak_count INTEGER DEFAULT 0, -- Consecutive negative messages
  max_negative_streak INTEGER DEFAULT 0,   -- Longest negative streak
  
  -- Emotional journey
  emotion_sequence TEXT,                   -- JSON array of emotions over time
  dominant_emotion TEXT,                   -- Most frequent emotion
  
  -- Risk assessment
  escalation_risk_score REAL DEFAULT 0,    -- 0.0 - 1.0 (higher = more risk)
  early_warning_triggered BOOLEAN DEFAULT 0,
  early_warning_at DATETIME,
  
  -- Message counts
  total_messages INTEGER DEFAULT 0,
  positive_messages INTEGER DEFAULT 0,
  negative_messages INTEGER DEFAULT 0,
  neutral_messages INTEGER DEFAULT 0,
  
  -- Timestamps
  first_message_at DATETIME,
  last_message_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment-based response templates
CREATE TABLE IF NOT EXISTS sentiment_response_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Template info
  template_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,                  -- greeting, apology, empathy, solution, closing
  
  -- Target sentiment/emotion
  target_sentiment TEXT NOT NULL,          -- positive, negative, neutral, frustrated, angry
  urgency_level TEXT NOT NULL,             -- low, medium, high, critical
  
  -- Response template
  template_text TEXT NOT NULL,             -- Template with placeholders
  tone TEXT NOT NULL,                      -- professional, empathetic, apologetic, friendly
  
  -- Usage
  is_active BOOLEAN DEFAULT 1,
  priority INTEGER DEFAULT 0,              -- Higher = preferred
  
  -- Metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME
);

-- Sentiment escalation rules
CREATE TABLE IF NOT EXISTS sentiment_escalation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL UNIQUE,
  
  -- Trigger conditions
  negative_streak_threshold INTEGER,       -- e.g., 3 consecutive negative messages
  compound_score_threshold REAL,           -- e.g., < -0.7
  volatility_threshold REAL,               -- e.g., > 0.5 (highly volatile)
  specific_emotions TEXT,                  -- JSON array: ["anger", "frustration"]
  
  -- Response
  escalate_immediately BOOLEAN DEFAULT 0,
  suggested_tone TEXT,                     -- apologetic, empathetic, etc.
  notification_message TEXT,               -- Message to human agent
  
  -- Status
  is_active BOOLEAN DEFAULT 1,
  priority INTEGER DEFAULT 0,              -- Higher = check first
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment analytics (daily aggregates)
CREATE TABLE IF NOT EXISTS sentiment_analytics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  
  -- Message counts
  total_messages INTEGER DEFAULT 0,
  positive_messages INTEGER DEFAULT 0,
  negative_messages INTEGER DEFAULT 0,
  neutral_messages INTEGER DEFAULT 0,
  
  -- Sentiment scores
  avg_positive_score REAL,
  avg_negative_score REAL,
  avg_compound_score REAL,
  
  -- Conversations
  total_conversations INTEGER DEFAULT 0,
  conversations_with_escalation INTEGER DEFAULT 0,
  avg_negative_streak REAL,
  
  -- Emotions
  top_emotion TEXT,                        -- Most common emotion
  emotion_distribution TEXT,               -- JSON: {"joy": 45, "anger": 12, ...}
  
  -- Response effectiveness
  responses_adjusted_for_sentiment INTEGER DEFAULT 0,
  avg_sentiment_improvement REAL,          -- Change after response
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (date)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_message_sentiments_conversation 
  ON message_sentiments(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_sentiments_sentiment 
  ON message_sentiments(sentiment_label, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_sentiments_escalation 
  ON message_sentiments(escalation_recommended, urgency_level);

CREATE INDEX IF NOT EXISTS idx_conversation_sentiment_trajectory_risk 
  ON conversation_sentiment_trajectory(escalation_risk_score DESC, early_warning_triggered);

CREATE INDEX IF NOT EXISTS idx_conversation_sentiment_trajectory_trend 
  ON conversation_sentiment_trajectory(sentiment_trend, current_sentiment);

CREATE INDEX IF NOT EXISTS idx_sentiment_analytics_daily_date 
  ON sentiment_analytics_daily(date DESC);

-- ============================================================================
-- Views for Easy Access
-- ============================================================================

-- Recent high-risk conversations
CREATE VIEW IF NOT EXISTS v_high_risk_conversations AS
SELECT 
  t.*,
  (SELECT COUNT(*) FROM message_sentiments m WHERE m.conversation_id = t.conversation_id) as message_count,
  ROUND((JULIANDAY('now') - JULIANDAY(t.last_message_at)) * 24 * 60, 1) as minutes_since_last_message
FROM conversation_sentiment_trajectory t
WHERE t.escalation_risk_score > 0.7
  OR t.negative_streak_count >= 3
  OR t.early_warning_triggered = 1
ORDER BY t.escalation_risk_score DESC, t.updated_at DESC;

-- Sentiment trends (last 7 days)
CREATE VIEW IF NOT EXISTS v_sentiment_trends_7d AS
SELECT 
  date,
  total_messages,
  positive_messages,
  negative_messages,
  neutral_messages,
  ROUND(CAST(positive_messages AS FLOAT) / total_messages * 100, 1) as positive_percent,
  ROUND(CAST(negative_messages AS FLOAT) / total_messages * 100, 1) as negative_percent,
  ROUND(CAST(neutral_messages AS FLOAT) / total_messages * 100, 1) as neutral_percent,
  avg_compound_score,
  conversations_with_escalation,
  ROUND(CAST(conversations_with_escalation AS FLOAT) / total_conversations * 100, 1) as escalation_rate_percent
FROM sentiment_analytics_daily
WHERE date >= date('now', '-7 days')
ORDER BY date DESC;

-- Most effective response templates
CREATE VIEW IF NOT EXISTS v_effective_response_templates AS
SELECT 
  t.*,
  COUNT(DISTINCT m.conversation_id) as times_used,
  (SELECT AVG(sentiment_change) 
   FROM message_sentiments m2 
   WHERE m2.suggested_tone = t.tone
     AND m2.created_at > datetime('now', '-7 days')
  ) as avg_sentiment_improvement
FROM sentiment_response_templates t
LEFT JOIN message_sentiments m ON m.suggested_tone = t.tone 
  AND m.created_at > datetime('now', '-7 days')
WHERE t.is_active = 1
GROUP BY t.id
HAVING times_used > 0
ORDER BY avg_sentiment_improvement DESC, times_used DESC;

-- Conversation sentiment summary
CREATE VIEW IF NOT EXISTS v_conversation_sentiment_summary AS
SELECT 
  m.conversation_id,
  m.user_id,
  COUNT(*) as message_count,
  SUM(CASE WHEN m.sentiment_label = 'positive' THEN 1 ELSE 0 END) as positive_count,
  SUM(CASE WHEN m.sentiment_label = 'negative' THEN 1 ELSE 0 END) as negative_count,
  SUM(CASE WHEN m.sentiment_label = 'neutral' THEN 1 ELSE 0 END) as neutral_count,
  ROUND(AVG(m.compound_score), 3) as avg_compound_score,
  GROUP_CONCAT(m.sentiment_label, ' → ') as sentiment_sequence,
  MAX(CASE WHEN m.escalation_recommended = 1 THEN 1 ELSE 0 END) as had_escalation_trigger,
  MIN(m.created_at) as first_message_at,
  MAX(m.created_at) as last_message_at
FROM message_sentiments m
GROUP BY m.conversation_id, m.user_id;

-- ============================================================================
-- Seed Data: Response Templates
-- ============================================================================

INSERT OR IGNORE INTO sentiment_response_templates (template_name, category, target_sentiment, urgency_level, template_text, tone, priority) VALUES
  ('empathetic_apology', 'apology', 'negative', 'high', 'I sincerely apologize for the frustration this has caused you. I understand how important this is, and I''m here to help resolve this immediately.', 'empathetic', 10),
  ('frustrated_acknowledgment', 'empathy', 'negative', 'high', 'I can see this situation is really frustrating, and I completely understand why. Let me work on getting this fixed for you right away.', 'empathetic', 9),
  ('calm_reassurance', 'solution', 'negative', 'medium', 'I understand your concern, and I''m confident we can resolve this. Let me walk you through the steps to get this working.', 'professional', 8),
  ('friendly_positive', 'greeting', 'positive', 'low', 'Great! I''m glad to help you today. Let''s get started!', 'friendly', 7),
  ('professional_neutral', 'solution', 'neutral', 'medium', 'Thank you for providing that information. Based on what you''ve shared, here''s what we can do to help.', 'professional', 6),
  ('urgent_escalation', 'escalation', 'negative', 'critical', 'I want to make sure you get the best possible help. I''m connecting you with a specialist who can assist you immediately.', 'apologetic', 10);

-- ============================================================================
-- Seed Data: Escalation Rules
-- ============================================================================

INSERT OR IGNORE INTO sentiment_escalation_rules (rule_name, negative_streak_threshold, compound_score_threshold, escalate_immediately, suggested_tone, notification_message, priority) VALUES
  ('high_frustration_streak', 3, NULL, 0, 'empathetic', 'User has sent 3 consecutive negative messages. Early escalation recommended.', 10),
  ('severe_negativity', NULL, -0.8, 1, 'apologetic', 'User sentiment is severely negative (score < -0.8). Immediate escalation required.', 15),
  ('anger_detected', NULL, NULL, 1, 'apologetic', 'User is expressing anger. Immediate escalation to human agent.', 20);

-- Set specific_emotions for anger_detected rule
UPDATE sentiment_escalation_rules 
SET specific_emotions = '["anger", "rage", "fury"]'
WHERE rule_name = 'anger_detected';

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

-- This schema enables:
-- 1. Real-time Sentiment Analysis: Analyze user messages for emotion and sentiment
-- 2. Tone Adjustment: Adapt agent responses based on user sentiment
-- 3. Early Escalation: Detect negative trends before they escalate
-- 4. Sentiment Tracking: Monitor conversation emotional trajectory
-- 5. Response Optimization: Use templates matched to user sentiment
-- 6. Analytics: Track sentiment trends and response effectiveness
