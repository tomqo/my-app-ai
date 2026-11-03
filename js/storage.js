// storage.js — 本地持久化（localStorage）。所有数据只存在本机。
(function (global) {
  'use strict';

  const DB_VERSION = 1;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      console.warn('storage read failed', key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('storage write failed', key, e);
      toast('保存失败：本地存储空间不足', true);
    }
  }

  const Store = {
    getEndpoints() {
      return read('ai.endpoints', []);
    },
    saveEndpoints(list) {
      write('ai.endpoints', list);
    },

    getSessions() {
      return read('ai.sessions', []);
    },
    saveSessions(list) {
      write('ai.sessions', list);
    },

    getPresets() {
      return read('ai.presets', []);
    },
    savePresets(list) {
      write('ai.presets', list);
    },

    getSettings() {
      const d = {
        temperature: 0.7,
        maxTokens: 2048,
        theme: 'dark',
        voiceLang: 'zh-CN',
        ttsEnabled: false,
        lastSessionId: null,
        lastModelId: null
      };
      return Object.assign(d, read('ai.settings', {}));
    },
    saveSettings(obj) {
      write('ai.settings', obj);
    },

    exportAll() {
      return {
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        endpoints: this.getEndpoints(),
        sessions: this.getSessions(),
        presets: this.getPresets(),
        settings: this.getSettings()
      };
    },

    importAll(data) {
      if (!data || typeof data !== 'object') throw new Error('无效的数据');
      if (Array.isArray(data.endpoints)) this.saveEndpoints(data.endpoints);
      if (Array.isArray(data.sessions)) this.saveSessions(data.sessions);
      if (Array.isArray(data.presets)) this.savePresets(data.presets);
      if (data.settings && typeof data.settings === 'object') this.saveSettings(data.settings);
    },

    clearAll() {
      ['ai.endpoints', 'ai.sessions', 'ai.presets', 'ai.settings'].forEach((k) =>
        localStorage.removeItem(k)
      );
    }
  };

  global.Store = Store;
})(window);
