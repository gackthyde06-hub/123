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
const TEST_SIGNAL_NOTIFY_MODE_PREF='position-alert-test-signal-notify-mode-v85';
const TEST_ENTRY_PLAN_PREF='position-alert-test-entry-plan-v85';
const TEST_JUDGE_DISMISS_PREF='position-alert-test-judge-dismiss-v87';
const LATEST_DISMISS_PREF='position-alert-latest-dismiss-v91';
const DETAIL_OPEN_PREF='position-alert-detail-open-v93';
const PERF_SIM_PREF='position-alert-perf-sim-v100';
const CORE_TRADER_ID='5075281354358777856';
const PULLBACK_TYPES=['PULLBACK','DEEP_PULLBACK','INVALIDATION'];
const DEFAULT_TYPES=['OPEN','ADD','REDUCE','CLOSE',...PULLBACK_TYPES,'CONSENSUS'];

const ui=loadObject(UI_PREF,{activityOpen:[],positionsOpen:[],statsOpen:[],settingsOpen:false});
const activityOpen=new Set(ui.activityOpen||[]);
const positionsOpen=new Set(ui.positionsOpen||[]);
const statsOpen=new Set(ui.statsOpen||[]);
const detailOpenKeys=new Set(loadArray(DETAIL_OPEN_PREF,[]));
let latestRenderedKey='';

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function price(v){const x=Number(v||0);if(!x)return'-';if(x>=1000)return x.toLocaleString('en-US',{maximumFractionDigits:2});if(x>=1)return x.toLocaleString('en-US',{maximumFractionDigits:6});return x.toLocaleString('en-US',{maximumFractionDigits:8})}
function localTime(iso){if(!iso)return'';try{const t=new Date(iso).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false,hourCycle:'h23'});return t.replace(/^24:/,'00:')}catch{return''}}
function ageText(iso){if(!iso)return'尚未同步';const sec=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/1000));if(sec<60)return`${sec} 秒前`;const min=Math.floor(sec/60);if(min<60)return`${min} 分前`;const hr=Math.floor(min/60);return`${hr} 小時前`}
function latestEventKey(e){if(!e)return'';return String(e.id||e.eventId||[e.kind||'',e.traderId||'',e.type||'',e.symbol||'',e.ts||''].join('|'))}
function loadLatestDismissed(){try{return localStorage.getItem(LATEST_DISMISS_PREF)||''}catch{return''}}
function dismissLatestNotice(){if(!latestRenderedKey)return;try{localStorage.setItem(LATEST_DISMISS_PREF,latestRenderedKey)}catch{};const el=$('latest');if(el)el.classList.remove('show')}
function defaultTraderIds(){return cfg?.traders?.map(t=>t.id)||[]}
function loadConsensusEnabled(){try{const v=localStorage.getItem(CONSENSUS_PREF);return v===null?true:v==='1'}catch{return true}}
function saveConsensusEnabled(v){try{localStorage.setItem(CONSENSUS_PREF,v?'1':'0')}catch{}}
function loadBriefNotify(){try{return localStorage.getItem(BRIEF_NOTIFY_PREF)==='1'}catch{return false}}
function saveBriefNotify(v){try{localStorage.setItem(BRIEF_NOTIFY_PREF,v?'1':'0')}catch{}}
function loadTestSignalNotify(){try{return localStorage.getItem(TEST_SIGNAL_NOTIFY_PREF)==='1'}catch{return false}}
function saveTestSignalNotify(v){try{localStorage.setItem(TEST_SIGNAL_NOTIFY_PREF,v?'1':'0')}catch{}}
function loadTestSignalNotifyMode(){try{const v=String(localStorage.getItem(TEST_SIGNAL_NOTIFY_MODE_PREF)||'HIGH_NORMAL').toUpperCase();return ['HIGH','HIGH_NORMAL','ALL'].includes(v)?v:'HIGH_NORMAL'}catch{return'HIGH_NORMAL'}}
function saveTestSignalNotifyMode(v){try{localStorage.setItem(TEST_SIGNAL_NOTIFY_MODE_PREF,['HIGH','HIGH_NORMAL','ALL'].includes(String(v))?String(v):'HIGH_NORMAL')}catch{}}
function loadTestEntryPlans(){return loadObject(TEST_ENTRY_PLAN_PREF,{})}
function saveTestEntryPlan(key,value){try{const all=loadTestEntryPlans();all[key]=value;localStorage.setItem(TEST_ENTRY_PLAN_PREF,JSON.stringify(all))}catch{}}
function loadDismissedTestJudgements(){return loadObject(TEST_JUDGE_DISMISS_PREF,{})}
function saveDismissedTestJudgements(v){try{localStorage.setItem(TEST_JUDGE_DISMISS_PREF,JSON.stringify(v||{}))}catch{}}
function testJudgeEventMs(x){const raw=x?.eventAt||x?.stateChangedAt||x?.finishedAt||x?.notificationSentAt||x?.confirmedAt||x?.updatedAt;const ms=raw?Date.parse(raw):0;return Number.isFinite(ms)?ms:0}
function isTestJudgementDismissed(x){if(!x?.key)return false;const v=Number(loadDismissedTestJudgements()[x.key]||0);return v>0&&testJudgeEventMs(x)<=v}
function clearTestJudgementDismiss(key){if(!key)return;const all=loadDismissedTestJudgements();if(Object.prototype.hasOwnProperty.call(all,key)){delete all[key];saveDismissedTestJudgements(all)}}
function dismissTestJudgement(key){if(!key)return;const x=testSignalByKey(key),all=loadDismissedTestJudgements();all[key]=Math.max(Date.now(),testJudgeEventMs(x));saveDismissedTestJudgements(all);testMonitorOpenKeys.delete(key);if(testFocusSymbol&&`${testFocusSymbol}:${testFocusDirection==='SHORT'?'SHORT':'LONG'}`===key){testFocusSymbol=null;testFocusDirection='LONG';try{history.replaceState(null,'',location.pathname)}catch{}}renderTestFocus()}
function loadBriefInterval(){return 24}
function loadTraderOrder(){const all=defaultTraderIds(),valid=new Set(all),saved=loadArray(ORDER_PREF,[]).filter(id=>valid.has(id)),merged=[...new Set([CORE_TRADER_ID,...saved,...all])];return merged.filter(id=>valid.has(id))}
function saveTraderOrder(ids){const all=defaultTraderIds(),valid=new Set(all),clean=[CORE_TRADER_ID,...ids.filter(id=>id!==CORE_TRADER_ID&&valid.has(id))];localStorage.setItem(ORDER_PREF,JSON.stringify([...new Set(clean)]))}
function orderedTraders(list){const order=loadTraderOrder(),rank=new Map(order.map((id,i)=>[id,i]));return [...(list||[])].sort((a,b)=>(a.id===CORE_TRADER_ID?-1:b.id===CORE_TRADER_ID?1:(rank.get(a.id)??999)-(rank.get(b.id)??999)))}
function loadArray(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(Array.isArray(v))return v}catch{}return f}
function loadObject(k,f={}){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(v&&typeof v==='object'&&!Array.isArray(v))return v}catch{}return f}
function saveUI(){localStorage.setItem(UI_PREF,JSON.stringify({activityOpen:[...activityOpen],positionsOpen:[...positionsOpen],statsOpen:[...statsOpen],settingsOpen:$('settingsPanel')?.open||false}))}
function saveDetailOpenKeys(){try{localStorage.setItem(DETAIL_OPEN_PREF,JSON.stringify([...detailOpenKeys].slice(-160)))}catch{}}
function detailOpenAttr(key){return detailOpenKeys.has(String(key))?'open':''}
function setDetailOpen(key,open){key=String(key||'');if(!key)return;if(open)detailOpenKeys.add(key);else detailOpenKeys.delete(key);saveDetailOpenKeys()}
function bindPersistentDetails(root=document){if(!root?.querySelectorAll)return;root.querySelectorAll('details[data-persist-detail]').forEach(d=>{const key=d.dataset.persistDetail||'';if(key&&detailOpenKeys.has(key))d.open=true;if(d.dataset.persistBound==='1')return;d.dataset.persistBound='1';d.addEventListener('toggle',()=>setDetailOpen(key,d.open))})}
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
async function syncPreferences(){const sub=await getPushSubscription();if(!sub)return;await fetch('/api/preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes(),consensusEnabled:loadConsensusEnabled(),dailyBriefEnabled:loadBriefNotify(),testSignalEnabled:loadTestSignalNotify(),testSignalNotifyMode:loadTestSignalNotifyMode(),dailyBriefIntervalHours:24,preferenceVersion:100})})}
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
  if(!e||!e.ts||Date.now()-new Date(e.ts).getTime()>30*60*1000){latestRenderedKey='';el.classList.remove('show');return}
  latestRenderedKey=latestEventKey(e);
  if(latestRenderedKey&&loadLatestDismissed()===latestRenderedKey){el.classList.remove('show');return}
  const title=e.kind==='CONSENSUS'?`熬鷹同向確認｜${eventAction(e)}`:`${e.traderName}｜${eventAction(e)}`;
  const body=e.kind==='CONSENSUS'?`${e.symbol}｜${(e.traderNames||[]).join('、')}`:`${e.symbol}｜${eventValue(e)}`;
  el.innerHTML=`<div class="latestCopy"><div class="latestTitle ${actionClass(e)}">${esc(title)}</div><div class="latestBody">${esc(body)}</div></div><div class="latestAside"><span class="latestTime">${ageText(e.ts)}</span><button type="button" class="latestDismiss" data-latest-dismiss aria-label="關閉這則通知">×</button></div>`;
  el.classList.add('show')
}
function renderConsensus(rows){const panel=$('consensusPanel'),list=(rows||[]).slice(0,3);if(!list.length){panel.classList.remove('show');return}panel.innerHTML=`<div class="panelTitle"><b>熬鷹同向確認</b><span>熬鷹 + 嚴選交易員</span></div>`+list.map(c=>{const long=c.side==='LONG',level=String(c.level||'LOW').toLowerCase(),spread=Number.isFinite(Number(c.entrySpreadPct))?`價差 ${Number(c.entrySpreadPct).toFixed(2)}%`:'價差 —',time=Number.isFinite(Number(c.timeSpreadMin))?`時間差 ${Math.round(c.timeSpreadMin)}m`:'時間差 —';return`<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><span class="consensusSymbol">${esc(c.symbol)}</span><span class="dirBadge ${long?'long':'short'}">${esc(c.direction)}</span><span class="levelBadge ${level}">${c.level==='HIGH'?'高':c.level==='MEDIUM'?'中':'低'}</span></div><div class="consensusMeta">${c.count}/${c.total} 人 · ${spread} · ${time}</div></div><div class="consensusScore">${c.score}<small>同向強度</small></div></div>`}).join('');panel.classList.add('show')}
function tradingViewTicker(symbol){let clean=String(symbol||'').toUpperCase().trim();clean=clean.replace(/^BINANCE:/,'').replace(/\.P$/,'').replace(/[^A-Z0-9]/g,'');return clean?`BINANCE:${clean}.P`:''}
function tradingViewLink(symbol){const ticker=tradingViewTicker(symbol);return ticker?`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(ticker)}`:'https://www.tradingview.com/chart/'}
function tvAnchor(symbol,cls='tvNameLink',label=''){const text=label||symbol;return `<a class="${esc(cls)}" href="${esc(tradingViewLink(symbol))}" target="_blank" rel="noopener noreferrer" data-tv-symbol="${esc(symbol)}" aria-label="開啟 ${esc(symbol)} TradingView">${esc(text)}</a>`}
function openTradingViewApp(symbol){const url=tradingViewLink(symbol);if(!url)return false;const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='none';document.body.appendChild(a);a.click();a.remove();return false}
function pullbackRange(z){return z&&hasNum(z.low)&&hasNum(z.high)?`${price(z.low)}～${price(z.high)}`:'計算中'}
function pullbackLine(p){const x=p?.pullback;if(!x)return'';let text=x.label||'同步中',cls='syncing';if(x.status==='WAIT_EXACT_OPEN'){text='等待下一次精確建倉';cls='waiting'}else if(x.status==='PAUSED_API'){text='訂單API暫停 · 不發回踩通知';cls='paused'}else if(x.status==='SYNCING'){text='正在補齊進場結構與極值';cls='syncing'}else if(x.status==='WAIT_MOVE'){text=`等待先走出 ${hasNum(x.activationPct)?Number(x.activationPct).toFixed(2)+'%':'有效距離'}`;cls='waiting'}else if(x.status==='TRACKING'){text=`監控中 · 一般 ${pullbackRange(x.normal)} · 深度 ${pullbackRange(x.deep)}`;cls='active'}else if(x.status==='NORMAL_SENT'){text=`一般回踩已提醒 · 深度 ${pullbackRange(x.deep)}`;cls='normal'}else if(x.status==='DEEP_SENT'){text='深度回踩已提醒 · 點名稱開TV確認';cls='deep'}else if(x.status==='INVALID'){text='回踩過深／結構失效 · 不視為買點';cls='invalid'}const anchor=x.exactAnchor&&hasNum(x.firstEntryPrice)?`首倉 ${price(x.firstEntryPrice)} · `:'';return`<div class="pullbackLine ${cls}"><div class="pullbackCopy"><b>回踩</b><span>${esc(anchor+text)}</span></div><button type="button" data-position-calc>試算</button></div>`}
function positionRow(p,extra,open){const long=p.side==='LONG',pc=livePnlClass(p.pnlPct);return`<div class="pos ${extra&&!open?'hidden extraPos':extra?'extraPos':''}" data-calc-symbol="${esc(p.symbol)}" data-calc-side="${esc(p.side)}" data-calc-entry="${esc(p.entryPrice)}"><div class="symline">${tvAnchor(p.symbol,'sym symTvLink')}<span class="dirTag ${long?'long':'short'}">${esc(p.direction)}</span></div><div class="posPnl ${pc}"><span class="openAt">${esc(positionOpenText(p.openTime))}</span><span class="pnlPct">${livePnlPct(p.pnlPct)}</span></div><div class="entryWrap"><span class="entryLabel">進場位</span><div class="price ${long?'red':'green'}">${price(p.entryPrice)}</div></div>${pullbackLine(p)}</div>`}
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
function monitoredPositions(status){const out=[];for(const t of status?.traders||[]){for(const p of newestPositions(t.positions)){if(!p?.symbol||!p?.side||!(Number(p.entryPrice)>0))continue;out.push({key:calcPositionKey(t.id,p),source:'TRADER',traderId:t.id,traderName:t.name,symbol:p.symbol,side:p.side,direction:p.direction||(p.side==='SHORT'?'做空':'做多'),entryPrice:Number(p.entryPrice),suggestedPrice:Number(p.entryPrice),notifyPrice:Number(p.entryPrice),currentPrice:Number(p.markPrice)||null,stop:null,target:null,zoneLow:null,zoneHigh:null,rank:null,winRate:null,state:'實際持倉'})}}return out}
function calcSignalCandidates(){if(!testSignalsState)return[];return (testSignalsState.rows||[]).filter(x=>x.notificationSentAt&&!testIsReachedWaiting(x)&&!['DROPPED','EXPIRED'].includes(x.status)).sort((a,b)=>Number(b.priorityScore||0)-Number(a.priorityScore||0)).slice(0,8).map(x=>{const z=testPreferredZone(x),suggested=z?(z.low+z.high)/2:Number(x.reentryEntryPrice||x.confirmationPrice||x.currentPrice||0),re=testIsReentryReady(x);return {key:`TEST|${x.key}`,source:'TEST',traderName:'回踩判讀',symbol:x.symbol,side:x.direction==='SHORT'?'SHORT':'LONG',direction:x.direction==='SHORT'?'做空':'做多',entryPrice:suggested||Number(x.currentPrice)||0,suggestedPrice:suggested||null,notifyPrice:Number(re?x.reentryEntryPrice:x.confirmationPrice)||null,currentPrice:Number(x.currentPrice)||null,stop:Number(re?x.reentryStop:(x.structureProtection||x.stop))||null,target:Number(re?x.reentryTarget1R:x.target1R)||null,zoneLow:z?.low??null,zoneHigh:z?.high??null,rank:Number(x.rank||0)||null,winRate:testEffectiveWinRate(x),state:x.monitorLabel||x.statusLabel||'判讀',tier:testTierLabel(x)}})}
function calcOptionHtml(x){return `<option value="${esc(x.key)}" data-source="${esc(x.source)}" data-symbol="${esc(x.symbol)}" data-side="${esc(x.side)}" data-entry="${esc(x.entryPrice)}" data-suggested="${esc(x.suggestedPrice??'')}" data-notify="${esc(x.notifyPrice??'')}" data-current="${esc(x.currentPrice??'')}" data-stop="${esc(x.stop??'')}" data-target="${esc(x.target??'')}" data-zone-low="${esc(x.zoneLow??'')}" data-zone-high="${esc(x.zoneHigh??'')}" data-rank="${esc(x.rank??'')}" data-win="${esc(x.winRate??'')}" data-state="${esc(x.state||'')}" data-tier="${esc(x.tier||'')}">${esc(x.source==='TEST'?`回踩判讀｜${x.symbol}｜${x.direction}｜${x.state}`:`${x.traderName}｜${x.symbol}｜${x.direction}｜進場 ${price(x.entryPrice)}`)}</option>`}
function renderCalcPositions(status){const sel=$('calcPosition');if(!sel)return;const tests=calcSignalCandidates(),traders=monitoredPositions(status),all=[...tests,...traders],old=sel.value||sel.dataset.saved||'';let html='<option value="">請選擇監控標的</option>';if(tests.length)html+=`<optgroup label="回踩判讀">${tests.map(calcOptionHtml).join('')}</optgroup>`;if(traders.length)html+=`<optgroup label="交易員實際持倉">${traders.map(calcOptionHtml).join('')}</optgroup>`;sel.innerHTML=all.length?html:'<option value="">目前沒有可試算標的</option>';if(old&&all.some(x=>x.key===old))sel.value=old;else if(all.length===1)sel.value=all[0].key;sel.dataset.saved='';applyCalcPosition(false,false)}
function clearCalcReference(){calcRef={key:'',data:null,fetchedAt:0,busy:false};$('autoTpRange').textContent='—';$('autoSlRange').textContent='—';$('autoTpPct').textContent='等待抓取';$('autoSlPct').textContent='等待抓取';$('autoTpSuggested').textContent='—';$('autoSlSuggested').textContent='—';$('autoNote').textContent='選標的後會自動套用回踩結構；若無訊號資料才抓 Binance 15分參考。'}
function setCalcModeUI(){const maxMode=$('calcMode')?.value==='MAX_LOSS';$('calcMargin').readOnly=maxMode;$('calcMaxLoss').disabled=!maxMode;$('calcMarginResultLabel').textContent=maxMode?'建議保證金':'使用保證金';if(maxMode){$('calcMargin').placeholder='自動反推'}else{$('calcMargin').placeholder='300'}updateCalc()}
function rangeText(a,b){const x=Number(a),y=Number(b);if(!Number.isFinite(x)||!Number.isFinite(y))return'—';return`${price(Math.min(x,y))} ～ ${price(Math.max(x,y))}`}
function rangePctText(side,entry,a,b,favorable){const p1=calcMovePct(side,entry,Number(a),favorable),p2=calcMovePct(side,entry,Number(b),favorable);if(!Number.isFinite(p1)||!Number.isFinite(p2))return'—';const lo=Math.min(p1,p2),hi=Math.max(p1,p2);return`${lo.toFixed(2)}% ～ ${hi.toFixed(2)}%`}
function renderCalcReference(){const d=calcRef.data,side=$('calcSide').value,entry=calcNum('calcEntry');if(!d){return}$('autoTpRange').textContent=rangeText(d.tp?.low,d.tp?.high);$('autoSlRange').textContent=rangeText(d.sl?.low,d.sl?.high);$('autoTpPct').textContent=`價格潛在 +${rangePctText(side,entry,d.tp?.low,d.tp?.high,true)}`;$('autoSlPct').textContent=`價格風險 -${rangePctText(side,entry,d.sl?.low,d.sl?.high,false)}`;$('autoTpSuggested').textContent=calcPriceText(d.tp?.suggested);$('autoSlSuggested').textContent=calcPriceText(d.sl?.suggested);$('autoNote').textContent=d.note||`ATR14 ${price(d.atr)} · 結構與 1.5R～2.2R 參考`;if($('useAutoTp').checked&&Number(d.tp?.suggested)>0)$('calcTp').value=d.tp.suggested;if($('useAutoSl').checked&&Number(d.sl?.suggested)>0)$('calcSl').value=d.sl.suggested;updateCalc()}
async function loadReferenceLevels(force=false){const symbol=$('calcSymbol').value.trim().toUpperCase(),side=$('calcSide').value,entry=calcNum('calcEntry');if(!symbol||symbol==='—'||!(entry>0))return;const key=`${symbol}|${side}|${entry}`;if(calcRef.busy)return;if(!force&&calcRef.key===key&&calcRef.data&&Date.now()-calcRef.fetchedAt<60_000){renderCalcReference();return}calcRef.busy=true;$('autoRefresh').disabled=true;$('autoTpPct').textContent='抓取中…';$('autoSlPct').textContent='抓取中…';$('autoNote').textContent='正在讀取 Binance 15分結構…';try{const r=await fetch(`/api/reference-levels?symbol=${encodeURIComponent(symbol)}&side=${encodeURIComponent(side)}&entry=${encodeURIComponent(entry)}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const d=await r.json();if(!d?.ok)throw new Error(d?.error||'NO_LEVELS');calcRef={key,data:d,fetchedAt:Date.now(),busy:false};renderCalcReference()}catch(e){calcRef={key:'',data:null,fetchedAt:0,busy:false};$('autoTpRange').textContent='—';$('autoSlRange').textContent='—';$('autoTpPct').textContent='暫時無法抓取';$('autoSlPct').textContent='可直接手動輸入';$('autoNote').textContent='參考區間暫時不可用，不影響手動試算。'}finally{$('autoRefresh').disabled=false;calcRef.busy=false}}
function calcSelectedOption(){return $('calcPosition')?.selectedOptions?.[0]||null}
function renderCalcSignalContext(opt){const box=$('calcSignalContext');if(!box)return;if(!opt?.dataset?.symbol){box.innerHTML='<span>選擇標的後顯示通知點位、當下價與建議進場。</span>';return}const source=opt.dataset.source==='TEST',rank=opt.dataset.rank,win=Number(opt.dataset.win),zoneLow=Number(opt.dataset.zoneLow),zoneHigh=Number(opt.dataset.zoneHigh),zone=Number.isFinite(zoneLow)&&Number.isFinite(zoneHigh)?`${price(zoneLow)}～${price(zoneHigh)}`:'—';box.innerHTML=`<div><span>來源</span><b>${source?'回踩判讀':'交易員持倉'}</b></div><div><span>狀態</span><b>${esc(opt.dataset.state||'—')}${opt.dataset.tier?` · ${esc(opt.dataset.tier)}`:''}</b></div><div><span>排名 / 勝率</span><b>${rank?`#${esc(rank)}`:'—'} / ${Number.isFinite(win)?win.toFixed(1)+'%':'—'}</b></div><div class="wide"><span>建議區</span><b>${zone}</b></div>`}
function setCalcEntryFrom(kind){const opt=calcSelectedOption();if(!opt)return;const value=Number(opt.dataset[kind]);if(!(value>0))return;$('calcEntry').value=value;clearCalcReference();updateCalc();if(opt.dataset.source==='TEST')applySignalCalcReference(opt);else void loadReferenceLevels(false);saveCalc()}
function applySignalCalcReference(opt){const target=Number(opt?.dataset?.target),stop=Number(opt?.dataset?.stop),entry=calcNum('calcEntry'),zl=Number(opt?.dataset?.zoneLow),zh=Number(opt?.dataset?.zoneHigh);if(!(entry>0)||!(target>0)||!(stop>0)){void loadReferenceLevels(false);return}const zoneText=Number.isFinite(zl)&&Number.isFinite(zh)?`${price(Math.min(zl,zh))}～${price(Math.max(zl,zh))}`:'—';calcRef={key:`TEST|${opt.value}|${entry}`,data:{ok:true,tp:{low:target,high:target,suggested:target},sl:{low:stop,high:stop,suggested:stop},note:`回踩判讀結構：建議區 ${zoneText} · 1R / 結構保護位；預計進場可切換建議價、通知價或當下價。`},fetchedAt:Date.now(),busy:false};renderCalcReference()}
function applyCalcPosition(scroll=true,fetchLevels=true){const sel=$('calcPosition'),opt=calcSelectedOption(),symbol=opt?.dataset?.symbol||'',side=opt?.dataset?.side||'',entry=opt?.dataset?.suggested||opt?.dataset?.entry||'',newKey=sel?.value||'',oldKey=sel?.dataset?.appliedKey||'';$('calcSymbol').value=symbol||'—';$('calcSide').value=side==='SHORT'?'SHORT':'LONG';$('calcSideLabel').value=symbol?(side==='SHORT'?'做空':'做多'):'—';$('calcEntry').value=entry||'';renderCalcSignalContext(opt);if(newKey!==oldKey){sel.dataset.appliedKey=newKey;clearCalcReference();if(symbol){$('calcTp').value='';$('calcSl').value='';$('useAutoTp').checked=false;$('useAutoSl').checked=false}}updateCalc();if(symbol){$('calcMsg').innerHTML=`<span class="calcSelected">已選 ${esc(opt.textContent||'')}</span> · 預計進場可切換建議/通知/當下價`;if(scroll)$('tradeCalc').scrollIntoView({behavior:'smooth',block:'center'});if(fetchLevels){if(opt.dataset.source==='TEST')applySignalCalcReference(opt);else void loadReferenceLevels(false)}}saveCalc()}
function applyAutoChoice(type){const d=calcRef.data;if(!d)return;if(type==='TP'){if($('useAutoTp').checked&&Number(d.tp?.suggested)>0)$('calcTp').value=d.tp.suggested}else{if($('useAutoSl').checked&&Number(d.sl?.suggested)>0)$('calcSl').value=d.sl.suggested}updateCalc();saveCalc()}
function updateCalc(){
 const mode=$('calcMode')?.value||'MARGIN',lev=calcNum('calcLev'),entry=calcNum('calcEntry'),tp=calcNum('calcTp'),sl=calcNum('calcSl'),side=$('calcSide')?.value||'LONG',msg=$('calcMsg');
 const marginInput=calcNum('calcMargin'),maxLoss=calcNum('calcMaxLoss');
 const tpMove=entry>0&&tp>0?(side==='LONG'?tp-entry:entry-tp):null,slMove=entry>0&&sl>0?(side==='LONG'?entry-sl:sl-entry):null;
 const tpPricePct=Number.isFinite(tpMove)&&tpMove>0?tpMove/entry*100:null,slPricePct=Number.isFinite(slMove)&&slMove>0?slMove/entry*100:null;
 $('calcTpMove').textContent=Number.isFinite(tpPricePct)?`價格 +${tpPricePct.toFixed(2)}%`:'—';$('calcSlMove').textContent=Number.isFinite(slPricePct)?`價格 -${slPricePct.toFixed(2)}%`:'—';
 ['calcMarginResult','calcNotional','calcQty','calcPriceProfitPct','calcPriceLossPct','calcRR','calcProfit','calcLoss','calcLeveragedPct'].forEach(id=>$(id).textContent='—');msg.classList.remove('bad');
 if(!(entry>0)){msg.textContent='先選擇一筆監控標的或輸入預計進場。';saveCalc();return}
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
function bindCalcPositionRows(){document.querySelectorAll('[data-position-calc]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fillCalcFromPosition(e.currentTarget.closest('.pos'))}))}

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
$('subscribe').onclick=async()=>{try{if(!cfg)cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());if(!cfg.vapidPublicKey)throw new Error('伺服器尚未設定推播金鑰');if(!('serviceWorker'in navigator))throw new Error('此瀏覽器不支援通知');const reg=await navigator.serviceWorker.register('/sw.js?v=1000'),permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('你沒有允許通知');const existing=await reg.pushManager.getSubscription(),sub=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(cfg.vapidPublicKey)});const r=await fetch('/api/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subscription:sub,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes(),consensusEnabled:loadConsensusEnabled(),dailyBriefEnabled:loadBriefNotify(),testSignalEnabled:loadTestSignalNotify(),testSignalNotifyMode:loadTestSignalNotifyMode(),dailyBriefIntervalHours:24,preferenceVersion:100})});if(!r.ok)throw new Error(await r.text());$('msg').textContent='✅ iPhone 通知與回踩已同步'}catch(e){$('msg').textContent=`❌ ${e.message}`}};
$('test').onclick=async()=>{const traderId=loadEnabledTraders()[0]||cfg?.traders?.[0]?.id,r=await fetch('/api/test-push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({traderId})});$('msg').textContent=r.ok?'✅ 測試通知已送出':`❌ 測試失敗：${await r.text()}`};
$('testPullback').onclick=async()=>{const r=await fetch('/api/test-pullback-push',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});$('msg').textContent=r.ok?'✅ 回踩測試已送出 · 點通知回監控判讀':`❌ 回踩測試失敗：${await r.text()}`};

['calcMargin','calcLev','calcMaxLoss','calcEntry'].forEach(id=>$(id)?.addEventListener('input',()=>{if(id==='calcEntry')clearCalcReference();updateCalc()}));
$('calcMode')?.addEventListener('change',()=>{setCalcModeUI();saveCalc()});
$('calcTp')?.addEventListener('input',()=>{if(document.activeElement===$('calcTp'))$('useAutoTp').checked=false;updateCalc()});
$('calcSl')?.addEventListener('input',()=>{if(document.activeElement===$('calcSl'))$('useAutoSl').checked=false;updateCalc()});
$('useAutoTp')?.addEventListener('change',()=>applyAutoChoice('TP'));$('useAutoSl')?.addEventListener('change',()=>applyAutoChoice('SL'));
$('autoRefresh')?.addEventListener('click',()=>{const opt=calcSelectedOption();if(opt?.dataset?.source==='TEST')applySignalCalcReference(opt);else loadReferenceLevels(true)});
$('calcUseSuggested')?.addEventListener('click',()=>setCalcEntryFrom('suggested'));$('calcUseNotify')?.addEventListener('click',()=>setCalcEntryFrom('notify'));$('calcUseCurrent')?.addEventListener('click',()=>setCalcEntryFrom('current'));
$('calcPosition')?.addEventListener('change',()=>applyCalcPosition(false,true));$('tradeCalc')?.addEventListener('toggle',saveCalc);loadCalc();

document.addEventListener('click',e=>{const latestDismiss=e.target.closest('[data-latest-dismiss]');if(latestDismiss){e.preventDefault();e.stopPropagation();dismissLatestNotice();return}const biasButton=e.target.closest('[data-bias-key]');if(biasButton){todayBiasKey=biasButton.dataset.biasKey;if(marketFlowState?.today)renderToday(marketFlowState);return}const monitor=e.target.closest('[data-test-monitor]');if(monitor){goTestSignalToMonitor(monitor.dataset.testMonitor,monitor.dataset.testDir);return}const dismiss=e.target.closest('[data-test-dismiss]');if(dismiss){e.preventDefault();e.stopPropagation();dismissTestJudgement(dismiss.dataset.testDismiss);return}const expand=e.target.closest('[data-test-expand-all]');if(expand){setAllTestJudgements(true);return}const collapse=e.target.closest('[data-test-collapse-all]');if(collapse){setAllTestJudgements(false);return}const collapseOne=e.target.closest('[data-test-collapse-one]');if(collapseOne){const d=collapseOne.closest('details[data-test-judge]');if(d){d.open=false;testMonitorOpenKeys.delete(d.dataset.testJudge)}return}const close=e.target.closest('[data-test-focus-close]');if(close){testFocusSymbol=null;testFocusDirection='LONG';try{history.replaceState(null,'',location.pathname)}catch{}renderTestFocus();return}const detailBtn=e.target.closest('[data-test-detail-toggle]');if(detailBtn){e.preventDefault();const key=detailBtn.dataset.testDetailToggle||'';const detail=[...document.querySelectorAll('details[data-test-deep-detail]')].find(d=>d.dataset.testDeepDetail===key);if(detail){detail.open=!detail.open;setDetailOpen(`testDeep:${key}`,detail.open)}return}const button=e.target.closest('[data-tv-symbol]');if(button&&button.tagName!=='A')openTradingViewApp(button.dataset.tvSymbol)});
function handleNotificationRoute(){const q=new URLSearchParams(location.search),tv=q.get('tv'),page=q.get('page'),symbol=q.get('testSignal'),dir=q.get('dir');if(symbol&&/^[A-Z0-9]{5,24}$/.test(symbol)){testFocusSymbol=symbol;testFocusDirection=dir==='SHORT'?'SHORT':'LONG';clearTestJudgementDismiss(`${symbol}:${testFocusDirection}`);setPage(page==='test'?'test':'monitor');void refreshTestSignals(false);return true}if(tv&&/^[A-Z0-9]{5,24}$/.test(tv)){history.replaceState(null,'',location.pathname);setPage('monitor');setTimeout(()=>openTradingViewApp(tv),80);return true}if(page)setPage(page);return false}
refresh();
setTimeout(()=>handleNotificationRoute(),0);
setInterval(refresh,8000);
setInterval(updateSync,1000);

let marketFlowState=null,marketFlowFetchedAt=0,marketFlowBusy=false,todayBiasKey='LONG';
let dailyBriefState=null,dailyBriefFetchedAt=0,dailyBriefBusy=false;
let rankedIdeasState=null,rankedIdeasFetchedAt=0,rankedIdeasBusy=false;
const ideaAnalysisCache=new Map();
const ideaAnalysisInflight=new Map();
async function fetchIdeaAnalysisShared(symbol,direction){const key=`${symbol}:${direction}`,cached=ideaAnalysisCache.get(key);if(cached&&Date.now()-cached.at<2*60*60*1000){const age=Date.now()-cached.at;return {...cached.data,cached:true,cacheAgeMs:age,cacheExpiresInMs:Math.max(0,2*60*60*1000-age),cacheMs:2*60*60*1000}}if(ideaAnalysisInflight.has(key))return ideaAnalysisInflight.get(key);const promise=(async()=>{const r=await fetch(`/api/symbol-analysis?symbol=${encodeURIComponent(symbol)}&direction=${encodeURIComponent(direction)}`,{cache:'no-store'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);ideaAnalysisCache.set(key,{at:Date.now(),data:d});return d})().finally(()=>ideaAnalysisInflight.delete(key));ideaAnalysisInflight.set(key,promise);return promise}
let testSignalsState=null,testSignalsFetchedAt=0,testSignalsBusy=false,testFocusSymbol=null,testFocusDirection='LONG',testMonitorOpenKeys=new Set(),testAiOpenKeys=new Set();
let performanceState=null,performanceFetchedAt=0,performanceBusy=false;

function setPage(name){
  const valid=['today','monitor','flow','ideas','test','performance'];if(!valid.includes(name))name='today';
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===`page-${name}`));
  document.querySelectorAll('.pageTab').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  try{localStorage.setItem('position-alert-page-v78',name)}catch{}
  if(name==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}
  else if(name==='flow')void refreshMarketFlow(false);
  else if(name==='ideas'){void refreshMarketFlow(false);void refreshRankedIdeas(false)}
  else if(name==='test')void refreshTestSignals(false);
  else if(name==='monitor')void refreshTestSignals(false);
  else if(name==='performance')void refreshPerformance(false)
}
function fmtVol(v){const x=Number(v||0);if(x>=1e9)return`${(x/1e9).toFixed(x>=10e9?1:2)}B`;if(x>=1e6)return`${(x/1e6).toFixed(1)}M`;return x.toLocaleString('en-US',{maximumFractionDigits:0})}
function signed(v,d=2){const x=Number(v||0);return`${x>0?'+':''}${x.toFixed(d)}%`}
function biasClassName(key){return({LONG:'long',LONG_WATCH:'longWatch',SHORT_WATCH:'shortWatch',SHORT:'short'})[key]||'watch'}
function todayBiasLabel(key,fallback=''){return({LONG:'偏多',LONG_WATCH:'偏多觀察',SHORT_WATCH:'偏空觀察',SHORT:'偏空'})[key]||fallback||'—'}
function renderBiasList(t,activeKey){
  const biases=Array.isArray(t?.biases)?t.biases:[],active=biases.find(x=>x.key===activeKey)||biases[0];
  if(!active){$('todayBiasList').innerHTML='<div class="loadingBox">—</div>';return}
  const cls=biasClassName(active.key),shown=active.items||[];
  const rows=shown.map((x,i)=>`<div class="biasRow ${cls}"><div class="biasRank">${i+1}</div><div class="biasNameCell">${tvAnchor(x.symbol,'tvNameLink biasName')}<div class="biasExtra">${fmtVol(x.quoteVolume)} · F ${signed(x.fundingPct,4)}</div></div><div class="biasMetrics"><span class="biasChange">${signed(x.changePct,2)}</span><span class="biasFlow">${x.flowScore>0?'+':''}${Number(x.flowScore||0).toFixed(1)}</span></div></div>`).join('')||'<div class="loadingBox">—</div>';
  $('todayBiasList').innerHTML=`<div class="biasListHead"><div class="biasListHeadMain"><span class="biasDot ${cls}"></span><div><div class="biasListTitle">${esc(todayBiasLabel(active.key,active.label))}</div><div class="biasListMeta">前 ${shown.length} / 共 ${Number(active.count||0)}</div></div></div></div><div class="biasListRows">${rows}</div>`;
}
function renderMatrix(t){
  const items=Array.isArray(t?.bubbleMap?.items)?t.bubbleMap.items:[],groups={LONG:[],SHORT_WATCH:[],LONG_WATCH:[],SHORT:[]};for(const x of items){if(groups[x.bias])groups[x.bias].push(x)}
  const order=[['LONG','偏多','流入＋漲'],['SHORT_WATCH','偏空觀察','流出＋漲'],['LONG_WATCH','偏多觀察','流入＋跌'],['SHORT','偏空','流出＋跌']];
  $('matrixChart').innerHTML=order.map(([key,label,sub])=>{const cls=biasClassName(key),coins=groups[key].slice(0,3).map(x=>`<a class="matrixCoin" href="${esc(tradingViewLink(x.symbol))}" target="_blank" rel="noopener noreferrer" data-tv-symbol="${esc(x.symbol)}"><b>${esc(x.symbol)}</b><span>${signed(x.changePct,1)}</span></a>`).join('');return `<div class="matrixCell ${cls}"><div class="matrixHead"><b>${label}</b><small>${sub}</small></div><div class="matrixCoins">${coins||'<div class="matrixEmpty">—</div>'}</div></div>`}).join('');
}
function renderToday(d){
  const t=d.today||{},biases=Array.isArray(t.biases)?t.biases:[];
  if(biases.length){if(!biases.some(x=>x.key===todayBiasKey))todayBiasKey=t.defaultBias||biases[0].key;$('todayBiases').innerHTML=biases.map(x=>{const cls=biasClassName(x.key),active=x.key===todayBiasKey,shortSub=({LONG:'流入＋漲',LONG_WATCH:'流入＋跌',SHORT_WATCH:'流出＋漲',SHORT:'流出＋跌'})[x.key]||'';return `<button type="button" class="biasCard ${cls} ${active?'active':''}" data-bias-key="${esc(x.key)}"><span class="label">${esc(todayBiasLabel(x.key,x.label))}</span><span class="count">${Number(x.count||0)}</span><span class="sub">${shortSub}</span></button>`}).join('');renderBiasList(t,todayBiasKey)}else{$('todayBiases').innerHTML='<div class="loadingBox">—</div>';$('todayBiasList').innerHTML='<div class="loadingBox">—</div>'}
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
function ideaBiasClass(v){return v==='偏多'?'long':v==='偏空'?'short':'neutral'}
function ideaStrengthClass(v){return ['強','偏強'].includes(v)?'strong':['弱','偏弱'].includes(v)?'weak':'neutral'}
function renderIdeaAnalysisBody(d, symbol){
  if(!d?.ok)return '<div class="ideaAnalysisLoading">網搜暫時不可用。</div>';
  const bullish=(d.bullish||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>未見明確額外利多</li>';
  const bearish=(d.bearish||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>未見明確額外利空</li>';
  const news=(d.news||[]).map(x=>`<div class="ideaNewsItem ${x.tone==='利多'?'bull':x.tone==='利空'?'bear':'neutral'}"><span>${esc(x.tone||'中性')}</span><b>${esc(x.text||'')}</b></div>`).join('')||'<div class="ideaNewsEmpty">未見可靠的重大即時催化。</div>';
  const conflicts=(d.conflicts||[]).map(x=>`<span class="crossWarn">${esc(x)}</span>`).join('')||'<span class="crossOk">未見重大交叉衝突</span>';
  const watch=(d.watch||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>依即時結構與進場區持續監控</li>';
  return `<div class="ideaAnalysisStatus"><div><span>今日偏向</span><b class="${ideaBiasClass(d.bias)}">${esc(d.bias||'中性')}</b></div><div><span>強弱</span><b class="${ideaStrengthClass(d.strength)}">${esc(d.strength||'中性')}</b></div><div><span>交叉一致性</span><b>${esc(d.agreement||'—')}</b></div><div><span>更新</span><b>${localTime(d.generatedAt)||'剛剛'}</b></div></div><div class="ideaAnalysisProfile"><b>${esc(d.profile?.sector||'其他 / 新興資產')}</b><span>${esc(d.profile?.purpose||'')}</span></div>${d.summary?`<div class="ideaAnalysisSummary">${esc(d.summary)}</div>`:''}<div class="ideaEntryTiming"><span>現在怎麼做</span><b>${esc(d.entryTiming||d.action||'等結構確認，不追價。')}</b></div><div class="ideaAnalysisCols"><div><h4>利多</h4><ul>${bullish}</ul></div><div><h4>利空</h4><ul>${bearish}</ul></div></div><div class="crossConflict"><h4>交叉衝突</h4><div>${conflicts}</div></div><div class="crossWatch"><h4>接下來看什麼</h4><ul>${watch}</ul></div><div class="ideaNews"><h4>今日消息</h4>${news}</div><div class="ideaTodayAction"><span>今天怎麼對待</span><b>${esc(d.action||'等結構確認，不追價。')}</b></div><div class="ideaAnalysisFoot">${d.mode==='AI_WEB'?(d.cached?`AI網搜快取 · 剩 ${cacheRemainText(d.cacheExpiresInMs)}`:'AI網搜已更新 · 接下來2小時用快取'):'Binance量化'} · 即時量化持續更新 · 不追高/不追殺</div>`;
}
async function loadIdeaAnalysis(details){
  if(!details||details.dataset.loaded==='1'||details.dataset.loading==='1')return;
  const symbol=details.dataset.ideaSymbol||'',direction=details.dataset.ideaDir||'',key=`${symbol}:${direction}`,body=details.querySelector('[data-idea-analysis-body]');
  const cached=ideaAnalysisCache.get(key);if(cached&&Date.now()-cached.at<2*60*60*1000){const age=Date.now()-cached.at;body.innerHTML=renderIdeaAnalysisBody({...cached.data,cached:true,cacheAgeMs:age,cacheExpiresInMs:Math.max(0,2*60*60*1000-age)},symbol);details.dataset.loaded='1';return}
  details.dataset.loading='1';if(body)body.innerHTML='<div class="ideaAnalysisLoading">正在搜尋最新消息與專案狀況…</div>';
  try{const d=await fetchIdeaAnalysisShared(symbol,direction);if(body)body.innerHTML=renderIdeaAnalysisBody(d,symbol);details.dataset.loaded='1'}catch(e){if(body)body.innerHTML='<div class="ideaAnalysisLoading">網搜暫時不可用；量化排名仍正常。</div>'}finally{details.dataset.loading='0'}
}
function bindIdeaDetails(){bindPersistentDetails($('recGrid'));document.querySelectorAll('details[data-idea-symbol]').forEach(d=>{if(d.dataset.ideaBound!=='1'){d.dataset.ideaBound='1';d.addEventListener('toggle',()=>{if(d.open)void loadIdeaAnalysis(d)})}if(d.open)void loadIdeaAnalysis(d)})}
function renderRankedIdeas(d){
  if(!d?.ok)return;rankedIdeasState=d;rankedIdeasFetchedAt=Date.now();
  const rows=d.rows||[];
  $('recGrid').innerHTML=rows.map((x,i)=>{const long=x.direction==='LONG',hit=Number.isFinite(Number(x.historicalHitRate))?`${Number(x.historicalHitRate).toFixed(1)}%`:'—',sample=Number(x.backtestSample||0),sector=x.profile?.sector||'其他 / 新興加密資產',purpose=x.profile?.purpose||'展開詳細可即時搜尋專案定位與今日催化';return `<article class="rankCard"><div class="rankHeadGrid"><div class="rankNo">${i+1}</div><div class="rankMain"><div class="rankTop">${tvAnchor(x.symbol,'tvNameLink rankSymbol')}<span class="recTag ${long?'long':'short'}">${long?'做多':'做空'}</span></div><div class="rankProfile"><span>${esc(sector)}</span><b>${esc(purpose)}</b></div></div><div class="rankWin"><b>${Number(x.estimatedWinRate||0).toFixed(1)}%</b><span>量化估算</span><small>${Number(x.rankScore||0).toFixed(0)}分</small></div></div><div class="rankReason">${esc(x.reason||'')}</div><div class="rankMini">模型 ${Number(x.modelScore||0)} · 歷史命中 ${hit} / ${sample} · OI ${signed(x.metrics?.oiChangePct||0,1)}</div><details class="ideaDetail" data-idea-symbol="${esc(x.symbol)}" data-idea-dir="${esc(x.direction)}" data-persist-detail="idea:${esc(x.symbol)}:${esc(x.direction)}" ${detailOpenAttr(`idea:${x.symbol}:${x.direction}`)}><summary><span>展開（詳細）</span><b>AI網搜 · 2小時快取</b></summary><div class="ideaDetailBody" data-idea-analysis-body><div class="ideaAnalysisLoading">點開後才做即時網搜，避免浪費 API。</div></div></details></article>`}).join('')||'<div class="loadingBox">目前沒有高一致性方向。</div>';
  bindIdeaDetails();$('ideaAge').textContent=d.stale?'快照':ageText(d.generatedAt);
}
async function refreshRankedIdeas(force=false){
  if(rankedIdeasBusy)return;if(!force&&rankedIdeasState&&Date.now()-rankedIdeasFetchedAt<60_000){renderRankedIdeas(rankedIdeasState);return}
  rankedIdeasBusy=true;try{const r=await fetch('/api/ranked-ideas',{cache:'no-store'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderRankedIdeas(d)}catch(e){if(rankedIdeasState)renderRankedIdeas({...rankedIdeasState,stale:true});else $('recGrid').innerHTML='<div class="loadingBox">量化排名暫時不可用。</div>'}finally{rankedIdeasBusy=false}
}

function testSignedPct(v,d=2){if(!hasNum(v))return'—';const x=Number(v);return`${x>0?'+':''}${x.toFixed(d)}%`}
function testStatusClass(status){return({CONFIRMED:'confirmed',WIN:'win',LOSS:'loss',INVALID:'invalid',DROPPED:'invalid',TOUCHING:'touching'})[status]||''}
function testTrendClass(x){return x?.monitorClass||({STRONG:'strong',CONTINUING:'continuing',WEAKENING:'weakening',RECOVERING:'recovering'})[x?.monitorState]||'watching'}
function testTrendTag(x){const label=x?.monitorLabel||'';return label?`<span class="testTrendTag ${testTrendClass(x)}">${esc(label)}</span>`:''}
function testZoneText(setup){return setup&&hasNum(setup.zoneLow)&&hasNum(setup.zoneHigh)?`${price(setup.zoneLow)}～${price(setup.zoneHigh)}`:'建立中'}
function testReasonChips(x){const reasons=x?.lastCheck?.reasons||[];if(reasons.length)return reasons.map(r=>`<span class="testReason">${esc(r)}</span>`).join('');const r=String(x?.idea?.reason||'').split(' · ').filter(Boolean).slice(0,4);return r.map(y=>`<span class="testReason">${esc(y)}</span>`).join('')}
function testEffectiveWinRate(x){
  if(hasNum(x?.calibratedWinRate))return Number(x.calibratedWinRate);
  if(hasNum(x?.confirmedWinRate))return Number(x.confirmedWinRate);
  const bt=x?.setup?.backtest||{};
  if(hasNum(bt.smoothedHitRate))return Number(bt.smoothedHitRate);
  if(hasNum(bt.hitRate))return Number(bt.hitRate);
  if(hasNum(x?.idea?.estimatedWinRate))return Number(x.idea.estimatedWinRate);
  return -1;
}
function testEventTime(x){return localTime(x?.eventAt||x?.finishedAt||x?.updatedAt)||'—'}
function testSignalTime(x){return localTime(x?.confirmedAt||x?.notificationSentAt||x?.firstSeenAt)||'—'}
function testStateTime(x){return localTime(x?.stateChangedAt||x?.eventAt||x?.updatedAt)||'—'}
function testLastEvalTime(x){return localTime(x?.lastEvaluatedAt)||'—'}
function testPriceTime(x){return localTime(x?.priceUpdatedAt)||'—'}
function testFreshnessState(x){
  const v=String(x?.freshness?.state||'').toUpperCase();if(v)return v;
  const at=x?.lastEvaluatedAt?new Date(x.lastEvaluatedAt).getTime():0,age=at?Date.now()-at:Infinity;
  return age<=90_000?'LIVE':age<=180_000?'DELAYED':'STALE';
}
function testIsStale(x){return testFreshnessState(x)==='STALE'}
function testFreshnessTag(x){const st=testFreshnessState(x);return st==='LIVE'?'<span class="testFreshTag live">已更新</span>':st==='DELAYED'?'<span class="testFreshTag delayed">延遲</span>':'<span class="testFreshTag stale">過期</span>'}
function testWinDeltaText(x){if(!hasNum(x?.currentWinRate)||!hasNum(x?.confirmedWinRate))return'';const d=Number(x.currentWinRate)-Number(x.confirmedWinRate);if(Math.abs(d)<.1)return'0.0';return `${d>0?'↑':'↓'}${Math.abs(d).toFixed(1)}`}
function testInvalidWindowText(x){
  if(x?.status!=='INVALID'||!x?.reactivateUntil)return'';
  const ms=new Date(x.reactivateUntil).getTime()-Date.now();
  if(!(ms>0))return'收復窗即將結束';
  return `收復窗 ${Math.max(1,Math.ceil(ms/60000))}分`;
}
function testInvalidReasonText(x){
  if(x?.invalidReason==='MODEL_RISK')return'模型風險位觸及';
  if(x?.invalidReason==='STRUCTURE')return'保護結構失守';
  return x?.status==='INVALID'?'訊號暫時失效':'';
}
function testTierLabel(x){return({HIGH:'高勝率',NORMAL:'普通',VALID:'有效',BLOCKED:'暫停'})[String(x?.notificationTier||'VALID').toUpperCase()]||'有效'}
function testTierClass(x){return String(x?.notificationTier||'VALID').toLowerCase()}
function testNotifyGateText(x){const tier=String(x?.notificationTier||'VALID').toUpperCase(),g=x?.notificationGate||{};if(tier==='HIGH')return'高勝率通知條件通過';if(tier==='NORMAL')return'普通通知條件通過';if(tier==='BLOCKED')return`暫停：${(g.blockers||[]).slice(0,3).join('、')||'風險條件未通過'}`;return`未達普通：${(g.normalMissing||[]).slice(0,3).join('、')||'等待更多同向條件'}`}
function cacheRemainText(ms){const n=Number(ms);if(!Number.isFinite(n)||n<=0)return'即將更新';const m=Math.ceil(n/60000);if(m>=60)return`${Math.floor(m/60)}小時${m%60?`${m%60}分`:''}`;return`${m}分`}
function testIsReachedWaiting(x){return !!x?.targetReachedAt&&!['TOUCHING','READY'].includes(String(x?.reentryStage||''))}
function testIsReentryReady(x){return ['TOUCHING','READY'].includes(String(x?.reentryStage||''))}
function testSignalByKey(key){return (testSignalsState?.rows||[]).find(x=>x.key===key)||null}
function testPreferredZone(x){
  const z=x?.preferredEntryZone||x?.entryZone;
  if(z&&hasNum(z.low)&&hasNum(z.high))return {low:Math.min(Number(z.low),Number(z.high)),high:Math.max(Number(z.low),Number(z.high))};
  if(x?.setup&&hasNum(x.setup.zoneLow)&&hasNum(x.setup.zoneHigh)){const lo=Math.min(Number(x.setup.zoneLow),Number(x.setup.zoneHigh)),hi=Math.max(Number(x.setup.zoneLow),Number(x.setup.zoneHigh)),w=hi-lo;return {low:lo+w*.23,high:hi-w*.23}}
  return null;
}
function testFullEntryZone(x){
  const z=x?.entryZone;if(z&&hasNum(z.low)&&hasNum(z.high))return {low:Math.min(Number(z.low),Number(z.high)),high:Math.max(Number(z.low),Number(z.high))};
  if(x?.setup&&hasNum(x.setup.zoneLow)&&hasNum(x.setup.zoneHigh))return {low:Math.min(Number(x.setup.zoneLow),Number(x.setup.zoneHigh)),high:Math.max(Number(x.setup.zoneLow),Number(x.setup.zoneHigh))};
  return null;
}
function testStructureStop(x){if(testIsReentryReady(x)&&hasNum(x.reentryStop))return Number(x.reentryStop);if(hasNum(x.structureProtection))return Number(x.structureProtection);if(hasNum(x.stop))return Number(x.stop);if(x?.setup&&hasNum(x.setup.invalidation))return Number(x.setup.invalidation);return null}
function testNotifyPoint(x){return Number(testIsReentryReady(x)?x.reentryEntryPrice:x.confirmationPrice)||null}
function testSuggestedPoint(x){const z=testPreferredZone(x);return z?(z.low+z.high)/2:null}
function testEntryPlanMarkup(x){
  const saved=loadTestEntryPlans()[x.key]||{},zone=testPreferredZone(x),zoneText=zone?`${price(zone.low)}～${price(zone.high)}`:'等待模型區間';
  const v=k=>saved[k]??'';
  return `<div class="testEntryPlanner" data-test-planner="${esc(x.key)}"><div class="testPlannerHead"><div><b>進場參考</b><span>同一套回踩/不追價邏輯，輸入部位後即時計算</span></div><span class="plannerTier ${testTierClass(x)}">${esc(testTierLabel(x))}</span></div><div class="testPlannerGrid"><div class="planEntryField"><label><span>預計進場</span><input data-plan-field="entry" inputmode="decimal" type="number" step="any" value="${esc(v('entry'))}" placeholder="${zone?price((zone.low+zone.high)/2):'點位'}"></label><div class="planEntryButtons"><button type="button" data-plan-use="suggested">建議價</button><button type="button" data-plan-use="notify">通知價</button><button type="button" data-plan-use="current">當下價</button></div></div><label><span>保證金 U</span><input data-plan-field="margin" inputmode="decimal" type="number" min="0" step="1" value="${esc(v('margin'))}" placeholder="300"></label><label><span>槓桿</span><input data-plan-field="lev" inputmode="numeric" type="number" min="1" max="125" step="1" value="${esc(v('lev'))}" placeholder="20"></label><label><span>想盈利 U</span><input data-plan-field="profit" inputmode="decimal" type="number" min="0" step="1" value="${esc(v('profit'))}" placeholder="100"></label><label><span>可虧損 U</span><input data-plan-field="loss" inputmode="decimal" type="number" min="0" step="1" value="${esc(v('loss'))}" placeholder="空白＝盈利÷2"></label></div><div class="testPlannerPointRow"><div><span>通知點位</span><b>${hasNum(testNotifyPoint(x))?price(testNotifyPoint(x)):'—'}</b></div><div><span>當下點位</span><b>${hasNum(x.currentPrice)?price(x.currentPrice):'—'}</b></div><div><span>建議進場</span><b>${hasNum(testSuggestedPoint(x))?price(testSuggestedPoint(x)):'—'}</b></div></div><div class="testPlannerOut"><div><span>較佳進場區</span><b data-plan-zone>${zoneText}</b></div><div><span>數量</span><b data-plan-qty>—</b></div><div><span>TP 參考</span><b data-plan-tp>—</b></div><div><span>結構 SL</span><b data-plan-sl>—</b></div><div><span>RR</span><b data-plan-rr>—</b></div><div><span>結構風險</span><b data-plan-risk>—</b></div></div><div class="testPlannerAdvice"><span>建議</span><b data-plan-advice>輸入預計進場、保證金與槓桿後計算。</b></div></div>`;
}
function updateTestPlanner(box){
  if(!box)return;const x=testSignalByKey(box.dataset.testPlanner);if(!x)return;
  const get=k=>box.querySelector(`[data-plan-field="${k}"]`),num=k=>{const v=Number(get(k)?.value);return Number.isFinite(v)&&v>0?v:null};
  const zone=testPreferredZone(x),full=testFullEntryZone(x),dir=x.direction==='SHORT'?-1:1,entryInput=num('entry'),entry=entryInput||(zone?(zone.low+zone.high)/2:null),margin=num('margin'),lev=num('lev'),profitInput=num('profit'),lossInput=num('loss');
  const profit=profitInput||(lossInput?lossInput*2:null),loss=lossInput||(profitInput?profitInput/2:null),qty=entry&&margin&&lev?margin*lev/entry:null,stop=testStructureStop(x);
  const set=(sel,text)=>{const el=box.querySelector(sel);if(el)el.textContent=text};
  set('[data-plan-zone]',zone?`${price(zone.low)}～${price(zone.high)}`:'等待模型區間');
  const qtyText=qty?Number(qty).toLocaleString('en-US',{maximumFractionDigits:6}):'—';set('[data-plan-qty]',qtyText);
  let tp=null,budgetSl=null,structRisk=null,rr=null;
  if(qty&&profit)tp=entry+dir*(profit/qty);
  if(qty&&loss)budgetSl=entry-dir*(loss/qty);
  if(qty&&Number.isFinite(stop))structRisk=Math.abs(entry-stop)*qty;
  if(profit&&structRisk>0)rr=profit/structRisk;
  set('[data-plan-tp]',tp?price(tp):'—');set('[data-plan-sl]',Number.isFinite(stop)?price(stop):(budgetSl?price(budgetSl):'—'));set('[data-plan-rr]',rr?rr.toFixed(2):'—');set('[data-plan-risk]',structRisk?`${structRisk.toFixed(structRisk>=100?0:1)} U`:'—');
  const plan={entry:get('entry')?.value||'',margin:get('margin')?.value||'',lev:get('lev')?.value||'',profit:get('profit')?.value||'',loss:get('loss')?.value||''};saveTestEntryPlan(x.key,plan);
  let advice='等待完整訊號資料。';const state=String(x.monitorState||''),reStage=String(x.reentryStage||''),tier=String(x.notificationTier||'VALID');
  if(testIsStale(x))advice='判讀資料已超過 3 分鐘未更新，暫停進場；等資料恢復即時後再判斷。';
  else if(x.status==='INVALID'||x.status==='DROPPED'||state==='WEAKENING')advice='目前轉弱／失效，暫停進場；等系統重新收復後再看。';
  else if(testIsReachedWaiting(x))advice='已達標，現在不追價；等二次回踩區形成後，符合條件會重新跳回監控並通知。';
  else if(reStage==='TOUCHING')advice='二次回踩正在發生，先等已收 5 分 K 重新站回，再考慮進場。';
  else if(entryInput&&zone){
    const chase=dir>0?entryInput>zone.high:entryInput<zone.low,tooDeep=full?(dir>0?entryInput<full.low:entryInput>full.high):false;
    if(chase)advice=`你的預計進場 ${price(entryInput)} 已超過較佳區，屬追價；等 ${price(zone.low)}～${price(zone.high)} 回踩，不追突破K。`;
    else if(tooDeep)advice='你的預計價已超過完整回踩區，代表結構可能正在變差；不要為了便宜硬接，等重新確認。';
    else if(structRisk&&loss&&structRisk>loss*1.10)advice=`點位在可接受區，但目前部位的結構停損約 ${structRisk.toFixed(structRisk>=100?0:1)}U，高於你設定 ${loss.toFixed(0)}U；降低保證金／槓桿或等更佳進場。`;
    else if(tier==='HIGH')advice='高勝率條件目前通過；只在較佳區內等 5 分 K 收回後分批，不追價。';
    else if(tier==='NORMAL')advice='普通勝率條件完整，未見明顯衰弱；仍只做回踩確認，不追價。';
    else advice='訊號有效但優勢未達高／普通級；若要做，只接受區間內回踩確認。';
  }else if(zone)advice=`目前較佳進場區 ${price(zone.low)}～${price(zone.high)}；輸入你的預計點位即可判斷是否追價。`;
  if(qty&&profit&&tp)advice+=` 以目前部位，+${profit.toFixed(0)}U 約對應 TP ${price(tp)}。`;
  set('[data-plan-advice]',advice);
}
function bindTestPlanners(root=document){root.querySelectorAll?.('[data-test-planner]').forEach(box=>{updateTestPlanner(box);box.querySelectorAll('[data-plan-field]').forEach(inp=>inp.addEventListener('input',()=>updateTestPlanner(box)));box.querySelectorAll('[data-plan-use]').forEach(btn=>btn.addEventListener('click',()=>{const x=testSignalByKey(box.dataset.testPlanner),inp=box.querySelector('[data-plan-field="entry"]');if(!x||!inp)return;const kind=btn.dataset.planUse;let v=null;if(kind==='current')v=Number(x.currentPrice);else if(kind==='notify')v=testNotifyPoint(x);else v=testSuggestedPoint(x);if(Number.isFinite(v)&&v>0){inp.value=v;updateTestPlanner(box)}}))})}

function testMonitorCandidates(){
  if(!testSignalsState)return[];
  const rows=testSignalsState.rows||[],picked=new Map();
  rows.forEach(x=>{if(x.notificationSentAt&&['CONFIRMED','WIN','LOSS','TIMEOUT','INVALID'].includes(x.status)&&!testIsReachedWaiting(x)&&!isTestJudgementDismissed(x))picked.set(x.key,x)});
  if(testFocusSymbol){const x=rows.find(r=>r.symbol===testFocusSymbol&&(!testFocusDirection||r.direction===testFocusDirection))||rows.find(r=>r.symbol===testFocusSymbol);if(x&&!testIsReachedWaiting(x)){clearTestJudgementDismiss(x.key);picked.set(x.key,x)}}
  return [...picked.values()].sort((a,b)=>{const fa=testFreshnessState(a)==='STALE'?1:0,fb=testFreshnessState(b)==='STALE'?1:0;if(fa!==fb)return fa-fb;return Number(b.priorityScore||0)-Number(a.priorityScore||0)||testEffectiveWinRate(b)-testEffectiveWinRate(a)||(a.rank||99)-(b.rank||99)});
}
function testReachedCandidates(){
  if(!testSignalsState)return[];
  return (testSignalsState.rows||[]).filter(x=>x.targetReachedAt&&testIsReachedWaiting(x)).sort((a,b)=>new Date(b.targetReachedAt||0)-new Date(a.targetReachedAt||0));
}
function testTrendWord(v){return Number(v)>0?'偏多':Number(v)<0?'偏空':'中性'}
function testBoolWord(v,good='支持',bad='不支持'){return v===true?good:v===false?bad:'—'}
function renderTestCrossDetail(x){
  const bt=x.setup?.backtest||{},lc=x.lastCheck||{},ev=x.monitorEvidence||{},dh=x.dataHealth||{},src=dh.sources||{},sd=dh.details||{},long=x.direction==='LONG',win=testEffectiveWinRate(x),confirmed=hasNum(x.confirmedWinRate)?Number(x.confirmedWinRate):null,cross=dh.crossExchange||lc.crossExchange||{};
  const srcLabel=(key,label)=>{const ok=src[key]===true,d=sd[key]||{},source=String(d.source||'').trim(),error=String(d.error||'').trim(),fallback=d.fallback===true||source.includes('備援'),unsupported=/UNSUPPORTED|not exist|not found|invalid symbol/i.test(error),missing=String(d.status||'').toUpperCase()==='MISSING'||/缺值/i.test(error);let suffix='';if(key==='backtest'&&ok)suffix=` ${Number(d.sample??dh.backtestSample??bt.sample??0)}筆${Number(d.sample??dh.backtestSample??bt.sample??0)<20?' / 偏少':''}`;else if(ok&&source)suffix=` · ${esc(source)}${fallback&&!source.includes('備援')?' 備援':''}`;const status=ok?'✓':unsupported?'該來源無此資料':missing?'缺值':'抓取失敗',title=error?` title="${esc(error)}"`:'';return `<span class="sourceChip ${ok?'ok':'miss'}"${title}>${esc(label)} ${status}${suffix}</span>`};
  const confidence=hasNum(dh.confidencePct)?Number(dh.confidencePct).toFixed(0)+'%':'—';
  const sourceHealth=`<div class="testSourceHealth"><div class="sourceHealthHead"><b>資料完整度 ${hasNum(dh.coveragePct)?Number(dh.coveragePct).toFixed(0)+'%':'—'} · 可信度 ${confidence}</b><span>有值才算完整；備援來源與小樣本會另外降低可信度</span></div><div class="sourceChips">${srcLabel('k5','5分K')}${srcLabel('k15','15分K')}${srcLabel('k30','30分K')}${srcLabel('h1','1小時K')}${srcLabel('oi15','OI 15分')}${srcLabel('oi1h','OI 1小時')}${srcLabel('taker','主動買賣')}${srcLabel('topPos','大戶持倉')}${srcLabel('topAccount','大戶帳戶')}${srcLabel('globalLs','全市場多空')}${srcLabel('depth','20檔委託簿')}${srcLabel('funding','Funding')}${srcLabel('basis','Basis')}${srcLabel('adl','ADL Risk')}${srcLabel('mark','Mark Price')}${srcLabel('market','BTC/ETH大盤')}${srcLabel('backtest','回測')}</div><small>主資料以 Binance 為準；抓不到時才用 Binance 成交資料、Bybit 或 OKX 明確標示備援。ADL Risk 仍以 Binance 公開端點為準。</small></div>`;
  const zone=x.preferredEntryZone?`${price(x.preferredEntryZone.low)}～${price(x.preferredEntryZone.high)}`:testZoneText(x.setup),protect=hasNum(x.structureProtection)?price(x.structureProtection):hasNum(x.stop)?price(x.stop):x.setup?price(x.setup.invalidation):'—';
  const top=hasNum(lc.topPositionRatio)?Number(lc.topPositionRatio).toFixed(2):hasNum(ev.topPositionRatio)?Number(ev.topPositionRatio).toFixed(2):null,topAccount=hasNum(lc.topAccountRatio)?Number(lc.topAccountRatio).toFixed(2):null,globalLs=hasNum(lc.globalLongShortRatio)?Number(lc.globalLongShortRatio).toFixed(2):null;
  const depth=hasNum(lc.depthImbalance)?`${Number(lc.depthImbalance)>0?'+':''}${(Number(lc.depthImbalance)*100).toFixed(1)}%`:null,fund=hasNum(lc.fundingPct)?`${Number(lc.fundingPct).toFixed(4)}%`:null;
  const freshnessState=testFreshnessState(x),freshAge=hasNum(x?.freshness?.ageMs)?Math.round(Number(x.freshness.ageMs)/1000):null;const state=freshnessState==='STALE'?`判讀過期${freshAge!=null?` ${freshAge}秒`:''}`:freshnessState==='DELAYED'?`判讀延遲${freshAge!=null?` ${freshAge}秒`:''}`:(x.monitorLabel||x.statusLabel||'等待');
  const risks=[];if(ev.adverse15)risks.push('15分逆向');if(ev.adverse30)risks.push('30分逆向');if(ev.adverse1h)risks.push('1小時逆向');if(lc.fundingCrowded)risks.push('Funding擁擠');if(String(lc.adlRisk||'').toLowerCase()==='high')risks.push('ADL高風險');if(hasNum(lc.spreadBps)&&Number(lc.spreadBps)>8)risks.push('價差偏大');if(hasNum(lc.chaseAtr)&&Number(lc.chaseAtr)>.35)risks.push('距離過遠/追價');if(Number(lc.crossAlign)<0)risks.push('Bybit/OKX跨所逆向');
  const supports=[];if(lc.reclaim)supports.push('回踩收回');if(lc.sweep)supports.push('掃流動性後收回');if(lc.wicker)supports.push('拒絕影線');if(lc.momentum)supports.push('短線動能同向');if(lc.macdImprove)supports.push('MACD改善');if(Number(lc.marketAlign)>0)supports.push('BTC/ETH同向');if(hasNum(lc.takerRatio)&&((long&&Number(lc.takerRatio)>=1)||(!long&&Number(lc.takerRatio)<=1)))supports.push('主動買賣未逆向');if(Number(lc.crossAlign)>0)supports.push('Bybit/OKX跨所同向');
  const by=cross?.bybit||{},okx=cross?.okx||{},crossWord=Number(cross?.consensus)>0?'偏多':Number(cross?.consensus)<0?'偏空':(cross?.available>0?'分歧/中性':'無資料');
  const crossErrText=v=>/UNSUPPORTED|not exist|not found|invalid symbol/i.test(String(v?.error||''))?'該所無此合約':'抓取失敗';
  const byDetail=by.ok?`${testTrendWord(by.trend)}${hasNum(by.oiChangePct)?` · OI ${testSignedPct(by.oiChangePct,1)}`:''}${hasNum(by.longShortRatio)?` · L/S ${Number(by.longShortRatio).toFixed(2)}`:''}`:crossErrText(by);
  const okxDetail=okx.ok?`${testTrendWord(okx.trend)}${hasNum(okx.depthImbalance)?` · 深度 ${(Number(okx.depthImbalance)*100).toFixed(1)}%`:''}`:crossErrText(okx);
  const topText=top?`${top}${topAccount?` · 帳戶 ${topAccount}`:''}`:topAccount?`持倉量抓取失敗 · 帳戶 ${topAccount}`:'無資料';
  const mfe=hasNum(x.mfePct)?testSignedPct(x.mfePct,2):(hasNum(x.confirmationPrice)?'等待樣本':'未確認進場'),mae=hasNum(x.maePct)?testSignedPct(x.maePct,2):(hasNum(x.confirmationPrice)?'等待樣本':'未確認進場');
  return `${sourceHealth}<div class="testCrossIntro"><div><span>目前狀態</span><b>${esc(state)}</b></div><div><span>當日排名</span><b>${x.rank?`#${x.rank}`:'—'} · 熱度 ${hasNum(x.rankHeat)?Number(x.rankHeat).toFixed(0):'—'}</b></div><div><span>校準勝率</span><b>${win>=0?win.toFixed(1)+'%':'—'}${confirmed!=null&&win>=0?` · ${win-confirmed>=0?'+':''}${(win-confirmed).toFixed(1)}`:''}</b></div><div><span>進場策略</span><b>${esc(x.entryStrategy||'等回踩確認，不追價')}</b></div></div>
  <div class="testCrossSection"><h4>多週期結構 / 動能</h4><div class="testCrossGrid"><div><span>5分 RSI / ADX</span><b>${src.k5&&hasNum(lc.rsi5)?Number(lc.rsi5).toFixed(1):'無資料'} / ${src.k5&&hasNum(lc.adx5)?Number(lc.adx5).toFixed(1):'無資料'}</b></div><div><span>15分 RSI / ADX</span><b>${src.k15&&hasNum(lc.rsi15)?Number(lc.rsi15).toFixed(1):'無資料'} / ${src.k15&&hasNum(lc.adx15)?Number(lc.adx15).toFixed(1):hasNum(x.setup?.adx15)?Number(x.setup.adx15).toFixed(1):'無資料'}</b></div><div><span>30分方向</span><b>${src.k30?testTrendWord(lc.t30Trend):'無資料'}</b></div><div><span>1小時方向</span><b>${src.h1?testTrendWord(lc.h1Trend):'無資料'}</b></div><div><span>5分 / 15分量比</span><b>${src.k5&&hasNum(lc.volumeRatio)?Number(lc.volumeRatio).toFixed(2):'無資料'} / ${src.k15&&hasNum(lc.volumeRatio15)?Number(lc.volumeRatio15).toFixed(2):'無資料'}</b></div><div><span>MACD改善 / 15分柱</span><b>${testBoolWord(lc.macdImprove)} / ${src.k15&&hasNum(lc.macd15)?Number(lc.macd15).toPrecision(3):'無資料'}</b></div></div></div>
  <div class="testCrossSection"><h4>資金 / 衍生品</h4><div class="testCrossGrid"><div><span>OI 15分 / 1小時</span><b>${src.oi&&hasNum(lc.oi15mChangePct??lc.oiChangePct)?testSignedPct(lc.oi15mChangePct??lc.oiChangePct,1):'無資料'} / ${src.oi&&hasNum(lc.oi1hChangePct)?testSignedPct(lc.oi1hChangePct,1):'—'}</b></div><div><span>主動買賣比</span><b>${src.taker&&hasNum(lc.takerRatio)?Number(lc.takerRatio).toFixed(2):'無資料'}</b></div><div><span>大戶持倉 / 帳戶比</span><b>${esc(topText)}</b></div><div><span>全市場多空比</span><b>${src.globalLs&&globalLs?globalLs:'無資料'}</b></div><div><span>Funding / Basis</span><b>${src.funding&&fund?fund:'無資料'} / ${src.basis&&hasNum(lc.basisPct)?testSignedPct(lc.basisPct,3):'無資料'}</b></div><div><span>ADL Risk</span><b>${src.adl&&lc.adlRisk&&lc.adlRisk!=='unknown'?esc(String(lc.adlRisk).toUpperCase()):'無資料'}</b></div></div></div>
  <div class="testCrossSection"><h4>跨交易所交叉驗證</h4><div class="testCrossGrid"><div><span>Bybit 15分 / 資金</span><b>${esc(byDetail)}</b></div><div><span>OKX 15分 / 深度</span><b>${esc(okxDetail)}</b></div><div><span>跨所共識</span><b>${esc(crossWord)}</b></div><div><span>可用交易所</span><b>${Number(cross?.available||0)} / ${Number(cross?.total||2)}</b></div></div></div>
  <div class="testCrossSection"><h4>委託簿 / 進場品質</h4><div class="testCrossGrid"><div><span>20檔深度失衡</span><b>${src.depth&&depth?depth:'無資料'}</b></div><div><span>價差</span><b>${src.depth&&hasNum(lc.spreadBps)?Number(lc.spreadBps).toFixed(2)+' bps':'無資料'}</b></div><div><span>追價距離</span><b>${hasNum(lc.chaseAtr)?Number(lc.chaseAtr).toFixed(2)+' ATR':'等待進場區'}</b></div><div><span>BTC/ETH對齊</span><b>${src.market?(Number(lc.marketAlign)>0?'同向':Number(lc.marketAlign)<0?'逆向':'中性'):'無資料'}</b></div><div class="wide"><span>較佳進場區</span><b>${esc(zone)}</b></div><div><span>保護 / 失效</span><b>${protect}</b></div></div></div>
  <div class="testCrossSection"><h4>歷史 / 實測</h4><div class="testCrossGrid"><div><span>歷史1R</span><b>${hasNum(bt.hitRate)?Number(bt.hitRate).toFixed(1)+'%':'無資料'}</b></div><div><span>回測樣本</span><b>${Number(bt.sample||0)}${Number(bt.sample||0)>0&&Number(bt.sample||0)<20?' · 偏少':''}</b></div><div><span>獲利因子</span><b>${hasNum(bt.profitFactor)?Number(bt.profitFactor).toFixed(2):'無資料'}</b></div><div><span>平均90分報酬</span><b>${hasNum(bt.avgReturnPct)?testSignedPct(bt.avgReturnPct,2):'無資料'}</b></div><div><span>MFE</span><b>${esc(mfe)}</b></div><div><span>MAE</span><b>${esc(mae)}</b></div></div></div>
  <div class="testCrossSignals"><div><h4>目前支持</h4><div>${supports.length?supports.map(v=>`<span class="crossOk">${esc(v)}</span>`).join(''):'<span class="crossMuted">等待更多同向證據</span>'}</div></div><div><h4>目前風險</h4><div>${risks.length?risks.map(v=>`<span class="crossWarn">${esc(v)}</span>`).join(''):'<span class="crossOk">未見重大結構風險</span>'}</div></div></div>`;
}
async function loadTestAiAnalysis(details){
  if(!details||details.dataset.webLoaded==='1'||details.dataset.webLoading==='1')return;const symbol=details.dataset.testAiSymbol||'',direction=details.dataset.testAiDir||'',body=details.querySelector('[data-test-web-analysis-body]');if(!body)return;
  const key=`${symbol}:${direction}`,cached=ideaAnalysisCache.get(key);if(cached&&Date.now()-cached.at<2*60*60*1000){const age=Date.now()-cached.at;body.innerHTML=renderIdeaAnalysisBody({...cached.data,cached:true,cacheAgeMs:age,cacheExpiresInMs:Math.max(0,2*60*60*1000-age)},symbol);details.dataset.webLoaded='1';return}
  details.dataset.webLoading='1';body.innerHTML='<div class="ideaAnalysisLoading">AI 正在搜尋最新消息並與免費量化資料交叉比對…</div>';
  try{const d=await fetchIdeaAnalysisShared(symbol,direction);body.innerHTML=renderIdeaAnalysisBody(d,symbol);details.dataset.webLoaded='1'}catch(e){body.innerHTML='<div class="ideaAnalysisLoading">AI 網搜暫時不可用；免費完整交叉比對仍正常。</div>'}finally{details.dataset.webLoading='0'}
}
function bindTestDeepDetails(){const root=$('testGrid');if(!root)return;bindPersistentDetails(root);root.querySelectorAll('details[data-test-ai-web]').forEach(d=>{if(d.dataset.aiBound!=='1'){d.dataset.aiBound='1';d.addEventListener('toggle',()=>{const key=d.dataset.testAiKey||'';if(d.open){testAiOpenKeys.add(key);void loadTestAiAnalysis(d)}else testAiOpenKeys.delete(key)})}if(d.open)void loadTestAiAnalysis(d)})}
function setAllTestJudgements(open){
  const panel=$('testFocusPanel');if(!panel)return;
  panel.querySelectorAll('details[data-test-judge]').forEach(d=>{d.open=open;const key=d.dataset.testJudge||'';if(open)testMonitorOpenKeys.add(key);else testMonitorOpenKeys.delete(key);for(const nested of d.querySelectorAll('details[data-persist-detail]')){nested.open=open;setDetailOpen(nested.dataset.persistDetail,open)}});
  const pools=panel.querySelectorAll('details.moreMonitorPool,details.reachedPool');pools.forEach(d=>{d.open=open;if(d.dataset.persistDetail)setDetailOpen(d.dataset.persistDetail,open)});
}
function bindTestJudgementDetails(){
  const panel=$('testFocusPanel');if(!panel)return;
  panel.querySelectorAll('details[data-test-judge]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)testMonitorOpenKeys.add(d.dataset.testJudge);else testMonitorOpenKeys.delete(d.dataset.testJudge)}));bindPersistentDetails(panel);bindTestPlanners(panel);
}
function renderMonitorJudgeCard(x,i,focusKey,reLiveText){
  const bt=x.setup?.backtest||{},stale=testIsStale(x),win=testEffectiveWinRate(x),winText=stale?'—':win>=0?`${win.toFixed(1)}%`:'—',hist=hasNum(bt.hitRate)?`${Number(bt.hitRate).toFixed(1)}%`:'—',avg=testSignedPct(bt.avgReturnPct,2),pf=hasNum(bt.profitFactor)?Number(bt.profitFactor).toFixed(2):'—',q=Math.max(0,Math.min(100,Number(x.qualityScore||x.setup?.setupScore||0))),isFocus=x.key===focusKey,long=x.direction==='LONG',open=testMonitorOpenKeys.has(x.key),confidence=x.winRateMeta?.confidence||'—';
  const signalTime=testSignalTime(x),stateTime=testStateTime(x),evalTime=testLastEvalTime(x),priceTime=testPriceTime(x),freshTag=testFreshnessTag(x),delta=testWinDeltaText(x),confirmedRate=hasNum(x.confirmedWinRate)?`${Number(x.confirmedWinRate).toFixed(1)}%`:'—';
  const dynamic=hasNum(x.monitorScore)?Number(x.monitorScore).toFixed(0):q,protect=hasNum(x.structureProtection)?price(x.structureProtection):(hasNum(x.stop)?price(x.stop):'—'),breakout=hasNum(x.breakoutLevel)?price(x.breakoutLevel):'—',topRatio=hasNum(x.monitorEvidence?.topPositionRatio)?Number(x.monitorEvidence.topPositionRatio).toFixed(2):'—',depth=hasNum(x.monitorEvidence?.depthImbalance)?`${Number(x.monitorEvidence.depthImbalance)>0?'+':''}${(Number(x.monitorEvidence.depthImbalance)*100).toFixed(1)}%`:'—',h1=x.monitorEvidence?.adverse1h?'逆向':'正常',ciLow=hasNum(x.winRateMeta?.conservativeLow)?`${Number(x.winRateMeta.conservativeLow).toFixed(1)}%`:'—',ciHigh=hasNum(x.winRateMeta?.confidenceHigh)?`${Number(x.winRateMeta.confidenceHigh).toFixed(1)}%`:'—',invalidWindow=testInvalidWindowText(x),invalidReason=testInvalidReasonText(x);
  const rankNow=Number(x.rank||0),priority=hasNum(x.priorityScore)?Number(x.priorityScore).toFixed(0):'—',heat=hasNum(x.rankHeat)?Number(x.rankHeat).toFixed(0):'—';
  const reZone=hasNum(x.reentryZoneLow)&&hasNum(x.reentryZoneHigh)?`${price(x.reentryZoneLow)}～${price(x.reentryZoneHigh)}`:'—',reScore=hasNum(x.reentryScore)?Number(x.reentryScore).toFixed(0):'—',reEntry=hasNum(x.reentryEntryPrice)?price(x.reentryEntryPrice):'—',reStop=hasNum(x.reentryStop)?price(x.reentryStop):'—',reTarget=hasNum(x.reentryTarget1R)?price(x.reentryTarget1R):'—';
  const reMeta=(x.reentryReasons||[]).length?`二進：${(x.reentryReasons||[]).map(esc).join('、')}`:'',adl=String(x.monitorEvidence?.adlRisk||x.lastCheck?.adlRisk||'—').toUpperCase(),fund=hasNum(x.monitorEvidence?.fundingPct)?`${Number(x.monitorEvidence.fundingPct).toFixed(4)}%`:hasNum(x.lastCheck?.fundingPct)?`${Number(x.lastCheck.fundingPct).toFixed(4)}%`:'—';
  const strategy=stale?'資料過期，暫停採用這筆進場判讀':esc(x.entryStrategy||'回踩區內等確認，不追價');
  const preferred=x.preferredEntryZone?`${price(x.preferredEntryZone.low)}～${price(x.preferredEntryZone.high)}`:testZoneText(x.setup);
  const suggestedMid=!stale&&x.preferredEntryZone?(Number(x.preferredEntryZone.low)+Number(x.preferredEntryZone.high))/2:null,notifyPoint=testNotifyPoint(x),currentPoint=Number(x.currentPrice);
  const stateLabel=esc(x.monitorLabel||x.statusLabel||'監控中');
  return `<details class="testMonitorItem ${isFocus?'focused':''} ${stale?'dataStale':''}" data-test-judge="${esc(x.key)}" ${open?'open':''}>
    <button type="button" class="judgeDismissBtn" data-test-dismiss="${esc(x.key)}" aria-label="從監控判讀移除 ${esc(x.symbol)}" title="移除這筆；下次新訊號會再出現">×</button>
    <summary>
      <div class="judgeLead">
        <div class="judgeTitleRow"><span class="testMonitorIndex">${i+1}.</span>${tvAnchor(x.symbol,'testMonitorSymbol tvNameLink')}<span class="testMonitorRankTag">${rankNow?`排名 ${rankNow}`:'排名 —'}</span>${freshTag}</div>
        <div class="judgeBadgeRow">${testTrendTag(x)}<span class="testMonitorDir ${long?'long':'short'}">${long?'做多':'做空'}</span><span class="testTierTag ${testTierClass(x)}">${esc(testTierLabel(x))}</span><span class="testMonitorState">${stateLabel}</span>${invalidWindow?`<span class="testMonitorRecover">${esc(invalidWindow)}</span>`:''}</div>
        <div class="judgeTimeRow"><span>成立 ${signalTime}</span><b>更新 ${evalTime}</b></div>
      </div>
      <div class="judgePriceStrip"><div><span>通知點位</span><b>${hasNum(notifyPoint)?price(notifyPoint):'—'}</b></div><div><span>當下點位</span><b>${hasNum(currentPoint)?price(currentPoint):'—'}</b><small>${stale?'現價仍更新':'即時價'}</small></div><div><span>建議進場</span><b>${hasNum(suggestedMid)?price(suggestedMid):stale?'暫停':'—'}</b><small>${stale?'等判讀恢復':esc(preferred)}</small></div></div>
      <div class="testMonitorSummaryScore"><b>${winText}</b><span>${stale?'資料過期':'目前勝率'}</span><small>成立 ${confirmedRate}${delta?` · ${delta}`:''}</small></div>
    </summary>
    <div class="testMonitorBody">
      ${stale?`<div class="judgeStaleWarning">⚠ 資料已過期。現價可看，但勝率與進場建議暫停採用。</div>`:''}
      <div class="judgeCoreGrid">
        <div class="judgeCoreCell important"><span>當日排名 / 熱度</span><b>${rankNow?`${rankNow}`:'—'} / ${heat}</b></div>
        <div class="judgeCoreCell"><span>動態強度</span><b>${stale?'—':dynamic}</b></div>
        <div class="judgeCoreCell"><span>成立時勝率</span><b>${confirmedRate}</b></div>
        <div class="judgeCoreCell"><span>目前勝率</span><b>${winText}${delta?` · ${delta}`:''}</b></div>
        <div class="judgeCoreCell wide"><span>較佳進場區</span><b>${stale?'資料恢復後重算':esc(preferred)}</b></div>
        <div class="judgeCoreCell"><span>目前保護位</span><b>${protect}</b></div>
        <div class="judgeCoreCell"><span>最後更新</span><b>${evalTime}</b></div>
        <div class="judgeCoreCell"><span>狀態時間</span><b>${stateTime}</b></div>
      </div>
      <div class="judgeStrategy"><span>目前判讀</span><b>${strategy}</b></div>
      ${invalidReason?`<div class="judgeWarning">${esc(invalidReason)}${invalidWindow?` · ${esc(invalidWindow)}`:''}</div>`:''}
      <details class="judgeMore" data-persist-detail="judgeMore:${esc(x.key)}" ${detailOpenAttr(`judgeMore:${x.key}`)}><summary><span>更多判讀數據</span><b>展開</b></summary><div class="testFocusBody">
        <div class="testFocusCell"><span>保守下界</span><b>${stale?'—':ciLow}</b></div><div class="testFocusCell"><span>可信度 / 等效樣本</span><b>${esc(confidence)} / ${Number(x.winRateMeta?.effectiveSample||0)}</b></div>
        <div class="testFocusCell"><span>歷史1R勝率</span><b>${hist}</b></div><div class="testFocusCell"><span>平均90分報酬</span><b>${avg}</b></div>
        <div class="testFocusCell"><span>回測獲利因子</span><b>${pf}</b></div><div class="testFocusCell"><span>回測樣本</span><b>${Number(bt.sample||0)}</b></div>
        <div class="testFocusCell"><span>完整回踩區</span><b>${esc(testZoneText(x.setup))}</b></div><div class="testFocusCell"><span>確認價</span><b>${hasNum(x.confirmationPrice)?price(x.confirmationPrice):'等待確認'}</b></div>
        <div class="testFocusCell"><span>突破位</span><b>${breakout}</b></div><div class="testFocusCell"><span>大戶持倉多空比</span><b>${topRatio}</b></div>
        <div class="testFocusCell"><span>20檔委託簿失衡</span><b>${depth}</b></div><div class="testFocusCell"><span>ADL / Funding</span><b>${adl} / ${fund}</b></div>
        <div class="testFocusCell"><span>1小時趨勢</span><b>${h1}</b></div><div class="testFocusCell"><span>勝率區間</span><b>${stale?'—':`${ciLow}～${ciHigh}`}</b></div>
        <div class="testFocusCell"><span>二次回踩區</span><b>${reZone}</b></div><div class="testFocusCell"><span>二次條件分</span><b>${reScore}</b></div>
        <div class="testFocusCell"><span>二進實測勝率 / 樣本</span><b>${reLiveText}</b></div><div class="testFocusCell"><span>二次進場 / 停損</span><b>${reEntry} / ${reStop}</b></div>
        <div class="testFocusCell"><span>二次 1R</span><b>${reTarget}</b></div><div class="testFocusCell"><span>APP實測樣本</span><b>${Number(x.winRateMeta?.liveSample||0)}</b></div>
        <div class="testFocusCell"><span>已收5分K時間</span><b>${localTime(x.lastEvaluatedBarAt)||'—'}</b></div><div class="testFocusCell"><span>即時行情時間</span><b>${priceTime}</b></div>
      </div></details>
      <div class="judgeReasonBlock"><span>成立依據</span><div class="testReasons">${testReasonChips(x)||'<span class="testReason">等待回踩確認資料</span>'}</div>${reMeta?`<p>${reMeta}</p>`:''}</div>
      <details class="testPlannerFold" data-persist-detail="judgePlan:${esc(x.key)}" ${detailOpenAttr(`judgePlan:${x.key}`)}><summary><span>進場 / 盈虧試算</span><b>展開</b></summary>${testEntryPlanMarkup(x)}</details>
      <div class="testFocusActions"><button type="button" class="closeJudge" data-test-collapse-one>縮小此筆</button><button type="button" class="removeJudge" data-test-dismiss="${esc(x.key)}">移除判讀</button></div>
    </div>
  </details>`;
}

function renderReachedPool(rows){
  if(!rows.length)return'';
  const items=rows.map(x=>{const stale=testIsStale(x),win=testEffectiveWinRate(x),re=x.reentryStage==='WAIT_PULLBACK'?'等二次回踩':x.reentryStage==='WIN'?'二進達標':x.reentryStage==='FAILED'?'二進失效':'達標',zone=hasNum(x.reentryZoneLow)&&hasNum(x.reentryZoneHigh)?`${price(x.reentryZoneLow)}～${price(x.reentryZoneHigh)}`:'尚未形成';return `<div class="reachedRow ${stale?'dataStale':''}"><div><b>${tvAnchor(x.symbol,'tvNameLink reachedSymbol')}</b><span>排名 ${Number(x.rank||0)||'—'} · 達標 ${localTime(x.targetReachedAt)} · 更新 ${testLastEvalTime(x)} · ${re}</span></div><div><strong>${stale?'—':win>=0?win.toFixed(1)+'%':'—'}</strong><small>${stale?'資料過期':'二踩 '+zone}</small></div></div>`}).join('');
  return `<details class="reachedPool" data-persist-detail="monitorReachedPool" ${detailOpenAttr('monitorReachedPool')}><summary><span>達標池</span><b>${rows.length}</b><small>預設收起 · 出現二次回踩/二次確認會自動回到上方並通知</small></summary><div class="reachedList">${items}</div></details>`;
}
function renderTestFocus(){
  const panel=$('testFocusPanel');if(!panel)return;
  if(!testSignalsState){if(testFocusSymbol){panel.classList.add('show');panel.innerHTML='<div class="testMonitorTitle">回踩判讀</div><div class="testMonitorSub">載入訊號中…</div>'}else{panel.classList.remove('show');panel.innerHTML=''}return}
  let rows=testMonitorCandidates(),reached=testReachedCandidates();
  const reLive=testSignalsState?.liveStats?.reentry||{},reLiveText=hasNum(reLive.hitRate)?`${Number(reLive.hitRate).toFixed(1)}% / ${Number(reLive.sample||0)}`:`— / ${Number(reLive.sample||0)}`;
  if(!rows.length&&!reached.length){panel.classList.remove('show');panel.innerHTML='';return}
  const focusKey=testFocusSymbol?`${testFocusSymbol}:${testFocusDirection==='SHORT'?'SHORT':'LONG'}`:'';
  if(focusKey){const ix=rows.findIndex(x=>x.key===focusKey);if(ix>0){const [f]=rows.splice(ix,1);rows.unshift(f)}}
  if(rows.length===1&&!testMonitorOpenKeys.size)testMonitorOpenKeys.add(rows[0].key);if(focusKey)testMonitorOpenKeys.add(focusKey);
  const top=rows.slice(0,3),more=rows.slice(3),topCards=top.map((x,i)=>renderMonitorJudgeCard(x,i,focusKey,reLiveText)).join(''),moreCards=more.map((x,i)=>renderMonitorJudgeCard(x,i+3,focusKey,reLiveText)).join('');
  const moreHtml=more.length?`<details class="moreMonitorPool" data-persist-detail="monitorMorePool" ${detailOpenAttr('monitorMorePool')}><summary>更多監控 <b>+${more.length}</b></summary><div class="testMonitorList more">${moreCards}</div></details>`:'';
  panel.classList.add('show');
  panel.innerHTML=`<div class="testMonitorHeader"><div class="testMonitorHeadLeft"><div class="testMonitorTitle">回踩判讀</div><div class="testMonitorSub">前 3 筆優先 · WebSocket 現價約 1 秒 · 深度約 100ms · 深度判讀約 30 秒</div></div><div class="testMonitorControls"><button type="button" data-test-expand-all>全部展開</button><button type="button" data-test-collapse-all>全部縮小</button></div></div><div class="testMonitorList">${topCards}</div>${moreHtml}${renderReachedPool(reached)}`;
  bindTestJudgementDetails();
}
function goTestSignalToMonitor(symbol,direction){testFocusSymbol=symbol;testFocusDirection=direction==='SHORT'?'SHORT':'LONG';clearTestJudgementDismiss(`${symbol}:${testFocusDirection}`);testMonitorOpenKeys.add(`${symbol}:${testFocusDirection}`);try{history.replaceState(null,'',`${location.pathname}?page=monitor&testSignal=${encodeURIComponent(symbol)}&dir=${testFocusDirection}`)}catch{}setPage('monitor');renderTestFocus();window.scrollTo({top:0,behavior:'smooth'})}
function renderTestSignals(d){
  if(!d?.ok)return;testSignalsState=d;testSignalsFetchedAt=Date.now();const rows=d.rows||[],live=d.liveStats||{};if(lastStatus)renderCalcPositions(lastStatus);
  const active=rows.filter(x=>['WAIT_PULLBACK','TOUCHING','CONFIRMED','INVALID'].includes(x.status)&&!testIsReachedWaiting(x)).length,high=rows.filter(x=>x.notificationTier==='HIGH'&&!testIsReachedWaiting(x)).length,normal=rows.filter(x=>x.notificationTier==='NORMAL'&&!testIsReachedWaiting(x)).length,liveHit=hasNum(live.hitRate)?`${Number(live.hitRate).toFixed(1)}%`:'—';
  $('testSummary').innerHTML=`<div class="testSummaryCell"><span>監控</span><b>${active}</b></div><div class="testSummaryCell"><span>高勝率</span><b>${high}</b></div><div class="testSummaryCell"><span>普通</span><b>${normal}</b></div><div class="testSummaryCell"><span>實測勝率</span><b>${liveHit}</b></div>`;
  $('testGrid').innerHTML=rows.map(x=>{const bt=x.setup?.backtest||{},q=Math.max(0,Math.min(100,Number(x.qualityScore||x.setup?.setupScore||0))),long=x.direction==='LONG',hist=hasNum(bt.hitRate)?`${Number(bt.hitRate).toFixed(1)}%`:'—',cal=testEffectiveWinRate(x)>=0?`${testEffectiveWinRate(x).toFixed(1)}%`:'—',avg=testSignedPct(bt.avgReturnPct,2),dynamic=hasNum(x.monitorScore)?Number(x.monitorScore).toFixed(0):q,preferred=x.preferredEntryZone?`${price(x.preferredEntryZone.low)}～${price(x.preferredEntryZone.high)}`:'等待區間',moreKey=`testMore:${x.key}`,deepKey=`testDeep:${x.key}`;return `<div class="testCard ${testStatusClass(x.status)}"><div class="testHead"><div class="testRank">${x.rank?`#${x.rank}`:'#—'}</div><div class="testSymbolRow">${tvAnchor(x.symbol,'tvNameLink testSymbol')}${testTrendTag(x)}<span class="testDir ${long?'long':'short'}">${long?'做多':'做空'}</span><span class="testTierTag ${testTierClass(x)}">${esc(testTierLabel(x))}</span></div><div class="testState"><b>${esc(x.statusLabel||'等待')}</b><small>${x.lastEvaluatedAt?`更新 ${localTime(x.lastEvaluatedAt)}`:x.updatedAt?`更新 ${localTime(x.updatedAt)}`:'—'}</small></div></div><div class="testQuality"><div class="testQualityBar"><div class="testQualityFill" style="width:${q}%"></div></div><div class="testQualityText">品質 <b>${q||'—'}</b></div></div><div class="testQuickGrid"><div><span>校準勝率</span><b>${cal}</b></div><div><span>歷史1R</span><b>${hist}</b></div><div><span>動態強度</span><b>${dynamic}</b></div><div><span>90分報酬</span><b>${avg}</b></div><div class="wide"><span>較佳進場區</span><b>${esc(preferred)}</b></div></div><details class="testCardMore" data-persist-detail="${esc(moreKey)}" ${detailOpenAttr(moreKey)}><summary>更多數據</summary><div class="testMetrics"><div class="testMetric"><span>回測樣本</span><b>${Number(bt.sample||0)}</b></div><div class="testMetric"><span>回測獲利因子</span><b>${hasNum(bt.profitFactor)?Number(bt.profitFactor).toFixed(2):'—'}</b></div><div class="testMetric"><span>5分 RSI</span><b>${hasNum(x.lastCheck?.rsi5)?Number(x.lastCheck.rsi5).toFixed(1):'—'}</b></div><div class="testMetric"><span>OI 15分</span><b>${x.dataHealth?.sources?.oi?testSignedPct(x.lastCheck?.oi15mChangePct??x.lastCheck?.oiChangePct,1):'無資料'}</b></div><div class="testMetric"><span>資料完整度</span><b>${hasNum(x.dataHealth?.coveragePct)?Number(x.dataHealth.coveragePct).toFixed(0)+'%':'—'}</b></div></div><div class="testLevels"><div class="testLevel"><span>完整回踩區</span><b>${esc(testZoneText(x.setup))}</b></div><div class="testLevel"><span>失效參考</span><b>${x.setup?price(x.setup.invalidation):'—'}</b></div><div class="testLevel"><span>確認價</span><b>${hasNum(x.confirmationPrice)?price(x.confirmationPrice):'等待確認'}</b></div></div></details><div class="testReasons">${testReasonChips(x)||'<span class="testReason">等待5分回踩確認</span>'}</div><div class="testActions"><button type="button" class="monitorBtn" data-test-monitor="${esc(x.symbol)}" data-test-dir="${esc(x.direction)}">到監控判讀</button><button type="button" class="detailBtn" data-test-detail-toggle="${esc(x.key)}">詳細</button></div><div class="testNotifyGate ${testTierClass(x)}">${esc(testNotifyGateText(x))}</div><details class="testDeepDetail" data-test-deep-detail="${esc(x.key)}" data-persist-detail="${esc(deepKey)}" ${detailOpenAttr(deepKey)}><summary><span>詳細</span><small>免費完整交叉比對</small></summary><div class="testDeepBody">${renderTestCrossDetail(x)}</div></details><details class="testAiWebDetail" data-test-ai-web data-test-ai-key="${esc(x.key)}" data-test-ai-symbol="${esc(x.symbol)}" data-test-ai-dir="${esc(x.direction)}" ${testAiOpenKeys.has(x.key)?'open':''}><summary><span>AI網搜</span><small>預估 US$0.01 起 · 2小時快取</small></summary><div class="testWebCross"><div data-test-web-analysis-body><div class="ideaAnalysisLoading">只有展開 AI網搜 才會產生 OpenAI API 費用；免費詳細不收費。</div></div></div></details></div>`}).join('')||'<div class="testEmpty">目前建議排名沒有可追蹤標的。</div>';
  bindTestDeepDetails();
  const th=d.notifyThresholds||{};$('testMethod').textContent=`高勝率：校準≥${Number(th.highRate||68)}%、品質≥${Number(th.highScore||87)}、排名前6、完整度≥${Number(th.highCoverage||90)}%、可信度≥${Number(th.highConfidence||86)}%、追價≤${Number(th.highMaxChaseAtr||.18)} ATR。普通：校準≥${Number(th.normalRate||60)}%、品質≥${Number(th.normalScore||80)}、排名前9、完整度≥${Number(th.normalCoverage||80)}%、可信度≥${Number(th.normalConfidence||76)}%。完整度<${Number(th.blockCoverage||72)}%或可信度<${Number(th.blockConfidence||65)}%直接阻擋；高勝率還必須具備主週期、OI、主動資金、深度、Funding、Mark、大盤與回測等關鍵資料，跨所趨勢明確逆向也會阻擋。缺值不拿0或中性值補進勝率。超過 ${Number(th.maxChaseAtr||.30)} ATR 追價不確認。`;
  const ns=d.notifyStats||{},mode=loadTestSignalNotifyMode(),modeText=({HIGH:'只開高勝率',HIGH_NORMAL:'高＋普通',ALL:'全部有效'})[mode]||'高＋普通';
  if($('testNotifyDiag'))$('testNotifyDiag').innerHTML=`<b>${modeText}</b> · 目前高 ${Number(ns.high||0)} / 普通 ${Number(ns.normal||0)} / 有效 ${Number(ns.valid||0)} / 暫停 ${Number(ns.blocked||0)}<span>高＋普通本來就會很少：只有回踩確認、非追價、無逆向風險才會推。</span>`;
  const h=d.health||{},scanSec=hasNum(h.scanAgeMs)?Math.round(Number(h.scanAgeMs)/1000):null,healthText=Number(h.staleCount||0)>0?`過期 ${h.staleCount}`:Number(h.delayedCount||0)>0?`延遲 ${h.delayedCount}`:'正常';
  if($('testHealth')){const rt=h.realtime||{},pub=rt.public?.connected===true,mkt=rt.market?.connected===true,rad=rt.radar||{},p95=Math.max(Number(rt.public?.latency?.p95Ms||0),Number(rt.market?.latency?.p95Ms||0));$('testHealth').textContent=`系統 ${healthText} · 深度掃描 ${scanSec==null?'—':scanSec+'秒前'} · WS ${pub&&mkt?'雙路即時':'REST備援'}${p95?` p95 ${Math.round(p95)}ms`:''} · 全市場 ${Number(rad.scanned||0)} / 深度候選 ${Number(rad.deepCandidates||0)} · 監控 ${Number(h.tracked||0)}`;}
  $('testAge').textContent=d.generatedAt?ageText(d.generatedAt):'—';renderTestFocus();
}
async function refreshTestSignals(force=false){
  if(testSignalsBusy)return;if(!force&&testSignalsState&&Date.now()-testSignalsFetchedAt<8_000){renderTestSignals(testSignalsState);return}testSignalsBusy=true;
  try{const r=await fetch(`/api/test-signals${force?'?force=1':''}`,{cache:'no-store'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderTestSignals(d)}catch(e){if(testSignalsState)renderTestSignals(testSignalsState);else $('testGrid').innerHTML='<div class="testEmpty">回踩測試暫時不可用。</div>'}finally{testSignalsBusy=false}
}


function loadPerfSim(){const d=loadObject(PERF_SIM_PREF,{margin:300,leverage:20,costBps:12});return {margin:Math.max(1,Number(d.margin||300)),leverage:Math.max(1,Math.min(125,Number(d.leverage||20))),costBps:Math.max(0,Math.min(100,Number(d.costBps??12)))}}
function savePerfSim(v){try{localStorage.setItem(PERF_SIM_PREF,JSON.stringify(v))}catch{}}
function perfResultLabel(x){return x.status==='ACTIVE'?'追蹤中':x.result==='WIN'?`目標 ${hasNum(x.targetR)?Number(x.targetR).toFixed(2)+'R ':''}達成`:x.result==='LOSS'?'停損先到':'4小時逾時'}
function perfResultClass(x){return x.status==='ACTIVE'?'active':x.result==='WIN'?'win':x.result==='LOSS'?'loss':'timeout'}
function perfPct(v,d=2){return hasNum(v)?`${Number(v)>0?'+':''}${Number(v).toFixed(d)}%`:'—'}
function perfMoney(v){if(!hasNum(v))return'—';const x=Number(v);return`${x>=0?'+':'-'}${Math.abs(x).toFixed(2)} U`}
function perfDateTime(iso){if(!iso)return'—';try{return new Date(iso).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).replace(/^24:/,'00:')}catch{return'—'}}
function perfSimStats(records,cfg,summary={}){const resolved=(records||[]).filter(x=>x.status==='RESOLVED'),notional=cfg.margin*cfg.leverage,totalResolved=Number(summary.resolved||resolved.length),cumGross=hasNum(summary.cumulativeGrossReturnPct)?Number(summary.cumulativeGrossReturnPct):resolved.reduce((a,x)=>a+Number(x.grossReturnPct||0),0),total=notional*(cumGross-totalResolved*cfg.costBps/100)/100;return {resolved:totalResolved,notional,total}}
function perfBreakHtml(rows){if(!rows?.length)return'<div class="perfEmpty">樣本累積中</div>';return rows.slice(0,12).map(x=>`<div class="perfBreakRow"><b>${esc(({TREND_UP:'強多趨勢',TREND_DOWN:'強空趨勢',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算行情'})[x.key]||x.key)}</b><span>${Number(x.sample||0)}筆</span><span>${hasNum(x.hitRate)?Number(x.hitRate).toFixed(1)+'%':'—'}</span><span>PF ${hasNum(x.profitFactor)?Number(x.profitFactor).toFixed(2):'—'}</span></div>`).join('')}
function perfMs(v){if(!hasNum(v))return'—';const n=Number(v);return n<1000?`${Math.round(n)} ms`:`${(n/1000).toFixed(n<10000?2:1)} 秒`}
function perfCalibrationHtml(cal){if(!cal?.sample)return'<div class="perfEmpty">至少需要已結算通知後才開始校準</div>';const rows=(cal.bins||[]).map(x=>`<div class="perfCalRow"><b>${esc(x.key)}</b><span>${Number(x.sample||0)}筆</span><span>預測 ${Number(x.predicted||0).toFixed(1)}%</span><span class="${Number(x.gapPct||0)>=0?'goodText':'badText'}">實際 ${Number(x.actual||0).toFixed(1)}%</span></div>`).join('');return `<div class="perfOpsGrid"><div><span>校準樣本</span><b>${Number(cal.sample||0)}</b></div><div><span>預測平均</span><b>${hasNum(cal.meanPredicted)?Number(cal.meanPredicted).toFixed(1)+'%':'—'}</b></div><div><span>實際達標</span><b>${hasNum(cal.actualHitRate)?Number(cal.actualHitRate).toFixed(1)+'%':'—'}</b></div><div><span>校準誤差</span><b>${hasNum(cal.calibrationMaePct)?Number(cal.calibrationMaePct).toFixed(1)+'pt':'—'}</b></div><div><span>Brier</span><b>${hasNum(cal.brierScore)?Number(cal.brierScore).toFixed(4):'—'}</b></div><div><span>實際−預測</span><b>${hasNum(cal.gapPct)?`${Number(cal.gapPct)>0?'+':''}${Number(cal.gapPct).toFixed(1)}pt`:'—'}</b></div></div>${rows?`<div class="perfCalRows">${rows}</div>`:''}`}
function renderPerformance(d){
  if(!d?.ok)return;performanceState=d;performanceFetchedAt=Date.now();const sum=d.summary||{},records=d.records||d.recent||[],cfg=loadPerfSim(),sim=perfSimStats(records,cfg,sum),pnlClass=sim.total>0?'good':sim.total<0?'bad':'';
  if($('perfMargin'))$('perfMargin').value=String(cfg.margin);if($('perfLeverage'))$('perfLeverage').value=String(cfg.leverage);if($('perfCostBps'))$('perfCostBps').value=String(cfg.costBps);
  $('perfSummary').innerHTML=`<div class="perfCell"><span>通知樣本</span><b>${Number(sum.sample||0)}</b></div><div class="perfCell"><span>目標達標率</span><b>${hasNum(sum.hitRate)?Number(sum.hitRate).toFixed(1)+'%':'—'}</b></div><div class="perfCell"><span>PF</span><b>${hasNum(sum.profitFactor)?Number(sum.profitFactor).toFixed(2):'—'}</b></div><div class="perfCell"><span>期望R</span><b>${hasNum(sum.expectancyR)?Number(sum.expectancyR).toFixed(3):'—'}</b></div><div class="perfCell"><span>平均淨報酬</span><b>${hasNum(sum.avgNetReturnPct)?perfPct(sum.avgNetReturnPct,3):'—'}</b></div><div class="perfCell"><span>模擬總損益</span><b class="${pnlClass}">${perfMoney(sim.total)}</b></div>`;
  $('perfByTier').innerHTML=perfBreakHtml(sum.byTier);$('perfByRegime').innerHTML=perfBreakHtml(sum.byRegime);$('perfBySymbol').innerHTML=perfBreakHtml(sum.bySymbol);
  const rt=d.realtime||testSignalsState?.health?.realtime||{},wsP95=Math.max(Number(rt.public?.latency?.p95Ms||0),Number(rt.market?.latency?.p95Ms||0));
  if($('perfLatency'))$('perfLatency').innerHTML=`<div class="perfOpsGrid"><div><span>訊號→送出 平均</span><b>${perfMs(sum.avgSignalToPushMs)}</b></div><div><span>訊號→送出 p95</span><b>${perfMs(sum.p95SignalToPushMs)}</b></div><div><span>Push服務平均</span><b>${perfMs(sum.avgPushServiceMs)}</b></div><div><span>手機回報 p95</span><b>${perfMs(sum.p95DeliveryLatencyMs)}</b></div><div><span>手機收到回報率</span><b>${hasNum(sum.deliveryAckRate)?Number(sum.deliveryAckRate).toFixed(1)+'%':'—'}</b></div><div><span>行情 WS p95</span><b>${wsP95?Math.round(wsP95)+' ms':'—'}</b></div></div>`;
  if($('perfCalibration'))$('perfCalibration').innerHTML=perfCalibrationHtml(sum.calibration);
  const recent=(d.recent||[]).slice(0,30);$('perfRecent').innerHTML=recent.map(x=>{const net=Number(x.grossReturnPct||0)-cfg.costBps/100,pnl=x.status==='RESOLVED'?cfg.margin*cfg.leverage*net/100:null;return `<div class="perfTrade"><div class="perfTradeHead"><div><span class="perfTradeSym">${esc(x.symbol)}</span><span class="perfTradeDir ${x.direction==='LONG'?'long':'short'}">${x.direction==='LONG'?'做多':'做空'}</span></div><div class="perfTradeResult ${perfResultClass(x)}">${perfResultLabel(x)}</div></div><div class="perfTradeMeta">${perfDateTime(x.notificationAt)} · ${esc(x.tier||'VALID')} · ${esc(({TREND_UP:'強多',TREND_DOWN:'強空',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算'})[x.marketRegime]||x.marketRegime||'—')} · 通知價 ${price(x.entryPrice)}${hasNum(x.deliveryLatencyMs)?` · 手機 ${perfMs(x.deliveryLatencyMs)}`:''}</div><div class="perfTradeStats"><div class="perfTradeStat"><span>MFE / MAE</span><b>${perfPct(x.mfePct,2)} / -${Math.abs(Number(x.maePct||0)).toFixed(2)}%</b></div><div class="perfTradeStat"><span>結果 R</span><b>${hasNum(x.realizedR)?Number(x.realizedR).toFixed(2)+'R':hasNum(x.maxR)?'最高 '+Number(x.maxR).toFixed(2)+'R':'—'}</b></div><div class="perfTradeStat"><span>淨報酬估算</span><b>${x.status==='RESOLVED'?perfPct(net,3):'追蹤中'}</b></div><div class="perfTradeStat"><span>模擬損益</span><b>${x.status==='RESOLVED'?perfMoney(pnl):'—'}</b></div></div></div>`}).join('')||'<div class="perfEmpty">V10 上線後，第一則真正送達的進場通知會從這裡開始記錄。</div>';
  $('perfResolved').textContent=`已結算 ${Number(sum.resolved||0)} · 追蹤中 ${Number(sum.active||0)}`;$('perfAge').textContent=ageText(d.generatedAt);$('perfMethod').textContent=`${d.methodology||''}｜模擬：${cfg.margin}U × ${cfg.leverage}x = ${(cfg.margin*cfg.leverage).toFixed(0)}U 名義倉位；單輪成本 ${cfg.costBps}bps。`;
  const live=rt.public?.connected&&rt.market?.connected;if($('perfRealtime'))$('perfRealtime').textContent=live?`WS 雙路即時${wsP95?' · p95 '+Math.round(wsP95)+'ms':''}`:'REST / K線備援';
}
async function refreshPerformance(force=false){if(performanceBusy)return;if(!force&&performanceState&&Date.now()-performanceFetchedAt<5_000){renderPerformance(performanceState);return}performanceBusy=true;try{const [r,rr]=await Promise.all([fetch('/api/performance',{cache:'no-store'}),fetch('/api/realtime',{cache:'no-store'}).catch(()=>null)]),d=await r.json().catch(()=>null),rt=rr?.ok?await rr.json().catch(()=>null):null;if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);if(rt?.ok)d.realtime=rt;renderPerformance(d)}catch(e){if(performanceState)renderPerformance(performanceState);else $('perfRecent').innerHTML='<div class="perfEmpty">績效資料暫時不可用。</div>'}finally{performanceBusy=false}}
function initPerformanceControls(){for(const id of ['perfMargin','perfLeverage','perfCostBps'])$(id)?.addEventListener('change',()=>{const v={margin:Math.max(1,Number($('perfMargin')?.value||300)),leverage:Math.max(1,Math.min(125,Number($('perfLeverage')?.value||20))),costBps:Math.max(0,Math.min(100,Number($('perfCostBps')?.value||12)))};savePerfSim(v);if(performanceState)renderPerformance(performanceState)})}

function renderMarketFlow(d){
  if(!d?.ok)return;marketFlowState=d;marketFlowFetchedAt=Date.now();
  const sm=d.summary||{},dir=sm.direction==='LONG'?'long':sm.direction==='SHORT'?'short':'neutral';
  $('flowHero').className='flowHero';$('flowHero').innerHTML=`<div class="flowHeroTop"><div><div class="flowHeroTitle ${dir}">${esc(sm.label||'多空拉鋸')}</div><div class="flowHeroMeta">加權 ${signed(sm.weightedChangePct||0,2)} · ↑ ${sm.advancers||0} / ↓ ${sm.decliners||0}</div></div><div class="flowConfidence">${Number(sm.confidence||0)}<small>/100</small></div></div><div class="flowStats"><div class="flowStat"><span>廣度</span><b class="${Number(sm.breadth||0)>=0?'longText':'shortText'}">${signed(Number(sm.breadth||0)*100,1)}</b></div><div class="flowStat"><span>來源</span><b class="goldText">Binance</b></div><div class="flowStat"><span>更新</span><b>${ageText(d.generatedAt)}</b></div></div>`;
  const rows=(d.leaders||[]).slice(0,16);$('marketList').innerHTML=rows.map(x=>`<div class="marketRow"><div>${tvAnchor(x.symbol,'tvNameLink marketSym')}<div class="marketSub">${price(x.price)}</div></div><div class="marketMetric"><span>24h</span><b class="${Number(x.changePct)>=0?'longText':'shortText'}">${signed(x.changePct)}</b></div><div class="marketMetric"><span>額 / F</span><b>${fmtVol(x.quoteVolume)}</b><div class="marketSub">${signed(x.fundingPct,4)}</div></div></div>`).join('')||'<div class="loadingBox">—</div>';
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
function initTestNotifyControls(){
  const toggle=$('testSignalNotify');if(toggle)toggle.checked=loadTestSignalNotify();
  document.querySelectorAll('[name="testNotifyMode"]').forEach(r=>{r.checked=r.value===loadTestSignalNotifyMode();r.addEventListener('change',async()=>{if(!r.checked)return;saveTestSignalNotifyMode(r.value);await syncPreferences().catch(()=>{});const msg=$('testNotifyMsg');if(msg)msg.textContent=({HIGH:'只收高勝率',HIGH_NORMAL:'高＋普通',ALL:'全部有效'})[r.value]||''})});
  toggle?.addEventListener('change',async e=>{saveTestSignalNotify(e.currentTarget.checked);const sub=await getPushSubscription();if(!sub&&e.currentTarget.checked){e.currentTarget.checked=false;saveTestSignalNotify(false);const msg=$('testNotifyMsg');if(msg)msg.textContent='先到「監控」同步 iPhone 通知';return}await syncPreferences().catch(()=>{});const msg=$('testNotifyMsg');if(msg)msg.textContent=e.currentTarget.checked?'通知已開':'通知已關，測試仍會計算'});
}
initTestNotifyControls();
initPerformanceControls();
document.querySelectorAll('.pageTab').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.page)));
try{setPage(localStorage.getItem('position-alert-page-v78')||'today')}catch{setPage('today')}
setInterval(()=>{const active=document.querySelector('.pageTab.active')?.dataset?.page;if(active==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}else if(active==='flow')void refreshMarketFlow(false);else if(active==='ideas')void refreshRankedIdeas(false);else if(active==='test'||active==='monitor')void refreshTestSignals(false);else if(active==='performance')void refreshPerformance(false)},8_000);

