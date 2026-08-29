function mountChatPanel(container, { contextType, contextId }) {
  container.innerHTML = `
    <div class="chat-panel">
      <h2>AI Assistant</h2>
      <p class="muted">Use this freely to help with the task. Every message is logged for the study.</p>
      <div class="chat-log" id="chatLog"></div>
      <div class="chat-input-row">
        <textarea id="chatInput" placeholder="Ask the assistant for help..."></textarea>
        <button class="btn" id="chatSend">Send</button>
      </div>
      <div class="error" id="chatError"></div>
    </div>
  `;

  const log = container.querySelector('#chatLog');
  const input = container.querySelector('#chatInput');
  const sendBtn = container.querySelector('#chatSend');
  const errorEl = container.querySelector('#chatError');

  function renderMsg(role, text) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    div.appendChild(bubble);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  async function loadHistory() {
    try {
      const { history } = await api.get(
        `/api/ai/history?contextType=${contextType}&contextId=${contextId || ''}`
      );
      history.forEach((m) => renderMsg(m.role, m.content));
    } catch (e) { /* ignore */ }
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;
    errorEl.textContent = '';
    renderMsg('user', text);
    try {
      const { reply } = await api.post('/api/ai/chat', { message: text, contextType, contextId });
      renderMsg('assistant', reply);
    } catch (e) {
      errorEl.textContent = e.message;
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  loadHistory();
}
