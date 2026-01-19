-- Migration: Offline Mode with Caching System
-- Created: 2026-01-19
-- Scope: Response caching, circuit breaker pattern, graceful degradation
--
-- Features:
-- - Cache responses for offline fallback
-- - Circuit breaker for external service failures
-- - Cache hit/miss tracking and analytics
-- - TTL management for cached data
-- - Cache invalidation strategies

-- ============================================================================
-- Cache Management
-- ============================================================================

-- Cache entries (metadata for KV-stored data)
CREATE TABLE IF NOT EXISTS cache_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE,           -- Key in KV storage
  cache_type TEXT NOT NULL,                 -- response, api_result, kb_article, etc.
  
  -- Content metadata
  content_hash TEXT NOT NULL,               -- SHA-256 hash of cached content
  content_size INTEGER,                     -- Size in bytes
  content_preview TEXT,                     -- First 200 chars for preview
  
  -- TTL configuration
  ttl_seconds INTEGER NOT NULL DEFAULT 3600, -- Time to live (1 hour default)
  expires_at DATETIME NOT NULL,             -- Expiration timestamp
  
  -- Usage tracking
  hit_count INTEGER DEFAULT 0,              -- Cache hits
  last_hit_at DATETIME,                     -- Last access time
  
  -- Source metadata
  source_type TEXT,                         -- api, database, computation, etc.
  source_identifier TEXT,                   -- API endpoint, table name, etc.
  
  -- Status
  is_stale BOOLEAN DEFAULT 0,               -- Marked for refresh
  is_valid BOOLEAN DEFAULT 1,               -- Valid for use
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache access logs (for analytics)
CREATE TABLE IF NOT EXISTS cache_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL,                  -- FK to cache_entries
  
  -- Access details
  access_type TEXT NOT NULL,                -- hit, miss, invalidate, refresh
  conversation_id TEXT,                     -- Which conversation
  user_id TEXT,                             -- Which user
  
  -- Performance
  response_time_ms INTEGER,                 -- Time to retrieve (hit) or generate (miss)
  is_fallback BOOLEAN DEFAULT 0,            -- Used as offline fallback?
  
  -- Context
  request_context TEXT,                     -- JSON: additional context
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Circuit breaker states
CREATE TABLE IF NOT EXISTS circuit_breaker_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL UNIQUE,        -- e.g., "ampeco_api", "kb_search", etc.
  
  -- Circuit state
  state TEXT NOT NULL DEFAULT 'closed',     -- closed, open, half_open
  failure_count INTEGER DEFAULT 0,          -- Consecutive failures
  success_count INTEGER DEFAULT 0,          -- Consecutive successes (in half_open)
  
  -- Thresholds
  failure_threshold INTEGER DEFAULT 5,      -- Failures before opening
  success_threshold INTEGER DEFAULT 2,      -- Successes before closing
  timeout_seconds INTEGER DEFAULT 60,       -- Timeout before half_open
  
  -- Timestamps
  last_failure_at DATETIME,
  last_success_at DATETIME,
  opened_at DATETIME,                       -- When circuit opened
  half_opened_at DATETIME,                  -- When entered half_open
  closed_at DATETIME,                       -- When circuit closed
  
  -- Statistics
  total_requests INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0,
  total_successes INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Circuit breaker events
CREATE TABLE IF NOT EXISTS circuit_breaker_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,               -- FK to circuit_breaker_states
  
  -- Event details
  event_type TEXT NOT NULL,                 -- failure, success, opened, closed, half_opened
  previous_state TEXT,                      -- State before event
  new_state TEXT,                           -- State after event
  
  -- Context
  error_message TEXT,
  request_context TEXT,                     -- JSON
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache invalidation rules
CREATE TABLE IF NOT EXISTS cache_invalidation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL UNIQUE,
  
  -- Target caches
  cache_type TEXT NOT NULL,                 -- Type of cache to invalidate
  pattern TEXT,                             -- Key pattern (e.g., "api:ampeco:*")
  
  -- Trigger conditions
  trigger_type TEXT NOT NULL,               -- time_based, event_based, manual
  trigger_config TEXT,                      -- JSON: schedule, events, etc.
  
  -- Action
  invalidation_action TEXT NOT NULL,        -- delete, mark_stale, refresh
  
  -- Status
  is_active BOOLEAN DEFAULT 1,
  last_triggered_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache analytics (daily aggregates)
