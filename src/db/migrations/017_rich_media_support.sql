-- Migration: Rich Media Support System
-- Created: 2026-01-19
-- Description: OCR, voice transcription, video analysis, and media storage

-- Media files table
CREATE TABLE IF NOT EXISTS media_files (
  id SERIAL PRIMARY KEY,
  media_id VARCHAR(100) UNIQUE NOT NULL,
  discord_user_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(100),
  
  -- File details
  file_type VARCHAR(20) NOT NULL, -- image, audio, video
  mime_type VARCHAR(100),
  original_filename VARCHAR(255),
  file_size_bytes BIGINT,
  
  -- Storage
  storage_url TEXT NOT NULL,
  storage_provider VARCHAR(50) DEFAULT 'cloudflare_r2',
  storage_key VARCHAR(255),
  
  -- Processing status
  processing_status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  processed_at TIMESTAMP,
  
  -- Extracted content
  transcription TEXT, -- For audio/video
  ocr_text TEXT, -- For images
  extracted_data JSONB, -- Structured data (error codes, timestamps, etc.)
  
  -- Analysis results
  analysis_results JSONB, -- GPT-4V analysis, object detection, etc.
  confidence_score DECIMAL(3,2),
  
  -- Metadata
  duration_seconds INTEGER, -- For audio/video
  resolution VARCHAR(20), -- For images/video (e.g., "1920x1080")
  language_detected VARCHAR(10),
  
  -- Timestamps
  uploaded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_media_user (discord_user_id),
  INDEX idx_media_session (session_id),
  INDEX idx_media_type (file_type),
  INDEX idx_media_status (processing_status),
  INDEX idx_media_uploaded (uploaded_at)
);

-- OCR results table (for detailed OCR tracking)
CREATE TABLE IF NOT EXISTS ocr_results (
  id SERIAL PRIMARY KEY,
  media_id VARCHAR(100) REFERENCES media_files(media_id) ON DELETE CASCADE,
  
  -- OCR details
  engine VARCHAR(50) DEFAULT 'tesseract', -- tesseract, google_vision, etc.
  language VARCHAR(10),
  confidence DECIMAL(3,2),
  
  -- Extracted text
  raw_text TEXT,
  processed_text TEXT,
  
  -- Structured extraction
  error_codes JSONB, -- Array of detected error codes
  numbers JSONB, -- Phone numbers, station IDs, etc.
  keywords JSONB, -- Important keywords detected
  
  -- Bounding boxes (for text location)
  text_regions JSONB,
  
  -- Processing details
  processing_time_ms INTEGER,
  preprocessing_applied JSONB, -- What preprocessing was done
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_ocr_media (media_id)
);

-- Voice transcription results table
CREATE TABLE IF NOT EXISTS voice_transcriptions (
  id SERIAL PRIMARY KEY,
  media_id VARCHAR(100) REFERENCES media_files(media_id) ON DELETE CASCADE,
  
  -- Transcription details
  engine VARCHAR(50) DEFAULT 'openai_whisper', -- openai_whisper, google_speech, etc.
  model VARCHAR(50), -- whisper-1, etc.
  language VARCHAR(10),
  confidence DECIMAL(3,2),
  
  -- Transcript
  full_transcript TEXT,
  segments JSONB, -- Array of {text, start, end, confidence}
  
  -- Audio analysis
  duration_seconds DECIMAL(8,2),
  detected_speakers INTEGER,
  sentiment VARCHAR(20),
  
  -- Processing details
  processing_time_ms INTEGER,
  audio_quality VARCHAR(20), -- low, medium, high
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_voice_media (media_id),
  INDEX idx_voice_language (language)
);

-- Video analysis results table
CREATE TABLE IF NOT EXISTS video_analysis_results (
  id SERIAL PRIMARY KEY,
  media_id VARCHAR(100) REFERENCES media_files(media_id) ON DELETE CASCADE,
  
  -- Video details
  duration_seconds DECIMAL(8,2),
  frame_count INTEGER,
  fps DECIMAL(5,2),
  
  -- Key frames extracted
  key_frames JSONB, -- Array of {timestamp, url, description}
  
  -- Visual analysis
  detected_issues JSONB, -- What problems were visually identified
  scene_descriptions JSONB, -- Description of what's shown
  objects_detected JSONB, -- Physical objects identified
  
  -- Text in video (OCR on frames)
  text_from_frames JSONB,
  
  -- Audio transcription (if applicable)
  audio_transcript TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_video_media (media_id)
);

