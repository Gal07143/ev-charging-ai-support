-- Workflow Sessions and Analytics
-- Track diagnostic workflow executions, steps, and outcomes

-- Workflow Sessions Table
CREATE TABLE IF NOT EXISTS workflow_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  current_step_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'escalated', 'abandoned')),
  context JSONB DEFAULT '{}',
  step_history JSONB DEFAULT '[]',
  escalation_reason TEXT,
  resolution TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Workflow Analytics Table
CREATE TABLE IF NOT EXISTS workflow_analytics (
  id SERIAL PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  duration_seconds INTEGER,
  steps_taken INTEGER,
  completed_at TIMESTAMP DEFAULT NOW()
);

-- Workflow Step Analytics Table
CREATE TABLE IF NOT EXISTS workflow_step_analytics (
  id SERIAL PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  executions INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  avg_time_seconds INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_workflow_sessions_user_id ON workflow_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_sessions_workflow_id ON workflow_sessions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_sessions_status ON workflow_sessions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_analytics_workflow_id ON workflow_analytics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_analytics_workflow_step ON workflow_step_analytics(workflow_id, step_id);

-- Comments
COMMENT ON TABLE workflow_sessions IS 'Active and completed diagnostic workflow sessions';
COMMENT ON TABLE workflow_analytics IS 'Aggregated metrics for workflow success tracking';
COMMENT ON TABLE workflow_step_analytics IS 'Per-step success rates and timing';
COMMENT ON COLUMN workflow_sessions.context IS 'Store user inputs, tool results, and session data';
COMMENT ON COLUMN workflow_sessions.step_history IS 'Array of step executions with timestamps';
