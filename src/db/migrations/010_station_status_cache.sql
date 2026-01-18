-- Station Status Cache Table
-- Stores real-time station status for fast lookups and offline capability

CREATE TABLE IF NOT EXISTS station_status_cache (
  -- Primary identification
  station_id VARCHAR(50) PRIMARY KEY,
  station_name VARCHAR(255),
  
  -- Status information
  status VARCHAR(50) NOT NULL,  -- 'Available', 'Occupied', 'Faulted', 'Offline', 'Unavailable'
  status_code INTEGER,
  
  -- Connector details (JSON array)
  connectors JSONB,  -- [{connector_id: 1, type: 'CCS2', status: 'Available', power_kw: 50}]
  
  -- Location
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  
  -- Timestamps
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_online TIMESTAMP,
  last_status_change TIMESTAMP,
  
  -- Metadata
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  firmware_version VARCHAR(50),
  
  -- Statistics
  total_sessions_today INTEGER DEFAULT 0,
  total_energy_today_kwh DECIMAL(10, 2) DEFAULT 0,
  uptime_percentage DECIMAL(5, 2),
  
  -- Error tracking
  current_error_code VARCHAR(50),
  current_error_message TEXT,
  error_count_today INTEGER DEFAULT 0,
  
  -- Proactive monitoring flags
  needs_maintenance BOOLEAN DEFAULT FALSE,
  predicted_failure_risk VARCHAR(20),  -- 'low', 'medium', 'high'
  
  -- Indexes for performance
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_station_status ON station_status_cache(status);
CREATE INDEX IF NOT EXISTS idx_station_location ON station_status_cache(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_station_updated ON station_status_cache(last_updated);
CREATE INDEX IF NOT EXISTS idx_station_needs_maintenance ON station_status_cache(needs_maintenance) WHERE needs_maintenance = TRUE;

-- Station Status History (for analytics)
CREATE TABLE IF NOT EXISTS station_status_history (
  id SERIAL PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  status_code INTEGER,
  error_code VARCHAR(50),
  error_message TEXT,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Foreign key
  FOREIGN KEY (station_id) REFERENCES station_status_cache(station_id) ON DELETE CASCADE
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_history_station_time ON station_status_history(station_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_history_status ON station_status_history(status);

-- Station Events (for Discord notifications)
CREATE TABLE IF NOT EXISTS station_events (
  id SERIAL PRIMARY KEY,
  station_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,  -- 'went_offline', 'came_online', 'error', 'maintenance_needed'
  severity VARCHAR(20) NOT NULL,  -- 'info', 'warning', 'error', 'critical'
  message TEXT NOT NULL,
  metadata JSONB,
  
  -- Notification tracking
  notified BOOLEAN DEFAULT FALSE,
  notified_at TIMESTAMP,
  notification_channel_id VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Foreign key
  FOREIGN KEY (station_id) REFERENCES station_status_cache(station_id) ON DELETE CASCADE
);

-- Index for unnotified events
CREATE INDEX IF NOT EXISTS idx_events_unnotified ON station_events(notified, created_at) WHERE notified = FALSE;
CREATE INDEX IF NOT EXISTS idx_events_severity ON station_events(severity, created_at DESC);

-- Comments
COMMENT ON TABLE station_status_cache IS 'Real-time station status cache for fast lookups';
COMMENT ON TABLE station_status_history IS 'Historical station status for analytics and trending';
COMMENT ON TABLE station_events IS 'Station events requiring operator attention or Discord notifications';
