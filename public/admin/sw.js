const CACHE_NAME = 'gobilive-admin-v1';
const STATIC_ASSETS = [
  '/admin/',
  '/admin/index.html',
];

// Install event — cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch event — network first, fallback to cache for navigation requests
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET and API requests (always go to network)
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;

  // For HTML navigation — serve app shell from cache as fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/admin/index.html'))
    );
    return;
  }

  // For other assets — network first, then cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});
