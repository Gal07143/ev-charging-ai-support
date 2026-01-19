// Dashboard JavaScript

let activityChart = null;
let sentimentChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData();
  
  // Refresh every 30 seconds
  setInterval(loadDashboardData, 30000);
});

async function loadDashboardData() {
  try {
    // Load main metrics
    await loadMetrics();
    
    // Load charts
    await loadActivityChart();
    await loadSentimentChart();
    
    // Load top tools
    await loadTopTools();
    
    // Load recent conversations
    await loadRecentConversations();
    
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

async function loadMetrics() {
  try {
    const response = await fetch('/api/analytics/dashboard');
    if (!response.ok) throw new Error('Failed to fetch metrics');
    
    const data = await response.json();
    
    // Update stats cards
    document.getElementById('totalConversations').textContent = 
      formatNumber(data.metrics.totalConversations);
    
    document.getElementById('activeToday').textContent = 
      formatNumber(data.metrics.activeToday);
    
    document.getElementById('totalMessages').textContent = 
      formatNumber(data.metrics.totalMessages);
    
    document.getElementById('avgQualityScore').textContent = 
      data.metrics.avgQualityScore.toFixed(1);
    
  } catch (error) {
    console.error('Failed to load metrics:', error);
  }
}

async function loadActivityChart() {
  try {
    const response = await fetch('/api/analytics/dashboard');
    if (!response.ok) throw new Error('Failed to fetch activity data');
    
    const data = await response.json();
    const activity = data.activity || [];
    
    const ctx = document.getElementById('activityChart');
    
    if (activityChart) {
      activityChart.destroy();
    }
    
    activityChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: activity.map(a => a.hour),
        datasets: [{
          label: 'שיחות',
          data: activity.map(a => a.count),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Failed to load activity chart:', error);
  }
}

async function loadTopTools() {
  try {
    const response = await fetch('/api/analytics/tools');
    if (!response.ok) throw new Error('Failed to fetch tools data');
    
    const data = await response.json();
    const tools = data.tools || [];
    
    const topToolsList = document.getElementById('topToolsList');
    
    if (tools.length === 0) {
      topToolsList.innerHTML = '<div class="text-gray-500 text-center py-4">אין נתונים זמינים</div>';
      return;
    }
    
    topToolsList.innerHTML = tools.slice(0, 10).map(tool => {
      const successRate = tool.total_calls > 0 
        ? ((tool.success_count / tool.total_calls) * 100).toFixed(1)
        : 0;
      
      const successColor = successRate >= 90 ? 'text-green-600' : 
                          successRate >= 70 ? 'text-yellow-600' : 
                          'text-red-600';
      
      return `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
          <div class="flex items-center gap-3">
            <i class="fas fa-tool text-purple-500"></i>
            <div>
              <p class="font-semibold text-gray-800">${tool.tool_name}</p>
              <p class="text-xs text-gray-500">${tool.total_calls} קריאות</p>
            </div>
          </div>
          <div class="text-left">
            <p class="${successColor} font-bold">${successRate}%</p>
            <p class="text-xs text-gray-500">הצלחה</p>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Failed to load top tools:', error);
  }
}

async function loadSentimentChart() {
  try {
    const response = await fetch('/api/analytics/sentiment');
    if (!response.ok) throw new Error('Failed to fetch sentiment data');
    
    const data = await response.json();
    const distribution = data.distribution || [];
    
    const ctx = document.getElementById('sentimentChart');
    
    if (sentimentChart) {
      sentimentChart.destroy();
    }
    
    const sentimentLabels = {
      positive: 'חיובי',
      neutral: 'נייטרלי',
      negative: 'שלילי'
    };
    
    const sentimentColors = {
      positive: 'rgb(34, 197, 94)',
      neutral: 'rgb(251, 191, 36)',
      negative: 'rgb(239, 68, 68)'
    };
    
    sentimentChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: distribution.map(d => sentimentLabels[d.overall_sentiment] || d.overall_sentiment),
        datasets: [{
          data: distribution.map(d => d.count),
          backgroundColor: distribution.map(d => sentimentColors[d.overall_sentiment] || 'rgb(156, 163, 175)'),
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Failed to load sentiment chart:', error);
  }
}

async function loadRecentConversations() {
  try {
    const response = await fetch('/api/chat?limit=10');
    if (!response.ok) throw new Error('Failed to fetch conversations');
    
    const data = await response.json();
    const conversations = data.conversations || [];
    
    const container = document.getElementById('recentConversations');
    
    if (conversations.length === 0) {
      container.innerHTML = '<div class="text-gray-500 text-center py-8">אין שיחות אחרונות</div>';
      return;
    }
    
    container.innerHTML = `
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-4 py-3 text-right text-sm font-semibold text-gray-700">Thread ID</th>
            <th class="px-4 py-3 text-right text-sm font-semibold text-gray-700">שפה</th>
            <th class="px-4 py-3 text-right text-sm font-semibold text-gray-700">הודעות</th>
            <th class="px-4 py-3 text-right text-sm font-semibold text-gray-700">סטטוס</th>
            <th class="px-4 py-3 text-right text-sm font-semibold text-gray-700">תאריך</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          ${conversations.map(conv => `
            <tr class="hover:bg-gray-50 transition">
              <td class="px-4 py-3 text-sm font-mono text-gray-600">${conv.thread_id?.substring(0, 16)}...</td>
              <td class="px-4 py-3 text-sm">${conv.language || 'he'}</td>
              <td class="px-4 py-3 text-sm">${conv.message_count || 0}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${
                  conv.status === 'resolved' ? 'bg-green-100 text-green-800' :
                  conv.status === 'escalated' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }">
                  ${conv.status || 'active'}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                ${new Date(conv.created_at).toLocaleDateString('he-IL')}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
  } catch (error) {
    console.error('Failed to load recent conversations:', error);
  }
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
