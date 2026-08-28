const $=id=>document.getElementById(id);

let cfg=null,lastStatus=null;
const TRADER_PREF='position-alert-traders-v52';
const TYPE_PREF='position-alert-types-v52';
const LABEL_PREF='position-alert-labels-v55';
const DEFAULT_TYPES=['OPEN','ADD','REDUCE','CLOSE','CONSENSUS'];

const activityOpen=new Set();
const positionsOpen=new Set();

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function price(v){const x=Number(v||0);if(!x)return'-';if(x>=1000)return x.toLocaleString('en-US',{maximumFractionDigits:2});if(x>=1)return x.toLocaleString('en-US',{maximumFractionDigits:6});return x.toLocaleString('en-US',{maximumFractionDigits:8})}
function localTime(iso){if(!iso)return'';try{return new Date(iso).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}catch{return''}}
function defaultTraderIds(){return cfg?.traders?.map(t=>t.id)||[]}
function loadArray(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(Array.isArray(v))return v}catch{}return f}
function loadObject(k,f={}){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(v&&typeof v==='object'&&!Array.isArray(v))return v}catch{}return f}
function loadEnabledTraders(){const valid=new Set(defaultTraderIds());return loadArray(TRADER_PREF,defaultTraderIds()).filter(id=>valid.has(id))}
function saveEnabledTraders(x){localStorage.setItem(TRADER_PREF,JSON.stringify(x))}
function loadEnabledTypes(){const valid=new Set(cfg?.eventTypes||DEFAULT_TYPES);return loadArray(TYPE_PREF,[...valid]).filter(x=>valid.has(x))}
function saveEnabledTypes(x){localStorage.setItem(TYPE_PREF,JSON.stringify(x))}
function loadLabels(){
  const saved=loadObject(LABEL_PREF,{});
  return {
    '5075281354358777856': saved['5075281354358777856'] ?? '核心',
    '4112815248716815105': saved['4112815248716815105'] ?? '核心',
    '4855144495762648832': saved['4855144495762648832'] ?? '',
    '4556315195316581632': saved['4556315195316581632'] ?? '',
    ...saved
  }
}
function saveLabel(id,value){const labels=loadLabels();labels[id]=value;localStorage.setItem(LABEL_PREF,JSON.stringify(labels))}
function typeLabel(t){return({OPEN:'建倉',ADD:'加碼',REDUCE:'減碼',CLOSE:'平倉',CONSENSUS:'共識'})[t]||t}
function eventAction(e){if(e.type==='OPEN')return e.direction||'';if(e.type==='ADD')return'加碼';if(e.type==='REDUCE')return'減碼';if(e.type==='CLOSE')return'平倉';if(e.type==='CONSENSUS')return`${e.direction||''}共識`;return e.type||''}
function directionClass(e){
  const side=String(e?.side||'').toUpperCase();
  const dir=String(e?.direction||'');
  if(side==='LONG'||dir.includes('多')) return 'marketUp';
  if(side==='SHORT'||dir.includes('空')) return 'marketDown';
  return '';
}
function avgClass(v){
  const x=Number(v);
  if(!Number.isFinite(x)||x===0)return'neutral';
  return x>0?'up':'down';
}
function avgText(v){
  const x=Number(v);
  if(!Number.isFinite(x))return'—';
  const sign=x>0?'+':'';
  const digits=Math.abs(x)>=100?1:Math.abs(x)>=10?2:3;
  return `${sign}${x.toLocaleString('en-US',{maximumFractionDigits:digits})} U`;
}
function pctText(v){
  const x=Number(v);
  return Number.isFinite(x)?`${x.toFixed(1)}%`:'—';
}
function sampleText(s){
  const n=Number(s?.sample||0);
  return n?`${n} 筆`:'—';
}

