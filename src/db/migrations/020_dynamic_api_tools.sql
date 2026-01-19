-- Migration: Dynamic API Tools System
-- Created: 2026-01-19
-- Scope: OpenAPI spec storage, automatic tool generation, API registry
--
-- Features:
-- - Store OpenAPI specifications for external APIs
-- - Track API endpoints, schemas, and authentication
-- - Generate Mastra tools dynamically from API specs
-- - Monitor API health, rate limits, and usage
-- - Version control for API specifications
-- - Manual fallback configuration for failed API integrations

-- ============================================================================
-- API Specifications Storage
-- ============================================================================

-- Core API registry
CREATE TABLE IF NOT EXISTS api_specifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_name TEXT NOT NULL UNIQUE,           -- e.g., "stripe_api", "sendgrid_api"
  display_name TEXT NOT NULL,              -- Human-readable name
  description TEXT,                        -- What this API provides
  
  -- OpenAPI Specification
  openapi_version TEXT NOT NULL,           -- e.g., "3.0.0", "3.1.0"
  spec_url TEXT,                           -- URL to fetch latest spec
  spec_content TEXT NOT NULL,              -- Full OpenAPI spec (JSON)
  spec_hash TEXT NOT NULL,                 -- SHA-256 hash for change detection
  spec_version TEXT,                       -- Spec version (e.g., "v1.2.0")
  
  -- API Configuration
  base_url TEXT NOT NULL,                  -- API base URL
  auth_type TEXT NOT NULL,                 -- bearer, api_key, oauth2, basic, none
  auth_config TEXT,                        -- JSON: credentials, tokens, etc.
  
  -- Status & Metadata
  status TEXT NOT NULL DEFAULT 'active',   -- active, disabled, deprecated, error
  health_status TEXT DEFAULT 'unknown',    -- healthy, degraded, down, unknown
  last_health_check DATETIME,
  is_auto_generated BOOLEAN DEFAULT 0,     -- Auto-generated from spec?
  
  -- Rate Limiting
  rate_limit_per_minute INTEGER,           -- Max requests per minute
  rate_limit_per_hour INTEGER,             -- Max requests per hour
  rate_limit_per_day INTEGER,              -- Max requests per day
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME
);

-- API endpoints extracted from OpenAPI specs
CREATE TABLE IF NOT EXISTS api_endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER NOT NULL,                 -- FK to api_specifications
  
  -- Endpoint details
  operation_id TEXT NOT NULL,              -- OpenAPI operationId
  path TEXT NOT NULL,                      -- e.g., "/v1/charges"
  method TEXT NOT NULL,                    -- GET, POST, PUT, DELETE, PATCH
  summary TEXT,                            -- Short description
  description TEXT,                        -- Detailed description
  
  -- Request/Response schemas
  parameters_schema TEXT,                  -- JSON schema for parameters
  request_body_schema TEXT,                -- JSON schema for request body
  response_schema TEXT,                    -- JSON schema for 200 response
  error_schemas TEXT,                      -- JSON schemas for error responses
  
  -- Generated tool info
  mastra_tool_name TEXT,                   -- Generated tool name
  tool_description TEXT,                   -- Tool description for LLM
  tool_config TEXT,                        -- Full Mastra tool config (JSON)
  
  -- Status
  is_enabled BOOLEAN DEFAULT 1,
  requires_auth BOOLEAN DEFAULT 1,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (api_id) REFERENCES api_specifications(id) ON DELETE CASCADE,
  UNIQUE (api_id, operation_id)
);

-- ============================================================================
-- API Usage & Monitoring
-- ============================================================================

