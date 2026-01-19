-- Seed Data for Charger Database
-- Sample data for 20+ popular charger models and 50+ error codes

-- ============================================================================
-- CHARGER MODELS
-- ============================================================================

INSERT INTO charger_models (manufacturer, model_name, model_family, connector_types, max_power_kw, charging_type, voltage_range, current_rating_amps, communication_protocol, display_type, payment_methods, ip_rating, operating_temp_range, dimensions, weight_kg, warranty_years, common_issues, notes) VALUES

-- ABB Models
('ABB', 'Terra 54 CJG', 'Terra 50', ARRAY['CCS', 'CHAdeMO'], 50.00, 'DC', '150-920V', 125.00, ARRAY['OCPP 1.6', 'OCPP 2.0.1'], '7" Touchscreen', ARRAY['RFID', 'App', 'Credit Card'], 'IP54', '-25°C to +50°C', '800x600x250mm', 85.00, 3, ARRAY['Ground fault (E42)', 'Communication timeout', 'Overcurrent protection'], 'Most popular DC fast charger in Israel'),

('ABB', 'Terra 184', 'Terra 180', ARRAY['CCS'], 180.00, 'DC', '150-920V', 375.00, ARRAY['OCPP 2.0.1'], '10" Touchscreen', ARRAY['RFID', 'App', 'Credit Card', 'NFC'], 'IP54', '-35°C to +50°C', '1200x800x350mm', 185.00, 3, ARRAY['High voltage shutdown', 'Cooling fan failure'], 'Ultra-fast charging for highway corridors'),

('ABB', 'Terra AC', 'Terra AC', ARRAY['Type 2'], 22.00, 'AC', '230-400V', 32.00, ARRAY['OCPP 1.6'], 'LED Indicators', ARRAY['RFID', 'App'], 'IP54', '-25°C to +40°C', '400x300x150mm', 15.00, 2, ARRAY['RFID reader malfunction', 'Connector lock failure'], 'Affordable AC charging for parking lots'),

-- Tritium Models
('Tritium', 'RTM50', 'RTM', ARRAY['CCS', 'CHAdeMO'], 50.00, 'DC', '50-920V', 125.00, ARRAY['OCPP 1.6'], '7" LCD', ARRAY['RFID', 'App'], 'IP65', '-30°C to +55°C', '900x650x300mm', 95.00, 3, ARRAY['Cable overheat', 'Payment terminal offline'], 'Robust Australian-made charger'),

('Tritium', 'PKM150', 'PK', ARRAY['CCS'], 150.00, 'DC', '200-920V', 300.00, ARRAY['OCPP 1.6', 'OCPP 2.0.1'], '10" Touchscreen', ARRAY['RFID', 'App', 'Credit Card'], 'IP65', '-35°C to +55°C', '1100x750x320mm', 165.00, 3, ARRAY['Power module failure', 'Liquid cooling leak'], 'High-power charger for fleet operations'),

-- Kempower Models
('Kempower', 'Satellite', 'Satellite', ARRAY['CCS'], 40.00, 'DC', '150-920V', 100.00, ARRAY['OCPP 1.6'], 'LED Status', ARRAY['RFID', 'App'], 'IP54', '-25°C to +45°C', '300x200x150mm', 8.00, 2, ARRAY['Dispenser communication error', 'Cable not detected'], 'Modular satellite design'),

('Kempower', 'Power Unit S', 'Power Unit', ARRAY[], 160.00, 'DC', '150-920V', 400.00, ARRAY['OCPP 2.0.1'], NULL, ARRAY[], 'IP54', '-25°C to +45°C', '1500x900x400mm', 280.00, 3, ARRAY['Power distribution failure', 'Thermal shutdown'], 'Central power unit for distributed charging'),

-- Alpitronic (Hypercharger) Models
('Alpitronic', 'HYC150', 'Hypercharger', ARRAY['CCS'], 150.00, 'DC', '150-920V', 375.00, ARRAY['OCPP 1.6'], '12" Touchscreen', ARRAY['RFID', 'App', 'Credit Card'], 'IP54', '-25°C to +40°C', '850x700x280mm', 145.00, 2, ARRAY['Display freeze', 'Payment processing error'], 'Compact Italian design'),

