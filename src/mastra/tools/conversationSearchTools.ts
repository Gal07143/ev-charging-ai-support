/**
 * Conversation Context Search Service
 * Full-text search, semantic similarity, and conversation history
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';

// ============================================================================
// Tool 1: Search Conversations
// ============================================================================

export const searchConversationsTool = createTool({
  id: 'search_conversations',
  name: 'Search Conversations',
  description: 'Search through past conversations using keywords or phrases. Useful for finding similar issues and resolutions.',
  inputSchema: z.object({
    query: z.string().describe('Search query (keywords or phrases)'),
    category: z.string().optional().describe('Filter by category (charging_issue, payment, account, etc.)'),
    resolution_status: z.enum(['resolved', 'escalated', 'abandoned']).optional().describe('Filter by resolution status'),
    limit: z.number().optional().default(10).describe('Maximum results to return')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    const startTime = Date.now();
    
    // Build FTS query
    let ftsQuery = `
      SELECT 
        csf.conversation_id,
        cs.title,
        cs.summary,
        cs.primary_category,
        cs.resolution_status,
        cs.resolution_summary,
        cs.satisfaction_score,
        cs.started_at,
        cs.ended_at
      FROM conversation_summaries_fts csf
      JOIN conversation_summaries cs ON csf.conversation_id = cs.conversation_id
      WHERE conversation_summaries_fts MATCH ?
    `;
    
    const bindings: any[] = [input.query];
    
    if (input.category) {
      ftsQuery += ' AND cs.primary_category = ?';
      bindings.push(input.category);
    }
    
    if (input.resolution_status) {
      ftsQuery += ' AND cs.resolution_status = ?';
      bindings.push(input.resolution_status);
    }
    
    ftsQuery += ' ORDER BY cs.ended_at DESC LIMIT ?';
    bindings.push(input.limit);
    
    const result = await db
      .prepare(ftsQuery)
      .bind(...bindings)
      .all();
    
    const searchTime = Date.now() - startTime;
    
    // Log search
    await db
      .prepare(`
        INSERT INTO conversation_search_logs (
          query_text, search_type, results_count, search_time_ms
        ) VALUES (?, 'keyword', ?, ?)
      `)
      .bind(input.query, result.results?.length || 0, searchTime)
      .run();
    
    return {
      success: true,
      query: input.query,
      results_count: result.results?.length || 0,
      search_time_ms: searchTime,
      conversations: (result.results || []).map((r: any) => ({
        conversation_id: r.conversation_id,
        title: r.title,
        summary: r.summary,
        category: r.primary_category,
        resolution_status: r.resolution_status,
        resolution_summary: r.resolution_summary,
        satisfaction_score: r.satisfaction_score,
        started_at: r.started_at,
        ended_at: r.ended_at
      })),
      message: `Found ${result.results?.length || 0} matching conversations`
    };
  }
});

// ============================================================================
// Tool 2: Get Similar Conversations
// ============================================================================

export const getSimilarConversationsTool = createTool({
  id: 'get_similar_conversations',
  name: 'Get Similar Conversations',
  description: 'Find conversations with similar issues or resolutions to the current conversation.',
  inputSchema: z.object({
    conversation_id: z.string().describe('Current conversation ID'),
    limit: z.number().optional().default(5).describe('Maximum similar conversations to return')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    
    // Get similar conversations
    const result = await db
      .prepare(`
        SELECT 
          sc.similar_conversation_id,
          sc.similarity_score,
          sc.similarity_type,
          cs.title,
          cs.summary,
          cs.resolution_status,
          cs.resolution_summary,
          cs.primary_category
        FROM similar_conversations sc
        JOIN conversation_summaries cs ON sc.similar_conversation_id = cs.conversation_id
        WHERE sc.conversation_id = ?
        ORDER BY sc.similarity_score DESC
        LIMIT ?
      `)
      .bind(input.conversation_id, input.limit)
      .all();
    
    return {
      success: true,
      conversation_id: input.conversation_id,
      similar_count: result.results?.length || 0,
      similar_conversations: (result.results || []).map((r: any) => ({
        conversation_id: r.similar_conversation_id,
        similarity_score: r.similarity_score,
        similarity_type: r.similarity_type,
        title: r.title,
        summary: r.summary,
        category: r.primary_category,
        resolution_status: r.resolution_status,
        resolution_summary: r.resolution_summary
      })),
      message: `Found ${result.results?.length || 0} similar conversations`
    };
  }
});

// ============================================================================
// Tool 3: Get Conversation Summary
// ============================================================================

export const getConversationSummaryTool = createTool({
  id: 'get_conversation_summary',
  name: 'Get Conversation Summary',
  description: 'Get a detailed summary of a specific past conversation.',
  inputSchema: z.object({
    conversation_id: z.string().describe('Conversation ID to retrieve')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    
    const summary = await db
      .prepare('SELECT * FROM conversation_summaries WHERE conversation_id = ?')
      .bind(input.conversation_id)
      .first<any>();
    
    if (!summary) {
      return {
        success: false,
        message: 'Conversation not found'
      };
    }
    
    // Get messages
    const messages = await db
      .prepare(`
        SELECT role, content, timestamp, intent, sentiment
        FROM conversation_messages_search
        WHERE conversation_id = ?
        ORDER BY timestamp ASC
      `)
      .bind(input.conversation_id)
      .all();
    
    return {
      success: true,
      summary: {
        conversation_id: summary.conversation_id,
        title: summary.title,
        summary: summary.summary,
        category: summary.primary_category,
        subcategory: summary.subcategory,
        resolution_status: summary.resolution_status,
        resolution_summary: summary.resolution_summary,
        message_count: summary.message_count,
        duration_minutes: summary.duration_minutes,
        satisfaction_score: summary.satisfaction_score,
        started_at: summary.started_at,
        ended_at: summary.ended_at
      },
      messages: (messages.results || []).map((m: any) => ({
        role: m.role,
        content: m.content.substring(0, 200), // Preview only
        timestamp: m.timestamp,
        intent: m.intent,
        sentiment: m.sentiment
      })),
      message: 'Conversation summary retrieved'
    };
  }
});

// ============================================================================
// Tool 4: Get High-Quality Resolutions
// ============================================================================

export const getHighQualityResolutionsTool = createTool({
  id: 'get_high_quality_resolutions',
  name: 'Get High-Quality Resolutions',
  description: 'Get successfully resolved conversations with high satisfaction scores. Use to learn from past successes.',
  inputSchema: z.object({
    category: z.string().optional().describe('Filter by category'),
    min_satisfaction: z.number().optional().default(4.0).describe('Minimum satisfaction score (1-5)'),
    limit: z.number().optional().default(10).describe('Maximum results')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    
    let query = `
      SELECT * FROM v_high_quality_resolutions
      WHERE satisfaction_score >= ?
    `;
    const bindings: any[] = [input.min_satisfaction];
    
    if (input.category) {
      query += ' AND primary_category = ?';
      bindings.push(input.category);
    }
    
    query += ' LIMIT ?';
    bindings.push(input.limit);
    
    const result = await db
      .prepare(query)
      .bind(...bindings)
      .all();
    
    return {
      success: true,
      count: result.results?.length || 0,
      resolutions: (result.results || []).map((r: any) => ({
        conversation_id: r.conversation_id,
        title: r.title,
        summary: r.summary,
        category: r.primary_category,
        resolution_summary: r.resolution_summary,
        tools_used: r.tools_used_list,
        satisfaction_score: r.satisfaction_score,
        duration_minutes: r.duration_minutes,
        ended_at: r.ended_at
      })),
      message: `Found ${result.results?.length || 0} high-quality resolutions`
    };
  }
});

// ============================================================================
// Tool 5: Get Search Analytics
// ============================================================================

export const getSearchAnalyticsTool = createTool({
  id: 'get_search_analytics',
  name: 'Get Search Analytics',
  description: 'Get analytics about what people search for in conversation history.',
  inputSchema: z.object({}),
  execute: async ({ context }) => {
    const db = context.db as D1Database;
    
    // Get popular queries
    const queries = await db
      .prepare('SELECT * FROM v_popular_search_queries LIMIT 20')
      .all();
    
    // Get category breakdown
    const categories = await db
      .prepare('SELECT * FROM v_conversation_search_summary')
      .all();
    
    return {
      success: true,
      popular_queries: (queries.results || []).map((q: any) => ({
        query: q.query_text,
        search_count: q.search_count,
        avg_results: Math.round(q.avg_results || 0),
        last_searched: q.last_searched_at
      })),
      category_breakdown: (categories.results || []).map((c: any) => ({
        category: c.primary_category,
        total_conversations: c.total_conversations,
        resolved_count: c.resolved_count,
        resolution_rate: c.total_conversations > 0 
          ? `${((c.resolved_count / c.total_conversations) * 100).toFixed(1)}%`
          : 'N/A',
        avg_messages: Math.round(c.avg_messages || 0),
        avg_duration_minutes: Math.round(c.avg_duration_minutes || 0),
        avg_satisfaction: c.avg_satisfaction ? c.avg_satisfaction.toFixed(1) : 'N/A'
      })),
      message: 'Search analytics retrieved'
    };
  }
});

// ============================================================================
// Export All Tools
// ============================================================================

export const conversationSearchTools = {
  searchConversations: searchConversationsTool,
  getSimilarConversations: getSimilarConversationsTool,
  getConversationSummary: getConversationSummaryTool,
  getHighQualityResolutions: getHighQualityResolutionsTool,
  getSearchAnalytics: getSearchAnalyticsTool
};
