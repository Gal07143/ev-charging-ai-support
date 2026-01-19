/**
 * Analytics Dashboard Tools for Mastra Agent
 * Retrieve dashboard metrics, export data, track trends
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import { analyticsDashboardService } from '../../services/analyticsDashboardService';
import logger from '../../utils/logger';

/**
 * Tool: Get Dashboard Metrics
 * Retrieve daily metrics for a date range
 */
export const getDashboardMetricsTool = createTool({
  id: 'getDashboardMetrics',
  description: 'Get dashboard metrics (resolution rate, avg messages, quality scores, etc.) for a date range.',
  inputSchema: z.object({
    dateFrom: z.string().describe('Start date (YYYY-MM-DD)'),
    dateTo: z.string().describe('End date (YYYY-MM-DD)')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    metrics: z.array(z.object({
      date: z.string(),
      resolutionRate: z.number(),
      avgMessages: z.number(),
      avgQualityScore: z.number(),
      escalationRate: z.number(),
      totalConversations: z.number()
    })).optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { dateFrom, dateTo } = input;
      
      const metrics = await analyticsDashboardService.getDailyMetrics(dateFrom, dateTo);
      
      return {
        success: true,
        metrics,
        message: `Retrieved ${metrics.length} days of metrics from ${dateFrom} to ${dateTo}`
      };
      
    } catch (error) {
      logger.error('Error in getDashboardMetricsTool:', error);
      return {
        success: false,
        message: `Failed to get dashboard metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Realtime Metrics
 * Retrieve real-time metrics (last 24 hours)
 */
export const getRealtimeMetricsTool = createTool({
  id: 'getRealtimeMetrics',
  description: 'Get real-time metrics for the last 24 hours (conversations, quality, response time).',
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    conversationsStarted: z.number().optional(),
    conversationsResolved: z.number().optional(),
    conversationsEscalated: z.number().optional(),
    avgQualityScore: z.number().optional(),
    avgResponseTime: z.number().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const metrics = await analyticsDashboardService.getRealtimeMetrics();
      
      return {
        success: true,
        ...metrics,
        message: 'Real-time metrics retrieved successfully'
      };
      
    } catch (error) {
      logger.error('Error in getRealtimeMetricsTool:', error);
      return {
        success: false,
        message: `Failed to get realtime metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Geographic Hotspots
 * Retrieve stations with most issues (geographic heatmap data)
 */
export const getGeographicHotspotsTool = createTool({
  id: 'getGeographicHotspots',
  description: 'Get stations with most issues for geographic heatmap visualization. Returns top problem areas.',
  inputSchema: z.object({
    limit: z.number().optional().default(50).describe('Maximum number of hotspots to return')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    hotspots: z.array(z.object({
      stationId: z.string(),
      region: z.string(),
      city: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      totalIssues: z.number(),
      resolutionRate: z.number(),
      avgUptime: z.number()
    })).optional(),
    count: z.number().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { limit } = input;
      
      const hotspots = await analyticsDashboardService.getGeographicHotspots(limit);
      
      return {
        success: true,
        hotspots,
        count: hotspots.length,
        message: `Found ${hotspots.length} geographic hotspots`
      };
      
    } catch (error) {
      logger.error('Error in getGeographicHotspotsTool:', error);
      return {
        success: false,
        message: `Failed to get geographic hotspots: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Tool Effectiveness
 * Retrieve tool usage and effectiveness metrics
 */
export const getToolEffectivenessTool = createTool({
  id: 'getToolEffectivenessDashboard',
  description: 'Get effectiveness metrics for all tools (success rate, execution time, resolution contribution).',
  inputSchema: z.object({
    dateFrom: z.string().optional().describe('Start date (YYYY-MM-DD)'),
    dateTo: z.string().optional().describe('End date (YYYY-MM-DD)')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    tools: z.array(z.object({
      toolName: z.string(),
      totalCalls: z.number(),
      successRate: z.number(),
      avgExecutionTime: z.number(),
      totalResolutions: z.number()
    })).optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { dateFrom, dateTo } = input;
      
      const tools = await analyticsDashboardService.getToolEffectiveness(dateFrom, dateTo);
      
      return {
        success: true,
        tools,
        message: `Retrieved effectiveness data for ${tools.length} tools`
      };
      
    } catch (error) {
      logger.error('Error in getToolEffectivenessTool:', error);
      return {
        success: false,
        message: `Failed to get tool effectiveness: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Trend Analysis
 * Retrieve week-over-week trend comparison
 */
export const getTrendAnalysisTool = createTool({
  id: 'getTrendAnalysis',
  description: 'Get week-over-week trend analysis showing changes in key metrics (resolution rate, quality, etc.).',
  inputSchema: z.object({}),
  outputSchema: z.object({
    success: z.boolean(),
    trends: z.array(z.object({
      metric: z.string(),
      currentValue: z.number(),
      previousValue: z.number(),
      change: z.number(),
      changePercentage: z.number()
    })).optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const trends = await analyticsDashboardService.getTrendAnalysis();
      
      return {
        success: true,
        trends,
        message: `Trend analysis retrieved for ${trends.length} metrics`
      };
      
    } catch (error) {
      logger.error('Error in getTrendAnalysisTool:', error);
      return {
        success: false,
        message: `Failed to get trend analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Export Dashboard Data
 * Create CSV export of dashboard data
 */
export const exportDashboardDataTool = createTool({
  id: 'exportDashboardData',
  description: 'Export dashboard data to CSV for a date range. Returns export ID for download.',
  inputSchema: z.object({
    reportType: z.string().describe('Type of report (daily_metrics, geographic, tool_effectiveness)'),
    dateFrom: z.string().describe('Start date (YYYY-MM-DD)'),
    dateTo: z.string().describe('End date (YYYY-MM-DD)'),
    filters: z.record(z.any()).optional().describe('Additional filters')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    exportId: z.string().optional(),
    status: z.string().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { reportType, dateFrom, dateTo, filters } = input;
      
      const result = await analyticsDashboardService.exportToCSV(
        reportType,
        dateFrom,
        dateTo,
        filters
      );
      
      return {
        success: true,
        exportId: result.exportId,
        status: result.status,
        message: `Export ${result.exportId} created successfully. Status: ${result.status}`
      };
      
    } catch (error) {
      logger.error('Error in exportDashboardDataTool:', error);
      return {
        success: false,
        message: `Failed to create export: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Export Status
 * Check status of a CSV export
 */
export const getExportStatusTool = createTool({
  id: 'getExportStatus',
  description: 'Check the status of a dashboard data export. Returns download URL when ready.',
  inputSchema: z.object({
    exportId: z.string().describe('Export ID from exportDashboardData')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    exportId: z.string().optional(),
    status: z.string().optional(),
    fileUrl: z.string().optional(),
    fileSize: z.number().optional(),
    rowCount: z.number().optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { exportId } = input;
      
      const exportData = await analyticsDashboardService.getExportStatus(exportId);
      
      if (!exportData) {
        return {
          success: false,
          message: `Export ${exportId} not found`
        };
      }
      
      return {
        success: true,
        exportId: exportData.exportId,
        status: exportData.status,
        fileUrl: exportData.fileUrl,
        fileSize: exportData.fileSize,
        rowCount: exportData.rowCount,
        message: `Export status: ${exportData.status}`
      };
      
    } catch (error) {
      logger.error('Error in getExportStatusTool:', error);
      return {
        success: false,
        message: `Failed to get export status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});

/**
 * Tool: Get Performance Summary
 * Get overall performance summary for last N days
 */
export const getPerformanceSummaryTool = createTool({
  id: 'getPerformanceSummary',
  description: 'Get performance summary showing key metrics over the last N days.',
  inputSchema: z.object({
    days: z.number().optional().default(30).describe('Number of days to include')
  }),
  outputSchema: z.object({
    success: z.boolean(),
    summary: z.array(z.any()).optional(),
    message: z.string()
  }),
  execute: async ({ context, input }) => {
    try {
      const { days } = input;
      
      const summary = await analyticsDashboardService.getPerformanceSummary(days);
      
      return {
        success: true,
        summary,
        message: `Performance summary retrieved for last ${days} days`
      };
      
    } catch (error) {
      logger.error('Error in getPerformanceSummaryTool:', error);
      return {
        success: false,
        message: `Failed to get performance summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
});