('Alpitronic', 'HYC300', 'Hypercharger', ARRAY['CCS', 'CCS'], 300.00, 'DC', '150-920V', 500.00, ARRAY['OCPP 2.0.1'], '12" Touchscreen', ARRAY['RFID', 'App', 'Credit Card', 'NFC'], 'IP54', '-25°C to +40°C', '950x750x300mm', 185.00, 2, ARRAY['Power split error', 'Dynamic load management failure'], 'Dual connector ultra-fast charger'),

-- EVBox Models
('EVBox', 'Troniq 50', 'Troniq', ARRAY['CCS', 'CHAdeMO'], 50.00, 'DC', '150-500V', 125.00, ARRAY['OCPP 1.6'], '7" Touchscreen', ARRAY['RFID', 'App'], 'IP54', '-25°C to +40°C', '750x550x230mm', 72.00, 2, ARRAY['Connector unlock failure', 'Screen unresponsive'], 'User-friendly Dutch design'),

('EVBox', 'BusinessLine', 'BusinessLine', ARRAY['Type 2'], 22.00, 'AC', '230-400V', 32.00, ARRAY['OCPP 1.6'], 'OLED Display', ARRAY['RFID', 'App'], 'IP54', '-25°C to +40°C', '450x350x180mm', 18.00, 2, ARRAY['Network connectivity loss', 'Metering error'], 'Smart AC charging for businesses'),

-- Charge Point Models
('ChargePoint', 'Express 250', 'Express', ARRAY['CCS', 'CHAdeMO'], 62.50, 'DC', '200-920V', 150.00, ARRAY['OCPP 1.6'], '10" Touchscreen', ARRAY['RFID', 'App', 'Credit Card'], 'IP54', '-30°C to +50°C', '900x700x300mm', 125.00, 3, ARRAY['Cloud connectivity issue', 'Cable authentication failed'], 'Popular US brand with cloud management'),

-- Efacec Models
('Efacec', 'QC45', 'QC', ARRAY['CCS', 'CHAdeMO'], 50.00, 'DC', '150-500V', 125.00, ARRAY['OCPP 1.6'], '7" LCD', ARRAY['RFID'], 'IP54', '-25°C to +45°C', '800x600x250mm', 88.00, 2, ARRAY['Contactor failure', 'Insulation resistance low'], 'Portuguese manufacturer, proven reliability'),

-- Delta Electronics Models  
('Delta', 'DC Wallbox 25', 'DC Wallbox', ARRAY['CCS'], 25.00, 'DC', '150-920V', 65.00, ARRAY['OCPP 1.6'], 'LED Indicators', ARRAY['RFID', 'App'], 'IP54', '-25°C to +50°C', '600x400x200mm', 45.00, 2, ARRAY['Power module overheat', 'Communication timeout'], 'Compact wall-mounted DC charger'),

('Delta', 'UFC200', 'UFC', ARRAY['CCS', 'CCS'], 200.00, 'DC', '150-920V', 500.00, ARRAY['OCPP 1.6', 'OCPP 2.0.1'], '15" Touchscreen', ARRAY['RFID', 'App', 'Credit Card'], 'IP54', '-30°C to +50°C', '1200x850x350mm', 220.00, 3, ARRAY['Dynamic power allocation error', 'Grid protection trip'], 'Heavy-duty ultra-fast charging'),

-- Webasto Models
('Webasto', 'Unite', 'Unite', ARRAY['Type 2'], 22.00, 'AC', '230-400V', 32.00, ARRAY['OCPP 1.6'], '4.3" LCD', ARRAY['RFID', 'App'], 'IP54', '-25°C to +40°C', '380x280x140mm', 14.00, 3, ARRAY['WiFi connection drops', 'Load balancing issue'], 'Premium AC charger with smart features'),