CREATE TABLE IF NOT EXISTS cache_analytics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  
  -- Overall metrics
  total_requests INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  hit_rate_percent REAL,
  
  -- Performance
  avg_hit_response_ms REAL,
  avg_miss_response_ms REAL,
  
  -- Cache types
  cache_type_stats TEXT,                    -- JSON: stats by type
  
  -- Storage
  total_cached_items INTEGER DEFAULT 0,
  total_cache_size_bytes INTEGER DEFAULT 0,
  
  -- Circuit breaker
  services_opened INTEGER DEFAULT 0,        -- Services in open state
  total_fallbacks INTEGER DEFAULT 0,        -- Fallback responses used
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (date)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cache_entries_key 
  ON cache_entries(cache_key);

CREATE INDEX IF NOT EXISTS idx_cache_entries_type_expires 
  ON cache_entries(cache_type, expires_at);

CREATE INDEX IF NOT EXISTS idx_cache_entries_stale 
  ON cache_entries(is_stale, expires_at);

CREATE INDEX IF NOT EXISTS idx_cache_access_logs_key 
  ON cache_access_logs(cache_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cache_access_logs_type 
  ON cache_access_logs(access_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_states_service 
  ON circuit_breaker_states(service_name, state);

CREATE INDEX IF NOT EXISTS idx_circuit_breaker_events_service 
  ON circuit_breaker_events(service_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cache_analytics_daily_date 
  ON cache_analytics_daily(date DESC);

-- ============================================================================
-- Views for Easy Access
-- ============================================================================

-- Active caches with hit rates
CREATE VIEW IF NOT EXISTS v_active_caches AS
SELECT 
  ce.*,
  (SELECT COUNT(*) FROM cache_access_logs cal 
   WHERE cal.cache_key = ce.cache_key 
     AND cal.access_type = 'hit' 
     AND cal.created_at > datetime('now', '-1 hour')
  ) as hits_last_hour,
  (SELECT COUNT(*) FROM cache_access_logs cal 
   WHERE cal.cache_key = ce.cache_key 
     AND cal.created_at > datetime('now', '-1 hour')
  ) as total_accesses_last_hour,
  CASE 
    WHEN datetime('now') > ce.expires_at THEN 1
    ELSE 0
  END as is_expired,
  ROUND((JULIANDAY(ce.expires_at) - JULIANDAY('now')) * 24 * 60, 1) as minutes_until_expiry
FROM cache_entries ce
WHERE ce.is_valid = 1
ORDER BY ce.hit_count DESC;

-- Circuit breaker dashboard
CREATE VIEW IF NOT EXISTS v_circuit_breaker_dashboard AS
SELECT 
  cbs.*,
  (SELECT COUNT(*) FROM circuit_breaker_events cbe 
   WHERE cbe.service_name = cbs.service_name 
     AND cbe.created_at > datetime('now', '-1 hour')
  ) as events_last_hour,
  (SELECT COUNT(*) FROM circuit_breaker_events cbe 
   WHERE cbe.service_name = cbs.service_name 
     AND cbe.event_type = 'failure'
     AND cbe.created_at > datetime('now', '-1 hour')
  ) as failures_last_hour,
  CASE 
    WHEN cbs.state = 'open' THEN 
      ROUND((JULIANDAY('now') - JULIANDAY(cbs.opened_at)) * 24 * 60, 1)
    ELSE NULL
  END as minutes_open,
  ROUND(CAST(cbs.total_successes AS FLOAT) / NULLIF(cbs.total_requests, 0) * 100, 2) as overall_success_rate_percent
FROM circuit_breaker_states cbs;

-- Cache performance by type
CREATE VIEW IF NOT EXISTS v_cache_performance_by_type AS
SELECT 
  ce.cache_type,
  COUNT(DISTINCT ce.cache_key) as unique_keys,
  SUM(ce.hit_count) as total_hits,
  AVG(ce.hit_count) as avg_hits_per_key,
  SUM(ce.content_size) as total_size_bytes,
  (SELECT COUNT(*) FROM cache_access_logs cal 
   JOIN cache_entries ce2 ON cal.cache_key = ce2.cache_key
   WHERE ce2.cache_type = ce.cache_type 
     AND cal.access_type = 'hit'
     AND cal.created_at > datetime('now', '-24 hours')
  ) as hits_24h,
  (SELECT COUNT(*) FROM cache_access_logs cal 
   JOIN cache_entries ce2 ON cal.cache_key = ce2.cache_key
   WHERE ce2.cache_type = ce.cache_type 
     AND cal.access_type = 'miss'
     AND cal.created_at > datetime('now', '-24 hours')
  ) as misses_24h,
  (SELECT AVG(response_time_ms) FROM cache_access_logs cal 
   JOIN cache_entries ce2 ON cal.cache_key = ce2.cache_key
   WHERE ce2.cache_type = ce.cache_type 
     AND cal.access_type = 'hit'
     AND cal.created_at > datetime('now', '-24 hours')
  ) as avg_hit_time_ms
FROM cache_entries ce
WHERE ce.is_valid = 1
GROUP BY ce.cache_type;

-- Recent cache misses (for optimization)
CREATE VIEW IF NOT EXISTS v_recent_cache_misses AS
SELECT 
  cal.cache_key,
  ce.cache_type,
  ce.source_type,
  COUNT(*) as miss_count,
  MAX(cal.created_at) as last_miss_at,
  AVG(cal.response_time_ms) as avg_generation_time_ms
FROM cache_access_logs cal
LEFT JOIN cache_entries ce ON cal.cache_key = ce.cache_key
WHERE cal.access_type = 'miss'
  AND cal.created_at > datetime('now', '-1 hour')
GROUP BY cal.cache_key, ce.cache_type, ce.source_type
HAVING miss_count > 5
ORDER BY miss_count DESC;

-- ============================================================================
-- Seed Data: Circuit Breakers
-- ============================================================================

INSERT OR IGNORE INTO circuit_breaker_states (service_name, failure_threshold, success_threshold, timeout_seconds) VALUES
  ('ampeco_api', 5, 2, 60),
  ('openai_api', 3, 2, 120),
  ('kb_search', 10, 3, 30),
  ('database_query', 10, 3, 30);

-- ============================================================================
-- Seed Data: Cache Invalidation Rules
-- ============================================================================

INSERT OR IGNORE INTO cache_invalidation_rules (rule_name, cache_type, pattern, trigger_type, trigger_config, invalidation_action) VALUES
  ('hourly_api_refresh', 'api_result', 'api:*', 'time_based', '{"interval_minutes": 60}', 'mark_stale'),
  ('daily_kb_refresh', 'kb_article', 'kb:*', 'time_based', '{"interval_hours": 24}', 'refresh'),
  ('station_status_refresh', 'response', 'station:status:*', 'time_based', '{"interval_minutes": 5}', 'delete');

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

-- This schema enables:
-- 1. Response Caching: Store API responses and computed results in KV
-- 2. Circuit Breaker Pattern: Prevent cascading failures from external services
-- 3. Graceful Degradation: Serve stale data when services are unavailable
-- 4. Cache Analytics: Track hit rates, performance, and storage usage
-- 5. Smart Invalidation: Time-based and event-based cache refresh
-- 6. Offline Mode: Continue serving cached responses when online services fail
