/**
 * RFID Card Management System
 * Manage RFID cards/tags for charging authorization
 */

import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { logger } from '../../utils/logger';
import { ampecoRequest } from '../mastra/utils/ampecoUtils';

const rfidApp = new Hono();

// Database connection
const db = new Database(
  process.env.DATABASE_URL || '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/edge-control-db.sqlite'
);

// Create RFID tables
db.exec(`
  CREATE TABLE IF NOT EXISTS rfid_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT UNIQUE NOT NULL,
    card_label TEXT,
    user_id INTEGER,
    user_email TEXT,
    user_name TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'expired', 'lost')),
    card_type TEXT DEFAULT 'standard' CHECK (card_type IN ('standard', 'premium', 'fleet', 'guest')),
    issued_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    expiry_date DATETIME,
    last_used DATETIME,
    usage_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rfid_usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    charge_point_id INTEGER,
    evse_id INTEGER,
    session_id TEXT,
    action TEXT NOT NULL CHECK (action IN ('authorize', 'start_charge', 'stop_charge', 'denied')),
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (card_id) REFERENCES rfid_cards(card_id)
  );

  CREATE INDEX IF NOT EXISTS idx_rfid_cards_status ON rfid_cards(status);
  CREATE INDEX IF NOT EXISTS idx_rfid_cards_user_id ON rfid_cards(user_id);
  CREATE INDEX IF NOT EXISTS idx_rfid_usage_log_card_id ON rfid_usage_log(card_id);
  CREATE INDEX IF NOT EXISTS idx_rfid_usage_log_timestamp ON rfid_usage_log(timestamp);
`);

/**
 * GET /api/rfid/cards
 * List all RFID cards
 */
