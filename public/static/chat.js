// Chat Interface JavaScript

let currentThreadId = null;
let currentLanguage = 'he';
let selectedFile = null;

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
const removeFileBtn = document.getElementById('removeFile');

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
  languageBtn.addEventListener('click', toggleLanguage);
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);
  removeFileBtn.addEventListener('click', removeFile);
  
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
  
  if (!message && !selectedFile) return;
  
  // Disable input while sending
  messageInput.disabled = true;
  sendBtn.disabled = true;
  
  try {
    // Add user message to UI
    if (message) {
      addMessage(message, 'user');
      messageInput.value = '';
    }
    
    // Upload file if selected
    let fileId = null;
    if (selectedFile) {
      fileId = await uploadFile(selectedFile);
      addMessage(`📎 הועלה קובץ: ${selectedFile.name}`, 'user');
      removeFile();
    }
    
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
        fileId: fileId,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    // Handle SSE streaming
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let botMessageDiv = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));
          
          if (data.type === 'text') {
            // Remove typing indicator
            if (typingId) {
              removeTypingIndicator(typingId);
            }
            
            // Add or update bot message
            if (!botMessageDiv) {
              botMessageDiv = addMessage(data.content, 'bot');
            } else {
              botMessageDiv.querySelector('p').textContent = data.content;
            }
          } else if (data.type === 'tool-call') {
            // Show tool usage
            addToolCall(data.toolName, data.args);
          } else if (data.type === 'error') {
            removeTypingIndicator(typingId);
            addMessage(`❌ שגיאה: ${data.message}`, 'system');
          }
        }
      }
    }
    
    // Remove typing indicator if still showing
    if (typingId) {
      removeTypingIndicator(typingId);
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
  
  messageDiv.innerHTML = `
    <div class="max-w-[80%]">
      <div class="${colorClass} rounded-2xl ${alignment} p-4 shadow-lg">
        <p class="${role === 'user' ? 'text-right' : 'text-left'}">${text}</p>
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

function addToolCall(toolName, args) {
  const toolDiv = document.createElement('div');
  toolDiv.className = 'text-center my-2';
  toolDiv.innerHTML = `
    <div class="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm">
      <i class="fas fa-cog fa-spin"></i>
      <span>משתמש בכלי: ${toolName}</span>
    </div>
  `;
  messagesArea.appendChild(toolDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function clearChat() {
  if (confirm('למחוק את כל השיחה?')) {
    messagesArea.innerHTML = '';
    currentThreadId = `thread-${Date.now()}`;
    // Re-add welcome message
    location.reload();
  }
}

function toggleLanguage() {
  const languages = { 
    he: 'עברית', 
    en: 'English', 
    ru: 'Русский', 
    ar: 'العربية' 
  };
  const codes = ['he', 'en', 'ru', 'ar'];
  const currentIndex = codes.indexOf(currentLanguage);
  const nextIndex = (currentIndex + 1) % codes.length;
  
  currentLanguage = codes[nextIndex];
  currentLangSpan.textContent = languages[currentLanguage];
  
  addMessage(`שפה שונתה ל: ${languages[currentLanguage]}`, 'system');
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  selectedFile = file;
  fileName.textContent = file.name;
  filePreview.classList.remove('hidden');
}

function removeFile() {
  selectedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('threadId', currentThreadId);
  
  // Determine media type
  let mediaType = 'file';
  if (file.type.startsWith('image/')) mediaType = 'image';
  else if (file.type.startsWith('video/')) mediaType = 'video';
  else if (file.type.startsWith('audio/')) mediaType = 'audio';
  
  formData.append('type', mediaType);
  
  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Failed to upload file');
  }
  
  const result = await response.json();
  return result.fileId;
}
