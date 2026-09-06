(()=>{
'use strict';
let wakeAt=0, pinging=false, lastPing=0;
function banner(on, msg){
  let el=document.getElementById('reconnectBannerV2688');
  if(!el){
    el=document.createElement('div');
    el.id='reconnectBannerV2688';
    el.style.cssText='display:none;margin:0 0 10px;padding:8px 10px;border:1px solid #3a3428;border-radius:10px;background:#14110c;color:#cbb48a;font-size:11px;font-weight:700';
    const tabs=document.querySelector('.pageTabs');
    if(tabs&&tabs.parentNode) tabs.insertAdjacentElement('afterend', el);
    else document.body.prepend(el);
  }
  el.textContent=msg||'';
  el.style.display=on?'block':'none';
}
async function ping(){
  if(pinging) return false;
  pinging=true;
  const c=new AbortController();
  const t=setTimeout(()=>c.abort(),7000);
  try{
    const r=await fetch('/healthz',{cache:'no-store',signal:c.signal});
    lastPing=Date.now();
    return r.ok;
  }catch{
    try{
      const r=await fetch('/api/realtime',{cache:'no-store',signal:c.signal});
      lastPing=Date.now();
      return r.ok;
    }catch{ return false; }
  }finally{
    clearTimeout(t);
    pinging=false;
  }
}
async function onWake(reason){
  if(document.hidden) return;
  const now=Date.now();
  if(now-wakeAt<5000) return;
  wakeAt=now;
  const slept=now-lastPing>45000 || lastPing===0;
  if(!slept) return;
  banner(true, reason==='online'?'網路回來了，正在重新連線…':'剛回前景，先留著畫面上的資料，正在叫醒伺服器…');
  const ok=await ping();
  banner(!ok, ok?'':'伺服器正在醒來，大概 10–30 秒。不要一直重開 App。');
  if(ok) setTimeout(()=>banner(false,''),1600);
}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) void onWake('visible'); });
window.addEventListener('pageshow',()=>void onWake('pageshow'));
window.addEventListener('online',()=>void onWake('online'));
setInterval(()=>{ if(!document.hidden) void ping(); }, 150000);
void ping();
})();