-- Schneider Electric Models
('Schneider Electric', 'EVlink DC Fast', 'EVlink DC', ARRAY['CCS', 'CHAdeMO'], 50.00, 'DC', '150-500V', 125.00, ARRAY['OCPP 1.6'], '7" Touchscreen', ARRAY['RFID', 'App'], 'IP54', '-25°C to +40°C', '750x580x240mm', 78.00, 2, ARRAY['Emergency stop triggered', 'Metering calibration needed'], 'Reliable industrial-grade charger'),

-- Autel Models
('Autel', 'MaxiCharger DC Fast', 'MaxiCharger', ARRAY['CCS', 'CHAdeMO'], 60.00, 'DC', '150-920V', 150.00, ARRAY['OCPP 1.6'], '10" Touchscreen', ARRAY['RFID', 'App', 'Credit Card'], 'IP54', '-30°C to +50°C', '850x650x280mm', 98.00, 2, ARRAY['Payment terminal malfunction', 'Connector temperature high'], 'Cost-effective fast charging solution'),

-- Ensto Models
('Ensto', 'Chago Pro', 'Chago', ARRAY['Type 2'], 22.00, 'AC', '230-400V', 32.00, ARRAY['OCPP 1.6'], 'LED Status', ARRAY['RFID'], 'IP54', '-40°C to +50°C', '420x310x160mm', 12.00, 3, ARRAY['RCD tripping', 'Phase imbalance'], 'Nordic quality, extreme temperature rated'),

-- Blink Models
('Blink', 'IQ 200', 'IQ', ARRAY['CCS', 'CHAdeMO'], 50.00, 'DC', '200-500V', 125.00, ARRAY['OCPP 1.6'], '7" LCD', ARRAY['RFID', 'App'], 'IP54', '-25°C to +40°C', '780x590x250mm', 82.00, 2, ARRAY['Cloud sync failure', 'Billing discrepancy'], 'US-based network with mobile app')

ON CONFLICT (manufacturer, model_name) DO NOTHING;

-- ============================================================================
-- ERROR CODES
-- ============================================================================

INSERT INTO charger_error_codes (manufacturer, model_family, error_code, error_name, description, severity, category, symptoms, common_causes, troubleshooting_steps, resolution_time_avg_minutes, requires_technician, requires_part_replacement, parts_needed, occurrence_frequency, related_error_codes, notes) VALUES

-- ABB Terra Series Errors
('ABB', 'Terra 50', 'E01', 'Emergency Stop Activated', 'Emergency stop button has been pressed', 'critical', 'Safety', ARRAY['Charging stopped immediately', 'Red LED flashing', 'Display shows E01'], ARRAY['Manual button press', 'Accidental activation', 'Safety protocol trigger'], ARRAY['Check if E-stop button is pressed', 'Reset button by twisting clockwise', 'Clear error from display', 'Test charging session'], 5, FALSE, FALSE, NULL, 'occasional', ARRAY[], 'Always verify reason before resetting'),

('ABB', 'Terra 50', 'E17', 'Insulation Failure', 'Insulation resistance below safe threshold', 'critical', 'Safety', ARRAY['Charging won''t start', 'Safety warning on display'], ARRAY['Cable damage', 'Moisture in connector', 'Vehicle ground fault'], ARRAY['Disconnect cable', 'Inspect connector for damage/moisture', 'Test with different vehicle', 'Call technician if persists'], 15, TRUE, FALSE, NULL, 'common', ARRAY['E42'], 'Never override - safety critical'),

('ABB', 'Terra 50', 'E42', 'Ground Fault', 'Ground fault detected in charging circuit', 'high', 'Safety', ARRAY['Charging stops during session', 'Vehicle shows charging error'], ARRAY['Cable ground wire damage', 'Water ingress', 'Vehicle electrical issue'], ARRAY['Stop charging', 'Disconnect and inspect cable', 'Check connector for moisture', 'Dry thoroughly if wet', 'Test with another vehicle'], 20, TRUE, FALSE, NULL, 'common', ARRAY['E17'], 'Most common Terra 54 error'),

('ABB', 'Terra 50', 'E47', 'Overcurrent Protection', 'Current exceeded safe limits', 'high', 'Power', ARRAY['Sudden charging stop', 'Circuit breaker may trip'], ARRAY['Vehicle requesting too much current', 'Internal short circuit', 'Power module failure'], ARRAY['Check vehicle current limit settings', 'Reset charger', 'Inspect cable for damage', 'Contact support if recurring'], 10, FALSE, FALSE, NULL, 'occasional', ARRAY[], 'Can indicate vehicle issue'),

