/**
 * Analytics Dashboard Service
 * Aggregates metrics, generates reports, handles exports
 */

import { Pool } from 'pg';
import { generateId } from '../utils/idGenerator';
import logger from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Types
export interface DashboardMetrics {
  date: string;
  resolutionRate: number;
  avgMessages: number;
  avgQualityScore: number;
  escalationRate: number;
  totalConversations: number;
}

export interface RealtimeMetrics {
  conversationsStarted: number;
  conversationsResolved: number;
  conversationsEscalated: number;
  avgQualityScore: number;
  avgResponseTime: number;
}

export interface GeographicHotspot {
  stationId: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  totalIssues: number;
  resolutionRate: number;
  avgUptime: number;
}

export interface ToolEffectiveness {
  toolName: string;
  totalCalls: number;
  successRate: number;
  avgExecutionTime: number;
  totalResolutions: number;
}

export interface TrendAnalysis {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercentage: number;
}

/**
 * Analytics Dashboard Service Class
 */
export class AnalyticsDashboardService {
  
  /**
   * Get daily metrics for date range
   */
  async getDailyMetrics(dateFrom: string, dateTo: string): Promise<DashboardMetrics[]> {
    try {
      const result = await pool.query(`
        SELECT 
          date,
          resolution_rate as "resolutionRate",
          avg_messages_per_conversation as "avgMessages",
          avg_quality_score as "avgQualityScore",
          escalation_rate as "escalationRate",
          total_conversations as "totalConversations"
        FROM dashboard_daily_metrics
        WHERE date >= $1 AND date <= $2
        ORDER BY date ASC
      `, [dateFrom, dateTo]);
      
      return result.rows;
      
    } catch (error) {
      logger.error('Error getting daily metrics:', error);
      return [];
    }
  }
  
