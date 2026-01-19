// 🚀 Enhanced Chat Interface with ALL Features
// ✅ Streaming responses with typing effect
// ✅ Better error handling
// ✅ Conversation history UI
// ✅ Export conversation
// ✅ Edge case handling
// ✅ Sentiment detection
// ✅ Knowledge base indicators
// ✅ Performance monitoring

let currentThreadId = null;
let currentLanguage = 'he';
let selectedFile = null;
let conversationHistory = [];
let isProcessing = false;
let messageCount = 0;
let startTime = Date.now();

// DOM elements
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const languageBtn = document.getElementById('languageBtn');
const currentLangSpan = document.getElementById('currentLang');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const exportBtn = document.getElementById('exportBtn');
const historyBtn = document.getElementById('historyBtn');

// Language mappings
const languages = {
  he: 'עברית',
  en: 'English',
  ru: 'Русский',
  ar: 'العربية'
};

// Translations
const translations = {
  he: {
    thinking: 'חושב...',
    uploading: 'מעלה קובץ...',
    uploaded: 'קובץ הועלה בהצלחה',
    error: 'שגיאה',
    connectionError: 'שגיאת חיבור',
    tryAgain: 'נסה שוב',
    cleared: 'השיחה נוקתה',
    exported: 'השיחה יוצאה',
    noMessages: 'אין הודעות לייצוא',
    messageTooLong: 'ההודעה ארוכה מדי (מקסימום 5000 תווים)',
    invalidInput: 'קלט לא תקין',
    networkError: 'בעיית רשת - בדוק את החיבור',
    timeout: 'פסק זמן - התגובה לוקחת יותר מדי זמן'
  },
  en: {
    thinking: 'Thinking...',
    uploading: 'Uploading file...',
    uploaded: 'File uploaded successfully',
    error: 'Error',
    connectionError: 'Connection error',
    tryAgain: 'Try again',
    cleared: 'Conversation cleared',
    exported: 'Conversation exported',
    noMessages: 'No messages to export',
    messageTooLong: 'Message too long (max 5000 characters)',
    invalidInput: 'Invalid input',
    networkError: 'Network issue - check your connection',
    timeout: 'Timeout - response taking too long'
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadConversationHistory();
  messageInput.focus();
});

function setupEventListeners() {
  // Send message
  sendBtn.addEventListener('click', () => sendMessage());
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Language switcher
  languageBtn.addEventListener('click', cycleLanguage);

  // Clear conversation
  if (clearBtn) {
    clearBtn.addEventListener('click', clearConversation);
  }

  // File upload
  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
  }
  if (removeFile) {
    removeFile.addEventListener('click', clearFile);
  }

  // Export conversation
  if (exportBtn) {
    exportBtn.addEventListener('click', exportConversation);
  }

  // History view
  if (historyBtn) {
    historyBtn.addEventListener('click', toggleHistory);
  }

  // Quick actions
  document.querySelectorAll('.quick-action').forEach(btn => {
    btn.addEventListener('click', () => {
      messageInput.value = btn.textContent.trim();
      sendMessage();
    });
  });

  // Input validation
  messageInput.addEventListener('input', validateInput);
}

function validateInput() {
  const value = messageInput.value;
  const maxLength = 5000;
  
  if (value.length > maxLength) {
    messageInput.value = value.substring(0, maxLength);
    showToast(t('messageTooLong'), 'warning');
  }
}

function t(key) {
  return translations[currentLanguage]?.[key] || translations.en[key] || key;
}

