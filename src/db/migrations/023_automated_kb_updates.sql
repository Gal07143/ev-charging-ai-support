-- Migration: Automated Knowledge Base Updates
-- Created: 2026-01-19
-- Scope: Web scraping, change detection, content parsing, human review queue
--
-- Features:
-- - Monitor external documentation sources
-- - Detect changes in charger manufacturer docs
-- - Parse PDF and HTML documentation
-- - Queue changes for human review
-- - Automatic KB article updates
-- - Version control for KB content

-- ============================================================================
-- Documentation Sources
-- ============================================================================

-- External documentation sources to monitor
CREATE TABLE IF NOT EXISTS kb_doc_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL UNIQUE,        -- e.g., "tesla_supercharger_docs"
  source_type TEXT NOT NULL,               -- website, pdf, api_endpoint
  
  -- Source location
  url TEXT NOT NULL,                       -- URL to fetch from
  selector TEXT,                           -- CSS selector for HTML scraping
  auth_required BOOLEAN DEFAULT 0,
  auth_config TEXT,                        -- JSON: credentials if needed
  
  -- Parsing configuration
  parser_type TEXT NOT NULL,               -- html, pdf, markdown, json
  parser_config TEXT,                      -- JSON: parser-specific settings
  
  -- Update schedule
  check_frequency_hours INTEGER DEFAULT 24, -- How often to check
  last_checked_at DATETIME,
  last_updated_at DATETIME,
  next_check_at DATETIME,
  
  -- Content metadata
  content_hash TEXT,                       -- SHA-256 of latest content
  content_version TEXT,                    -- Version if available
  
  -- Status
  is_active BOOLEAN DEFAULT 1,
  status TEXT DEFAULT 'pending',           -- pending, active, error, deprecated
  last_error TEXT,
  
  -- Stats
  total_checks INTEGER DEFAULT 0,
  successful_checks INTEGER DEFAULT 0,
  change_detected_count INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Detected documentation changes
CREATE TABLE IF NOT EXISTS kb_doc_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,              -- FK to kb_doc_sources
  
  -- Change detection
  change_type TEXT NOT NULL,               -- content_updated, new_section, removed_section, structural_change
  previous_hash TEXT,                      -- Hash before change
  new_hash TEXT NOT NULL,                  -- Hash after change
  
  -- Content diff
  previous_content TEXT,                   -- Previous version
  new_content TEXT NOT NULL,               -- New version
  diff_summary TEXT,                       -- Human-readable summary
  changed_sections TEXT,                   -- JSON: array of changed sections
  
  -- Impact analysis
  affected_articles TEXT,                  -- JSON: array of KB article IDs
  impact_score REAL DEFAULT 0,             -- 0.0-1.0 (higher = more important)
  urgency TEXT DEFAULT 'low',              -- low, medium, high, critical
  
  -- Review status
  review_status TEXT DEFAULT 'pending',    -- pending, approved, rejected, needs_revision
  reviewed_by TEXT,
  reviewed_at DATETIME,
  review_notes TEXT,
  
  -- Action taken
  auto_applied BOOLEAN DEFAULT 0,
  applied_at DATETIME,
  applied_by TEXT,
  
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Human review queue
CREATE TABLE IF NOT EXISTS kb_review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  change_id INTEGER NOT NULL,              -- FK to kb_doc_changes
  
  -- Queue metadata
  priority INTEGER DEFAULT 5,              -- 1-10 (higher = more urgent)
  assigned_to TEXT,
  
  -- Review task
  task_type TEXT NOT NULL,                 -- approve_change, update_article, create_article, verify_accuracy
  task_description TEXT NOT NULL,
  suggested_action TEXT,                   -- JSON: suggested updates
  
  -- Status
  status TEXT DEFAULT 'pending',           -- pending, in_progress, completed, skipped
  started_at DATETIME,
  completed_at DATETIME,
  
  -- Result
  action_taken TEXT,                       -- approved, rejected, modified, deferred
  reviewer_notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (change_id) REFERENCES kb_doc_changes(id) ON DELETE CASCADE
);

-- KB article versions (for rollback)
CREATE TABLE IF NOT EXISTS kb_article_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,             -- FK to knowledge_base
  
  -- Version info
  version_number INTEGER NOT NULL,
  change_type TEXT NOT NULL,               -- created, updated, reviewed, auto_updated
  
  -- Content snapshot
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT,
  
  -- Change metadata
  changed_by TEXT,                         -- user_id or 'system'
  change_reason TEXT,
  source_change_id INTEGER,                -- FK to kb_doc_changes if auto-updated
  
  -- Rollback info
  is_current BOOLEAN DEFAULT 1,
  superseded_by INTEGER,                   -- FK to next version
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (source_change_id) REFERENCES kb_doc_changes(id) ON DELETE SET NULL
);

-- Scraping logs
CREATE TABLE IF NOT EXISTS kb_scraping_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,              -- FK to kb_doc_sources
  
  -- Scraping result
  status TEXT NOT NULL,                    -- success, error, no_change
  content_hash TEXT,
  content_size INTEGER,
  
  -- Performance
  fetch_time_ms INTEGER,
  parse_time_ms INTEGER,
  
  -- Error details
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Change detection
  changes_detected BOOLEAN DEFAULT 0,
  change_count INTEGER DEFAULT 0,
  
  scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (source_id) REFERENCES kb_doc_sources(id) ON DELETE CASCADE
);

