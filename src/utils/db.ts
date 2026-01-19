/**
 * Shared Database Connection Manager
 * Provides a single database connection for all modules
 */

import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

/**
 * Get or create database connection
 */
export function getDatabase(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_URL || 
      path.join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/edge-control-db.sqlite');
    
    try {
      db = new Database(dbPath);
      console.log('✅ Database connected:', dbPath);
      
      // Enable WAL mode for better concurrency
      db.pragma('journal_mode = WAL');
      
      // Enable foreign keys
      db.pragma('foreign_keys = ON');
      
    } catch (error) {
      console.warn('⚠️  Database not found, using in-memory fallback');
      db = new Database(':memory:');
    }
  }
  
  return db;
}

/**
 * Close database connection (for graceful shutdown)
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return db !== null && db.open;
}
