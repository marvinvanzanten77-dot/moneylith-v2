/* Cache only this public fallback. Never cache bank, account, AI or notification responses. */
const CACHE = 'moneylith-public-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/offline.html')).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('moneylith-public-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, {cache: 'no-store'}).catch(async () => (await caches.match('/offline.html')) || Response.error()));
  }
});

self.addEventListener('push', event => {
  let test = false;
  try { test = event.data?.json()?.type === 'test'; } catch { /* Always display a safe generic notification. */ }
  event.waitUntil(self.registration.showNotification('Moneylith', {
    body: test ? 'Je testmelding is aangekomen. Fijn, je bent bereikbaar!' : 'Er staat een nieuwe tip voor je klaar. Bekijk rustig wat bij je past.',
    icon: '/icons/moneylith-192.png', badge: '/icons/moneylith-192.png',
    tag: test ? 'moneylith-test' : 'moneylith-monitoring',
    data: {url: '/?app=1&view=notifications#persoonlijk'}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  // Fixed same-origin destination; never navigate to a URL supplied in a payload.
  event.waitUntil(self.clients.openWindow('/?app=1&view=notifications#persoonlijk'));
});