-- Media processing queue table
CREATE TABLE IF NOT EXISTS media_processing_queue (
  id SERIAL PRIMARY KEY,
  media_id VARCHAR(100) REFERENCES media_files(media_id) ON DELETE CASCADE,
  
  -- Processing task
  task_type VARCHAR(50) NOT NULL, -- ocr, transcription, video_analysis
  priority INTEGER DEFAULT 5, -- 1-10, higher = more urgent
  
  -- Status
  status VARCHAR(20) DEFAULT 'queued', -- queued, processing, completed, failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  
  -- Error handling
  error_message TEXT,
  last_error_at TIMESTAMP,
  
  -- Timestamps
  queued_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  INDEX idx_queue_media (media_id),
  INDEX idx_queue_status (status),
  INDEX idx_queue_priority (priority)
);

-- Media usage analytics table
CREATE TABLE IF NOT EXISTS media_usage_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  
  -- Upload counts
  total_uploads INTEGER DEFAULT 0,
  images_uploaded INTEGER DEFAULT 0,
  audio_uploaded INTEGER DEFAULT 0,
  video_uploaded INTEGER DEFAULT 0,
  
  -- Processing counts
  ocr_processed INTEGER DEFAULT 0,
  transcriptions_processed INTEGER DEFAULT 0,
  videos_analyzed INTEGER DEFAULT 0,
  
  -- Success rates
  ocr_success_rate DECIMAL(3,2),
  transcription_success_rate DECIMAL(3,2),
  video_analysis_success_rate DECIMAL(3,2),
  
  -- Performance metrics
  avg_ocr_time_ms INTEGER,
  avg_transcription_time_ms INTEGER,
  avg_video_analysis_time_ms INTEGER,
  
  -- Storage
  total_storage_bytes BIGINT,
  storage_cost_estimate DECIMAL(10,2),
  
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(date),
  INDEX idx_analytics_date (date)
);

-- Create views for common queries

-- Recent media uploads view
CREATE OR REPLACE VIEW recent_media_uploads AS
SELECT 
  mf.media_id,
  mf.discord_user_id,
  mf.file_type,
  mf.processing_status,
  mf.uploaded_at,
  COALESCE(ocr.processed_text, vt.full_transcript) as extracted_content,
  EXTRACT(EPOCH FROM (NOW() - mf.uploaded_at))::INTEGER as age_seconds
FROM media_files mf
LEFT JOIN ocr_results ocr ON ocr.media_id = mf.media_id
LEFT JOIN voice_transcriptions vt ON vt.media_id = mf.media_id
WHERE mf.uploaded_at >= NOW() - INTERVAL '24 hours'
ORDER BY mf.uploaded_at DESC;

-- Processing queue status view
CREATE OR REPLACE VIEW processing_queue_status AS
SELECT 
  task_type,
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts,
  MIN(queued_at) as oldest_queued
FROM media_processing_queue
WHERE status IN ('queued', 'processing')
GROUP BY task_type, status
ORDER BY priority DESC, queued_at ASC;

-- Media processing success rates view
CREATE OR REPLACE VIEW media_processing_success_rates AS
SELECT 
  file_type,
  COUNT(*) as total_files,
  SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed,
  (SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*)) as success_rate,
  AVG(EXTRACT(EPOCH FROM (processed_at - uploaded_at))) as avg_processing_time_seconds
FROM media_files
WHERE uploaded_at >= NOW() - INTERVAL '30 days'
GROUP BY file_type;

-- Comments
COMMENT ON TABLE media_files IS 'All uploaded media files with processing status';
COMMENT ON TABLE ocr_results IS 'OCR extraction results from images';
COMMENT ON TABLE voice_transcriptions IS 'Voice/audio transcription results';
COMMENT ON TABLE video_analysis_results IS 'Video analysis and frame extraction results';
COMMENT ON TABLE media_processing_queue IS 'Queue for async media processing tasks';
COMMENT ON TABLE media_usage_analytics IS 'Daily analytics for media usage';
