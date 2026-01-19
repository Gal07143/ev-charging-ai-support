-- Migration: Vehicle-Charger Compatibility System
-- Created: 2026-01-19
-- Description: EV models database, connector compatibility, charging rate calculations

-- EV models database (500+ vehicles)
CREATE TABLE IF NOT EXISTS ev_models (
  id SERIAL PRIMARY KEY,
  vehicle_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- Vehicle details
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  trim VARCHAR(100),
  
  -- Battery specifications
  battery_capacity_kwh DECIMAL(5,2),
  usable_capacity_kwh DECIMAL(5,2),
  range_km INTEGER,
  range_miles INTEGER,
  
  -- Charging capabilities - AC
  ac_max_power_kw DECIMAL(5,2),
  ac_phases INTEGER, -- 1 or 3
  ac_connector_type VARCHAR(50), -- Type1, Type2, Tesla
  
  -- Charging capabilities - DC
  dc_max_power_kw DECIMAL(6,2),
  dc_connector_type VARCHAR(50), -- CCS1, CCS2, CHAdeMO, Tesla, GB/T
  
  -- Charging curve
  charging_curve JSONB, -- Array of {soc: 0-100, power_kw}
  
  -- Vehicle category
  category VARCHAR(50), -- sedan, suv, truck, van, sports
  segment VARCHAR(50), -- economy, mid, premium, luxury, performance
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_ev_make_model (make, model),
  INDEX idx_ev_year (year),
  INDEX idx_ev_connector_ac (ac_connector_type),
  INDEX idx_ev_connector_dc (dc_connector_type)
);

-- Connector compatibility matrix
CREATE TABLE IF NOT EXISTS connector_compatibility (
  id SERIAL PRIMARY KEY,
  
  -- Connector details
  vehicle_connector VARCHAR(50) NOT NULL,
  charger_connector VARCHAR(50) NOT NULL,
  
  -- Compatibility
  is_compatible BOOLEAN DEFAULT FALSE,
  requires_adapter BOOLEAN DEFAULT FALSE,
  adapter_type VARCHAR(100),
  
  -- Notes
  compatibility_notes TEXT,
  limitations TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(vehicle_connector, charger_connector),
  INDEX idx_compat_vehicle (vehicle_connector),
  INDEX idx_compat_charger (charger_connector)
);

-- OEM-specific quirks and recommendations
CREATE TABLE IF NOT EXISTS oem_charging_quirks (
  id SERIAL PRIMARY KEY,
  
  -- OEM details
  make VARCHAR(100) NOT NULL,
  model_pattern VARCHAR(100), -- NULL means applies to all models
  year_from INTEGER,
  year_to INTEGER,
  
  -- Quirk details
  quirk_type VARCHAR(50), -- adapter_required, precondition, limitation, bug, recommendation
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Impact
  severity VARCHAR(20), -- info, warning, critical
  affects_compatibility BOOLEAN DEFAULT FALSE,
  affects_charging_speed BOOLEAN DEFAULT FALSE,
  
  -- Solution
  workaround TEXT,
  recommendation TEXT,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_quirks_make (make),
  INDEX idx_quirks_type (quirk_type),
  INDEX idx_quirks_severity (severity)
);

-- Compatibility check history (log all checks)
CREATE TABLE IF NOT EXISTS compatibility_checks (
  id SERIAL PRIMARY KEY,
  check_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- Input
  vehicle_id VARCHAR(100),
  charger_model_id VARCHAR(100),
  session_id VARCHAR(100),
  discord_user_id VARCHAR(50),
  
  -- Results
  is_compatible BOOLEAN,
  compatibility_score INTEGER, -- 0-100
  
  -- Details
  ac_compatible BOOLEAN,
  dc_compatible BOOLEAN,
  max_charging_rate_kw DECIMAL(6,2),
  estimated_charge_time_minutes INTEGER,
  
  -- Issues found
  issues_found JSONB, -- Array of compatibility issues
  warnings JSONB, -- Array of warnings
  recommendations JSONB, -- Array of recommendations
  
  -- Timestamps
  checked_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_compat_check_vehicle (vehicle_id),
  INDEX idx_compat_check_charger (charger_model_id),
  INDEX idx_compat_check_session (session_id),
  INDEX idx_compat_check_date (checked_at)
);

