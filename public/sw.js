self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{}
  const meta=data.data||{},noticeId=meta.noticeId||null,receivedAt=Date.now();
  const shown=self.registration.showNotification(data.title||'倉位',{
    body:data.body||'',
    icon:'/app-icon-192.png?v=1000',
    badge:'/badge-96.png?v=1000',
    tag:data.tag||`position-${Date.now()}`,
    renotify:data.renotify??true,
    data:{...meta,url:meta.url||'/'}
  });
  const ack=noticeId?fetch('/api/notification-received',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:noticeId,at:receivedAt})}).catch(()=>null):Promise.resolve();
  event.waitUntil(Promise.all([shown,ack]));
});
self.addEventListener('notificationclick',event=>{
  const meta=event.notification.data||{},noticeId=meta.noticeId||null,clickedAt=Date.now();
  event.notification.close();
  event.waitUntil((async()=>{
    if(noticeId){try{await fetch('/api/notification-click',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:noticeId,at:clickedAt})})}catch{}}
    const url=new URL(meta.url||'/',self.location.origin).href;
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const current=windows.find(x=>x.url.startsWith(self.location.origin));
    if(current){await current.navigate(url);return current.focus()}
    return clients.openWindow(url)
  })());
});