-- API request/response logs
CREATE TABLE IF NOT EXISTS api_request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER NOT NULL,                 -- FK to api_specifications
  endpoint_id INTEGER,                     -- FK to api_endpoints (optional)
  
  -- Request details
  conversation_id TEXT,                    -- Which conversation triggered this
  user_id TEXT,                            -- Which user
  agent_id TEXT DEFAULT 'edge_control_agent',
  
  method TEXT NOT NULL,                    -- HTTP method
  endpoint TEXT NOT NULL,                  -- Full endpoint path
  request_headers TEXT,                    -- JSON
  request_body TEXT,                       -- JSON or raw body
  
  -- Response details
  status_code INTEGER,                     -- HTTP status code
  response_headers TEXT,                   -- JSON
  response_body TEXT,                      -- JSON or raw body
  response_time_ms INTEGER,                -- Execution time
  
  -- Error handling
  error_message TEXT,
  is_fallback BOOLEAN DEFAULT 0,           -- Manual fallback used?
  retry_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (api_id) REFERENCES api_specifications(id) ON DELETE CASCADE,
  FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE SET NULL
);

-- API health checks
CREATE TABLE IF NOT EXISTS api_health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER NOT NULL,                 -- FK to api_specifications
  
  -- Health check results
  status TEXT NOT NULL,                    -- healthy, degraded, down
  response_time_ms INTEGER,                -- Ping response time
  error_message TEXT,
  
  -- Metrics
  success_rate_1h REAL,                    -- Success rate last 1 hour (0.0-1.0)
  avg_response_time_1h INTEGER,            -- Avg response time last 1 hour
  request_count_1h INTEGER,                -- Total requests last 1 hour
  
  checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (api_id) REFERENCES api_specifications(id) ON DELETE CASCADE
);

-- Rate limit tracking
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER NOT NULL,                 -- FK to api_specifications
  
  -- Time window
  window_start DATETIME NOT NULL,          -- Start of rate limit window
  window_end DATETIME NOT NULL,            -- End of rate limit window
  window_type TEXT NOT NULL,               -- minute, hour, day
  
  -- Usage
  request_count INTEGER DEFAULT 0,         -- Requests in this window
  limit_exceeded BOOLEAN DEFAULT 0,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (api_id) REFERENCES api_specifications(id) ON DELETE CASCADE,
  UNIQUE (api_id, window_type, window_start)
);

