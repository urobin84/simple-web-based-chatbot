const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const sendButton = document.getElementById('send-btn');
const clearButton = document.getElementById('clear-chat');
const micButton = document.getElementById('mic-btn');
const attachFileButton = document.getElementById('attach-file-btn');
const fileInput = document.getElementById('file-input');
const attachmentPreviewContainer = document.getElementById('attachment-preview-container');

let conversationHistory = [];
let attachedFile = null; // State for the attached file

// Save history to localStorage
function saveHistory() {
  // Create a version of the history for storage that doesn't include large file data.
  const historyForStorage = conversationHistory.map(turn => {
    const newParts = turn.parts.map(part => {
      if (part.inlineData) {
        // Replace large file data with a placeholder for storage.
        const fileName = part.inlineData.fileName || 'file';
        return { text: `[Attachment: ${fileName}]` };
      }
      return part;
    });
    return { ...turn, parts: newParts };
  });

  try {
    localStorage.setItem('chatHistory', JSON.stringify(historyForStorage));
  } catch (error) {
    console.error('Failed to save history, it might be too large.', error);
    alert('Could not save conversation history, it has grown too large.');
  }
}

// Load and render history from localStorage
function loadAndRenderHistory() {
  const savedHistory = localStorage.getItem('chatHistory');
  if (savedHistory) {
    conversationHistory = JSON.parse(savedHistory);
  }

  chatBox.innerHTML = ''; // Clear the chatbox to render fresh

  if (conversationHistory.length > 0) {
    conversationHistory.forEach(item => {
      const sender = item.role === 'model' ? 'bot' : 'user';
      let textContent = '';
      let fileForDisplay = null;

      // Loop through parts to find text and image data for rendering
      for (const part of item.parts) {
        if (part.text) {
          textContent = part.text;
        } else if (part.inlineData) { // This block will no longer be hit after a page refresh
          // This logic is kept for in-session history, but won't work for reloaded history.
        }
      }
      appendMessage(sender, textContent, fileForDisplay);
    });
  } else {
    // If no history exists, show a welcome message
    appendMessage('bot', 'Hello! How can I help you today?');
  }
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  // Allow submission if there is a message OR an attached file
  if (!userMessage && !attachedFile) return;

  // Capture the attached file for this submission, as the global one will be cleared for the UI.
  const submissionFile = attachedFile;

  appendMessage('user', userMessage, attachedFile);

  input.value = '';
  removeAttachment();

  setFormDisabled(true);
  const botMessageElement = appendMessage('bot', '...');
  botMessageElement.classList.add('typing-indicator');

  try {
    const formData = new FormData();
    formData.append('message', userMessage);

    // Create a clean version of the history for the API, removing any client-side-only properties.
    const historyForAPI = conversationHistory.map(turn => ({
      ...turn,
      parts: turn.parts.map(part => {
        // The Gemini API only accepts 'mimeType' and 'data' in 'inlineData'.
        // We must strip any other properties (like 'fileName') before sending.
        if (part.inlineData) {
          return {
            inlineData: { mimeType: part.inlineData.mimeType, data: part.inlineData.data }
          };
        }
        return part;
      })
    }));
    formData.append('history', JSON.stringify(historyForAPI));

    if (submissionFile) {
      formData.append('file', submissionFile.fileObject);
    }

    const res = await fetch('/api/chat', {
      method: 'POST',
      // The browser will set the correct 'Content-Type' for FormData
      body: formData,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Something went wrong.' }));
      throw new Error(errorData.error);
    }

    // Handle the streaming response
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    botMessageElement.textContent = ''; // Clear the '...'
    botMessageElement.classList.remove('typing-indicator');

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;
      // For performance, just update text content during stream
      botMessageElement.textContent = fullResponse;
      chatBox.scrollTop = chatBox.scrollHeight; // Keep scrolled to bottom
    }

    // Final processing: render markdown, highlight code, and add copy buttons
    enhanceBotMessage(botMessageElement, fullResponse);

    // Add messages to history for context in next turn
    const userParts = [];
    if (userMessage) {
      userParts.push({ text: userMessage });
    }
    if (submissionFile) {
      userParts.push({
        inlineData: {
          mimeType: submissionFile.mimeType,
          data: submissionFile.data,
          fileName: submissionFile.fileName // Pass filename for history placeholder
        }
      });
    }
    conversationHistory.push({ role: 'user', parts: userParts });
    conversationHistory.push({ role: 'model', parts: [{ text: fullResponse }] });
    saveHistory();
  } catch (error) {
    console.error(error);
    botMessageElement.innerHTML = `Error: ${error.message}`;
    botMessageElement.style.backgroundColor = '#f8d7da';
    botMessageElement.style.color = '#721c24';
  } finally {
    botMessageElement.classList.remove('typing-indicator');
    setFormDisabled(false);
    input.focus();
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

function appendMessage(sender, text, file = null) {
  const messageRow = document.createElement('div');
  messageRow.classList.add('message-row', sender);

  const msg = document.createElement('div');
  msg.classList.add('message');

  if (sender === 'bot') {
    enhanceBotMessage(msg, text);
  } else {
    // Handle user message with potential file
    if (file) {
      if (file.mimeType && file.mimeType.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = file.previewUrl;
        img.style.maxWidth = '200px';
        img.style.borderRadius = '8px';
        img.style.display = 'block';
        if (text) img.style.marginBottom = '8px';
        msg.appendChild(img);
      } else {
        // Generic display for non-image files in the chat message
        const icon = file.mimeType && file.mimeType.startsWith('audio/') ? '🎵' : '📄';
        const fileName = file.fileObject ? file.fileObject.name : 'Attached File';
        const fileDiv = document.createElement('div');
        fileDiv.className = 'message-file-attachment';
        fileDiv.innerHTML = `<span class="file-icon">${icon}</span> <span class="file-name">${fileName}</span>`;
        if (text) fileDiv.style.marginBottom = '8px';
        msg.appendChild(fileDiv);
      }
    }
    if (text) {
      const p = document.createElement('p');
      p.textContent = text;
      p.style.margin = 0;
      msg.appendChild(p);
    }
  }

  messageRow.appendChild(msg);
  chatBox.appendChild(messageRow);
  chatBox.scrollTop = chatBox.scrollHeight;

  return msg;
}

function setFormDisabled(disabled) {
  input.disabled = disabled;
  sendButton.disabled = disabled;
  micButton.disabled = disabled;
  attachFileButton.disabled = disabled;
}

clearButton.addEventListener('click', () => {
  chatBox.innerHTML = '';
  conversationHistory = [];
  saveHistory();
  appendMessage('bot', 'Chat cleared. How can I help you?');
  input.focus();
});

// Initial load of the chat history
loadAndRenderHistory();

// --- File Attachment ---
attachFileButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const supportedMimeTypes = ['image/', 'audio/', 'application/pdf'];
  const isSupported = supportedMimeTypes.some(prefix => file.type.startsWith(prefix)) || file.type === 'application/pdf';

  if (!isSupported) {
    alert('Please select a supported file type (Image, Audio, PDF).');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    attachedFile = {
      fileObject: file, // Store the raw file object for upload
      fileName: file.name,
      mimeType: file.type,
      data: e.target.result.split(',')[1], // Get base64 part
      previewUrl: e.target.result
    };
    showAttachmentPreview();
  };
  reader.readAsDataURL(file);
});

