/**
 * Caching Service with Circuit Breaker Pattern
 * Implements offline mode, response caching, and graceful degradation
 * 
 * Features:
 * - KV-based caching (Cloudflare Workers compatible)
 * - Circuit breaker pattern for external services
 * - Graceful degradation with stale data
 * - TTL management and cache invalidation
 * - Cache hit/miss analytics
 */

import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

// ============================================================================
// Types
// ============================================================================

export interface CacheOptions {
  ttl?: number; // Seconds
  type?: string; // Cache type
  sourceType?: string;
  sourceIdentifier?: string;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  failure_count: number;
  success_count: number;
  last_failure_at?: string;
}

export interface CachedData<T = any> {
  data: T;
  cached_at: string;
  expires_at: string;
  is_stale: boolean;
}

// ============================================================================
// Caching Service
// ============================================================================

export class CachingService {
  private readonly DEFAULT_TTL = 3600; // 1 hour
  
  constructor(
    private db: D1Database,
    private kv: KVNamespace
  ) {}

  /**
   * Get data from cache or execute function with circuit breaker
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {},
    serviceName?: string
  ): Promise<T> {
    const startTime = Date.now();
    
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached && !cached.is_stale) {
      // Cache hit
      await this.logAccess(key, 'hit', Date.now() - startTime);
      return cached.data;
    }
    
    // Check circuit breaker before calling external service
    if (serviceName) {
      const canProceed = await this.checkCircuitBreaker(serviceName);
      if (!canProceed) {
        // Circuit is open - serve stale data if available
        if (cached) {
          await this.logAccess(key, 'hit', Date.now() - startTime, true);
          console.log(`Circuit breaker open for ${serviceName}, serving stale cache`);
          return cached.data;
        }
        throw new Error(`Service ${serviceName} is unavailable (circuit breaker open)`);
      }
    }
    
    // Cache miss - fetch fresh data
    try {
      const data = await fetchFn();
      const fetchTime = Date.now() - startTime;
      
      // Store in cache
      await this.set(key, data, options);
      
      // Log cache miss
      await this.logAccess(key, 'miss', fetchTime, false);
      
      // Record success for circuit breaker
      if (serviceName) {
        await this.recordCircuitBreakerSuccess(serviceName);
      }
      
      return data;
    } catch (error: any) {
      // Record failure for circuit breaker
      if (serviceName) {
        await this.recordCircuitBreakerFailure(serviceName, error.message);
      }
      
      // If we have stale data, use it as fallback
      if (cached) {
        await this.logAccess(key, 'hit', Date.now() - startTime, true);
        console.log(`Error fetching fresh data, serving stale cache: ${error.message}`);
        return cached.data;
      }
      
      throw error;
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<CachedData<T> | null> {
    try {
      // Get from KV
      const kvData = await this.kv.get(key, { type: 'json' });
      if (!kvData) {
        return null;
      }
      
      const cached = kvData as CachedData<T>;
      
      // Check if expired
      const now = new Date();
      const expiresAt = new Date(cached.expires_at);
      const isStale = now > expiresAt;
      
      return {
        ...cached,
        is_stale: isStale
      };
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || this.DEFAULT_TTL;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);
    
    const cached: CachedData<T> = {
      data,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      is_stale: false
    };
    
    try {
      // Store in KV with TTL
      await this.kv.put(key, JSON.stringify(cached), {
        expirationTtl: ttl
      });
      
      // Store metadata in D1
      const dataStr = JSON.stringify(data);
      const contentHash = await this.generateHash(dataStr);
      const preview = dataStr.substring(0, 200);
      
      await this.db
        .prepare(`
          INSERT INTO cache_entries (
            cache_key, cache_type, content_hash, content_size, content_preview,
            ttl_seconds, expires_at, source_type, source_identifier, is_valid
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON CONFLICT (cache_key) DO UPDATE SET
            content_hash = excluded.content_hash,
            content_size = excluded.content_size,
            content_preview = excluded.content_preview,
            expires_at = excluded.expires_at,
            is_stale = 0,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(
          key,
          options.type || 'default',
          contentHash,
          dataStr.length,
          preview,
          ttl,
          expiresAt.toISOString(),
          options.sourceType || null,
          options.sourceIdentifier || null
        )
        .run();
    } catch (error) {
      console.error('Cache set error:', error);
      throw error;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(key);
      await this.db
        .prepare('DELETE FROM cache_entries WHERE cache_key = ?')
        .bind(key)
        .run();
      
      await this.logAccess(key, 'invalidate', 0);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Mark cache entry as stale (for refresh)
   */
  async markStale(key: string): Promise<void> {
    await this.db
      .prepare('UPDATE cache_entries SET is_stale = 1, updated_at = CURRENT_TIMESTAMP WHERE cache_key = ?')
      .bind(key)
      .run();
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    // Get all matching keys from D1
    const result = await this.db
      .prepare('SELECT cache_key FROM cache_entries WHERE cache_key LIKE ?')
      .bind(pattern.replace('*', '%'))
      .all<{ cache_key: string }>();
    
    let count = 0;
    for (const row of result.results || []) {
      await this.delete(row.cache_key);
      count++;
    }
    
    return count;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    const stats = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as total_entries,
          SUM(hit_count) as total_hits,
          SUM(content_size) as total_size_bytes,
          AVG(hit_count) as avg_hits_per_entry,
          (SELECT COUNT(*) FROM cache_entries WHERE is_stale = 1) as stale_entries,
          (SELECT COUNT(*) FROM cache_entries WHERE datetime('now') > expires_at) as expired_entries
        FROM cache_entries
        WHERE is_valid = 1
      `)
      .first<any>();
    
    // Get hit rate from last hour
    const hitRate = await this.db
      .prepare(`
        SELECT 
          SUM(CASE WHEN access_type = 'hit' THEN 1 ELSE 0 END) as hits,
          SUM(CASE WHEN access_type = 'miss' THEN 1 ELSE 0 END) as misses,
          COUNT(*) as total
        FROM cache_access_logs
        WHERE created_at > datetime('now', '-1 hour')
      `)
      .first<any>();
    
    return {
      ...stats,
      hit_rate_percent: hitRate && hitRate.total > 0 
        ? ((hitRate.hits / hitRate.total) * 100).toFixed(2)
        : 0
    };
  }

  // ============================================================================
  // Circuit Breaker Methods
  // ============================================================================

  /**
   * Check if circuit breaker allows request
   */
  async checkCircuitBreaker(serviceName: string): Promise<boolean> {
    const state = await this.getCircuitBreakerState(serviceName);
    
    if (state.state === 'closed') {
      return true;
    }
    
    if (state.state === 'open') {
      // Check if timeout has passed
      const result = await this.db
        .prepare(`
          SELECT 
            CAST((JULIANDAY('now') - JULIANDAY(opened_at)) * 86400 AS INTEGER) as seconds_open,
            timeout_seconds
          FROM circuit_breaker_states
          WHERE service_name = ?
        `)
        .bind(serviceName)
        .first<{ seconds_open: number; timeout_seconds: number }>();
      
      if (result && result.seconds_open >= result.timeout_seconds) {
        // Move to half-open
        await this.setCircuitBreakerState(serviceName, 'half_open');
        return true;
      }
      
      return false; // Still open
    }
    
    // half_open state - allow request
    return true;
  }

  /**
   * Get circuit breaker state
   */
  async getCircuitBreakerState(serviceName: string): Promise<CircuitBreakerState> {
    const result = await this.db
      .prepare('SELECT * FROM circuit_breaker_states WHERE service_name = ?')
      .bind(serviceName)
      .first<any>();
    
    if (!result) {
      // Create new circuit breaker
      await this.db
        .prepare(`
          INSERT INTO circuit_breaker_states (service_name, state)
          VALUES (?, 'closed')
        `)
        .bind(serviceName)
        .run();
      
      return { state: 'closed', failure_count: 0, success_count: 0 };
    }
    
    return {
      state: result.state,
      failure_count: result.failure_count,
      success_count: result.success_count,
      last_failure_at: result.last_failure_at
    };
  }

  /**
   * Record circuit breaker success
   */
  async recordCircuitBreakerSuccess(serviceName: string): Promise<void> {
    const state = await this.getCircuitBreakerState(serviceName);
    
    await this.db
      .prepare(`
        UPDATE circuit_breaker_states
        SET 
          success_count = success_count + 1,
          failure_count = 0,
          last_success_at = CURRENT_TIMESTAMP,
          total_requests = total_requests + 1,
          total_successes = total_successes + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE service_name = ?
      `)
      .bind(serviceName)
      .run();
    
    // Log event
    await this.logCircuitBreakerEvent(serviceName, 'success', state.state, state.state);
    
    // Check if should close circuit (from half_open)
    if (state.state === 'half_open') {
      const updated = await this.getCircuitBreakerState(serviceName);
      const threshold = await this.db
        .prepare('SELECT success_threshold FROM circuit_breaker_states WHERE service_name = ?')
        .bind(serviceName)
        .first<{ success_threshold: number }>();
      
      if (threshold && updated.success_count >= threshold.success_threshold) {
        await this.setCircuitBreakerState(serviceName, 'closed');
      }
    }
  }

  /**
   * Record circuit breaker failure
   */
  async recordCircuitBreakerFailure(serviceName: string, errorMessage: string): Promise<void> {
    const state = await this.getCircuitBreakerState(serviceName);
    
    await this.db
      .prepare(`
        UPDATE circuit_breaker_states
        SET 
          failure_count = failure_count + 1,
          success_count = 0,
          last_failure_at = CURRENT_TIMESTAMP,
          total_requests = total_requests + 1,
          total_failures = total_failures + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE service_name = ?
      `)
      .bind(serviceName)
      .run();
    
    // Log event
    await this.logCircuitBreakerEvent(serviceName, 'failure', state.state, state.state, errorMessage);
    
    // Check if should open circuit
    const updated = await this.getCircuitBreakerState(serviceName);
    const threshold = await this.db
      .prepare('SELECT failure_threshold FROM circuit_breaker_states WHERE service_name = ?')
      .bind(serviceName)
      .first<{ failure_threshold: number }>();
    
    if (threshold && updated.failure_count >= threshold.failure_threshold) {
      if (state.state !== 'open') {
        await this.setCircuitBreakerState(serviceName, 'open');
      }
    }
  }

  /**
   * Set circuit breaker state
   */
  private async setCircuitBreakerState(
    serviceName: string,
    newState: 'closed' | 'open' | 'half_open'
  ): Promise<void> {
    const currentState = await this.getCircuitBreakerState(serviceName);
    
    const updateFields: string[] = [
      'state = ?',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    const updateValues: any[] = [newState];
    
    if (newState === 'open') {
      updateFields.push('opened_at = CURRENT_TIMESTAMP');
    } else if (newState === 'half_open') {
      updateFields.push('half_opened_at = CURRENT_TIMESTAMP');
    } else if (newState === 'closed') {
      updateFields.push('closed_at = CURRENT_TIMESTAMP', 'failure_count = 0', 'success_count = 0');
    }
    
    updateValues.push(serviceName);
    
    await this.db
      .prepare(`UPDATE circuit_breaker_states SET ${updateFields.join(', ')} WHERE service_name = ?`)
      .bind(...updateValues)
      .run();
    
    // Log state change
    await this.logCircuitBreakerEvent(
      serviceName,
      newState === 'open' ? 'opened' : newState === 'closed' ? 'closed' : 'half_opened',
      currentState.state,
      newState
    );
    
    console.log(`Circuit breaker ${serviceName}: ${currentState.state} -> ${newState}`);
  }

  /**
   * Get all circuit breaker states
   */
  async getAllCircuitBreakers(): Promise<any[]> {
    const result = await this.db
      .prepare('SELECT * FROM v_circuit_breaker_dashboard ORDER BY service_name')
      .all();
    
    return result.results || [];
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async logAccess(
    key: string,
    accessType: 'hit' | 'miss' | 'invalidate',
    responseTimeMs: number,
    isFallback: boolean = false
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO cache_access_logs (
            cache_key, access_type, response_time_ms, is_fallback
          ) VALUES (?, ?, ?, ?)
        `)
        .bind(key, accessType, responseTimeMs, isFallback ? 1 : 0)
        .run();
      