-- Manual fallback configurations
CREATE TABLE IF NOT EXISTS api_fallback_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id INTEGER NOT NULL,                 -- FK to api_specifications
  endpoint_id INTEGER,                     -- FK to api_endpoints (optional)
  
  -- Fallback strategy
  fallback_type TEXT NOT NULL,             -- static_response, alternate_api, manual_step
  fallback_config TEXT NOT NULL,           -- JSON config for fallback
  
  -- When to use fallback
  trigger_conditions TEXT,                 -- JSON: status codes, errors, etc.
  priority INTEGER DEFAULT 0,              -- Higher = try first
  
  -- Status
  is_enabled BOOLEAN DEFAULT 1,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (api_id) REFERENCES api_specifications(id) ON DELETE CASCADE,
  FOREIGN KEY (endpoint_id) REFERENCES api_endpoints(id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_api_specifications_status 
  ON api_specifications(status, health_status);

CREATE INDEX IF NOT EXISTS idx_api_specifications_name 
  ON api_specifications(api_name);

CREATE INDEX IF NOT EXISTS idx_api_endpoints_api_id 
  ON api_endpoints(api_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_api_endpoints_tool_name 
  ON api_endpoints(mastra_tool_name);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_api_id 
  ON api_request_logs(api_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_conversation 
  ON api_request_logs(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_status 
  ON api_request_logs(status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_health_checks_api_id 
  ON api_health_checks(api_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_api_id 
  ON api_rate_limits(api_id, window_type, window_start);

-- ============================================================================
-- Views for Easy Access
-- ============================================================================

-- Active APIs with latest health status
CREATE VIEW IF NOT EXISTS v_active_apis AS
SELECT 
  a.*,
  h.status as current_health_status,
  h.response_time_ms as latest_response_time,
  h.success_rate_1h,
  h.checked_at as last_health_check,
  (SELECT COUNT(*) FROM api_endpoints e WHERE e.api_id = a.id AND e.is_enabled = 1) as enabled_endpoints_count,
  (SELECT COUNT(*) FROM api_request_logs l WHERE l.api_id = a.id AND l.created_at > datetime('now', '-1 hour')) as requests_last_hour
FROM api_specifications a
LEFT JOIN (
  SELECT api_id, status, response_time_ms, success_rate_1h, checked_at,
    ROW_NUMBER() OVER (PARTITION BY api_id ORDER BY checked_at DESC) as rn
  FROM api_health_checks
) h ON a.id = h.api_id AND h.rn = 1
WHERE a.status = 'active';

-- API performance metrics
CREATE VIEW IF NOT EXISTS v_api_performance AS
SELECT 
  a.api_name,
  a.display_name,
  COUNT(DISTINCT l.id) as total_requests,
  SUM(CASE WHEN l.status_code >= 200 AND l.status_code < 300 THEN 1 ELSE 0 END) as success_count,
  SUM(CASE WHEN l.status_code >= 400 THEN 1 ELSE 0 END) as error_count,
  ROUND(AVG(l.response_time_ms), 2) as avg_response_time_ms,
  ROUND(MIN(l.response_time_ms), 2) as min_response_time_ms,
  ROUND(MAX(l.response_time_ms), 2) as max_response_time_ms,
  ROUND(
    CAST(SUM(CASE WHEN l.status_code >= 200 AND l.status_code < 300 THEN 1 ELSE 0 END) AS FLOAT) / 
    COUNT(*) * 100, 
    2
  ) as success_rate_percent,
  SUM(CASE WHEN l.is_fallback = 1 THEN 1 ELSE 0 END) as fallback_count,
  MAX(l.created_at) as last_used_at
FROM api_specifications a
LEFT JOIN api_request_logs l ON a.id = l.api_id 
  AND l.created_at > datetime('now', '-24 hours')
GROUP BY a.id, a.api_name, a.display_name;

-- Top performing endpoints
CREATE VIEW IF NOT EXISTS v_top_api_endpoints AS
SELECT 
  a.api_name,
  e.operation_id,
  e.method || ' ' || e.path as endpoint,
  e.mastra_tool_name,
  COUNT(l.id) as request_count,
  ROUND(AVG(l.response_time_ms), 2) as avg_response_time_ms,
  ROUND(
    CAST(SUM(CASE WHEN l.status_code >= 200 AND l.status_code < 300 THEN 1 ELSE 0 END) AS FLOAT) / 
    COUNT(*) * 100, 
    2
  ) as success_rate_percent
FROM api_endpoints e
JOIN api_specifications a ON e.api_id = a.id
LEFT JOIN api_request_logs l ON e.id = l.endpoint_id 
  AND l.created_at > datetime('now', '-24 hours')
WHERE e.is_enabled = 1
GROUP BY a.api_name, e.operation_id, e.method, e.path, e.mastra_tool_name
HAVING request_count > 0
ORDER BY request_count DESC
LIMIT 20;

-- Rate limit status
CREATE VIEW IF NOT EXISTS v_rate_limit_status AS
SELECT 
  a.api_name,
  a.display_name,
  r.window_type,
  r.request_count,
  CASE r.window_type
    WHEN 'minute' THEN a.rate_limit_per_minute
    WHEN 'hour' THEN a.rate_limit_per_hour
    WHEN 'day' THEN a.rate_limit_per_day
  END as limit_value,
  ROUND(
    CAST(r.request_count AS FLOAT) / 
    CASE r.window_type
      WHEN 'minute' THEN a.rate_limit_per_minute
      WHEN 'hour' THEN a.rate_limit_per_hour
      WHEN 'day' THEN a.rate_limit_per_day
    END * 100,
    2
  ) as usage_percent,
  r.limit_exceeded,
  r.window_start,
  r.window_end
FROM api_rate_limits r
JOIN api_specifications a ON r.api_id = a.id
WHERE r.window_end > datetime('now')
ORDER BY usage_percent DESC;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

-- This schema enables:
-- 1. Dynamic API Integration: Load any OpenAPI spec and auto-generate tools
-- 2. API Monitoring: Track health, performance, and rate limits
-- 3. Fallback Strategies: Manual interventions when APIs fail
-- 4. Usage Analytics: Understand which APIs/endpoints are most used
-- 5. Version Control: Track API spec changes over time
