const $=id=>document.getElementById(id);
let cfg=null,lastStatus=null;
const TRADER_PREF='position-alert-traders-v52',TYPE_PREF='position-alert-types-v52';
const DEFAULT_TYPES=['OPEN','ADD','REDUCE','CLOSE','CONSENSUS'];
const ICONS={
'5075281354358777856':'/trader-lion.png',
'4112815248716815105':'/trader-sago.png',
'4855144495762648832':'/trader-xinxin.png',
'4556315195316581632':'/trader-life.png'
};
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function price(v){const x=Number(v||0);if(!x)return'-';if(x>=1000)return x.toLocaleString('en-US',{maximumFractionDigits:2});if(x>=1)return x.toLocaleString('en-US',{maximumFractionDigits:6});return x.toLocaleString('en-US',{maximumFractionDigits:8})}
function localTime(iso){if(!iso)return'';try{return new Date(iso).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}catch{return''}}
function defaultTraderIds(){return cfg?.traders?.map(t=>t.id)||[]}
function loadArray(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(Array.isArray(v))return v}catch{}return f}
function loadEnabledTraders(){const valid=new Set(defaultTraderIds());return loadArray(TRADER_PREF,defaultTraderIds()).filter(id=>valid.has(id))}
function saveEnabledTraders(x){localStorage.setItem(TRADER_PREF,JSON.stringify(x))}
function loadEnabledTypes(){const valid=new Set(cfg?.eventTypes||DEFAULT_TYPES);return loadArray(TYPE_PREF,[...valid]).filter(x=>valid.has(x))}
function saveEnabledTypes(x){localStorage.setItem(TYPE_PREF,JSON.stringify(x))}
function typeLabel(t){return({OPEN:'建倉',ADD:'加碼',REDUCE:'減碼',CLOSE:'平倉',CONSENSUS:'共識'})[t]||t}
function eventAction(e){if(e.type==='OPEN')return e.direction||'';if(e.type==='ADD')return'加碼';if(e.type==='REDUCE')return'減碼';if(e.type==='CLOSE')return'平倉';if(e.type==='CONSENSUS')return`${e.direction||''}共識`;return e.type||''}
async function getPushSubscription(){if(!('serviceWorker'in navigator))return null;const r=await navigator.serviceWorker.getRegistration('/');return r?await r.pushManager.getSubscription():null}
async function syncPreferences(){const sub=await getPushSubscription();if(!sub)return;await fetch('/api/preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes()})})}
function b64ToUint8(base64){const padding='='.repeat((4-base64.length%4)%4),s=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
function renderMasterToggle(){const e=loadEnabledTraders();$('allToggle').checked=e.length===cfg.traders.length;$('allCount').textContent=`${e.length}/${cfg.traders.length}`}
function renderTypeOptions(){const enabled=new Set(loadEnabledTypes());$('typeOptions').innerHTML=(cfg.eventTypes||DEFAULT_TYPES).map(t=>`<label class="typeChoice"><input class="typeToggle" type="checkbox" data-type="${esc(t)}" ${enabled.has(t)?'checked':''}><span>${esc(typeLabel(t))}</span></label>`).join('');document.querySelectorAll('.typeToggle').forEach(el=>el.addEventListener('change',async()=>{const types=[...document.querySelectorAll('.typeToggle:checked')].map(x=>x.dataset.type);saveEnabledTypes(types);await syncPreferences().catch(()=>{});$('msg').textContent='✅ 通知類型已更新'}))}
function positionRow(p,extra=false){const isLong=p.side==='LONG';return `<div class="pos ${extra?'extraPos hidden':''}"><div class="symline"><span class="sym">${esc(p.symbol)}</span><span class="tag ${isLong?'long':'short'}">${esc(p.direction)}</span></div><div class="price">${price(p.entryPrice)}</div></div>`}
function traderEvents(id,events){return(events||[]).filter(e=>e.traderId===id||(e.kind==='CONSENSUS'&&Array.isArray(e.traderIds)&&e.traderIds.includes(id))).slice(0,6)}
function miniEventRow(e){return `<div class="miniEvent"><span class="time">${localTime(e.ts)}</span><span><span class="act">${esc(eventAction(e))}</span> <span class="coin">${esc(e.symbol||'')}</span></span><span class="px">${e.kind==='CONSENSUS'?esc((e.traderNames||[]).length+'人'):price(e.tradePrice||e.entryPrice)}</span></div>`}
function traderCard(t,events){
 const enabled=loadEnabledTraders().includes(t.id),ok=!t.lastError,list=t.positions||[],first=list.slice(0,1),rest=list.slice(1),evs=traderEvents(t.id,events);
 let positions=list.length?first.map(p=>positionRow(p)).join('')+rest.map(p=>positionRow(p,true)).join(''):'<div class="empty">目前無倉位</div>';
 if(rest.length)positions+=`<button class="moreBtn" data-count="${rest.length}">查看其餘 ${rest.length} 筆</button>`;
 const vip=(t.id==='5075281354358777856'||t.id==='4112815248716815105')?'<span class="vip">VIP</span>':'';
 return `<section class="traderCard"><div class="traderHead"><div class="traderIdentity"><img class="traderIcon" src="${ICONS[t.id]||'/app-icon-192.png'}" alt=""><div><div class="traderName">${esc(t.name)}${vip}</div><div class="state ${ok?'okText':'badText'}">● ${ok?(t.baselineReady?'監控中':'建立中'):'讀取異常'}</div></div></div><label class="switch"><input type="checkbox" class="traderToggle" data-id="${esc(t.id)}" ${enabled?'checked':''}><span class="slider"></span></label></div><div class="positionBox">${positions}</div><details class="activity"><summary><b>◷ 最近動靜</b><span>${evs.length?evs.length+' 筆':'無'}　⌄</span></summary><div>${evs.length?evs.map(miniEventRow).join(''):'<div class="empty">尚無新動靜</div>'}</div></details></section>`
}
function bindTraderControls(){
 document.querySelectorAll('.traderToggle').forEach(el=>el.addEventListener('change',async e=>{const id=e.currentTarget.dataset.id,set=new Set(loadEnabledTraders());e.currentTarget.checked?set.add(id):set.delete(id);saveEnabledTraders([...set]);renderMasterToggle();await syncPreferences().catch(()=>{});$('msg').textContent='✅ 交易員通知已更新'}));
 document.querySelectorAll('.moreBtn').forEach(btn=>btn.addEventListener('click',e=>{const box=e.currentTarget.closest('.positionBox'),xs=[...box.querySelectorAll('.extraPos')],open=xs.some(x=>x.classList.contains('hidden'));xs.forEach(x=>x.classList.toggle('hidden',!open));e.currentTarget.textContent=open?'收合':`查看其餘 ${e.currentTarget.dataset.count} 筆`}))
}
function renderAlert(events){
 const el=$('alertPreview'),e=(events||[])[0];if(!e){el.classList.remove('show');return}
 const title=e.kind==='CONSENSUS'?`${(e.traderNames||[]).length}人共識｜${eventAction(e)}`:`${e.traderName}｜${eventAction(e)}`;
 const body=e.kind==='CONSENSUS'?`${e.symbol}｜${(e.traderNames||[]).join('、')}`:`${e.symbol}｜${price(e.tradePrice||e.entryPrice)}`;
 el.innerHTML=`<img class="alertIcon" src="/app-icon-192.png?v=54" alt=""><div class="alertText"><div class="alertTitle">${esc(title)}</div><div class="alertBody">${esc(body)}</div></div><div class="alertTime">${localTime(e.ts)}</div>`;
 el.classList.add('show')
}
function renderTraders(list,events){$('traders').innerHTML=list.map(t=>traderCard(t,events)).join('');bindTraderControls()}
async function refresh(){
 try{
  if(!cfg){cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());renderTypeOptions()}
  const s=await fetch('/api/status',{cache:'no-store'}).then(r=>r.json());lastStatus=s;
  const ok=s.healthy>0;$('dot').className=`dot ${ok?'ok':'bad'}`;$('status').textContent=ok?`監控中 ${s.healthy}/${s.total}`:'異常';
  renderMasterToggle();renderAlert(s.events||[]);renderTraders(s.traders||[],s.events||[]);
 }catch{$('dot').className='dot bad';$('status').textContent='連線異常'}
}
$('allToggle').addEventListener('change',async e=>{const ids=e.currentTarget.checked?defaultTraderIds():[];saveEnabledTraders(ids);renderMasterToggle();if(lastStatus)renderTraders(lastStatus.traders||[],lastStatus.events||[]);await syncPreferences().catch(()=>{});$('msg').textContent=e.currentTarget.checked?'✅ 全部交易員已開啟':'🔕 全部交易員已關閉'});
$('subscribe').onclick=async()=>{try{if(!cfg)cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());if(!cfg.vapidPublicKey)throw new Error('伺服器尚未設定推播金鑰');const reg=await navigator.serviceWorker.register('/sw.js?v=54'),permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('你沒有允許通知');const existing=await reg.pushManager.getSubscription(),sub=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(cfg.vapidPublicKey)});const r=await fetch('/api/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subscription:sub,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes()})});if(!r.ok)throw new Error(await r.text());$('msg').textContent='✅ iPhone 通知已同步'}catch(e){$('msg').textContent=`❌ ${e.message}`}};
$('test').onclick=async()=>{const traderId=loadEnabledTraders()[0]||cfg?.traders?.[0]?.id,r=await fetch('/api/test-push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({traderId})});$('msg').textContent=r.ok?'✅ 測試通知已送出':`❌ 測試失敗：${await r.text()}`};
refresh();setInterval(refresh,3000);