      // Update hit count in cache_entries
      if (accessType === 'hit') {
        await this.db
          .prepare(`
            UPDATE cache_entries 
            SET hit_count = hit_count + 1, last_hit_at = CURRENT_TIMESTAMP
            WHERE cache_key = ?
          `)
          .bind(key)
          .run();
      }
    } catch (error) {
      console.error('Failed to log cache access:', error);
    }
  }

  private async logCircuitBreakerEvent(
    serviceName: string,
    eventType: string,
    previousState: string,
    newState: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.db
        .prepare(`
          INSERT INTO circuit_breaker_events (
            service_name, event_type, previous_state, new_state, error_message
          ) VALUES (?, ?, ?, ?, ?)
        `)
        .bind(serviceName, eventType, previousState, newState, errorMessage || null)
        .run();
    } catch (error) {
      console.error('Failed to log circuit breaker event:', error);
    }
  }

  private async generateHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Cleanup expired cache entries
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.db
      .prepare('SELECT cache_key FROM cache_entries WHERE datetime(\'now\') > expires_at')
      .all<{ cache_key: string }>();
    
    let count = 0;
    for (const row of result.results || []) {
      await this.delete(row.cache_key);
      count++;
    }
    
    return count;
  }

  /**
   * Aggregate daily cache analytics
   */
  async aggregateDailyAnalytics(date: string): Promise<void> {
    await this.db
      .prepare(`
        INSERT OR REPLACE INTO cache_analytics_daily (
          date, total_requests, cache_hits, cache_misses, hit_rate_percent,
          avg_hit_response_ms, avg_miss_response_ms, total_cached_items, total_fallbacks
        )
        SELECT 
          DATE(cal.created_at) as date,
          COUNT(*) as total_requests,
          SUM(CASE WHEN cal.access_type = 'hit' THEN 1 ELSE 0 END) as cache_hits,
          SUM(CASE WHEN cal.access_type = 'miss' THEN 1 ELSE 0 END) as cache_misses,
          ROUND(
            CAST(SUM(CASE WHEN cal.access_type = 'hit' THEN 1 ELSE 0 END) AS FLOAT) / 
            COUNT(*) * 100, 
            2
          ) as hit_rate_percent,
          AVG(CASE WHEN cal.access_type = 'hit' THEN cal.response_time_ms END) as avg_hit_response_ms,
          AVG(CASE WHEN cal.access_type = 'miss' THEN cal.response_time_ms END) as avg_miss_response_ms,
          (SELECT COUNT(*) FROM cache_entries WHERE DATE(created_at) = DATE(cal.created_at)) as total_cached_items,
          SUM(CASE WHEN cal.is_fallback = 1 THEN 1 ELSE 0 END) as total_fallbacks
        FROM cache_access_logs cal
        WHERE DATE(cal.created_at) = ?
        GROUP BY DATE(cal.created_at)
      `)
      .bind(date)
      .run();
  }
}