rfidApp.get('/cards', (c) => {
  try {
    const status = c.req.query('status');
    const userId = c.req.query('userId');
    const cardType = c.req.query('type');

    let query = 'SELECT * FROM rfid_cards WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (userId) {
      query += ' AND user_id = ?';
      params.push(parseInt(userId));
    }

    if (cardType) {
      query += ' AND card_type = ?';
      params.push(cardType);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = db.prepare(query);
    const cards = stmt.all(...params);

    // Get usage stats for each card
    const cardsWithStats = cards.map((card: any) => {
      const usageStats = db.prepare(`
        SELECT 
          COUNT(*) as total_uses,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_uses,
          MAX(timestamp) as last_used_at
        FROM rfid_usage_log
        WHERE card_id = ?
      `).get(card.card_id) as any;

      return {
        ...card,
        usage_stats: usageStats,
      };
    });

    return c.json({
      success: true,
      count: cardsWithStats.length,
      cards: cardsWithStats,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching RFID cards');
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
 * POST /api/rfid/cards
 * Create a new RFID card
 */
rfidApp.post('/cards', async (c) => {
  try {
    const body = await c.req.json();
    const { cardId, cardLabel, userId, userEmail, userName, cardType, expiryDate, notes } = body;

    if (!cardId) {
      return c.json({ success: false, error: 'Card ID is required' }, 400);
    }

    // Check if card already exists
    const existing = db.prepare('SELECT id FROM rfid_cards WHERE card_id = ?').get(cardId);
    if (existing) {
      return c.json({ success: false, error: 'Card ID already exists' }, 409);
    }

    // Insert new card
    const stmt = db.prepare(`
      INSERT INTO rfid_cards 
      (card_id, card_label, user_id, user_email, user_name, card_type, expiry_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      cardId,
      cardLabel || null,
      userId || null,
      userEmail || null,
      userName || null,
      cardType || 'standard',
      expiryDate || null,
      notes || null
    );

    // Get the created card
    const newCard = db.prepare('SELECT * FROM rfid_cards WHERE id = ?').get(result.lastInsertRowid);

    logger.info({ cardId, userId }, 'RFID card created');

    return c.json({
      success: true,
      message: 'RFID card created successfully',
      card: newCard,
    }, 201);
  } catch (error) {
    logger.error({ error }, 'Error creating RFID card');
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
 * GET /api/rfid/cards/:cardId
 * Get specific RFID card details
 */
rfidApp.get('/cards/:cardId', (c) => {
  try {
    const cardId = c.req.param('cardId');

    const card = db.prepare('SELECT * FROM rfid_cards WHERE card_id = ?').get(cardId);

    if (!card) {
      return c.json({ success: false, error: 'Card not found' }, 404);
    }

    // Get usage history
    const usageHistory = db.prepare(`
      SELECT * FROM rfid_usage_log
      WHERE card_id = ?
      ORDER BY timestamp DESC
      LIMIT 50
    `).all(cardId);

    // Get usage stats
    const usageStats = db.prepare(`
      SELECT 
        COUNT(*) as total_uses,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_uses,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_uses,
        MAX(timestamp) as last_used_at
      FROM rfid_usage_log
      WHERE card_id = ?
    `).get(cardId);

    return c.json({
      success: true,
      card,
      usage_history: usageHistory,
      usage_stats: usageStats,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching RFID card');
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
 * PATCH /api/rfid/cards/:cardId
 * Update RFID card
 */
rfidApp.patch('/cards/:cardId', async (c) => {
  try {
    const cardId = c.req.param('cardId');
    const body = await c.req.json();

    const { cardLabel, status, cardType, expiryDate, notes } = body;

    // Check if card exists
    const existing = db.prepare('SELECT id FROM rfid_cards WHERE card_id = ?').get(cardId);
    if (!existing) {
      return c.json({ success: false, error: 'Card not found' }, 404);
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];

    if (cardLabel !== undefined) {
      updates.push('card_label = ?');
      params.push(cardLabel);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (cardType !== undefined) {
      updates.push('card_type = ?');
      params.push(cardType);
    }
    if (expiryDate !== undefined) {
      updates.push('expiry_date = ?');
      params.push(expiryDate);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(cardId);

    const stmt = db.prepare(`
      UPDATE rfid_cards 
      SET ${updates.join(', ')}
      WHERE card_id = ?
    `);

    stmt.run(...params);

    // Get updated card
    const updatedCard = db.prepare('SELECT * FROM rfid_cards WHERE card_id = ?').get(cardId);

    logger.info({ cardId, updates: Object.keys(body) }, 'RFID card updated');

    return c.json({
      success: true,
      message: 'RFID card updated successfully',
      card: updatedCard,
    });
  } catch (error) {
    logger.error({ error }, 'Error updating RFID card');
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
 * DELETE /api/rfid/cards/:cardId
 * Delete RFID card
 */
rfidApp.delete('/cards/:cardId', (c) => {
  try {
    const cardId = c.req.param('cardId');

    // Check if card exists
    const existing = db.prepare('SELECT id FROM rfid_cards WHERE card_id = ?').get(cardId);
    if (!existing) {
      return c.json({ success: false, error: 'Card not found' }, 404);
    }

    // Delete card
    db.prepare('DELETE FROM rfid_cards WHERE card_id = ?').run(cardId);

    // Keep usage history for audit purposes (don't delete from usage_log)

    logger.info({ cardId }, 'RFID card deleted');

    return c.json({
      success: true,
      message: 'RFID card deleted successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Error deleting RFID card');
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
 * POST /api/rfid/authorize
 * Authorize RFID card for charging
 */
rfidApp.post('/authorize', async (c) => {
  try {
    const body = await c.req.json();
    const { cardId, chargePointId, evseId } = body;

    if (!cardId) {
      return c.json({ success: false, error: 'Card ID is required' }, 400);
    }

    // Check if card exists and is active
    const card = db.prepare(`
      SELECT * FROM rfid_cards 
      WHERE card_id = ? AND status = 'active'
    `).get(cardId) as any;

    if (!card) {
      // Log failed authorization
      db.prepare(`
        INSERT INTO rfid_usage_log (card_id, charge_point_id, evse_id, action, success, error_message)
        VALUES (?, ?, ?, 'authorize', 0, 'Card not found or inactive')
      `).run(cardId, chargePointId || null, evseId || null);

      return c.json({
        success: false,
        authorized: false,
        error: 'Card not found or inactive',
      }, 403);
    }

    // Check expiry date
    if (card.expiry_date && new Date(card.expiry_date) < new Date()) {
      db.prepare(`
        INSERT INTO rfid_usage_log (card_id, charge_point_id, evse_id, action, success, error_message)
        VALUES (?, ?, ?, 'authorize', 0, 'Card expired')
      `).run(cardId, chargePointId || null, evseId || null);

      return c.json({
        success: false,
        authorized: false,
        error: 'Card expired',
      }, 403);
    }

    // Log successful authorization
    db.prepare(`
      INSERT INTO rfid_usage_log (card_id, charge_point_id, evse_id, action, success)
      VALUES (?, ?, ?, 'authorize', 1)
    `).run(cardId, chargePointId || null, evseId || null);

    // Update last used
    db.prepare(`
      UPDATE rfid_cards 
      SET last_used = CURRENT_TIMESTAMP, usage_count = usage_count + 1
      WHERE card_id = ?
    `).run(cardId);

    logger.info({ cardId, chargePointId }, 'RFID card authorized');

    return c.json({
      success: true,
      authorized: true,
      card: {
        id: card.id,
        cardId: card.card_id,
        label: card.card_label,
        type: card.card_type,
        userId: card.user_id,
        userName: card.user_name,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error authorizing RFID card');
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
 * GET /api/rfid/stats
 * Get RFID system statistics
 */
rfidApp.get('/stats', (c) => {
  try {
    const totalCards = db.prepare('SELECT COUNT(*) as count FROM rfid_cards').get() as { count: number };
    const activeCards = db.prepare('SELECT COUNT(*) as count FROM rfid_cards WHERE status = \'active\'').get() as { count: number };
    const blockedCards = db.prepare('SELECT COUNT(*) as count FROM rfid_cards WHERE status = \'blocked\'').get() as { count: number };

    const cardsByType = db.prepare(`
      SELECT card_type, COUNT(*) as count
      FROM rfid_cards
      GROUP BY card_type
    `).all();

    const recentUsage = db.prepare(`
      SELECT 
        COUNT(*) as total_uses,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_uses,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_uses
      FROM rfid_usage_log
      WHERE timestamp > datetime('now', '-24 hours')
    `).get();

    const topCards = db.prepare(`
      SELECT 
        r.card_id,
        r.card_label,
        r.user_name,
        COUNT(l.id) as usage_count
      FROM rfid_cards r
      LEFT JOIN rfid_usage_log l ON r.card_id = l.card_id
      WHERE l.timestamp > datetime('now', '-30 days')
      GROUP BY r.card_id
      ORDER BY usage_count DESC
      LIMIT 10
    `).all();

    return c.json({
      success: true,
      overview: {
        total_cards: totalCards.count,
        active_cards: activeCards.count,
        blocked_cards: blockedCards.count,
      },
      cards_by_type: cardsByType,
      recent_usage_24h: recentUsage,
      top_cards_30d: topCards,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching RFID stats');
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default rfidApp;
