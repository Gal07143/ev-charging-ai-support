import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { stream } from 'hono/streaming';
import OpenAI from 'openai';
import Database from 'better-sqlite3';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

const app = new Hono();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize SQLite Database
const dbPath = path.join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/edge-control-db.sqlite');
let db: Database.Database | null = null;

try {
  db = new Database(dbPath);
  console.log('✅ Database connected:', dbPath);
} catch (error) {
  console.error('❌ Database connection failed:', error);
  process.exit(1);
}

// System prompt for Edge Control Support Bot
const SYSTEM_PROMPT = `You are Edge, an AI support assistant for Edge Control - an EV charging network.

Your capabilities:
- Multi-language support (Hebrew, English, Russian, Arabic)
- Help with charging station issues and troubleshooting
- Provide information about chargers, vehicles, and compatibility
- Guide users through diagnostics and solutions

Response guidelines:
1. Be empathetic and professional
2. Ask clarifying questions when needed
3. Provide step-by-step solutions
4. Use the user's language
5. Keep responses concise and actionable

Common issues you help with:
- Charging not starting
- Slow charging speed
- Error codes (E01, E42, E47, etc.)
- RFID card issues
- Payment problems
- Vehicle-charger compatibility

Always prioritize safety and encourage professional help for serious electrical issues.`;

// CORS middleware
app.use('/api/*', cors());

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} - ${c.res.status} (${duration}ms)`);
});

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));
app.use('/favicon.ico', serveStatic({ path: './public/favicon.ico' }));

// Health check endpoint
app.get('/api/health', (c) => {
  const apiKeyConfigured = !!process.env.OPENAI_API_KEY && 
                          process.env.OPENAI_API_KEY !== 'your-api-key-here';
  
  return c.json({
    status: 'ok',
    service: 'Edge Control Support Bot',
    mode: 'production',
    timestamp: new Date().toISOString(),
    checks: {
      database: db ? 'connected' : 'disconnected',
      openai: apiKeyConfigured ? 'configured' : 'not_configured',
    },
  });
});

// Chat endpoint with SSE streaming
app.post('/api/chat', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, threadId, language = 'en' } = body;

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'Invalid messages format' }, 400);
    }

    const finalThreadId = threadId || `thread-${Date.now()}`;

    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-api-key-here') {
      return c.json({
        error: 'OpenAI API key not configured',
        message: 'Please configure OPENAI_API_KEY environment variable',
      }, 500);
    }

    // Set SSE headers
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    return stream(c, async (stream) => {
      try {
        // Prepare conversation
        const conversationMessages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ];

        console.log(`💬 Chat request - Thread: ${finalThreadId}, Language: ${language}`);

        // Create streaming completion
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: conversationMessages as any,
          temperature: 0.7,
          max_tokens: 1500,
          stream: true,
        });

        let fullResponse = '';

        // Stream the response
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            // Send SSE data
            await stream.write(`data: ${JSON.stringify({ text: content, done: false })}\n\n`);
          }
        }

        // Save to database
        if (db && fullResponse) {
          try {
            const userMessage = messages[messages.length - 1].content;
            
            // Save user message
            db.prepare(`
              INSERT INTO conversation_messages (message_id, thread_id, role, content, language, created_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'))
            `).run(
              `msg-${Date.now()}-user`,
              finalThreadId,
              'user',
              userMessage,
              language
            );

            // Save assistant message
            db.prepare(`
              INSERT INTO conversation_messages (message_id, thread_id, role, content, language, created_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'))
            `).run(
              `msg-${Date.now()}-assistant`,
              finalThreadId,
              'assistant',
              fullResponse,
              language
            );

            console.log(`✅ Conversation saved - Thread: ${finalThreadId}`);
          } catch (dbError) {
            console.error('❌ Database save failed:', dbError);
          }
        }

        // Send final done message
        await stream.write(`data: ${JSON.stringify({ text: '', done: true, threadId: finalThreadId })}\n\n`);

      } catch (error: any) {
        console.error('❌ Chat error:', error);
        await stream.write(`data: ${JSON.stringify({ 
          error: true, 
          message: error.message || 'Failed to generate response' 
        })}\n\n`);
      }
    });

  } catch (error: any) {
    console.error('❌ Request error:', error);
    return c.json({ 
      error: 'Invalid request', 
      message: error.message 
    }, 400);
  }
});

// Analytics endpoints
app.get('/api/analytics/overview', async (c) => {
  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    const totalConversations = db.prepare('SELECT COUNT(DISTINCT thread_id) as count FROM conversation_messages').get() as any;
    const totalMessages = db.prepare('SELECT COUNT(*) as count FROM conversation_messages').get() as any;
    
    const languageStats = db.prepare(`
      SELECT language, COUNT(DISTINCT thread_id) as count 
      FROM conversation_messages 
      WHERE role = 'user'
      GROUP BY language
    `).all();

    const recentActivity = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(DISTINCT thread_id) as conversations
      FROM conversation_messages
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all();

    return c.json({
      totalConversations: totalConversations?.count || 0,
      totalMessages: totalMessages?.count || 0,
      languageDistribution: languageStats,
      recentActivity,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Analytics error:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

app.get('/api/analytics/recent', async (c) => {
  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    const limit = parseInt(c.req.query('limit') || '10');
    
    const recentConversations = db.prepare(`
      SELECT 
        thread_id,
        language,
        MAX(created_at) as last_message_at,
        COUNT(*) as message_count
      FROM conversation_messages
      GROUP BY thread_id
      ORDER BY last_message_at DESC
      LIMIT ?
    `).all(limit);

    return c.json({
      conversations: recentConversations,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Recent conversations error:', error);
    return c.json({ error: 'Failed to fetch conversations' }, 500);
  }
});

// Charger status endpoint
app.get('/api/chargers', async (c) => {
  if (!db) {
    return c.json({ error: 'Database not available' }, 500);
  }

  try {
    const chargers = db.prepare(`
      SELECT 
        spec_id,
        manufacturer,
        model,
        power_output_kw,
        connector_types,
        voltage_range,
        ocpp_support
      FROM charger_specifications
      ORDER BY power_output_kw DESC
      LIMIT 50
    `).all();

    return c.json({
      chargers,
      count: chargers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Chargers fetch error:', error);
    return c.json({ error: 'Failed to fetch chargers' }, 500);
  }
});

// Chat interface page
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edge Control - תמיכה חכמה</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-blue-50 via-white to-green-50 min-h-screen">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <!-- Header -->
        <div class="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold text-gray-800">
                        <i class="fas fa-bolt text-yellow-500 mr-2"></i>
                        Edge Control
                    </h1>
                    <p class="text-gray-600 mt-2">נציג תמיכה חכם לטעינת רכבים חשמליים</p>
                </div>
                <div class="flex gap-2">
                    <button id="languageBtn" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                        <i class="fas fa-globe mr-2"></i>
                        <span id="currentLang">עברית</span>
                    </button>
                    <a href="/dashboard" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                        <i class="fas fa-chart-line mr-2"></i>
                        ניתוח
                    </a>
                </div>
            </div>
        </div>

        <!-- Chat Container -->
        <div class="bg-white rounded-2xl shadow-xl overflow-hidden">
            <!-- Messages Area -->
            <div id="messagesArea" class="h-96 overflow-y-auto p-6 space-y-4">
                <div class="text-center text-gray-500 mt-20">
                    <i class="fas fa-comment-dots text-6xl text-gray-300 mb-4"></i>
                    <p class="text-xl">👋 שלום! איך אוכל לעזור לך היום?</p>
                    <p class="text-sm mt-2">שאל אותי כל שאלה על טעינת רכבים חשמליים</p>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="px-6 py-3 bg-gray-50 border-t border-gray-200">
                <div class="flex flex-wrap gap-2">
                    <button class="quick-action px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-100 transition">
                        ⚡ הטעינה לא מתחילה
                    </button>
                    <button class="quick-action px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-100 transition">
                        🐌 טעינה איטית
                    </button>
                    <button class="quick-action px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-100 transition">
                        ❗ קוד שגיאה
                    </button>
                    <button class="quick-action px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-100 transition">
                        💳 בעיות תשלום
                    </button>
                </div>
            </div>

            <!-- Input Area -->
            <div class="p-6 bg-gray-50 border-t border-gray-200">
                <div class="flex gap-3">
                    <button id="attachBtn" class="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition">
                        <i class="fas fa-paperclip"></i>
                    </button>
                    <input type="file" id="fileInput" class="hidden" accept="image/*,video/*,audio/*">
                    <input 
                        type="text" 
                        id="messageInput" 
                        placeholder="הקלד הודעה..." 
                        class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                    <button id="sendBtn" class="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-bold">
                        <i class="fas fa-paper-plane mr-2"></i>
                        שלח
                    </button>
                </div>
                <div id="filePreview" class="hidden mt-3 p-3 bg-white border border-gray-300 rounded-lg">
                    <div class="flex items-center justify-between">
                        <span id="fileName" class="text-sm text-gray-600"></span>
                        <button id="removeFile" class="text-red-500 hover:text-red-700">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Status -->
        <div class="mt-6 text-center text-sm text-gray-500">
            <i class="fas fa-circle text-green-500 mr-1"></i>
            מחובר ופעיל • GPT-4o-mini • Hebrew/English/Russian/Arabic
        </div>
    </div>

    <script src="/static/chat.js"></script>
</body>
</html>`);
});

