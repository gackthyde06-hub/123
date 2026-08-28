self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title || '倉位通知', {
      body: data.body || '',
      tag: data.tag || `position-alert-${Date.now()}`,
      renotify: data.renotify ?? true,
      data: data.data || { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