-- Charging rate calculator cache
CREATE TABLE IF NOT EXISTS charging_rate_cache (
  id SERIAL PRIMARY KEY,
  
  -- Input parameters
  vehicle_id VARCHAR(100) NOT NULL,
  charger_max_power_kw DECIMAL(6,2) NOT NULL,
  soc_percentage INTEGER, -- State of charge (0-100)
  
  -- Calculated results
  actual_charging_rate_kw DECIMAL(6,2),
  time_to_80_percent_minutes INTEGER,
  time_to_100_percent_minutes INTEGER,
  
  -- Factors
  limiting_factor VARCHAR(100), -- vehicle, charger, cable, battery_temp, soc
  limiting_factor_details TEXT,
  
  -- Cache
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
  
  INDEX idx_rate_cache_vehicle (vehicle_id),
  INDEX idx_rate_cache_expires (expires_at)
);

-- Create views

-- Compatible vehicle-charger pairs view
CREATE OR REPLACE VIEW compatible_vehicle_charger_pairs AS
SELECT 
  ev.vehicle_id,
  ev.make,
  ev.model,
  ev.year,
  cm.charger_model_id,
  cm.manufacturer as charger_manufacturer,
  cm.model_name as charger_model,
  cc_ac.is_compatible as ac_compatible,
  cc_dc.is_compatible as dc_compatible,
  LEAST(ev.ac_max_power_kw, cm.ac_power_kw) as max_ac_rate_kw,
  LEAST(ev.dc_max_power_kw, cm.dc_power_kw) as max_dc_rate_kw
FROM ev_models ev
CROSS JOIN charger_models cm
LEFT JOIN connector_compatibility cc_ac 
  ON cc_ac.vehicle_connector = ev.ac_connector_type 
  AND cc_ac.charger_connector = cm.connector_types::jsonb->>0
LEFT JOIN connector_compatibility cc_dc 
  ON cc_dc.vehicle_connector = ev.dc_connector_type 
  AND cc_dc.charger_connector = cm.connector_types::jsonb->>0
WHERE ev.is_active = TRUE 
  AND cm.is_active = TRUE
  AND (cc_ac.is_compatible = TRUE OR cc_dc.is_compatible = TRUE);

-- Popular EV models view
CREATE OR REPLACE VIEW popular_ev_models AS
SELECT 
  ev.vehicle_id,
  ev.make,
  ev.model,
  ev.year,
  ev.battery_capacity_kwh,
  ev.range_km,
  ev.ac_max_power_kw,
  ev.dc_max_power_kw,
  COUNT(DISTINCT cc.check_id) as check_count
FROM ev_models ev
LEFT JOIN compatibility_checks cc ON cc.vehicle_id = ev.vehicle_id
WHERE ev.is_active = TRUE
GROUP BY ev.vehicle_id, ev.make, ev.model, ev.year, 
  ev.battery_capacity_kwh, ev.range_km, ev.ac_max_power_kw, ev.dc_max_power_kw
ORDER BY check_count DESC, ev.year DESC
LIMIT 100;

-- OEM quirks summary view
CREATE OR REPLACE VIEW oem_quirks_summary AS
SELECT 
  make,
  COUNT(*) as total_quirks,
  SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_quirks,
  SUM(CASE WHEN severity = 'warning' THEN 1 ELSE 0 END) as warning_quirks,
  SUM(CASE WHEN affects_compatibility THEN 1 ELSE 0 END) as compatibility_affecting
FROM oem_charging_quirks
WHERE is_active = TRUE
GROUP BY make
ORDER BY total_quirks DESC;

-- Compatibility check statistics view
CREATE OR REPLACE VIEW compatibility_check_stats AS
SELECT 
  DATE(checked_at) as date,
  COUNT(*) as total_checks,
  SUM(CASE WHEN is_compatible THEN 1 ELSE 0 END) as compatible_count,
  AVG(compatibility_score) as avg_compatibility_score,
  COUNT(DISTINCT vehicle_id) as unique_vehicles,
  COUNT(DISTINCT charger_model_id) as unique_chargers
FROM compatibility_checks
WHERE checked_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(checked_at)
ORDER BY date DESC;

-- Comments
COMMENT ON TABLE ev_models IS 'Database of 500+ electric vehicle models with specifications';
COMMENT ON TABLE connector_compatibility IS 'Matrix of vehicle-charger connector compatibility';
COMMENT ON TABLE oem_charging_quirks IS 'OEM-specific charging quirks, limitations, and recommendations';
COMMENT ON TABLE compatibility_checks IS 'Log of all vehicle-charger compatibility checks';
COMMENT ON TABLE charging_rate_cache IS 'Cached charging rate calculations';
