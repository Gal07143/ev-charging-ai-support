import { Hono } from 'hono';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
};

const analytics = new Hono<{ Bindings: Bindings }>();

/**
 * Get dashboard metrics
 * GET /api/analytics/dashboard
 */
analytics.get('/dashboard', async (c) => {
  try {
    const db = c.env.DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Get comprehensive dashboard metrics
    const [
      totalConversations,
      activeToday,
      totalMessages,
      avgQualityScore,
      topTools,
      recentActivity,
    ] = await Promise.all([
      // Total conversations
      db.prepare('SELECT COUNT(*) as count FROM conversations').first(),
      
      // Active conversations today
      db.prepare(`
        SELECT COUNT(*) as count 
        FROM conversations 
        WHERE DATE(created_at) = DATE('now')
      `).first(),
      
      // Total messages
      db.prepare('SELECT COUNT(*) as count FROM conversation_messages').first(),
      
      // Average quality score
      db.prepare('SELECT AVG(quality_score) as avg FROM conversation_quality').first(),
      
      // Top 10 most used tools
      db.prepare(`
        SELECT tool_name, COUNT(*) as usage_count
        FROM tool_usage
        GROUP BY tool_name
        ORDER BY usage_count DESC
        LIMIT 10
      `).all(),
      
      // Recent activity (last 24 hours)
      db.prepare(`
        SELECT 
          strftime('%H:00', created_at) as hour,
          COUNT(*) as count
        FROM conversations
        WHERE created_at >= datetime('now', '-24 hours')
        GROUP BY hour
        ORDER BY hour
      `).all(),
    ]);

    return c.json({
      success: true,
      metrics: {
        totalConversations: totalConversations?.count || 0,
        activeToday: activeToday?.count || 0,
        totalMessages: totalMessages?.count || 0,
        avgQualityScore: avgQualityScore?.avg || 0,
      },
      topTools: topTools.results || [],
      activity: recentActivity.results || [],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch dashboard metrics');
    return c.json({ error: 'Failed to fetch metrics' }, 500);
  }
});

/**
 * Get tool effectiveness metrics
 * GET /api/analytics/tools
 */
analytics.get('/tools', async (c) => {
  try {
    const db = c.env.DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const toolMetrics = await db.prepare(`
      SELECT 
        tool_name,
        COUNT(*) as total_calls,
        AVG(execution_time_ms) as avg_execution_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count
      FROM tool_usage
      GROUP BY tool_name
      ORDER BY total_calls DESC
    `).all();

    return c.json({
      success: true,
      tools: toolMetrics.results || [],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch tool metrics');
    return c.json({ error: 'Failed to fetch tool metrics' }, 500);
  }
});

/**
 * Get sentiment analytics
 * GET /api/analytics/sentiment
 */
analytics.get('/sentiment', async (c) => {
  try {
    const db = c.env.DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const sentimentData = await db.prepare(`
      SELECT 
        overall_sentiment,
        COUNT(*) as count
      FROM sentiment_analysis
      WHERE analyzed_at >= datetime('now', '-7 days')
      GROUP BY overall_sentiment
    `).all();

    const trends = await db.prepare(`
      SELECT 
        DATE(analyzed_at) as date,
        AVG(compound_score) as avg_sentiment
      FROM sentiment_analysis
      WHERE analyzed_at >= datetime('now', '-30 days')
      GROUP BY date
      ORDER BY date
    `).all();

    return c.json({
      success: true,
      distribution: sentimentData.results || [],
      trends: trends.results || [],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch sentiment analytics');
    return c.json({ error: 'Failed to fetch sentiment analytics' }, 500);
  }
});

/**
 * Get charger status overview
 * GET /api/analytics/chargers
 */
analytics.get('/chargers', async (c) => {
  try {
    const db = c.env.DB;
    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const statusOverview = await db.prepare(`
      SELECT 
        status,
        COUNT(*) as count
      FROM charger_status_realtime
      GROUP BY status
    `).all();

    const recentIssues = await db.prepare(`
      SELECT 
        charger_id,
        error_code,
        severity,
        detected_at
      FROM charger_diagnostics
      WHERE detected_at >= datetime('now', '-24 hours')
      ORDER BY detected_at DESC
      LIMIT 20
    `).all();

    return c.json({
      success: true,
      statusOverview: statusOverview.results || [],
      recentIssues: recentIssues.results || [],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch charger analytics');
    return c.json({ error: 'Failed to fetch charger analytics' }, 500);
  }
});

/**
 * Export analytics data
 * GET /api/analytics/export
 */
analytics.get('/export', async (c) => {
  try {
    const format = c.req.query('format') || 'json';
    const type = c.req.query('type') || 'conversations';
    const db = c.env.DB;

    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    let data: any;

    switch (type) {
      case 'conversations':
        data = await db.prepare('SELECT * FROM conversations ORDER BY created_at DESC LIMIT 1000').all();
        break;
      case 'tools':
        data = await db.prepare('SELECT * FROM tool_usage ORDER BY executed_at DESC LIMIT 1000').all();
        break;
      case 'sentiment':
        data = await db.prepare('SELECT * FROM sentiment_analysis ORDER BY analyzed_at DESC LIMIT 1000').all();
        break;
      default:
        return c.json({ error: 'Invalid export type' }, 400);
    }

    if (format === 'csv') {
      // Convert to CSV
      const results = data.results || [];
      if (results.length === 0) {
        return c.text('', 200, { 'Content-Type': 'text/csv' });
      }

      const headers = Object.keys(results[0]).join(',');
      const rows = results.map((row: any) =>
        Object.values(row).map(v => JSON.stringify(v)).join(',')
      );
      const csv = [headers, ...rows].join('\n');

      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}-export-${Date.now()}.csv"`,
      });
    }

    return c.json({
      success: true,
      type,
      count: data.results?.length || 0,
      data: data.results || [],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to export analytics');
    return c.json({ error: 'Failed to export analytics' }, 500);
  }
});

export default analytics;
