-- Migration: Conversation Context Search System
-- Created: 2026-01-19
-- Scope: Semantic search, conversation history, similar issues finder
--
-- Features:
-- - Full conversation history search
-- - Semantic similarity matching
-- - "Similar issues" suggestions
-- - Privacy-compliant retention
-- - Search analytics

-- ============================================================================
-- Conversation Search Index
-- ============================================================================

-- Searchable conversation messages
CREATE TABLE IF NOT EXISTS conversation_messages_search (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  message_id TEXT NOT NULL UNIQUE,
  
  -- Message details
  role TEXT NOT NULL,                      -- user, agent, system
  content TEXT NOT NULL,                   -- Message content
  content_vector TEXT,                     -- Embedding vector (JSON array) for semantic search
  
  -- Metadata
  user_id TEXT,
  timestamp DATETIME NOT NULL,
  
  -- Context
  intent TEXT,                             -- Detected intent (e.g., "charging_issue")
  entities TEXT,                           -- JSON: extracted entities (station_id, error_code, etc.)
  sentiment TEXT,                          -- positive, negative, neutral
  
  -- Relevance
  is_resolution BOOLEAN DEFAULT 0,         -- Is this a resolution message?
  resolution_quality REAL,                 -- 0-1 score
  
  -- Privacy
  retention_until DATETIME,                -- When to delete (privacy compliance)
  is_anonymized BOOLEAN DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversation summaries for quick search
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL UNIQUE,
  
  -- Summary
  title TEXT,                              -- Auto-generated title
  summary TEXT NOT NULL,                   -- Brief summary
  key_points TEXT,                         -- JSON: array of key points
  
  -- Classification
  primary_category TEXT,                   -- charging_issue, payment, account, etc.
  subcategory TEXT,
  tags TEXT,                               -- JSON: array of tags
  
  -- Outcome
  resolution_status TEXT,                  -- resolved, escalated, abandoned
  resolution_summary TEXT,
  tools_used TEXT,                         -- JSON: array of tool names
  
  -- Context
  user_id TEXT,
  station_id TEXT,
  vehicle_model TEXT,
  error_codes TEXT,                        -- JSON: array of error codes
  
  -- Quality metrics
  message_count INTEGER DEFAULT 0,
  duration_minutes REAL,
  satisfaction_score REAL,
  
  -- Timestamps
  started_at DATETIME,
  ended_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Similar conversation mappings
CREATE TABLE IF NOT EXISTS similar_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  similar_conversation_id TEXT NOT NULL,
  
  -- Similarity metrics
  similarity_score REAL NOT NULL,          -- 0-1 cosine similarity
  similarity_type TEXT NOT NULL,           -- semantic, keyword, intent, resolution
  
  -- Match details
  matching_attributes TEXT,                -- JSON: what matched (intent, entities, etc.)
  
  -- Quality
  is_helpful BOOLEAN,                      -- User feedback
  feedback_score REAL,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (conversation_id, similar_conversation_id, similarity_type)
);

-- Search queries log
CREATE TABLE IF NOT EXISTS conversation_search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Query details
  query_text TEXT NOT NULL,
  query_vector TEXT,                       -- Embedding for semantic search
  search_type TEXT NOT NULL,               -- keyword, semantic, intent
  
  -- Filters
  filters TEXT,                            -- JSON: applied filters
  
  -- Results
  results_count INTEGER,
  top_result_id TEXT,
  
  -- Performance
  search_time_ms INTEGER,
  
  -- Context
  user_id TEXT,
  session_id TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Search analytics (daily)
