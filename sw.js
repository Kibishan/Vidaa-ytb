const CACHE_NAME = 'youtube-vidaa-shell-v1';
const SHELL_ASSETS = [
  './vidaa.html',
  './index.html',
  './index.js',
  './manifest.json',
  './icon.png',
  './largeIcon.png',
  './webOSUserScripts/userScript.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML and userScript so updates are always immediate
  if (
    url.pathname === '/' ||
    url.pathname.endsWith('/vidaa.html') ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/userScript.js') ||
    url.pathname === '/tv'
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
