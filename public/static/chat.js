// Chat Interface JavaScript with SSE Streaming Support

let currentThreadId = null;
let currentLanguage = 'he';
let selectedFile = null;

// DOM elements
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const languageBtn = document.getElementById('languageBtn');
const currentLangSpan = document.getElementById('currentLang');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');

// Language mappings
const languages = {
  he: 'עברית',
  en: 'English',
  ru: 'Русский',
  ar: 'العربية'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Send message on button click
  sendBtn.addEventListener('click', sendMessage);
  
  // Send message on Enter key
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Language switcher
  languageBtn.addEventListener('click', cycleLanguage);

  // File upload
  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);
  removeFile.addEventListener('click', clearFile);

  // Quick actions
  document.querySelectorAll('.quick-action').forEach(btn => {
    btn.addEventListener('click', () => {
      messageInput.value = btn.textContent.trim();
      sendMessage();
    });
  });

  // Auto-focus input
  messageInput.focus();
});

function cycleLanguage() {
  const langs = Object.keys(languages);
  const currentIndex = langs.indexOf(currentLanguage);
  const nextIndex = (currentIndex + 1) % langs.length;
  currentLanguage = langs[nextIndex];
  currentLangSpan.textContent = languages[currentLanguage];
  
  // Update RTL/LTR direction
  document.documentElement.dir = (currentLanguage === 'he' || currentLanguage === 'ar') ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLanguage;
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    fileName.textContent = `📎 ${file.name} (${formatFileSize(file.size)})`;
    filePreview.classList.remove('hidden');
  }
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  filePreview.classList.add('hidden');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function sendMessage() {
  const message = messageInput.value.trim();
  
  if (!message && !selectedFile) return;
  
  // Disable input during sending
  messageInput.disabled = true;
  sendBtn.disabled = true;
  
  try {
    // Clear input immediately for better UX
    const userMessage = message;
    messageInput.value = '';
    
    // Create thread ID if first message
    if (!currentThreadId) {
      currentThreadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Add user message to chat
    if (userMessage) {
      addMessage('user', userMessage);
    }

    // Handle file upload if present
    let fileId = null;
    if (selectedFile) {
      addMessage('system', `📎 מעלה קובץ: ${selectedFile.name}...`);
      fileId = await uploadFile(selectedFile);
      addMessage('system', `✅ קובץ הועלה בהצלחה`);
      clearFile();
    }

    // Show typing indicator
    const typingId = showTypingIndicator();

    // Prepare messages array
    const messages = [
      { role: 'user', content: userMessage || 'עזור לי עם הקובץ שהעליתי' }
    ];

    // Call API with SSE streaming
    await streamChatResponse(messages, currentThreadId, currentLanguage, typingId);

  } catch (error) {
    console.error('Send message error:', error);
    addMessage('system', `❌ שגיאה: ${error.message}`);
  } finally {
    // Re-enable input
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

async function streamChatResponse(messages, threadId, language, typingId) {
  return new Promise((resolve, reject) => {
    // Remove typing indicator when we start receiving data
    let typingRemoved = false;
    
    // Create fetch request for SSE
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        threadId,
        language,
      }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessageId = null;

      function readChunk() {
        reader.read().then(({ done, value }) => {
          if (done) {
            resolve();
            return;
          }

          // Decode chunk
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // Remove typing indicator on first data
                if (!typingRemoved && typingId) {
                  removeTypingIndicator(typingId);
                  typingRemoved = true;
                }

                if (data.error) {
                  addMessage('system', `❌ שגיאה: ${data.message}`);
                  reject(new Error(data.message));
                  return;
                }

                if (data.done) {
                  // Message complete
                  resolve();
                  return;
                }

                if (data.text) {
                  // Stream text chunk
                  if (!assistantMessageId) {
                    assistantMessageId = addMessage('assistant', '');
                  }
                  appendToMessage(assistantMessageId, data.text);
                }
              } catch (e) {
                console.error('Parse error:', e, line);
              }
            }
          }

          // Continue reading
          readChunk();
        }).catch(error => {
          console.error('Stream read error:', error);
          if (typingId) removeTypingIndicator(typingId);
          reject(error);
        });
      }

      readChunk();
    })
    .catch(error => {
      console.error('Fetch error:', error);
      if (typingId) removeTypingIndicator(typingId);
      addMessage('system', `❌ שגיאת חיבור: ${error.message}`);
      reject(error);
    });
  });
}

function addMessage(role, content) {
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const messageDiv = document.createElement('div');
  messageDiv.id = messageId;
  messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
  
  const bubble = document.createElement('div');
  bubble.className = `max-w-[80%] rounded-2xl px-4 py-3 ${
    role === 'user' 
      ? 'bg-blue-500 text-white' 
      : role === 'system'
      ? 'bg-gray-200 text-gray-700 text-sm'
      : 'bg-white border border-gray-200 text-gray-800'
  }`;
  
  const textContent = document.createElement('div');
  textContent.className = 'whitespace-pre-wrap break-words';
  textContent.textContent = content;
  
  bubble.appendChild(textContent);
  messageDiv.appendChild(bubble);
  
  // Remove "empty state" message if present
  const emptyState = messagesArea.querySelector('.text-center');
  if (emptyState) emptyState.remove();
  
  messagesArea.appendChild(messageDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  
  return messageId;
}

function appendToMessage(messageId, text) {
  const messageDiv = document.getElementById(messageId);
  if (messageDiv) {
    const textContent = messageDiv.querySelector('.whitespace-pre-wrap');
    if (textContent) {
      textContent.textContent += text;
      messagesArea.scrollTop = messagesArea.scrollHeight;
    }
  }
}

function showTypingIndicator() {
  const typingId = `typing-${Date.now()}`;
  const typingDiv = document.createElement('div');
  typingDiv.id = typingId;
  typingDiv.className = 'flex justify-start';
  typingDiv.innerHTML = `
    <div class="bg-white border border-gray-200 rounded-2xl px-4 py-3">
      <div class="flex gap-2">
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
      </div>
    </div>
  `;
  messagesArea.appendChild(typingDiv);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  return typingId;
}

function removeTypingIndicator(typingId) {
  const typingDiv = document.getElementById(typingId);
  if (typingDiv) typingDiv.remove();
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

// Auto-scroll on new messages
const observer = new MutationObserver(() => {
  messagesArea.scrollTop = messagesArea.scrollHeight;
});

observer.observe(messagesArea, { childList: true });

// Add some CSS for smooth animations
const style = document.createElement('style');
style.textContent = `
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  .animate-bounce {
    animation: bounce 1s infinite;
  }
`;
document.head.appendChild(style);