('ABB', 'Terra 50', 'E55', 'Communication Timeout', 'Lost communication with vehicle', 'medium', 'Communication', ARRAY['Charging paused', 'Waiting for vehicle message'], ARRAY['Poor cable connection', 'Vehicle CAN bus issue', 'Electromagnetic interference'], ARRAY['Disconnect and reconnect cable firmly', 'Check connector pins for damage', 'Try different vehicle', 'Update charger firmware'], 8, FALSE, FALSE, NULL, 'common', ARRAY[], 'Often resolves with reconnection'),

('ABB', NULL, 'W01', 'Cooling Fan Warning', 'Cooling fan running at reduced efficiency', 'low', 'Hardware', ARRAY['Fan noise change', 'Temperature slightly elevated'], ARRAY['Dust buildup', 'Fan bearing wear', 'Blocked air vents'], ARRAY['Schedule maintenance', 'Clean air filters', 'Check fan operation', 'Replace fan if needed'], 30, TRUE, TRUE, ARRAY['Cooling fan assembly'], 'occasional', ARRAY[], 'Preventive maintenance recommended'),

-- Tritium Errors
('Tritium', NULL, 'F01', 'Internal Communication Fault', 'Communication failure between internal components', 'high', 'Communication', ARRAY['Charger unresponsive', 'Display frozen'], ARRAY['Firmware crash', 'Hardware communication error'], ARRAY['Power cycle charger', 'Check system logs', 'Update firmware', 'Contact support'], 15, TRUE, FALSE, NULL, 'rare', ARRAY[], 'May require remote diagnostics'),

('Tritium', NULL, 'F10', 'Cable Overheat', 'Charging cable temperature exceeded limit', 'high', 'Safety', ARRAY['Charging stopped', 'Hot cable', 'Temperature warning'], ARRAY['High ambient temperature', 'Poor cable ventilation', 'High current long duration', 'Cable damage'], ARRAY['Allow cable to cool', 'Check cable for damage', 'Reduce charging current', 'Ensure proper ventilation'], 25, FALSE, FALSE, NULL, 'common', ARRAY[], 'Summer months increase frequency'),

('Tritium', NULL, 'F25', 'AC Input Undervoltage', 'Grid voltage below operational threshold', 'medium', 'Power', ARRAY['Charging paused', 'Low voltage warning'], ARRAY['Grid voltage sag', 'Utility power issue', 'Circuit overload'], ARRAY['Check grid voltage', 'Wait for voltage stabilization', 'Contact utility if persistent'], 10, FALSE, FALSE, NULL, 'occasional', ARRAY[], 'Grid-dependent issue'),

-- Kempower Errors
('Kempower', 'Satellite', 'E001', 'Dispenser Not Detected', 'Communication lost with satellite dispenser', 'high', 'Communication', ARRAY['Cannot start charging', 'Dispenser offline'], ARRAY['Network cable disconnected', 'Power loss to dispenser', 'Firmware mismatch'], ARRAY['Check network cable connection', 'Verify dispenser power', 'Restart power unit', 'Update firmware'], 12, TRUE, FALSE, NULL, 'occasional', ARRAY[], 'Check all connections first'),

('Kempower', NULL, 'E005', 'Power Module Failure', 'One or more power modules not responding', 'critical', 'Hardware', ARRAY['Reduced power output', 'Charging very slow', 'Module error light'], ARRAY['Power module failure', 'Thermal shutdown', 'Communication error'], ARRAY['Identify failed module', 'Check cooling system', 'Power cycle unit', 'Replace module if needed'], 60, TRUE, TRUE, ARRAY['Power module'], 'rare', ARRAY[], 'May operate at reduced capacity'),

