/**
 * Automated KB Update Tools
 * Mastra tools for monitoring documentation sources and managing KB updates
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';
import { AutomatedKBUpdateService } from '../../services/automatedKBUpdateService';

// ============================================================================
// Tool 1: Check Documentation Source
// ============================================================================

export const checkDocSourceTool = createTool({
  id: 'check_doc_source',
  name: 'Check Documentation Source',
  description: 'Manually trigger a check of a documentation source for updates.',
  inputSchema: z.object({
    source_id: z.number().describe('Documentation source ID to check')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new AutomatedKBUpdateService(db);
    
    const result = await service.checkDocSource(input.source_id);
    
    return {
      success: true,
      changed: result.changed,
      change_id: result.changeId,
      message: result.changed 
        ? `Changes detected and queued for review (Change ID: ${result.changeId})`
        : 'No changes detected'
    };
  }
});

// ============================================================================
// Tool 2: Get Pending Reviews
// ============================================================================

export const getPendingKBReviewsTool = createTool({
  id: 'get_pending_kb_reviews',
  name: 'Get Pending KB Reviews',
  description: 'Get list of documentation changes awaiting human review.',
  inputSchema: z.object({
    limit: z.number().optional().default(20).describe('Maximum number of reviews to return')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new AutomatedKBUpdateService(db);
    
    const reviews = await service.getPendingReviews(input.limit);
    
    return {
      success: true,
      count: reviews.length,
      reviews: reviews.map((r: any) => ({
        id: r.id,
        change_id: r.change_id,
        priority: r.priority,
        task_type: r.task_type,
        task_description: r.task_description,
        source_name: r.source_name,
        source_url: r.source_url,
        change_type: r.change_type,
        urgency: r.change_urgency,
        impact_score: r.impact_score,
        hours_pending: r.hours_pending
      })),
      message: `Found ${reviews.length} pending reviews`
    };
  }
});

// ============================================================================
// Tool 3: Get Scraping Health
// ============================================================================

export const getKBScrapingHealthTool = createTool({
  id: 'get_kb_scraping_health',
  name: 'Get KB Scraping Health',
  description: 'Get health status of all documentation scraping sources.',
  inputSchema: z.object({}),
  execute: async ({ context }) => {
    const db = context.db as D1Database;
    const service = new AutomatedKBUpdateService(db);
    
    const health = await service.getScrapingHealth();
    
    return {
      success: true,
      sources: health.map((h: any) => ({
        source_name: h.source_name,
        status: h.status,
        last_checked: h.last_checked_at,
        check_frequency_hours: h.check_frequency_hours,
        total_checks: h.total_checks,
        success_rate: h.success_rate_percent ? `${h.success_rate_percent}%` : 'N/A',
        changes_detected: h.change_detected_count,
        last_error: h.last_error
      })),
      summary: {
        total_sources: health.length,
        healthy: health.filter((h: any) => h.status === 'active').length,
        errors: health.filter((h: any) => h.status === 'error').length
      },
      message: `Monitoring ${health.length} documentation sources`
    };
  }
});

// ============================================================================
// Tool 4: Get Recent KB Changes
// ============================================================================

export const getRecentKBChangesTool = createTool({
  id: 'get_recent_kb_changes',
  name: 'Get Recent KB Changes',
  description: 'Get recently detected changes in monitored documentation.',
  inputSchema: z.object({
    days: z.number().optional().default(7).describe('Number of days to look back')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const service = new AutomatedKBUpdateService(db);
    
    const changes = await service.getRecentChanges(input.days);
    
    return {
      success: true,
      time_range: `Last ${input.days} days`,
      count: changes.length,
      changes: changes.slice(0, 20).map((c: any) => ({
        change_id: c.id,
        source_name: c.source_name,
        change_type: c.change_type,
        diff_summary: c.diff_summary,
        impact_score: c.impact_score,
        urgency: c.urgency,
        review_status: c.review_status,
        reviewer: c.reviewer,
        hours_ago: c.hours_ago
      })),
      message: `Found ${changes.length} changes in last ${input.days} days`
    };
  }
});

// ============================================================================
// Export All Tools
// ============================================================================

export const automatedKBTools = {
  checkDocSource: checkDocSourceTool,
  getPendingKBReviews: getPendingKBReviewsTool,
  getKBScrapingHealth: getKBScrapingHealthTool,
  getRecentKBChanges: getRecentKBChangesTool
};
