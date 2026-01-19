/**
 * Ampeco Webhook Handler
 * Receives real-time events from Ampeco platform
 * 
 * Events include:
 * - Session started
 * - Session stopped
 * - Station status changed
 * - Error/fault notifications
 * - Connector plugged/unplugged
 */

import { Hono } from 'hono';
import { logger } from '../utils/logger';
import { getDatabase } from '../utils/db';

const webhookApp = new Hono();

// Initialize database tables
const db = getDatabase();
db.exec(`
  CREATE TABLE IF NOT EXISTS ampeco_webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    charge_point_id INTEGER,
    evse_id INTEGER,
    session_id TEXT,
    payload JSON NOT NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT 0,
    processed_at DATETIME
  );

  CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON ampeco_webhook_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON ampeco_webhook_events(processed);
  CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON ampeco_webhook_events(received_at);
`);

/**
 * Ampeco Webhook Event Types
 */
interface AmpecoWebhookEvent {
  notification: string;
  chargePointId?: number;
  evseId?: number;
  sessionId?: string;
  data?: any;
  timestamp?: string;
}

/**
 * Process different event types
 */
function processEvent(event: AmpecoWebhookEvent): { success: boolean; action?: string } {
  try {
    const eventType = event.notification;

    switch (eventType) {
      case 'session.started':
        logger.info({ event }, 'Session started');
        // Trigger real-time notification to user
        return { success: true, action: 'notify_user_session_started' };

      case 'session.stopped':
        logger.info({ event }, 'Session stopped');
        // Calculate final cost, send receipt
        return { success: true, action: 'send_receipt' };

      case 'session.failed':
        logger.warn({ event }, 'Session failed');
        // Alert support team
        return { success: true, action: 'alert_support' };

      case 'chargepoint.status_changed':
        logger.info({ event }, 'Charge point status changed');
        // Update cache, notify monitoring dashboard
        return { success: true, action: 'update_dashboard' };

      case 'chargepoint.faulted':
        logger.error({ event }, 'Charge point faulted');
        // Send emergency notification
        return { success: true, action: 'emergency_notification' };

      case 'connector.plugged':
        logger.info({ event }, 'Connector plugged in');
        return { success: true, action: 'update_status' };

      case 'connector.unplugged':
        logger.info({ event }, 'Connector unplugged');
        return { success: true, action: 'update_status' };

      case 'authorization.failed':
        logger.warn({ event }, 'Authorization failed');
        return { success: true, action: 'notify_user_auth_failed' };

      default:
        logger.debug({ event }, 'Unhandled event type');
        return { success: true, action: 'log_only' };
    }
  } catch (error) {
    logger.error({ error, event }, 'Error processing webhook event');
    return { success: false };
  }
}

/**
 * POST /api/webhooks/ampeco
 * Receive webhook events from Ampeco
 */
webhookApp.post('/ampeco', async (c) => {
  try {
    const db = getDatabase();
    const event: AmpecoWebhookEvent = await c.req.json();

    logger.info({ event }, 'Received Ampeco webhook');

    // Store event in database
    const stmt = db.prepare(`
      INSERT INTO ampeco_webhook_events 
      (event_type, charge_point_id, evse_id, session_id, payload)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.notification,
      event.chargePointId || null,
      event.evseId || null,
      event.sessionId || null,
      JSON.stringify(event)
    );

    // Process event
    const result = processEvent(event);

    // Mark as processed
    if (result.success) {
      db.prepare(`
        UPDATE ampeco_webhook_events 
        SET processed = 1, processed_at = CURRENT_TIMESTAMP 
        WHERE event_type = ? AND charge_point_id = ? AND received_at > datetime('now', '-1 minute')
      `).run(event.notification, event.chargePointId || null);
    }

    return c.json({
      success: true,
      message: 'Webhook received and processed',
      action: result.action,
    });
  } catch (error) {
    logger.error({ error }, 'Webhook processing error');
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
 * GET /api/webhooks/ampeco/events
 * Retrieve recent webhook events (for debugging/monitoring)
 */
webhookApp.get('/ampeco/events', (c) => {
  try {
    const db = getDatabase();
    const limit = parseInt(c.req.query('limit') || '50');
    const eventType = c.req.query('type');

    let query = `
      SELECT * FROM ampeco_webhook_events 
      WHERE 1=1
    `;

    const params: any[] = [];

    if (eventType) {
      query += ` AND event_type = ?`;
      params.push(eventType);
    }

    query += ` ORDER BY received_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = db.prepare(query);
    const events = stmt.all(...params);

    // Parse JSON payloads
    const parsedEvents = events.map((event: any) => ({
      ...event,
      payload: JSON.parse(event.payload),
    }));

    return c.json({
      success: true,
      count: parsedEvents.length,
      events: parsedEvents,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching webhook events');
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
 * GET /api/webhooks/ampeco/stats
 * Get webhook statistics
 */
webhookApp.get('/ampeco/stats', (c) => {
  try {
    const db = getDatabase();
    const stats = db
      .prepare(
        `
      SELECT 
        event_type,
        COUNT(*) as count,
        SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as processed_count,
        MAX(received_at) as last_received
      FROM ampeco_webhook_events
      WHERE received_at > datetime('now', '-24 hours')
      GROUP BY event_type
      ORDER BY count DESC
    `
      )
      .all();

    const totalEvents = db
      .prepare(
        `
      SELECT COUNT(*) as total FROM ampeco_webhook_events
      WHERE received_at > datetime('now', '-24 hours')
    `
      )
      .get() as { total: number };

    return c.json({
      success: true,
      period: 'Last 24 hours',
      total_events: totalEvents.total,
      by_type: stats,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching webhook stats');
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default webhookApp;