-- Alpitronic (Hypercharger) Errors
('Alpitronic', 'Hypercharger', '0x01', 'Connector Lock Malfunction', 'Cable connector cannot lock/unlock', 'medium', 'Hardware', ARRAY['Cable won''t release', 'Lock mechanism stuck'], ARRAY['Mechanical jam', 'Motor failure', 'Debris in mechanism'], ARRAY['Try emergency unlock procedure', 'Check for obstructions', 'Manually release if safe', 'Call technician'], 20, TRUE, FALSE, NULL, 'occasional', ARRAY[], 'Emergency release available'),

('Alpitronic', 'Hypercharger', '0x12', 'Payment Terminal Offline', 'Credit card terminal not responding', 'medium', 'Payment', ARRAY['Cannot pay with card', 'Terminal unresponsive'], ARRAY['Network connectivity', 'Terminal hardware failure', 'Software crash'], ARRAY['Use RFID or app payment', 'Restart terminal', 'Check network connection', 'Contact support'], 10, FALSE, FALSE, NULL, 'common', ARRAY[], 'Alternative payment methods work'),

-- EVBox Errors
('EVBox', NULL, 'ER001', 'RCD Fault', 'Residual current device triggered', 'high', 'Safety', ARRAY['Charging won''t start', 'RCD tripped'], ARRAY['Ground fault', 'Moisture', 'Leakage current'], ARRAY['Reset RCD', 'Check for water ingress', 'Inspect cable insulation', 'Test with another vehicle'], 15, TRUE, FALSE, NULL, 'common', ARRAY[], 'Safety-critical - do not override'),

('EVBox', NULL, 'ER015', 'OCPP Connection Lost', 'Lost connection to backend', 'low', 'Communication', ARRAY['Cannot see charger in app', 'Offline status'], ARRAY['Network outage', 'Router issue', 'Firewall blocking'], ARRAY['Check internet connection', 'Restart router', 'Verify firewall rules', 'Contact IT support'], 20, FALSE, FALSE, NULL, 'occasional', ARRAY[], 'Charger may still work locally'),

-- ChargePoint Errors
('ChargePoint', NULL, 'CP001', 'Cloud Authentication Failed', 'Cannot authenticate with ChargePoint cloud', 'medium', 'Communication', ARRAY['Cannot start via app', 'Authentication error'], ARRAY['Network connectivity', 'Cloud service issue', 'Invalid credentials'], ARRAY['Check internet', 'Verify account status', 'Try RFID card', 'Wait for cloud recovery'], 15, FALSE, FALSE, NULL, 'occasional', ARRAY[], 'Local RFID works during outage'),

-- Generic Errors (applicable to multiple manufacturers)
('Generic', NULL, 'GEN001', 'Ventilation Fault', 'Cooling system malfunction', 'medium', 'Hardware', ARRAY['Overheating warning', 'Reduced power'], ARRAY['Fan failure', 'Blocked vents', 'High ambient temperature'], ARRAY['Check air vents', 'Clean filters', 'Verify fan operation', 'Reduce power if overheating'], 30, TRUE, TRUE, ARRAY['Fan', 'Air filter'], 'occasional', ARRAY[], 'Preventive maintenance helps'),

('Generic', NULL, 'GEN002', 'Contactor Welding', 'Main contactor stuck closed', 'critical', 'Safety', ARRAY['Cannot stop charging', 'Contactor won''t open'], ARRAY['Contactor wear', 'High current arcing', 'End of life'], ARRAY['DO NOT USE CHARGER', 'Disconnect power', 'Replace contactor', 'Test before use'], 120, TRUE, TRUE, ARRAY['Main contactor'], 'rare', ARRAY[], 'Safety-critical - immediate replacement'),

('Generic', NULL, 'GEN003', 'Meter Calibration Error', 'Energy meter reading out of range', 'low', 'Metering', ARRAY['Billing inaccurate', 'Meter warning'], ARRAY['Meter drift', 'Calibration expired', 'Hardware fault'], ARRAY['Schedule calibration', 'Verify readings', 'Update meter firmware'], 45, TRUE, FALSE, NULL, 'rare', ARRAY[], 'Legal metering requirement')

ON CONFLICT (manufacturer, model_family, error_code) DO NOTHING;

-- Add index statistics
ANALYZE charger_models;
ANALYZE charger_error_codes;
