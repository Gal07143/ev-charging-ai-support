-- Seed Data for Edge Control Support Bot
-- This file populates the database with initial test data

-- ============================================
-- CHARGER SPECIFICATIONS (Sample Data)
-- ============================================
INSERT OR IGNORE INTO charger_specifications (
  charger_id, manufacturer, model_name, power_rating_kw,
  connector_types, ocpp_version, firmware_version, network_type
) VALUES
  ('CH001', 'ABB', 'Terra 184', 180, '["CCS2", "CHAdeMO"]', '1.6', 'v2.1.5', '4G'),
  ('CH002', 'ABB', 'Terra 54', 50, '["CCS2", "CHAdeMO", "Type2"]', '1.6', 'v2.0.3', '4G'),
  ('CH003', 'ChargePoint', 'Express 250', 62.5, '["CCS1", "CHAdeMO"]', '1.6', 'v1.8.2', '4G'),
  ('CH004', 'EVBox', 'Troniq 100', 100, '["CCS2"]', '2.0', 'v3.2.1', '4G/WiFi'),
  ('CH005', 'Tritium', 'RTM75', 75, '["CCS2", "CHAdeMO"]', '1.6', 'v4.1.0', '4G');

-- ============================================
-- KNOWLEDGE BASE ARTICLES (Hebrew)
-- ============================================
INSERT OR IGNORE INTO knowledge_base (
  article_id, title_he, content_he, category, language, search_vector
) VALUES
  ('KB001', 'כיצד לאתחל עמדת טעינה', 
   'לאיפוס עמדת טעינה: 1. נתק את הכבל מהרכב. 2. לחץ על כפתור העצירה החירום. 3. המתן 30 שניות. 4. לחץ שוב על כפתור העצירה. 5. התחל טעינה מחדש.',
   'troubleshooting', 'he', 'אתחל עמדת טעינה איפוס כפתור עצירה חירום'),
  
  ('KB002', 'שגיאה: כבל נעול',
   'כאשר הכבל נעול ברכב: 1. נסה לנעול ולפתוח את הרכב. 2. לחץ על כפתור שחרור בעמדה. 3. אם לא עוזר, התקשר לתמיכה טכנית.',
   'troubleshooting', 'he', 'כבל נעול שגיאה שחרור נעילה'),
  
  ('KB003', 'סוגי מחברים',
   'סוגי מחברים נפוצים: CCS2 (רכבים אירופאים), CHAdeMO (ניסאן, מיצובישי), Type 2 (טעינה איטית), CCS1 (ארה"ב).',
   'info', 'he', 'מחברים CCS CHAdeMO Type2'),
  
  ('KB004', 'מהירות טעינה',
   'מהירות טעינה תלויה ב: 1. כושר טעינה של הרכב. 2. הספק העמדה. 3. רמת הסוללה הנוכחית. 4. טמפרטורת הסוללה.',
   'info', 'he', 'מהירות טעינה הספק סוללה'),
  
  ('KB005', 'תעריפי טעינה',
   'תעריפים משתנים לפי: 1. זמן היום. 2. מיקום העמדה. 3. סוג החברות. בדוק באפליקציה לתעריף עדכני.',
   'billing', 'he', 'תעריפים מחירים עלויות תשלום');

-- ============================================
-- EV VEHICLE MODELS (Sample Data)
-- ============================================
INSERT OR IGNORE INTO ev_vehicle_models (
  model_id, manufacturer, model_name, model_year,
  battery_capacity_kwh, max_dc_charge_rate_kw, max_ac_charge_rate_kw,
  connector_type_dc, connector_type_ac
) VALUES
  ('EV001', 'Tesla', 'Model 3', 2024, 60, 250, 11, 'CCS2', 'Type2'),
  ('EV002', 'Tesla', 'Model Y', 2024, 75, 250, 11, 'CCS2', 'Type2'),
  ('EV003', 'Hyundai', 'Ioniq 5', 2024, 77.4, 220, 11, 'CCS2', 'Type2'),
  ('EV004', 'Nissan', 'Leaf', 2024, 62, 100, 6.6, 'CHAdeMO', 'Type2'),
  ('EV005', 'Volkswagen', 'ID.4', 2024, 77, 135, 11, 'CCS2', 'Type2'),
  ('EV006', 'BMW', 'iX3', 2024, 80, 150, 11, 'CCS2', 'Type2'),
  ('EV007', 'Audi', 'e-tron', 2024, 95, 150, 11, 'CCS2', 'Type2');

