-- Charger-Specific Database
-- Comprehensive database of 200+ charger models with specs, error codes, and troubleshooting

-- Charger Models Table
CREATE TABLE IF NOT EXISTS charger_models (
  id SERIAL PRIMARY KEY,
  manufacturer TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_family TEXT,
  connector_types TEXT[], -- e.g., ['Type 2', 'CCS', 'CHAdeMO']
  max_power_kw DECIMAL(10,2),
  charging_type TEXT CHECK (charging_type IN ('AC', 'DC', 'Both')),
  voltage_range TEXT, -- e.g., '200-480V'
  current_rating_amps DECIMAL(10,2),
  communication_protocol TEXT[], -- e.g., ['OCPP 1.6', 'OCPP 2.0.1']
  display_type TEXT,
  payment_methods TEXT[], -- e.g., ['RFID', 'App', 'Credit Card']
  ip_rating TEXT, -- e.g., 'IP54'
  operating_temp_range TEXT, -- e.g., '-25°C to +50°C'
  dimensions TEXT, -- e.g., '800x600x200mm'
  weight_kg DECIMAL(10,2),
  warranty_years INTEGER,
  common_issues TEXT[],
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(manufacturer, model_name)
);

-- Error Codes Table
CREATE TABLE IF NOT EXISTS charger_error_codes (
  id SERIAL PRIMARY KEY,
  manufacturer TEXT NOT NULL,
  model_family TEXT, -- NULL means applies to all models from this manufacturer
  error_code TEXT NOT NULL,
  error_name TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  category TEXT, -- e.g., 'Communication', 'Power', 'Safety', 'Hardware'
  symptoms TEXT[],
  common_causes TEXT[],
  troubleshooting_steps TEXT[],
  resolution_time_avg_minutes INTEGER,
  requires_technician BOOLEAN DEFAULT FALSE,
  requires_part_replacement BOOLEAN DEFAULT FALSE,
  parts_needed TEXT[],
  occurrence_frequency TEXT CHECK (occurrence_frequency IN ('very_common', 'common', 'occasional', 'rare')),
  related_error_codes TEXT[],
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(manufacturer, model_family, error_code)
);

-- Troubleshooting Guides Table
CREATE TABLE IF NOT EXISTS troubleshooting_guides (
  id SERIAL PRIMARY KEY,
  manufacturer TEXT NOT NULL,
  model_family TEXT,
  issue_title TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  issue_category TEXT, -- e.g., 'No Power', 'Slow Charging', 'Connection Failed'
  diagnostic_steps JSONB NOT NULL, -- Array of {step: string, expectedResult: string, ifFailed: string}
  resolution_steps TEXT[],
  preventive_measures TEXT[],
  estimated_resolution_time_minutes INTEGER,
  skill_level_required TEXT CHECK (skill_level_required IN ('user', 'operator', 'technician', 'engineer')),
  tools_required TEXT[],
  success_rate DECIMAL(3,2), -- 0.00 to 1.00
  views_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Compatibility Matrix Table
CREATE TABLE IF NOT EXISTS charger_vehicle_compatibility (
  id SERIAL PRIMARY KEY,
  charger_manufacturer TEXT NOT NULL,
  charger_model TEXT NOT NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year_start INTEGER,
  vehicle_year_end INTEGER,
  compatibility_status TEXT CHECK (compatibility_status IN ('fully_compatible', 'compatible_with_adapter', 'limited', 'incompatible')),
  max_charging_speed_kw DECIMAL(10,2),
  connector_required TEXT,
  adapter_needed TEXT,
  notes TEXT,
  tested BOOLEAN DEFAULT FALSE,
  last_tested_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_charger_models_manufacturer ON charger_models(manufacturer);
CREATE INDEX IF NOT EXISTS idx_charger_models_connector_types ON charger_models USING GIN(connector_types);
CREATE INDEX IF NOT EXISTS idx_charger_error_codes_manufacturer ON charger_error_codes(manufacturer);
CREATE INDEX IF NOT EXISTS idx_charger_error_codes_error_code ON charger_error_codes(error_code);
CREATE INDEX IF NOT EXISTS idx_charger_error_codes_severity ON charger_error_codes(severity);
CREATE INDEX IF NOT EXISTS idx_troubleshooting_guides_category ON troubleshooting_guides(issue_category);
CREATE INDEX IF NOT EXISTS idx_compatibility_vehicle ON charger_vehicle_compatibility(vehicle_make, vehicle_model);

-- Comments
COMMENT ON TABLE charger_models IS 'Comprehensive database of 200+ EV charger models with specifications';
COMMENT ON TABLE charger_error_codes IS 'Error code definitions and troubleshooting for all charger manufacturers';
COMMENT ON TABLE troubleshooting_guides IS 'Step-by-step guides for common charger issues';
COMMENT ON TABLE charger_vehicle_compatibility IS 'Vehicle-charger compatibility matrix for optimal charging recommendations';
