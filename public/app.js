const $=id=>document.getElementById(id);

let cfg=null,lastStatus=null,currentLabelId=null;
const TRADER_PREF='position-alert-traders-v63';
const TYPE_PREF='position-alert-types-v52';
const LABEL_PREF='position-alert-labels-v55';
const UI_PREF='position-alert-ui-v57';
const CALC_PREF='position-alert-order-calc-v610';
const CONSENSUS_PREF='position-alert-consensus-v62';
const ORDER_PREF='position-alert-trader-order-v63';
const PULLBACK_TYPE_MIGRATION='position-alert-pullback-types-v65';
const BRIEF_NOTIFY_PREF='position-alert-brief-notify-v72';
const TEST_SIGNAL_NOTIFY_PREF='position-alert-test-signal-notify-v78';
const CORE_TRADER_ID='5075281354358777856';
const PULLBACK_TYPES=['PULLBACK','DEEP_PULLBACK','INVALIDATION'];
const DEFAULT_TYPES=['OPEN','ADD','REDUCE','CLOSE',...PULLBACK_TYPES,'CONSENSUS'];

const ui=loadObject(UI_PREF,{activityOpen:[],positionsOpen:[],statsOpen:[],settingsOpen:false});
const activityOpen=new Set(ui.activityOpen||[]);
const positionsOpen=new Set(ui.positionsOpen||[]);
const statsOpen=new Set(ui.statsOpen||[]);

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function price(v){const x=Number(v||0);if(!x)return'-';if(x>=1000)return x.toLocaleString('en-US',{maximumFractionDigits:2});if(x>=1)return x.toLocaleString('en-US',{maximumFractionDigits:6});return x.toLocaleString('en-US',{maximumFractionDigits:8})}
function localTime(iso){if(!iso)return'';try{return new Date(iso).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}catch{return''}}
function ageText(iso){if(!iso)return'尚未同步';const sec=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/1000));if(sec<60)return`${sec} 秒前`;const min=Math.floor(sec/60);if(min<60)return`${min} 分前`;const hr=Math.floor(min/60);return`${hr} 小時前`}
function defaultTraderIds(){return cfg?.traders?.map(t=>t.id)||[]}
function loadConsensusEnabled(){try{const v=localStorage.getItem(CONSENSUS_PREF);return v===null?true:v==='1'}catch{return true}}
function saveConsensusEnabled(v){try{localStorage.setItem(CONSENSUS_PREF,v?'1':'0')}catch{}}
function loadBriefNotify(){try{return localStorage.getItem(BRIEF_NOTIFY_PREF)==='1'}catch{return false}}
function saveBriefNotify(v){try{localStorage.setItem(BRIEF_NOTIFY_PREF,v?'1':'0')}catch{}}
function loadTestSignalNotify(){try{return localStorage.getItem(TEST_SIGNAL_NOTIFY_PREF)==='1'}catch{return false}}
function saveTestSignalNotify(v){try{localStorage.setItem(TEST_SIGNAL_NOTIFY_PREF,v?'1':'0')}catch{}}
function loadBriefInterval(){return 24}
function loadTraderOrder(){const all=defaultTraderIds(),valid=new Set(all),saved=loadArray(ORDER_PREF,[]).filter(id=>valid.has(id)),merged=[...new Set([CORE_TRADER_ID,...saved,...all])];return merged.filter(id=>valid.has(id))}
function saveTraderOrder(ids){const all=defaultTraderIds(),valid=new Set(all),clean=[CORE_TRADER_ID,...ids.filter(id=>id!==CORE_TRADER_ID&&valid.has(id))];localStorage.setItem(ORDER_PREF,JSON.stringify([...new Set(clean)]))}
function orderedTraders(list){const order=loadTraderOrder(),rank=new Map(order.map((id,i)=>[id,i]));return [...(list||[])].sort((a,b)=>(a.id===CORE_TRADER_ID?-1:b.id===CORE_TRADER_ID?1:(rank.get(a.id)??999)-(rank.get(b.id)??999)))}
function loadArray(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(Array.isArray(v))return v}catch{}return f}
function loadObject(k,f={}){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(v&&typeof v==='object'&&!Array.isArray(v))return v}catch{}return f}
function saveUI(){localStorage.setItem(UI_PREF,JSON.stringify({activityOpen:[...activityOpen],positionsOpen:[...positionsOpen],statsOpen:[...statsOpen],settingsOpen:$('settingsPanel')?.open||false}))}
function loadEnabledTraders(){const valid=new Set(defaultTraderIds());return loadArray(TRADER_PREF,defaultTraderIds()).filter(id=>valid.has(id))}
function saveEnabledTraders(x){localStorage.setItem(TRADER_PREF,JSON.stringify(x))}
function loadEnabledTypes(){const valid=new Set(cfg?.eventTypes||DEFAULT_TYPES);return loadArray(TYPE_PREF,[...valid]).filter(x=>valid.has(x))}
function saveEnabledTypes(x){localStorage.setItem(TYPE_PREF,JSON.stringify(x))}
function migratePullbackTypes(){try{if(localStorage.getItem(PULLBACK_TYPE_MIGRATION)==='1')return;const valid=new Set(cfg?.eventTypes||DEFAULT_TYPES),saved=loadArray(TYPE_PREF,[...valid]).filter(x=>valid.has(x));saveEnabledTypes([...new Set([...saved,...PULLBACK_TYPES.filter(x=>valid.has(x))])]);localStorage.setItem(PULLBACK_TYPE_MIGRATION,'1')}catch{}}
function loadLabels(){const saved=loadObject(LABEL_PREF,{}),out={};for(const t of cfg?.traders||[]){out[t.id]=saved[t.id]??t.defaultTag??''}return out}
function saveLabel(id,value){const labels=loadObject(LABEL_PREF,{});labels[id]=value;localStorage.setItem(LABEL_PREF,JSON.stringify(labels))}
function typeLabel(t){return({OPEN:'建倉',ADD:'加碼',REDUCE:'減碼',CLOSE:'平倉',PULLBACK:'回踩',DEEP_PULLBACK:'深回踩',INVALIDATION:'過深/失效',CONSENSUS:'共識'})[t]||t}
function eventAction(e){if(e.type==='OPEN')return e.direction||'';if(e.type==='ADD')return'加碼';if(e.type==='REDUCE')return'減碼';if(e.type==='CLOSE')return hasNum(e.realizedPricePct)?`平倉 ${signedPct(e.realizedPricePct)}`:'平倉';if(e.type==='PULLBACK')return'一般回踩';if(e.type==='DEEP_PULLBACK')return'深度回踩';if(e.type==='INVALIDATION')return e.reason==='STRUCTURE'?'結構失效':'回踩過深';if(e.type==='CONSENSUS')return`${e.direction||''}共識`;return e.type||''}
function actionClass(e){const type=String(e?.type||'').toUpperCase(),side=String(e?.side||'').toUpperCase(),dir=String(e?.direction||'');if(type==='INVALIDATION')return'warnText';if(type==='PULLBACK'||type==='DEEP_PULLBACK')return'gold';if(type==='REDUCE')return'green';if(type==='CLOSE')return'gold';if(side==='LONG'||dir.includes('多'))return'red';if(side==='SHORT'||dir.includes('空'))return'green';return'gold'}
function activityClass(a){if(!a)return'';if(a.code==='REDUCING')return'reduce';if(a.code==='JUST_OPENED'||a.code==='ADDING')return'long';if(a.code==='JUST_CLOSED')return'close';return''}
function confidenceLabel(c){return({HIGH:'高',MEDIUM:'中',LOW:'低'})[c]||'低'}
function confidenceClass(c){return String(c||'LOW').toLowerCase()}
function signalClass(v){return String(v?.level||'WAIT').toLowerCase()}
function sourceClass(d){const s=String(d?.sourceType||'NONE').toLowerCase();return s==='live'?'live':s==='public'?'public':'none'}
function sourceStatusZh(v){return({OK:'正常',NO_HISTORY:'無歷史',PARSE_ERROR:'格式變更',ERROR:'暫時失敗',WAITING:'同步中',EMPTY:'空倉',EMPTY_CONFIRMING:'確認中',HIDDEN_OR_EMPTY:'隱藏/未知',PARTIAL_OR_HIDDEN:'部分/隱藏'})[String(v||'WAITING')]||String(v||'同步中')}
function hasNum(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function numberText(v,d=0){if(!hasNum(v))return'—';return Number(v).toLocaleString('en-US',{maximumFractionDigits:d})}
function leverageText(v){return hasNum(v)?`${Number(v).toFixed(Number(v)%1?1:0)}x`:'—'}
function positionEmptyText(t){
  const p=String(t?.positionStatus||'WAITING');
  if(p==='ERROR')return'倉位來源暫時不可用 · 自動重試中';
  if(p==='PARSE_ERROR')return'Binance 倉位格式變更 · 訂單備援監控中';
  if(p==='HIDDEN_OR_EMPTY')return'帶單員可能隱藏倉位 · 以訂單紀錄為準';
  if(p==='PARTIAL_OR_HIDDEN')return'公開倉位不完整 · 以訂單紀錄為準';
  if(p==='EMPTY_CONFIRMING')return'目前無倉位 · 快照確認中';
  if(p==='WAITING')return'同步倉位中…';
  return'目前無倉位';
}
function positionSummary(t,list){
  if((list||[]).length)return`持倉 ${(list||[]).length}`;
  const p=String(t?.positionStatus||'WAITING');
  if(p==='HIDDEN_OR_EMPTY'||p==='PARTIAL_OR_HIDDEN')return'倉位隱藏';
  if(p==='ERROR'||p==='PARSE_ERROR'||p==='WAITING')return'倉位未知';
  return'空倉';
}
function eventValue(e){
  if(e?.kind==='CONSENSUS')return`${(e.traderNames||[]).length}人`;
  if(e?.kind==='PULLBACK'&&hasNum(e?.retracementPct))return`${Number(e.retracementPct).toFixed(1)}% · ${price(e?.tradePrice)}`;
  if(e?.priceLabel)return e.priceLabel;
  return price(e?.tradePrice||e?.entryPrice);
}
function pct(v,d=1){if(v===null||v===undefined||v==='')return'—';const x=Number(v);return Number.isFinite(x)?`${x.toFixed(d)}%`:'—'}
function signedPct(v,d=2){if(v===null||v===undefined||v==='')return'—';const x=Number(v);if(!Number.isFinite(x))return'—';return`${x>0?'+':''}${x.toFixed(d)}%`}
function pnl(v){if(v===null||v===undefined||v==='')return'—';const x=Number(v);if(!Number.isFinite(x))return'—';const digits=Math.abs(x)>=100?1:Math.abs(x)>=10?2:3;return`${x>0?'+':''}${x.toLocaleString('en-US',{maximumFractionDigits:digits})} U`}
function livePnlClass(v){const x=Number(v);if(!Number.isFinite(x)||Math.abs(x)<1e-12)return'flat';return x>0?'profit':'loss'}
function livePnlPct(v){if(v===null||v===undefined||v==='')return'—';const x=Number(v);if(!Number.isFinite(x))return'—';return`${x>0?'+':''}${x.toFixed(2)}%`}
function livePnlU(p){const v=p?.unrealizedPnl;if(v===null||v===undefined||v==='')return'—';const x=Number(v);if(!Number.isFinite(x))return'—';const digits=Math.abs(x)>=100?1:Math.abs(x)>=10?2:3;const approx=p?.pnlEstimated?'≈':'';return`${approx}${x>0?'+':''}${x.toLocaleString('en-US',{maximumFractionDigits:digits})} U`}
function positionOpenText(iso){if(!iso)return'建倉 —';try{const d=new Date(iso);if(!Number.isFinite(d.getTime()))return'建倉 —';const md=d.toLocaleDateString('zh-TW',{month:'2-digit',day:'2-digit'});const hm=d.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false});return`建倉 ${md} ${hm}`}catch{return'建倉 —'}}
function positionTimeMs(p){const x=p?.openTime?new Date(p.openTime).getTime():0;return Number.isFinite(x)?x:0}
function newestPositions(list){return[...(list||[])].sort((a,b)=>positionTimeMs(b)-positionTimeMs(a)||String(a?.symbol||'').localeCompare(String(b?.symbol||'')))}
function pnlPair(pctValue,pnlValue,estimated=false){const pctNum=Number(pctValue),u=Number(pnlValue);if(!Number.isFinite(u))return'';const cls=u>0?'profit':u<0?'loss':'flat',a=Math.abs(u),digits=a>=1000?0:a>=100?1:a>=10?2:3,us=`${estimated?'≈':''}${u>0?'+':u<0?'-':''}${a.toLocaleString('en-US',{maximumFractionDigits:digits})} USDT`;const p=Number.isFinite(pctNum)?`${pctNum>0?'+':''}${pctNum.toFixed(2)}%　`:'';return`<span class="movementPnl ${cls}">(${p}${us})</span>`}
function eventMovementPnl(e,t){if((e?.type==='REDUCE'||e?.type==='CLOSE')&&hasNum(e?.realizedPnl))return pnlPair(e.realizedPricePct,e.realizedPnl,!!e.realizedPnlEstimated);if(e?.type==='OPEN'||e?.type==='ADD'){const p=(t?.positions||[]).find(x=>x.symbol===e.symbol&&x.side===e.side);if(p&&hasNum(p.unrealizedPnl))return pnlPair(p.pnlPct,p.unrealizedPnl,!!p.pnlEstimated)}return''}

