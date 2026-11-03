// chat.js — OpenAI 兼容聊天客户端（流式 + 图片 + 429 自动重试）
(function (global) {
  'use strict';

  const ENDPOINTS = { 'chat/completions': '/chat/completions' };

  function buildUrl(base, path) {
    return base.replace(/\/+$/, '') + path;
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function streamChat({ endpoint, model, messages, temperature, maxTokens, signal, onDelta, onRetry }) {
    const url = buildUrl(endpoint.baseUrl, ENDPOINTS['chat/completions']);
    const body = {
      model, messages, stream: true, temperature, max_tokens: maxTokens,
      ...(endpoint.extraBody || {})
    };

    const MAX_RETRIES = 3;
    const BACKOFF_BASE = 3000;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

      let resp;
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + endpoint.apiKey
          },
          body: JSON.stringify(body),
          signal
        });
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        if (attempt < MAX_RETRIES) { await sleep(BACKOFF_BASE * (attempt + 1)); continue; }
        throw new Error('网络错误：无法连接服务器');
      }

      if (resp.status === 429) {
        if (attempt < MAX_RETRIES) {
          const waitSec = BACKOFF_BASE * (attempt + 1) / 1000;
          if (onRetry) onRetry(attempt + 1, waitSec);
          await sleep(BACKOFF_BASE * (attempt + 1));
          continue;
        }
        throw new Error('免费模型限流，请稍等片刻再发');
      }

      if (!resp.ok) {
        let detail = '';
        try { detail = (await resp.text()).slice(0, 300); } catch (e) {}
        let friendly = 'API 错误 ' + resp.status;
        try {
          const j = JSON.parse(detail);
          if (j.error && j.error.message) friendly = j.error.message;
        } catch (e) {}
        throw new Error(friendly);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', full = '', thinkBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return { full, thinkBuffer };
          let json;
          try { json = JSON.parse(payload); } catch (e) { continue; }
          const delta = json.choices && json.choices[0] && json.choices[0].delta;
          if (!delta) continue;
          if (delta.reasoning_content != null) {
            thinkBuffer += delta.reasoning_content;
            onDelta({ thinking: true, text: thinkBuffer, role: 'thinking' });
          }
          const c = delta.content;
          if (c != null && c !== '') {
            full += c;
            onDelta({ text: full, role: 'content' });
          }
        }
      }
      return { full, thinkBuffer };
    }
  }

  async function listModels(endpoint) {
    const url = buildUrl(endpoint.baseUrl, '/models');
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + endpoint.apiKey }
    });
    if (!resp.ok) throw new Error('拉取失败 ' + resp.status);
    const data = await resp.json();
    return (data.data || []).map(m => m.id).filter(Boolean);
  }

  global.ChatClient = { streamChat, listModels, buildUrl };
})(window);