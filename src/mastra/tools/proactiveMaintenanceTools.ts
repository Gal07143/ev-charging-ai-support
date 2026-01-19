/**
 * Proactive Maintenance Alert Tools
 * Mastra tools for charger health monitoring and maintenance alerts
 */

import { createTool } from '@mastra/core';
import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';

// ============================================================================
// Tool 1: Get Charger Health Status
// ============================================================================

export const getChargerHealthTool = createTool({
  id: 'get_charger_health',
  name: 'Get Charger Health Status',
  description: 'Get the current health score and status of a charging station.',
  inputSchema: z.object({
    station_id: z.string().describe('Charging station ID'),
    connector_id: z.string().optional().describe('Specific connector ID (optional)')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    
    let query = `
      SELECT * FROM charger_health_scores
      WHERE station_id = ?
    `;
    const bindings: any[] = [input.station_id];
    
    if (input.connector_id) {
      query += ' AND connector_id = ?';
      bindings.push(input.connector_id);
    }
    
    query += ' ORDER BY calculated_at DESC LIMIT 1';
    
    const result = await db
      .prepare(query)
      .bind(...bindings)
      .first<any>();
    
    if (!result) {
      return {
        success: false,
        message: 'No health data found for this charger'
      };
    }
    
    return {
      success: true,
      station_id: result.station_id,
      connector_id: result.connector_id,
      health_score: result.health_score,
      score_trend: result.score_trend,
      failure_risk: result.failure_risk,
      predicted_failure_date: result.predicted_failure_date,
      confidence: result.confidence,
      component_scores: {
        hardware: result.hardware_score,
        software: result.software_score,
        connectivity: result.connectivity_score,
        usage: result.usage_score
      },
      maintenance_urgency: result.maintenance_urgency,
      message: `Health score: ${result.health_score}/100 (${result.score_trend}), Risk: ${result.failure_risk}`
    };
  }
});

// ============================================================================
// Tool 2: Get Critical Alerts
// ============================================================================

export const getCriticalAlertsTool = createTool({
  id: 'get_critical_alerts',
  name: 'Get Critical Maintenance Alerts',
  description: 'Get urgent maintenance alerts requiring immediate attention.',
  inputSchema: z.object({
    station_id: z.string().optional().describe('Filter by specific station (optional)')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    
    let query = 'SELECT * FROM v_critical_alerts';
    const bindings: any[] = [];
    
    if (input.station_id) {
      query += ' WHERE station_id = ?';
      bindings.push(input.station_id);
    }
    
    query += ' LIMIT 20';
    
    const result = await db
      .prepare(query)
      .bind(...bindings)
      .all();
    
    return {
      success: true,
      count: result.results?.length || 0,
      alerts: (result.results || []).map((a: any) => ({
        alert_id: a.alert_id,
        station_id: a.station_id,
        connector_id: a.connector_id,
        alert_type: a.alert_type,
        severity: a.severity,
        title: a.title,
        description: a.description,
        predicted_failure_hours: a.predicted_failure_window_hours,
        failure_probability: a.failure_probability ? `${(a.failure_probability * 100).toFixed(0)}%` : null,
        recommended_action: a.recommended_action,
        action_deadline: a.action_deadline,
        hours_until_deadline: a.hours_until_deadline,
        health_score: a.health_score,
        status: a.status
      })),
      message: `Found ${result.results?.length || 0} critical alerts`
    };
  }
});

// ============================================================================
// Tool 3: Get Upcoming Maintenance
// ============================================================================

export const getUpcomingMaintenanceTool = createTool({
  id: 'get_upcoming_maintenance',
  name: 'Get Upcoming Maintenance',
  description: 'Get scheduled maintenance activities for charging stations.',
  inputSchema: z.object({
    days: z.number().optional().default(7).describe('Number of days to look ahead'),
    station_id: z.string().optional().describe('Filter by specific station')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    
    let query = 'SELECT * FROM v_upcoming_maintenance WHERE scheduled_date <= date(\'now\', \'+\' || ? || \' days\')';
    const bindings: any[] = [input.days];
    
    if (input.station_id) {
      query += ' AND station_id = ?';
      bindings.push(input.station_id);
    }
    
    query += ' LIMIT 50';
    
    const result = await db
      .prepare(query)
      .bind(...bindings)
      .all();
    
    return {
      success: true,
      time_range: `Next ${input.days} days`,
      count: result.results?.length || 0,
      maintenance_schedule: (result.results || []).map((m: any) => ({
        maintenance_id: m.maintenance_id,
        station_id: m.station_id,
        connector_id: m.connector_id,
        scheduled_date: m.scheduled_date,
        scheduled_time: m.scheduled_time,
        maintenance_type: m.maintenance_type,
        description: m.description,
        estimated_duration_hours: m.estimated_duration_hours,
        assigned_to: m.assigned_to,
        status: m.status,
        current_health_score: m.current_health_score,
        hours_until_maintenance: m.hours_until_maintenance
      })),
      message: `Found ${result.results?.length || 0} scheduled maintenance activities`
    };
  }
});

// ============================================================================
// Tool 4: Get Health Dashboard
// ============================================================================

export const getHealthDashboardTool = createTool({
  id: 'get_health_dashboard',
  name: 'Get Charger Health Dashboard',
  description: 'Get overview of all charger health scores and maintenance status.',
  inputSchema: z.object({
    risk_level: z.enum(['low', 'medium', 'high', 'critical']).optional().describe('Filter by risk level')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    
    let query = 'SELECT * FROM v_charger_health_dashboard';
    const bindings: any[] = [];
    
    if (input.risk_level) {
      query += ' WHERE failure_risk = ?';
      bindings.push(input.risk_level);
    }
    
    query += ' LIMIT 100';
    
    const result = await db
      .prepare(query)
      .bind(...bindings)
      .all();
    
    const chargers = result.results || [];
    
    // Calculate summary stats
    const summary = {
      total_chargers: chargers.length,
      healthy: chargers.filter((c: any) => c.health_score >= 80).length,
      warning: chargers.filter((c: any) => c.health_score >= 50 && c.health_score < 80).length,
      critical: chargers.filter((c: any) => c.health_score < 50).length,
      avg_health_score: chargers.length > 0
        ? (chargers.reduce((sum: number, c: any) => sum + c.health_score, 0) / chargers.length).toFixed(1)
        : 0,
      pending_alerts: chargers.reduce((sum: number, c: any) => sum + (c.pending_alerts || 0), 0)
    };
    
    return {
      success: true,
      summary,
      chargers: chargers.slice(0, 50).map((c: any) => ({
        station_id: c.station_id,
        connector_id: c.connector_id,
        health_score: c.health_score,
        score_trend: c.score_trend,
        failure_risk: c.failure_risk,
        maintenance_urgency: c.maintenance_urgency,
        predicted_failure_date: c.predicted_failure_date,
        pending_alerts: c.pending_alerts,
        next_maintenance_date: c.next_maintenance_date,
        last_check: c.last_check
      })),
      message: `Monitoring ${chargers.length} chargers. ${summary.critical} at critical health.`
    };
  }
});

// ============================================================================
// Tool 5: Schedule Maintenance
// ============================================================================

export const scheduleMaintenanceTool = createTool({
  id: 'schedule_maintenance',
  name: 'Schedule Maintenance',
  description: 'Schedule maintenance for a charging station based on alerts or proactive planning.',
  inputSchema: z.object({
    station_id: z.string().describe('Charging station ID'),
    connector_id: z.string().optional().describe('Specific connector (optional)'),
    scheduled_date: z.string().describe('Scheduled date (YYYY-MM-DD)'),
    maintenance_type: z.enum(['preventive', 'corrective', 'inspection']).describe('Type of maintenance'),
    description: z.string().describe('Maintenance description'),
    alert_id: z.string().optional().describe('Related alert ID if scheduling from alert')
  }),
  execute: async ({ context, input }) => {
    const db = context.db as D1Database;
    
    const maintenanceId = `MAINT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await db
      .prepare(`
        INSERT INTO scheduled_maintenance (
          maintenance_id, station_id, connector_id, scheduled_date,
          maintenance_type, description, status, alert_id
        ) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?)
      `)
      .bind(
        maintenanceId,
        input.station_id,
        input.connector_id || null,
        input.scheduled_date,
        input.maintenance_type,
        input.description,
        input.alert_id || null
      )
      .run();
    
    return {
      success: true,
      maintenance_id: maintenanceId,
      station_id: input.station_id,
      scheduled_date: input.scheduled_date,
      maintenance_type: input.maintenance_type,
      message: `Maintenance scheduled successfully for ${input.scheduled_date}`
    };
  }
});

// ============================================================================
// Export All Tools
// ============================================================================

export const proactiveMaintenanceTools = {
  getChargerHealth: getChargerHealthTool,
  getCriticalAlerts: getCriticalAlertsTool,
  getUpcomingMaintenance: getUpcomingMaintenanceTool,
  getHealthDashboard: getHealthDashboardTool,
  scheduleMaintenance: scheduleMaintenanceTool
};
