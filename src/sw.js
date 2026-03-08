import { precacheAndRoute } from 'workbox-precaching';

// CRITICAL for iOS: Take control immediately.
// Without these, the SW stays in 'waiting' state and won't receive push events.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Workbox precaching — injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// Push notification handler
self.addEventListener('push', (event) => {
  // Log to any open clients for diagnostics
  const logToClients = (msg) => {
    self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: 'push-debug', message: msg }));
    });
  };

  if (!event.data) {
    logToClients('Push received but no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Dilli Wissel', body: event.data.text() };
  }

  logToClients(`Push received: ${data.title || 'no title'}`);

  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'dilli-notification',
    renotify: true,
    data: {
      matchCode: data.matchCode,
      url: data.url || '/',
    },
  };

  // vibrate is ignored on iOS but doesn't cause errors
  if (data.vibrate) {
    options.vibrate = data.vibrate;
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Dilli Wissel', options)
      .then(() => logToClients('Notification shown successfully'))
      .catch(err => logToClients(`showNotification error: ${err.message}`))
  );
});

// Notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing window if it matches
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
