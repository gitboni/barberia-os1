const CACHE = 'auraos-pro-v2';

const PRECACHE = [
  '/panel-barbero.html',
  '/assets/icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Web Push: mostrar notificación aunque la PWA esté cerrada ───────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (_) { data = { title: 'AuraOS', body: e.data ? e.data.text() : '' }; }
  const title = data.title || '✂️ AuraOS';
  const opts = {
    body:     data.body || '',
    icon:     data.icon || '/assets/icon.png',
    badge:    data.badge || '/assets/icon.png',
    data:     data.data || {},
    vibrate:  [120, 60, 120],
    tag:      (data.data && data.data.tipo) || 'auraos-cita',
    renotify: true,
    requireInteraction: false,
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

// ── Click en la notificación → abrir/enfocar la PWA ─────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      for (const c of cls) {
        if (c.url.includes('panel-barbero') && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/panel-barbero.html');
    })
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;

  // Images: cache-first
  if (/\.(png|jpe?g|webp|svg)(\?|$)/i.test(e.request.url)) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(e.request).then(cached => {
          if (cached) return cached;
          return fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => cached || new Response('', { status: 404 }));
        })
      )
    );
    return;
  }

  // HTML/JS/CSS: network-first, fallback cache
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() =>
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') return caches.match('/panel-barbero.html');
        return new Response('', { status: 503 });
      })
    )
  );
});
