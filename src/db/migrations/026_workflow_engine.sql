-- Migration: Multi-Step Workflow Engine
-- Created: 2026-01-19
-- Scope: Complex workflow orchestration, step-by-step guidance, conditional logic
--
-- Features:
-- - Define multi-step diagnostic workflows
-- - Track user progress through workflows
-- - Conditional branching based on responses
-- - Workflow templates for common issues

-- Workflow definitions
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workflow_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  steps TEXT NOT NULL,                     -- JSON: array of steps with conditions
  is_active BOOLEAN DEFAULT 1,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workflow executions
CREATE TABLE IF NOT EXISTS workflow_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL UNIQUE,
  workflow_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  user_id TEXT,
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress',       -- in_progress, completed, abandoned
  step_history TEXT,                       -- JSON: array of completed steps
  collected_data TEXT,                     -- JSON: collected responses
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(workflow_id)
);

-- Workflow analytics
CREATE TABLE IF NOT EXISTS workflow_analytics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL,
  workflow_id TEXT NOT NULL,
  executions_started INTEGER DEFAULT 0,
  executions_completed INTEGER DEFAULT 0,
  avg_completion_time_minutes REAL,
  avg_steps_completed REAL,
  UNIQUE (date, workflow_id)
);

-- Seed common workflows
INSERT OR IGNORE INTO workflow_definitions (workflow_id, name, description, category, steps) VALUES
  ('wf_charging_not_starting', 'Charging Not Starting', 'Step-by-step troubleshooting for charging issues', 'charging', 
   '[{"step":1,"question":"Is the cable properly connected?","type":"yes_no","next_yes":2,"next_no":"solution_check_cable"},{"step":2,"question":"Do you see any error codes on the display?","type":"yes_no","next_yes":"collect_error","next_no":3}]');
