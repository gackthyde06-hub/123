(()=>{
'use strict';
const VERSION='2.6.15';
const HUB_KEY='v2615-show-actual-hub';
const MODE_KEY='v2615-shadow-notify-mode';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v}catch{return d}};
const set=(k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
let scheduled=false,modeBusy=false,modeLoaded=false;

function installStyle(){
  if($('#v2615-style'))return;
  const s=document.createElement('style');s.id='v2615-style';s.textContent=`
#v2614Ctl{display:none!important}
.v2615ActualCtl,.v2615ShadowCtl{display:flex;align-items:center;gap:9px;margin:9px 0 12px;padding:9px 11px;border:1px solid #303536;border-radius:13px;background:#0c0f10;color:#a79f94}
.v2615ActualCtl b,.v2615ShadowCtl b{font-size:10px;color:#d7be80}.v2615ActualCtl small,.v2615ShadowCtl small{font-size:8px;color:#716b63}.v2615CtlSpacer{flex:1}
.v2615Switch{display:inline-flex;align-items:center;gap:7px;font-size:9px;color:#bbb2a6;cursor:pointer}.v2615Switch input{width:17px;height:17px;accent-color:#d5aa53}
.v2615Mode{height:32px;border:1px solid #3b4041;border-radius:9px;background:#101314;color:#ddd4c8;padding:0 9px;font-size:9px;font-weight:850}
.actualTradeHubV2613.v2615HubOn{display:block!important}.actualTradeHubV2613.v2615HubOff{display:none!important}
.actualTradeHubV2613 .actualHubCloseV26133{display:none!important}
.v2615HubClose{position:absolute;right:12px;top:12px;width:30px;height:30px;border:1px solid #3b4142;border-radius:9px;background:#101415;color:#aaa39a;font-size:18px;font-weight:800;z-index:9}
.v2615Stale{display:none!important}
#manualOpsPanel [data-filter="C"],#manualOpsPanel [data-filter="ALL"],#manualOpsPanel .grade-c,#manualOpsPanel .abc-shadow-stat.grade-c{display:none!important}
#manualOpsPanel .manual-settings:not(.v2615Keep){display:none!important}
`;
  document.head.appendChild(s);
}
function hubOn(){return get(HUB_KEY,'0')==='1'}
function setHub(on){set(HUB_KEY,on?'1':'0');applyHub();syncActualCtl()}
function ensureActualCtl(){
  const page=$('#page-test');if(!page)return;
  let c=$('#v2615ActualCtl');
  if(!c){
    c=document.createElement('div');c.id='v2615ActualCtl';c.className='v2615ActualCtl';
    c.innerHTML=`<b>實際建倉</b><small>需要時打開，關閉只隱藏畫面</small><span class="v2615CtlSpacer"></span><span data-v2615-count style="font-size:9px;color:#d8b86d">0</span><label class="v2615Switch"><input type="checkbox" data-v2615-hub>顯示</label>`;
    const hub=$('#actualTradeHubV2613',page),anchor=hub||page.querySelector('.sectionBar,#testSummary,.testSummary,#testGrid')||page.firstElementChild;
    if(anchor)anchor.insertAdjacentElement('beforebegin',c);else page.prepend(c);
    $('[data-v2615-hub]',c).addEventListener('change',e=>setHub(e.target.checked));
  }
  syncActualCtl();
}
function syncActualCtl(){const c=$('#v2615ActualCtl');if(!c)return;const i=$('[data-v2615-hub]',c);if(i)i.checked=hubOn();const hub=$('#actualTradeHubV2613'),n=Number(hub?.querySelector('.actualTradeFoldV2613>summary em')?.textContent||0);const ct=$('[data-v2615-count]',c);if(ct)ct.textContent=String(Number.isFinite(n)?n:0)}
function applyHub(){
  const hub=$('#actualTradeHubV2613');if(!hub)return;
  hub.classList.remove('v2614Hidden');hub.classList.toggle('v2615HubOn',hubOn());hub.classList.toggle('v2615HubOff',!hubOn());
  if(!$('.v2615HubClose',hub)){
    const b=document.createElement('button');b.type='button';b.className='v2615HubClose';b.textContent='×';b.title='關閉已建倉顯示';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setHub(false)});hub.appendChild(b);
  }
  syncActualCtl();
}
async function endpoint(){try{const r=await navigator.serviceWorker?.getRegistration?.();const s=await r?.pushManager?.getSubscription?.();return s?.endpoint||null}catch{return null}}
function mode(){const x=get(MODE_KEY,'BOTH').toUpperCase();return ['MANUAL','AUTO','BOTH'].includes(x)?x:'BOTH'}
async function loadMode(){if(modeLoaded)return;modeLoaded=true;const ep=await endpoint();if(!ep){syncShadowCtl();return}try{const r=await fetch(`/api/v2614-notify-preferences?endpoint=${encodeURIComponent(ep)}`,{cache:'no-store'}),d=await r.json();if(r.ok&&d?.ok&&['MANUAL','AUTO','BOTH'].includes(String(d.mode||'').toUpperCase()))set(MODE_KEY,String(d.mode).toUpperCase())}catch{}syncShadowCtl()}
async function saveMode(v){if(modeBusy)return;const m=['MANUAL','AUTO','BOTH'].includes(String(v).toUpperCase())?String(v).toUpperCase():'BOTH';set(MODE_KEY,m);syncShadowCtl();const ep=await endpoint();if(!ep){alert('這台裝置尚未同步 Push 通知。');return}modeBusy=true;try{await fetch('/api/v2614-notify-preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:ep,mode:m,enabled:true}),cache:'no-store'})}catch{}finally{modeBusy=false}}
function ensureShadowCtl(){
  const page=$('#page-ideas');if(!page)return;
  let c=$('#v2615ShadowCtl');
  if(!c){
    c=document.createElement('div');c.id='v2615ShadowCtl';c.className='v2615ShadowCtl';
    c.innerHTML=`<b>影子 A / B 通知</b><small>同標的同方向會去重，不重複響</small><span class="v2615CtlSpacer"></span><select class="v2615Mode" data-v2615-mode><option value="MANUAL">手動</option><option value="AUTO">自動</option><option value="BOTH">全開</option></select>`;
    const p=$('#manualOpsPanel',page),anchor=p||page.querySelector('.sectionBar,#recGrid')||page.firstElementChild;if(anchor)anchor.insertAdjacentElement('beforebegin',c);else page.prepend(c);
    $('[data-v2615-mode]',c).addEventListener('change',e=>saveMode(e.target.value));
  }
  syncShadowCtl();void loadMode();
}
function syncShadowCtl(){const x=$('[data-v2615-mode]');if(x&&x.value!==mode())x.value=mode()}
function normalizeManual(){
  const p=$('#manualOpsPanel');if(!p)return;
  const bad=$('.manual-grade-summary button.on[data-filter="C"],.manual-grade-summary button.on[data-filter="ALL"]',p);
  const a=$('.manual-grade-summary [data-filter="A"]',p),b=$('.manual-grade-summary [data-filter="B"]',p);
  $$('.manual-grade-summary [data-filter="C"],.manual-grade-summary [data-filter="ALL"]',p).forEach(x=>x.remove());
  $$('.manual-card.grade-c,.abc-shadow-stat.grade-c',p).forEach(x=>x.remove());
  $$('.manual-real-stats>div',p).forEach(x=>{if(/^C級/.test(x.querySelector('span')?.textContent?.trim()||''))x.remove()});
  if(a){const small=a.querySelector('small');if(small)small.textContent='影子優先'}
  if(b){const small=b.querySelector('small');if(small)small.textContent='影子觀察'}
  const cur=$('.manual-grade-summary button.on',p);
  const ac=Number(a?.querySelector('span')?.textContent||0),bc=Number(b?.querySelector('span')?.textContent||0);
  if(bad||!cur||!['A','B'].includes(cur?.dataset?.filter||''))setTimeout(()=>{const x=$('#manualOpsPanel .manual-grade-summary [data-filter="A"]')||$('#manualOpsPanel .manual-grade-summary [data-filter="B"]');x?.click()},0);
  else if(cur.dataset.filter==='A'&&ac===0&&bc>0)setTimeout(()=>$('#manualOpsPanel .manual-grade-summary [data-filter="B"]')?.click(),0);
  else if(cur.dataset.filter==='B'&&bc===0&&ac>0)setTimeout(()=>$('#manualOpsPanel .manual-grade-summary [data-filter="A"]')?.click(),0);
}
function ageMinutesFromCard(card){const m=String(card.textContent||'').match(/更新\s*(\d{1,2}):(\d{2})/);if(!m)return null;const now=new Date(),cur=now.getHours()*60+now.getMinutes(),then=Number(m[1])*60+Number(m[2]);let d=cur-then;if(d<0)d+=1440;return d}
function pruneStale(){
  $$('#testGrid .testCard,#testGrid article').forEach(card=>{const m=ageMinutesFromCard(card);card.classList.toggle('v2615Stale',m!=null&&m>4)});
  $$('#recGrid .v2614Hidden').forEach(x=>x.classList.remove('v2614Hidden'));
}
function normalize(){
  scheduled=false;installStyle();$('#v2614Ctl')?.remove();ensureActualCtl();applyHub();ensureShadowCtl();normalizeManual();pruneStale();
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(normalize)}
function boot(){installStyle();normalize();const mo=new MutationObserver(schedule);mo.observe(document.body,{childList:true,subtree:true});setInterval(pruneStale,60_000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});window.addEventListener('pageshow',schedule)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
