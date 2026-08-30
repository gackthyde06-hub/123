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
async function syncPreferences(){const sub=await getPushSubscription();if(!sub)return;await fetch('/api/preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes(),consensusEnabled:loadConsensusEnabled(),preferenceVersion:65})})}
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
function openTradingViewApp(symbol){const url=tradingViewLink(symbol);if(!url)return false;const w=window.open(url,'_blank','noopener,noreferrer');if(!w)location.href=url;return false}
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
$('subscribe').onclick=async()=>{try{if(!cfg)cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());if(!cfg.vapidPublicKey)throw new Error('伺服器尚未設定推播金鑰');if(!('serviceWorker'in navigator))throw new Error('此瀏覽器不支援通知');const reg=await navigator.serviceWorker.register('/sw.js?v=653'),permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('你沒有允許通知');const existing=await reg.pushManager.getSubscription(),sub=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(cfg.vapidPublicKey)});const r=await fetch('/api/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subscription:sub,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes(),consensusEnabled:loadConsensusEnabled(),preferenceVersion:65})});if(!r.ok)throw new Error(await r.text());$('msg').textContent='✅ iPhone 通知與回踩已同步'}catch(e){$('msg').textContent=`❌ ${e.message}`}};
$('test').onclick=async()=>{const traderId=loadEnabledTraders()[0]||cfg?.traders?.[0]?.id,r=await fetch('/api/test-push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({traderId})});$('msg').textContent=r.ok?'✅ 測試通知已送出':`❌ 測試失敗：${await r.text()}`};
$('testPullback').onclick=async()=>{const r=await fetch('/api/test-pullback-push',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});$('msg').textContent=r.ok?'✅ 回踩測試已送出 · 點通知會開TV':`❌ 回踩測試失敗：${await r.text()}`};

['calcMargin','calcLev','calcMaxLoss'].forEach(id=>$(id)?.addEventListener('input',updateCalc));
$('calcMode')?.addEventListener('change',()=>{setCalcModeUI();saveCalc()});
$('calcTp')?.addEventListener('input',()=>{if(document.activeElement===$('calcTp'))$('useAutoTp').checked=false;updateCalc()});
$('calcSl')?.addEventListener('input',()=>{if(document.activeElement===$('calcSl'))$('useAutoSl').checked=false;updateCalc()});
$('useAutoTp')?.addEventListener('change',()=>applyAutoChoice('TP'));$('useAutoSl')?.addEventListener('change',()=>applyAutoChoice('SL'));
$('autoRefresh')?.addEventListener('click',()=>loadReferenceLevels(true));
$('calcPosition')?.addEventListener('change',()=>applyCalcPosition(false,true));$('tradeCalc')?.addEventListener('toggle',saveCalc);loadCalc();

document.addEventListener('click',e=>{const button=e.target.closest('[data-tv-symbol]');if(button)openTradingViewApp(button.dataset.tvSymbol)});
function launchTvFromNotification(){const symbol=new URLSearchParams(location.search).get('tv');if(!symbol||!/^[A-Z0-9]{5,24}$/.test(symbol))return false;history.replaceState(null,'',location.pathname);setTimeout(()=>openTradingViewApp(symbol),80);return true}
refresh();
launchTvFromNotification();
setInterval(refresh,8000);
setInterval(updateSync,1000);

// V6.6 recovery: page switching + Binance market flow + recommendation view.
let marketFlowState=null,marketFlowFetchedAt=0,marketFlowBusy=false;
function setPage(name){
  const valid=['monitor','flow','ideas'];if(!valid.includes(name))name='monitor';
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===`page-${name}`));
  document.querySelectorAll('.pageTab').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  try{localStorage.setItem('position-alert-page-v66',name)}catch{}
  if(name!=='monitor')void refreshMarketFlow(false);
}
function fmtVol(v){const x=Number(v||0);if(x>=1e9)return`${(x/1e9).toFixed(x>=10e9?1:2)}B`;if(x>=1e6)return`${(x/1e6).toFixed(1)}M`;return x.toLocaleString('en-US',{maximumFractionDigits:0})}
function signed(v,d=2){const x=Number(v||0);return`${x>0?'+':''}${x.toFixed(d)}%`}
function renderMarketFlow(d){
  if(!d?.ok)return;
  marketFlowState=d;marketFlowFetchedAt=Date.now();
  const sm=d.summary||{},dir=sm.direction==='LONG'?'long':sm.direction==='SHORT'?'short':'neutral';
  $('flowHero').className='flowHero';$('flowHero').innerHTML=`<div class="flowHeroTop"><div><div class="flowHeroTitle ${dir}">${esc(sm.label||'多空拉鋸')}</div><div class="flowHeroMeta">成交額加權 ${signed(sm.weightedChangePct||0,2)} · 上漲 ${sm.advancers||0} / 下跌 ${sm.decliners||0}</div></div><div class="flowConfidence">${Number(sm.confidence||0)}<small>流向強度 / 100</small></div></div><div class="flowStats"><div class="flowStat"><span>市場廣度</span><b class="${Number(sm.breadth||0)>=0?'longText':'shortText'}">${signed(Number(sm.breadth||0)*100,1)}</b></div><div class="flowStat"><span>資料來源</span><b class="goldText">Binance</b></div><div class="flowStat"><span>更新</span><b>${ageText(d.generatedAt)}</b></div></div>`;
  const rows=(d.leaders||[]).slice(0,16);$('marketList').innerHTML=rows.map(x=>`<div class="marketRow"><div><div class="marketSym">${esc(x.symbol)}</div><div class="marketSub">${price(x.price)}</div></div><div class="marketMetric"><span>24h</span><b class="${Number(x.changePct)>=0?'longText':'shortText'}">${signed(x.changePct)}</b></div><div class="marketMetric"><span>成交額 / 資金費</span><b>${fmtVol(x.quoteVolume)}</b><div class="marketSub">${signed(x.fundingPct,4)}</div></div><button class="tvMini" type="button" data-tv-symbol="${esc(x.symbol)}" aria-label="開啟 ${esc(x.symbol)} TradingView">TV</button></div>`).join('')||'<div class="loadingBox">暫無資料</div>';
  const recs=(d.recommendations||[]).slice(0,10);$('recGrid').innerHTML=recs.map(x=>{const r=x.recommendation||{},long=r.direction==='LONG';return`<div class="recCard"><div class="recTop"><div class="recSymbolWrap"><div class="recSymbol">${esc(x.symbol)}</div><button class="tvMini" type="button" data-tv-symbol="${esc(x.symbol)}" aria-label="開啟 ${esc(x.symbol)} TradingView">開TV</button></div><span class="recTag ${long?'long':'short'}">${esc(r.label||'等待')}</span></div><div class="recScore"><span>評分核心：動能 × 流動性 × 擁擠修正</span><b>${Number(r.score||0)}/100</b></div><div class="recReason">${esc(r.reason||'')} · 24h ${signed(x.changePct)} · 成交額 ${fmtVol(x.quoteVolume)} · 資金費 ${signed(x.fundingPct,4)}</div></div>`}).join('')||'<div class="loadingBox">目前沒有足夠強的方向建議。</div>';
  const stale=$('flowStale');if(d.stale){stale.classList.add('show');stale.textContent=`Binance 即時清單逾時，先保留上一份成功快照（${Math.round(Number(d.cacheAgeMs||0)/1000)} 秒前），避免整頁空白。`}else{stale.classList.remove('show');stale.textContent=''}
  $('flowAge').textContent=d.stale?'快照回退':ageText(d.generatedAt);$('ideaAge').textContent=d.stale?'快照回退':ageText(d.generatedAt);
}
async function refreshMarketFlow(force=false){
  if(marketFlowBusy)return;if(!force&&marketFlowState&&Date.now()-marketFlowFetchedAt<15000){renderMarketFlow(marketFlowState);return}
  marketFlowBusy=true;
  try{const r=await fetch('/api/market-flow',{cache:'no-store'});const d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderMarketFlow(d)}catch(e){if(marketFlowState){renderMarketFlow({...marketFlowState,stale:true,error:String(e?.message||e),cacheAgeMs:Date.now()-marketFlowFetchedAt})}else{$('flowHero').className='loadingBox';$('flowHero').textContent='市場資料暫時讀不到，稍後自動重試。';$('marketList').innerHTML='<div class="loadingBox">保留空間，避免版面跳動。</div>';$('recGrid').innerHTML='<div class="loadingBox">市場資料恢復後自動顯示建議。</div>'}}finally{marketFlowBusy=false}
}
document.querySelectorAll('.pageTab').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.page)));
try{setPage(localStorage.getItem('position-alert-page-v66')||'monitor')}catch{setPage('monitor')}
setInterval(()=>{const active=document.querySelector('.pageTab.active')?.dataset?.page;if(active&&active!=='monitor')void refreshMarketFlow(false)},15000);
