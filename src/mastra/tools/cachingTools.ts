/**
 * Caching & Circuit Breaker Tools
 * Mastra tools for cache management and circuit breaker monitoring
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { CachingService } from '../../services/cachingService';

// ============================================================================
// Tool 1: Get Cache Statistics
// ============================================================================

export const getCacheStatsTool = createTool({
  id: 'get_cache_stats',
  name: 'Get Cache Statistics',
  description: 'Get current cache performance statistics including hit rate, total entries, and storage usage.',
  inputSchema: z.object({}),
  execute: async ({ context }) => {
    const db = context.db as D1Database;
    const kv = context.kv as KVNamespace;
    const service = new CachingService(db, kv);
    
    const stats = await service.getStats();
    
    return {
      success: true,
      stats: {
        total_entries: stats.total_entries,
        total_hits: stats.total_hits,
        avg_hits_per_entry: Math.round(stats.avg_hits_per_entry || 0),
        hit_rate_percent: stats.hit_rate_percent,
        total_size_mb: (stats.total_size_bytes / 1024 / 1024).toFixed(2),
        stale_entries: stats.stale_entries,
        expired_entries: stats.expired_entries
      },
      message: `Cache stats: ${stats.hit_rate_percent}% hit rate, ${stats.total_entries} entries`
    };
  }
});

// ============================================================================
// Tool 2: Invalidate Cache
// ============================================================================

export const invalidateCacheTool = createTool({
  id: 'invalidate_cache',
  name: 'Invalidate Cache',
  description: 'Invalidate cache entries by key or pattern. Use pattern with * wildcard (e.g., "api:ampeco:*").',
  inputSchema: z.object({
    key: z.string().optional().describe('Specific cache key to invalidate'),
    pattern: z.string().optional().describe('Pattern to match multiple keys (use * as wildcard)')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const kv = context.kv as KVNamespace;
    const service = new CachingService(db, kv);
    
    if (!input.key && !input.pattern) {
      return {
        success: false,
        message: 'Either key or pattern must be provided'
      };
    }
    
    let count = 0;
    if (input.key) {
      await service.delete(input.key);
      count = 1;
    } else if (input.pattern) {
      count = await service.invalidateByPattern(input.pattern);
    }
    
    return {
      success: true,
      invalidated_count: count,
      message: `Invalidated ${count} cache ${count === 1 ? 'entry' : 'entries'}`
    };
  }
});

// ============================================================================
// Tool 3: Get Circuit Breaker Status
// ============================================================================

export const getCircuitBreakerStatusTool = createTool({
  id: 'get_circuit_breaker_status',
  name: 'Get Circuit Breaker Status',
  description: 'Get the current status of all circuit breakers monitoring external services.',
  inputSchema: z.object({
    service_name: z.string().optional().describe('Specific service name (optional - returns all if not specified)')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const kv = context.kv as KVNamespace;
    const service = new CachingService(db, kv);
    
    if (input.service_name) {
      const state = await service.getCircuitBreakerState(input.service_name);
      return {
        success: true,
        service: input.service_name,
        state: state.state,
        failure_count: state.failure_count,
        success_count: state.success_count,
        last_failure: state.last_failure_at,
        is_available: state.state !== 'open'
      };
    }
    
    const breakers = await service.getAllCircuitBreakers();
    
    return {
      success: true,
      count: breakers.length,
      circuit_breakers: breakers.map((b: any) => ({
        service_name: b.service_name,
        state: b.state,
        failure_count: b.failure_count,
        success_count: b.success_count,
        failures_last_hour: b.failures_last_hour,
        success_rate_percent: b.overall_success_rate_percent,
        minutes_open: b.minutes_open,
        is_available: b.state !== 'open'
      })),
      summary: {
        total_services: breakers.length,
        open_circuits: breakers.filter((b: any) => b.state === 'open').length,
        degraded_services: breakers.filter((b: any) => b.state === 'half_open').length,
        healthy_services: breakers.filter((b: any) => b.state === 'closed').length
      }
    };
  }
});

// ============================================================================
// Tool 4: Reset Circuit Breaker
// ============================================================================

export const resetCircuitBreakerTool = createTool({
  id: 'reset_circuit_breaker',
  name: 'Reset Circuit Breaker',
  description: 'Manually reset a circuit breaker to closed state. Use when you know the service has recovered.',
  inputSchema: z.object({
    service_name: z.string().describe('Service name to reset')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    
    await db
      .prepare(`
        UPDATE circuit_breaker_states
        SET 
          state = 'closed',
          failure_count = 0,
          success_count = 0,
          closed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE service_name = ?
      `)
      .bind(input.service_name)
      .run();
    
    // Log event
    await db
      .prepare(`
        INSERT INTO circuit_breaker_events (
          service_name, event_type, previous_state, new_state
        ) VALUES (?, 'closed', 'manual_reset', 'closed')
      `)
      .bind(input.service_name)
      .run();
    
    return {
      success: true,
      service_name: input.service_name,
      new_state: 'closed',
      message: `Circuit breaker for ${input.service_name} has been reset to closed state`
    };
  }
});

// ============================================================================
// Tool 5: Cleanup Expired Cache
// ============================================================================

export const cleanupExpiredCacheTool = createTool({
  id: 'cleanup_expired_cache',
  name: 'Cleanup Expired Cache',
  description: 'Remove expired cache entries to free up storage space.',
  inputSchema: z.object({}),
  execute: async ({ context }) => {
    const db = context.db as D1Database;
    const kv = context.kv as KVNamespace;
    const service = new CachingService(db, kv);
    
    const count = await service.cleanupExpired();
    
    return {
      success: true,
      removed_count: count,
      message: `Cleaned up ${count} expired cache ${count === 1 ? 'entry' : 'entries'}`
    };
  }
});

// ============================================================================
// Tool 6: Get Cache Performance by Type
// ============================================================================

export const getCachePerformanceByTypeTool = createTool({
  id: 'get_cache_performance_by_type',
  name: 'Get Cache Performance by Type',
  description: 'Analyze cache performance broken down by cache type (api_result, kb_article, etc.).',
  inputSchema: z.object({}),
  execute: async ({ context }) => {
    const db = context.db as D1Database;
    
    const result = await db
      .prepare('SELECT * FROM v_cache_performance_by_type ORDER BY total_hits DESC')
      .all();
    
    return {
      success: true,
      performance_by_type: (result.results || []).map((r: any) => ({
        cache_type: r.cache_type,
        unique_keys: r.unique_keys,
        total_hits: r.total_hits,
        avg_hits_per_key: Math.round(r.avg_hits_per_key || 0),
        total_size_mb: (r.total_size_bytes / 1024 / 1024).toFixed(2),
        hits_24h: r.hits_24h,
        misses_24h: r.misses_24h,
        hit_rate_24h: r.hits_24h && (r.hits_24h + r.misses_24h) > 0
          ? `${((r.hits_24h / (r.hits_24h + r.misses_24h)) * 100).toFixed(1)}%`
          : 'N/A',
        avg_hit_time_ms: r.avg_hit_time_ms ? Math.round(r.avg_hit_time_ms) : null
      })),
      message: 'Cache performance analysis completed'
    };
  }
});

// ============================================================================
// Export All Tools
// ============================================================================

export const cachingTools = {
  getCacheStats: getCacheStatsTool,
  invalidateCache: invalidateCacheTool,
  getCircuitBreakerStatus: getCircuitBreakerStatusTool,
  resetCircuitBreaker: resetCircuitBreakerTool,
  cleanupExpiredCache: cleanupExpiredCacheTool,
  getCachePerformanceByType: getCachePerformanceByTypeTool
};
