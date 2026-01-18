import client from 'prom-client';

// Create registry
export const register = new client.Registry();

// Default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics

// Discord messages processed
export const messagesProcessed = new client.Counter({
  name: 'discord_messages_processed_total',
  help: 'Total Discord messages processed',
  labelNames: ['status'],
  registers: [register],
});

// Agent response time
export const agentResponseTime = new client.Histogram({
  name: 'agent_response_time_seconds',
  help: 'Agent response generation time',
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

// Tool usage counter
export const toolUsage = new client.Counter({
  name: 'ampeco_tool_usage_total',
  help: 'Ampeco tool usage count',
  labelNames: ['tool', 'status'],
  registers: [register],
});

// Ampeco API requests
export const ampecoApiRequests = new client.Counter({
  name: 'ampeco_api_requests_total',
  help: 'Total Ampeco API requests',
  labelNames: ['method', 'endpoint', 'status'],
  registers: [register],
});

// Ampeco API response time
export const ampecoApiDuration = new client.Histogram({
  name: 'ampeco_api_duration_seconds',
  help: 'Ampeco API request duration',
  buckets: [0.1, 0.5, 1, 2, 5],
  labelNames: ['method', 'endpoint'],
  registers: [register],
});

// Active conversations
export const activeConversations = new client.Gauge({
  name: 'active_conversations_total',
  help: 'Current number of active conversations',
  registers: [register],
});

// Database connections
export const databaseConnections = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

// Rate limit violations
export const rateLimitViolations = new client.Counter({
  name: 'rate_limit_violations_total',
  help: 'Total rate limit violations',
  labelNames: ['user_id'],
  registers: [register],
});

// Failed conversations
export const failedConversations = new client.Counter({
  name: 'failed_conversations_total',
  help: 'Total failed conversations requiring human intervention',
  labelNames: ['reason'],
  registers: [register],
});

// Cache hit/miss
export const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});