async function getPushSubscription(){if(!('serviceWorker'in navigator))return null;const r=await navigator.serviceWorker.getRegistration('/');return r?await r.pushManager.getSubscription():null}
async function syncPreferences(){const sub=await getPushSubscription();if(!sub)return;await fetch('/api/preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes()})})}
function b64ToUint8(base64){const padding='='.repeat((4-base64.length%4)%4),s=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}

function renderMasterToggle(){
  const enabled=loadEnabledTraders();
  $('allToggle').checked=enabled.length===cfg.traders.length;
  $('allCount').textContent=`${enabled.length}/${cfg.traders.length}`;
}

function renderTypeOptions(){
  const enabled=new Set(loadEnabledTypes());
  $('typeOptions').innerHTML=(cfg.eventTypes||DEFAULT_TYPES).map(t=>`
    <label class="typeChoice">
      <input class="typeToggle" type="checkbox" data-type="${esc(t)}" ${enabled.has(t)?'checked':''}>
      <span>${esc(typeLabel(t))}</span>
    </label>`).join('');

  document.querySelectorAll('.typeToggle').forEach(el=>el.addEventListener('change',async()=>{
    const types=[...document.querySelectorAll('.typeToggle:checked')].map(x=>x.dataset.type);
    saveEnabledTypes(types);
    await syncPreferences().catch(()=>{});
    $('msg').textContent='✅ 通知類型已更新';
  }));
}

function positionRow(p,extra=false,open=false){
  const isLong=p.side==='LONG';
  return `<div class="pos ${extra&&!open?'extraPos hidden':extra?'extraPos':''}">
    <div class="symline">
      <span class="sym">${esc(p.symbol)}</span>
      <span class="dirTag ${isLong?'long':'short'}">${esc(p.direction)}</span>
    </div>
    <div class="price ${isLong?'marketUp':'marketDown'}">${price(p.entryPrice)}</div>
  </div>`;
}

function traderEvents(id,events){
  return (events||[])
    .filter(e=>e.traderId===id||(e.kind==='CONSENSUS'&&Array.isArray(e.traderIds)&&e.traderIds.includes(id)))
    .slice(0,6);
}

function miniEventRow(e){
  const cls=directionClass(e);
  return `<div class="miniEvent">
    <span class="time">${localTime(e.ts)}</span>
    <span><span class="act ${cls}">${esc(eventAction(e))}</span> <span class="coin">${esc(e.symbol||'')}</span></span>
    <span class="px ${cls}">${e.kind==='CONSENSUS'?esc((e.traderNames||[]).length+'人'):price(e.tradePrice||e.entryPrice)}</span>
  </div>`;
}

function traderCard(t,events){
  const enabled=loadEnabledTraders().includes(t.id);
  const ok=!t.lastError;
  const list=t.positions||[];
  const first=list.slice(0,1);
  const rest=list.slice(1);
  const evs=traderEvents(t.id,events);
  const posOpen=positionsOpen.has(t.id);
  const actOpen=activityOpen.has(t.id);
  const labels=loadLabels();
  const label=labels[t.id]||'';
  const st=t.recentStats||{};

  let positions=list.length
    ? first.map(p=>positionRow(p,false,posOpen)).join('')+rest.map(p=>positionRow(p,true,posOpen)).join('')
    : '<div class="emptyText">目前無倉位</div>';

  if(rest.length){
    positions+=`<button class="moreBtn" data-id="${esc(t.id)}" data-count="${rest.length}">
      ${posOpen?'收合':`查看其餘 ${rest.length} 筆`}
    </button>`;
  }

  return `<section class="traderCard" data-trader="${esc(t.id)}">
    <div class="traderTop">
      <div class="traderMain">
        <div class="nameLine">
          <div class="traderName">${esc(t.name)}</div>
          <button class="customTag ${label?'':'tagEmpty'}" data-label-id="${esc(t.id)}">${esc(label||'＋標籤')}</button>
        </div>

        <div class="metrics">
          <div class="metric">
            <div class="metricLabel">狀態</div>
            <div class="metricValue neutral">${ok?(t.baselineReady?'● 監控中':'● 建立中'):'● 讀取異常'}</div>
          </div>
          <div class="metric">
            <div class="metricLabel">近期勝率 · ${sampleText(st)}</div>
            <div class="metricValue ${Number(st.winRate)>=50?'up':'down'}">${pctText(st.winRate)}</div>
          </div>
          <div class="metric">
            <div class="metricLabel">平均獲利</div>
            <div class="metricValue ${avgClass(st.avgProfit)}">${avgText(st.avgProfit)}</div>
          </div>
        </div>
      </div>

      <label class="switch">
        <input type="checkbox" class="traderToggle" data-id="${esc(t.id)}" ${enabled?'checked':''}>
        <span class="slider"></span>
      </label>
    </div>

    <div class="positionBox">${positions}</div>

    <details class="activity" data-id="${esc(t.id)}" ${actOpen?'open':''}>
      <summary><b>◷ 最近動靜</b><span>${evs.length?evs.length+' 筆':'無'}　⌄</span></summary>
      <div>${evs.length?evs.map(miniEventRow).join(''):'<div class="emptyText">尚無新動靜</div>'}</div>
    </details>
  </section>`;
}

function bindTraderControls(){
  document.querySelectorAll('.traderToggle').forEach(el=>el.addEventListener('change',async e=>{
    const id=e.currentTarget.dataset.id;
    const set=new Set(loadEnabledTraders());
    e.currentTarget.checked?set.add(id):set.delete(id);
    saveEnabledTraders([...set]);
    renderMasterToggle();
    await syncPreferences().catch(()=>{});
    $('msg').textContent='✅ 交易員通知已更新';
  }));

  document.querySelectorAll('.moreBtn').forEach(btn=>btn.addEventListener('click',e=>{
    const id=e.currentTarget.dataset.id;
    const box=e.currentTarget.closest('.positionBox');
    const extras=[...box.querySelectorAll('.extraPos')];
    const opening=!positionsOpen.has(id);

    if(opening)positionsOpen.add(id);
    else positionsOpen.delete(id);

    extras.forEach(x=>x.classList.toggle('hidden',!opening));
    e.currentTarget.textContent=opening?'收合':`查看其餘 ${e.currentTarget.dataset.count} 筆`;
  }));

  document.querySelectorAll('.activity').forEach(d=>d.addEventListener('toggle',e=>{
    const id=e.currentTarget.dataset.id;
    if(e.currentTarget.open)activityOpen.add(id);
    else activityOpen.delete(id);
  }));

  document.querySelectorAll('.customTag').forEach(btn=>btn.addEventListener('click',e=>{
    const id=e.currentTarget.dataset.labelId;
    const current=loadLabels()[id]||'';
    const value=prompt('自訂標籤（留白可刪除）',current);
    if(value===null)return;
    saveLabel(id,value.trim().slice(0,10));
    if(lastStatus)renderTraders(lastStatus.traders||[],lastStatus.events||[]);
  }));
}

function renderAlert(events){
  const el=$('alertPreview');
  const e=(events||[])[0];
  if(!e){el.classList.remove('show');return}

  const cls=directionClass(e);
  const title=e.kind==='CONSENSUS'
    ? `${(e.traderNames||[]).length}人共識｜${eventAction(e)}`
    : `${e.traderName}｜${eventAction(e)}`;

  const body=e.kind==='CONSENSUS'
    ? `${e.symbol}｜${(e.traderNames||[]).join('、')}`
    : `${e.symbol}｜${price(e.tradePrice||e.entryPrice)}`;

  el.innerHTML=`<img class="alertIcon" src="/app-icon-192.png?v=55" alt="">
    <div class="alertText">
      <div class="alertTitle ${cls}">${esc(title)}</div>
      <div class="alertBody ${cls}">${esc(body)}</div>
    </div>
    <div class="alertTime">${localTime(e.ts)}</div>`;
  el.classList.add('show');
}

function renderTraders(list,events){
  $('traders').innerHTML=list.map(t=>traderCard(t,events)).join('');
  bindTraderControls();
}

async function refresh(){
  try{
    if(!cfg){
      cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());
      renderTypeOptions();
    }

    const s=await fetch('/api/status',{cache:'no-store'}).then(r=>r.json());
    lastStatus=s;

    const ok=s.healthy>0;
    $('dot').className=`dot ${ok?'ok':'bad'}`;
    $('status').textContent=ok?`監控中 ${s.healthy}/${s.total}`:'異常';

    renderMasterToggle();
    renderAlert(s.events||[]);
    renderTraders(s.traders||[],s.events||[]);
  }catch{
    $('dot').className='dot bad';
    $('status').textContent='連線異常';
  }
}

$('allToggle').addEventListener('change',async e=>{
  const ids=e.currentTarget.checked?defaultTraderIds():[];
  saveEnabledTraders(ids);
  renderMasterToggle();
  if(lastStatus)renderTraders(lastStatus.traders||[],lastStatus.events||[]);
  await syncPreferences().catch(()=>{});
  $('msg').textContent=e.currentTarget.checked?'✅ 全部交易員已開啟':'🔕 全部交易員已關閉';
});

$('subscribe').onclick=async()=>{
  try{
    if(!cfg)cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());
    if(!cfg.vapidPublicKey)throw new Error('伺服器尚未設定推播金鑰');
    if(!('serviceWorker'in navigator))throw new Error('此瀏覽器不支援通知');

    const reg=await navigator.serviceWorker.register('/sw.js?v=55');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('你沒有允許通知');

    const existing=await reg.pushManager.getSubscription();
    const sub=existing||await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:b64ToUint8(cfg.vapidPublicKey)
    });

    const r=await fetch('/api/subscribe',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        subscription:sub,
        enabledTraders:loadEnabledTraders(),
        enabledTypes:loadEnabledTypes()
      })
    });

    if(!r.ok)throw new Error(await r.text());
    $('msg').textContent='✅ iPhone 通知已同步';
  }catch(e){
    $('msg').textContent=`❌ ${e.message}`;
  }
};

$('test').onclick=async()=>{
  const traderId=loadEnabledTraders()[0]||cfg?.traders?.[0]?.id;
  const r=await fetch('/api/test-push',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({traderId})
  });
  $('msg').textContent=r.ok?'✅ 測試通知已送出':`❌ 測試失敗：${await r.text()}`;
};

refresh();
setInterval(refresh,8000);
