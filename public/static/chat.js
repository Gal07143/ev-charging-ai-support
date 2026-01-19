// Chat Interface JavaScript - Demo Mode

let currentThreadId = null;
let currentLanguage = 'he';

const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  currentThreadId = `thread-${Date.now()}`;
  
  // Event listeners
  sendBtn.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  clearBtn.addEventListener('click', clearChat);
  
  // Quick actions
  document.querySelectorAll('.quick-action').forEach(btn => {
    btn.addEventListener('click', () => {
      messageInput.value = btn.textContent.trim();
      sendMessage();
    });
  });
});

async function sendMessage() {
  const message = messageInput.value.trim();
  
  if (!message) return;
  
  // Disable input while sending
  messageInput.disabled = true;
  sendBtn.disabled = true;
  
  try {
    // Add user message to UI
    addMessage(message, 'user');
    messageInput.value = '';
    
    // Show typing indicator
    const typingId = showTypingIndicator();
    
    // Send to API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        threadId: currentThreadId,
        language: currentLanguage,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    const data = await response.json();
    
    // Remove typing indicator
    removeTypingIndicator(typingId);
    
    // Add bot response
    if (data.text) {
      addMessage(data.text, 'bot');
    } else if (data.error) {
      addMessage(`❌ שגיאה: ${data.error}`, 'system');
    }
    
  } catch (error) {
    console.error('Send message error:', error);
    addMessage('❌ שגיאה בשליחת הודעה. נסה שוב.', 'system');
  } finally {
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function addMessage(text, role) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
  
  const colorClass = role === 'user' 
    ? 'bg-gray-200 text-gray-800' 
    : role === 'bot'
    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
    : 'bg-yellow-100 text-yellow-800';
  
  const alignment = role === 'user' ? 'rounded-bl-sm' : 'rounded-br-sm';
  
  // Format text with line breaks
  const formattedText = text.split('\n').map(line => 
    line.trim() ? `<p class="mb-2">${line}</p>` : '<br>'
  ).join('');
  
  messageDiv.innerHTML = `
    <div class="max-w-[80%]">
      <div class="${colorClass} rounded-2xl ${alignment} p-4 shadow-lg">
        <div class="${role === 'user' ? 'text-right' : 'text-left'}">${formattedText}</div>
      </div>
      <p class="text-xs text-gray-500 mt-1 ${role === 'user' ? 'text-right' : 'text-left'}">
        ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  `;
  
  messagesArea.appendChild(messageDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  
  return messageDiv.querySelector('div > div');
}

function showTypingIndicator() {
  const id = `typing-${Date.now()}`;
  const typingDiv = document.createElement('div');
  typingDiv.id = id;
  typingDiv.className = 'chat-message flex justify-start';
  typingDiv.innerHTML = `
    <div class="bg-gray-200 rounded-2xl rounded-br-sm p-4">
      <div class="typing-indicator flex gap-1">
        <span class="w-2 h-2 bg-gray-600 rounded-full"></span>
        <span class="w-2 h-2 bg-gray-600 rounded-full"></span>
        <span class="w-2 h-2 bg-gray-600 rounded-full"></span>
      </div>
    </div>
  `;
  messagesArea.appendChild(typingDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const typingDiv = document.getElementById(id);
  if (typingDiv) {
    typingDiv.remove();
  }
}

function clearChat() {
  if (confirm('למחוק את כל השיחה?')) {
    messagesArea.innerHTML = '';
    currentThreadId = `thread-${Date.now()}`;
    // Re-add welcome message
    location.reload();
  }
}