function showAttachmentPreview() {
  if (!attachedFile) return;

  let previewHTML = '';
  const fileType = attachedFile.mimeType;
  const fileName = attachedFile.fileObject.name;

  if (fileType.startsWith('image/')) {
    previewHTML = `<img src="${attachedFile.previewUrl}" id="attachment-preview-img" alt="Attachment Preview">`;
  } else {
    const icon = fileType.startsWith('audio/') ? '🎵' : '📄';
    previewHTML = `
      <div class="file-preview">
        <span class="file-preview-icon">${icon}</span>
        <span class="file-preview-name" title="${fileName}">${fileName}</span>
      </div>
    `;
  }

  attachmentPreviewContainer.innerHTML = `
    ${previewHTML}
    <button id="remove-attachment-btn">×</button>
  `;
  attachmentPreviewContainer.style.display = 'block';
  document.getElementById('remove-attachment-btn').addEventListener('click', removeAttachment);
  input.placeholder = 'Ask a question about the file...';
}

function removeAttachment() {
  attachedFile = null;
  fileInput.value = ''; // Reset file input
  attachmentPreviewContainer.innerHTML = '';
  attachmentPreviewContainer.style.display = 'none';
  input.placeholder = 'Type your message...';
}

// --- Voice Input (Web Speech API) ---
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  micButton.addEventListener('click', () => {
    recognition.start();
  });

  recognition.addEventListener('start', () => {
    setFormDisabled(true);
    micButton.classList.add('listening');
    micButton.textContent = '...';
    input.placeholder = 'Listening...';
  });

  recognition.addEventListener('result', (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
  });

  recognition.addEventListener('end', () => {
    setFormDisabled(false);
    micButton.classList.remove('listening');
    micButton.textContent = '🎤';
    input.placeholder = 'Type your message...';
  });

  recognition.addEventListener('error', (event) => {
    alert(`Voice recognition error: ${event.error}`);
  });
} else {
  console.warn('Speech recognition not supported in this browser.');
  micButton.style.display = 'none';
}

/**
 * Processes a bot message to render Markdown, apply syntax highlighting,
 * and add copy-to-clipboard buttons to code blocks.
 * @param {HTMLElement} element The message element to enhance.
 * @param {string} text The raw text content of the message.
 */
function enhanceBotMessage(element, text) {
  element.innerHTML = DOMPurify.sanitize(marked.parse(text));

  element.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
  });

  element.querySelectorAll('pre').forEach(pre => {
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-code-btn';
    copyButton.textContent = 'Copy';
    pre.appendChild(copyButton);

    copyButton.addEventListener('click', () => {
      const codeToCopy = pre.querySelector('code').textContent;
      navigator.clipboard.writeText(codeToCopy).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => { copyButton.textContent = 'Copy'; }, 2000);
      });
    });
  });
}
