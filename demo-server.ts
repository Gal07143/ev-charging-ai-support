import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// Enable CORS
app.use('/api/*', cors());

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'Edge Control Support Bot',
    timestamp: new Date().toISOString(),
    message: 'System running in demo mode - Database integration coming soon!',
  });
});

// Mock chat API (for testing frontend)
app.post('/api/chat', async (c) => {
  try {
    const body = await c.req.json();
    const { messages } = body;
    
    const lastMessage = messages[messages.length - 1];
    
    // Simple mock response
    const mockResponse = `שלום! קיבלתי את ההודעה שלך: "${lastMessage.content}"
    
🤖 אני עובד במצב הדגמה כרגע.
    
המערכת כוללת:
✅ 98 כלי AI
✅ תמיכה ב-4 שפות
✅ בסיס נתונים עם 24 טבלאות
✅ ממשק משתמש מלא
✅ דשבורד אנליטיקס

💡 לשאלות טכניות, אני יכול לעזור עם:
- בדיקת סטטוס עמדות טעינה
- פתרון תקלות
- תאימות רכב-עמדה
- מידע על תעריפים

מה תרצה לדעת?`;

    return c.json({
      success: true,
      text: mockResponse,
      threadId: body.threadId || `thread-${Date.now()}`,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Failed to process message' }, 500);
  }
});

// Mock analytics API
app.get('/api/analytics/dashboard', (c) => {
  return c.json({
    success: true,
    metrics: {
      totalConversations: 127,
      activeToday: 23,
      totalMessages: 1543,
      avgQualityScore: 4.2,
    },
    topTools: [
      { tool_name: 'checkChargerStatus', total_calls: 342, success_count: 328, avg_execution_time: 245 },
      { tool_name: 'semanticSearch', total_calls: 298, success_count: 298, avg_execution_time: 180 },
      { tool_name: 'remoteReset', total_calls: 156, success_count: 142, avg_execution_time: 1200 },
      { tool_name: 'getEVCompatibility', total_calls: 134, success_count: 134, avg_execution_time: 320 },
      { tool_name: 'translateText', total_calls: 98, success_count: 98, avg_execution_time: 150 },
    ],
    activity: [
      { hour: '00:00', count: 5 },
      { hour: '01:00', count: 3 },
      { hour: '02:00', count: 2 },
      { hour: '03:00', count: 1 },
      { hour: '04:00', count: 2 },
      { hour: '05:00', count: 4 },
      { hour: '06:00', count: 8 },
      { hour: '07:00', count: 12 },
      { hour: '08:00', count: 18 },
      { hour: '09:00', count: 23 },
      { hour: '10:00', count: 21 },
      { hour: '11:00', count: 19 },
      { hour: '12:00', count: 15 },
      { hour: '13:00', count: 14 },
      { hour: '14:00', count: 16 },
      { hour: '15:00', count: 18 },
      { hour: '16:00', count: 20 },
      { hour: '17:00', count: 22 },
      { hour: '18:00', count: 17 },
      { hour: '19:00', count: 13 },
      { hour: '20:00', count: 11 },
      { hour: '21:00', count: 8 },
      { hour: '22:00', count: 6 },
      { hour: '23:00', count: 4 },
    ],
  });
});

// Mock tools API
app.get('/api/analytics/tools', (c) => {
  return c.json({
    success: true,
    tools: [
      { tool_name: 'checkChargerStatus', total_calls: 342, success_count: 328, error_count: 14, avg_execution_time: 245 },
      { tool_name: 'semanticSearch', total_calls: 298, success_count: 298, error_count: 0, avg_execution_time: 180 },
      { tool_name: 'remoteReset', total_calls: 156, success_count: 142, error_count: 14, avg_execution_time: 1200 },
      { tool_name: 'getEVCompatibility', total_calls: 134, success_count: 134, error_count: 0, avg_execution_time: 320 },
      { tool_name: 'translateText', total_calls: 98, success_count: 98, error_count: 0, avg_execution_time: 150 },
      { tool_name: 'detectLanguage', total_calls: 87, success_count: 87, error_count: 0, avg_execution_time: 120 },
      { tool_name: 'analyzeSentiment', total_calls: 76, success_count: 76, error_count: 0, avg_execution_time: 200 },
      { tool_name: 'searchKB', total_calls: 65, success_count: 65, error_count: 0, avg_execution_time: 190 },
      { tool_name: 'checkEscalation', total_calls: 54, success_count: 54, error_count: 0, avg_execution_time: 180 },
      { tool_name: 'scoreQuality', total_calls: 43, success_count: 43, error_count: 0, avg_execution_time: 210 },
    ],
  });
});

// Mock sentiment API
app.get('/api/analytics/sentiment', (c) => {
  return c.json({
    success: true,
    distribution: [
      { overall_sentiment: 'positive', count: 87 },
      { overall_sentiment: 'neutral', count: 32 },
      { overall_sentiment: 'negative', count: 8 },
    ],
    trends: [],
  });
});

// Mock conversations API
app.get('/api/chat', (c) => {
  return c.json({
    success: true,
    conversations: [
      { thread_id: 'thread-001', language: 'he', message_count: 12, status: 'resolved', created_at: new Date().toISOString() },
      { thread_id: 'thread-002', language: 'en', message_count: 8, status: 'active', created_at: new Date().toISOString() },
      { thread_id: 'thread-003', language: 'he', message_count: 15, status: 'resolved', created_at: new Date().toISOString() },
      { thread_id: 'thread-004', language: 'ru', message_count: 6, status: 'escalated', created_at: new Date().toISOString() },
      { thread_id: 'thread-005', language: 'he', message_count: 9, status: 'resolved', created_at: new Date().toISOString() },
    ],
  });
});

// Mock media upload
app.post('/api/media/upload', async (c) => {
  return c.json({
    success: true,
    fileId: `file-${Date.now()}`,
    message: 'File upload simulated in demo mode',
  });
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
          .demo-badge {
            position: fixed;
            top: 70px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
        </style>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <!-- Demo Badge -->
        <div class="demo-badge">
            <i class="fas fa-flask mr-1"></i>
            מצב הדגמה
        </div>

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
                                <p class="text-sm opacity-90">פעיל ומוכן לעזור 24/7 • מצב הדגמה</p>
                            </div>
                            <div class="flex gap-2">
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
                                    <p class="text-sm opacity-90 mb-2">🎉 המערכת פועלת במצב הדגמה!</p>
                                    <p class="text-sm opacity-90">מה שבנינו:</p>
                                    <ul class="text-sm mt-2 space-y-1 opacity-90">
                                        <li>✅ ממשק צ'אט עם עיצוב מושלם</li>
                                        <li>✅ דשבורד אנליטיקס עם גרפים</li>
                                        <li>✅ 98 כלי AI מוכנים</li>
                                        <li>✅ בסיס נתונים עם 24 טבלאות</li>
                                        <li>✅ תמיכה ב-4 שפות</li>
                                        <li>✅ העלאת קבצים (תמונות, קול, וידאו)</li>
                                    </ul>
                                    <p class="text-sm mt-3 opacity-90">💬 נסה לשלוח הודעה ותקבל תגובה!</p>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">ממש עכשיו</p>
                            </div>
                        </div>
                    </div>

                    <!-- Input Area -->
                    <div class="border-t border-gray-200 p-4 bg-gray-50">
                        <div class="flex gap-2">
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
        <style>
          .demo-badge {
            position: fixed;
            top: 70px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
        </style>
    </head>
    <body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <!-- Demo Badge -->
        <div class="demo-badge">
            <i class="fas fa-flask mr-1"></i>
            מצב הדגמה
        </div>

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
                            <h3 id="totalConversations" class="text-3xl font-bold text-gray-800">127</h3>
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
                            <h3 id="activeToday" class="text-3xl font-bold text-gray-800">23</h3>
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
                            <h3 id="totalMessages" class="text-3xl font-bold text-gray-800">1,543</h3>
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
                            <h3 id="avgQualityScore" class="text-3xl font-bold text-gray-800">4.2</h3>
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
                        <!-- Will be populated by JS -->
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
                </div>
                <div id="recentConversations" class="overflow-x-auto">
                    <!-- Will be populated by JS -->
                </div>
            </div>
        </div>

        <script src="/static/dashboard.js"></script>
    </body>
    </html>
  `);
});

const port = Number(process.env.PORT) || 3000;

console.log('🚀 Starting Edge Control Demo Server...');
console.log('📊 Loading mock data for demonstration...');

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log('');
  console.log('✅ Server running successfully!');
  console.log('');
  console.log('🌐 Access the application:');
  console.log(`   Local:   http://localhost:${info.port}`);
  console.log(`   Chat:    http://localhost:${info.port}/`);
  console.log(`   Dashboard: http://localhost:${info.port}/dashboard`);
  console.log('');
  console.log('📝 Features available:');
  console.log('   ✅ Beautiful chat interface');
  console.log('   ✅ Analytics dashboard with charts');
  console.log('   ✅ Mock AI responses');
  console.log('   ✅ Real-time UI updates');
  console.log('');
  console.log('💡 Note: Running in DEMO mode with mock data');
  console.log('   Database integration coming next!');
  console.log('');
});
