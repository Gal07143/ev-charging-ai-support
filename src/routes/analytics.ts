/**
 * Advanced Analytics Dashboard API
 * Real-time analytics for EV charging operations
 */

import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { logger } from '../../utils/logger';
import { ampecoRequest } from '../mastra/utils/ampecoUtils';

const analyticsApp = new Hono();

// Database connection
const db = new Database(
  process.env.DATABASE_URL || '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/edge-control-db.sqlite'
);

/**
 * GET /api/analytics/overview
 * Get overall system overview
 */
analyticsApp.get('/overview', async (c) => {
  try {
    // Get charge points summary
    const chargePoints = await ampecoRequest<any>('/public-api/resources/charge-points/v1.0');
    const cpData = chargePoints.data?.data || [];

    const totalStations = cpData.length;
    const activeStations = cpData.filter((cp: any) => cp.status === 'active').length;
    const availableStations = cpData.filter((cp: any) => cp.networkStatus === 'available').length;
    const faultedStations = cpData.filter((cp: any) => cp.networkStatus === 'faulted').length;

    // Get sessions data
    const sessions = await ampecoRequest<any>('/public-api/resources/sessions/v1.0?limit=100');
    const sessionData = sessions.data?.data || [];

    const activeSessions = sessionData.filter((s: any) => 
      s.status === 'active' || s.status === 'charging'
    ).length;

    // Calculate total energy and revenue (last 24h)
    const recentSessions = sessionData.filter((s: any) => {
      if (!s.startedAt) return false;
      const sessionDate = new Date(s.startedAt);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return sessionDate > oneDayAgo;
    });

    const totalEnergy = recentSessions.reduce((sum: number, s: any) => sum + (s.energy || 0), 0);
    const totalRevenue = recentSessions.reduce((sum: number, s: any) => sum + (s.totalAmount?.withTax || 0), 0);

    // Get AI chat statistics
    const chatStats = db.prepare(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(DISTINCT thread_id) as unique_threads,
        AVG(response_time_ms) as avg_response_time
      FROM messages 
      WHERE created_at > datetime('now', '-24 hours')
        AND role = 'assistant'
    `).get() as any;

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      period: 'Last 24 hours',
      stations: {
        total: totalStations,
        active: activeStations,
        available: availableStations,
        faulted: faultedStations,
        utilization_rate: totalStations > 0 ? ((totalStations - availableStations) / totalStations * 100).toFixed(1) : 0,
      },
      sessions: {
        active: activeSessions,
        completed_24h: recentSessions.length,
        total_energy_kwh: (totalEnergy / 1000).toFixed(2),
        total_revenue: totalRevenue.toFixed(2),
        currency: 'ILS',
      },
      ai_support: {
        total_conversations: chatStats?.total_conversations || 0,
        unique_users: chatStats?.unique_threads || 0,
        avg_response_time_ms: chatStats?.avg_response_time || 0,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching analytics overview');
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/analytics/charging-sessions
 * Detailed charging session analytics
 */
analyticsApp.get('/charging-sessions', async (c) => {
  try {
    const period = c.req.query('period') || '24h'; // 24h, 7d, 30d
    const limit = parseInt(c.req.query('limit') || '100');

    const sessions = await ampecoRequest<any>(`/public-api/resources/sessions/v1.0?limit=${limit}`);
    const sessionData = sessions.data?.data || [];

    // Calculate period date
    const periodMs = period === '7d' ? 7 * 24 * 60 * 60 * 1000 : 
                    period === '30d' ? 30 * 24 * 60 * 60 * 1000 :
                    24 * 60 * 60 * 1000;
    const periodDate = new Date(Date.now() - periodMs);

    const filteredSessions = sessionData.filter((s: any) => {
      if (!s.startedAt) return false;
      return new Date(s.startedAt) > periodDate;
    });

    // Group by hour
    const hourlyData = new Array(24).fill(0).map((_, hour) => ({
      hour: `${hour}:00`,
      sessions: 0,
      energy: 0,
      revenue: 0,
    }));

    filteredSessions.forEach((s: any) => {
      const hour = new Date(s.startedAt).getHours();
      hourlyData[hour].sessions++;
      hourlyData[hour].energy += (s.energy || 0) / 1000; // Convert to kWh
      hourlyData[hour].revenue += s.totalAmount?.withTax || 0;
    });

    // Status breakdown
    const statusBreakdown = filteredSessions.reduce((acc: any, s: any) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    // Average session metrics
    const avgEnergy = filteredSessions.length > 0 ?
      filteredSessions.reduce((sum: number, s: any) => sum + (s.energy || 0), 0) / filteredSessions.length / 1000 : 0;

    const avgDuration = filteredSessions.length > 0 ?
      filteredSessions.reduce((sum: number, s: any) => {
        if (!s.startedAt || !s.stoppedAt) return sum;
        const duration = new Date(s.stoppedAt).getTime() - new Date(s.startedAt).getTime();
        return sum + duration;
      }, 0) / filteredSessions.length / (1000 * 60) : 0; // Convert to minutes

    return c.json({
      success: true,
      period,
      total_sessions: filteredSessions.length,
      hourly_distribution: hourlyData,
      status_breakdown: statusBreakdown,
      averages: {
        energy_kwh: avgEnergy.toFixed(2),
        duration_minutes: avgDuration.toFixed(0),
        revenue_per_session: filteredSessions.length > 0 ?
          (filteredSessions.reduce((sum: number, s: any) => sum + (s.totalAmount?.withTax || 0), 0) / filteredSessions.length).toFixed(2) : 0,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching session analytics');
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/analytics/station-performance
 * Station performance metrics
 */
analyticsApp.get('/station-performance', async (c) => {
  try {
    const chargePoints = await ampecoRequest<any>('/public-api/resources/charge-points/v1.0');
    const cpData = chargePoints.data?.data || [];

    // Get sessions per station
    const sessions = await ampecoRequest<any>('/public-api/resources/sessions/v1.0?limit=500');
    const sessionData = sessions.data?.data || [];

    const stationMetrics = cpData.map((cp: any) => {
      const stationSessions = sessionData.filter((s: any) => s.chargePointId === cp.id);
      
      const totalEnergy = stationSessions.reduce((sum: number, s: any) => sum + (s.energy || 0), 0);
      const totalRevenue = stationSessions.reduce((sum: number, s: any) => sum + (s.totalAmount?.withTax || 0), 0);
      const failedSessions = stationSessions.filter((s: any) => s.status === 'failed').length;

      return {
        id: cp.id,
        name: cp.name,
        networkId: cp.networkId,
        location: cp.locationId,
        status: cp.status,
        network_status: cp.networkStatus,
        total_sessions: stationSessions.length,
        total_energy_kwh: (totalEnergy / 1000).toFixed(2),
        total_revenue: totalRevenue.toFixed(2),
        failed_sessions: failedSessions,
        success_rate: stationSessions.length > 0 ?
          (((stationSessions.length - failedSessions) / stationSessions.length) * 100).toFixed(1) : '100',
        uptime_status: cp.networkStatus === 'available' ? 'Online' : 'Offline',
        last_updated: cp.lastUpdatedAt,
      };
    });

    // Sort by revenue
    stationMetrics.sort((a, b) => parseFloat(b.total_revenue) - parseFloat(a.total_revenue));

    return c.json({
      success: true,
      total_stations: cpData.length,
      stations: stationMetrics,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching station performance');
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/analytics/ai-support-metrics
 * AI Support system metrics
 */
analyticsApp.get('/ai-support-metrics', (c) => {
  try {
    const period = c.req.query('period') || '24h';
    
    const periodHours = period === '7d' ? 168 : period === '30d' ? 720 : 24;

    // Get message statistics
    const messageStats = db.prepare(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(DISTINCT thread_id) as unique_conversations,
        AVG(LENGTH(content)) as avg_message_length,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages
      FROM messages
      WHERE created_at > datetime('now', '-${periodHours} hours')
    `).get() as any;

    // Get language distribution
    const languageStats = db.prepare(`
      SELECT 
        language,
        COUNT(*) as count
      FROM messages
      WHERE created_at > datetime('now', '-${periodHours} hours')
        AND language IS NOT NULL
      GROUP BY language
      ORDER BY count DESC
    `).all();

    // Get hourly message volume
    const hourlyVolume = db.prepare(`
      SELECT 
        strftime('%H', created_at) as hour,
        COUNT(*) as message_count
      FROM messages
      WHERE created_at > datetime('now', '-24 hours')
      GROUP BY hour
      ORDER BY hour
    `).all();

    // Get top issues/topics (based on message content keywords)
    const commonTopics = db.prepare(`
      SELECT 
        CASE 
          WHEN content LIKE '%charging%' OR content LIKE '%טעינה%' THEN 'Charging Issues'
          WHEN content LIKE '%error%' OR content LIKE '%שגיאה%' THEN 'Error Messages'
          WHEN content LIKE '%payment%' OR content LIKE '%תשלום%' THEN 'Payment Issues'
          WHEN content LIKE '%connector%' OR content LIKE '%מחבר%' THEN 'Connector Problems'
          WHEN content LIKE '%status%' OR content LIKE '%מצב%' THEN 'Status Inquiry'
          ELSE 'General Inquiry'
        END as topic,
        COUNT(*) as count
      FROM messages
      WHERE created_at > datetime('now', '-${periodHours} hours')
        AND role = 'user'
      GROUP BY topic
      ORDER BY count DESC
      LIMIT 10
    `).all();

    return c.json({
      success: true,
      period: period,
      overview: {
        total_messages: messageStats?.total_messages || 0,
        unique_conversations: messageStats?.unique_conversations || 0,
        user_messages: messageStats?.user_messages || 0,
        assistant_messages: messageStats?.assistant_messages || 0,
        avg_message_length: Math.round(messageStats?.avg_message_length || 0),
      },
      languages: languageStats,
      hourly_volume: hourlyVolume,
      common_topics: commonTopics,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching AI support metrics');
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default analyticsApp;
