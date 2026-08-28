self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || '高手倉位雷達', {
    body: data.body || '',
    tag: data.tag || `leader-alert-${Date.now()}`,
    renotify: data.renotify ?? true,
    data: data.data || { url: '/' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
