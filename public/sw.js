self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'倉位',{
    body:data.body||'',
    icon:'/app-icon-192.png?v=594',
    badge:'/badge-96.png?v=594',
    tag:data.tag||`position-${Date.now()}`,
    renotify:data.renotify??true,
    data:data.data||{url:'/'}
  }))
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url||'/'))
});
