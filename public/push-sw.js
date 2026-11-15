// Notifications push, chargé par le service worker de l'appli (voir vite.config.ts).
// Message reçu : { title, body, url, tag } (voir supabase/functions/push-send).
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Coco·voit', {
      body: data.body || '',
      icon: 'pwa-192.png',
      tag: data.tag || undefined,
      data: { url: data.url || self.registration.scope },
    }),
  );
});

// Toucher la notification : ouvre la page du voyage (dans une fenêtre de l'appli si possible).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => c.url.startsWith(self.registration.scope));
      if (client) return client.navigate(url).then((c) => (c || client).focus());
      return self.clients.openWindow(url);
    }),
  );
});
