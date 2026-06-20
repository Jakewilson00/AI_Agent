(function () {
  'use strict';

  const script = document.currentScript;
  const API_URL = (script && script.dataset.apiUrl
    ? script.dataset.apiUrl.replace(/\/$/, '')
    : 'http://localhost:8000');

  const sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'sess-' + Date.now().toString(36) + Math.random().toString(36).slice(2);

  // ── Styles ───────────────────────────────────────────────────────────────
  const CSS = `
    #cw-bubble {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: #2D6A4F;
      box-shadow: 0 4px 16px rgba(45,106,79,0.45);
      cursor: pointer; border: none; z-index: 9998;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #cw-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 22px rgba(45,106,79,0.55);
    }
    #cw-bubble svg { pointer-events: none; }

    #cw-panel {
      position: fixed; bottom: 92px; right: 24px;
      width: 380px; height: 520px;
      background: #F4F9F6; border-radius: 16px;
      box-shadow: 0 8px 48px rgba(0,0,0,0.18);
      display: flex; flex-direction: column; overflow: hidden;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px; color: #1a1a1a;
      opacity: 0; transform: translateY(16px) scale(0.97);
      pointer-events: none;
      transition: opacity 0.22s ease, transform 0.22s ease;
    }
    #cw-panel.cw-open {
      opacity: 1; transform: translateY(0) scale(1); pointer-events: all;
    }

    /* Header */
    #cw-header {
      background: #1B4332; color: #fff;
      padding: 14px 16px;
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    #cw-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: #40916C;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    #cw-header-text { flex: 1; line-height: 1.3; }
    #cw-header-name { font-weight: 600; font-size: 14px; }
    #cw-header-sub  { font-size: 11px; color: #95D5B2; margin-top: 1px; }
    #cw-online-dot  {
      width: 8px; height: 8px; border-radius: 50%;
      background: #52B788; display: inline-block; margin-right: 5px;
    }
    #cw-close {
      background: none; border: none; color: #95D5B2;
      cursor: pointer; padding: 4px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.15s;
    }
    #cw-close:hover { color: #fff; }

    /* Messages */
    #cw-messages {
      flex: 1; overflow-y: auto;
      padding: 16px; display: flex; flex-direction: column; gap: 12px;
      scroll-behavior: smooth;
    }
    #cw-messages::-webkit-scrollbar { width: 4px; }
    #cw-messages::-webkit-scrollbar-track { background: transparent; }
    #cw-messages::-webkit-scrollbar-thumb { background: #B7E4C7; border-radius: 4px; }

    .cw-row { display: flex; flex-direction: column; max-width: 84%; }
    .cw-row.cw-user  { align-self: flex-end; align-items: flex-end; }
    .cw-row.cw-bot   { align-self: flex-start; align-items: flex-start; }

    .cw-msg {
      padding: 10px 14px; border-radius: 14px;
      line-height: 1.55; word-break: break-word;
    }
    .cw-user .cw-msg {
      background: #2D6A4F; color: #fff;
      border-bottom-right-radius: 4px;
    }
    .cw-bot .cw-msg {
      background: #fff; color: #1a1a1a;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
    .cw-bot .cw-msg.cw-handoff {
      background: #FFFBEB; color: #78350F;
      border-left: 3px solid #F59E0B;
    }

    /* Sources */
    .cw-sources { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; }
    .cw-chip {
      font-size: 11px; background: #D8F3DC; color: #1B4332;
      border: 1px solid #B7E4C7; border-radius: 20px;
      padding: 3px 10px; cursor: pointer;
      transition: background 0.15s;
      user-select: none;
    }
    .cw-chip:hover { background: #B7E4C7; }
    .cw-snippet {
      display: none; font-size: 11px; color: #374151;
      background: #F0FDF4; border-left: 3px solid #52B788;
      padding: 6px 10px; margin-top: 4px;
      border-radius: 0 6px 6px 0; line-height: 1.45;
    }
    .cw-snippet.cw-show { display: block; }

    /* Typing indicator */
    .cw-typing {
      padding: 11px 14px; background: #fff;
      border-radius: 14px; border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      display: flex; gap: 5px; align-items: center;
    }
    .cw-typing span {
      width: 7px; height: 7px; border-radius: 50%;
      background: #52B788;
      animation: cw-bounce 1.2s infinite;
    }
    .cw-typing span:nth-child(2) { animation-delay: 0.18s; }
    .cw-typing span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes cw-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
      30%            { transform: translateY(-5px); opacity: 1; }
    }

    /* Intro */
    .cw-intro {
      text-align: center; color: #6B7280; font-size: 13px; padding: 4px 0 8px;
    }
    .cw-intro strong { color: #2D6A4F; }

    /* Footer / input */
    #cw-footer {
      padding: 10px 12px; background: #fff;
      border-top: 1px solid #E8F5EE;
      display: flex; gap: 8px; flex-shrink: 0; align-items: center;
    }
    #cw-input {
      flex: 1; border: 1.5px solid #B7E4C7; border-radius: 10px;
      padding: 9px 13px; font-size: 14px; outline: none;
      color: #1a1a1a; background: #F4F9F6;
      font-family: inherit;
      transition: border-color 0.2s, background 0.2s;
    }
    #cw-input:focus { border-color: #40916C; background: #fff; }
    #cw-input::placeholder { color: #9CA3AF; }
    #cw-input:disabled { opacity: 0.6; }
    #cw-send {
      width: 40px; height: 40px; border-radius: 10px;
      background: #2D6A4F; border: none; cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s, transform 0.1s;
    }
    #cw-send:hover   { background: #40916C; }
    #cw-send:active  { transform: scale(0.92); }
    #cw-send:disabled { background: #B7E4C7; cursor: not-allowed; }

    /* Responsive */
    @media (max-width: 440px) {
      #cw-panel {
        width: calc(100vw - 16px); right: 8px;
        bottom: 80px; height: 72vh;
      }
      #cw-bubble { bottom: 16px; right: 16px; }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // ── HTML ─────────────────────────────────────────────────────────────────
  const CHAT_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  const CLOSE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const SEND_ICON = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  const bubble = document.createElement('button');
  bubble.id = 'cw-bubble';
  bubble.setAttribute('aria-label', 'Open chat assistant');
  bubble.innerHTML = CHAT_ICON;

  const panel = document.createElement('div');
  panel.id = 'cw-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Chat assistant');
  panel.innerHTML = `
    <div id="cw-header">
      <div id="cw-avatar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      </div>
      <div id="cw-header-text">
        <div id="cw-header-name">Company Assistant</div>
        <div id="cw-header-sub"><span id="cw-online-dot"></span>Online &mdash; ask me anything</div>
      </div>
      <button id="cw-close" aria-label="Close chat">${CLOSE_ICON}</button>
    </div>
    <div id="cw-messages">
      <div class="cw-intro">
        Hi there! Ask me anything about<br><strong>our products &amp; services</strong>.
      </div>
    </div>
    <div id="cw-footer">
      <input id="cw-input" type="text" placeholder="Ask a question…" autocomplete="off" maxlength="500" />
      <button id="cw-send" aria-label="Send message">${SEND_ICON}</button>
    </div>
  `;

  document.body.appendChild(bubble);
  document.body.appendChild(panel);

  // ── Refs & state ─────────────────────────────────────────────────────────
  const msgList = document.getElementById('cw-messages');
  const input   = document.getElementById('cw-input');
  const sendBtn = document.getElementById('cw-send');
  let isOpen    = false;
  let isWaiting = false;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function scrollBottom() { msgList.scrollTop = msgList.scrollHeight; }

  function appendUser(text) {
    const row = document.createElement('div');
    row.className = 'cw-row cw-user';
    row.innerHTML = `<div class="cw-msg">${escHtml(text)}</div>`;
    msgList.appendChild(row);
    scrollBottom();
  }

  function appendBot(text, sources, handoff) {
    const row = document.createElement('div');
    row.className = 'cw-row cw-bot';

    const msg = document.createElement('div');
    msg.className = 'cw-msg' + (handoff ? ' cw-handoff' : '');
    msg.textContent = text;
    row.appendChild(msg);

    if (sources && sources.length) {
      const chips = document.createElement('div');
      chips.className = 'cw-sources';
      sources.forEach(src => {
        const chip = document.createElement('span');
        chip.className = 'cw-chip';
        chip.textContent = '📄 ' + src.source;

        const snip = document.createElement('div');
        snip.className = 'cw-snippet';
        snip.textContent = src.snippet;

        chip.addEventListener('click', () => {
          snip.classList.toggle('cw-show');
          scrollBottom();
        });
        chips.appendChild(chip);
        row.appendChild(snip);
      });
      row.appendChild(chips);
    }

    msgList.appendChild(row);
    scrollBottom();
  }

  function showTyping() {
    const row = document.createElement('div');
    row.className = 'cw-row cw-bot';
    row.id = 'cw-typing-row';
    row.innerHTML = `<div class="cw-typing"><span></span><span></span><span></span></div>`;
    msgList.appendChild(row);
    scrollBottom();
  }

  function removeTyping() {
    const el = document.getElementById('cw-typing-row');
    if (el) el.remove();
  }

  // ── API call ──────────────────────────────────────────────────────────────
  async function send(text) {
    if (!text.trim() || isWaiting) return;
    isWaiting = true;
    sendBtn.disabled = true;
    input.disabled = true;

    appendUser(text);
    showTyping();

    try {
      const res = await fetch(API_URL + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      removeTyping();
      appendBot(data.answer, data.sources, data.handoff);
    } catch {
      removeTyping();
      appendBot("Sorry, I couldn't reach the server right now. Please try again.", [], false);
    } finally {
      isWaiting = false;
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  // ── Toggle open/close ─────────────────────────────────────────────────────
  function openPanel() {
    isOpen = true;
    panel.classList.add('cw-open');
    bubble.innerHTML = CLOSE_ICON;
    bubble.setAttribute('aria-label', 'Close chat assistant');
    setTimeout(() => input.focus(), 230);
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove('cw-open');
    bubble.innerHTML = CHAT_ICON;
    bubble.setAttribute('aria-label', 'Open chat assistant');
  }

  // ── Events ────────────────────────────────────────────────────────────────
  bubble.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  document.getElementById('cw-close').addEventListener('click', closePanel);

  sendBtn.addEventListener('click', () => {
    const text = input.value.trim();
    input.value = '';
    send(text);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();
      input.value = '';
      send(text);
    }
  });

})();
