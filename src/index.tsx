import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from 'inngest/hono';
import { initializeMastra, inngest, edgeControlAgent } from './mastra';
import { edgeControlWorkflow } from './mastra/workflows/edgeControlWorkflow';
import { startDiscordBot, stopDiscordBot } from './triggers/discordTriggers';
import 'dotenv/config';

const app = new Hono();

// Enable CORS
app.use('/api/*', cors());

// Initialize system on startup
let systemInitialized = false;

async function initializeSystem() {
  if (systemInitialized) return;
  
  try {
    // Initialize Mastra
    await initializeMastra();

    // Start Discord bot
    await startDiscordBot();

    systemInitialized = true;
    console.log('✅ Edge Control Support System fully initialized');
  } catch (error) {
    console.error('❌ System initialization failed:', error);
    throw error;
  }
}

// Initialize on first request
app.use(async (c, next) => {
  if (!systemInitialized) {
    await initializeSystem();
  }
  await next();
});

// Inngest API endpoint (for workflow execution)
app.on(['GET', 'POST', 'PUT'], '/api/inngest', serve({
  client: inngest,
  functions: [edgeControlWorkflow],
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
    initialized: systemInitialized,
    timestamp: new Date().toISOString(),
  });
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

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏳ Shutting down gracefully...');
  await stopDiscordBot();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⏳ Shutting down gracefully...');
  await stopDiscordBot();
  process.exit(0);
});

export default app;
