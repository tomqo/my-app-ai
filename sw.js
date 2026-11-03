const CACHE_NAME = 'ai-chat-v9';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/storage.js',
  './js/utils.js',
  './js/markdown.js',
  './js/chat.js',
  './js/voice.js',
  './js/app.js',
  './icons/icon.svg',
  './icons/icon-192.png', 'icons/apple-touch-icon.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 网络优先；失败时回退缓存（离线可打开已缓存资源）。
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // 不缓存 API 请求，避免污染聊天数据。
  if (url.pathname.endsWith('/v1/chat/completions') || url.pathname.endsWith('/v1/models')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