-- KB update analytics (daily)
CREATE TABLE IF NOT EXISTS kb_update_analytics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  
  -- Scraping activity
  total_checks INTEGER DEFAULT 0,
  successful_checks INTEGER DEFAULT 0,
  failed_checks INTEGER DEFAULT 0,
  
  -- Changes detected
  total_changes INTEGER DEFAULT 0,
  auto_applied_changes INTEGER DEFAULT 0,
  pending_review INTEGER DEFAULT 0,
  
  -- Review queue
  reviews_completed INTEGER DEFAULT 0,
  reviews_approved INTEGER DEFAULT 0,
  reviews_rejected INTEGER DEFAULT 0,
  avg_review_time_minutes REAL,
  
  -- KB updates
  articles_created INTEGER DEFAULT 0,
  articles_updated INTEGER DEFAULT 0,
  articles_deprecated INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (date)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_kb_doc_sources_active 
  ON kb_doc_sources(is_active, next_check_at);

CREATE INDEX IF NOT EXISTS idx_kb_doc_sources_status 
  ON kb_doc_sources(status, last_checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_doc_changes_source 
  ON kb_doc_changes(source_id, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_kb_doc_changes_review_status 
  ON kb_doc_changes(review_status, urgency);

CREATE INDEX IF NOT EXISTS idx_kb_review_queue_status 
  ON kb_review_queue(status, priority DESC);

CREATE INDEX IF NOT EXISTS idx_kb_review_queue_assigned 
  ON kb_review_queue(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_kb_article_versions_article 
  ON kb_article_versions(article_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_kb_scraping_logs_source 
  ON kb_scraping_logs(source_id, scraped_at DESC);

-- ============================================================================
-- Views for Easy Access
-- ============================================================================

-- Pending reviews (priority queue)
CREATE VIEW IF NOT EXISTS v_kb_pending_reviews AS
SELECT 
  q.*,
  c.change_type,
  c.urgency as change_urgency,
  c.impact_score,
  s.source_name,
  s.url as source_url,
  ROUND((JULIANDAY('now') - JULIANDAY(q.created_at)) * 24, 1) as hours_pending
FROM kb_review_queue q
JOIN kb_doc_changes c ON q.change_id = c.id
JOIN kb_doc_sources s ON c.source_id = s.id
WHERE q.status = 'pending'
ORDER BY q.priority DESC, q.created_at ASC;

-- Sources requiring checks
CREATE VIEW IF NOT EXISTS v_kb_sources_due_for_check AS
SELECT 
  s.*,
  ROUND((JULIANDAY('now') - JULIANDAY(s.last_checked_at)) * 24, 1) as hours_since_last_check,
  (SELECT COUNT(*) FROM kb_doc_changes c 
   WHERE c.source_id = s.id 
     AND c.detected_at > datetime('now', '-7 days')
  ) as changes_last_7d
FROM kb_doc_sources s
WHERE s.is_active = 1
  AND (s.next_check_at IS NULL OR datetime('now') >= s.next_check_at)
ORDER BY s.next_check_at ASC NULLS FIRST;

-- Recent KB changes summary
CREATE VIEW IF NOT EXISTS v_kb_recent_changes AS
SELECT 
  c.*,
  s.source_name,
  s.url,
  q.status as review_status,
  q.assigned_to as reviewer,
  ROUND((JULIANDAY('now') - JULIANDAY(c.detected_at)) * 24, 1) as hours_ago
FROM kb_doc_changes c
JOIN kb_doc_sources s ON c.source_id = s.id
LEFT JOIN kb_review_queue q ON c.id = q.change_id
WHERE c.detected_at > datetime('now', '-7 days')
ORDER BY c.detected_at DESC;

-- Scraping health dashboard
CREATE VIEW IF NOT EXISTS v_kb_scraping_health AS
SELECT 
  s.source_name,
  s.status,
  s.last_checked_at,
  s.check_frequency_hours,
  s.total_checks,
  s.successful_checks,
  ROUND(CAST(s.successful_checks AS FLOAT) / NULLIF(s.total_checks, 0) * 100, 2) as success_rate_percent,
  s.change_detected_count,
  (SELECT status FROM kb_scraping_logs WHERE source_id = s.id ORDER BY scraped_at DESC LIMIT 1) as last_scrape_status,
  (SELECT error_message FROM kb_scraping_logs WHERE source_id = s.id AND status = 'error' ORDER BY scraped_at DESC LIMIT 1) as last_error
FROM kb_doc_sources s
WHERE s.is_active = 1
ORDER BY s.last_checked_at DESC NULLS LAST;

-- ============================================================================
-- Seed Data: Documentation Sources
-- ============================================================================

INSERT OR IGNORE INTO kb_doc_sources (source_name, source_type, url, parser_type, check_frequency_hours, is_active) VALUES
  ('tesla_supercharger_support', 'website', 'https://www.tesla.com/support/charging', 'html', 168, 1),
  ('chademo_protocol_docs', 'website', 'https://www.chademo.com/technical/', 'html', 168, 1),
  ('ccs_standard_docs', 'website', 'https://www.charin.global/technology/ccs/', 'html', 168, 1),
  ('ampeco_api_changelog', 'website', 'https://docs.ampeco.com/changelog', 'html', 24, 1);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

-- This schema enables:
-- 1. Automated Monitoring: Regularly check external documentation sources
-- 2. Change Detection: Identify when manufacturer docs are updated
-- 3. Smart Parsing: Extract relevant information from HTML, PDF, etc.
-- 4. Human Review: Queue important changes for expert validation
-- 5. Version Control: Track KB article history for rollback
-- 6. Analytics: Monitor scraping health and update patterns
