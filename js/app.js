// app.js — 主应用：UI 初始化、事件绑定、会话管理、流式聊天
(function () {
  'use strict';

  const { $, $all, el, uid, toast, escapeHtml, debounce, formatTime,
          copyText, download, normalizeBaseUrl, parseModelList, truncate } = utils;

  const PROVIDERS = [
    { id: 'qnaigc', name: 'qnaigc 中转', emoji: '\u{1F680}', baseUrl: 'https://api.qnaigc.com/v1' },
    { id: 'openai', name: 'OpenAI', emoji: '\u{1F7E2}', baseUrl: 'https://api.openai.com/v1' },
    { id: 'deepseek', name: 'DeepSeek', emoji: '\u{1F535}', baseUrl: 'https://api.deepseek.com/v1' },
    { id: 'moonshot', name: 'Moonshot \u6708\u4e4b\u6697\u9762', emoji: '\u{1F319}', baseUrl: 'https://api.moonshot.cn/v1' },
    { id: 'groq', name: 'Groq', emoji: '\u26A1', baseUrl: 'https://api.groq.com/openai/v1' },
    { id: 'openrouter', name: 'OpenRouter', emoji: '\u{1F500}', baseUrl: 'https://openrouter.ai/api/v1' },
    { id: 'custom', name: '\u81ea\u5b9a\u4e49\u7aef\u70b9', emoji: '\u{1F527}', baseUrl: '' }
  ];

  const state = {
    sessions: [], endpoints: [], presets: [], settings: {},
    currentSessionId: null, activePresetTab: 'role',
    editingEndpointId: null, editingProvider: null, editingPresetId: null,
    systemPrompt: '', systemPromptName: '', attachedImage: null,
    abortController: null, isStreaming: false, sidebarCollapsed: false
  };

  function init() {
    state.sessions = Store.getSessions();
    state.endpoints = Store.getEndpoints();
    state.presets = Store.getPresets();
    state.settings = Store.getSettings();
    state.sidebarCollapsed = state.settings.sidebarCollapsed || false;
    applyTheme(state.settings.theme);
    applySidebarState();
    loadSettingsToForm();
    renderEndpointList();
    renderSessionList();
    renderModelSelect();
    openLastSession();
    bindEvents();
    registerSW();
    autoResizeInput();
  }

  function applyTheme(theme) {
    let t = theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;
    document.documentElement.setAttribute('data-theme', t);
  }

  function applySidebarState() {
    $('#sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
  }

  function openModal(m) { m.hidden = false; $('#modal-backdrop').hidden = false; }
  function closeModal(m) { m.hidden = true; if (!$all('.modal').some(x => !x.hidden)) $('#modal-backdrop').hidden = true; }
  function closeTopModal() { const o = $all('.modal').filter(x => !x.hidden); if (o.length) closeModal(o[o.length - 1]); }

  function bindEvents() {
    $('#btn-new-chat').addEventListener('click', newChat);
    $('#btn-settings').addEventListener('click', () => openModal($('#settings-modal')));
    $('#btn-presets').addEventListener('click', () => { renderPresetList(); openModal($('#presets-modal')); });
    $('#btn-toggle-sidebar').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#btn-collapse-sidebar').addEventListener('click', toggleSidebarCollapse);
    $('#search-input').addEventListener('input', debounce(onSearch, 150));
    $all('[data-close]').forEach(b => b.addEventListener('click', () => { const m = b.closest('.modal'); if (m) closeModal(m); }));
    $('#modal-backdrop').addEventListener('click', closeTopModal);
    $('#btn-add-endpoint').addEventListener('click', () => openEndpointModal(null, PROVIDERS.find(p => p.id === 'custom')));
    $('#set-temperature').addEventListener('input', saveSettingsFromForm);
    $('#set-max-tokens').addEventListener('input', saveSettingsFromForm);
    $('#set-theme').addEventListener('change', () => { saveSettingsFromForm(); applyTheme(state.settings.theme); });
    $('#set-voice-lang').addEventListener('change', saveSettingsFromForm);
    $('#set-tts-enabled').addEventListener('change', saveSettingsFromForm);
    $('#btn-export-all').addEventListener('click', exportAll);
    $('#btn-clear-all').addEventListener('click', clearAll);
    $('#btn-save-endpoint').addEventListener('click', saveEndpoint);
    $('#btn-fetch-models').addEventListener('click', fetchModels);
    $('#preset-tabs').addEventListener('click', (e) => {
      const t = e.target.closest('.tab'); if (!t) return;
      state.activePresetTab = t.dataset.tab;
      $all('#preset-tabs .tab').forEach(x => x.classList.toggle('active', x === t));
      renderPresetList();
    });
    $('#btn-add-preset').addEventListener('click', () => openPresetModal(null));
    $('#btn-save-preset').addEventListener('click', savePreset);
    $('#btn-chat-menu').addEventListener('click', toggleChatMenu);
    $('#btn-send').addEventListener('click', sendMessage);
    $('#btn-stop').addEventListener('click', stopGeneration);
    $('#model-select').addEventListener('change', onModelChange);
    $('#btn-clear-system').addEventListener('click', clearSystemPrompt);
    $('#btn-attach').addEventListener('click', () => toast('\u8bf7\u76f4\u63a5 Ctrl+V \u7c98\u8d34\u56fe\u7247'));
    $('#btn-voice').addEventListener('click', toggleVoice);
    const input = $('#input');
    input.addEventListener('input', autoResizeInput);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
    document.addEventListener('paste', onPaste);
    document.addEventListener('click', (e) => {
      const menu = $('#chat-menu');
      if (!menu.hidden && !menu.contains(e.target) && e.target.id !== 'btn-chat-menu') menu.hidden = true;
      if (!$('#search-results').hidden && !$('#search-results').contains(e.target) && e.target.id !== 'search-input') $('#search-results').hidden = true;
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTopModal(); });
  }

  function toggleSidebarCollapse() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    state.settings.sidebarCollapsed = state.sidebarCollapsed;
    Store.saveSettings(state.settings);
    applySidebarState();
  }

  function loadSettingsToForm() {
    const s = state.settings;
    $('#set-temperature').value = s.temperature;
    $('#set-max-tokens').value = s.maxTokens;
    $('#set-theme').value = s.theme;
    $('#set-voice-lang').value = s.voiceLang;
    $('#set-tts-enabled').checked = s.ttsEnabled;
  }
  function saveSettingsFromForm() {
    state.settings.temperature = parseFloat($('#set-temperature').value) || 0.7;
    state.settings.maxTokens = parseInt($('#set-max-tokens').value) || 2048;
    state.settings.theme = $('#set-theme').value;
    state.settings.voiceLang = $('#set-voice-lang').value;
    state.settings.ttsEnabled = $('#set-tts-enabled').checked;
    Store.saveSettings(state.settings);
  }
  function exportAll() {
    try { download('ai-chat-export.json', JSON.stringify(Store.exportAll(), null, 2), 'application/json'); toast('\u5df2\u5bfc\u51fa'); }
    catch (e) { toast('\u5bfc\u51fa\u5931\u8d25', true); }
  }
  function clearAll() {
    if (!confirm('\u786e\u5b9a\u6e05\u7a7a\u6240\u6709\u6570\u636e\uff1f')) return;
    Store.clearAll();
    state.sessions = []; state.endpoints = []; state.presets = [];
    state.settings = Store.getSettings(); state.currentSessionId = null;
    renderSessionList(); renderEndpointList(); renderModelSelect(); loadSettingsToForm();
    $('#messages').innerHTML = ''; $('#chat-title').textContent = '\u65b0\u5bf9\u8bdd';
    closeModal($('#settings-modal')); toast('\u5df2\u6e05\u7a7a');
  }

  // ---- \u7aef\u70b9 ----
  function renderEndpointList() {
    const list = $('#endpoint-list'); list.innerHTML = '';
    PROVIDERS.forEach(p => {
      const configured = state.endpoints.find(e => p.baseUrl && e.baseUrl === p.baseUrl);
      const card = el('div', 'endpoint-card');
      const head = el('div', 'ep-head');
      const info = el('div');
      info.appendChild(el('div', 'ep-name', p.emoji + ' ' + p.name));
      info.appendChild(el('div', 'ep-base', configured
        ? '\u2705 \u5df2\u914d\u7f6e \u00b7 ' + (configured.models ? configured.models.length : 0) + ' \u4e2a\u6a21\u578b'
        : (p.baseUrl || '\u81ea\u5b9a\u4e49')));
      const actions = el('div', 'ep-actions');
      if (configured) {
        const eb = el('button', 'btn btn-outline btn-sm', '\u4fee\u6539 Key');
        eb.addEventListener('click', () => openEndpointModal(configured.id));
        const db = el('button', 'btn btn-icon btn-sm', '\u{1F5D1}');
        db.addEventListener('click', () => deleteEndpoint(configured.id));
        actions.appendChild(eb); actions.appendChild(db);
      } else {
        const ab = el('button', 'btn btn-primary btn-sm', '\u914d\u7f6e');
        ab.addEventListener('click', () => openEndpointModal(null, p));
        actions.appendChild(ab);
      }
      head.appendChild(info); head.appendChild(actions); card.appendChild(head);
      list.appendChild(card);
    });
  }

  function openEndpointModal(id, preset) {
    state.editingEndpointId = id || null;
    state.editingProvider = preset || null;
    const ep = id ? state.endpoints.find(e => e.id === id) : null;
    const provider = ep ? PROVIDERS.find(p => p.baseUrl === ep.baseUrl) : preset;
    $('#endpoint-modal-title').textContent = provider ? (provider.emoji + ' ' + provider.name) : '\u81ea\u5b9a\u4e49\u7aef\u70b9';
    $('#ep-name').closest('.field').style.display = 'none';
    $('#ep-base').closest('.field').style.display = 'none';
    $('#ep-models').closest('.field').style.display = 'none';
    $('#btn-fetch-models').style.display = 'none';
    $('#ep-key').value = ep ? (ep.apiKey || '') : '';
    $('#ep-key').placeholder = '\u7c98\u8d34 API Key\uff08sk-...\uff09';
    openModal($('#endpoint-modal'));
    setTimeout(() => $('#ep-key').focus(), 100);
  }

  async function saveEndpoint() {
    const apiKey = $('#ep-key').value.trim();
    if (!apiKey) { toast('\u8bf7\u586b\u5199 API Key', true); return; }
    let baseUrl, name;
    if (state.editingProvider && state.editingProvider.baseUrl) {
      baseUrl = state.editingProvider.baseUrl; name = state.editingProvider.name;
    } else if (state.editingEndpointId) {
      const ep = state.endpoints.find(e => e.id === state.editingEndpointId);
      if (ep) { baseUrl = ep.baseUrl; name = ep.name; }
    } else { toast('\u8bf7\u9009\u62e9\u670d\u52a1\u5546', true); return; }
    toast('\u6b63\u5728\u62c9\u53d6\u6a21\u578b\u5217\u8868\u2026');
    let models = [];
    try { models = await ChatClient.listModels({ baseUrl, apiKey }); }
    catch (e) { if (!confirm('\u6a21\u578b\u62c9\u53d6\u5931\u8d25\uff1a' + e.message + '\n\u4ecd\u8981\u4fdd\u5b58\u5417\uff1f')) return; }
    if (state.editingEndpointId) {
      const ep = state.endpoints.find(e => e.id === state.editingEndpointId);
      if (ep) { ep.apiKey = apiKey; ep.models = models; }
    } else {
      state.endpoints.push({ id: uid(), name, baseUrl, apiKey, models });
    }
    Store.saveEndpoints(state.endpoints);
    renderEndpointList(); renderModelSelect();
    closeModal($('#endpoint-modal'));
    toast(models.length ? ('\u5df2\u4fdd\u5b58\uff0c' + models.length + ' \u4e2a\u6a21\u578b') : '\u5df2\u4fdd\u5b58');
  }

  function deleteEndpoint(id) {
    if (!confirm('\u5220\u9664\u6b64\u7aef\u70b9\uff1f')) return;
    state.endpoints = state.endpoints.filter(e => e.id !== id);
    Store.saveEndpoints(state.endpoints); renderEndpointList(); renderModelSelect();
  }
  async function fetchModels() {
    const baseUrl = normalizeBaseUrl($('#ep-base').value);
    const apiKey = $('#ep-key').value.trim();
    if (!baseUrl || !apiKey) { toast('\u8bf7\u5148\u586b\u5199 Base URL \u548c API Key', true); return; }
    try { toast('\u62c9\u53d6\u5230 ' + (await ChatClient.listModels({ baseUrl, apiKey })).length + ' \u4e2a\u6a21\u578b'); }
    catch (e) { toast(e.message || '\u62c9\u53d6\u5931\u8d25', true); }
  }

  function renderModelSelect() {
    const sel = $('#model-select'); sel.innerHTML = '';
    if (!state.endpoints.length) { sel.innerHTML = '<option value="">\u8bf7\u5148\u914d\u7f6e\u7aef\u70b9</option>'; return; }
    const saved = state.settings.lastModelId; let hasSaved = false;
    state.endpoints.forEach(ep => {
      if (!ep.models) return;
      ep.models.forEach(m => {
        const opt = el('option', null, (ep.name || ep.baseUrl) + ' \u00b7 ' + m);
        opt.value = JSON.stringify({ endpointId: ep.id, model: m });
        sel.appendChild(opt);
        if (saved === opt.value) hasSaved = true;
      });
    });
    if (hasSaved) sel.value = saved;
  }
  function onModelChange() { state.settings.lastModelId = $('#model-select').value; Store.saveSettings(state.settings); }
  function getCurrentModel() {
    const v = $('#model-select').value; if (!v) return null;
    try { return JSON.parse(v); } catch (e) { return null; }
  }

  function newChat() {
    state.currentSessionId = null;
    state.systemPrompt = ''; state.systemPromptName = ''; state.attachedImage = null;
    $('#messages').innerHTML = '';
    $('#chat-title').textContent = '\u65b0\u5bf9\u8bdd'; $('#chat-subtitle').textContent = '';
    $('#system-prompt-bar').hidden = true;
    hideImgPreview();
    showEmptyState(); renderSessionList();
  }
  function openLastSession() {
    const id = state.settings.lastSessionId;
    if (id && state.sessions.find(s => s.id === id)) openSession(id); else showEmptyState();
  }
  function openSession(id) {
    const s = state.sessions.find(x => x.id === id); if (!s) return;
    state.currentSessionId = id;
    state.systemPrompt = s.systemPrompt || ''; state.systemPromptName = s.systemPromptName || '';
    renderMessages(s);
    $('#chat-title').textContent = s.title || '\u65b0\u5bf9\u8bdd';
    if (state.systemPrompt) { $('#system-prompt-preview').textContent = state.systemPromptName || state.systemPrompt; $('#system-prompt-bar').hidden = false; }
    else $('#system-prompt-bar').hidden = true;
    renderSessionList();
  }
  function renderSessionList() {
    const list = $('#session-list'); list.innerHTML = '';
    [...state.sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(s => {
      const item = el('div', 'session-item' + (s.id === state.currentSessionId ? ' active' : ''));
      item.addEventListener('click', () => openSession(s.id));
      const info = el('div', 'si-info');
      info.appendChild(el('div', 'si-title', s.title || '\u65b0\u5bf9\u8bdd'));
      info.appendChild(el('div', 'si-meta', formatTime(s.updatedAt || s.createdAt)));
      item.appendChild(info); list.appendChild(item);
    });
  }
  function showEmptyState() {
    const m = $('#messages'); m.innerHTML = '';
    const es = el('div', 'empty-state');
    es.appendChild(el('div', 'es-icon', '\u{1F4AC}'));
    es.appendChild(el('div', 'es-title', '\u5f00\u59cb\u65b0\u5bf9\u8bdd'));
    es.appendChild(el('div', 'es-hint', '\u5728\u4e0b\u65b9\u8f93\u5165\u6d88\u606f\u5f00\u59cb\u804a\u5929\u3002\u9996\u6b21\u4f7f\u7528\u8bf7\u5148\u5230\u8bbe\u7f6e\u4e2d\u914d\u7f6e API Key\u3002'));
    m.appendChild(es);
  }

  function renderMessage(m, idx) {
    const msgs = $('#messages');
    const row = el('div', 'msg ' + (m.role === 'user' ? 'user' : 'assistant'));
    if (m.role === 'assistant') row.appendChild(el('div', 'avatar', 'AI'));
    const msgRow = el('div', 'msg-row');
    const bubble = el('div', 'msg-bubble');

    if (m.role === 'user') {
      if (m.images) m.images.forEach(img => {
        const im = el('img'); im.src = img; im.style.cssText = 'max-width:200px;border-radius:8px;display:block;margin-bottom:6px;';
        bubble.appendChild(im);
      });
      bubble.appendChild(el('div', 'msg-content', m.content));
    } else {
      if (m.thinking) {
        const thinkDiv = el('div', 'thinking collapsed');
        const toggle = el('div', 'thinking-toggle', '\u601d\u8003\u8fc7\u7a0b');
        const body = el('div', 'thinking-body', m.thinking);
        thinkDiv.appendChild(toggle); thinkDiv.appendChild(body);
        toggle.addEventListener('click', () => thinkDiv.classList.toggle('expanded'));
        bubble.appendChild(thinkDiv);
      }
      const c = el('div', 'msg-content'); c.innerHTML = MD.render(m.content || '');
      bubble.appendChild(c);
    }

    msgRow.appendChild(bubble);

    // \u6d88\u606f\u64cd\u4f5c\u680f
    const actions = el('div', 'msg-actions');
    if (m.content) {
      const copyBtn = el('button', 'btn-mini', '\u{1F4CB} \u590d\u5236');
      copyBtn.addEventListener('click', () => copyText(m.content).then(() => toast('\u5df2\u590d\u5236')));
      actions.appendChild(copyBtn);
    }
    if (m.role === 'assistant' && m.content) {
      const branchBtn = el('button', 'btn-mini', '\u{1F33F} \u5206\u652f');
      branchBtn.title = '\u4ece\u6b64\u5904\u5206\u652f\u65b0\u5bf9\u8bdd';
      branchBtn.addEventListener('click', () => branchFromMessage(idx));
      actions.appendChild(branchBtn);
      const regenBtn = el('button', 'btn-mini', '\u{1F504} \u91cd\u65b0\u751f\u6210');
      regenBtn.addEventListener('click', () => regenerateLast());
      actions.appendChild(regenBtn);
    }
    msgRow.appendChild(actions);
    row.appendChild(msgRow);
    msgs.appendChild(row);
  }

  function renderMessages(sess) {
    const m = $('#messages'); m.innerHTML = '';
    if (!sess.messages || !sess.messages.length) { showEmptyState(); return; }
    sess.messages.forEach((msg, i) => renderMessage(msg, i));
    scrollBottom();
  }

  function scrollBottom() { const m = $('#messages'); m.scrollTop = m.scrollHeight; }

  function branchFromMessage(idx) {
    const sess = state.sessions.find(s => s.id === state.currentSessionId); if (!sess) return;
    const parentMsgs = sess.messages.slice(0, idx + 1);
    const newSess = {
      id: uid(), title: truncate(parentMsgs[parentMsgs.length - 1].content || '\u5206\u652f', 30),
      createdAt: Date.now(), updatedAt: Date.now(),
      messages: JSON.parse(JSON.stringify(parentMsgs)),
      systemPrompt: sess.systemPrompt, systemPromptName: sess.systemPromptName
    };
    state.sessions.unshift(newSess); state.currentSessionId = newSess.id;
    Store.saveSessions(state.sessions);
    renderMessages(newSess);
    $('#chat-title').textContent = newSess.title;
    renderSessionList();
    toast('\u5df2\u5206\u652f\u65b0\u5bf9\u8bdd');
  }

  function regenerateLast() {
    const sess = state.sessions.find(s => s.id === state.currentSessionId); if (!sess || !sess.messages.length) return;
    // \u627e\u5230\u6700\u540e\u4e00\u4e2a user \u6d88\u606f\uff0c\u5220\u9664\u4e4b\u540e\u7684 assistant \u6d88\u606f
    let lastUserIdx = -1;
    for (let i = sess.messages.length - 1; i >= 0; i--) { if (sess.messages[i].role === 'user') { lastUserIdx = i; break; } }
    if (lastUserIdx < 0) return;
    sess.messages = sess.messages.slice(0, lastUserIdx + 1);
    renderMessages(sess);
    sendMessage();
  }

  function toggleChatMenu(e) {
    const menu = $('#chat-menu');
    if (!menu.hidden) { menu.hidden = true; return; }
    menu.innerHTML = '';
    const rn = el('button', 'pop-item', '\u91cd\u547d\u540d');
    rn.addEventListener('click', () => {
      menu.hidden = true;
      const s = state.sessions.find(x => x.id === state.currentSessionId); if (!s) return;
      const name = prompt('\u5bf9\u8bdd\u540d\u79f0\uff1a', s.title || '');
      if (name !== null) { s.title = name; Store.saveSessions(state.sessions); $('#chat-title').textContent = name; renderSessionList(); }
    });
    const dl = el('button', 'pop-item danger', '\u5220\u9664\u5bf9\u8bdd');
    dl.addEventListener('click', () => {
      menu.hidden = true; if (!state.currentSessionId) return;
      if (!confirm('\u5220\u9664\u6b64\u5bf9\u8bdd\uff1f')) return;
      state.sessions = state.sessions.filter(x => x.id !== state.currentSessionId);
      Store.saveSessions(state.sessions); newChat();
    });
    menu.appendChild(rn); menu.appendChild(dl);
    const r = $('#btn-chat-menu').getBoundingClientRect();
    menu.style.top = (r.bottom + 6) + 'px';
    menu.style.right = (window.innerWidth - r.right) + 'px';
    menu.hidden = false; e.stopPropagation();
  }

  function onSearch() {
    const q = $('#search-input').value.trim().toLowerCase();
    const box = $('#search-results');
    if (!q) { box.hidden = true; return; }
    const results = state.sessions.filter(s =>
      (s.title || '').toLowerCase().includes(q) ||
      (s.messages || []).some(m => (m.content || '').toLowerCase().includes(q)));
    box.innerHTML = '';
    if (!results.length) box.innerHTML = '<div class="sr-empty">\u65e0\u5339\u914d\u5bf9\u8bdd</div>';
    else results.forEach(s => {
      const item = el('div', 'sr-item', s.title || '\u65b0\u5bf9\u8bdd');
      item.addEventListener('click', () => { openSession(s.id); box.hidden = true; $('#search-input').value = ''; });
      box.appendChild(item);
    });
    box.hidden = false;
  }

  function renderPresetList() {
    const list = $('#preset-list'); list.innerHTML = '';
    const f = state.presets.filter(p => p.kind === state.activePresetTab);
    if (!f.length) { list.innerHTML = '<p class="muted">\u6682\u65e0\u9884\u8bbe\uff0c\u70b9\u51fb\u4e0b\u65b9\u6309\u94ae\u6dfb\u52a0\u3002</p>'; return; }
    f.forEach(p => {
      const card = el('div', 'preset-card');
      const left = el('div');
      left.appendChild(el('div', 'p-name', p.name));
      left.appendChild(el('div', 'p-content', p.content));
      card.appendChild(left);
      const actions = el('div', 'p-actions');
      const ub = el('button', 'btn btn-outline btn-sm', '\u4f7f\u7528');
      ub.addEventListener('click', () => applyPreset(p));
      const eb = el('button', 'btn btn-icon btn-sm', '\u270E');
      eb.addEventListener('click', () => openPresetModal(p.id));
      const db = el('button', 'btn btn-icon btn-sm', '\u{1F5D1}');
      db.addEventListener('click', () => {
        if (!confirm('\u5220\u9664\u6b64\u9884\u8bbe\uff1f')) return;
        state.presets = state.presets.filter(x => x.id !== p.id);
        Store.savePresets(state.presets); renderPresetList();
      });
      actions.appendChild(ub); actions.appendChild(eb); actions.appendChild(db);
      card.appendChild(actions); list.appendChild(card);
    });
  }
  function openPresetModal(id) {
    state.editingPresetId = id;
    const p = id ? state.presets.find(x => x.id === id) : null;
    $('#preset-modal-title').textContent = p ? '\u7f16\u8f91\u9884\u8bbe' : '\u6dfb\u52a0\u9884\u8bbe';
    $('#preset-kind').value = p ? p.kind : state.activePresetTab;
    $('#preset-name').value = p ? (p.name || '') : '';
    $('#preset-content').value = p ? (p.content || '') : '';
    openModal($('#preset-modal'));
  }
  function savePreset() {
    const kind = $('#preset-kind').value, name = $('#preset-name').value.trim(), content = $('#preset-content').value.trim();
    if (!name || !content) { toast('\u8bf7\u586b\u5199\u540d\u79f0\u548c\u5185\u5bb9', true); return; }
    if (state.editingPresetId) {
      const p = state.presets.find(x => x.id === state.editingPresetId);
      if (p) { p.kind = kind; p.name = name; p.content = content; }
    } else state.presets.push({ id: uid(), kind, name, content });
    Store.savePresets(state.presets); renderPresetList();
    closeModal($('#preset-modal')); toast('\u5df2\u4fdd\u5b58');
  }
  function applyPreset(p) {
    if (p.kind === 'role') {
      state.systemPrompt = p.content; state.systemPromptName = p.name;
      $('#system-prompt-preview').textContent = p.name; $('#system-prompt-bar').hidden = false;
      closeModal($('#presets-modal')); toast('\u5df2\u5e94\u7528\uff1a' + p.name);
    } else if (p.kind === 'prompt') {
      $('#input').value = p.content; autoResizeInput();
      closeModal($('#presets-modal')); $('#input').focus();
    } else if (p.kind === 'command') {
      closeModal($('#presets-modal')); $('#input').value = p.content; sendMessage();
    }
  }
  function clearSystemPrompt() { state.systemPrompt = ''; state.systemPromptName = ''; $('#system-prompt-bar').hidden = true; }

  // ---- \u56fe\u7247\u9884\u89c8 ----
  function showImgPreview(src) {
    let bar = $('#composer-img-preview');
    if (!bar) {
      bar = el('div', 'composer-img-preview'); bar.id = 'composer-img-preview';
      $('#composer').insertBefore(bar, $('#composer').firstChild);
    }
    bar.innerHTML = '';
    const im = el('img'); im.src = src; bar.appendChild(im);
    bar.appendChild(el('span', null, '\u5df2\u7c98\u8d34\u56fe\u7247'));
    const x = el('button', null, '\u2715');
    x.addEventListener('click', () => { state.attachedImage = null; hideImgPreview(); });
    bar.appendChild(x);
    bar.hidden = false;
  }
  function hideImgPreview() { const b = $('#composer-img-preview'); if (b) b.hidden = true; }

  async function sendMessage() {
    if (state.isStreaming) return;
    const input = $('#input');
    const text = input.value.trim();
    if (!text && !state.attachedImage) return;
    const mi = getCurrentModel();
    if (!mi) { toast('\u8bf7\u5148\u914d\u7f6e API Key \u5e76\u9009\u62e9\u6a21\u578b', true); return; }
    const endpoint = state.endpoints.find(e => e.id === mi.endpointId);
    if (!endpoint) { toast('\u7aef\u70b9\u4e0d\u5b58\u5728', true); return; }

    let sess = state.sessions.find(s => s.id === state.currentSessionId);
    if (!sess) {
      sess = { id: uid(), title: truncate(text, 30) || '\u65b0\u5bf9\u8bdd', createdAt: Date.now(), updatedAt: Date.now(), messages: [], systemPrompt: state.systemPrompt, systemPromptName: state.systemPromptName };
      state.sessions.unshift(sess); state.currentSessionId = sess.id;
    }
    const userMsg = { role: 'user', content: text, images: state.attachedImage ? [state.attachedImage] : undefined };
    sess.messages.push(userMsg); renderMessage(userMsg, sess.messages.length - 1);
    input.value = ''; state.attachedImage = null; autoResizeInput(); hideImgPreview();

    const apiMessages = [];
    if (state.systemPrompt) apiMessages.push({ role: 'system', content: state.systemPrompt });
    sess.messages.slice(-13, -1).forEach(m => {
      if (m.role === 'user') {
        if (m.images && m.images.length) {
          const parts = [{ type: 'text', text: m.content }];
          m.images.forEach(img => parts.push({ type: 'image_url', image_url: { url: img } }));
          apiMessages.push({ role: 'user', content: parts });
        } else apiMessages.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant' && m.content) {
        apiMessages.push({ role: 'assistant', content: m.content });
      }
    });

    const assistantMsg = { role: 'assistant', content: '', thinking: '' };
    sess.messages.push(assistantMsg);
    const msgs = $('#messages');
    const empty = msgs.querySelector('.empty-state'); if (empty) empty.remove();
    const row = el('div', 'msg assistant');
    row.appendChild(el('div', 'avatar', 'AI'));
    const msgRow = el('div', 'msg-row');
    const bubble = el('div', 'msg-bubble');
    const thinkingDiv = el('div', 'thinking collapsed'); thinkingDiv.style.display = 'none';
    const contentDiv = el('div', 'msg-content');
    contentDiv.innerHTML = '<span class="cursor-blink"></span>';
    bubble.appendChild(thinkingDiv); bubble.appendChild(contentDiv);
    msgRow.appendChild(bubble); row.appendChild(msgRow);
    msgs.appendChild(row); scrollBottom();

    state.isStreaming = true;
    $('#btn-send').hidden = true; $('#btn-stop').hidden = false;
    state.abortController = new AbortController();

    try {
      const result = await ChatClient.streamChat({
        endpoint, model: mi.model, messages: apiMessages,
        temperature: state.settings.temperature, maxTokens: state.settings.maxTokens,
        signal: state.abortController.signal,
        onRetry: (n, ws) => { contentDiv.innerHTML = '<span style="color:var(--text-faint);font-size:12px">\u23F3 \u9650\u6d41\u4e86\uff0c' + ws + 's \u540e\u91cd\u8bd5\uff08\u7b2c' + n + '\u6b21\uff09\u2026</span>'; },
        onDelta: ({ text, thinking, role }) => {
          if (role === 'thinking' && thinking != null) {
            assistantMsg.thinking = text;
            if (!thinkingDiv.dataset.inited) {
              thinkingDiv.innerHTML = '<div class="thinking-toggle">\u601d\u8003\u8fc7\u7a0b</div><div class="thinking-body"></div>';
              thinkingDiv.querySelector('.thinking-toggle').addEventListener('click', () => thinkingDiv.classList.toggle('expanded'));
              thinkingDiv.dataset.inited = '1';
            }
            thinkingDiv.style.display = 'block';
            thinkingDiv.querySelector('.thinking-body').textContent = text;
          } else if (role === 'content') {
            assistantMsg.content = text; contentDiv.innerHTML = MD.render(text);
          }
          scrollBottom();
        }
      });
      assistantMsg.content = result.full; assistantMsg.thinking = result.thinkBuffer || '';
      contentDiv.innerHTML = MD.render(result.full);
      if (result.full) {
        const actions = el('div', 'msg-actions');
        const cb = el('button', 'btn-mini', '\u{1F4CB} \u590d\u5236');
        cb.addEventListener('click', () => copyText(result.full).then(() => toast('\u5df2\u590d\u5236')));
        actions.appendChild(cb);
        const bb = el('button', 'btn-mini', '\u{1F33F} \u5206\u652f');
        bb.title = '\u4ece\u6b64\u5904\u5206\u652f\u65b0\u5bf9\u8bdd';
        bb.addEventListener('click', () => branchFromMessage(sess.messages.indexOf(assistantMsg)));
        actions.appendChild(bb);
        const rb = el('button', 'btn-mini', '\u{1F504} \u91cd\u65b0\u751f\u6210');
        rb.addEventListener('click', () => regenerateLast());
        actions.appendChild(rb);
        msgRow.appendChild(actions);
      }
      if (state.settings.ttsEnabled && result.full) Voice.speak(result.full, state.settings.voiceLang, true);
    } catch (e) {
      if (e.name !== 'AbortError') contentDiv.innerHTML = '<span style="color:var(--danger)">\u26A0 ' + escapeHtml(e.message) + '</span>';
    } finally {
      state.isStreaming = false;
      $('#btn-send').hidden = false; $('#btn-stop').hidden = true;
      sess.updatedAt = Date.now();
      state.settings.lastSessionId = sess.id;
      Store.saveSessions(state.sessions); Store.saveSettings(state.settings);
      renderSessionList();
    }
  }
  function stopGeneration() { if (state.abortController) state.abortController.abort(); }

  function autoResizeInput() {
    const i = $('#input'); i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 160) + 'px';
  }
  function onPaste(e) {
    const items = e.clipboardData && e.clipboardData.items; if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const f = item.getAsFile();
        if (f) { const r = new FileReader(); r.onload = () => { state.attachedImage = r.result; showImgPreview(r.result); }; r.readAsDataURL(f); }
        break;
      }
    }
  }
  function toggleVoice() {
    Voice.startRecognition(state.settings.voiceLang,
      (ft, it) => { $('#input').value = ft + it; autoResizeInput(); },
      (l) => { $('#btn-voice').style.opacity = l ? '1' : '0.6'; });
  }
  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:')
      navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