-- ============================================
-- VEHICLE-CHARGER COMPATIBILITY
-- ============================================
INSERT OR IGNORE INTO vehicle_charger_compatibility (
  vehicle_model_id, charger_id, compatibility_status, max_charge_rate_kw
) VALUES
  ('EV001', 'CH001', 'compatible', 180),
  ('EV001', 'CH002', 'compatible', 50),
  ('EV002', 'CH001', 'compatible', 180),
  ('EV003', 'CH001', 'compatible', 180),
  ('EV004', 'CH001', 'partially_compatible', 100),
  ('EV004', 'CH002', 'compatible', 50);

-- ============================================
-- DIAGNOSTIC PATTERNS (Common Issues)
-- ============================================
INSERT OR IGNORE INTO diagnostic_patterns (
  pattern_name, error_codes, symptoms, solution_steps, success_rate
) VALUES
  ('Cable Lock Failure', '["ERR_CABLE_LOCK"]', 
   'כבל נעול ברכב, לא ניתן להוציא', 
   '1. נעל את הרכב\n2. לחץ על כפתור שחרור\n3. נסה שוב', 
   0.85),
  
  ('Communication Error', '["ERR_COMM_TIMEOUT", "ERR_NO_RESPONSE"]',
   'העמדה לא מתקשרת עם הרכב',
   '1. נתק כבל\n2. המתן 30 שניות\n3. חבר מחדש',
   0.75),
  
  ('Overheating', '["ERR_TEMP_HIGH"]',
   'טמפרטורה גבוהה מדי בעמדה',
   '1. עצור טעינה\n2. המתן לקירור\n3. התחל מחדש',
   0.90);

-- ============================================
-- CONVERSATION QUALITY TEMPLATES
-- ============================================
INSERT OR IGNORE INTO quality_scoring_criteria (
  criteria_name, weight, description
) VALUES
  ('Response Time', 0.2, 'זמן תגובה ממוצע'),
  ('Issue Resolution', 0.3, 'האם הבעיה נפתרה'),
  ('User Satisfaction', 0.3, 'שביעות רצון משוב'),
  ('Tool Usage', 0.1, 'שימוש נכון בכלים'),
  ('Conversation Length', 0.1, 'אורך שיחה סביר');

-- ============================================
-- RESPONSE TEMPLATES (Multi-language)
-- ============================================
INSERT OR IGNORE INTO response_templates (
  template_id, category, language, template_text, sentiment_tone
) VALUES
  ('GREET_HE', 'greeting', 'he', 'שלום! איך אוכל לעזור לך היום?', 'positive'),
  ('GREET_EN', 'greeting', 'en', 'Hello! How can I help you today?', 'positive'),
  ('GREET_RU', 'greeting', 'ru', 'Здравствуйте! Как я могу помочь вам сегодня?', 'positive'),
  ('GREET_AR', 'greeting', 'ar', 'مرحبا! كيف يمكنني مساعدتك اليوم؟', 'positive'),
  
  ('RESOLVED_HE', 'resolution', 'he', 'מעולה! שמח לעזור. יש לך שאלות נוספות?', 'positive'),
  ('RESOLVED_EN', 'resolution', 'en', 'Great! Happy to help. Any other questions?', 'positive'),
  
  ('ESCALATE_HE', 'escalation', 'he', 'אני מעביר אותך לטכנאי מומחה. אנא המתן...', 'neutral'),
  ('ESCALATE_EN', 'escalation', 'en', 'I am transferring you to a specialist. Please wait...', 'neutral');

-- ============================================
-- SAMPLE ANALYTICS DATA (for testing)
-- ============================================
INSERT OR IGNORE INTO tool_usage (
  tool_name, thread_id, user_id, execution_time_ms, success, error_message
) VALUES
  ('checkChargerStatus', 'thread-test-001', 'user-001', 250, 1, NULL),
  ('searchKnowledgeBase', 'thread-test-001', 'user-001', 180, 1, NULL),
  ('remoteChargerReset', 'thread-test-002', 'user-002', 1200, 1, NULL),
  ('getEVCompatibility', 'thread-test-003', 'user-003', 320, 1, NULL);

-- ============================================
-- SEED COMPLETE
-- ============================================
SELECT 'Seed data loaded successfully!' as result;
