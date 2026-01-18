import { PostgresMemory } from '@mastra/memory';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

// PostgreSQL connection pool with optimized settings
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 20,                    // Maximum number of clients in the pool
  min: 2,                     // Minimum number of clients to maintain
  idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000,  // Timeout for acquiring connection
  maxUses: 7500,              // Recycle connection after 7500 uses
  allowExitOnIdle: false,     // Don't exit process when all clients idle
});

// Initialize Mastra PostgreSQL memory store
export const memory = new PostgresMemory({
  pool: pgPool,
});

// Test database connection
export async function testDatabaseConnection() {
  try {
    const client = await pgPool.connect();
    logger.info('✅ PostgreSQL connected successfully');
    client.release();
    return true;
  } catch (error) {
    logger.error({ error }, '❌ PostgreSQL connection failed');
    return false;
  }
}

// Initialize database schema for memory storage
export async function initializeDatabase() {
  try {
    const client = await pgPool.connect();
    
    // Create tables for conversation memory
    await client.query(`
      CREATE TABLE IF NOT EXISTS mastra_memory (
        id SERIAL PRIMARY KEY,
        thread_id VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_thread_id ON mastra_memory(thread_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON mastra_memory(created_at);
    `);
    
    // Create table for tracking failed conversations
    await client.query(`
      CREATE TABLE IF NOT EXISTS failed_conversations (
        id SERIAL PRIMARY KEY,
        thread_id VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        issue_description TEXT NOT NULL,
        conversation_context JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_failed_thread_id ON failed_conversations(thread_id);
    `);
    
    // Create table for rate limiting
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        user_id VARCHAR(255) PRIMARY KEY,
        message_count INTEGER DEFAULT 0,
        window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create table for multi-channel configuration
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_config (
        channel_id VARCHAR(255) PRIMARY KEY,
        guild_id VARCHAR(255) NOT NULL,
        language VARCHAR(10) DEFAULT 'he',
        ampeco_tenant_url VARCHAR(255),
        features JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_channel_guild ON channel_config(guild_id);
      CREATE INDEX IF NOT EXISTS idx_channel_active ON channel_config(is_active);
    `);
    
    // Create table for conversation sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_sessions (
        thread_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        channel_id VARCHAR(255) NOT NULL,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        is_expired BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_session_user ON conversation_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_session_activity ON conversation_sessions(last_activity);
    `);
    
    client.release();
    logger.info('✅ Database schema initialized');
    return true;
  } catch (error) {
    logger.error({ error }, '❌ Database schema initialization failed');
    return false;
  }
}