function pfText(s){if(s?.profitFactor===null||s?.profitFactor===undefined||s?.profitFactor==='')return'—';const x=Number(s.profitFactor);if(!Number.isFinite(x))return'—';if(s?.pfNoLosses)return'≥9.9';return x>=9.9?'≥9.9':x.toFixed(2)}
function metricClass(v){const x=Number(v);if(!Number.isFinite(x)||x===0)return'gold';return x>0?'up':'down'}
function durationText(v){const x=Number(v);if(!Number.isFinite(x))return'—';if(x<60)return`${Math.round(x)} 分`;if(x<1440)return`${(x/60).toFixed(1)} 小時`;return`${(x/1440).toFixed(1)} 天`}
async function getPushSubscription(){if(!('serviceWorker'in navigator))return null;const r=await navigator.serviceWorker.getRegistration('/');return r?await r.pushManager.getSubscription():null}
async function syncPreferences(){const sub=await getPushSubscription();if(!sub)return;await fetch('/api/preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes(),consensusEnabled:loadConsensusEnabled(),dailyBriefEnabled:loadBriefNotify(),testSignalEnabled:loadTestSignalNotify(),dailyBriefIntervalHours:24,preferenceVersion:79})})}
function b64ToUint8(base64){const padding='='.repeat((4-base64.length%4)%4),s=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}

function renderMaster(){const enabled=loadEnabledTraders();$('allToggle').checked=enabled.length===cfg.traders.length;$('allCount').textContent=`${enabled.length}/${cfg.traders.length}`}
function renderTypes(){const enabled=new Set(loadEnabledTypes());$('typeOptions').innerHTML=(cfg.eventTypes||DEFAULT_TYPES).filter(t=>t!=='CONSENSUS').map(t=>`<label class="typeChoice"><input class="typeToggle" type="checkbox" data-type="${esc(t)}" ${enabled.has(t)?'checked':''}><span>${esc(typeLabel(t))}</span></label>`).join('');document.querySelectorAll('.typeToggle').forEach(el=>el.addEventListener('change',async()=>{const types=[...document.querySelectorAll('.typeToggle:checked')].map(x=>x.dataset.type);saveEnabledTypes(types);await syncPreferences().catch(()=>{});$('msg').textContent='✅ 通知類型已更新'}))}
function qualClass(t){if(t?.core||t?.qualification?.status==='CORE')return'core';return t?.qualification?.qualified?'qualified':'watch'}
function qualText(t){if(t?.core||t?.qualification?.status==='CORE')return'核心';if(t?.qualification?.qualified)return'嚴選合格';const sc=String(t?.screening?.status||'WAITING');if((sc==='ERROR'||t?.historyStatus==='ERROR'||t?.historyStatus==='PARSE_ERROR')&&t?.apiConfirmed)return'API暫斷';if(sc==='ERROR'||t?.historyStatus==='ERROR'||t?.historyStatus==='PARSE_ERROR')return'未啟用';return'觀察'}
function signedMetric(v,d=1){const x=Number(v);if(!Number.isFinite(x))return'—';return`${x>0?'+':''}${x.toFixed(d)}%`}
function renderRadarCount(status){const total=Number(status?.total||0),q=Number(status?.qualified||0),el=$('radarCount');if(el)el.textContent=`同向合格 ${q}/${total}`}
function renderConsensusToggle(){const el=$('consensusToggle');if(el)el.checked=loadConsensusEnabled()}
function renderRateGuard(status){const el=$('rateGuard');if(!el)return;const r=status?.copyRate||{},used=Number(r.usedLast60s||0),budget=Number(r.budgetPerMin||100),q=Number(r.queued||0),a429=Number(r.status429||0),a403=Number(r.status403||0),a418=Number(r.status418||0),paused=!!r.pausedUntil;el.className=`rateGuard ${paused||a418?'bad':used>=budget*.85||a429||a403?'warn':'ok'}`;el.textContent=`限流保護：${used}/${budget} 次/60秒 · 排隊 ${q} · 429 ${a429} · 403 ${a403} · 418 ${a418}${paused?' · 自動暫停中':''}`}
function renderOrderSettings(){const box=$('orderList');if(!box||!cfg)return;const order=loadTraderOrder(),map=new Map(cfg.traders.map(t=>[t.id,t]));box.innerHTML=order.map((id,i)=>{const t=map.get(id);if(!t)return'';const core=id===CORE_TRADER_ID;return`<div class="orderRow"><span><b>${i+1}</b> ${esc(t.name)}${core?' <em>固定第一</em>':''}</span><span class="orderBtns">${core?'':`<button type="button" data-order-up="${esc(id)}" aria-label="往上">↑</button><button type="button" data-order-down="${esc(id)}" aria-label="往下">↓</button>`}</span></div>`}).join('');box.querySelectorAll('[data-order-up]').forEach(b=>b.addEventListener('click',()=>moveTraderOrder(b.dataset.orderUp,-1)));box.querySelectorAll('[data-order-down]').forEach(b=>b.addEventListener('click',()=>moveTraderOrder(b.dataset.orderDown,1)))}
function moveTraderOrder(id,delta){const a=loadTraderOrder(),i=a.indexOf(id);if(i<1)return;const j=Math.max(1,Math.min(a.length-1,i+delta));if(i===j)return;[a[i],a[j]]=[a[j],a[i]];saveTraderOrder(a);renderOrderSettings();if(lastStatus)renderTraders(lastStatus.traders,lastStatus.events)}

function renderLatest(events){
  const el=$('latest'),e=(events||[])[0];
  if(!e||!e.ts||Date.now()-new Date(e.ts).getTime()>30*60*1000){el.classList.remove('show');return}
  const title=e.kind==='CONSENSUS'?`熬鷹同向確認｜${eventAction(e)}`:`${e.traderName}｜${eventAction(e)}`;
  const body=e.kind==='CONSENSUS'?`${e.symbol}｜${(e.traderNames||[]).join('、')}`:`${e.symbol}｜${eventValue(e)}`;
  el.innerHTML=`<div><div class="latestTitle ${actionClass(e)}">${esc(title)}</div><div class="latestBody">${esc(body)}</div></div><div class="latestTime">${ageText(e.ts)}</div>`;
  el.classList.add('show')
}
function renderConsensus(rows){const panel=$('consensusPanel'),list=(rows||[]).slice(0,3);if(!list.length){panel.classList.remove('show');return}panel.innerHTML=`<div class="panelTitle"><b>熬鷹同向確認</b><span>熬鷹 + 嚴選交易員</span></div>`+list.map(c=>{const long=c.side==='LONG',level=String(c.level||'LOW').toLowerCase(),spread=Number.isFinite(Number(c.entrySpreadPct))?`價差 ${Number(c.entrySpreadPct).toFixed(2)}%`:'價差 —',time=Number.isFinite(Number(c.timeSpreadMin))?`時間差 ${Math.round(c.timeSpreadMin)}m`:'時間差 —';return`<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><span class="consensusSymbol">${esc(c.symbol)}</span><span class="dirBadge ${long?'long':'short'}">${esc(c.direction)}</span><span class="levelBadge ${level}">${c.level==='HIGH'?'高':c.level==='MEDIUM'?'中':'低'}</span></div><div class="consensusMeta">${c.count}/${c.total} 人 · ${spread} · ${time}</div></div><div class="consensusScore">${c.score}<small>同向強度</small></div></div>`}).join('');panel.classList.add('show')}
function tradingViewTicker(symbol){let clean=String(symbol||'').toUpperCase().trim();clean=clean.replace(/^BINANCE:/,'').replace(/\.P$/,'').replace(/[^A-Z0-9]/g,'');return clean?`BINANCE:${clean}.P`:''}
function tradingViewLink(symbol){const ticker=tradingViewTicker(symbol);return ticker?`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(ticker)}`:'https://www.tradingview.com/chart/'}
function openTradingViewApp(symbol){const url=tradingViewLink(symbol);if(!url)return false;const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='none';document.body.appendChild(a);a.click();a.remove();return false}
function pullbackRange(z){return z&&hasNum(z.low)&&hasNum(z.high)?`${price(z.low)}～${price(z.high)}`:'計算中'}
function pullbackLine(p){const x=p?.pullback;if(!x)return'';let text=x.label||'同步中',cls='syncing';if(x.status==='WAIT_EXACT_OPEN'){text='等待下一次精確建倉';cls='waiting'}else if(x.status==='PAUSED_API'){text='訂單API暫停 · 不發回踩通知';cls='paused'}else if(x.status==='SYNCING'){text='正在補齊進場結構與極值';cls='syncing'}else if(x.status==='WAIT_MOVE'){text=`等待先走出 ${hasNum(x.activationPct)?Number(x.activationPct).toFixed(2)+'%':'有效距離'}`;cls='waiting'}else if(x.status==='TRACKING'){text=`監控中 · 一般 ${pullbackRange(x.normal)} · 深度 ${pullbackRange(x.deep)}`;cls='active'}else if(x.status==='NORMAL_SENT'){text=`一般回踩已提醒 · 深度 ${pullbackRange(x.deep)}`;cls='normal'}else if(x.status==='DEEP_SENT'){text='深度回踩已提醒 · 等你開TV確認';cls='deep'}else if(x.status==='INVALID'){text='回踩過深／結構失效 · 不視為買點';cls='invalid'}const anchor=x.exactAnchor&&hasNum(x.firstEntryPrice)?`首倉 ${price(x.firstEntryPrice)} · `:'';return`<div class="pullbackLine ${cls}"><div class="pullbackCopy"><b>回踩</b><span>${esc(anchor+text)}</span></div><button type="button" data-tv-symbol="${esc(p.symbol)}">開TV</button></div>`}
function positionRow(p,extra,open){const long=p.side==='LONG',pc=livePnlClass(p.pnlPct);return`<div class="pos ${extra&&!open?'hidden extraPos':extra?'extraPos':''}" data-calc-symbol="${esc(p.symbol)}" data-calc-side="${esc(p.side)}" data-calc-entry="${esc(p.entryPrice)}"><div class="symline"><span class="sym">${esc(p.symbol)}</span><span class="dirTag ${long?'long':'short'}">${esc(p.direction)}</span></div><div class="posPnl ${pc}"><span class="openAt">${esc(positionOpenText(p.openTime))}</span><span class="pnlPct">${livePnlPct(p.pnlPct)}</span></div><div class="entryWrap"><span class="entryLabel">進場位</span><div class="price ${long?'red':'green'}">${price(p.entryPrice)}</div></div>${pullbackLine(p)}</div>`}
function traderEvents(id,events){return(events||[]).filter(e=>e.traderId===id||(e.kind==='CONSENSUS'&&Array.isArray(e.traderIds)&&e.traderIds.includes(id))).slice(0,8)}
function eventRow(e,t){const ep=e?.type==='CLOSE'&&hasNum(e?.realizedPnl)?pnlPair(null,e.realizedPnl,!!e.realizedPnlEstimated):eventMovementPnl(e,t);return`<div class="event"><span class="eventTime">${localTime(e.ts)}</span><span><span class="eventAct ${actionClass(e)}">${esc(eventAction(e))}</span> <span class="eventCoin">${esc(e.symbol||'')}</span>${ep?`<small class="eventPnl">${ep}</small>`:''}</span><span class="eventPx ${actionClass(e)}">${esc(eventValue(e))}</span></div>`}

function traderCard(t,events){
  const enabled=loadEnabledTraders().includes(t.id);
  const list=newestPositions(t.positions),rest=list.slice(1);
  const openPos=positionsOpen.has(t.id),openAct=activityOpen.has(t.id),openStats=statsOpen.has(t.id);
  const evs=traderEvents(t.id,events),labels=loadLabels(),label=labels[t.id]||'';
  const live=t.recentStats||{},ref=t.referenceStats||{},d=t.displayStats||{},a=t.activity||{},sv=t.signalValue||{};

  let positions=list.length
    ? positionRow(list[0],false,openPos)+rest.map(p=>positionRow(p,true,openPos)).join('')
    : `<div class="emptyText">${esc(positionEmptyText(t))}</div>`;

  if(rest.length)positions+=`<button class="moreBtn" data-pos-id="${esc(t.id)}" data-count="${rest.length}">${openPos?'收合':`查看其餘 ${rest.length} 筆`}</button>`;

  const statsReady=Boolean(d.available);
  const sample=Number(d.sample||0);
  const confidence=d.confidence||'LOW';
  const staleness=t.lastFetch?ageText(t.lastFetch):'未同步';
  const signalText=sv.score===null||sv.score===undefined?(sv.label||'空倉'):String(sv.score);

  let metric1Label='資料狀態',metric1Value='等待',metric1Class='muted';
  if(hasNum(d.winRate)){
    metric1Label=`${d.sourceType==='PUBLIC'?'歷史勝率':'近期勝率'} · ${sample||'—'}筆`;
    metric1Value=pct(d.winRate);
    metric1Class=Number(d.winRate)>=50?'up':'down';
  }else if(hasNum(d.qualityScore)){
    metric1Label='公開評分';
    metric1Value=`${Number(d.qualityScore).toFixed(0)}/100`;
    metric1Class='gold';
  }

  let metric2Label='資料狀態',metric2Value='—',metric2Class='muted';
  if(hasNum(t?.screening?.roi30d)){
    metric2Label='30D ROI';metric2Value=signedPct(t.screening.roi30d,1);metric2Class=metricClass(t.screening.roi30d);
  }else if(hasNum(d.reportedRoi)){
    metric2Label='平台 ROI';metric2Value=signedPct(d.reportedRoi,0);metric2Class=metricClass(d.reportedRoi);
  }else if(hasNum(d.medianRoi)){
    metric2Label='中位單筆價格';metric2Value=signedPct(d.medianRoi);metric2Class=metricClass(d.medianRoi);
  }else if(hasNum(d.profitFactor)){
    metric2Label='Profit Factor';metric2Value=pfText(d);metric2Class='gold';
  }else if(hasNum(d.avgDurationMin)){
    metric2Label='中位持倉';metric2Value=durationText(d.avgDurationMin);metric2Class='gold';
  }

  const sourceBadge=statsReady
    ? `<span class="dataBadge ${sourceClass(d)}">${esc(d.sourceLabel||'資料可用')}</span>`
    : `<span class="dataBadge none">資料等待</span>`;

  const confidenceBadge=statsReady
    ? `<span class="confidenceBadge ${confidenceClass(confidence)}">可信 ${confidenceLabel(confidence)}</span>`
    : '';

  const foot=[];
  if(hasNum(d.profitFactor)&&metric2Label!=='Profit Factor')foot.push(`PF ${pfText(d)}`);
  if(hasNum(t?.screening?.roi7d))foot.push(`7D ${signedPct(t.screening.roi7d,1)}`);if(hasNum(d.avgRoi))foot.push(`Avg單筆價格 ${signedPct(d.avgRoi)}`);
  if(hasNum(d.avgDurationMin))foot.push(`${d.sourceType==='PUBLIC'?'中位':'平均'}持倉 ${durationText(d.avgDurationMin)}`);
  if(hasNum(d.followers))foot.push(`跟隨 ${numberText(d.followers,0)}`);
  if(d.sourceType==='LIVE'&&Number(d.orderCount||t.statsOrderCount||0)>0)foot.push(`統計 ${Number(d.orderCount||t.statsOrderCount)} orders`);
  if(d.sourceType==='PUBLIC'&&hasNum(d.qualityScore))foot.push(`公開評分 ${Number(d.qualityScore).toFixed(0)}`);
  if(sv.reason)foot.push(sv.reason);

  const detailCells=[];
  detailCells.push(`<div class="statCell"><span>資料來源</span><b class="gold">${esc(d.sourceLabel||'等待資料')}</b></div>`);
  if(hasNum(d.winRate))detailCells.push(`<div class="statCell"><span>${d.sourceType==='PUBLIC'?'歷史勝率':'近期勝率'}</span><b class="${Number(d.winRate)>=50?'up':'down'}">${pct(d.winRate)}</b></div>`);
  if(hasNum(d.profitFactor))detailCells.push(`<div class="statCell"><span>Profit Factor</span><b>${pfText(d)}</b></div>`);
  if(sample>0)detailCells.push(`<div class="statCell"><span>完整交易樣本</span><b>${sample} 筆</b></div>`);
  if(hasNum(d.avgDurationMin))detailCells.push(`<div class="statCell"><span>${d.sourceType==='PUBLIC'?'中位持倉':'平均持倉'}</span><b>${durationText(d.avgDurationMin)}</b></div>`);
  if(hasNum(d.avgProfit))detailCells.push(`<div class="statCell"><span>平均獲利</span><b class="${metricClass(d.avgProfit)}">${pnl(d.avgProfit)}</b></div>`);
  if(hasNum(d.avgRoi))detailCells.push(`<div class="statCell"><span>平均單筆價格報酬</span><b class="${metricClass(d.avgRoi)}">${signedPct(d.avgRoi)}</b></div>`);
  if(hasNum(d.medianRoi))detailCells.push(`<div class="statCell"><span>中位單筆價格報酬</span><b class="${metricClass(d.medianRoi)}">${signedPct(d.medianRoi)}</b></div>`);
  if(hasNum(d.qualityScore))detailCells.push(`<div class="statCell"><span>公開評分</span><b class="gold">${Number(d.qualityScore).toFixed(0)}/100</b></div>`);
  if(hasNum(d.reportedRoi))detailCells.push(`<div class="statCell"><span>平台標示 ROI</span><b class="${metricClass(d.reportedRoi)}">${signedPct(d.reportedRoi,0)}</b></div>`);
  if(hasNum(d.followers))detailCells.push(`<div class="statCell"><span>跟隨者</span><b>${numberText(d.followers,0)}</b></div>`);
  if(hasNum(d.maxLeverage))detailCells.push(`<div class="statCell"><span>最高槓桿</span><b>${leverageText(d.maxLeverage)}</b></div>`);
  if(hasNum(d.reportedMdd))detailCells.push(`<div class="statCell"><span>平台 MDD</span><b class="down">${pct(-Math.abs(Number(d.reportedMdd)),1)}</b></div>`);
  if(hasNum(t.screening?.roi7d))detailCells.push(`<div class="statCell"><span>7D ROI</span><b class="${Number(t.screening.roi7d)>0?'up':'down'}">${signedMetric(t.screening.roi7d)}</b></div>`);
  if(hasNum(t.screening?.roi30d))detailCells.push(`<div class="statCell"><span>30D ROI</span><b class="${Number(t.screening.roi30d)>0?'up':'down'}">${signedMetric(t.screening.roi30d)}</b></div>`);
  if(hasNum(t.screening?.mdd30d))detailCells.push(`<div class="statCell"><span>30D MDD</span><b class="down">-${Math.abs(Number(t.screening.mdd30d)).toFixed(1)}%</b></div>`);
  if(hasNum(t.screening?.pnl30d))detailCells.push(`<div class="statCell"><span>30D 實際損益</span><b class="${Number(t.screening.pnl30d)>0?'up':'down'}">${pnl(t.screening.pnl30d)}</b></div>`);
  if(hasNum(t.screening?.copierPnl30d))detailCells.push(`<div class="statCell"><span>跟單者 30D</span><b class="${Number(t.screening.copierPnl30d)>0?'up':'down'}">${pnl(t.screening.copierPnl30d)}</b></div>`);
  if(hasNum(t.screening?.ageDays))detailCells.push(`<div class="statCell"><span>帶單歷史</span><b>${Math.floor(Number(t.screening.ageDays))} 天</b></div>`);
  detailCells.push(`<div class="statCell"><span>嚴選資格</span><b class="${t.qualification?.qualified?'up':'gold'}">${esc(qualText(t))}</b></div>`);
  if(Array.isArray(t.qualification?.reasons)&&t.qualification.reasons.length&&!t.core)detailCells.push(`<div class="statCell wideCell"><span>未合格原因</span><b>${esc(t.qualification.reasons.slice(0,4).join(' · '))}</b></div>`);
  detailCells.push(`<div class="statCell"><span>訊號價值</span><b class="gold">${esc(signalText)}${sv.label&&sv.score!=null?` · ${esc(sv.label)}`:''}</b></div>`);
  detailCells.push(`<div class="statCell"><span>統計更新</span><b>${d.updatedAt?ageText(d.updatedAt):'內建公開快照'}</b></div>`);

  return`<section class="traderCard">
    <div class="traderTop">
      <div class="traderMain">
        <div class="nameLine"><div class="traderName">${esc(t.name)}</div><button class="customTag ${label?'':'empty'}" data-label-id="${esc(t.id)}">${esc(label||'＋標籤')}</button></div>
        <div class="stateLine">
          <span class="statusBadge ${activityClass(a)}">${esc(a.label||'監控中')}</span>
          <span class="qualBadge ${qualClass(t)}">${esc(qualText(t))}</span>
          <span class="signalBadge ${signalClass(sv)}">訊號 ${esc(signalText)}</span>
          ${sourceBadge}${confidenceBadge}
          <span class="stateInfo">${esc(positionSummary(t,list))} · ${staleness}</span>
        </div>
      </div>
      <label class="switch"><input class="traderToggle" data-id="${esc(t.id)}" type="checkbox" ${enabled?'checked':''}><span class="slider"></span></label>
    </div>

    <div class="metrics">
      <div class="metric"><div class="metricLabel">${esc(metric1Label)}</div><div class="metricValue ${metric1Class}">${esc(metric1Value)}</div></div>
      <div class="metric"><div class="metricLabel">${esc(metric2Label)}</div><div class="metricValue ${metric2Class}">${esc(metric2Value)}</div></div>
      <div class="metric"><div class="metricLabel">訊號價值</div><div class="metricValue signalValue ${signalClass(sv)}">${esc(signalText)}</div></div>
    </div>

    <div class="statFoot">${foot.map(x=>`<span>${esc(x)}</span>`).join('')}</div>

    <div class="positionBox">${positions}</div>

    <details class="details activity" data-activity-id="${esc(t.id)}" ${openAct?'open':''}>
      <summary><b>◷ 最近動靜 ${evs.length?eventMovementPnl(evs[0],t):''}</b><span>${evs.length?evs.length+' 筆':'無'}　⌄</span></summary>
      <div>${evs.length?evs.map(e=>eventRow(e,t)).join(''):'<div class="emptyText">尚無新動靜</div>'}</div>
    </details>

    <details class="details stats" data-stats-id="${esc(t.id)}" ${openStats?'open':''}>
      <summary><b>▦ 數據明細</b><span>${esc(d.sourceLabel||'等待資料')}　⌄</span></summary>
      <div class="statsGrid">${detailCells.join('')}</div>
      <div class="sourceNote">訂單 ${esc(sourceStatusZh(t.historyStatus))} · 倉位 ${esc(sourceStatusZh(t.positionStatus))}${t.referenceError?' · 公開資料暫用快照':''}</div>
    </details>
  </section>`
}

function calcNum(id){const x=Number($(id)?.value);return Number.isFinite(x)?x:null}
function fmtU(v){if(!Number.isFinite(v))return'—';const a=Math.abs(v),d=a>=1000?0:a>=100?1:a>=10?2:3;return`${v>0?'+':v<0?'-':''}${a.toLocaleString('en-US',{maximumFractionDigits:d})} U`}
function fmtCalcQty(v){if(!Number.isFinite(v)||v<=0)return'—';if(v>=1000)return v.toLocaleString('en-US',{maximumFractionDigits:2});if(v>=1)return v.toLocaleString('en-US',{maximumFractionDigits:5});return v.toLocaleString('en-US',{maximumFractionDigits:8})}
function fmtPlainU(v){if(!Number.isFinite(v)||v<0)return'—';return`${v.toLocaleString('en-US',{maximumFractionDigits:v>=100?1:2})} U`}
function calcMovePct(side,entry,target,favorable=true){if(!(entry>0)||!(target>0))return null;if(side==='SHORT')return favorable?(entry-target)/entry*100:(target-entry)/entry*100;return favorable?(target-entry)/entry*100:(entry-target)/entry*100}
function calcPriceText(v){return Number.isFinite(Number(v))?price(Number(v)):'—'}

let calcRef={key:'',data:null,fetchedAt:0,busy:false};
function saveCalc(){const o={mode:$('calcMode')?.value||'MARGIN',margin:$('calcMargin')?.value||'',lev:$('calcLev')?.value||'',maxLoss:$('calcMaxLoss')?.value||'',position:$('calcPosition')?.value||'',tp:$('calcTp')?.value||'',sl:$('calcSl')?.value||'',useAutoTp:!!$('useAutoTp')?.checked,useAutoSl:!!$('useAutoSl')?.checked,open:$('tradeCalc')?.open||false};try{localStorage.setItem(CALC_PREF,JSON.stringify(o))}catch{}}
function loadCalc(){const d=loadObject(CALC_PREF,{});if($('calcMode'))$('calcMode').value=d.mode==='MAX_LOSS'?'MAX_LOSS':'MARGIN';if($('calcMargin'))$('calcMargin').value=d.margin||'';if($('calcLev'))$('calcLev').value=d.lev||'';if($('calcMaxLoss'))$('calcMaxLoss').value=d.maxLoss||'';if($('calcTp'))$('calcTp').value=d.tp||'';if($('calcSl'))$('calcSl').value=d.sl||'';if($('useAutoTp'))$('useAutoTp').checked=!!d.useAutoTp;if($('useAutoSl'))$('useAutoSl').checked=!!d.useAutoSl;if($('tradeCalc'))$('tradeCalc').open=!!d.open;if($('calcPosition'))$('calcPosition').dataset.saved=d.position||'';setCalcModeUI();updateCalc()}
function calcPositionKey(traderId,p){return `${traderId}|${p.symbol}|${p.side}`}
function monitoredPositions(status){const out=[];for(const t of status?.traders||[]){for(const p of newestPositions(t.positions)){if(!p?.symbol||!p?.side||!(Number(p.entryPrice)>0))continue;out.push({key:calcPositionKey(t.id,p),traderId:t.id,traderName:t.name,symbol:p.symbol,side:p.side,direction:p.direction||(p.side==='SHORT'?'做空':'做多'),entryPrice:Number(p.entryPrice),markPrice:Number(p.markPrice)||null})}}return out}
function renderCalcPositions(status){const sel=$('calcPosition');if(!sel)return;const rows=monitoredPositions(status),old=sel.value||sel.dataset.saved||'';sel.innerHTML=rows.length?'<option value="">請選擇一筆目前倉位</option>'+rows.map(x=>`<option value="${esc(x.key)}" data-symbol="${esc(x.symbol)}" data-side="${esc(x.side)}" data-entry="${esc(x.entryPrice)}">${esc(x.traderName)}｜${esc(x.symbol)}｜${esc(x.direction)}｜進場 ${price(x.entryPrice)}</option>`).join(''):'<option value="">目前沒有可選倉位</option>';if(old&&rows.some(x=>x.key===old))sel.value=old;else if(rows.length===1)sel.value=rows[0].key;sel.dataset.saved='';applyCalcPosition(false,false)}
function clearCalcReference(){calcRef={key:'',data:null,fetchedAt:0,busy:false};$('autoTpRange').textContent='—';$('autoSlRange').textContent='—';$('autoTpPct').textContent='等待抓取';$('autoSlPct').textContent='等待抓取';$('autoTpSuggested').textContent='—';$('autoSlSuggested').textContent='—';$('autoNote').textContent='選倉位後會自動抓一次；你仍可手動輸入。'}
function setCalcModeUI(){const maxMode=$('calcMode')?.value==='MAX_LOSS';$('calcMargin').readOnly=maxMode;$('calcMaxLoss').disabled=!maxMode;$('calcMarginResultLabel').textContent=maxMode?'建議保證金':'使用保證金';if(maxMode){$('calcMargin').placeholder='自動反推'}else{$('calcMargin').placeholder='300'}updateCalc()}
function rangeText(a,b){const x=Number(a),y=Number(b);if(!Number.isFinite(x)||!Number.isFinite(y))return'—';return`${price(Math.min(x,y))} ～ ${price(Math.max(x,y))}`}
function rangePctText(side,entry,a,b,favorable){const p1=calcMovePct(side,entry,Number(a),favorable),p2=calcMovePct(side,entry,Number(b),favorable);if(!Number.isFinite(p1)||!Number.isFinite(p2))return'—';const lo=Math.min(p1,p2),hi=Math.max(p1,p2);return`${lo.toFixed(2)}% ～ ${hi.toFixed(2)}%`}
function renderCalcReference(){const d=calcRef.data,side=$('calcSide').value,entry=calcNum('calcEntry');if(!d){return}$('autoTpRange').textContent=rangeText(d.tp?.low,d.tp?.high);$('autoSlRange').textContent=rangeText(d.sl?.low,d.sl?.high);$('autoTpPct').textContent=`價格潛在 +${rangePctText(side,entry,d.tp?.low,d.tp?.high,true)}`;$('autoSlPct').textContent=`價格風險 -${rangePctText(side,entry,d.sl?.low,d.sl?.high,false)}`;$('autoTpSuggested').textContent=calcPriceText(d.tp?.suggested);$('autoSlSuggested').textContent=calcPriceText(d.sl?.suggested);$('autoNote').textContent=d.note||`ATR14 ${price(d.atr)} · 結構與 1.5R～2.2R 參考`;if($('useAutoTp').checked&&Number(d.tp?.suggested)>0)$('calcTp').value=d.tp.suggested;if($('useAutoSl').checked&&Number(d.sl?.suggested)>0)$('calcSl').value=d.sl.suggested;updateCalc()}
async function loadReferenceLevels(force=false){const symbol=$('calcSymbol').value.trim().toUpperCase(),side=$('calcSide').value,entry=calcNum('calcEntry');if(!symbol||symbol==='—'||!(entry>0))return;const key=`${symbol}|${side}|${entry}`;if(calcRef.busy)return;if(!force&&calcRef.key===key&&calcRef.data&&Date.now()-calcRef.fetchedAt<60_000){renderCalcReference();return}calcRef.busy=true;$('autoRefresh').disabled=true;$('autoTpPct').textContent='抓取中…';$('autoSlPct').textContent='抓取中…';$('autoNote').textContent='正在讀取 Binance 15分結構…';try{const r=await fetch(`/api/reference-levels?symbol=${encodeURIComponent(symbol)}&side=${encodeURIComponent(side)}&entry=${encodeURIComponent(entry)}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const d=await r.json();if(!d?.ok)throw new Error(d?.error||'NO_LEVELS');calcRef={key,data:d,fetchedAt:Date.now(),busy:false};renderCalcReference()}catch(e){calcRef={key:'',data:null,fetchedAt:0,busy:false};$('autoTpRange').textContent='—';$('autoSlRange').textContent='—';$('autoTpPct').textContent='暫時無法抓取';$('autoSlPct').textContent='可直接手動輸入';$('autoNote').textContent='參考區間暫時不可用，不影響手動試算。'}finally{$('autoRefresh').disabled=false;calcRef.busy=false}}
function applyCalcPosition(scroll=true,fetchLevels=true){const sel=$('calcPosition'),opt=sel?.selectedOptions?.[0],symbol=opt?.dataset?.symbol||'',side=opt?.dataset?.side||'',entry=opt?.dataset?.entry||'',newKey=sel?.value||'',oldKey=sel?.dataset?.appliedKey||'';$('calcSymbol').value=symbol||'—';$('calcSide').value=side==='SHORT'?'SHORT':'LONG';$('calcSideLabel').value=symbol?(side==='SHORT'?'做空':'做多'):'—';$('calcEntry').value=entry||'—';if(newKey!==oldKey){sel.dataset.appliedKey=newKey;clearCalcReference();if(symbol){$('calcTp').value='';$('calcSl').value='';$('useAutoTp').checked=false;$('useAutoSl').checked=false}}updateCalc();if(symbol){$('calcMsg').innerHTML=`<span class="calcSelected">已選 ${esc(opt.textContent||'')}</span> · 可採用自動區間或自己輸入 TP / SL`;if(scroll)$('tradeCalc').scrollIntoView({behavior:'smooth',block:'center'});if(fetchLevels)void loadReferenceLevels(false)}saveCalc()}
function applyAutoChoice(type){const d=calcRef.data;if(!d)return;if(type==='TP'){if($('useAutoTp').checked&&Number(d.tp?.suggested)>0)$('calcTp').value=d.tp.suggested}else{if($('useAutoSl').checked&&Number(d.sl?.suggested)>0)$('calcSl').value=d.sl.suggested}updateCalc();saveCalc()}
function updateCalc(){
 const mode=$('calcMode')?.value||'MARGIN',lev=calcNum('calcLev'),entry=calcNum('calcEntry'),tp=calcNum('calcTp'),sl=calcNum('calcSl'),side=$('calcSide')?.value||'LONG',msg=$('calcMsg');
 const marginInput=calcNum('calcMargin'),maxLoss=calcNum('calcMaxLoss');
 const tpMove=entry>0&&tp>0?(side==='LONG'?tp-entry:entry-tp):null,slMove=entry>0&&sl>0?(side==='LONG'?entry-sl:sl-entry):null;
 const tpPricePct=Number.isFinite(tpMove)&&tpMove>0?tpMove/entry*100:null,slPricePct=Number.isFinite(slMove)&&slMove>0?slMove/entry*100:null;
 $('calcTpMove').textContent=Number.isFinite(tpPricePct)?`價格 +${tpPricePct.toFixed(2)}%`:'—';$('calcSlMove').textContent=Number.isFinite(slPricePct)?`價格 -${slPricePct.toFixed(2)}%`:'—';
 ['calcMarginResult','calcNotional','calcQty','calcPriceProfitPct','calcPriceLossPct','calcRR','calcProfit','calcLoss','calcLeveragedPct'].forEach(id=>$(id).textContent='—');msg.classList.remove('bad');
 if(!(entry>0)){msg.textContent='先選擇一筆目前監控倉位。';saveCalc();return}
 if(!(lev>=1&&lev<=125)){msg.textContent='輸入槓桿 1–125X。';saveCalc();return}
 if(!(tp>0)||!(sl>0)){msg.textContent='可等待自動參考區間，或直接手動輸入 TP / SL。';saveCalc();return}
 const dirOk=side==='LONG'?(tp>entry&&sl<entry):(tp<entry&&sl>entry);if(!dirOk){msg.textContent=side==='LONG'?'做多需 TP > 進場、SL < 進場。':'做空需 TP < 進場、SL > 進場。';msg.classList.add('bad');saveCalc();return}
 if(!(slMove>0)||slMove/entry<0.0001){msg.textContent='SL 距離太近，無法做可靠試算。';msg.classList.add('bad');saveCalc();return}
 let margin=null,notional=null,qty=null;
 if(mode==='MAX_LOSS'){
   if(!(maxLoss>0)){msg.textContent='最大虧損模式：先輸入你願意承受的 USDT 虧損。';saveCalc();return}
   qty=maxLoss/slMove;notional=qty*entry;margin=notional/lev;if(!Number.isFinite(margin)||margin<=0||margin>1e8){msg.textContent='反推倉位異常，請檢查 SL 距離。';msg.classList.add('bad');saveCalc();return}$('calcMargin').value=margin.toFixed(margin>=100?1:2)
 }else{
   if(!(marginInput>0)){msg.textContent='固定保證金模式：先輸入保證金 U。';saveCalc();return}
   margin=marginInput;notional=margin*lev;qty=notional/entry;
 }
 const profit=tpMove*qty,loss=slMove*qty,profitPct=profit/margin*100,lossPct=loss/margin*100,rr=loss>0?profit/loss:null;
 $('calcMarginResultLabel').textContent=mode==='MAX_LOSS'?'建議保證金':'使用保證金';$('calcMarginResult').textContent=fmtPlainU(margin);$('calcNotional').textContent=fmtPlainU(notional);$('calcQty').textContent=fmtCalcQty(qty);$('calcPriceProfitPct').textContent=`+${tpPricePct.toFixed(2)}%`;$('calcPriceLossPct').textContent=`-${slPricePct.toFixed(2)}%`;$('calcRR').textContent=Number.isFinite(rr)?`1 : ${rr.toFixed(2)}`:'—';$('calcProfit').textContent=fmtU(profit);$('calcLoss').textContent=`-${Math.abs(loss).toLocaleString('en-US',{maximumFractionDigits:Math.abs(loss)>=100?1:2})} U`;$('calcLeveragedPct').textContent=`+${profitPct.toFixed(1)}% / -${Math.abs(lossPct).toFixed(1)}%`;
 msg.textContent=mode==='MAX_LOSS'?`最大虧損 ${fmtPlainU(maxLoss)} → 建議保證金 ${fmtPlainU(margin)}（${lev}X）`:`${$('calcSymbol').value} · ${side==='LONG'?'做多':'做空'} · 總倉位 ${fmtPlainU(notional)}`;saveCalc();
}
function fillCalcFromPosition(el){if(!el)return;const sym=String(el.dataset.calcSymbol||'').toUpperCase(),side=el.dataset.calcSide||'',entry=String(el.dataset.calcEntry||''),sel=$('calcPosition');if(sel){const opt=[...sel.options].find(o=>o.dataset.symbol===sym&&o.dataset.side===side&&String(o.dataset.entry||'')===entry)||[...sel.options].find(o=>o.dataset.symbol===sym&&o.dataset.side===side);if(opt)sel.value=opt.value}$('tradeCalc').open=true;applyCalcPosition(true,true)}
function bindCalcPositionRows(){document.querySelectorAll('.pos[data-calc-entry]').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('button,input,select,a,label'))return;fillCalcFromPosition(e.currentTarget)}))}

function bindCards(){document.querySelectorAll('.traderToggle').forEach(el=>el.addEventListener('change',async e=>{const set=new Set(loadEnabledTraders()),id=e.currentTarget.dataset.id;e.currentTarget.checked?set.add(id):set.delete(id);saveEnabledTraders([...set]);renderMaster();await syncPreferences().catch(()=>{});$('msg').textContent='✅ 交易員通知已更新'}));document.querySelectorAll('[data-pos-id]').forEach(btn=>btn.addEventListener('click',e=>{const id=e.currentTarget.dataset.posId,box=e.currentTarget.closest('.positionBox'),open=!positionsOpen.has(id);open?positionsOpen.add(id):positionsOpen.delete(id);box.querySelectorAll('.extraPos').forEach(x=>x.classList.toggle('hidden',!open));e.currentTarget.textContent=open?'收合':`查看其餘 ${e.currentTarget.dataset.count} 筆`;saveUI()}));document.querySelectorAll('[data-activity-id]').forEach(d=>d.addEventListener('toggle',e=>{const id=e.currentTarget.dataset.activityId;e.currentTarget.open?activityOpen.add(id):activityOpen.delete(id);saveUI()}));document.querySelectorAll('[data-stats-id]').forEach(d=>d.addEventListener('toggle',e=>{const id=e.currentTarget.dataset.statsId;e.currentTarget.open?statsOpen.add(id):statsOpen.delete(id);saveUI()}));document.querySelectorAll('[data-label-id]').forEach(btn=>btn.addEventListener('click',e=>openLabelSheet(e.currentTarget.dataset.labelId)));bindCalcPositionRows()}
function renderTraders(list,events){$('traders').innerHTML=orderedTraders(list).map(t=>traderCard(t,events)).join('');bindCards()}
function updateSync(){if(!lastStatus)return;const times=(lastStatus.traders||[]).map(t=>t.lastFetch?new Date(t.lastFetch).getTime():0).filter(Boolean);if(!times.length){$('syncAge').textContent='尚未同步';return}const oldest=new Date(Math.min(...times)).toISOString(),sec=Math.max(0,Math.round((Date.now()-new Date(oldest).getTime())/1000));$('syncAge').textContent=`資料 ${ageText(oldest)}`;$('dot').className=`dot ${sec<=10?'ok':sec<=25?'warn':'bad'}`}
function openLabelSheet(id){currentLabelId=id;$('labelInput').value=loadLabels()[id]||'';$('labelModal').classList.add('show');$('labelModal').setAttribute('aria-hidden','false');setTimeout(()=>$('labelInput').focus(),50)}
function closeLabelSheet(){$('labelModal').classList.remove('show');$('labelModal').setAttribute('aria-hidden','true');currentLabelId=null}
function saveLabelSheet(){if(!currentLabelId)return;saveLabel(currentLabelId,$('labelInput').value.trim().slice(0,10));closeLabelSheet();if(lastStatus)renderTraders(lastStatus.traders,lastStatus.events)}
async function refresh(){
  try{
    if(!cfg){
      const cr=await fetch('/api/config',{cache:'no-store'});
      if(!cr.ok)throw new Error(`config ${cr.status}`);
      cfg=await cr.json();
      migratePullbackTypes();
      renderTypes();
      if(localStorage.getItem(TRADER_PREF)===null)saveEnabledTraders([CORE_TRADER_ID]);
      else{
        const existing=loadEnabledTraders();
        saveEnabledTraders(existing.length?existing:[CORE_TRADER_ID]);
      }
      renderConsensusToggle();renderOrderSettings();
      await syncPreferences().catch(()=>{})
    }

    const sr=await fetch('/api/status',{cache:'no-store'});
    if(!sr.ok)throw new Error(`status ${sr.status}`);
    const s=await sr.json();

    lastStatus=s;
    const ok=s.healthy>0;
    $('status').textContent=ok?`監控 ${s.healthy}/${s.total}`:'連線異常';
    renderMaster();
    renderRadarCount(s);
    renderRateGuard(s);
    renderLatest(s.events||[]);
    renderConsensus(s.consensus||[]);
    renderTraders(s.traders||[],s.events||[]);
    renderCalcPositions(s);
    updateSync()
  }catch(e){
    $('dot').className='dot bad';
    $('status').textContent='連線異常';
    $('syncAge').textContent='等待重連'
  }
}

$('allToggle').addEventListener('change',async e=>{const ids=e.currentTarget.checked?defaultTraderIds():[];saveEnabledTraders(ids);renderMaster();if(lastStatus)renderTraders(lastStatus.traders,lastStatus.events);await syncPreferences().catch(()=>{});$('msg').textContent=e.currentTarget.checked?'✅ 全部交易員已開啟':'🔕 全部交易員已關閉'});
$('consensusToggle')?.addEventListener('change',async e=>{saveConsensusEnabled(e.currentTarget.checked);await syncPreferences().catch(()=>{});$('msg').textContent=e.currentTarget.checked?'✅ 熬鷹同向確認已開啟':'🔕 熬鷹同向確認已關閉'});
$('settingsPanel').open=!!ui.settingsOpen;$('settingsPanel').addEventListener('toggle',saveUI);
$('labelCancel').addEventListener('click',closeLabelSheet);$('labelSave').addEventListener('click',saveLabelSheet);$('labelModal').addEventListener('click',e=>{if(e.target===$('labelModal'))closeLabelSheet()});$('labelInput').addEventListener('keydown',e=>{if(e.key==='Enter')saveLabelSheet();if(e.key==='Escape')closeLabelSheet()});
$('subscribe').onclick=async()=>{try{if(!cfg)cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());if(!cfg.vapidPublicKey)throw new Error('伺服器尚未設定推播金鑰');if(!('serviceWorker'in navigator))throw new Error('此瀏覽器不支援通知');const reg=await navigator.serviceWorker.register('/sw.js?v=790'),permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('你沒有允許通知');const existing=await reg.pushManager.getSubscription(),sub=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(cfg.vapidPublicKey)});const r=await fetch('/api/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subscription:sub,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes(),consensusEnabled:loadConsensusEnabled(),dailyBriefEnabled:loadBriefNotify(),testSignalEnabled:loadTestSignalNotify(),dailyBriefIntervalHours:24,preferenceVersion:79})});if(!r.ok)throw new Error(await r.text());$('msg').textContent='✅ iPhone 通知與回踩已同步'}catch(e){$('msg').textContent=`❌ ${e.message}`}};
$('test').onclick=async()=>{const traderId=loadEnabledTraders()[0]||cfg?.traders?.[0]?.id,r=await fetch('/api/test-push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({traderId})});$('msg').textContent=r.ok?'✅ 測試通知已送出':`❌ 測試失敗：${await r.text()}`};
$('testPullback').onclick=async()=>{const r=await fetch('/api/test-pullback-push',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});$('msg').textContent=r.ok?'✅ 回踩測試已送出 · 點通知會開TV':`❌ 回踩測試失敗：${await r.text()}`};

['calcMargin','calcLev','calcMaxLoss'].forEach(id=>$(id)?.addEventListener('input',updateCalc));
$('calcMode')?.addEventListener('change',()=>{setCalcModeUI();saveCalc()});
$('calcTp')?.addEventListener('input',()=>{if(document.activeElement===$('calcTp'))$('useAutoTp').checked=false;updateCalc()});
$('calcSl')?.addEventListener('input',()=>{if(document.activeElement===$('calcSl'))$('useAutoSl').checked=false;updateCalc()});
$('useAutoTp')?.addEventListener('change',()=>applyAutoChoice('TP'));$('useAutoSl')?.addEventListener('change',()=>applyAutoChoice('SL'));
$('autoRefresh')?.addEventListener('click',()=>loadReferenceLevels(true));
$('calcPosition')?.addEventListener('change',()=>applyCalcPosition(false,true));$('tradeCalc')?.addEventListener('toggle',saveCalc);loadCalc();

document.addEventListener('click',e=>{const biasButton=e.target.closest('[data-bias-key]');if(biasButton){todayBiasKey=biasButton.dataset.biasKey;if(marketFlowState?.today)renderToday(marketFlowState);return}const monitor=e.target.closest('[data-test-monitor]');if(monitor){goTestSignalToMonitor(monitor.dataset.testMonitor,monitor.dataset.testDir);return}const expand=e.target.closest('[data-test-expand-all]');if(expand){setAllTestJudgements(true);return}const collapse=e.target.closest('[data-test-collapse-all]');if(collapse){setAllTestJudgements(false);return}const collapseOne=e.target.closest('[data-test-collapse-one]');if(collapseOne){const d=collapseOne.closest('details[data-test-judge]');if(d){d.open=false;testMonitorOpenKeys.delete(d.dataset.testJudge)}return}const close=e.target.closest('[data-test-focus-close]');if(close){testFocusSymbol=null;testFocusDirection='LONG';try{history.replaceState(null,'',location.pathname)}catch{}renderTestFocus();return}const button=e.target.closest('[data-tv-symbol]');if(button)openTradingViewApp(button.dataset.tvSymbol)});
function handleNotificationRoute(){const q=new URLSearchParams(location.search),tv=q.get('tv'),page=q.get('page'),symbol=q.get('testSignal'),dir=q.get('dir');if(symbol&&/^[A-Z0-9]{5,24}$/.test(symbol)){testFocusSymbol=symbol;testFocusDirection=dir==='SHORT'?'SHORT':'LONG';setPage(page==='test'?'test':'monitor');void refreshTestSignals(false);return true}if(tv&&/^[A-Z0-9]{5,24}$/.test(tv)){history.replaceState(null,'',location.pathname);setPage('monitor');setTimeout(()=>openTradingViewApp(tv),80);return true}if(page)setPage(page);return false}
refresh();
setTimeout(()=>handleNotificationRoute(),0);
setInterval(refresh,8000);
setInterval(updateSync,1000);

let marketFlowState=null,marketFlowFetchedAt=0,marketFlowBusy=false,todayBiasKey='LONG';
let dailyBriefState=null,dailyBriefFetchedAt=0,dailyBriefBusy=false;
let rankedIdeasState=null,rankedIdeasFetchedAt=0,rankedIdeasBusy=false;
let testSignalsState=null,testSignalsFetchedAt=0,testSignalsBusy=false,testFocusSymbol=null,testFocusDirection='LONG',testMonitorOpenKeys=new Set();

function setPage(name){
  const valid=['today','monitor','flow','ideas','test'];if(!valid.includes(name))name='today';
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===`page-${name}`));
  document.querySelectorAll('.pageTab').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  try{localStorage.setItem('position-alert-page-v78',name)}catch{}
  if(name==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}
  else if(name==='flow')void refreshMarketFlow(false);
  else if(name==='ideas'){void refreshMarketFlow(false);void refreshRankedIdeas(false)}
  else if(name==='test')void refreshTestSignals(false);
  else if(name==='monitor')void refreshTestSignals(false)
}
function fmtVol(v){const x=Number(v||0);if(x>=1e9)return`${(x/1e9).toFixed(x>=10e9?1:2)}B`;if(x>=1e6)return`${(x/1e6).toFixed(1)}M`;return x.toLocaleString('en-US',{maximumFractionDigits:0})}
function signed(v,d=2){const x=Number(v||0);return`${x>0?'+':''}${x.toFixed(d)}%`}
function biasClassName(key){return({LONG:'long',LONG_WATCH:'longWatch',SHORT_WATCH:'shortWatch',SHORT:'short'})[key]||'watch'}
function renderBiasList(t,activeKey){
  const biases=Array.isArray(t?.biases)?t.biases:[],active=biases.find(x=>x.key===activeKey)||biases[0];
  if(!active){$('todayBiasList').innerHTML='<div class="loadingBox">—</div>';return}
  const cls=biasClassName(active.key),shown=active.items||[];
  const rows=shown.map((x,i)=>`<div class="biasRow ${cls}"><div class="biasRank">${i+1}</div><div class="biasNameCell"><button type="button" class="tvNameLink biasName" data-tv-symbol="${esc(x.symbol)}">${esc(x.symbol)}</button><div class="biasExtra">${fmtVol(x.quoteVolume)} · F ${signed(x.fundingPct,4)}</div></div><div class="biasMetrics"><span class="biasChange">${signed(x.changePct,2)}</span><span class="biasFlow">${x.flowScore>0?'+':''}${Number(x.flowScore||0).toFixed(1)}</span></div></div>`).join('')||'<div class="loadingBox">—</div>';
  $('todayBiasList').innerHTML=`<div class="biasListHead"><div class="biasListHeadMain"><span class="biasDot ${cls}"></span><div><div class="biasListTitle">${esc(active.label)}</div><div class="biasListMeta">前 ${shown.length} / 共 ${Number(active.count||0)}</div></div></div></div><div class="biasListRows">${rows}</div>`;
}
function renderMatrix(t){
  const items=Array.isArray(t?.bubbleMap?.items)?t.bubbleMap.items:[],groups={LONG:[],SHORT_WATCH:[],LONG_WATCH:[],SHORT:[]};for(const x of items){if(groups[x.bias])groups[x.bias].push(x)}
  const order=[['LONG','做多','流入＋漲'],['SHORT_WATCH','空觀','流出＋漲'],['LONG_WATCH','多觀','流入＋跌'],['SHORT','做空','流出＋跌']];
  $('matrixChart').innerHTML=order.map(([key,label,sub])=>{const cls=biasClassName(key),coins=groups[key].slice(0,3).map(x=>`<button type="button" class="matrixCoin" data-tv-symbol="${esc(x.symbol)}"><b>${esc(x.symbol)}</b><span>${signed(x.changePct,1)}</span></button>`).join('');return `<div class="matrixCell ${cls}"><div class="matrixHead"><b>${label}</b><small>${sub}</small></div><div class="matrixCoins">${coins||'<div class="matrixEmpty">—</div>'}</div></div>`}).join('');
}
function renderToday(d){
  const t=d.today||{},biases=Array.isArray(t.biases)?t.biases:[];
  if(biases.length){if(!biases.some(x=>x.key===todayBiasKey))todayBiasKey=t.defaultBias||biases[0].key;$('todayBiases').innerHTML=biases.map(x=>{const cls=biasClassName(x.key),active=x.key===todayBiasKey,shortSub=({LONG:'流入＋漲',LONG_WATCH:'流入＋跌',SHORT_WATCH:'流出＋漲',SHORT:'流出＋跌'})[x.key]||'';return `<button type="button" class="biasCard ${cls} ${active?'active':''}" data-bias-key="${esc(x.key)}"><span class="label">${esc(x.label)}</span><span class="count">${Number(x.count||0)}</span><span class="sub">${shortSub}</span></button>`}).join('');renderBiasList(t,todayBiasKey)}else{$('todayBiases').innerHTML='<div class="loadingBox">—</div>';$('todayBiasList').innerHTML='<div class="loadingBox">—</div>'}
  renderMatrix(t);
}
function renderDailyBrief(d){
  if(!d?.ok)return;
  dailyBriefState=d;dailyBriefFetchedAt=Date.now();
  const score=Math.max(0,Math.min(100,Number(d.score||50))),mood=d.bias==='偏多'?'long':d.bias==='偏空'?'short':'neutral';
  const bullets=(d.bullets||[]).slice(0,6).map(x=>`<li>${esc(x)}</li>`).join('');
  $('todayHero').className='todayHero briefHero';
  $('todayHero').innerHTML=`<div class="todayHeroTop"><div><div class="todayHeroTitle ${mood}">${esc(d.title||'今日市場')}</div><div class="todayHeroMeta">${d.mode==='AI_WEB'?'GPT網搜＋市場':'市場資料'} · ${ageText(d.generatedAt)}</div></div><div class="todayScore">${Math.round(score)}<small>${esc(d.bias||'中性')}</small></div></div><ul class="briefBullets">${bullets}</ul>${d.action?`<div class="briefAction">${esc(d.action)}</div>`:''}`;
  $('todayAge').textContent=ageText(d.generatedAt);
}
async function refreshDailyBrief(force=false){
  if(dailyBriefBusy)return;if(!force&&dailyBriefState&&Date.now()-dailyBriefFetchedAt<60_000){renderDailyBrief(dailyBriefState);return}
  dailyBriefBusy=true;if($('briefRefresh'))$('briefRefresh').disabled=true;
  try{const qs=new URLSearchParams();if(force)qs.set('force','1');const r=await fetch(`/api/daily-brief${qs.toString()?`?${qs.toString()}`:''}`,{cache:'no-store'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderDailyBrief(d);if(d.mode==='AI_WEB')$('briefMsg').textContent=force?'AI 已更新':'AI 已連線';else if(d.aiConfigured===false){const svc=d.runtime?.service?` · ${d.runtime.service}`:'';$('briefMsg').textContent=`AI 未連線${svc}`}else if(d.aiError)$('briefMsg').textContent=`AI：${d.aiError}`;else $('briefMsg').textContent='市場資料'}catch(e){$('briefMsg').textContent='整理暫時不可用'}finally{dailyBriefBusy=false;if($('briefRefresh'))$('briefRefresh').disabled=false}
}
function renderRankedIdeas(d){
  if(!d?.ok)return;rankedIdeasState=d;rankedIdeasFetchedAt=Date.now();
  const rows=d.rows||[];
  $('recGrid').innerHTML=rows.map((x,i)=>{const long=x.direction==='LONG',hit=Number.isFinite(Number(x.historicalHitRate))?`${Number(x.historicalHitRate).toFixed(1)}%`:'—',sample=Number(x.backtestSample||0);return `<div class="rankCard"><div class="rankNo">${i+1}</div><div class="rankMain"><div class="rankTop"><button class="tvNameLink rankSymbol" type="button" data-tv-symbol="${esc(x.symbol)}">${esc(x.symbol)}</button><span class="recTag ${long?'long':'short'}">${long?'做多':'做空'}</span></div><div class="rankReason">${esc(x.reason||'')}</div><div class="rankMini">模型 ${Number(x.modelScore||0)} · 歷史命中 ${hit} / ${sample} · OI ${signed(x.metrics?.oiChangePct||0,1)}</div></div><div class="rankWin"><b>${Number(x.estimatedWinRate||0).toFixed(1)}%</b><span>估算</span><small>${Number(x.rankScore||0).toFixed(0)}分</small></div></div>`}).join('')||'<div class="loadingBox">目前沒有高一致性方向。</div>';
  $('ideaAge').textContent=d.stale?'快照':ageText(d.generatedAt);
}
async function refreshRankedIdeas(force=false){
  if(rankedIdeasBusy)return;if(!force&&rankedIdeasState&&Date.now()-rankedIdeasFetchedAt<60_000){renderRankedIdeas(rankedIdeasState);return}
  rankedIdeasBusy=true;try{const r=await fetch('/api/ranked-ideas',{cache:'no-store'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderRankedIdeas(d)}catch(e){if(rankedIdeasState)renderRankedIdeas({...rankedIdeasState,stale:true});else $('recGrid').innerHTML='<div class="loadingBox">量化排名暫時不可用。</div>'}finally{rankedIdeasBusy=false}
}

function testSignedPct(v,d=2){if(!hasNum(v))return'—';const x=Number(v);return`${x>0?'+':''}${x.toFixed(d)}%`}
function testStatusClass(status){return({CONFIRMED:'confirmed',WIN:'win',LOSS:'loss',INVALID:'invalid',TOUCHING:'touching'})[status]||''}
function testZoneText(setup){return setup&&hasNum(setup.zoneLow)&&hasNum(setup.zoneHigh)?`${price(setup.zoneLow)}～${price(setup.zoneHigh)}`:'建立中'}
function testReasonChips(x){const reasons=x?.lastCheck?.reasons||[];if(reasons.length)return reasons.map(r=>`<span class="testReason">${esc(r)}</span>`).join('');const r=String(x?.idea?.reason||'').split(' · ').filter(Boolean).slice(0,4);return r.map(y=>`<span class="testReason">${esc(y)}</span>`).join('')}
function testEffectiveWinRate(x){
  const bt=x?.setup?.backtest||{};
  if(hasNum(bt.hitRate))return Number(bt.hitRate);
  if(hasNum(x?.idea?.estimatedWinRate))return Number(x.idea.estimatedWinRate);
  if(hasNum(x?.idea?.historicalHitRate))return Number(x.idea.historicalHitRate);
  return -1;
}
function testMonitorCandidates(){
  if(!testSignalsState)return[];
  const rows=testSignalsState.rows||[],picked=new Map();
  rows.forEach(x=>{if(x.notificationSentAt&&['CONFIRMED','WIN','LOSS','TIMEOUT','INVALID'].includes(x.status))picked.set(x.key,x)});
  if(testFocusSymbol){const x=rows.find(r=>r.symbol===testFocusSymbol&&(!testFocusDirection||r.direction===testFocusDirection))||rows.find(r=>r.symbol===testFocusSymbol);if(x)picked.set(x.key,x)}
  return [...picked.values()].sort((a,b)=>testEffectiveWinRate(b)-testEffectiveWinRate(a)||Number(b.qualityScore||0)-Number(a.qualityScore||0)||(a.rank||99)-(b.rank||99));
}
function setAllTestJudgements(open){
  const panel=$('testFocusPanel');if(!panel)return;
  panel.querySelectorAll('details[data-test-judge]').forEach(d=>{d.open=open;if(open)testMonitorOpenKeys.add(d.dataset.testJudge);else testMonitorOpenKeys.delete(d.dataset.testJudge)});
}
function bindTestJudgementDetails(){
  const panel=$('testFocusPanel');if(!panel)return;
  panel.querySelectorAll('details[data-test-judge]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)testMonitorOpenKeys.add(d.dataset.testJudge);else testMonitorOpenKeys.delete(d.dataset.testJudge)}));
}
function renderTestFocus(){
  const panel=$('testFocusPanel');if(!panel)return;
  if(!testSignalsState){if(testFocusSymbol){panel.classList.add('show');panel.innerHTML='<div class="testMonitorTitle">回踩判讀</div><div class="testMonitorSub">載入訊號中…</div>'}else{panel.classList.remove('show');panel.innerHTML=''}return}
  const rows=testMonitorCandidates();
  if(!rows.length){panel.classList.remove('show');panel.innerHTML='';return}
  const focusKey=testFocusSymbol?`${testFocusSymbol}:${testFocusDirection==='SHORT'?'SHORT':'LONG'}`:'';
  if(rows.length===1&&!testMonitorOpenKeys.size)testMonitorOpenKeys.add(rows[0].key);
  if(focusKey)testMonitorOpenKeys.add(focusKey);
  const cards=rows.map((x,i)=>{
    const bt=x.setup?.backtest||{},win=testEffectiveWinRate(x),winText=win>=0?`${win.toFixed(1)}%`:'—',avg=testSignedPct(bt.avgReturnPct,2),pf=hasNum(bt.profitFactor)?Number(bt.profitFactor).toFixed(2):'—',q=Math.max(0,Math.min(100,Number(x.qualityScore||x.setup?.setupScore||0))),isFocus=x.key===focusKey,long=x.direction==='LONG',open=testMonitorOpenKeys.has(x.key);
    return `<details class="testMonitorItem ${isFocus?'focused':''}" data-test-judge="${esc(x.key)}" ${open?'open':''}><summary><div class="testMonitorSummaryMain"><span class="testMonitorSymbol">${i+1}. ${esc(x.symbol)}</span><span class="testMonitorDir ${long?'long':'short'}">${long?'做多':'做空'}</span><span class="testMonitorState">${esc(x.statusLabel||'未破確認')}</span></div><div class="testMonitorSummaryScore"><b>${winText}</b><span>勝率 · 品質 ${q}</span></div></summary><div class="testMonitorBody"><div class="testFocusBody"><div class="testFocusCell"><span>同類1R勝率</span><b>${winText}</b></div><div class="testFocusCell"><span>平均90分報酬</span><b>${avg}</b></div><div class="testFocusCell"><span>回測獲利因子</span><b>${pf}</b></div><div class="testFocusCell"><span>回踩區</span><b>${esc(testZoneText(x.setup))}</b></div><div class="testFocusCell"><span>確認價</span><b>${hasNum(x.confirmationPrice)?price(x.confirmationPrice):'等待確認'}</b></div><div class="testFocusCell"><span>結構失效</span><b>${x.setup?price(x.setup.invalidation):'—'}</b></div></div><div class="testFocusMeta">${testReasonChips(x)||'等待回踩確認資料'} · 回測樣本 ${Number(bt.sample||0)} · 模型估算 ${hasNum(x.idea?.estimatedWinRate)?Number(x.idea.estimatedWinRate).toFixed(1)+'%':'—'}</div><div class="testFocusActions"><button type="button" class="closeJudge" data-test-collapse-one>縮小此筆</button><button type="button" class="openTv" data-tv-symbol="${esc(x.symbol)}">開啟 TV</button></div></div></details>`;
  }).join('');
  panel.classList.add('show');
  panel.innerHTML=`<div class="testMonitorHeader"><div class="testMonitorHeadLeft"><div class="testMonitorTitle">回踩判讀</div><div class="testMonitorSub">通知訊號 ${rows.length} 筆 · 依勝率由高到低</div></div><div class="testMonitorControls"><button type="button" data-test-expand-all>全部展開</button><button type="button" data-test-collapse-all>全部縮小</button></div></div><div class="testMonitorList">${cards}</div>`;
  bindTestJudgementDetails();
}
function goTestSignalToMonitor(symbol,direction){testFocusSymbol=symbol;testFocusDirection=direction==='SHORT'?'SHORT':'LONG';testMonitorOpenKeys.add(`${symbol}:${testFocusDirection}`);try{history.replaceState(null,'',`${location.pathname}?page=monitor&testSignal=${encodeURIComponent(symbol)}&dir=${testFocusDirection}`)}catch{}setPage('monitor');renderTestFocus();window.scrollTo({top:0,behavior:'smooth'})}
function renderTestSignals(d){
  if(!d?.ok)return;testSignalsState=d;testSignalsFetchedAt=Date.now();const rows=d.rows||[],live=d.liveStats||{};
  const active=rows.filter(x=>['WAIT_PULLBACK','TOUCHING','CONFIRMED'].includes(x.status)).length,touching=rows.filter(x=>x.status==='TOUCHING').length,confirmed=rows.filter(x=>x.status==='CONFIRMED').length,liveHit=hasNum(live.hitRate)?`${Number(live.hitRate).toFixed(1)}%`:'—';
  $('testSummary').innerHTML=`<div class="testSummaryCell"><span>監控</span><b>${active}</b></div><div class="testSummaryCell"><span>回踩中</span><b>${touching}</b></div><div class="testSummaryCell"><span>已確認</span><b>${confirmed}</b></div><div class="testSummaryCell"><span>實測勝率</span><b>${liveHit}</b></div>`;
  $('testGrid').innerHTML=rows.map(x=>{const bt=x.setup?.backtest||{},q=Math.max(0,Math.min(100,Number(x.qualityScore||x.setup?.setupScore||0))),long=x.direction==='LONG',hist=hasNum(bt.hitRate)?`${Number(bt.hitRate).toFixed(1)}%`:'—',avg=testSignedPct(bt.avgReturnPct,2),pf=hasNum(bt.profitFactor)?Number(bt.profitFactor).toFixed(2):'—',model=hasNum(x.idea?.estimatedWinRate)?`${Number(x.idea.estimatedWinRate).toFixed(1)}%`:'—',rsi=hasNum(x.lastCheck?.rsi5)?Number(x.lastCheck.rsi5).toFixed(1):'—',oi=testSignedPct(x.lastCheck?.oiChangePct,1);return `<div class="testCard ${testStatusClass(x.status)}"><div class="testHead"><div class="testRank">${x.rank?`#${x.rank}`:'—'}</div><div class="testSymbolRow"><span class="testSymbol">${esc(x.symbol)}</span><span class="testDir ${long?'long':'short'}">${long?'做多':'做空'}</span></div><div class="testState"><b>${esc(x.statusLabel||'等待')}</b><small>${x.updatedAt?ageText(x.updatedAt):'—'}</small></div></div><div class="testQuality"><div class="testQualityBar"><div class="testQualityFill" style="width:${q}%"></div></div><div class="testQualityText">品質 <b>${q||'—'}</b></div></div><div class="testMetrics"><div class="testMetric"><span>同類1R勝率</span><b>${hist}</b></div><div class="testMetric"><span>回測樣本</span><b>${Number(bt.sample||0)}</b></div><div class="testMetric"><span>平均90分報酬</span><b>${avg}</b></div><div class="testMetric"><span>回測獲利因子</span><b>${pf}</b></div><div class="testMetric"><span>模型估算</span><b>${model}</b></div><div class="testMetric"><span>5分 RSI / OI</span><b>${rsi} / ${oi}</b></div></div><div class="testLevels"><div class="testLevel"><span>回踩區</span><b>${esc(testZoneText(x.setup))}</b></div><div class="testLevel"><span>結構失效</span><b>${x.setup?price(x.setup.invalidation):'—'}</b></div><div class="testLevel"><span>確認價</span><b>${hasNum(x.confirmationPrice)?price(x.confirmationPrice):'等待確認'}</b></div><div class="testLevel"><span>1R / 1.5R</span><b>${hasNum(x.target1R)?`${price(x.target1R)} / ${price(x.target15R)}`:'確認後計算'}</b></div></div><div class="testReasons">${testReasonChips(x)||'<span class="testReason">等待5分回踩確認</span>'}</div><div class="testActions"><button type="button" class="monitorBtn" data-test-monitor="${esc(x.symbol)}" data-test-dir="${esc(x.direction)}">到監控判讀</button><button type="button" class="openTvBtn" data-tv-symbol="${esc(x.symbol)}">開啟TV</button></div></div>`}).join('')||'<div class="testEmpty">目前建議排名沒有可追蹤標的。</div>';
  $('testMethod').textContent=`判讀：15分波段/Fib＋EMA/POC/VWAP → 5分收回、拒絕影線/掃流動性、RSI/MACD/量能 → OI/主動買賣 → BTC/ETH 大盤過濾。品質 ≥ ${Number(d.confirmScore||74)} 才確認；歷史回測只使用可回放的價格技術條件，實測勝率則由本 APP 後續真實訊號累積。`;
  $('testAge').textContent=d.generatedAt?ageText(d.generatedAt):'—';renderTestFocus();
}
async function refreshTestSignals(force=false){
  if(testSignalsBusy)return;if(!force&&testSignalsState&&Date.now()-testSignalsFetchedAt<25_000){renderTestSignals(testSignalsState);return}testSignalsBusy=true;
  try{const r=await fetch(`/api/test-signals${force?'?force=1':''}`,{cache:'no-store'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderTestSignals(d)}catch(e){if(testSignalsState)renderTestSignals(testSignalsState);else $('testGrid').innerHTML='<div class="testEmpty">回踩測試暫時不可用。</div>'}finally{testSignalsBusy=false}
}

function renderMarketFlow(d){
  if(!d?.ok)return;marketFlowState=d;marketFlowFetchedAt=Date.now();
  const sm=d.summary||{},dir=sm.direction==='LONG'?'long':sm.direction==='SHORT'?'short':'neutral';
  $('flowHero').className='flowHero';$('flowHero').innerHTML=`<div class="flowHeroTop"><div><div class="flowHeroTitle ${dir}">${esc(sm.label||'多空拉鋸')}</div><div class="flowHeroMeta">加權 ${signed(sm.weightedChangePct||0,2)} · ↑ ${sm.advancers||0} / ↓ ${sm.decliners||0}</div></div><div class="flowConfidence">${Number(sm.confidence||0)}<small>/100</small></div></div><div class="flowStats"><div class="flowStat"><span>廣度</span><b class="${Number(sm.breadth||0)>=0?'longText':'shortText'}">${signed(Number(sm.breadth||0)*100,1)}</b></div><div class="flowStat"><span>來源</span><b class="goldText">Binance</b></div><div class="flowStat"><span>更新</span><b>${ageText(d.generatedAt)}</b></div></div>`;
  const rows=(d.leaders||[]).slice(0,16);$('marketList').innerHTML=rows.map(x=>`<div class="marketRow"><div><button class="tvNameLink marketSym" type="button" data-tv-symbol="${esc(x.symbol)}">${esc(x.symbol)}</button><div class="marketSub">${price(x.price)}</div></div><div class="marketMetric"><span>24h</span><b class="${Number(x.changePct)>=0?'longText':'shortText'}">${signed(x.changePct)}</b></div><div class="marketMetric"><span>額 / F</span><b>${fmtVol(x.quoteVolume)}</b><div class="marketSub">${signed(x.fundingPct,4)}</div></div></div>`).join('')||'<div class="loadingBox">—</div>';
  renderToday(d);
  const stale=$('flowStale');if(d.stale){stale.classList.add('show');stale.textContent='使用上一份市場快照'}else{stale.classList.remove('show');stale.textContent=''}
  $('flowAge').textContent=d.stale?'快照':ageText(d.generatedAt);
}
async function refreshMarketFlow(force=false){
  if(marketFlowBusy)return;if(!force&&marketFlowState&&Date.now()-marketFlowFetchedAt<15000){renderMarketFlow(marketFlowState);return}
  marketFlowBusy=true;try{const r=await fetch('/api/market-flow',{cache:'no-store'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderMarketFlow(d)}catch(e){if(marketFlowState)renderMarketFlow({...marketFlowState,stale:true});else{$('todayBiases').innerHTML='<div class="loadingBox">—</div>';$('todayBiasList').innerHTML='<div class="loadingBox">—</div>';$('matrixChart').innerHTML='<div class="loadingBox">—</div>';$('flowHero').className='loadingBox';$('flowHero').textContent='市場資料暫時不可用';$('marketList').innerHTML='<div class="loadingBox">—</div>'}}finally{marketFlowBusy=false}
}

function initBriefControls(){
  if($('briefNotify'))$('briefNotify').checked=loadBriefNotify();
  $('briefNotify')?.addEventListener('change',async e=>{saveBriefNotify(e.currentTarget.checked);const sub=await getPushSubscription();if(!sub&&e.currentTarget.checked){$('briefMsg').textContent='先到「監控」同步 iPhone 通知';return}await syncPreferences().catch(()=>{});$('briefMsg').textContent=e.currentTarget.checked?'08:05 通知開':'通知關'});
  $('briefRefresh')?.addEventListener('click',()=>refreshDailyBrief(true));
}
initBriefControls();
if($('testSignalNotify')){$('testSignalNotify').checked=loadTestSignalNotify();$('testSignalNotify').addEventListener('change',async e=>{saveTestSignalNotify(e.currentTarget.checked);const sub=await getPushSubscription();if(!sub&&e.currentTarget.checked){e.currentTarget.checked=false;saveTestSignalNotify(false);$('testMethod').textContent='先到「監控」同步通知，再開啟回踩測試通知。';return}await syncPreferences().catch(()=>{});$('testMethod').textContent=e.currentTarget.checked?'回踩未破通知已開啟。':'回踩測試仍會計算，通知已關閉。'})}
document.querySelectorAll('.pageTab').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.page)));
try{setPage(localStorage.getItem('position-alert-page-v78')||'today')}catch{setPage('today')}
setInterval(()=>{const active=document.querySelector('.pageTab.active')?.dataset?.page;if(active==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}else if(active==='flow')void refreshMarketFlow(false);else if(active==='ideas')void refreshRankedIdeas(false);else if(active==='test')void refreshTestSignals(false)},30_000);

