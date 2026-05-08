// AuraOS Service Worker — Web Push + Cache
const CACHE = 'auraos-v2';

// ── Install: cachear assets esenciales ──────────────────────────────────────
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll([
      '/app.html',
      '/icon.png',
      '/icon-192.png',
      '/icon-512.png',
    ]).catch(() => {}))
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first para el app, cache-first para assets ────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Solo cachear assets del mismo origin
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// ── PUSH: recibir notificación del servidor ───────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: '✂️ AuraOS', body: 'Tienes una notificación', icon: '/icon.png', badge: '/icon.png', data: {} };

  if (e.data) {
    try { Object.assign(data, JSON.parse(e.data.text())); } catch(_) {}
  }

  const options = {
    body:              data.body,
    icon:              data.icon  || '/icon.png',
    badge:             data.badge || '/icon.png',
    vibrate:           [200, 100, 200],
    tag:               data.data?.tipo || 'auraos',
    renotify:          true,
    requireInteraction: false,
    data:              data.data || {},
    actions: data.data?.cita_id ? [
      { action: 'ver', title: '👁 Ver mi turno' },
      { action: 'ok',  title: '✓ Confirmar' },
    ] : [],
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();

  const action = e.action;
  const data   = e.notification.data || {};
  let url = '/app.html';

  if (action === 'ver' || data.tipo === 'turno_proximo') {
    url = '/app.html#turno';
  }

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      // Si la app ya está abierta, enfocarla y navegar
      for (const win of wins) {
        if (win.url.includes('/app.html')) {
          win.focus();
          win.postMessage({ type: 'PUSH_CLICK', action, data });
          return;
        }
      }
      // Si no está abierta, abrirla
      return clients.openWindow(url);
    })
  );
});

// ── Push subscription change ─────────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', e => {
  // Notificar a la app que la suscripción cambió — debe re-suscribirse
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(wins => {
      wins.forEach(win => win.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' }));
    })
  );
});