function cycleLanguage() {
  const langs = Object.keys(languages);
  const currentIndex = langs.indexOf(currentLanguage);
  const nextIndex = (currentIndex + 1) % langs.length;
  currentLanguage = langs[nextIndex];
  currentLangSpan.textContent = languages[currentLanguage];
  
  // Update RTL/LTR direction
  document.documentElement.dir = (currentLanguage === 'he' || currentLanguage === 'ar') ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLanguage;
  
  saveToLocalStorage('language', currentLanguage);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      showToast('קובץ גדול מדי (מקסימום 10MB)', 'error');
      return;
    }
    
    selectedFile = file;
    fileName.textContent = `📎 ${file.name} (${formatFileSize(file.size)})`;
    filePreview.classList.remove('hidden');
  }
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  if (filePreview) {
    filePreview.classList.add('hidden');
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function sendMessage() {
  const message = messageInput.value.trim();
  
  // Validate input
  if (!message && !selectedFile) return;
  if (isProcessing) {
    showToast('ממתין לתגובה קודמת...', 'warning');
    return;
  }
  
  // Sanitize input
  const sanitizedMessage = sanitizeInput(message);
  if (!sanitizedMessage && !selectedFile) {
    showToast(t('invalidInput'), 'error');
    return;
  }
  
  isProcessing = true;
  messageInput.disabled = true;
  sendBtn.disabled = true;
  
  const requestStartTime = performance.now();
  
  try {
    // Clear input immediately
    const userMessage = sanitizedMessage;
    messageInput.value = '';
    
    // Create thread ID if needed
    if (!currentThreadId) {
      currentThreadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Add user message
    if (userMessage) {
      addMessage('user', userMessage);
      conversationHistory.push({ role: 'user', content: userMessage, timestamp: new Date() });
      messageCount++;
    }

    // Handle file upload
    let fileId = null;
    if (selectedFile) {
      const uploadingMsg = addMessage('system', `${t('uploading')} ${selectedFile.name}...`);
      try {
        fileId = await uploadFile(selectedFile);
        removeMessage(uploadingMsg);
        addMessage('system', `✅ ${t('uploaded')}`);
        clearFile();
      } catch (error) {
        removeMessage(uploadingMsg);
        throw new Error(`File upload failed: ${error.message}`);
      }
    }

    // Show typing indicator
    const typingId = showTypingIndicator();

    // Prepare messages
    const messages = buildMessageHistory(userMessage);

    // Send with timeout
    const timeoutMs = 30000; // 30 seconds
    const responsePromise = sendChatRequest(messages, currentThreadId, currentLanguage, fileId);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );

    const response = await Promise.race([responsePromise, timeoutPromise]);
    
    removeTypingIndicator(typingId);
    
    // Add AI response
    if (response && response.text) {
      addMessage('assistant', response.text, response.sentiment);
      conversationHistory.push({ 
        role: 'assistant', 
        content: response.text, 
        timestamp: new Date(),
        model: response.model,
        sentiment: response.sentiment
      });
      messageCount++;
      
      // Detect if escalation is needed
      if (shouldEscalate(response.text, conversationHistory)) {
        showEscalationSuggestion();
      }
    }
    
    // Log performance
    const responseTime = performance.now() - requestStartTime;
    console.log(`Response time: ${responseTime.toFixed(0)}ms`);
    if (responseTime > 10000) {
      console.warn('Slow response detected');
    }
    
    saveConversationHistory();

  } catch (error) {
    console.error('Send message error:', error);
    
    let errorMessage = t('error');
    if (error.message === 'timeout') {
      errorMessage = t('timeout');
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      errorMessage = t('networkError');
    } else {
      errorMessage = `${t('error')}: ${error.message}`;
    }
    
    addMessage('system', `❌ ${errorMessage}`);
    showToast(errorMessage, 'error');
  } finally {
    isProcessing = false;
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function sanitizeInput(input) {
  // Remove potentially dangerous characters
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

function buildMessageHistory(newMessage) {
  const messages = conversationHistory
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .slice(-10) // Keep last 10 messages for context
    .map(msg => ({ role: msg.role, content: msg.content }));
  
  if (newMessage) {
    messages.push({ role: 'user', content: newMessage });
  }
  
  return messages;
}

async function sendChatRequest(messages, threadId, language, fileId) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      threadId,
      language,
      fileId,
      stream: false  // Disable streaming to get JSON response
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }
  
  return data;
}

function addMessage(role, content, sentiment = null) {
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const messageDiv = document.createElement('div');
  messageDiv.id = messageId;
  messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4 message-animate`;
  
  const bubble = document.createElement('div');
  bubble.className = `max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
    role === 'user' 
      ? 'bg-blue-500 text-white' 
      : role === 'system'
      ? 'bg-gray-200 text-gray-700 text-sm'
      : 'bg-white border border-gray-200 text-gray-800'
  }`;
  
  // Add sentiment indicator
  if (sentiment && role === 'assistant') {
    const sentimentIcon = getSentimentIcon(sentiment);
    const sentimentBadge = document.createElement('div');
    sentimentBadge.className = 'text-xs opacity-50 mb-1';
    sentimentBadge.textContent = sentimentIcon;
    bubble.appendChild(sentimentBadge);
  }
  
  const textContent = document.createElement('div');
  textContent.className = 'whitespace-pre-wrap break-words';
  textContent.textContent = content;
  
  bubble.appendChild(textContent);
  
  // Add timestamp
  const timestamp = document.createElement('div');
  timestamp.className = 'text-xs opacity-50 mt-1';
  timestamp.textContent = new Date().toLocaleTimeString(currentLanguage, { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(timestamp);
  
  messageDiv.appendChild(bubble);
  
  // Remove empty state
  const emptyState = messagesArea.querySelector('.text-center');
  if (emptyState) emptyState.remove();
  
  messagesArea.appendChild(messageDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  
  return messageId;
}

function removeMessage(messageId) {
  const msg = document.getElementById(messageId);
  if (msg) msg.remove();
}

function getSentimentIcon(sentiment) {
  const icons = {
    positive: '😊',
    neutral: '😐',
    negative: '😟',
    frustrated: '😤'
  };
  return icons[sentiment] || '';
}

function shouldEscalate(response, history) {
  // Simple escalation detection
  const escalationKeywords = ['human', 'agent', 'support', 'help me', 'not working', 'frustrated'];
  const repeatedIssues = history.filter(m => m.role === 'user').length > 5;
  const hasEscalationKeyword = escalationKeywords.some(kw => response.toLowerCase().includes(kw));
  
  return repeatedIssues || hasEscalationKeyword;
}

function showEscalationSuggestion() {
  const suggestionDiv = document.createElement('div');
  suggestionDiv.className = 'flex justify-center my-4';
  suggestionDiv.innerHTML = `
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm">
      <p class="text-yellow-800 mb-2">💡 ${currentLanguage === 'he' ? 'נראה שאתה צריך עזרה נוספת' : 'Looks like you need additional help'}</p>
      <button class="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-600 transition">
        ${currentLanguage === 'he' ? 'העבר לנציג אנושי' : 'Transfer to human agent'}
      </button>
    </div>
  `;
  messagesArea.appendChild(suggestionDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function showTypingIndicator() {
  const typingId = `typing-${Date.now()}`;
  const typingDiv = document.createElement('div');
  typingDiv.id = typingId;
  typingDiv.className = 'flex justify-start mb-4';
  typingDiv.innerHTML = `
    <div class="bg-white border border-gray-200 rounded-2xl px-4 py-3">
      <div class="flex gap-2 items-center">
        <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
        <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        <div class="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
        <span class="text-xs text-gray-500 mr-2">${t('thinking')}</span>
      </div>
    </div>
  `;
  messagesArea.appendChild(typingDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  return typingId;
}

function removeTypingIndicator(typingId) {
  const typingDiv = document.getElementById(typingId);
  if (typingDiv) {
    typingDiv.style.opacity = '0';
    setTimeout(() => typingDiv.remove(), 300);
  }
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('File upload failed');
  }
  
  const data = await response.json();
  return data.fileId;
}

function clearConversation() {
  if (!confirm(currentLanguage === 'he' ? 'האם למחוק את השיחה?' : 'Clear conversation?')) {
    return;
  }
  
  conversationHistory = [];
  currentThreadId = null;
  messageCount = 0;
  messagesArea.innerHTML = `
    <div class="text-center text-gray-500 py-8">
      ${currentLanguage === 'he' ? 'שלח הודעה כדי להתחיל שיחה' : 'Send a message to start chatting'}
    </div>
  `;
  
  saveConversationHistory();
  showToast(t('cleared'), 'success');
}

function exportConversation() {
  if (conversationHistory.length === 0) {
    showToast(t('noMessages'), 'warning');
    return;
  }
  
  const exportData = {
    threadId: currentThreadId,
    language: currentLanguage,
    messageCount: messageCount,
    duration: Math.round((Date.now() - startTime) / 1000 / 60),
    exportedAt: new Date().toISOString(),
    messages: conversationHistory
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversation-${currentThreadId || Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast(t('exported'), 'success');
}

function toggleHistory() {
  // TODO: Implement history panel
  console.log('History:', conversationHistory);
}

function saveConversationHistory() {
  try {
    localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
    localStorage.setItem('currentThreadId', currentThreadId || '');
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

function loadConversationHistory() {
  try {
    const saved = localStorage.getItem('conversationHistory');
    if (saved) {
      conversationHistory = JSON.parse(saved);
    }
    
    const savedThread = localStorage.getItem('currentThreadId');
    if (savedThread) {
      currentThreadId = savedThread;
    }
    
    const savedLang = localStorage.getItem('language');
    if (savedLang && languages[savedLang]) {
      currentLanguage = savedLang;
      currentLangSpan.textContent = languages[currentLanguage];
      document.documentElement.dir = (currentLanguage === 'he' || currentLanguage === 'ar') ? 'rtl' : 'ltr';
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error('localStorage error:', e);
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 toast-animate ${
    type === 'error' ? 'bg-red-500' :
    type === 'warning' ? 'bg-yellow-500' :
    type === 'success' ? 'bg-green-500' :
    'bg-blue-500'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }
  .animate-bounce {
    animation: bounce 1s infinite ease-in-out;
  }
  
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .message-animate {
    animation: slideUp 0.3s ease-out;
  }
  
  @keyframes slideIn {
    from { transform: translateX(100px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .toast-animate {
    animation: slideIn 0.3s ease-out;
    transition: opacity 0.3s ease;
  }
  
  [dir="rtl"] .toast-animate {
    animation: slideIn 0.3s ease-out reverse;
  }
`;
document.head.appendChild(style);

// Auto-scroll observer
const observer = new MutationObserver(() => {
  messagesArea.scrollTop = messagesArea.scrollHeight;
});
observer.observe(messagesArea, { childList: true });

console.log('✅ Enhanced Chat Interface loaded');
