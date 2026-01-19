import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { serve } from 'inngest/hono';
import { edgeControlAgent } from './mastra';
import { edgeControlWorkflow } from './mastra/workflows/edgeControlWorkflow';
import { inngest } from './mastra/inngest';
import { pgPool } from './mastra/storage';
import { logger } from './utils/logger';
import { register } from './utils/metrics';
import { getQueueStats } from './utils/messageQueue';
import 'dotenv/config';

// Import API routes
import chat from './routes/chat';
import analytics from './routes/analytics';
import media from './routes/media';

const app = new Hono();

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

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

// Mount API routes
app.route('/api/chat', chat);
app.route('/api/analytics', analytics);
app.route('/api/media', media);

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

// Home page - Chat Interface
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Edge Control - AI Support Assistant</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .chat-message {
            animation: fadeIn 0.3s ease-in;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .typing-indicator span {
            animation: blink 1.4s infinite;
          }
          .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
          .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
          @keyframes blink {
            0%, 60%, 100% { opacity: 0.3; }
            30% { opacity: 1; }
          }
        </style>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <!-- Navigation -->
        <nav class="bg-white shadow-md border-b border-gray-200">
            <div class="container mx-auto px-4 py-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-charging-station text-3xl text-blue-600"></i>
                        <div>
                            <h1 class="text-xl font-bold text-gray-800">Edge Control</h1>
                            <p class="text-xs text-gray-500">AI Support Assistant</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <a href="/" class="text-blue-600 hover:text-blue-800 font-semibold">
                            <i class="fas fa-comments mr-1"></i> צ'אט
                        </a>
                        <a href="/dashboard" class="text-gray-600 hover:text-gray-800">
                            <i class="fas fa-chart-line mr-1"></i> דשבורד
                        </a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Main Chat Container -->
        <div class="container mx-auto px-4 py-6">
            <div class="max-w-4xl mx-auto">
                <!-- Chat Window -->
                <div class="bg-white rounded-2xl shadow-2xl overflow-hidden" style="height: calc(100vh - 200px);">
                    <!-- Chat Header -->
                    <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                        <div class="flex justify-between items-center">
                            <div>
                                <h2 class="text-xl font-bold">
                                    <i class="fas fa-robot mr-2"></i>
                                    נציג AI - תמיכה טכנית
                                </h2>
                                <p class="text-sm opacity-90">פעיל ומוכן לעזור 24/7</p>
                            </div>
                            <div class="flex gap-2">
                                <button id="languageBtn" class="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition">
                                    <i class="fas fa-language mr-1"></i>
                                    <span id="currentLang">עברית</span>
                                </button>
                                <button id="clearBtn" class="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition">
                                    <i class="fas fa-trash mr-1"></i>
                                    נקה
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Messages Area -->
                    <div id="messagesArea" class="flex-1 overflow-y-auto p-6 space-y-4" style="height: calc(100% - 180px); background: linear-gradient(to bottom, #f9fafb, #ffffff);">
                        <!-- Welcome Message -->
                        <div class="chat-message flex justify-start">
                            <div class="max-w-[80%]">
                                <div class="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl rounded-tr-sm p-4 shadow-lg">
                                    <p class="font-semibold mb-2">👋 שלום! אני העוזר הדיגיטלי של Edge Control</p>
                                    <p class="text-sm opacity-90">אני כאן לעזור לך עם:</p>
                                    <ul class="text-sm mt-2 space-y-1 opacity-90">
                                        <li>⚡ בדיקת סטטוס עמדות טעינה</li>
                                        <li>🔧 פתרון תקלות ובעיות</li>
                                        <li>🚗 תאימות רכב-עמדה</li>
                                        <li>📊 מידע ואנליטיקה</li>
                                        <li>🎤 העלאת תמונות, קול ווידאו</li>
                                    </ul>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">ממש עכשיו</p>
                            </div>
                        </div>
                    </div>

                    <!-- Input Area -->
                    <div class="border-t border-gray-200 p-4 bg-gray-50">
                        <!-- File Upload Preview -->
                        <div id="filePreview" class="hidden mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-paperclip text-blue-600"></i>
                                    <span id="fileName" class="text-sm text-gray-700"></span>
                                </div>
                                <button id="removeFile" class="text-red-500 hover:text-red-700">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="flex gap-2">
                            <input type="file" id="fileInput" class="hidden" accept="image/*,video/*,audio/*" />
                            <button id="attachBtn" class="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl transition">
                                <i class="fas fa-paperclip"></i>
                            </button>
                            <input 
                                type="text" 
                                id="messageInput" 
                                placeholder="הקלד הודעה..."
                                class="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button id="sendBtn" class="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition font-semibold shadow-lg">
                                <i class="fas fa-paper-plane mr-2"></i>
                                שלח
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions -->
                <div class="mt-4 flex gap-2 flex-wrap">
                    <button class="quick-action px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm transition shadow-sm">
                        ⚡ בדוק סטטוס עמדה
                    </button>
                    <button class="quick-action px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm transition shadow-sm">
                        🔧 עמדה לא עובדת
                    </button>
                    <button class="quick-action px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm transition shadow-sm">
                        🚗 בדוק תאימות רכב
                    </button>
                    <button class="quick-action px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm transition shadow-sm">
                        💰 מידע על תעריפים
                    </button>
                </div>
            </div>
        </div>

        <script src="/static/chat.js"></script>
    </body>
    </html>
  `);
});

// Dashboard page
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard - Edge Control</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <!-- Navigation -->
        <nav class="bg-white shadow-md border-b border-gray-200">
            <div class="container mx-auto px-4 py-3">
                <div class="flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-charging-station text-3xl text-blue-600"></i>
                        <div>
                            <h1 class="text-xl font-bold text-gray-800">Edge Control</h1>
                            <p class="text-xs text-gray-500">Analytics Dashboard</p>
                        </div>
                    </div>
                    <div class="flex gap-4">
                        <a href="/" class="text-gray-600 hover:text-gray-800">
                            <i class="fas fa-comments mr-1"></i> צ'אט
                        </a>
                        <a href="/dashboard" class="text-blue-600 hover:text-blue-800 font-semibold">
                            <i class="fas fa-chart-line mr-1"></i> דשבורד
                        </a>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Dashboard Content -->
        <div class="container mx-auto px-4 py-6">
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <!-- Total Conversations -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">סה"כ שיחות</p>
                            <h3 id="totalConversations" class="text-3xl font-bold text-gray-800">-</h3>
                        </div>
                        <div class="bg-blue-100 p-3 rounded-full">
                            <i class="fas fa-comments text-2xl text-blue-600"></i>
                        </div>
                    </div>
                </div>

                <!-- Active Today -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">פעילות היום</p>
                            <h3 id="activeToday" class="text-3xl font-bold text-gray-800">-</h3>
                        </div>
                        <div class="bg-green-100 p-3 rounded-full">
                            <i class="fas fa-calendar-day text-2xl text-green-600"></i>
                        </div>
                    </div>
                </div>

                <!-- Total Messages -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">סה"כ הודעות</p>
                            <h3 id="totalMessages" class="text-3xl font-bold text-gray-800">-</h3>
                        </div>
                        <div class="bg-purple-100 p-3 rounded-full">
                            <i class="fas fa-envelope text-2xl text-purple-600"></i>
                        </div>
                    </div>
                </div>

                <!-- Avg Quality Score -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm mb-1">ציון איכות ממוצע</p>
                            <h3 id="avgQualityScore" class="text-3xl font-bold text-gray-800">-</h3>
                        </div>
                        <div class="bg-yellow-100 p-3 rounded-full">
                            <i class="fas fa-star text-2xl text-yellow-600"></i>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <!-- Activity Chart -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-chart-area text-blue-600 mr-2"></i>
                        פעילות ב-24 שעות אחרונות
                    </h3>
                    <canvas id="activityChart"></canvas>
                </div>

                <!-- Top Tools -->
                <div class="bg-white rounded-xl shadow-lg p-6">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-tools text-purple-600 mr-2"></i>
                        כלים פופולריים
                    </h3>
                    <div id="topToolsList" class="space-y-3">
                        <div class="text-gray-500 text-center py-8">טוען נתונים...</div>
                    </div>
                </div>
            </div>

            <!-- Sentiment Analysis -->
            <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-heart text-red-600 mr-2"></i>
                    ניתוח סנטימנט
                </h3>
                <canvas id="sentimentChart"></canvas>
            </div>

            <!-- Recent Conversations -->
            <div class="bg-white rounded-xl shadow-lg p-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-800">
                        <i class="fas fa-history text-indigo-600 mr-2"></i>
                        שיחות אחרונות
                    </h3>
                    <button class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm">
                        <i class="fas fa-download mr-1"></i>
                        ייצוא נתונים
                    </button>
                </div>
                <div id="recentConversations" class="overflow-x-auto">
                    <div class="text-gray-500 text-center py-8">טוען שיחות...</div>
                </div>
            </div>
        </div>

        <script src="/static/dashboard.js"></script>
    </body>
    </html>
  `);
});

export default app;
