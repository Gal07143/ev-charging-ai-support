-- ============================================
-- CONSOLIDATED MIGRATION SCRIPT
-- Edge Control Support Bot - All Database Schema
-- ============================================

-- This script creates all necessary tables for the system
-- Run with: wrangler d1 execute edge-control-db --local --file=./init-db.sql

-- ============================================
-- CORE TABLES
-- ============================================

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  thread_id TEXT PRIMARY KEY,
  user_id TEXT,
  channel_id TEXT,
  language TEXT DEFAULT 'he',
  status TEXT DEFAULT 'active',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  resolved_at DATETIME
);

-- Conversation messages
CREATE TABLE IF NOT EXISTS conversation_messages (
  message_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (thread_id) REFERENCES conversations(thread_id)
);

-- ============================================
-- KNOWLEDGE BASE
-- ============================================

-- KB articles
CREATE TABLE IF NOT EXISTS knowledge_base (
  article_id TEXT PRIMARY KEY,
  title_he TEXT,
  title_en TEXT,
  title_ru TEXT,
  title_ar TEXT,
  content_he TEXT,
  content_en TEXT,
  content_ru TEXT,
  content_ar TEXT,
  category TEXT,
  language TEXT,
  search_vector TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  views INTEGER DEFAULT 0
);

-- ============================================
-- CHARGERS & DIAGNOSTICS
-- ============================================

-- Charger specifications
CREATE TABLE IF NOT EXISTS charger_specifications (
  charger_id TEXT PRIMARY KEY,
  manufacturer TEXT,
  model_name TEXT,
  power_rating_kw REAL,
  connector_types TEXT,
  ocpp_version TEXT,
  firmware_version TEXT,
  network_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Real-time charger status
CREATE TABLE IF NOT EXISTS charger_status_realtime (
  charger_id TEXT PRIMARY KEY,
  status TEXT,
  power_output_kw REAL,
  session_id TEXT,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Diagnostic patterns
CREATE TABLE IF NOT EXISTS diagnostic_patterns (
  pattern_id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_name TEXT,
  error_codes TEXT,
  symptoms TEXT,
  solution_steps TEXT,
  success_rate REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Charger diagnostics
CREATE TABLE IF NOT EXISTS charger_diagnostics (
  diagnostic_id TEXT PRIMARY KEY,
  charger_id TEXT,
  error_code TEXT,
  severity TEXT,
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

-- ============================================
-- EV VEHICLES
-- ============================================

-- EV models
CREATE TABLE IF NOT EXISTS ev_vehicle_models (
  model_id TEXT PRIMARY KEY,
  manufacturer TEXT,
  model_name TEXT,
  model_year INTEGER,
  battery_capacity_kwh REAL,
  max_dc_charge_rate_kw REAL,
  max_ac_charge_rate_kw REAL,
  connector_type_dc TEXT,
  connector_type_ac TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vehicle-charger compatibility
CREATE TABLE IF NOT EXISTS vehicle_charger_compatibility (
  compatibility_id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_model_id TEXT,
  charger_id TEXT,
  compatibility_status TEXT,
  max_charge_rate_kw REAL,
  notes TEXT
);

-- ============================================
-- MEDIA & RICH CONTENT
-- ============================================

-- Media files
CREATE TABLE IF NOT EXISTS media_files (
  file_id TEXT PRIMARY KEY,
  thread_id TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  mime_type TEXT,
  storage_path TEXT,
  upload_status TEXT DEFAULT 'pending',
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OCR results
CREATE TABLE IF NOT EXISTS ocr_results (
  result_id TEXT PRIMARY KEY,
  file_id TEXT,
  extracted_text TEXT,
  confidence_score REAL,
  detected_codes TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES media_files(file_id)
);

-- Voice transcriptions
CREATE TABLE IF NOT EXISTS voice_transcriptions (
  transcription_id TEXT PRIMARY KEY,
  file_id TEXT,
  transcribed_text TEXT,
  language TEXT,
  confidence_score REAL,
  duration_seconds REAL,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES media_files(file_id)
);

-- Video analysis
CREATE TABLE IF NOT EXISTS video_analysis_results (
  analysis_id TEXT PRIMARY KEY,
  file_id TEXT,
  analysis_summary TEXT,
  detected_objects TEXT,
  key_frames TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES media_files(file_id)
);

-- Media processing queue
CREATE TABLE IF NOT EXISTS media_processing_queue (
  queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id TEXT,
  processing_type TEXT,
  priority INTEGER DEFAULT 5,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME
);

-- ============================================
-- ANALYTICS & QUALITY
-- ============================================

-- Tool usage tracking
CREATE TABLE IF NOT EXISTS tool_usage (
  usage_id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_name TEXT,
  thread_id TEXT,
  user_id TEXT,
  execution_time_ms INTEGER,
  success INTEGER,
  error_message TEXT,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversation quality
CREATE TABLE IF NOT EXISTS conversation_quality (
  quality_id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT,
  quality_score REAL,
  resolution_status TEXT,
  response_time_avg_ms INTEGER,
  user_satisfaction INTEGER,
  evaluated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Quality scoring criteria
CREATE TABLE IF NOT EXISTS quality_scoring_criteria (
  criteria_id INTEGER PRIMARY KEY AUTOINCREMENT,
  criteria_name TEXT,
  weight REAL,
  description TEXT
);

-- ============================================
-- SENTIMENT ANALYSIS
-- ============================================

-- Sentiment analysis
CREATE TABLE IF NOT EXISTS sentiment_analysis (
  analysis_id TEXT PRIMARY KEY,
  thread_id TEXT,
  message_id TEXT,
  overall_sentiment TEXT,
  compound_score REAL,
  positive_score REAL,
  negative_score REAL,
  neutral_score REAL,
  detected_emotions TEXT,
  analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sentiment trajectories
CREATE TABLE IF NOT EXISTS sentiment_trajectories (
  trajectory_id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT,
  sentiment_trend TEXT,
  escalation_triggered INTEGER DEFAULT 0,
  analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- RESPONSE TEMPLATES
-- ============================================

-- Multi-language templates
CREATE TABLE IF NOT EXISTS response_templates (
  template_id TEXT PRIMARY KEY,
  category TEXT,
  language TEXT,
  template_text TEXT,
  sentiment_tone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CACHING & OFFLINE MODE
-- ============================================

-- Cache entries
CREATE TABLE IF NOT EXISTS cache_entries (
  cache_key TEXT PRIMARY KEY,
  cache_value TEXT,
  cache_type TEXT,
  ttl INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

-- Circuit breaker state
CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  service_name TEXT PRIMARY KEY,
  state TEXT,
  failure_count INTEGER DEFAULT 0,
  last_failure_at DATETIME,
  last_success_at DATETIME
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_language ON conversations(language);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON conversation_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_charger_status ON charger_status_realtime(status);
CREATE INDEX IF NOT EXISTS idx_tool_usage_thread ON tool_usage(thread_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_name ON tool_usage(tool_name);
CREATE INDEX IF NOT EXISTS idx_media_files_thread ON media_files(thread_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_thread ON sentiment_analysis(thread_id);

-- ============================================
-- INITIAL SETUP COMPLETE
-- ============================================

SELECT 'Database schema initialized successfully!' as result;
