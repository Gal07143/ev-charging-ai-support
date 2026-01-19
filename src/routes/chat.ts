import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { edgeControlAgent } from '../mastra';
import { logger } from '../utils/logger';

type Bindings = {
  DB: D1Database;
};

const chat = new Hono<{ Bindings: Bindings }>();

/**
 * Chat API - Stream responses from the AI agent
 * POST /api/chat
 * Body: { messages: [...], threadId?: string, language?: string }
 */
chat.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, threadId, language = 'he' } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'Invalid messages format' }, 400);
    }

    const actualThreadId = threadId || `thread-${Date.now()}`;

    logger.info({
      threadId: actualThreadId,
      messageCount: messages.length,
      language,
    }, 'Chat request received');

    // Use streaming SSE for real-time responses
    return streamSSE(c, async (stream) => {
      try {
        // Send initial connection event
        await stream.writeSSE({
          data: JSON.stringify({ type: 'connected', threadId: actualThreadId }),
          event: 'connection',
        });

        // Generate response using Mastra agent
        const response = await edgeControlAgent.generate(
          messages,
          {
            threadId: actualThreadId,
            resourceId: `user-${Date.now()}`,
          }
        );

        // Stream the text response
        if (response.text) {
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'text',
              content: response.text,
              threadId: actualThreadId,
            }),
            event: 'message',
          });
        }

        // Stream tool calls if any
        if (response.steps && response.steps.length > 0) {
          for (const step of response.steps) {
            if (step.type === 'tool-call') {
              await stream.writeSSE({
                data: JSON.stringify({
                  type: 'tool-call',
                  toolName: step.toolName,
                  args: step.args,
                  result: step.result,
                }),
                event: 'tool',
              });
            }
          }
        }

        // Send completion event
        await stream.writeSSE({
          data: JSON.stringify({ type: 'done', threadId: actualThreadId }),
          event: 'completion',
        });

        logger.info({ threadId: actualThreadId }, 'Chat response completed');
      } catch (error) {
        logger.error({ error, threadId: actualThreadId }, 'Chat streaming error');
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }),
          event: 'error',
        });
      }
    });
  } catch (error) {
    logger.error({ error }, 'Chat request error');
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * Get chat history for a thread
 * GET /api/chat/:threadId
 */
chat.get('/:threadId', async (c) => {
  try {
    const threadId = c.req.param('threadId');
    const db = c.env.DB;

    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    // Get conversation messages
    const messages = await db
      .prepare('SELECT * FROM conversation_messages WHERE thread_id = ? ORDER BY created_at ASC')
      .bind(threadId)
      .all();

    // Get conversation metadata
    const conversation = await db
      .prepare('SELECT * FROM conversations WHERE thread_id = ?')
      .bind(threadId)
      .first();

    return c.json({
      success: true,
      threadId,
      conversation,
      messages: messages.results || [],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch chat history');
    return c.json({ error: 'Failed to fetch chat history' }, 500);
  }
});

/**
 * Get recent conversations
 * GET /api/chat
 */
chat.get('/', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '20');
    const db = c.env.DB;

    if (!db) {
      return c.json({ error: 'Database not configured' }, 500);
    }

    const conversations = await db
      .prepare('SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?')
      .bind(limit)
      .all();

    return c.json({
      success: true,
      conversations: conversations.results || [],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch conversations');
    return c.json({ error: 'Failed to fetch conversations' }, 500);
  }
});

export default chat;