// Analytics Dashboard page
app.get('/dashboard', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edge Control - Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto px-4 py-8">
        <div class="mb-6 flex justify-between items-center">
            <h1 class="text-3xl font-bold text-gray-800">
                <i class="fas fa-chart-line text-blue-500 mr-2"></i>
                Analytics Dashboard
            </h1>
            <a href="/" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
                <i class="fas fa-comments mr-2"></i>
                חזרה לצ'אט
            </a>
        </div>

        <div id="dashboard-content" class="space-y-6">
            <div class="text-center py-20">
                <i class="fas fa-spinner fa-spin text-6xl text-gray-300"></i>
                <p class="text-gray-500 mt-4">טוען נתונים...</p>
            </div>
        </div>
    </div>

    <script src="/static/dashboard.js"></script>
</body>
</html>`);
});

// Start server
const port = parseInt(process.env.PORT || '3000');

console.log(`
╔════════════════════════════════════════╗
║   Edge Control Production Server 🚀   ║
╚════════════════════════════════════════╝

📊 Database: ${db ? '✅ Connected' : '❌ Disconnected'}
🤖 OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not Configured'}
🌐 Port: ${port}

🔗 Access URLs:
   • Chat Interface:  http://localhost:${port}/
   • Dashboard:       http://localhost:${port}/dashboard
   • Health Check:    http://localhost:${port}/api/health
   • API Docs:        http://localhost:${port}/api/

Ready for production! 🎉
`);

serve({
  fetch: app.fetch,
  port,
});