CREATE TABLE IF NOT EXISTS conversation_search_analytics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  
  -- Search volume
  total_searches INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  -- Search types
  keyword_searches INTEGER DEFAULT 0,
  semantic_searches INTEGER DEFAULT 0,
  intent_searches INTEGER DEFAULT 0,
  
  -- Performance
  avg_search_time_ms REAL,
  avg_results_count REAL,
  
  -- Top queries
  top_queries TEXT,                        -- JSON: [{query, count}, ...]
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (date)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_conversation_messages_search_conversation 
  ON conversation_messages_search(conversation_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_search_content 
  ON conversation_messages_search(content);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_search_intent 
  ON conversation_messages_search(intent, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_category 
  ON conversation_summaries(primary_category, subcategory);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_resolution 
  ON conversation_summaries(resolution_status, ended_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_user 
  ON conversation_summaries(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_similar_conversations_score 
  ON similar_conversations(conversation_id, similarity_score DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_search_logs_query 
  ON conversation_search_logs(query_text, created_at DESC);

-- ============================================================================
-- Full-Text Search (SQLite FTS5)
-- ============================================================================

-- FTS index for message content
CREATE VIRTUAL TABLE IF NOT EXISTS conversation_messages_fts USING fts5(
  message_id UNINDEXED,
  conversation_id UNINDEXED,
  content,
  intent,
  entities,
  tokenize = 'porter unicode61'
);

-- FTS index for conversation summaries
CREATE VIRTUAL TABLE IF NOT EXISTS conversation_summaries_fts USING fts5(
  conversation_id UNINDEXED,
  title,
  summary,
  key_points,
  tags,
  tokenize = 'porter unicode61'
);

-- ============================================================================
-- Views for Easy Access
-- ============================================================================

-- Recent conversations with summaries
CREATE VIEW IF NOT EXISTS v_recent_conversations AS
SELECT 
  cs.*,
  (SELECT COUNT(*) FROM conversation_messages_search cms WHERE cms.conversation_id = cs.conversation_id) as total_messages,
  ROUND((JULIANDAY('now') - JULIANDAY(cs.ended_at)) * 24, 1) as hours_ago
FROM conversation_summaries cs
WHERE cs.ended_at > datetime('now', '-7 days')
ORDER BY cs.ended_at DESC;

-- High-quality resolved conversations (for recommendations)
CREATE VIEW IF NOT EXISTS v_high_quality_resolutions AS
SELECT 
  cs.*,
  (SELECT GROUP_CONCAT(tool_name, ', ') FROM (
    SELECT DISTINCT json_extract(value, '$') as tool_name
    FROM conversation_summaries, json_each(tools_used)
    WHERE conversation_id = cs.conversation_id
  )) as tools_used_list
FROM conversation_summaries cs
WHERE cs.resolution_status = 'resolved'
  AND cs.satisfaction_score >= 4.0
  AND cs.resolution_summary IS NOT NULL
ORDER BY cs.satisfaction_score DESC, cs.ended_at DESC;

-- Popular search queries
CREATE VIEW IF NOT EXISTS v_popular_search_queries AS
SELECT 
  query_text,
  COUNT(*) as search_count,
  AVG(results_count) as avg_results,
  AVG(search_time_ms) as avg_search_time_ms,
  MAX(created_at) as last_searched_at
FROM conversation_search_logs
WHERE created_at > datetime('now', '-30 days')
GROUP BY query_text
HAVING search_count >= 3
ORDER BY search_count DESC
LIMIT 50;

-- Conversation search summary
CREATE VIEW IF NOT EXISTS v_conversation_search_summary AS
SELECT 
  cs.primary_category,
  COUNT(DISTINCT cs.conversation_id) as total_conversations,
  SUM(CASE WHEN cs.resolution_status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
  AVG(cs.message_count) as avg_messages,
  AVG(cs.duration_minutes) as avg_duration_minutes,
  AVG(cs.satisfaction_score) as avg_satisfaction
FROM conversation_summaries cs
WHERE cs.ended_at > datetime('now', '-30 days')
GROUP BY cs.primary_category
ORDER BY total_conversations DESC;

-- ============================================================================
-- Triggers for FTS Sync
-- ============================================================================

-- Sync messages to FTS on insert
CREATE TRIGGER IF NOT EXISTS sync_message_to_fts_insert
AFTER INSERT ON conversation_messages_search
BEGIN
  INSERT INTO conversation_messages_fts (message_id, conversation_id, content, intent, entities)
  VALUES (NEW.message_id, NEW.conversation_id, NEW.content, NEW.intent, NEW.entities);
END;

-- Sync summaries to FTS on insert
CREATE TRIGGER IF NOT EXISTS sync_summary_to_fts_insert
AFTER INSERT ON conversation_summaries
BEGIN
  INSERT INTO conversation_summaries_fts (conversation_id, title, summary, key_points, tags)
  VALUES (NEW.conversation_id, NEW.title, NEW.summary, NEW.key_points, NEW.tags);
END;

-- Sync summaries to FTS on update
CREATE TRIGGER IF NOT EXISTS sync_summary_to_fts_update
AFTER UPDATE ON conversation_summaries
BEGIN
  DELETE FROM conversation_summaries_fts WHERE conversation_id = OLD.conversation_id;
  INSERT INTO conversation_summaries_fts (conversation_id, title, summary, key_points, tags)
  VALUES (NEW.conversation_id, NEW.title, NEW.summary, NEW.key_points, NEW.tags);
END;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

-- This schema enables:
-- 1. Full-Text Search: Fast keyword search across all conversations
-- 2. Semantic Search: Vector-based similarity matching (embeddings stored as JSON)
-- 3. Similar Issues: Find conversations with similar problems/resolutions
-- 4. Privacy Compliance: Automatic retention and anonymization
-- 5. Search Analytics: Track what users search for
-- 6. Resolution Mining: Find successful resolutions for current issues