  /**
   * Get real-time metrics (last 24 hours)
   */
  async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    try {
      const result = await pool.query(`
        SELECT 
          SUM(conversations_started) as "conversationsStarted",
          SUM(conversations_resolved) as "conversationsResolved",
          SUM(conversations_escalated) as "conversationsEscalated",
          AVG(avg_quality_score) as "avgQualityScore",
          AVG(avg_response_time_ms) as "avgResponseTime"
        FROM dashboard_hourly_metrics
        WHERE date >= CURRENT_DATE - INTERVAL '1 day'
      `);
      
      return result.rows[0] || {
        conversationsStarted: 0,
        conversationsResolved: 0,
        conversationsEscalated: 0,
        avgQualityScore: 0,
        avgResponseTime: 0
      };
      
    } catch (error) {
      logger.error('Error getting realtime metrics:', error);
      return {
        conversationsStarted: 0,
        conversationsResolved: 0,
        conversationsEscalated: 0,
        avgQualityScore: 0,
        avgResponseTime: 0
      };
    }
  }
  
  /**
   * Get geographic hotspots
   */
  async getGeographicHotspots(limit: number = 50): Promise<GeographicHotspot[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM geographic_hotspots LIMIT $1
      `, [limit]);
      
      return result.rows.map((row: any) => ({
        stationId: row.station_id,
        region: row.region,
        city: row.city,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        totalIssues: row.total_issues,
        resolutionRate: parseFloat(row.resolution_rate || 0),
        avgUptime: parseFloat(row.avg_uptime || 0)
      }));
      
    } catch (error) {
      logger.error('Error getting geographic hotspots:', error);
      return [];
    }
  }
  
  /**
   * Get tool effectiveness metrics
   */
  async getToolEffectiveness(dateFrom?: string, dateTo?: string): Promise<ToolEffectiveness[]> {
    try {
      let query = 'SELECT * FROM top_performing_tools';
      const params: any[] = [];
      
      if (dateFrom && dateTo) {
        query = `
          SELECT 
            tool_name as "toolName",
            SUM(total_calls) as "totalCalls",
            AVG(success_rate) as "avgSuccessRate",
            AVG(avg_execution_time_ms) as "avgExecTimeMs",
            SUM(resolved_with_tool) as "totalResolutions"
          FROM tool_effectiveness_metrics
          WHERE date >= $1 AND date <= $2
          GROUP BY tool_name
          ORDER BY "avgSuccessRate" DESC, "totalCalls" DESC
        `;
        params.push(dateFrom, dateTo);
      }
      
      const result = await pool.query(query, params);
      
      return result.rows.map((row: any) => ({
        toolName: row.tool_name || row.toolName,
        totalCalls: row.total_calls || row.totalCalls,
        successRate: parseFloat(row.avg_success_rate || row.avgSuccessRate || 0),
        avgExecutionTime: row.avg_exec_time_ms || row.avgExecTimeMs || 0,
        totalResolutions: row.total_resolutions || row.totalResolutions || 0
      }));
      
    } catch (error) {
      logger.error('Error getting tool effectiveness:', error);
      return [];
    }
  }
  
  /**
   * Get trend analysis (week-over-week)
   */
  async getTrendAnalysis(): Promise<TrendAnalysis[]> {
    try {
      const result = await pool.query('SELECT * FROM dashboard_trend_analysis');
      
      if (result.rows.length === 0) {
        return [];
      }
      
      const row = result.rows[0];
      
      const trends: TrendAnalysis[] = [
        {
          metric: 'Resolution Rate',
          currentValue: parseFloat(row.current_resolution_rate || 0),
          previousValue: parseFloat(row.previous_resolution_rate || 0),
          change: parseFloat(row.resolution_rate_change || 0),
          changePercentage: this.calculatePercentageChange(
            parseFloat(row.previous_resolution_rate || 0),
            parseFloat(row.current_resolution_rate || 0)
          )
        },
        {
          metric: 'Avg Messages',
          currentValue: parseFloat(row.current_avg_messages || 0),
          previousValue: parseFloat(row.previous_avg_messages || 0),
          change: parseFloat(row.avg_messages_change || 0),
          changePercentage: this.calculatePercentageChange(
            parseFloat(row.previous_avg_messages || 0),
            parseFloat(row.current_avg_messages || 0)
          )
        },
        {
          metric: 'Quality Score',
          currentValue: parseFloat(row.current_quality || 0),
          previousValue: parseFloat(row.previous_quality || 0),
          change: parseFloat(row.quality_change || 0),
          changePercentage: this.calculatePercentageChange(
            parseFloat(row.previous_quality || 0),
            parseFloat(row.current_quality || 0)
          )
        },
        {
          metric: 'Escalation Rate',
          currentValue: parseFloat(row.current_escalation_rate || 0),
          previousValue: parseFloat(row.previous_escalation_rate || 0),
          change: parseFloat(row.escalation_rate_change || 0),
          changePercentage: this.calculatePercentageChange(
            parseFloat(row.previous_escalation_rate || 0),
            parseFloat(row.current_escalation_rate || 0)
          )
        }
      ];
      
      return trends;
      
    } catch (error) {
      logger.error('Error getting trend analysis:', error);
      return [];
    }
  }
  
  /**
   * Export dashboard data to CSV
   */
  async exportToCSV(
    reportType: string,
    dateFrom: string,
    dateTo: string,
    filters?: any
  ): Promise<{ exportId: string; status: string }> {
    try {
      const exportId = `EXPORT-${generateId()}`;
      
      // Log export request
      await pool.query(`
        INSERT INTO dashboard_exports (
          export_id, export_type, report_type,
          date_from, date_to, filters, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        exportId,
        'csv',
        reportType,
        dateFrom,
        dateTo,
        JSON.stringify(filters || {}),
        'pending'
      ]);
      
      // In production, this would queue a background job
      // For now, we'll simulate immediate completion
      
      const fileUrl = `https://storage.example.com/exports/${exportId}.csv`;
      
      await pool.query(`
        UPDATE dashboard_exports
        SET status = 'completed',
            file_url = $2,
            completed_at = NOW(),
            expires_at = NOW() + INTERVAL '7 days'
        WHERE export_id = $1
      `, [exportId, fileUrl]);
      
      logger.info(`Export ${exportId} created for ${reportType}`);
      
      return { exportId, status: 'completed' };
      
    } catch (error) {
      logger.error('Error creating export:', error);
      throw error;
    }
  }
  
  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<any> {
    try {
      const result = await pool.query(`
        SELECT 
          export_id as "exportId",
          export_type as "exportType",
          report_type as "reportType",
          status,
          file_url as "fileUrl",
          file_size_bytes as "fileSize",
          row_count as "rowCount",
          requested_at as "requestedAt",
          completed_at as "completedAt",
          expires_at as "expiresAt"
        FROM dashboard_exports
        WHERE export_id = $1
      `, [exportId]);
      
      return result.rows[0] || null;
      
    } catch (error) {
      logger.error('Error getting export status:', error);
      return null;
    }
  }
  
  /**
   * Aggregate daily metrics (run this daily via cron)
   */
  async aggregateDailyMetrics(date: string): Promise<void> {
    try {
      logger.info(`Aggregating daily metrics for ${date}`);
      
      // This would aggregate from various tables
      // For now, we'll insert sample data
      
      await pool.query(`
        INSERT INTO dashboard_daily_metrics (
          date, total_conversations, resolved_conversations,
          resolution_rate, avg_messages_per_conversation,
          avg_quality_score, escalation_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (date) DO UPDATE SET
          total_conversations = EXCLUDED.total_conversations,
          resolved_conversations = EXCLUDED.resolved_conversations,
          resolution_rate = EXCLUDED.resolution_rate,
          avg_messages_per_conversation = EXCLUDED.avg_messages_per_conversation,
          avg_quality_score = EXCLUDED.avg_quality_score,
          escalation_rate = EXCLUDED.escalation_rate,
          updated_at = NOW()
      `, [
        date,
        100, // sample data
        78,
        78.0,
        9.5,
        4.2,
        25.0
      ]);
      
      logger.info(`Daily metrics aggregated for ${date}`);
      
    } catch (error) {
      logger.error('Error aggregating daily metrics:', error);
      throw error;
    }
  }
  
  /**
   * Helper: Calculate percentage change
   */
  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }
  
  /**
   * Get performance summary
   */
  async getPerformanceSummary(days: number = 30): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM dashboard_performance_summary
        WHERE date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY date DESC
      `);
      
      return result.rows;
      
    } catch (error) {
      logger.error('Error getting performance summary:', error);
      return [];
    }
  }
}

// Export singleton instance
export const analyticsDashboardService = new AnalyticsDashboardService();
