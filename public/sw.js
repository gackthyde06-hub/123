// CANDIDATE_UI_NOTIFY_CUSTOM_V2673_20260904
// PUSH_RECOVERY_SKIP_WAITING_V2665
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// PUSH_RECOVERY_V2665_20260904
// NOTIFICATION_POLICY_V2611: final client-side guard against old/queued status-noise notifications.
// NOTIFICATION_CONTROL_V2616: final device-side whitelist.
function allowedNoticeV2616(data={}){
  const tag=String(data.tag||'').toLowerCase(),text=String(data.title||'')+' '+String(data.body||'');
  if(/^notify-test-/.test(tag)||/^shadow-test-/.test(tag))return true;
  if(/^trader-/.test(tag)&&/(open|add|reduce|close)/.test(tag))return true;
  if(/^shadow-/.test(tag)&&/(影子|shadow)/i.test(text)&&/[AB]級/i.test(text))return true;
  if(/^candidate-/.test(tag)&&/候選/.test(text))return true;
  return false;
}
function noticeRouteV2611(data={},meta={}){const tag=String(data.tag||'').toLowerCase(),text=String(data.title||'')+' '+String(data.body||'');if(tag.startsWith('daily-brief-')||tag.startsWith('trader-'))return '/?page=today';if(tag.includes('abc')||/(?:^|[^A-Z])ABC(?:[^A-Z]|$)|影子戰術|ABC單/i.test(text))return meta.url&&meta.url!=='/'?meta.url:'/?page=monitor';return meta.url||'/?page=monitor'}
self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{}}catch{}
  if(!allowedNoticeV2616(data))return;
  const meta=data.data||{},noticeId=meta.noticeId||null,receivedAt=Date.now(),route=noticeRouteV2611(data,meta);
  const shown=self.registration.showNotification(data.title||'倉位',{
    body:data.body||'',
    icon:'/app-icon-192.png?v=1014',
    badge:'/badge-96.png?v=1014',
    tag:data.tag||`position-${Date.now()}`,
    renotify:data.renotify??false,
    data:{...meta,url:route}
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
