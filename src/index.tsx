import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from 'inngest/hono';
import { edgeControlAgent } from './mastra';
import { edgeControlWorkflow } from './mastra/workflows/edgeControlWorkflow';
import { inngest } from './mastra/inngest';
import { pgPool } from './mastra/storage';
import { logger } from './utils/logger';
import { register } from './utils/metrics';
import { getQueueStats } from './utils/messageQueue';
import 'dotenv/config';

const app = new Hono();

// Enable CORS
app.use('/api/*', cors());

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  
  logger.info({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration,
  }, 'HTTP Request');
});

// Inngest API endpoint (for workflow execution and webhooks)
app.route('/api/inngest', serve({
  client: inngest,
  functions: [edgeControlWorkflow],
  streaming: 'allow',
  signingKey: process.env.INNGEST_SIGNING_KEY,
}));

// Agent API endpoint (for testing)
app.post('/api/agents/:agentId/generate-legacy', async (c) => {
  try {
    const agentId = c.req.param('agentId');
    
    if (agentId !== 'edgeControlAgent') {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const body = await c.req.json();
    const { messages, threadId } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'Invalid messages format' }, 400);
    }

    const response = await edgeControlAgent.generateLegacy({
      messages,
      threadId: threadId || `test-${Date.now()}`,
    });

    return c.json({
      text: response.text,
      steps: response.steps,
    });
  } catch (error) {
    console.error('Agent generate error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'Edge Control Support Bot',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint (Prometheus format)
app.get('/metrics', async (c) => {
  return c.text(await register.metrics(), 200, {
    'Content-Type': register.contentType,
  });
});

// Admin API - Get failed conversations
app.get('/api/admin/failed-conversations', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const client = await pgPool.connect();
    
    const result = await client.query(
      'SELECT * FROM failed_conversations ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    
    client.release();
    return c.json({
      success: true,
      count: result.rows.length,
      conversations: result.rows,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch failed conversations');
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// Admin API - Get conversation by threadId
app.get('/api/admin/conversation/:threadId', async (c) => {
  try {
    const threadId = c.req.param('threadId');
    const client = await pgPool.connect();
    
    const result = await client.query(
      'SELECT * FROM mastra_memory WHERE thread_id = $1 ORDER BY created_at ASC',
      [threadId]
    );
    
    client.release();
    return c.json({
      success: true,
      threadId,
      messageCount: result.rows.length,
      messages: result.rows,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch conversation');
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// Admin API - Get bot statistics
app.get('/api/admin/stats', async (c) => {
  try {
    const client = await pgPool.connect();
    
    const [conversations, failedConversations, rateLimits, channelConfigs] = await Promise.all([
      client.query('SELECT COUNT(DISTINCT thread_id) as count FROM mastra_memory'),
      client.query('SELECT COUNT(*) as count FROM failed_conversations'),
      client.query('SELECT COUNT(*) as count FROM rate_limits'),
      client.query('SELECT COUNT(*) as count FROM channel_config WHERE is_active = true'),
    ]);
    
    const queueStats = await getQueueStats();
    
    client.release();
    
    return c.json({
      success: true,
      stats: {
        totalConversations: parseInt(conversations.rows[0].count),
        failedConversations: parseInt(failedConversations.rows[0].count),
        rateLimitedUsers: parseInt(rateLimits.rows[0].count),
        activeChannels: parseInt(channelConfigs.rows[0].count),
        queue: queueStats,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch stats');
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// Admin API - Get channel configuration
app.get('/api/admin/channels', async (c) => {
  try {
    const client = await pgPool.connect();
    const result = await client.query(
      'SELECT * FROM channel_config ORDER BY created_at DESC'
    );
    client.release();
    
    return c.json({
      success: true,
      count: result.rows.length,
      channels: result.rows,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch channels');
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// Admin API - Update channel configuration
app.post('/api/admin/channels/:channelId', async (c) => {
  try {
    const channelId = c.req.param('channelId');
    const body = await c.req.json();
    const { language, ampecoTenantUrl, features, isActive } = body;
    
    const client = await pgPool.connect();
    const result = await client.query(
      `INSERT INTO channel_config (channel_id, guild_id, language, ampeco_tenant_url, features, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (channel_id) 
       DO UPDATE SET 
         language = COALESCE($3, channel_config.language),
         ampeco_tenant_url = COALESCE($4, channel_config.ampeco_tenant_url),
         features = COALESCE($5, channel_config.features),
         is_active = COALESCE($6, channel_config.is_active),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [channelId, body.guildId || 'unknown', language, ampecoTenantUrl, JSON.stringify(features || {}), isActive]
    );
    client.release();
    
    return c.json({
      success: true,
      channel: result.rows[0],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update channel config');
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// Admin API - Get queue statistics
app.get('/api/admin/queue', async (c) => {
  try {
    const stats = await getQueueStats();
    return c.json({ success: true, queue: stats });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch queue stats');
    return c.json({ success: false, error: 'Queue error' }, 500);
  }
});

// Home page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Edge Control Support Bot</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div class="container mx-auto px-4 py-12">
            <div class="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
                    <h1 class="text-4xl font-bold mb-2">
                        <i class="fas fa-robot mr-3"></i>
                        Edge Control Support Bot
                    </h1>
                    <p class="text-xl opacity-90">נציג שירות לקוחות AI לרשת טעינת רכבים חשמליים</p>
                </div>

                <div class="p-8">
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-check-circle text-green-500 mr-2"></i>
                            מערכת פעילה
                        </h2>
                        <div class="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                            <p class="text-green-800">
                                הבוט מחובר ומוכן לקבל שיחות בדיסקורד
                            </p>
                        </div>
                    </div>

                    <div class="grid md:grid-cols-2 gap-6 mb-8">
                        <div class="border border-gray-200 rounded-lg p-6">
                            <h3 class="text-xl font-semibold text-gray-800 mb-3">
                                <i class="fas fa-bolt text-yellow-500 mr-2"></i>
                                תכונות
                            </h3>
                            <ul class="space-y-2 text-gray-700">
                                <li><i class="fas fa-language text-blue-500 mr-2"></i>תמיכה ב-4 שפות</li>
                                <li><i class="fas fa-server text-blue-500 mr-2"></i>ניהול עמדות מרחוק</li>
                                <li><i class="fas fa-brain text-blue-500 mr-2"></i>בינה מלאכותית GPT-5</li>
                                <li><i class="fas fa-history text-blue-500 mr-2"></i>זיכרון שיחות</li>
                            </ul>
                        </div>

                        <div class="border border-gray-200 rounded-lg p-6">
                            <h3 class="text-xl font-semibold text-gray-800 mb-3">
                                <i class="fas fa-tools text-purple-500 mr-2"></i>
                                כלים זמינים
                            </h3>
                            <ul class="space-y-2 text-gray-700">
                                <li><i class="fas fa-charging-station text-purple-500 mr-2"></i>בדיקת סטטוס עמדה</li>
                                <li><i class="fas fa-redo text-purple-500 mr-2"></i>איפוס מרחוק</li>
                                <li><i class="fas fa-unlock text-purple-500 mr-2"></i>שחרור כבל</li>
                                <li><i class="fas fa-dollar-sign text-purple-500 mr-2"></i>מידע על תעריפים</li>
                            </ul>
                        </div>
                    </div>

                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <h3 class="text-xl font-semibold text-gray-800 mb-3">
                            <i class="fas fa-code text-indigo-500 mr-2"></i>
                            בדיקת API
                        </h3>
                        <p class="text-gray-700 mb-3">לבדיקת הבוט, שלח בקשת POST ל:</p>
                        <code class="block bg-gray-800 text-green-400 p-4 rounded font-mono text-sm overflow-x-auto">
curl -X POST http://localhost:3000/api/agents/edgeControlAgent/generate-legacy \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "היי"}]}'
                        </code>
                    </div>
                </div>

                <div class="bg-gray-50 px-8 py-4 border-t border-gray-200">
                    <div class="flex justify-between items-center">
                        <p class="text-gray-600 text-sm">
                            <i class="fas fa-info-circle mr-1"></i>
                            Powered by Mastra, Inngest & Discord.js
                        </p>
                        <div class="flex gap-4">
                            <a href="/api/health" class="text-blue-600 hover:text-blue-800 text-sm">
                                <i class="fas fa-heartbeat mr-1"></i>
                                Health Check
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
  `);
});

export default app;
