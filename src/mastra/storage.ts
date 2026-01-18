import { PostgresMemory } from '@mastra/memory';
import { Pool } from 'pg';

// PostgreSQL connection pool
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Initialize Mastra PostgreSQL memory store
export const memory = new PostgresMemory({
  pool: pgPool,
});

// Test database connection
export async function testDatabaseConnection() {
  try {
    const client = await pgPool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
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
    
    client.release();
    console.log('✅ Database schema initialized');
    return true;
  } catch (error) {
    console.error('❌ Database schema initialization failed:', error);
    return false;
  }
}
