self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'倉位',{
    body:data.body||'',
    icon:'/app-icon-192.png?v=810',
    badge:'/badge-96.png?v=810',
    tag:data.tag||`position-${Date.now()}`,
    renotify:data.renotify??true,
    data:data.data||{url:'/'}
  }))
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=new URL(event.notification.data?.url||'/',self.location.origin).href;
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const current=windows.find(x=>x.url.startsWith(self.location.origin));
    if(current){await current.navigate(url);return current.focus()}
    return clients.openWindow(url)
  })())
});
