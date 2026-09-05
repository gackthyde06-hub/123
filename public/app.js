// NO_PAGE_LOCK_V2664_20260904
// WORKSPACE_STABILITY_V2619
// UI_STABILITY_V2617
// UI_CONTROL_V2616
// UI_POLISH_V2612: dual crypto/US-stock UI + asset-aware learning display + cached public info.
// UI_POLISH_V2611: icon-only page lock, TV return pin, local Chinese coin profiles.
// UI_POLISH_V2610: Actual Trade monitor pin + 24h UI history.
// UI_POLISH_V269: observation manual trade + persistent page lock.
// UI_POLISH_V267: symbol names open TradingView Web directly; internal name-click chart disabled.
const $=id=>document.getElementById(id);

/* WORKSPACE_STABILITY_V2619
 * Independent visible-page locks.
 * Backend fetch / Shadow learning continue normally; only the visible DOM order is frozen.
 */
const PAGE_FREEZE_PREF_V2619='position-alert-independent-page-freeze-v2619';
const PAGE_FREEZE_ALLOWED_V2619=new Set(['ideas','monitor','test']);
let pageFreezePendingV2619={ideas:null,test:null};
function pageFreezeReadV2619(){return{ideas:false,monitor:false,test:false}}
function pageFreezeIsV2619(_page){return false}
function pageFreezeCurrentV2619(){return document.querySelector('.pageTab.active')?.dataset?.page||''}
function pageFreezeNameV2619(page){return({ideas:'建議',monitor:'監控',test:'觀察'})[page]||page}
function pageFreezeWriteV2619(_page,_locked){try{localStorage.removeItem('position-alert-independent-page-freeze-v2619')}catch{}}
function pageFreezeApplyPendingV2619(page){
  if(page==='ideas'){
    const d=pageFreezePendingV2619.ideas||rankedIdeasState;
    pageFreezePendingV2619.ideas=null;
    if(d)try{renderRankedIdeas(d)}catch(e){console.warn('[v2619] apply ideas pending',e)}
  }else if(page==='monitor'||page==='test'){
    const d=pageFreezePendingV2619.test||testSignalsState;
    pageFreezePendingV2619.test=null;
    if(d)try{renderTestSignals(d)}catch(e){console.warn('[v2619] apply test pending',e)}
  }
}
function pageFreezeSyncV2619(){document.getElementById('workspaceFreezeV2619')?.remove();document.getElementById('pageLockTagV269')?.remove();document.querySelector('.pageLockRowV269')?.remove()}
function installWorkspaceStyleV2619(){
  if(document.getElementById('workspaceStyleV2619'))return;
  const st=document.createElement('style');st.id='workspaceStyleV2619';st.textContent=`
.workspaceFreezeV2619{margin-left:auto;min-height:42px;padding:7px 12px;display:inline-grid;grid-template-columns:auto auto;grid-template-rows:auto auto;align-items:center;column-gap:7px;border:1px solid #343a3d;border-radius:14px;background:#0b0e0f;color:#aaa49a;font:inherit;box-shadow:none}
.workspaceFreezeV2619[hidden]{display:none!important}.workspaceFreezeV2619 .freezeIconV2619{grid-row:1/3;font-size:15px;color:#777}.workspaceFreezeV2619 b{font-size:10px;line-height:1.15;color:#d7d0c5}.workspaceFreezeV2619 small{font-size:7px;line-height:1.1;color:#777}
.workspaceFreezeV2619.locked{border-color:#7d612b;background:linear-gradient(180deg,#181309,#0c0d0d)}.workspaceFreezeV2619.locked .freezeIconV2619,.workspaceFreezeV2619.locked b{color:#e7c66f}.workspaceFreezeV2619.locked small{color:#a38d58}
.pageLockRowV269{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important}
.actualMonitorFoldV2619{border:0;padding:0;margin:0}.actualMonitorFoldV2619>summary{list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent}.actualMonitorFoldV2619>summary::-webkit-details-marker{display:none}.actualMonitorFoldV2619 .actualMonitorHeadV2610{margin:0!important}
.actualMonitorFoldTitleV2619{display:flex;align-items:center;gap:9px}.actualMonitorFoldActionV2619{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;min-width:54px;height:31px;padding:0 10px;border:1px solid #4b4028;border-radius:11px;color:#d6bd79;background:#11100c;font-size:9px;font-weight:900}.actualMonitorFoldV2619:not([open]) .actualMonitorFoldActionV2619{border-color:#313638;color:#aaa;background:#0d1011}
.actualMonitorFoldBodyV2619{padding-top:8px}
@media(max-width:640px){.workspaceFreezeV2619{min-height:38px;padding:6px 9px;border-radius:12px}.workspaceFreezeV2619 b{font-size:9px}.workspaceFreezeV2619 small{font-size:6.5px}.actualMonitorFoldActionV2619{min-width:48px;height:29px;font-size:8px}}
`;document.head.appendChild(st);
}
document.addEventListener('click',e=>{if(e.target?.closest?.('.pageTab'))setTimeout(()=>{pageFreezeSyncV2619();const p=pageFreezeCurrentV2619();if(!pageFreezeIsV2619(p))pageFreezeApplyPendingV2619(p)},30)},true);
document.addEventListener('DOMContentLoaded',()=>{installWorkspaceStyleV2619();setTimeout(pageFreezeSyncV2619,60)});
window.addEventListener('pageshow',()=>setTimeout(pageFreezeSyncV2619,80));


// UI_STABILITY_V2617: one scroll owner, no repeated correction loops.
const UI_MOTION_IDLE_MS_V2617=1100;
let uiMotionUntilV2617=0,tvReturnBusyV2617=false,tvReturnSettleTimerV2617=null,lastRankSigV2617='',lastTestSigV2617='';
function markUiMotionV2617(ms=UI_MOTION_IDLE_MS_V2617){uiMotionUntilV2617=Math.max(uiMotionUntilV2617,Date.now()+ms)}
function uiMotionHeldV2617(){return Date.now()<uiMotionUntilV2617||tvReturnBusyV2617||Number(window.__tvReturnHoldUntilV2617||0)>Date.now()}
function uiAutoRefreshAllowedV2617(){return !document.hidden&&!uiMotionHeldV2617()}
window.uiAutoRefreshAllowedV2617=uiAutoRefreshAllowedV2617;window.uiMotionHeldV2617=uiMotionHeldV2617;
for(const ev of ['touchstart','touchmove','pointerdown','wheel'])document.addEventListener(ev,()=>markUiMotionV2617(ev==='touchmove'?1300:900),{passive:true,capture:true});
window.addEventListener('scroll',()=>markUiMotionV2617(900),{passive:true});
function stableElementKeyV2617(el){if(!el)return'';const direct=el.dataset?.observationKey||el.dataset?.actualId||el.dataset?.id||el.dataset?.signalKey||'';if(direct)return String(direct);const tv=el.matches?.('[data-tv-symbol]')?el:el.querySelector?.('[data-tv-symbol]');const sym=String(tv?.dataset?.tvSymbol||tv?.textContent||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const dir=/做空/.test(el.textContent||'')?'SHORT':/做多/.test(el.textContent||'')?'LONG':'';return sym?`TV:${sym}:${dir}`:''}
function captureViewportAnchorV2617(root){if(!root||!root.isConnected||uiMotionHeldV2617())return null;const topLine=Math.max(86,Math.min(150,window.innerHeight*.16)),nodes=[...root.querySelectorAll('.rankCard,.testCard,.testMonitorCard,.manual-card,.actualTradeItemV2613,.manual-shadow-history-row,.abc-sample-row')];let pick=null;for(const el of nodes){const r=el.getBoundingClientRect();if(r.bottom<=topLine||r.top>=window.innerHeight)continue;if(r.top<=topLine){pick=el;break}if(!pick)pick=el}if(!pick)return null;return{key:stableElementKeyV2617(pick),top:pick.getBoundingClientRect().top,scrollY:window.scrollY||0}}
function restoreViewportAnchorV2617(root,a){if(!a||!root||uiMotionHeldV2617())return;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(uiMotionHeldV2617())return;let target=null;if(a.key){for(const el of root.querySelectorAll('.rankCard,.testCard,.testMonitorCard,.manual-card,.actualTradeItemV2613,.manual-shadow-history-row,.abc-sample-row')){if(stableElementKeyV2617(el)===a.key){target=el;break}}}if(target){const delta=target.getBoundingClientRect().top-Number(a.top||0);if(Math.abs(delta)>8&&Math.abs(delta)<window.innerHeight*2.5)window.scrollBy({top:delta,left:0,behavior:'auto'})}}))}
function rankSignatureV2617(d){return JSON.stringify((d?.rows||[]).slice(0,16).map(x=>[x?.symbol,x?.direction,Math.round(Number(x?.rankScore||0)),Math.round(Number(x?.estimatedWinRate||0)*10),String(x?.profile?.purpose||'')]))}
function testSignatureV2617(d){return JSON.stringify((d?.rows||[]).slice(0,32).map(x=>[x?.key||x?.symbol,x?.status,Math.round(Number(x?.observationProgress||0)),x?.notificationTier,Math.round(Number(x?.monitorScore||0)),String(x?.strategyProfile?.id||x?.strategyAtConfirm?.id||'')]))}


// TV_RETURN_POSITION_V268: remember the exact viewport before opening TradingView.
// Mobile/PWA visibility refreshes can rerender cards after returning; re-pin the clicked row instead of jumping elsewhere.
const TV_RETURN_KEY_V268='position-alert-tv-return-v268';
let tvReturnTimersV268=[],tvReturnApplyingV268=false,tvReturnArmedV268=false;
function tvReturnReadV268(){try{return JSON.parse(sessionStorage.getItem(TV_RETURN_KEY_V268)||'null')}catch{return null}}
function tvReturnClearV268(){for(const t of tvReturnTimersV268)clearTimeout(t);tvReturnTimersV268=[];tvReturnArmedV268=false;try{sessionStorage.removeItem(TV_RETURN_KEY_V268)}catch{}}
function tvReturnCaptureV268(a){
  if(!a?.href||!String(a.href).includes('tradingview.com'))return;
  const card=a.closest('.rankCard,.testCard,.testMonitorCard,.actualTradeMonitorCard,.biasRow,.matrixCoin,.sg-candidate-card,.manual-card,.manual-shadow-history-row,.abc-sample-row,.actualTradeItemV2613'),symbol=String(a.dataset?.tvSymbol||a.textContent||'').toUpperCase().replace(/[^A-Z0-9]/g,''),page=document.querySelector('.pageTab.active')?.dataset?.page||'';
  const data={at:Date.now(),href:a.href,symbol,page,key:stableElementKeyV2617(card||a),top:a.getBoundingClientRect().top,cardTop:card?.getBoundingClientRect().top??null,scrollY:window.scrollY||document.documentElement.scrollTop||0};
  window.__tvReturnHoldUntilV2617=Date.now()+7000;try{history.scrollRestoration='manual'}catch{}try{sessionStorage.setItem(TV_RETURN_KEY_V268,JSON.stringify(data))}catch{}
}

function tvReturnApplyV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000){tvReturnClearV268();tvReturnBusyV2617=false;return false}
  const page=String(d.page||'').replace(/[^a-z0-9_-]/gi,'');if(page&&document.querySelector('.pageTab.active')?.dataset?.page!==page){try{setPage(page,{force:true})}catch{document.querySelector(`.pageTab[data-page="${page}"]`)?.click()}return false}
  const sym=String(d.symbol||''),candidates=[...document.querySelectorAll('.rankCard,.testCard,.testMonitorCard,.actualTradeMonitorCard,.biasRow,.matrixCoin,.sg-candidate-card,.manual-card,.manual-shadow-history-row,.abc-sample-row,.actualTradeItemV2613')].filter(x=>x.offsetParent!==null);let card=null;if(d.key)card=candidates.find(x=>stableElementKeyV2617(x)===d.key)||null;if(!card&&sym)card=candidates.find(x=>String(x.querySelector?.('[data-tv-symbol]')?.dataset?.tvSymbol||'').toUpperCase()===sym)||null;const link=card?.querySelector?.('[data-tv-symbol]')||[...document.querySelectorAll('[data-tv-symbol]')].find(x=>String(x.dataset?.tvSymbol||'').toUpperCase()===sym&&x.offsetParent!==null)||[...document.querySelectorAll('a[href]')].find(x=>x.href===d.href&&x.offsetParent!==null);
  let done=false;if(card&&Number.isFinite(Number(d.cardTop))){const delta=card.getBoundingClientRect().top-Number(d.cardTop);if(Math.abs(delta)<window.innerHeight*3){window.scrollBy({top:delta,left:0,behavior:'auto'});done=true}}if(!done&&link){const delta=link.getBoundingClientRect().top-Number(d.top||0);if(Math.abs(delta)<window.innerHeight*3){window.scrollBy({top:delta,left:0,behavior:'auto'});done=true}}if(!done)window.scrollTo({top:Number(d.scrollY||0),left:0,behavior:'auto'});return true
}

function tvReturnRestoreV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000||tvReturnBusyV2617)return;
  tvReturnBusyV2617=true;window.__tvReturnHoldUntilV2617=Date.now()+8000;markUiMotionV2617(8000);for(const t of tvReturnTimersV268)clearTimeout(t);tvReturnTimersV268=[];if(tvReturnSettleTimerV2617)clearTimeout(tvReturnSettleTimerV2617);document.documentElement.classList.add('tvReturnStableV2617');
  const started=Date.now(),deadline=started+4200;let lastH=-1,lastTop=null,stable=0,foundOnce=false;
  const finish=()=>{if(tvReturnSettleTimerV2617)clearTimeout(tvReturnSettleTimerV2617);tvReturnSettleTimerV2617=null;setTimeout(()=>{document.documentElement.classList.remove('tvReturnStableV2617');tvReturnBusyV2617=false;window.__tvReturnHoldUntilV2617=Date.now()+1600;try{sessionStorage.removeItem(TV_RETURN_KEY_V268)}catch{}},220)};
  const settle=()=>{const cur=tvReturnReadV268();if(!cur){finish();return}const page=String(cur.page||'').replace(/[^a-z0-9_-]/gi,'');if(page&&document.querySelector('.pageTab.active')?.dataset?.page!==page){try{setPage(page,{force:true})}catch{document.querySelector(`.pageTab[data-page="${page}"]`)?.click()}stable=0;tvReturnSettleTimerV2617=setTimeout(settle,100);return}
    const sym=String(cur.symbol||''),all=[...document.querySelectorAll('.rankCard,.testCard,.testMonitorCard,.actualTradeMonitorCard,.biasRow,.matrixCoin,.sg-candidate-card,.manual-card,.manual-shadow-history-row,.abc-sample-row,.actualTradeItemV2613')].filter(x=>x.offsetParent!==null);let card=cur.key?all.find(x=>stableElementKeyV2617(x)===cur.key)||null:null;if(!card&&sym)card=all.find(x=>String(x.querySelector?.('[data-tv-symbol]')?.dataset?.tvSymbol||'').toUpperCase()===sym)||null;const link=card?.querySelector?.('[data-tv-symbol]')||[...document.querySelectorAll('[data-tv-symbol]')].find(x=>String(x.dataset?.tvSymbol||'').toUpperCase()===sym&&x.offsetParent!==null)||null;
    const h=document.documentElement.scrollHeight,top=card?card.getBoundingClientRect().top:(link?link.getBoundingClientRect().top:null);if(card||link)foundOnce=true;if(foundOnce&&Math.abs(h-lastH)<=2&&top!=null&&lastTop!=null&&Math.abs(top-lastTop)<=1.5)stable++;else stable=0;lastH=h;lastTop=top;
    if((foundOnce&&stable>=2)||Date.now()>=deadline){tvReturnApplyV268();finish();return}tvReturnSettleTimerV2617=setTimeout(settle,100)};
  requestAnimationFrame(()=>requestAnimationFrame(settle));
}

document.addEventListener('click',e=>{const a=e.target?.closest?.('a[href]');if(a&&String(a.href||'').includes('tradingview.com'))tvReturnCaptureV268(a)},true);
for(const ev of ['pointerdown','touchstart','wheel'])document.addEventListener(ev,()=>{if(tvReturnArmedV268&&!tvReturnApplyingV268)tvReturnClearV268()},{passive:true,capture:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tvReturnRestoreV268()});
window.addEventListener('pageshow',()=>tvReturnRestoreV268());

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
const OBS_DISMISS_PREF_V2616='position-alert-observation-dismiss-v2616';
const OBS_STALE_MS_V2616=3*60*1000;
const OBS_DISMISS_MS_V2616=6*60*60*1000;
const SHADOW_NOTICE_SOURCE_PREF_V2616='position-alert-shadow-notice-source-v2616';
const SHADOW_NOTICE_MASTER_PREF_V2616='position-alert-shadow-notice-master-v2616';
const IDEA_FALLBACK_PREF_V2616='position-alert-idea-fallback-v2616';
function observationKeyV2616(x){return String(x?.key||[x?.symbol||'',x?.direction||''].join(':'))}
function observationUpdatedMsV2616(x){const raw=x?.lastEvaluatedAt||x?.updatedAt||x?.generatedAt||x?.createdAt||'';const ms=raw?Date.parse(raw):0;return Number.isFinite(ms)?ms:0}
function loadObservationDismissV2616(){try{const raw=JSON.parse(localStorage.getItem(OBS_DISMISS_PREF_V2616)||'{}'),now=Date.now(),out={};for(const [k,v] of Object.entries(raw&&typeof raw==='object'?raw:{})){const n=Number(v||0);if(n>now-24*60*60*1000)out[k]=n}if(JSON.stringify(raw)!==JSON.stringify(out))localStorage.setItem(OBS_DISMISS_PREF_V2616,JSON.stringify(out));return out}catch{return{}}}
function observationVisibleV2616(x){const at=observationUpdatedMsV2616(x),now=Date.now();if(!(at>0)||now-at>OBS_STALE_MS_V2616)return false;const closed=Number(loadObservationDismissV2616()[observationKeyV2616(x)]||0);return !(closed>0&&now-closed<OBS_DISMISS_MS_V2616)}
function dismissObservationV2616(key){if(!key)return;try{const d=loadObservationDismissV2616();d[String(key)]=Date.now();localStorage.setItem(OBS_DISMISS_PREF_V2616,JSON.stringify(d))}catch{}if(testSignalsState)renderTestSignals(testSignalsState)}
function loadShadowNoticeSourceV2616(){try{const v=String(localStorage.getItem(SHADOW_NOTICE_SOURCE_PREF_V2616)||'BOTH').toUpperCase();return ['MANUAL','AUTO','BOTH'].includes(v)?v:'BOTH'}catch{return'BOTH'}}
function loadShadowNoticeMasterV2616(){try{const v=localStorage.getItem(SHADOW_NOTICE_MASTER_PREF_V2616);return v===null?loadTestSignalNotify():v==='1'}catch{return loadTestSignalNotify()}}
async function applyShadowNoticeSourceV2616(source,enabled=true){source=['MANUAL','AUTO','BOTH'].includes(String(source||'').toUpperCase())?String(source).toUpperCase():'BOTH';enabled=enabled===true;try{localStorage.setItem(SHADOW_NOTICE_SOURCE_PREF_V2616,source);localStorage.setItem(SHADOW_NOTICE_MASTER_PREF_V2616,enabled?'1':'0')}catch{}saveTestSignalNotify(enabled&&(source==='AUTO'||source==='BOTH'));saveTestSignalNotifyMode('HIGH_NORMAL');const sub=await getPushSubscription().catch(()=>null);if(sub){await syncPreferences().catch(()=>{});await fetch('/api/manual-preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,enabled:enabled&&(source==='MANUAL'||source==='BOTH'),mode:'AB'})}).catch(()=>null)}try{window.dispatchEvent(new CustomEvent('shadow-notice-source:v2616',{detail:{source,enabled}}))}catch{}return{source,enabled}}
function saveIdeaFallbackV2616(d){try{if(d?.ok&&Array.isArray(d.rows)&&d.rows.length)localStorage.setItem(IDEA_FALLBACK_PREF_V2616,JSON.stringify({at:Date.now(),data:d}))}catch{}}
function loadIdeaFallbackV2616(){try{const x=JSON.parse(localStorage.getItem(IDEA_FALLBACK_PREF_V2616)||'null');return x&&Date.now()-Number(x.at||0)<60*60*1000?x.data:null}catch{return null}}
window.loadShadowNoticeSourceV2616=loadShadowNoticeSourceV2616;window.loadShadowNoticeMasterV2616=loadShadowNoticeMasterV2616;window.applyShadowNoticeSourceV2616=applyShadowNoticeSourceV2616;
if('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js?v=2616').then(r=>r.update()).catch(()=>{})}

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
function loadTestSignalNotifyMode(){try{const v=String(localStorage.getItem(TEST_SIGNAL_NOTIFY_MODE_PREF)||'HIGH_NORMAL').toUpperCase();return ['HIGH','HIGH_NORMAL'].includes(v)?v:'HIGH_NORMAL'}catch{return'HIGH_NORMAL'}}
function saveTestSignalNotifyMode(v){try{localStorage.setItem(TEST_SIGNAL_NOTIFY_MODE_PREF,['HIGH','HIGH_NORMAL'].includes(String(v))?String(v):'HIGH_NORMAL')}catch{}}
function loadTestEntryPlans(){return loadObject(TEST_ENTRY_PLAN_PREF,{})}
function saveTestEntryPlan(key,value){try{const all=loadTestEntryPlans();all[key]=value;localStorage.setItem(TEST_ENTRY_PLAN_PREF,JSON.stringify(all))}catch{}}
function loadDismissedTestJudgements(){return loadObject(TEST_JUDGE_DISMISS_PREF,{})}
function saveDismissedTestJudgements(v){try{localStorage.setItem(TEST_JUDGE_DISMISS_PREF,JSON.stringify(v||{}))}catch{}}
function testMonitorNoticeAt(x){return x?.lastEntryNotificationAt||x?.notificationSentAt||null}
function testMonitorNoticeMs(x){const raw=testMonitorNoticeAt(x);const ms=raw?Date.parse(raw):0;return Number.isFinite(ms)?ms:0}
function testMonitorNoticeTier(x){return String(x?.lastEntryNotificationTier||x?.confirmNotificationTier||x?.lastPushTier||'').toUpperCase()}
function testJudgeEventMs(x){const notice=testMonitorNoticeMs(x);if(notice>0)return notice;const raw=x?.eventAt||x?.stateChangedAt||x?.finishedAt||x?.confirmedAt||x?.updatedAt;const ms=raw?Date.parse(raw):0;return Number.isFinite(ms)?ms:0}
function isTestJudgementDismissed(x){if(!x?.key)return false;const v=Number(loadDismissedTestJudgements()[x.key]||0);return v>0&&testJudgeEventMs(x)<=v}
function clearTestJudgementDismiss(key){if(!key)return;const all=loadDismissedTestJudgements();if(Object.prototype.hasOwnProperty.call(all,key)){delete all[key];saveDismissedTestJudgements(all)}}
function dismissTestJudgement(key){if(!key)return;const x=testSignalByKey(key),all=loadDismissedTestJudgements();all[key]=Math.max(Date.now(),testJudgeEventMs(x));saveDismissedTestJudgements(all);testMonitorOpenKeys.delete(key);if(testFocusSymbol&&`${testFocusSymbol}:${testFocusDirection==='SHORT'?'SHORT':'LONG'}`===key){testFocusSymbol=null;testFocusDirection='LONG';try{history.replaceState(null,'',location.pathname)}catch{}}renderTestFocus()}
function restoreTestJudgement(key){if(!key)return;clearTestJudgementDismiss(key);testMonitorOpenKeys.add(key);const x=testSignalByKey(key);if(x){testFocusSymbol=x.symbol;testFocusDirection=x.direction==='SHORT'?'SHORT':'LONG'}renderTestFocus()}
function monitorHistoryDismissed(h){const key=String(h?.signalKey||'');if(!key)return false;const v=Number(loadDismissedTestJudgements()[key]||0),n=h?.notificationAt?Date.parse(h.notificationAt):0;return v>0&&Number.isFinite(n)&&n<=v}
function monitorHistoryRestorable(h){if(!monitorHistoryDismissed(h)||!h?.signalKey)return false;const x=testSignalByKey(h.signalKey);return !!x&&testIsMonitorQualified(x)}
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
function pushB64UrlV2665(buf){
  try{
    const a=new Uint8Array(buf||new ArrayBuffer(0));let raw='';
    for(const b of a)raw+=String.fromCharCode(b);
    return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }catch{return''}
}
function pushKeyMatchesV2665(sub,publicKey){
  try{
    const current=sub?.options?.applicationServerKey;
    if(!current)return true;
    return pushB64UrlV2665(current)===String(publicKey||'').replace(/=+$/,'');
  }catch{return true}
}
async function ensurePushReadyV2665({forceResubscribe=false,requestPermission=true}={}){
  if(!cfg)cfg=await fetch('/api/config',{cache:'no-cache'}).then(r=>r.json());
  if(!cfg?.vapidPublicKey)throw new Error('伺服器沒有 VAPID 推播金鑰');
  if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('此瀏覽器不支援 Web Push');

  const reg=await navigator.serviceWorker.register('/sw.js?v=2665',{scope:'/'});
  try{await reg.update()}catch{}

  let permission=Notification.permission;
  if(permission==='default'&&requestPermission)permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('瀏覽器通知權限不是允許');

  let sub=await reg.pushManager.getSubscription();
  const mismatch=sub&&!pushKeyMatchesV2665(sub,cfg.vapidPublicKey);
  if(sub&&(forceResubscribe||mismatch)){
    try{await sub.unsubscribe()}catch{}
    sub=null;
  }
  if(!sub){
    sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:b64ToUint8(cfg.vapidPublicKey)
    });
  }

  const r=await fetch('/api/subscribe',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({
      subscription:sub,
      enabledTraders:loadEnabledTraders(),
      enabledTypes:loadEnabledTypes(),
      consensusEnabled:loadConsensusEnabled(),
      dailyBriefEnabled:loadBriefNotify(),
      testSignalEnabled:loadTestSignalNotify(),
      testSignalNotifyMode:loadTestSignalNotifyMode(),
      dailyBriefIntervalHours:24,
      preferenceVersion:100
    })
  });
  if(!r.ok)throw new Error('訂閱同步失敗 '+r.status);
  try{localStorage.setItem('push-subscription',JSON.stringify(sub.toJSON?.()||sub))}catch{}
  return {reg,sub,mismatch,repaired:mismatch||forceResubscribe};
}
async function sendPushTestV2665(route){
  let ready=await ensurePushReadyV2665({requestPermission:true});
  const fire=async()=>fetch(route,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({endpoint:ready.sub.endpoint})
  }).then(async r=>({r,d:await r.json().catch(()=>({}))}));
  let out=await fire();
  if(!out.r.ok||Number(out.d?.sent||0)<1){
    ready=await ensurePushReadyV2665({forceResubscribe:true,requestPermission:true});
    out=await fire();
  }
  if(!out.r.ok||Number(out.d?.sent||0)<1){
    throw new Error((out.d?.error||'NO_PUSH_SENT')+'｜sent '+Number(out.d?.sent||0)+' / failed '+Number(out.d?.failed||0)+' / subscriptions '+Number(out.d?.subscriptions||0));
  }
  return out.d;
}
async function backgroundPushRepairV2665(){
  try{
    if(Notification.permission!=='granted'||!('serviceWorker'in navigator))return;
    const reg=await navigator.serviceWorker.getRegistration('/');
    const sub=await reg?.pushManager?.getSubscription();
    if(!sub)return;
    if(!cfg)cfg=await fetch('/api/config',{cache:'no-cache'}).then(r=>r.json());
    if(cfg?.vapidPublicKey&&!pushKeyMatchesV2665(sub,cfg.vapidPublicKey)){
      await ensurePushReadyV2665({forceResubscribe:true,requestPermission:false});
    }
  }catch(e){console.warn('[v2665-push] background repair',String(e?.message||e))}
}


function renderMaster(){const enabled=loadEnabledTraders();$('allToggle').checked=enabled.length===cfg.traders.length;$('allCount').textContent=`${enabled.length}/${cfg.traders.length}`}
function renderTypes(){const enabled=new Set(loadEnabledTypes());$('typeOptions').innerHTML=(cfg.eventTypes||DEFAULT_TYPES).filter(t=>['OPEN','ADD','REDUCE','CLOSE'].includes(t)).map(t=>`<label class="typeChoice"><input class="typeToggle" type="checkbox" data-type="${esc(t)}" ${enabled.has(t)?'checked':''}><span>${esc(typeLabel(t))}</span></label>`).join('');document.querySelectorAll('.typeToggle').forEach(el=>el.addEventListener('change',async()=>{const types=[...document.querySelectorAll('.typeToggle:checked')].map(x=>x.dataset.type);saveEnabledTypes(types);await syncPreferences().catch(()=>{});$('msg').textContent='✅ 通知類型已更新'}))}
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
function tvAnchor(symbol,cls='tvNameLink',label=''){const text=label||symbol;return `<a class="${esc(cls)}" href="${esc(tradingViewLink(symbol))}" target="_blank" rel="noopener noreferrer" data-tv-symbol="${esc(symbol)}" aria-label="在 TradingView 網頁版開啟 ${esc(symbol)}">${esc(text)}</a>`}
function openTradingViewApp(symbol){const url=tradingViewLink(symbol);if(!url)return false;const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.style.display='none';document.body.appendChild(a);a.click();a.remove();return false}
function pullbackRange(z){return z&&hasNum(z.low)&&hasNum(z.high)?`${price(z.low)}～${price(z.high)}`:'計算中'}
function pullbackLine(p){const x=p?.pullback;if(!x)return'';let text=x.label||'同步中',cls='syncing';if(x.status==='WAIT_EXACT_OPEN'){text='等待下一次精確建倉';cls='waiting'}else if(x.status==='PAUSED_API'){text='訂單API暫停 · 不發回踩通知';cls='paused'}else if(x.status==='SYNCING'){text='正在補齊進場結構與極值';cls='syncing'}else if(x.status==='WAIT_MOVE'){text=`等待先走出 ${hasNum(x.activationPct)?Number(x.activationPct).toFixed(2)+'%':'有效距離'}`;cls='waiting'}else if(x.status==='TRACKING'){text=`監控中 · 一般 ${pullbackRange(x.normal)} · 深度 ${pullbackRange(x.deep)}`;cls='active'}else if(x.status==='NORMAL_SENT'){text=`一般回踩已提醒 · 深度 ${pullbackRange(x.deep)}`;cls='normal'}else if(x.status==='DEEP_SENT'){text='深度回踩已提醒';cls='deep'}else if(x.status==='INVALID'){text='回踩過深／結構失效 · 不視為買點';cls='invalid'}const anchor=x.exactAnchor&&hasNum(x.firstEntryPrice)?`首倉 ${price(x.firstEntryPrice)} · `:'';return`<div class="pullbackLine ${cls}"><div class="pullbackCopy"><b>回踩</b><span>${esc(anchor+text)}</span></div><button type="button" data-position-calc>試算</button></div>`}
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
let calcEntryMode='suggested';
let calcRestoreEntry='';
function saveCalc(){const o={mode:$('calcMode')?.value||'MARGIN',margin:$('calcMargin')?.value||'',lev:$('calcLev')?.value||'',maxLoss:$('calcMaxLoss')?.value||'',position:$('calcPosition')?.value||'',entry:$('calcEntry')?.value||'',entryMode:calcEntryMode,tp:$('calcTp')?.value||'',sl:$('calcSl')?.value||'',useAutoTp:!!$('useAutoTp')?.checked,useAutoSl:!!$('useAutoSl')?.checked,open:$('tradeCalc')?.open||false};try{localStorage.setItem(CALC_PREF,JSON.stringify(o))}catch{}}
function loadCalc(){const d=loadObject(CALC_PREF,{});if($('calcMode'))$('calcMode').value=d.mode==='MAX_LOSS'?'MAX_LOSS':'MARGIN';if($('calcMargin'))$('calcMargin').value=d.margin||'';if($('calcLev'))$('calcLev').value=d.lev||'';if($('calcMaxLoss'))$('calcMaxLoss').value=d.maxLoss||'';if($('calcTp'))$('calcTp').value=d.tp||'';if($('calcSl'))$('calcSl').value=d.sl||'';if($('useAutoTp'))$('useAutoTp').checked=!!d.useAutoTp;if($('useAutoSl'))$('useAutoSl').checked=!!d.useAutoSl;if($('tradeCalc'))$('tradeCalc').open=!!d.open;calcEntryMode=['suggested','notify','current','manual'].includes(d.entryMode)?d.entryMode:'suggested';calcRestoreEntry=d.entry||'';if($('calcEntry')&&calcRestoreEntry)$('calcEntry').value=calcRestoreEntry;if($('calcPosition')){$('calcPosition').dataset.saved=d.position||'';$('calcPosition').dataset.restoreCalc='1'}setCalcModeUI();updateCalc()}
function calcPositionKey(traderId,p){return `${traderId}|${p.symbol}|${p.side}`}
function monitoredPositions(status){const out=[];for(const t of status?.traders||[]){for(const p of newestPositions(t.positions)){if(!p?.symbol||!p?.side||!(Number(p.entryPrice)>0))continue;out.push({key:calcPositionKey(t.id,p),source:'TRADER',traderId:t.id,traderName:t.name,symbol:p.symbol,side:p.side,direction:p.direction||(p.side==='SHORT'?'做空':'做多'),entryPrice:Number(p.entryPrice),suggestedPrice:Number(p.entryPrice),notifyPrice:Number(p.entryPrice),currentPrice:Number(p.markPrice)||null,stop:null,target:null,zoneLow:null,zoneHigh:null,rank:null,winRate:null,state:'實際持倉'})}}return out}
function calcSignalCandidates(){if(!testSignalsState)return[];return (testSignalsState.rows||[]).filter(x=>x.notificationSentAt&&!testIsReachedWaiting(x)&&!['DROPPED','EXPIRED'].includes(x.status)).sort((a,b)=>Number(b.priorityScore||0)-Number(a.priorityScore||0)).slice(0,8).map(x=>{const z=testPreferredZone(x),suggested=z?(z.low+z.high)/2:Number(x.reentryEntryPrice||x.confirmationPrice||x.currentPrice||0),re=testIsReentryReady(x);return {key:`TEST|${x.key}`,source:'TEST',traderName:'策略判讀',symbol:x.symbol,side:x.direction==='SHORT'?'SHORT':'LONG',direction:x.direction==='SHORT'?'做空':'做多',entryPrice:suggested||Number(x.currentPrice)||0,suggestedPrice:suggested||null,notifyPrice:Number(re?x.reentryEntryPrice:x.confirmationPrice)||null,currentPrice:Number(x.currentPrice)||null,stop:Number(re?x.reentryStop:(x.structureProtection||x.stop))||null,target:Number(re?x.reentryTarget1R:x.target1R)||null,zoneLow:z?.low??null,zoneHigh:z?.high??null,rank:Number(x.rank||0)||null,winRate:testEffectiveWinRate(x),state:x.monitorLabel||x.statusLabel||'判讀',tier:testTierLabel(x)}})}
function calcOptionHtml(x){return `<option value="${esc(x.key)}" data-source="${esc(x.source)}" data-symbol="${esc(x.symbol)}" data-side="${esc(x.side)}" data-entry="${esc(x.entryPrice)}" data-suggested="${esc(x.suggestedPrice??'')}" data-notify="${esc(x.notifyPrice??'')}" data-current="${esc(x.currentPrice??'')}" data-stop="${esc(x.stop??'')}" data-target="${esc(x.target??'')}" data-zone-low="${esc(x.zoneLow??'')}" data-zone-high="${esc(x.zoneHigh??'')}" data-rank="${esc(x.rank??'')}" data-win="${esc(x.winRate??'')}" data-state="${esc(x.state||'')}" data-tier="${esc(x.tier||'')}">${esc(x.source==='TEST'?`策略判讀｜${x.symbol}｜${x.direction}｜${x.state}`:`${x.traderName}｜${x.symbol}｜${x.direction}｜進場 ${price(x.entryPrice)}`)}</option>`}
function renderCalcPositions(status){const sel=$('calcPosition');if(!sel)return;const tests=calcSignalCandidates(),traders=monitoredPositions(status),all=[...tests,...traders],old=sel.value||sel.dataset.saved||'';let html='<option value="">請選擇監控標的</option>';if(tests.length)html+=`<optgroup label="策略判讀">${tests.map(calcOptionHtml).join('')}</optgroup>`;if(traders.length)html+=`<optgroup label="交易員實際持倉">${traders.map(calcOptionHtml).join('')}</optgroup>`;sel.innerHTML=all.length?html:'<option value="">目前沒有可試算標的</option>';if(old&&all.some(x=>x.key===old))sel.value=old;else if(all.length===1)sel.value=all[0].key;sel.dataset.saved='';applyCalcPosition(false,false)}
function clearCalcReference(){calcRef={key:'',data:null,fetchedAt:0,busy:false};$('autoTpRange').textContent='—';$('autoSlRange').textContent='—';$('autoTpPct').textContent='等待抓取';$('autoSlPct').textContent='等待抓取';$('autoTpSuggested').textContent='—';$('autoSlSuggested').textContent='—';$('autoNote').textContent='選標的後會自動套用回踩結構；若無訊號資料才抓 Binance 15分參考。'}
function setCalcModeUI(){const maxMode=$('calcMode')?.value==='MAX_LOSS';$('calcMargin').readOnly=maxMode;$('calcMaxLoss').disabled=!maxMode;$('calcMarginResultLabel').textContent=maxMode?'建議保證金':'使用保證金';if(maxMode){$('calcMargin').placeholder='自動反推'}else{$('calcMargin').placeholder='300'}updateCalc()}
function rangeText(a,b){const x=Number(a),y=Number(b);if(!Number.isFinite(x)||!Number.isFinite(y))return'—';return`${price(Math.min(x,y))} ～ ${price(Math.max(x,y))}`}
function rangePctText(side,entry,a,b,favorable){const p1=calcMovePct(side,entry,Number(a),favorable),p2=calcMovePct(side,entry,Number(b),favorable);if(!Number.isFinite(p1)||!Number.isFinite(p2))return'—';const lo=Math.min(p1,p2),hi=Math.max(p1,p2);return`${lo.toFixed(2)}% ～ ${hi.toFixed(2)}%`}
function renderCalcReference(){const d=calcRef.data,side=$('calcSide').value,entry=calcNum('calcEntry');if(!d){return}$('autoTpRange').textContent=rangeText(d.tp?.low,d.tp?.high);$('autoSlRange').textContent=rangeText(d.sl?.low,d.sl?.high);$('autoTpPct').textContent=`價格潛在 +${rangePctText(side,entry,d.tp?.low,d.tp?.high,true)}`;$('autoSlPct').textContent=`價格風險 -${rangePctText(side,entry,d.sl?.low,d.sl?.high,false)}`;$('autoTpSuggested').textContent=calcPriceText(d.tp?.suggested);$('autoSlSuggested').textContent=calcPriceText(d.sl?.suggested);$('autoNote').textContent=d.note||`ATR14 ${price(d.atr)} · 結構與 1.5R～2.2R 參考`;if($('useAutoTp').checked&&Number(d.tp?.suggested)>0)$('calcTp').value=d.tp.suggested;if($('useAutoSl').checked&&Number(d.sl?.suggested)>0)$('calcSl').value=d.sl.suggested;updateCalc()}
async function loadReferenceLevels(force=false){const symbol=$('calcSymbol').value.trim().toUpperCase(),side=$('calcSide').value,entry=calcNum('calcEntry');if(!symbol||symbol==='—'||!(entry>0))return;const key=`${symbol}|${side}|${entry}`;if(calcRef.busy)return;if(!force&&calcRef.key===key&&calcRef.data&&Date.now()-calcRef.fetchedAt<60_000){renderCalcReference();return}calcRef.busy=true;$('autoRefresh').disabled=true;$('autoTpPct').textContent='抓取中…';$('autoSlPct').textContent='抓取中…';$('autoNote').textContent='正在讀取 Binance 15分結構…';try{const r=await fetch(`/api/reference-levels?symbol=${encodeURIComponent(symbol)}&side=${encodeURIComponent(side)}&entry=${encodeURIComponent(entry)}`,{cache:'no-cache'});if(!r.ok)throw new Error(`HTTP ${r.status}`);const d=await r.json();if(!d?.ok)throw new Error(d?.error||'NO_LEVELS');calcRef={key,data:d,fetchedAt:Date.now(),busy:false};renderCalcReference()}catch(e){calcRef={key:'',data:null,fetchedAt:0,busy:false};$('autoTpRange').textContent='—';$('autoSlRange').textContent='—';$('autoTpPct').textContent='暫時無法抓取';$('autoSlPct').textContent='可直接手動輸入';$('autoNote').textContent='參考區間暫時不可用，不影響手動試算。'}finally{$('autoRefresh').disabled=false;calcRef.busy=false}}
function calcSelectedOption(){return $('calcPosition')?.selectedOptions?.[0]||null}
function renderCalcSignalContext(opt){const box=$('calcSignalContext');if(!box)return;if(!opt?.dataset?.symbol){box.innerHTML='<span>選擇標的後顯示通知點位、當下價與建議進場。</span>';return}const source=opt.dataset.source==='TEST',rank=opt.dataset.rank,win=Number(opt.dataset.win),zoneLow=Number(opt.dataset.zoneLow),zoneHigh=Number(opt.dataset.zoneHigh),zone=Number.isFinite(zoneLow)&&Number.isFinite(zoneHigh)?`${price(zoneLow)}～${price(zoneHigh)}`:'—';box.innerHTML=`<div><span>來源</span><b>${source?'策略判讀':'交易員持倉'}</b></div><div><span>狀態</span><b>${esc(opt.dataset.state||'—')}${opt.dataset.tier?` · ${esc(opt.dataset.tier)}`:''}</b></div><div><span>排名 / 勝率</span><b>${rank?`#${esc(rank)}`:'—'} / ${Number.isFinite(win)?win.toFixed(1)+'%':'—'}</b></div><div class="wide"><span>建議區</span><b>${zone}</b></div>`}
function setCalcEntryFrom(kind){const opt=calcSelectedOption();if(!opt||!['suggested','notify','current'].includes(kind))return;const value=Number(opt.dataset[kind]);if(!(value>0))return;calcEntryMode=kind;$('calcEntry').value=value;clearCalcReference();updateCalc();if(opt.dataset.source==='TEST')applySignalCalcReference(opt);else void loadReferenceLevels(false);saveCalc()}
function applySignalCalcReference(opt){const target=Number(opt?.dataset?.target),stop=Number(opt?.dataset?.stop),entry=calcNum('calcEntry'),zl=Number(opt?.dataset?.zoneLow),zh=Number(opt?.dataset?.zoneHigh);if(!(entry>0)||!(target>0)||!(stop>0)){void loadReferenceLevels(false);return}const zoneText=Number.isFinite(zl)&&Number.isFinite(zh)?`${price(Math.min(zl,zh))}～${price(Math.max(zl,zh))}`:'—';calcRef={key:`TEST|${opt.value}|${entry}`,data:{ok:true,tp:{low:target,high:target,suggested:target},sl:{low:stop,high:stop,suggested:stop},note:`策略判讀結構：建議區 ${zoneText} · 1R / 結構保護位；預計進場可切換建議價、通知價或當下價。`},fetchedAt:Date.now(),busy:false};renderCalcReference()}
function applyCalcPosition(scroll=true,fetchLevels=true){const sel=$('calcPosition'),opt=calcSelectedOption(),symbol=opt?.dataset?.symbol||'',side=opt?.dataset?.side||'',newKey=sel?.value||'',oldKey=sel?.dataset?.appliedKey||'',restoring=sel?.dataset?.restoreCalc==='1';$('calcSymbol').value=symbol||'—';$('calcSide').value=side==='SHORT'?'SHORT':'LONG';$('calcSideLabel').value=symbol?(side==='SHORT'?'做空':'做多'):'—';renderCalcSignalContext(opt);if(newKey!==oldKey){sel.dataset.appliedKey=newKey;clearCalcReference();if(!restoring){calcEntryMode='suggested';calcRestoreEntry='';if(symbol){$('calcTp').value='';$('calcSl').value='';$('useAutoTp').checked=false;$('useAutoSl').checked=false}}}
  let nextEntry=null;if(restoring&&calcEntryMode==='manual'&&Number(calcRestoreEntry)>0)nextEntry=Number(calcRestoreEntry);else if(calcEntryMode==='current')nextEntry=Number(opt?.dataset?.current);else if(calcEntryMode==='notify')nextEntry=Number(opt?.dataset?.notify);else if(calcEntryMode==='manual')nextEntry=calcNum('calcEntry');else nextEntry=Number(opt?.dataset?.suggested||opt?.dataset?.entry);if(!(nextEntry>0))nextEntry=calcNum('calcEntry')||Number(opt?.dataset?.suggested||opt?.dataset?.entry)||null;if(nextEntry>0)$('calcEntry').value=nextEntry;else if(!symbol)$('calcEntry').value='';if(sel)sel.dataset.restoreCalc='0';calcRestoreEntry='';updateCalc();if(symbol){const modeText=({suggested:'建議價',notify:'通知價',current:'當下價',manual:'手動價'})[calcEntryMode]||'建議價';$('calcMsg').innerHTML=`<span class="calcSelected">已選 ${esc(opt.textContent||'')}</span> · 目前使用 ${modeText}`;if(scroll)$('tradeCalc').scrollIntoView({behavior:'smooth',block:'center'});if(fetchLevels){if(opt.dataset.source==='TEST')applySignalCalcReference(opt);else void loadReferenceLevels(false)}}saveCalc()}
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
      const cr=await fetch('/api/config',{cache:'no-cache'});
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

    const sr=await fetch('/api/status',{cache:'no-cache'});
    if(!sr.ok)throw new Error(`status ${sr.status}`);
    const s=await sr.json();

    lastStatus=s;
    const ok=s.healthy>0;
    $('status').textContent=ok?`交易員 ${s.healthy}/${s.total}`:'連線異常';
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
$('subscribe').onclick=async()=>{try{const x=await ensurePushReadyV2665({requestPermission:true});$('msg').textContent=x.repaired?'✅ 推播訂閱已修復並重新同步':'✅ iPhone 通知已同步'}catch(e){$('msg').textContent='❌ '+e.message}};
$('test').onclick=async()=>{try{const d=await sendPushTestV2665('/api/test-push');$('msg').textContent='✅ 測試通知真正送出 · sent '+d.sent}catch(e){$('msg').textContent='❌ 測試失敗：'+e.message}};
$('testPullback').onclick=async()=>{try{const d=await sendPushTestV2665('/api/test-pullback-push');$('msg').textContent='✅ 策略測試真正送出 · sent '+d.sent}catch(e){$('msg').textContent='❌ 策略測試失敗：'+e.message}};

['calcMargin','calcLev','calcMaxLoss','calcEntry'].forEach(id=>$(id)?.addEventListener('input',()=>{if(id==='calcEntry'){calcEntryMode='manual';clearCalcReference()}updateCalc()}));
$('calcMode')?.addEventListener('change',()=>{setCalcModeUI();saveCalc()});
$('calcTp')?.addEventListener('input',()=>{if(document.activeElement===$('calcTp'))$('useAutoTp').checked=false;updateCalc()});
$('calcSl')?.addEventListener('input',()=>{if(document.activeElement===$('calcSl'))$('useAutoSl').checked=false;updateCalc()});
$('useAutoTp')?.addEventListener('change',()=>applyAutoChoice('TP'));$('useAutoSl')?.addEventListener('change',()=>applyAutoChoice('SL'));
$('autoRefresh')?.addEventListener('click',()=>{const opt=calcSelectedOption();if(opt?.dataset?.source==='TEST')applySignalCalcReference(opt);else loadReferenceLevels(true)});
$('calcUseSuggested')?.addEventListener('click',()=>setCalcEntryFrom('suggested'));$('calcUseNotify')?.addEventListener('click',()=>setCalcEntryFrom('notify'));$('calcUseCurrent')?.addEventListener('click',()=>setCalcEntryFrom('current'));
$('calcPosition')?.addEventListener('change',()=>applyCalcPosition(false,true));$('tradeCalc')?.addEventListener('toggle',saveCalc);loadCalc();

let actualTradeContext=null,actualTradeLiveTimer=null;
function actualFieldNum(id){const v=$(id)?.value;return v===''||v==null?null:Number(v)}
function actualDirectionSign(){return actualTradeContext?.direction==='SHORT'?-1:1}
function actualPnlAt(level){const entry=actualFieldNum('actualEntry'),exit=actualFieldNum(level),qty=actualFieldNum('actualQty'),margin=actualFieldNum('actualMargin'),lev=actualFieldNum('actualLeverage');if(!(entry>0&&exit>0))return null;const notional=qty>0?qty*entry:(margin>0&&lev>0?margin*lev:null);if(!(notional>0))return null;return actualDirectionSign()*(exit-entry)/entry*notional}
function actualPnlText(v){if(!Number.isFinite(Number(v)))return'—';const n=Number(v);return`${n>0?'+':''}${n.toFixed(2)} U`}
function actualTradeRecalc(){if(!$('actualTradeCalc'))return;const entry=actualFieldNum('actualEntry'),qty=actualFieldNum('actualQty'),margin=actualFieldNum('actualMargin'),lev=actualFieldNum('actualLeverage'),notional=entry>0&&qty>0?entry*qty:(margin>0&&lev>0?margin*lev:null),impliedQty=notional>0&&entry>0?notional/entry:null,tp1=actualPnlAt('actualTp1'),tp2=actualPnlAt('actualTp2'),sp1=actualPnlAt('actualSp1'),sp2=actualPnlAt('actualSp2');$('actualTradeCalc').innerHTML=`<div><span>名義倉位</span><b class="gold">${notional>0?notional.toFixed(2)+' U':'—'}</b></div><div><span>推算數量</span><b>${impliedQty>0?impliedQty.toLocaleString('en-US',{maximumFractionDigits:8}):'—'}</b></div><div><span>TP1 預估</span><b class="good">${actualPnlText(tp1)}</b></div><div><span>TP2 預估</span><b class="good">${actualPnlText(tp2)}</b></div><div><span>SP1 預估虧損</span><b class="bad">${actualPnlText(sp1)}</b></div><div><span>SP2 預估虧損</span><b class="bad">${actualPnlText(sp2)}</b></div>`}
function actualTradeClose(){const m=$('actualTradeModal');if(!m)return;if(actualTradeLiveTimer){clearInterval(actualTradeLiveTimer);actualTradeLiveTimer=null}m.classList.remove('show');m.setAttribute('aria-hidden','true');document.body.classList.remove('actualTradeOpen');actualTradeContext=null}
function actualDefaultTarget2(x,entry,stop){const raw=Number(x?.target15R);if(Number.isFinite(raw)&&raw>0)return raw;if(!(entry>0&&stop>0))return null;const risk=Math.abs(entry-stop),sign=x?.direction==='SHORT'?-1:1;return entry+sign*risk*1.5}
function actualTradeStartLiveTimer(){if(actualTradeLiveTimer){clearInterval(actualTradeLiveTimer);actualTradeLiveTimer=null}actualTradeLiveTimer=setInterval(()=>{if(!actualTradeContext)return;const live=actualTradeContext.key?testSignalByKey(actualTradeContext.key):null,px=Number(live?.currentPrice||actualTradeContext.x?.currentPrice||actualTradeContext.record?.lastPrice||0);if(px>0){$('actualTradeLivePrice').textContent=price(px);$('actualTradeLiveAge').textContent=live?`更新 ${localTime(live?.lastPriceAt||live?.updatedAt)||'即時'}`:actualTradeContext.x?'已離開目前榜單 · 保留開啟時資料':'實倉追蹤最新價'}},2000)}
function actualTradeShow(){const m=$('actualTradeModal');m.classList.add('show');m.setAttribute('aria-hidden','false');document.body.classList.add('actualTradeOpen');actualTradeStartLiveTimer();setTimeout(()=>$('actualEntry')?.focus(),80)}
function openActualTradeModal(key){const x=testSignalByKey(key);if(!x)return;const entry=Number(x.currentPrice||x.lastEntryNotificationPrice||x.confirmationPrice||0),dir=x.direction==='SHORT'?'SHORT':'LONG',rawSp1=Number(x.lastEntryNotificationStop||x.structureProtection||x.stop||0),sp1=entry>0&&rawSp1>0&&chartLevelOnCorrectSide(dir,entry,rawSp1,'STOP')?rawSp1:null,rawTp1=Number(x.lastEntryNotificationTarget||x.target1R||0),tp1=entry>0&&rawTp1>0&&chartLevelOnCorrectSide(dir,entry,rawTp1,'TARGET')?rawTp1:null,rawTp2=actualDefaultTarget2(x,entry,sp1),tp2=entry>0&&rawTp2>0&&chartLevelOnCorrectSide(dir,entry,rawTp2,'TARGET')?rawTp2:null,cfg=loadPerfSim();actualTradeContext={key:x.key,symbol:x.symbol,direction:x.direction==='SHORT'?'SHORT':'LONG',strategyId:x.entryStrategy?.id||x.strategyProfile?.id||x.strategyAtConfirm?.id||'',strategyLabel:x.entryStrategy?.label||x.strategyProfile?.label||x.strategyAtConfirm?.label||'',marketRegime:x.marketRegime||x.lastCheck?.marketRegime||'',notificationTier:testMonitorNoticeTier(x)||x.notificationTier||'',notificationId:x.lastEntryNotificationId||null,x,recordId:null,record:null};$('actualTradeTitle').textContent=`實際建倉 · ${x.symbol}`;$('actualTradeMeta').textContent=`${actualTradeContext.direction==='SHORT'?'做空':'做多'} · ${actualTradeContext.strategyLabel||'策略判讀'} · ${actualTradeContext.notificationTier||'—'}`;$('actualEntry').value=entry>0?String(entry):'';$('actualTp1').value=tp1>0?String(tp1):'';$('actualTp2').value=tp2>0?String(tp2):'';$('actualSp1').value=sp1>0?String(sp1):'';$('actualSp2').value='';$('actualMargin').value=String(cfg.margin||300);$('actualQty').value='';$('actualLeverage').value=String(cfg.leverage||20);$('actualTradeMsg').textContent='這筆建倉表已固定；即使標的離開觀察／B級，仍可填完並儲存。';$('actualTradeMsg').className='actualTradeMsg';$('actualTradeLivePrice').textContent=entry>0?price(entry):'—';$('actualTradeLiveAge').textContent='以目前監控價帶入';actualTradeRecalc();actualTradeShow()}
function openActualTradeRecordModal(rec){if(!rec)return;const x=rec.signalKey?testSignalByKey(rec.signalKey):null;actualTradeContext={key:rec.signalKey||'',symbol:rec.symbol,direction:rec.direction==='SHORT'?'SHORT':'LONG',strategyId:rec.strategyId||'',strategyLabel:rec.strategyLabel||'',marketRegime:rec.marketRegime||'',notificationTier:rec.notificationTier||'',notificationId:rec.notificationId||null,x,recordId:rec.id,record:rec,signalSnapshot:rec.signalSnapshot||null};$('actualTradeTitle').textContent=`修改實際建倉 · ${rec.symbol}`;$('actualTradeMeta').textContent=`${actualTradeContext.direction==='SHORT'?'做空':'做多'} · ${actualTradeContext.strategyLabel||'策略判讀'} · 已儲存設定`;$('actualEntry').value=rec.entryPrice??'';$('actualTp1').value=rec.tp1??'';$('actualTp2').value=rec.tp2??'';$('actualSp1').value=rec.sp1??'';$('actualSp2').value=rec.sp2??'';$('actualMargin').value=rec.margin??'';$('actualQty').value=rec.quantity??'';$('actualLeverage').value=rec.leverage??'';$('actualTradeMsg').textContent=rec.firstOutcome?'此筆已發生 TP/SP first-touch，為保留績效稽核，點位不可再改。':'修改後會保留修訂紀錄，並從儲存後的新點位繼續追蹤。';$('actualTradeMsg').className=rec.firstOutcome?'actualTradeMsg error':'actualTradeMsg';$('actualTradeLivePrice').textContent=hasNum(rec.lastPrice)?price(rec.lastPrice):price(rec.entryPrice);$('actualTradeLiveAge').textContent='實倉追蹤最新價';actualTradeRecalc();actualTradeShow()}
async function openMonitorHistoryActualTrade(historyId){const h=(testSignalsState?.monitorHistory||[]).find(x=>x.id===historyId);if(!h)return;const embedded=h.actualTrade;if(embedded){if(embedded.status!=='ACTIVE'){alert('這筆實際建倉已結案，保留原始紀錄不再修改。');return}openActualTradeRecordModal(embedded);return}try{const r=await fetch('/api/actual-trades',{cache:'no-cache'}),d=await r.json();if(r.ok&&d?.ok){const rec=(d.records||[]).find(x=>(h.id&&x.notificationId===h.id)||(h.signalKey&&x.signalKey===h.signalKey));if(rec){if(rec.status!=='ACTIVE'){alert('這筆實際建倉已結案，保留原始紀錄不再修改。');return}openActualTradeRecordModal(rec);return}}}catch{}if(h.signalKey&&testSignalByKey(h.signalKey)){openActualTradeModal(h.signalKey);return}alert('找不到可修改的實際建倉；此通知已離開即時監控。')}
async function saveActualTrade(){if(!actualTradeContext)return;const x=actualTradeContext.x,signalSnapshot=x?{calibratedWinRate:testEffectiveWinRate(x),monitorScore:x.monitorScore,notificationScore:x.notificationScore,observationProgress:x.observationProgress,rank:x.rank,oi15mChangePct:x.lastCheck?.oi15mChangePct,takerRatio:x.lastCheck?.takerRatio,depthImbalance:x.lastCheck?.depthImbalance,topPositionRatio:x.lastCheck?.topPositionRatio,marketAlign:x.lastCheck?.marketAlign}:(actualTradeContext.signalSnapshot||null),body={signalKey:actualTradeContext.key,notificationId:actualTradeContext.notificationId,symbol:actualTradeContext.symbol,direction:actualTradeContext.direction,strategyId:actualTradeContext.strategyId,strategyLabel:actualTradeContext.strategyLabel,marketRegime:actualTradeContext.marketRegime,notificationTier:actualTradeContext.notificationTier,entryPrice:actualFieldNum('actualEntry'),tp1:actualFieldNum('actualTp1'),tp2:actualFieldNum('actualTp2'),sp1:actualFieldNum('actualSp1'),sp2:actualFieldNum('actualSp2'),margin:actualFieldNum('actualMargin'),quantity:actualFieldNum('actualQty'),leverage:actualFieldNum('actualLeverage'),signalSnapshot};const msg=$('actualTradeMsg');msg.textContent=actualTradeContext.recordId?'更新中…':'儲存中…';msg.className='actualTradeMsg';try{const editing=Boolean(actualTradeContext.recordId),url=editing?`/api/actual-trades/${encodeURIComponent(actualTradeContext.recordId)}`:'/api/actual-trades',payload=editing?{action:'update',...body}:body,r=await fetch(url,{method:editing?'PATCH':'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);msg.textContent=editing?'✅ 已更新實際建倉設定，修訂紀錄已保留。':'✅ 已建立實際建倉，後端開始即時追蹤 TP / SP。';performanceState=null;setTimeout(()=>{actualTradeClose();void refreshPerformance(true);void refreshTestSignals(true)},650)}catch(e){msg.textContent=`❌ ${e.message}`;msg.className='actualTradeMsg error'}}
['actualEntry','actualTp1','actualTp2','actualSp1','actualSp2','actualMargin','actualQty','actualLeverage'].forEach(id=>$(id)?.addEventListener('input',actualTradeRecalc));$('actualTradeClose')?.addEventListener('click',actualTradeClose);$('actualTradeCancel')?.addEventListener('click',actualTradeClose);$('actualTradeSave')?.addEventListener('click',saveActualTrade);$('actualTradeModal')?.addEventListener('click',e=>{if(e.target===$('actualTradeModal'))actualTradeClose()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('actualTradeModal')?.classList.contains('show'))actualTradeClose()});

async function closeActualTrackedTrade(id){if(!id)return;if(!confirm('用目前 Binance 價格結束這筆實際建倉追蹤？'))return;try{const r=await fetch(`/api/actual-trades/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'close'})}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);performanceState=null;void refreshPerformance(true)}catch(e){alert(`結束失敗：${e.message}`)}}

document.addEventListener('click',e=>{const histEdit=e.target.closest('[data-monitor-history-edit]');if(histEdit){e.preventDefault();e.stopPropagation();void openMonitorHistoryActualTrade(histEdit.dataset.monitorHistoryEdit);return}const histRestore=e.target.closest('[data-monitor-history-restore]');if(histRestore){e.preventDefault();e.stopPropagation();restoreTestJudgement(histRestore.dataset.monitorHistoryRestore);return}const actualClose=e.target.closest('[data-actual-close]');if(actualClose){e.preventDefault();e.stopPropagation();void closeActualTrackedTrade(actualClose.dataset.actualClose);return}const actual=e.target.closest('[data-actual-trade]');if(actual){e.preventDefault();e.stopPropagation();openActualTradeModal(actual.dataset.actualTrade);return}const latestDismiss=e.target.closest('[data-latest-dismiss]');if(latestDismiss){e.preventDefault();e.stopPropagation();dismissLatestNotice();return}const biasButton=e.target.closest('[data-bias-key]');if(biasButton){todayBiasKey=biasButton.dataset.biasKey;if(marketFlowState?.today)renderToday(marketFlowState);return}const monitor=e.target.closest('[data-test-monitor]');if(monitor){goTestSignalToMonitor(monitor.dataset.testMonitor,monitor.dataset.testDir);return}const dismiss=e.target.closest('[data-test-dismiss]');if(dismiss){e.preventDefault();e.stopPropagation();dismissTestJudgement(dismiss.dataset.testDismiss);return}const expand=e.target.closest('[data-test-expand-all]');if(expand){setAllTestJudgements(true);return}const collapse=e.target.closest('[data-test-collapse-all]');if(collapse){setAllTestJudgements(false);return}const collapseOne=e.target.closest('[data-test-collapse-one]');if(collapseOne){const d=collapseOne.closest('details[data-test-judge]');if(d){d.open=false;testMonitorOpenKeys.delete(d.dataset.testJudge)}return}const close=e.target.closest('[data-test-focus-close]');if(close){testFocusSymbol=null;testFocusDirection='LONG';try{history.replaceState(null,'',location.pathname)}catch{}renderTestFocus();return}});

let systemChart=null,systemCandleSeries=null,systemChartResize=null,systemChartSymbol='',systemChartInterval='15m',systemChartContext=null,systemChartRequest=0;
function chartFinite(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
function chartBestSignal(symbol){const rows=(testSignalsState?.rows||[]).filter(x=>x?.symbol===symbol&&!['DROPPED','EXPIRED'].includes(x.status));if(!rows.length)return null;return [...rows].sort((a,b)=>Number(Boolean(b.notificationSentAt))-Number(Boolean(a.notificationSentAt))||Number(b.priorityScore||0)-Number(a.priorityScore||0)||Number(a.observationRank||999)-Number(b.observationRank||999))[0]}
function chartLevelOnCorrectSide(dir,entry,value,kind){if(!(entry>0&&value>0))return false;return kind==='STOP'?(dir==='SHORT'?value>entry:value<entry):(dir==='SHORT'?value<entry:value>entry)}
async function chartResolveContext(symbol){let x=chartBestSignal(symbol);if(!x){try{const r=await fetch('/api/test-signals',{cache:'no-cache'}),d=await r.json();if(r.ok&&d?.ok){testSignalsState=d;x=chartBestSignal(symbol)}}catch{}}if(x){
    const dir=x.direction==='SHORT'?'SHORT':'LONG',sign=dir==='SHORT'?-1:1,reentryActive=Boolean(x.targetReachedAt)&&!['WIN','FAILED'].includes(String(x.reentryStage||''));
    const rzLow=chartFinite(x.reentryZoneLow),rzHigh=chartFinite(x.reentryZoneHigh),reentryZone=rzLow&&rzHigh?{low:Math.min(rzLow,rzHigh),high:Math.max(rzLow,rzHigh)}:null;
    const z=reentryActive?(reentryZone||null):(x.preferredEntryZone||x.entryZone||x.strategyProfile?.entryZone||null),zl=chartFinite(z?.low),zh=chartFinite(z?.high);
    const confirmedReentry=chartFinite(x.reentryEntryPrice),best=confirmedReentry&&reentryActive?confirmedReentry:(zl&&zh?(zl+zh)/2:(reentryActive?null:chartFinite(x.confirmationPrice||x.currentPrice)));
    const stopCandidates=reentryActive?[x.reentryStop,x.reentryInvalidation]:[x.structureProtection,x.stop,x.strategyProfile?.invalidation];let stop=null;
    for(const candidate of stopCandidates){const v=chartFinite(candidate);if(v&&best&&chartLevelOnCorrectSide(dir,best,v,'STOP')){stop=v;break}}
    const risk=best&&stop?Math.abs(best-stop):null,rawTp1=chartFinite(reentryActive?x.reentryTarget1R:x.target1R),rawTp2=chartFinite(reentryActive?null:x.target15R);
    const tp1=rawTp1&&best&&chartLevelOnCorrectSide(dir,best,rawTp1,'TARGET')?rawTp1:(best&&risk?best+sign*risk:null);
    let tp2=rawTp2&&best&&chartLevelOnCorrectSide(dir,best,rawTp2,'TARGET')?rawTp2:(best&&risk?best+sign*risk*1.5:null);
    if(tp1&&tp2){const farther=dir==='SHORT'?tp2<tp1:tp2>tp1;if(!farther)tp2=best&&risk?best+sign*risk*1.5:null}
    const status=reentryActive?(x.reentryStage==='READY'?'二次確認':x.reentryStage==='TOUCHING'?'二次回踩':'等待二次回踩'):(x.monitorLabel||x.statusLabel||'觀察中');
    return {symbol,direction:dir,status,strategy:testStrategyName(x),winRate:testEffectiveWinRate(x),bestEntry:best,zoneLow:zl,zoneHigh:zh,stop,tp1,tp2,current:chartFinite(x.currentPrice),notified:Boolean(x.notificationSentAt),reentryActive,signalAt:x.notificationSentAt||x.confirmedAt||x.firstSeenAt||x.createdAt||x.eventAt||null,updatedAt:x.updatedAt||x.lastCheckAt||x.currentPriceAt||x.stateChangedAt||null}
  }
  for(const t of lastStatus?.traders||[]){for(const p of newestPositions(t.positions||[])){if(p?.symbol===symbol){const entry=chartFinite(p.entryPrice);return {symbol,direction:p.side==='SHORT'?'SHORT':'LONG',status:'實際持倉',strategy:t.name||'交易員',winRate:null,bestEntry:entry,zoneLow:null,zoneHigh:null,stop:null,tp1:null,tp2:null,current:chartFinite(p.markPrice),notified:false,signalAt:p.openedAt||p.createdAt||null,updatedAt:p.updatedAt||p.markPriceAt||lastStatus?.updatedAt||null}}}}
  return {symbol,direction:null,status:'僅看行情',strategy:'尚無系統進場線',winRate:null,bestEntry:null,zoneLow:null,zoneHigh:null,stop:null,tp1:null,tp2:null,current:null,notified:false}
}
function chartLevelText(label,value){const text=typeof value==='string'?value:(value?price(value):'—');return `<div><span>${esc(label)}</span><b>${esc(text)}</b></div>`}
/* CHART_UX_V262_20260902 */
const CHART_TAIPEI_TZ='Asia/Taipei';
function chartTimeToDate(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='object'&&Number.isFinite(Number(v.year))){const d=new Date(Date.UTC(Number(v.year),Number(v.month||1)-1,Number(v.day||1)));return Number.isNaN(d.getTime())?null:d}
  if(typeof v==='number'&&Number.isFinite(v)){const d=new Date(v>1e12?v:v*1000);return Number.isNaN(d.getTime())?null:d}
  if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n)&&v.trim()!==''){const d=new Date(n>1e12?n:n*1000);if(!Number.isNaN(d.getTime()))return d}const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
  return null
}
function chartTaipeiParts(v){const d=chartTimeToDate(v);if(!d)return null;try{const p={};for(const x of new Intl.DateTimeFormat('en-GB',{timeZone:CHART_TAIPEI_TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d))if(x.type!=='literal')p[x.type]=x.value;return p}catch{return null}}
function chartTaipeiFull(v){const p=chartTaipeiParts(v);return p?p.month+'/'+p.day+' '+p.hour+':'+p.minute:'—'}
function chartTaipeiClock(v){const p=chartTaipeiParts(v);return p?p.hour+':'+p.minute:'—'}
function chartTaipeiTick(v,tickType){const p=chartTaipeiParts(v);if(!p)return'';return Number(tickType)<=2?p.month+'/'+p.day:p.hour+':'+p.minute}
function chartIntervalMs(tf){return ({'5m':5,'15m':15,'30m':30,'1h':60})[String(tf)]*60*1000||15*60*1000}
function chartRelativeAge(ms){ms=Math.max(0,Number(ms)||0);if(ms<60e3)return Math.max(0,Math.floor(ms/1000))+'秒前';if(ms<3600e3)return Math.floor(ms/60e3)+'分前';if(ms<86400e3)return Math.floor(ms/3600e3)+'小時前';return Math.floor(ms/86400e3)+'天前'}
function chartKlineFreshness(lastTime,tf){const d=chartTimeToDate(lastTime),age=d?Math.max(0,Date.now()-d.getTime()):Infinity,base=chartIntervalMs(tf),freshMax=base*2.2+60e3,agingMax=base*4.5+60e3;return age<=freshMax?{key:'fresh',label:'即時',age}:age<=agingMax?{key:'aging',label:'偏舊',age}:{key:'stale',label:'可能過期',age}}
function chartRenderTimeMeta(ctx){const host=$('chartStatus');if(!host)return;let el=$('chartTimeMeta');if(!el){el=document.createElement('div');el.id='chartTimeMeta';el.className='chartTimeMeta';host.insertAdjacentElement('afterend',el)}if(!ctx){el.textContent='';el.className='chartTimeMeta';return}const signal=chartTimeToDate(ctx.signalAt),updated=chartTimeToDate(ctx.updatedAt),parts=[];if(signal)parts.push('訊號 '+chartTaipeiFull(signal)+' · '+chartRelativeAge(Date.now()-signal.getTime()));if(updated&&(!signal||Math.abs(updated-signal)>30e3))parts.push('最後判讀 '+chartTaipeiFull(updated));el.textContent=parts.length?'台灣時間 · '+parts.join(' · '):'台灣時間 · 即時行情';const age=updated?Date.now()-updated.getTime():(signal?Date.now()-signal.getTime():0);el.className='chartTimeMeta '+(age>2*3600e3?'aging':'fresh')}
function chartPriceLabelPlan(ctx){const minGap=window.matchMedia?.('(max-width:520px)')?.matches?34:25,placed=[],out={entry:false,stop:false,tp1:false,tp2:false};const items=[['entry',ctx.bestEntry,5],['stop',ctx.stop,5],['tp2',ctx.tp2,4],['tp1',ctx.tp1,3]].sort((a,b)=>b[2]-a[2]);for(const [key,value] of items){if(!(Number(value)>0))continue;const y=systemCandleSeries?.priceToCoordinate?.(Number(value));const show=Number.isFinite(y)&&placed.every(p=>Math.abs(p-y)>=minGap);out[key]=show;if(show)placed.push(y)}return out}
function chartLineStyle(kind){const L=window.LightweightCharts;return kind==='solid'?(L?.LineStyle?.Solid??0):(L?.LineStyle?.Dashed??2)}
function chartDestroy(){if(systemChartResize){systemChartResize.disconnect();systemChartResize=null}if(systemChart){try{systemChart.remove()}catch{}systemChart=null;systemCandleSeries=null}const band=$('chartEntryBand');if(band){band.style.display='none';band.style.height='0'}}
function chartUpdateBand(){const band=$('chartEntryBand'),ctx=systemChartContext;if(!band||!systemCandleSeries||!ctx?.zoneLow||!ctx?.zoneHigh){if(band)band.style.display='none';return}const y1=systemCandleSeries.priceToCoordinate(ctx.zoneHigh),y2=systemCandleSeries.priceToCoordinate(ctx.zoneLow);if(!Number.isFinite(y1)||!Number.isFinite(y2)){band.style.display='none';return}band.style.display='block';band.style.top=`${Math.min(y1,y2)}px`;band.style.height=`${Math.max(2,Math.abs(y2-y1))}px`}
function chartAddPriceLine(value,title,color,style='dash',width=1,axisLabelVisible=true){if(!systemCandleSeries||!(value>0))return;try{systemCandleSeries.createPriceLine({price:value,title,color,lineWidth:width,lineStyle:chartLineStyle(style),axisLabelVisible:!!axisLabelVisible,lineVisible:true})}catch{}}
let chartLibraryPromise=null;
function ensureChartLibrary(){if(window.LightweightCharts?.createChart)return Promise.resolve(window.LightweightCharts);if(chartLibraryPromise)return chartLibraryPromise;chartLibraryPromise=new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-lightweight-charts]');if(existing){existing.addEventListener('load',()=>window.LightweightCharts?.createChart?resolve(window.LightweightCharts):reject(new Error('圖表元件載入失敗')),{once:true});existing.addEventListener('error',()=>reject(new Error('圖表元件下載失敗')),{once:true});return}const script=document.createElement('script');script.src='https://unpkg.com/lightweight-charts@5.0.8/dist/lightweight-charts.standalone.production.js';script.async=true;script.dataset.lightweightCharts='1';script.onload=()=>window.LightweightCharts?.createChart?resolve(window.LightweightCharts):reject(new Error('圖表元件載入失敗'));script.onerror=()=>reject(new Error('圖表元件下載失敗'));document.head.appendChild(script)}).catch(e=>{chartLibraryPromise=null;throw e});return chartLibraryPromise}
async function renderSystemChart(){
  const symbol=systemChartSymbol,interval=systemChartInterval,request=++systemChartRequest,loading=$('chartLoading');if(!symbol)return;
  if(loading){loading.classList.add('show');loading.textContent='讀取 Binance K 線…'}chartDestroy();
  try{
    const [r,L]=await Promise.all([fetch(`/api/chart-data?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=260`,{cache:'no-cache'}),ensureChartLibrary()]),d=await r.json();
    if(request!==systemChartRequest)return;if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);
    const box=$('systemChart');if(!L?.createChart||!box)throw new Error('圖表元件載入失敗');
    systemChart=L.createChart(box,{width:Math.max(280,box.clientWidth),height:Math.max(340,box.clientHeight||410),layout:{background:{type:'solid',color:'#090b0c'},textColor:'#8f8981',fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang TC",sans-serif'},localization:{locale:'zh-TW',timeFormatter:time=>chartTaipeiFull(time)},grid:{vertLines:{color:'#171a1b'},horzLines:{color:'#171a1b'}},rightPriceScale:{borderColor:'#25292a',scaleMargins:{top:.08,bottom:.10}},timeScale:{borderColor:'#25292a',timeVisible:true,secondsVisible:false,rightOffset:7,barSpacing:7,minBarSpacing:3,tickMarkFormatter:(time,tickType)=>chartTaipeiTick(time,tickType)},crosshair:{vertLine:{color:'#62676a',labelBackgroundColor:'#33383a'},horzLine:{color:'#62676a',labelBackgroundColor:'#33383a'}},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true}});
    const candleOpts={upColor:'#d65b5b',downColor:'#60c18a',wickUpColor:'#d65b5b',wickDownColor:'#60c18a',borderVisible:false,priceLineVisible:true,lastValueVisible:true};
    systemCandleSeries=systemChart.addSeries?systemChart.addSeries(L.CandlestickSeries,candleOpts):systemChart.addCandlestickSeries(candleOpts);
    const candles=(d.candles||[]).map(c=>({time:Number(c.time),open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close)}));systemCandleSeries.setData(candles);
    const ctx=systemChartContext||{},labels=chartPriceLabelPlan(ctx);
    chartAddPriceLine(ctx.bestEntry,'入場','#e7bd5f','solid',2,labels.entry);
    chartAddPriceLine(ctx.zoneLow,'','#84672f','dash',1,false);chartAddPriceLine(ctx.zoneHigh,'','#84672f','dash',1,false);
    chartAddPriceLine(ctx.stop,'SL','#d85b5b','dash',2,labels.stop);chartAddPriceLine(ctx.tp1,'TP1','#67bd83','dash',1,labels.tp1);chartAddPriceLine(ctx.tp2,'TP2','#67bd83','dash',1,labels.tp2);
    systemChart.timeScale().fitContent();
    systemChartResize=new ResizeObserver(()=>{if(systemChart&&box){systemChart.applyOptions({width:Math.max(280,box.clientWidth),height:Math.max(340,box.clientHeight||410)});requestAnimationFrame(chartUpdateBand)}});systemChartResize.observe(box);
    try{systemChart.timeScale().subscribeVisibleLogicalRangeChange(()=>requestAnimationFrame(chartUpdateBand))}catch{}requestAnimationFrame(()=>requestAnimationFrame(chartUpdateBand));
    if(loading)loading.classList.remove('show');
    const source=$('chartSource'),last=candles[candles.length-1],fresh=chartKlineFreshness(last?.time,interval);if(source){source.classList.remove('sg-chart-fresh','sg-chart-aging','sg-chart-stale');source.classList.add(`sg-chart-${fresh.key}`);source.textContent=`${d.source||'Binance'} · ${interval} · ${candles.length}根 · 台灣時間 · 最後K線 ${chartTaipeiFull(last?.time)} · ${fresh.label}（${Number.isFinite(fresh.age)?chartRelativeAge(fresh.age):'時間未知'}） · 刷新 ${chartTaipeiClock(Date.now())}`}
    if(d.currentPrice&&$('chartCurrent'))$('chartCurrent').textContent=price(d.currentPrice)
  }catch(e){if(request!==systemChartRequest)return;if(loading){loading.classList.add('show');loading.innerHTML=`圖表暫時無法載入<br><small>${esc(e?.message||'未知錯誤')}</small>`}}
}
async function openSystemChart(symbol){symbol=String(symbol||'').toUpperCase();if(!/^[A-Z0-9]{5,24}$/.test(symbol))return;systemChartSymbol=symbol;const modal=$('chartModal');if(!modal)return;$('chartSymbol').textContent=symbol;$('chartDir').textContent='行情';$('chartDir').className='chartDir';$('chartStatus').textContent='讀取系統最佳點位…';chartRenderTimeMeta(null);$('chartLevels').innerHTML=chartLevelText('最佳入場',null)+chartLevelText('進場區',null)+chartLevelText('SL / 失效',null)+chartLevelText('TP1',null)+chartLevelText('TP2',null);$('chartTv').href=tradingViewLink(symbol);$('chartCurrent').textContent='—';$('chartSource').textContent='—';document.querySelectorAll('[data-chart-tf]').forEach(b=>b.classList.toggle('active',b.dataset.chartTf===systemChartInterval));modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.classList.add('chartOpen');const ctx=await chartResolveContext(symbol);if(systemChartSymbol!==symbol||!modal.classList.contains('show'))return;systemChartContext=ctx;chartRenderTimeMeta(ctx);$('chartDir').textContent=ctx.direction==='SHORT'?'做空':ctx.direction==='LONG'?'做多':'行情';$('chartDir').className=`chartDir ${ctx.direction==='SHORT'?'short':ctx.direction==='LONG'?'long':''}`;$('chartStatus').textContent=`${ctx.strategy||'—'} · ${ctx.status||'—'}${Number.isFinite(ctx.winRate)&&ctx.winRate>=0?` · 勝率 ${ctx.winRate.toFixed(1)}%`:''}`;$('chartLevels').innerHTML=chartLevelText('最佳入場',ctx.bestEntry)+chartLevelText('進場區',ctx.zoneLow&&ctx.zoneHigh?`${price(ctx.zoneLow)}～${price(ctx.zoneHigh)}`:null)+chartLevelText('SL / 失效',ctx.stop)+chartLevelText('TP1',ctx.tp1)+chartLevelText('TP2',ctx.tp2);$('chartCurrent').textContent=ctx.current?price(ctx.current):'—';await renderSystemChart()}
function closeSystemChart(){const modal=$('chartModal');if(!modal)return;modal.classList.remove('show');modal.setAttribute('aria-hidden','true');document.body.classList.remove('chartOpen');systemChartRequest++;chartDestroy()}
$('chartClose')?.addEventListener('click',closeSystemChart);$('chartCloseBottom')?.addEventListener('click',closeSystemChart);$('chartModal')?.addEventListener('click',e=>{if(e.target===$('chartModal'))closeSystemChart()});document.querySelectorAll('[data-chart-tf]').forEach(b=>b.addEventListener('click',()=>{systemChartInterval=b.dataset.chartTf||'15m';document.querySelectorAll('[data-chart-tf]').forEach(x=>x.classList.toggle('active',x===b));void renderSystemChart()}));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('chartModal')?.classList.contains('show'))closeSystemChart()});

function handleNotificationRoute(){const q=new URLSearchParams(location.search),tv=q.get('tv'),page=q.get('page'),symbol=q.get('testSignal'),dir=q.get('dir'),manual=q.get('manual');if(symbol&&/^[A-Z0-9]{5,24}$/.test(symbol)){testFocusSymbol=symbol;testFocusDirection=dir==='SHORT'?'SHORT':'LONG';clearTestJudgementDismiss(`${symbol}:${testFocusDirection}`);setPage(page==='test'?'test':'monitor',{force:true});void refreshTestSignals(false);return true}if(tv&&/^[A-Z0-9]{5,24}$/.test(tv)){history.replaceState(null,'',location.pathname);setPage('monitor',{force:true});setTimeout(()=>openTradingViewApp(tv),80);return true}if(manual==='1'){setPage('ideas',{force:true});for(const ms of [250,700,1400,2500])setTimeout(()=>{const el=document.getElementById('manualOpsPanel');if(el)el.scrollIntoView({block:'start',behavior:'auto'})},ms);return true}if(page)setPage(page,{force:true});return false}
refresh();
setTimeout(()=>handleNotificationRoute(),0);
setInterval(refresh,8000);
setInterval(updateSync,1000);

let marketFlowState=null,marketFlowFetchedAt=0,marketFlowBusy=false,todayBiasKey='LONG';
let dailyBriefState=null,dailyBriefFetchedAt=0,dailyBriefBusy=false;
let rankedIdeasState=null,rankedIdeasFetchedAt=0,rankedIdeasBusy=false;
const ideaAnalysisCache=new Map();
const ideaAnalysisInflight=new Map();
const ASSET_PROFILES_UI_V2612={"MSTR":{"name":"Strategy (MSTR)","assetClass":"TRADFI","subtype":"EQUITY","sector":"軟體 / Bitcoin 資產曝險","purpose":"企業軟體公司，同時持有大量 Bitcoin，股價常對 BTC 呈高敏感度。","history":"1989 年成立；近年資本配置高度聚焦 Bitcoin，使 MSTR 成為市場常見的 BTC 高 Beta 美股代理。","risk":"BTC 波動、增發/融資、槓桿與公司資本配置會放大股價變化。","benchmark":"QQQ / BTC"},"COIN":{"name":"Coinbase (COIN)","assetClass":"TRADFI","subtype":"EQUITY","sector":"金融科技 / 加密交易所","purpose":"美國大型加密資產交易平台，收入與交易量、穩定幣、生態服務高度相關。","history":"2012 年成立，2021 年於 Nasdaq 直接上市。","risk":"加密市場交易量、監管、BTC/ETH 方向與整體風險偏好都可能放大波動。","benchmark":"QQQ / BTC"},"CRCL":{"name":"Circle (CRCL)","assetClass":"TRADFI","subtype":"EQUITY","sector":"金融科技 / 穩定幣","purpose":"USDC 發行與相關支付、結算基礎設施。","history":"Circle 長期經營數位美元與穩定幣基礎設施，2025 年於美股上市。","risk":"利率、USDC 流通量、監管與穩定幣競爭會影響估值。","benchmark":"QQQ / 金融科技"},"PLTR":{"name":"Palantir (PLTR)","assetClass":"TRADFI","subtype":"EQUITY","sector":"AI / 軟體 / 政府科技","purpose":"資料整合、決策軟體與 AI 平台，客戶涵蓋政府與企業。","history":"2003 年成立，2020 年於 NYSE 直接上市。","risk":"估值高、政府合約與 AI 敘事敏感，財報與指引容易造成跳空。","benchmark":"QQQ"},"NVDA":{"name":"NVIDIA (NVDA)","assetClass":"TRADFI","subtype":"EQUITY","sector":"半導體 / AI GPU","purpose":"GPU、AI 加速器與資料中心平台，是 AI 基礎設施核心供應商之一。","history":"1993 年成立，長期由遊戲 GPU 擴展至資料中心與 AI 運算。","risk":"AI 資本支出、晶片供應、出口限制、競爭與高估值會放大波動。","benchmark":"QQQ / SOX"},"AAPL":{"name":"Apple (AAPL)","assetClass":"TRADFI","subtype":"EQUITY","sector":"消費電子 / 軟體服務","purpose":"iPhone、Mac、服務與裝置生態系。","history":"1976 年成立，是全球大型消費科技公司之一。","risk":"iPhone 週期、中國需求、服務成長、供應鏈與利率會影響估值。","benchmark":"QQQ / SPY"},"MSFT":{"name":"Microsoft (MSFT)","assetClass":"TRADFI","subtype":"EQUITY","sector":"軟體 / 雲端 / AI","purpose":"Windows、Microsoft 365、Azure、AI 與企業軟體。","history":"1975 年成立，現為全球大型企業軟體與雲端平台公司。","risk":"Azure 成長、AI 資本支出、企業 IT 預算與監管是主要變數。","benchmark":"QQQ / SPY"},"AMZN":{"name":"Amazon (AMZN)","assetClass":"TRADFI","subtype":"EQUITY","sector":"電商 / 雲端 / 廣告","purpose":"全球電商、AWS 雲端與數位廣告。","history":"1994 年成立，後從電商擴展至雲端、物流與廣告。","risk":"AWS 成長、消費景氣、物流成本與資本支出會影響利潤率。","benchmark":"QQQ / SPY"},"META":{"name":"Meta Platforms (META)","assetClass":"TRADFI","subtype":"EQUITY","sector":"社群 / 廣告 / AI","purpose":"Facebook、Instagram、WhatsApp、數位廣告與 AI 產品。","history":"2004 年成立，2021 年改名 Meta Platforms。","risk":"廣告景氣、AI 資本支出、監管、平台成長與 Reality Labs 支出影響大。","benchmark":"QQQ"},"TSLA":{"name":"Tesla (TSLA)","assetClass":"TRADFI","subtype":"EQUITY","sector":"電動車 / 能源 / AI","purpose":"電動車、儲能、充電與自動駕駛/機器人敘事。","history":"2003 年成立，後成為全球高關注度電動車公司。","risk":"交付量、價格戰、毛利率、FSD/機器人敘事與 CEO 事件風險都很高。","benchmark":"QQQ / SPY"},"GOOGL":{"name":"Alphabet (GOOGL)","assetClass":"TRADFI","subtype":"EQUITY","sector":"搜尋 / 廣告 / 雲端 / AI","purpose":"Google 搜尋、YouTube、Google Cloud 與 AI 服務。","history":"Google 1998 年成立，2015 年重組為 Alphabet。","risk":"廣告景氣、AI 搜尋競爭、雲端成長與反壟斷監管影響估值。","benchmark":"QQQ / SPY"},"GOOG":{"name":"Alphabet (GOOG)","assetClass":"TRADFI","subtype":"EQUITY","sector":"搜尋 / 廣告 / 雲端 / AI","purpose":"Google 搜尋、YouTube、Google Cloud 與 AI 服務。","history":"Google 1998 年成立，2015 年重組為 Alphabet。","risk":"廣告景氣、AI 搜尋競爭、雲端成長與反壟斷監管影響估值。","benchmark":"QQQ / SPY"},"AVGO":{"name":"Broadcom (AVGO)","assetClass":"TRADFI","subtype":"EQUITY","sector":"半導體 / 網通 / 軟體","purpose":"網通、AI ASIC、半導體與企業軟體。","history":"由多次併購形成大型半導體與基礎軟體公司。","risk":"AI 網路設備需求、客戶集中、併購整合與半導體週期影響大。","benchmark":"QQQ / SOX"},"AMD":{"name":"AMD (AMD)","assetClass":"TRADFI","subtype":"EQUITY","sector":"半導體 / CPU / GPU","purpose":"CPU、GPU、資料中心與 AI 加速器。","history":"1969 年成立，長期與 Intel/NVIDIA 在運算市場競爭。","risk":"AI GPU 競爭、資料中心市占、PC 週期與晶圓供應影響明顯。","benchmark":"QQQ / SOX"},"TSM":{"name":"TSMC ADR (TSM)","assetClass":"TRADFI","subtype":"EQUITY","sector":"半導體 / 晶圓代工","purpose":"全球先進製程晶圓代工核心供應商。","history":"1987 年成立，是純晶圓代工商業模式的重要代表。","risk":"先進製程需求、AI 晶片週期、地緣政治、匯率與資本支出影響大。","benchmark":"SOX / QQQ"},"NFLX":{"name":"Netflix (NFLX)","assetClass":"TRADFI","subtype":"EQUITY","sector":"串流媒體 / 娛樂","purpose":"全球訂閱影音、廣告方案與內容平台。","history":"1997 年成立，從 DVD 租賃轉型為全球串流媒體。","risk":"訂戶成長、ARPU、內容成本、廣告變現與競爭影響估值。","benchmark":"QQQ"},"MU":{"name":"Micron (MU)","assetClass":"TRADFI","subtype":"EQUITY","sector":"半導體 / 記憶體","purpose":"DRAM、NAND 與 HBM 記憶體。","history":"1978 年成立，是全球主要記憶體製造商之一。","risk":"記憶體價格循環、HBM 需求、庫存與供給紀律導致波動很大。","benchmark":"SOX / QQQ"},"INTC":{"name":"Intel (INTC)","assetClass":"TRADFI","subtype":"EQUITY","sector":"半導體 / CPU / Foundry","purpose":"PC/伺服器處理器與晶圓製造服務。","history":"1968 年成立，是 x86 處理器產業長期重要公司。","risk":"製程轉型、資本支出、競爭與代工執行是主要風險。","benchmark":"SOX / QQQ"},"SPY":{"name":"SPDR S&P 500 ETF (SPY)","assetClass":"TRADFI","subtype":"ETF","sector":"美股大盤 / S&P 500","purpose":"追蹤 S&P 500，大致代表美國大型股整體風險偏好。","history":"1993 年推出，是全球最具流動性的股票 ETF 之一。","risk":"利率、通膨、企業獲利、宏觀政策與系統性風險主導。","benchmark":"S&P 500"},"QQQ":{"name":"Invesco QQQ (QQQ)","assetClass":"TRADFI","subtype":"ETF","sector":"Nasdaq 100 / 科技成長","purpose":"追蹤 Nasdaq-100，科技與大型成長股權重高。","history":"1999 年推出，是市場常用的美國大型科技/成長股代理。","risk":"利率、AI/科技估值、巨型科技財報與風險偏好影響大。","benchmark":"Nasdaq 100"},"IWM":{"name":"iShares Russell 2000 ETF (IWM)","assetClass":"TRADFI","subtype":"ETF","sector":"美國小型股","purpose":"追蹤 Russell 2000，反映美國小型股與內需企業風險偏好。","history":"2000 年推出，是常用的小型股 ETF。","risk":"利率、融資環境、景氣與信用風險比大型股更敏感。","benchmark":"Russell 2000"},"DIA":{"name":"SPDR Dow Jones ETF (DIA)","assetClass":"TRADFI","subtype":"ETF","sector":"道瓊工業平均","purpose":"追蹤道瓊工業平均指數的大型成熟企業。","history":"1998 年推出。","risk":"景氣、工業與大型價值股循環影響較大。","benchmark":"Dow Jones"},"BITO":{"name":"ProShares Bitcoin Strategy ETF (BITO)","assetClass":"TRADFI","subtype":"ETF","sector":"Bitcoin 期貨 ETF","purpose":"透過 CME Bitcoin 期貨提供 BTC 價格曝險。","history":"2021 年推出，是美國早期大型 Bitcoin 期貨 ETF。","risk":"BTC 波動、期貨展期成本與市場基差影響績效。","benchmark":"BTC"}};
const MARKET_ASSET_PREF_V2612='position-alert-market-asset-v2612',IDEA_ASSET_PREF_V2612='position-alert-idea-asset-v2612';
let marketAssetViewV2612=(()=>{try{return localStorage.getItem(MARKET_ASSET_PREF_V2612)==='TRADFI'?'TRADFI':'CRYPTO'}catch{return'CRYPTO'}})(),ideaAssetViewV2612=(()=>{try{const v=localStorage.getItem(IDEA_ASSET_PREF_V2612)||'ALL';return ['ALL','CRYPTO','TRADFI'].includes(v)?v:'ALL'}catch{return'ALL'}})(),marketFlowMasterV2612=null,rankedIdeasMasterV2612=null;
function assetBaseUiV2612(symbol){return String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'').replace(/^1000(?=[A-Z])/,'')}
function assetClassUiV2612(x){if(String(x?.assetClass||'').toUpperCase()==='TRADFI')return'TRADFI';const b=assetBaseUiV2612(x?.symbol||x);return ASSET_PROFILES_UI_V2612[b]?.assetClass==='TRADFI'?'TRADFI':'CRYPTO'}
function assetLabelUiV2612(x){return assetClassUiV2612(x)==='TRADFI'?'美股':'幣圈'}
function assetBadgeV2612(x){const c=assetClassUiV2612(x);return `<span class="assetBadgeV2612 ${c==='TRADFI'?'tradfi':'crypto'}">${c==='TRADFI'?'美股':'幣圈'}</span>`}
function pfTextV2612(v){const n=Number(v);return !Number.isFinite(n)?'—':n>=99?'無虧損':n.toFixed(2)}

async function fetchIdeaAnalysisShared(symbol,direction){const key=`${symbol}:${direction}`,cached=ideaAnalysisCache.get(key);if(cached&&Date.now()-cached.at<6*60*60*1000){const age=Date.now()-cached.at;return {...cached.data,cached:true,cacheAgeMs:age,cacheExpiresInMs:Math.max(0,6*60*60*1000-age),cacheMs:6*60*60*1000}}if(ideaAnalysisInflight.has(key))return ideaAnalysisInflight.get(key);const promise=(async()=>{const r=await fetch(`/api/symbol-analysis?symbol=${encodeURIComponent(symbol)}&direction=${encodeURIComponent(direction)}`,{cache:'no-cache'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);ideaAnalysisCache.set(key,{at:Date.now(),data:d});return d})().finally(()=>ideaAnalysisInflight.delete(key));ideaAnalysisInflight.set(key,promise);return promise}
let testSignalsState=null,testSignalsFetchedAt=0,testSignalsBusy=false,testFocusSymbol=null,testFocusDirection='LONG',testMonitorOpenKeys=new Set(),testAiOpenKeys=new Set();
let performanceState=null,performanceFetchedAt=0,performanceBusy=false;

const PAGE_LOCK_PREF_V269='position-alert-page-lock-v269';
const PAGE_LOCK_ALLOWED_V2611=new Set(['ideas','monitor','test']);function pageLockReadV269(){return{enabled:false,page:''}}
function pageLockWriteV269(_enabled,_page=''){try{localStorage.removeItem('position-alert-page-lock-v269')}catch{};document.getElementById('pageLockTagV269')?.remove();document.querySelector('.pageLockRowV269')?.remove()}
function pageLockPageNameV269(page){return({today:'今日',performance:'績效',flow:'流向',ideas:'建議',monitor:'監控',test:'觀察'})[page]||'頁面'}
function pageLockSyncV269(){document.getElementById('pageLockTagV269')?.remove();document.querySelector('.pageLockRowV269')?.remove()}
function mountPageLockV269(){document.getElementById('pageLockTagV269')?.remove();document.querySelector('.pageLockRowV269')?.remove()}
function setPage(name,opts={}){
  const valid=['today','monitor','flow','ideas','test','performance'];if(!valid.includes(name))name='today';const locked=pageLockReadV269();if(locked.enabled&&!opts.force&&valid.includes(locked.page))name=locked.page;
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===`page-${name}`));
  document.querySelectorAll('.pageTab').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  try{localStorage.setItem('position-alert-page-v78',name)}catch{}
  if(opts.user&&pageLockReadV269().enabled)pageLockWriteV269(true,name);else pageLockSyncV269();
  if(name==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}
  else if(name==='flow')void refreshMarketFlow(false);
  else if(name==='ideas'){void refreshMarketFlow(false);void refreshRankedIdeas(false)}
  else if(name==='test')void refreshTestSignals(false);
  else if(name==='monitor')void refreshTestSignals(false);
  else if(name==='performance')void refreshPerformance(false)
}
function mountAssetSwitchesV2612(){
  const make=(id,values,get,set)=>{const page=document.getElementById(id);if(!page||page.querySelector('.assetSwitchV2612'))return;const row=document.createElement('div');row.className='assetSwitchV2612';row.innerHTML=values.map(([k,t])=>`<button type="button" data-asset-view="${k}">${t}</button>`).join('');const anchor=page.querySelector('.sectionBar,.todayHero,.flowHero,.pageIntro');anchor?anchor.insertAdjacentElement('beforebegin',row):page.prepend(row);row.addEventListener('click',e=>{const b=e.target.closest('[data-asset-view]');if(!b)return;set(b.dataset.assetView);syncAssetSwitchesV2612();});};
  make('page-today',[['CRYPTO','幣圈'],['TRADFI','美股']],()=>marketAssetViewV2612,v=>{marketAssetViewV2612=v==='TRADFI'?'TRADFI':'CRYPTO';try{localStorage.setItem(MARKET_ASSET_PREF_V2612,marketAssetViewV2612)}catch{};if(marketFlowMasterV2612)renderMarketFlow(marketFlowMasterV2612);if(dailyBriefState)renderDailyBrief(dailyBriefState)});
  make('page-flow',[['CRYPTO','幣圈'],['TRADFI','美股']],()=>marketAssetViewV2612,v=>{marketAssetViewV2612=v==='TRADFI'?'TRADFI':'CRYPTO';try{localStorage.setItem(MARKET_ASSET_PREF_V2612,marketAssetViewV2612)}catch{};if(marketFlowMasterV2612)renderMarketFlow(marketFlowMasterV2612)});
  make('page-ideas',[['ALL','全部'],['CRYPTO','幣圈'],['TRADFI','美股']],()=>ideaAssetViewV2612,v=>{ideaAssetViewV2612=['ALL','CRYPTO','TRADFI'].includes(v)?v:'ALL';try{localStorage.setItem(IDEA_ASSET_PREF_V2612,ideaAssetViewV2612)}catch{};if(rankedIdeasMasterV2612)renderRankedIdeas(rankedIdeasMasterV2612)});syncAssetSwitchesV2612();
}
function syncAssetSwitchesV2612(){document.querySelectorAll('#page-today .assetSwitchV2612,#page-flow .assetSwitchV2612').forEach(r=>r.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.assetView===marketAssetViewV2612)));document.querySelectorAll('#page-ideas .assetSwitchV2612').forEach(r=>r.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.assetView===ideaAssetViewV2612)))}
function marketViewV2612(d){const k=marketAssetViewV2612==='TRADFI'?'tradfi':'crypto',v=d?.assetViews?.[k];return v?{...d,...v,assetViews:d.assetViews,assetCounts:d.assetCounts,generatedAt:d.generatedAt,source:d.source}:d}
function renderAssetTodayHeroV2612(){const d=marketViewV2612(marketFlowMasterV2612),sm=d?.summary||{},label=marketAssetViewV2612==='TRADFI'?'美股永續':'幣圈',score=Math.max(0,Math.min(100,Number(sm.confidence||50))),mood=sm.direction==='LONG'?'long':sm.direction==='SHORT'?'short':'neutral',topL=(d?.today?.topLongs||d?.topLongs||[]).slice(0,3).map(x=>x.symbol).join('、')||'—',topS=(d?.today?.topShorts||d?.topShorts||[]).slice(0,3).map(x=>x.symbol).join('、')||'—';const hero=$('todayHero');if(!hero||!d)return;hero.className='todayHero briefHero';hero.innerHTML=`<div class="todayHeroTop"><div><div class="todayHeroTitle ${mood}">${label}｜${esc(sm.label||'多空拉鋸')}</div><div class="todayHeroMeta">Binance 永續 · ${ageText(d.generatedAt)} · 獨立市場樣本</div></div><div class="todayScore">${Math.round(score)}<small>${sm.direction==='LONG'?'偏多':sm.direction==='SHORT'?'偏空':'中性'}</small></div></div><ul class="briefBullets"><li>成交加權 ${signed(sm.weightedChangePct||0,2)} · 上漲 ${Number(sm.advancers||0)} / 下跌 ${Number(sm.decliners||0)}</li><li>偏多前段：${esc(topL)}</li><li>偏空前段：${esc(topS)}</li></ul><div class="briefAction">${marketAssetViewV2612==='TRADFI'?'美股永續獨立看美股廣度／時段；學習不直接套用幣圈權重。':'幣圈維持 BTC/ETH、資金費率、OI、清算與跨所資料優先。'}</div>`;if($('todayAge'))$('todayAge').textContent=ageText(d.generatedAt)}

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
  if(!d?.ok)return;if(marketFlowMasterV2612?.assetViews){dailyBriefState=d;dailyBriefFetchedAt=Date.now();renderAssetTodayHeroV2612();return;}
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
  try{const qs=new URLSearchParams();if(force)qs.set('force','1');const r=await fetch(`/api/daily-brief${qs.toString()?`?${qs.toString()}`:''}`,{cache:'no-cache'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderDailyBrief(d);if(d.mode==='AI_WEB')$('briefMsg').textContent=force?'AI 已更新':'AI 已連線';else if(d.aiConfigured===false){const svc=d.runtime?.service?` · ${d.runtime.service}`:'';$('briefMsg').textContent=`AI 未連線${svc}`}else if(d.aiError)$('briefMsg').textContent=`AI：${d.aiError}`;else $('briefMsg').textContent='市場資料'}catch(e){$('briefMsg').textContent='整理暫時不可用'}finally{dailyBriefBusy=false;if($('briefRefresh'))$('briefRefresh').disabled=false}
}
// COIN_PROFILE_V2611 — evergreen public project background; no runtime AI/web request.
const COIN_PROFILE_V2611={
BTC:{name:'Bitcoin 比特幣',history:'2009 年上線，由中本聰提出；是最早的大型去中心化加密貨幣。',type:'價值儲存 / 支付網路 / PoW',use:'以固定供給上限與工作量證明維持稀缺性，可作鏈上轉帳與長期價值儲存。',risk:'波動大；市場通常把 BTC 當整體幣圈風險偏好的核心指標。'},
ETH:{name:'Ethereum 以太坊',history:'2015 年主網上線；2022 年 The Merge 後轉為權益證明。',type:'智慧合約 L1 / PoS',use:'承載 DeFi、穩定幣、NFT、L2 結算與各類鏈上應用。',risk:'Gas、L2 分流與其他 L1 競爭會影響資金與敘事。'},
BNB:{name:'BNB',history:'2017 年發行，後成為 BNB Chain 生態核心資產。',type:'交易所生態 / EVM L1',use:'可用於 BNB Chain Gas、鏈上應用及 Binance 生態內多種用途。',risk:'與 Binance 生態、監管及 BNB Chain 活躍度高度相關。'},
SOL:{name:'Solana',history:'2020 年主網 Beta 上線，主打高吞吐與低延遲。',type:'高效能 L1 / PoS',use:'DeFi、支付、迷因幣、NFT、交易與消費型鏈上應用。',risk:'生態交易活躍時波動與槓桿清算也常放大。'},
XRP:{name:'XRP / XRP Ledger',history:'XRP Ledger 於 2012 年啟動，重點是快速價值轉移。',type:'支付 / 結算網路',use:'低成本跨境轉帳與資產結算；XRP 是 XRPL 原生資產。',risk:'價格常受監管、Ripple 相關消息與市場敘事影響。'},
ADA:{name:'Cardano',history:'2017 年推出，採研究導向的權益證明架構。',type:'智慧合約 L1 / PoS',use:'鏈上資產、DeFi、治理與智慧合約應用。',risk:'開發節奏、生態使用量與競爭鏈表現是主要觀察點。'},
DOGE:{name:'Dogecoin',history:'2013 年推出，源自迷因文化並採用 PoW。',type:'迷因 / 支付',use:'社群轉帳、小額支付與迷因敘事。',risk:'高度受社群熱度、名人話題與風險偏好影響。'},
TRX:{name:'TRON',history:'2017 年成立，2018 年主網獨立運行。',type:'L1 / 支付 / 穩定幣生態',use:'低成本轉帳、穩定幣流通與 DeFi。',risk:'鏈上穩定幣流量很重要，亦受生態集中度與監管敘事影響。'},
LINK:{name:'Chainlink',history:'2017 年推出，成為主流去中心化 Oracle 網路之一。',type:'Oracle / 基礎設施',use:'把價格、儲備證明、跨鏈訊息等外部資料提供給智慧合約。',risk:'需求依賴 DeFi/RWA/跨鏈採用及生態整合。'},
AVAX:{name:'Avalanche',history:'2020 年主網上線。',type:'L1 / 子網與應用鏈',use:'DeFi、資產發行、遊戲與自訂鏈部署。',risk:'與其他 EVM/L1 的流動性與開發者競爭明顯。'},
SUI:{name:'Sui',history:'2023 年主網上線，由 Mysten Labs 推動。',type:'Move 系 L1',use:'高效能鏈上交易、遊戲、DeFi 與物件導向資產。',risk:'新興 L1，代幣解鎖、生態成長與資金輪動影響較大。'},
TON:{name:'Toncoin / TON',history:'源自 Telegram Open Network 構想，後由開源社群延續發展。',type:'L1 / 消費與訊息生態',use:'支付、Mini Apps、遊戲、DeFi，並與 Telegram 使用情境連結。',risk:'生態成長快但敘事集中，事件與平台政策可能放大波動。'},
LTC:{name:'Litecoin',history:'2011 年由 Charlie Lee 建立，是早期 Bitcoin 衍生支付網路。',type:'PoW / 支付',use:'快速、低成本的鏈上價值轉移。',risk:'成熟但敘事較少，通常受 BTC 與整體市場方向帶動。'},
BCH:{name:'Bitcoin Cash',history:'2017 年由 Bitcoin 分叉而來。',type:'PoW / 支付',use:'主張較大區塊與點對點電子現金用途。',risk:'流動性與市場敘事通常弱於 BTC，事件行情可很劇烈。'},
DOT:{name:'Polkadot',history:'2020 年主網逐步上線，由 Web3 Foundation / Parity 生態推動。',type:'多鏈 / 共享安全',use:'讓不同鏈共享安全與跨鏈互通。',risk:'架構升級、開發者採用與跨鏈競爭是關鍵。'},
APT:{name:'Aptos',history:'2022 年主網上線，由前 Diem 團隊成員創立。',type:'Move 系 L1',use:'DeFi、遊戲、支付與高吞吐鏈上應用。',risk:'新興 L1，解鎖、VC 籌碼與生態活躍度需留意。'},
ARB:{name:'Arbitrum',history:'Arbitrum One 於 2021 年上線，ARB 治理代幣於 2023 年推出。',type:'Ethereum L2 / Optimistic Rollup',use:'降低以太坊交易成本，承載 DeFi 與鏈上應用。',risk:'L2 競爭、治理及代幣解鎖會影響價格。'},
OP:{name:'Optimism',history:'Optimism 主網於 2021 年逐步開放，OP 代幣於 2022 年推出。',type:'Ethereum L2 / Superchain',use:'擴容以太坊並推動 OP Stack / Superchain 生態。',risk:'L2 費用、競爭與代幣供給是重要變數。'},
NEAR:{name:'NEAR Protocol',history:'2020 年主網上線。',type:'L1 / 分片 / PoS',use:'智慧合約、DeFi、消費型應用與鏈抽象相關工具。',risk:'敘事轉換快，生態使用量與資金流需同步驗證。'},
UNI:{name:'Uniswap',history:'Uniswap 於 2018 年上線，UNI 治理代幣於 2020 年推出。',type:'DeFi / DEX',use:'自動做市與鏈上代幣交換；UNI 主要用於治理。',risk:'DEX 交易量、費用機制、監管與競爭協議會影響估值。'},
AAVE:{name:'Aave',history:'前身 ETHLend，2020 年轉型為 Aave。',type:'DeFi / 借貸',use:'超額抵押借貸、流動性市場與閃電貸等。',risk:'清算、市場壞帳、智能合約及 DeFi 資金週期是核心風險。'},
FIL:{name:'Filecoin',history:'2020 年主網上線。',type:'去中心化儲存',use:'用市場機制協調分散式資料儲存與檢索。',risk:'儲存需求、礦工經濟模型與供給釋放影響較大。'},
ETC:{name:'Ethereum Classic',history:'2016 年 The DAO 事件後與 Ethereum 分叉。',type:'PoW 智慧合約 L1',use:'保留原 Ethereum 歷史鏈與 PoW 執行環境。',risk:'生態規模較小，安全與流動性事件可能放大價格波動。'},
XLM:{name:'Stellar',history:'2014 年成立，主打低成本跨境價值轉移。',type:'支付 / 資產發行',use:'支付、法幣錨定資產與跨境結算。',risk:'採用度、支付合作及整體市場風險偏好影響價格。'},
ATOM:{name:'Cosmos Hub / ATOM',history:'Cosmos Hub 於 2019 年啟動。',type:'跨鏈 / PoS',use:'IBC 跨鏈互通、生態協調與 Cosmos Hub 安全機制。',risk:'價值捕獲方式、治理與多鏈競爭常影響敘事。'},
SHIB:{name:'Shiba Inu',history:'2020 年推出，由迷因代幣逐步擴展至自有生態。',type:'迷因 / 生態',use:'社群資產、Shibarium 與相關 DeFi/應用。',risk:'高度敘事化，社群熱度與大盤流動性影響大。'},
PEPE:{name:'PEPE',history:'2023 年興起的 Ethereum 迷因代幣。',type:'迷因',use:'主要價值來自社群、流動性與迷因敘事。',risk:'基本面錨定弱，波動、籌碼與清算風險非常高。'},
WIF:{name:'dogwifhat',history:'2023 年於 Solana 生態快速走紅。',type:'迷因 / Solana',use:'社群與迷因敘事資產。',risk:'高波動、籌碼與情緒主導，容易出現快速插針。'},
SEI:{name:'Sei',history:'2023 年主網上線。',type:'L1 / 交易導向',use:'針對交易與高效能鏈上應用設計。',risk:'新興 L1 的解鎖、生態流量與競爭風險較高。'},
INJ:{name:'Injective',history:'2021 年主網上線。',type:'DeFi / 交易型 L1',use:'鏈上現貨、衍生品與金融應用基礎設施。',risk:'交易活躍度、DeFi 週期與生態集中度影響較大。'},
TIA:{name:'Celestia',history:'2023 年主網上線。',type:'模組化區塊鏈 / Data Availability',use:'為 Rollup 與模組化鏈提供資料可用性。',risk:'模組化鏈採用、競爭與代幣解鎖是主要變數。'},
FET:{name:'Fetch.ai / ASI 生態',history:'Fetch.ai 於 2019 年推出代幣，主打自主代理與 AI 經濟。',type:'AI / 區塊鏈基礎設施',use:'AI Agent、資料與鏈上服務協作。',risk:'AI 敘事敏感，品牌/代幣整合與市場熱度可能造成劇烈波動。'},
RENDER:{name:'Render Network',history:'2017 年起發展去中心化 GPU 算力網路。',type:'GPU / DePIN / AI',use:'把閒置 GPU 算力提供給渲染與運算需求。',risk:'受 AI/GPU 敘事、實際使用量與供需循環影響。'},
ONDO:{name:'Ondo Finance',history:'2021 年成立，聚焦鏈上現實世界資產。',type:'RWA / DeFi',use:'代幣化美債、收益型資產與鏈上金融基礎設施。',risk:'利率、監管、資產託管與 RWA 敘事是主要驅動。'},
ENA:{name:'Ethena',history:'2024 年快速擴張的合成美元與收益生態。',type:'DeFi / 合成美元',use:'USDe、對沖結構與鏈上收益產品。',risk:'資金費率、對沖執行、託管與穩定機制是核心風險。'},
HYPE:{name:'Hyperliquid',history:'Hyperliquid 以鏈上永續交易起家，HYPE 於 2024 年推出。',type:'DEX / 永續 / L1',use:'鏈上永續、現貨與交易型應用生態。',risk:'交易量、平台風險、競爭與高槓桿市場清算會影響價格。'},
ZEC:{name:'Zcash',history:'2016 年主網上線。',type:'隱私 / PoW',use:'支援零知識證明的選擇性隱私交易。',risk:'隱私幣監管與交易所支援度對流動性影響很大。'},
TAO:{name:'Bittensor / TAO',history:'Bittensor 網路自 2021 年起發展去中心化機器學習激勵。',type:'AI / 去中心化算力與模型',use:'用 TAO 激勵不同子網提供 AI/資料/運算服務。',risk:'AI 敘事強、估值與子網經濟仍快速演進，波動高。'},
PENDLE:{name:'Pendle',history:'2021 年推出。',type:'DeFi / 收益交易',use:'把收益型資產拆分為本金與收益權，交易未來收益率。',risk:'利率、收益資產安全與 DeFi 流動性影響大。'},
HBAR:{name:'Hedera',history:'Hedera 公網於 2019 年開放。',type:'Hashgraph / 企業型公鏈',use:'支付、代幣化、企業應用與共識服務。',risk:'治理架構、企業採用與市場流動性是主要觀察點。'},
WLD:{name:'World / WLD',history:'2023 年推出代幣，專案聚焦數位身分與人類驗證。',type:'數位身分 / AI 敘事',use:'World ID、身分驗證與生態激勵。',risk:'隱私、監管、代幣解鎖及 AI 敘事敏感度高。'}
};
function coinBaseV2611(symbol){return String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'').replace(/^1000(?=[A-Z])/,'')}
function renderCoinProfileV2611(x){const base=assetBaseUiV2612(x?.symbol),tp=ASSET_PROFILES_UI_V2612[base]||null,p=COIN_PROFILE_V2611[base]||null,tradfi=assetClassUiV2612(x)==='TRADFI',sector=tp?.sector||x?.profile?.sector||p?.type||'加密資產',purpose=tp?.purpose||x?.profile?.purpose||p?.use||'用途與敘事需配合公開資料確認',name=tp?.name||p?.name||base,history=tp?.history||p?.history||`本機背景資料正在累積；量化排名不受影響。`,risk=tp?.risk||p?.risk||'以流動性、供需、事件與市場結構為主，不只看題材。',benchmark=tp?.benchmark|| (tradfi?'SPY / QQQ':'BTC / ETH'),session=x?.assetSessionLabel||x?.assetSession||(tradfi?'美股時段':'24H'),hit=Number.isFinite(Number(x?.historicalHitRate))?Number(x.historicalHitRate).toFixed(1)+'%':'—',sample=Number(x?.backtestSample||0),oi=Number.isFinite(Number(x?.metrics?.oiChangePct))?signed(x.metrics.oiChangePct,1):'—',taker=Number.isFinite(Number(x?.metrics?.takerRatio))?Number(x.metrics.takerRatio).toFixed(2):'—';return `<div class="coinProfileV2611 assetProfileV2612"><div class="coinProfileTitle"><div><b>${esc(name)}</b>${assetBadgeV2612(x)}</div><span>${esc(sector)}</span></div><div class="assetPulseV2612"><div><span>量化估算</span><b>${Number(x?.estimatedWinRate||0).toFixed(1)}%</b></div><div><span>排名分</span><b>${Number(x?.rankScore||0).toFixed(0)}</b></div><div><span>歷史1R</span><b>${hit} / ${sample}</b></div><div><span>OI / Taker</span><b>${oi} / ${taker}</b></div></div><div class="coinProfileGrid"><div><span>型態 / 類型</span><b>${esc(tp?.subtype||p?.type||sector)}</b></div><div><span>參考市場</span><b>${esc(benchmark)} · ${esc(session)}</b></div><div class="wide"><span>主要作用</span><b>${esc(purpose)}</b></div><div class="wide"><span>歷史 / 背景</span><b>${esc(history)}</b></div><div class="wide risk"><span>交易時要知道</span><b>${esc(risk)}</b></div></div><small>本機中文背景先即時顯示；展開時才偶爾補公開資訊，伺服器快取 6 小時，避免每次刷新都查網路。</small></div>`}

function ideaBiasClass(v){return v==='偏多'?'long':v==='偏空'?'short':'neutral'}
function ideaStrengthClass(v){return ['強','偏強'].includes(v)?'strong':['弱','偏弱'].includes(v)?'weak':'neutral'}
function renderIdeaAnalysisBody(d, symbol){
  if(!d?.ok)return '<div class="ideaAnalysisLoading">網搜暫時不可用。</div>';
  const bullish=(d.bullish||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>未見明確額外利多</li>';
  const bearish=(d.bearish||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>未見明確額外利空</li>';
  const news=(d.news||[]).map(x=>`<div class="ideaNewsItem ${x.tone==='利多'?'bull':x.tone==='利空'?'bear':'neutral'}"><span>${esc(x.tone||'中性')}</span><b>${esc(x.text||'')}</b></div>`).join('')||'<div class="ideaNewsEmpty">未見可靠的重大即時催化。</div>';
  const conflicts=(d.conflicts||[]).map(x=>`<span class="crossWarn">${esc(x)}</span>`).join('')||'<span class="crossOk">未見重大交叉衝突</span>';
  const watch=(d.watch||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>依即時結構與進場區持續監控</li>';
  return `<div class="ideaAnalysisStatus"><div><span>今日偏向</span><b class="${ideaBiasClass(d.bias)}">${esc(d.bias||'中性')}</b></div><div><span>強弱</span><b class="${ideaStrengthClass(d.strength)}">${esc(d.strength||'中性')}</b></div><div><span>交叉一致性</span><b>${esc(d.agreement||'—')}</b></div><div><span>更新</span><b>${localTime(d.generatedAt)||'剛剛'}</b></div></div><div class="ideaAnalysisProfile"><b>${esc(d.profile?.sector||'其他 / 新興資產')}</b><span>${esc(d.profile?.purpose||'')}</span></div>${d.summary?`<div class="ideaAnalysisSummary">${esc(d.summary)}</div>`:''}<div class="ideaEntryTiming"><span>現在怎麼做</span><b>${esc(d.entryTiming||d.action||'等結構確認，不追價。')}</b></div><div class="ideaAnalysisCols"><div><h4>利多</h4><ul>${bullish}</ul></div><div><h4>利空</h4><ul>${bearish}</ul></div></div><div class="crossConflict"><h4>交叉衝突</h4><div>${conflicts}</div></div><div class="crossWatch"><h4>接下來看什麼</h4><ul>${watch}</ul></div><div class="ideaNews"><h4>今日消息</h4>${news}</div><div class="ideaTodayAction"><span>今天怎麼對待</span><b>${esc(d.action||'等結構確認，不追價。')}</b></div><div class="ideaAnalysisFoot">${d.mode==='AI_WEB'?(d.cached?`公開資訊快取 · 剩 ${cacheRemainText(d.cacheExpiresInMs)}`:'公開資訊已更新 · 接下來6小時用快取'):'Binance量化'} · 即時量化持續更新 · 不追高/不追殺</div>`;
}
async function loadIdeaAnalysis(details){
  if(!details||details.dataset.loaded==='1'||details.dataset.loading==='1')return;
  const symbol=details.dataset.ideaSymbol||'',direction=details.dataset.ideaDir||'',key=`${symbol}:${direction}`,body=details.querySelector('[data-idea-analysis-body]');
  const cached=ideaAnalysisCache.get(key);if(cached&&Date.now()-cached.at<6*60*60*1000){const age=Date.now()-cached.at;body.innerHTML=renderIdeaAnalysisBody({...cached.data,cached:true,cacheAgeMs:age,cacheExpiresInMs:Math.max(0,6*60*60*1000-age)},symbol);details.dataset.loaded='1';return}
  details.dataset.loading='1';if(body)body.innerHTML='<div class="ideaAnalysisLoading">正在補充最新公開資訊…</div>';
  try{const d=await fetchIdeaAnalysisShared(symbol,direction);if(body)body.innerHTML=renderIdeaAnalysisBody(d,symbol);details.dataset.loaded='1'}catch(e){if(body)body.innerHTML='<div class="ideaAnalysisLoading">公開資訊暫時不可用；量化排名與本機背景仍正常。</div>'}finally{details.dataset.loading='0'}
}
function bindIdeaDetails(){bindPersistentDetails($('recGrid'));document.querySelectorAll('#recGrid details[data-idea-symbol]').forEach(d=>{if(d.dataset.ideaBound!=='1'){d.dataset.ideaBound='1';d.addEventListener('toggle',()=>{if(d.open)void loadIdeaAnalysis(d)})}if(d.open)void loadIdeaAnalysis(d)})}
function renderRankedIdeasCoreV2612(d){
  if(!d?.ok)return;rankedIdeasState=d;rankedIdeasFetchedAt=Date.now();
  const rows=d.rows||[];
  $('recGrid').innerHTML=rows.map((x,i)=>{const long=x.direction==='LONG',hit=Number.isFinite(Number(x.historicalHitRate))?`${Number(x.historicalHitRate).toFixed(1)}%`:'—',sample=Number(x.backtestSample||0),sector=x.profile?.sector||'其他 / 新興加密資產',purpose=x.profile?.purpose||'展開詳細可即時搜尋專案定位與今日催化';return `<article class="rankCard"><div class="rankHeadGrid"><div class="rankNo">${i+1}</div><div class="rankMain"><div class="rankTop">${tvAnchor(x.symbol,'tvNameLink rankSymbol')}${assetBadgeV2612(x)}<span class="recTag ${long?'long':'short'}">${long?'做多':'做空'}</span></div><div class="rankProfile"><span>${esc(sector)}</span><b>${esc(purpose)}</b></div></div><div class="rankWin"><b>${Number(x.estimatedWinRate||0).toFixed(1)}%</b><span>量化估算</span><small>${Number(x.rankScore||0).toFixed(0)}分</small></div></div><div class="rankReason">${esc(x.reason||'')}</div><div class="rankMini">模型 ${Number(x.modelScore||0)} · 歷史命中 ${hit} / ${sample} · OI ${signed(x.metrics?.oiChangePct||0,1)}</div><details class="ideaDetail coinProfileDetailV2611 assetDetailV2612" data-idea-symbol="${esc(x.symbol)}" data-idea-dir="${esc(x.direction)}" data-persist-detail="idea:${esc(x.symbol)}:${esc(x.direction)}" ${detailOpenAttr(`idea:${x.symbol}:${x.direction}`)}><summary><span>展開</span></summary><div class="ideaDetailBody"><div data-idea-local-profile>${renderCoinProfileV2611(x)}</div><div class="assetPublicV2612" data-idea-analysis-body><div class="ideaAnalysisLoading">公開資訊會在展開時依快取需要更新。</div></div></div></details></article>`}).join('')||'<div class="loadingBox">目前沒有高一致性方向。</div>';
  bindIdeaDetails();$('ideaAge').textContent=d.stale?'快照':ageText(d.generatedAt);
}
function renderRankedIdeasBaseV2617(d){rankedIdeasMasterV2612=d;mountAssetSwitchesV2612();const rows=(d?.rows||[]).filter(x=>ideaAssetViewV2612==='ALL'||assetClassUiV2612(x)===ideaAssetViewV2612);renderRankedIdeasCoreV2612({...d,rows});rankedIdeasState=d;rankedIdeasFetchedAt=Date.now();syncAssetSwitchesV2612()}
function renderRankedIdeasFallbackV2616(d){const grid=$('recGrid');if(!grid)return;const rows=(d?.rows||[]).slice(0,16);grid.innerHTML=rows.map((x,i)=>{const dir=x?.direction==='SHORT'?'SHORT':'LONG',reason=String(x?.reason||x?.profile?.purpose||'等待更多市場資料'),rate=Number(x?.estimatedWinRate);return `<article class="rankCard"><div class="rankHeadGrid"><div class="rankNo">${i+1}</div><div class="rankMain"><div class="rankTop">${tvAnchor(x?.symbol||'', 'tvNameLink rankSymbol')}<span class="recTag ${dir==='SHORT'?'short':'long'}">${dir==='SHORT'?'做空':'做多'}</span></div><div class="rankProfile"><span>影子建議</span><b>${esc(x?.profile?.purpose||'結構與市場資料交叉判斷')}</b></div></div><div class="rankWin"><b>${Number.isFinite(rate)?rate.toFixed(1)+'%':'—'}</b><span>量化估算</span></div></div><div class="rankReason">${esc(reason)}</div></article>`}).join('')||'<div class="loadingBox">目前沒有可顯示的建議；系統會自動重試。</div>';try{window.dispatchEvent(new CustomEvent('ranked-ideas:rendered'))}catch{}}
function safeRenderRankedIdeasV2616(d){try{renderRankedIdeas(d)}catch(e){console.warn('[v2616] recommendation render fallback',e);renderRankedIdeasFallbackV2616(d)}}
function renderRankedIdeas(d){
  const sig=rankSignatureV2617(d),grid=$('recGrid'),root=document.querySelector('.pageTab.active')?.dataset?.page==='ideas'?(document.querySelector('.page.active')||grid):grid;
  rankedIdeasState=d;
  if(pageFreezeCurrentV2619()==='ideas'&&pageFreezeIsV2619('ideas')&&grid?.children?.length){pageFreezePendingV2619.ideas=d;pageFreezeSyncV2619();return}
  if(sig===lastRankSigV2617&&grid?.children?.length){pageFreezePendingV2619.ideas=null;pageFreezeSyncV2619();return}
  const a=captureViewportAnchorV2617(root);lastRankSigV2617=sig;pageFreezePendingV2619.ideas=null;renderRankedIdeasBaseV2617(d);restoreViewportAnchorV2617(root,a);pageFreezeSyncV2619()
}

async function refreshRankedIdeas(force=false){
  if(rankedIdeasBusy)return;if(!force&&rankedIdeasState&&Date.now()-rankedIdeasFetchedAt<60_000){safeRenderRankedIdeasV2616(rankedIdeasState);return}
  rankedIdeasBusy=true;try{const r=await fetch('/api/ranked-ideas',{cache:'no-cache'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);safeRenderRankedIdeasV2616(d)}catch(e){if(rankedIdeasState)safeRenderRankedIdeasV2616({...rankedIdeasState,stale:true});else $('recGrid').innerHTML='<div class="loadingBox">量化排名暫時不可用。</div>'}finally{rankedIdeasBusy=false}
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
function testTierLabel(x){return({HIGH:'影子 A',NORMAL:'影子 B',VALID:'觀察',BLOCKED:'暫停'})[String(x?.notificationTier||'VALID').toUpperCase()]||'觀察'}
function testTierClass(x){return String(x?.notificationTier||'VALID').toLowerCase()}
function testMonitorTierLabel(x){return({HIGH:'影子 A 通知',NORMAL:'影子 B 通知'})[testMonitorNoticeTier(x)]||'已通知'}
function testMonitorTierClass(x){return testMonitorNoticeTier(x)==='HIGH'?'high':'normal'}
function testMonitorExpiryText(x){const at=testMonitorNoticeMs(x),ttl=Number(testSignalsState?.monitor?.ttlMs||4*60*60*1000),explicit=x?.monitorExpiresAt?Date.parse(x.monitorExpiresAt):0,expires=Number.isFinite(explicit)&&explicit>0?explicit:at+ttl,left=Math.max(0,expires-Date.now());if(left<=0)return'已過期';const min=Math.ceil(left/60000);return min>=60?`約 ${Math.ceil(min/60)} 小時後到期`:`約 ${min} 分後到期`}
function testNotifyGateText(x){const tier=String(x?.notificationTier||'VALID').toUpperCase(),g=x?.notificationGate||{},adj=Number(g.learningAdjustment||0),learn=adj?`｜狀態學習 ${adj>0?'+':''}${adj}`:'';if(tier==='HIGH')return`影子 A 通知條件通過${learn}`;if(tier==='NORMAL')return`影子 B 通知條件通過${learn}`;if(tier==='BLOCKED')return`暫停：${(g.blockers||[]).slice(0,3).join('、')||'風險條件未通過'}${learn}`;return`未達普通：${(g.normalMissing||[]).slice(0,3).join('、')||'等待更多同向條件'}${learn}`}
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
function testStructureStop(x){if(testIsReentryReady(x)&&hasNum(x.reentryStop))return Number(x.reentryStop);if(hasNum(x.structureProtection))return Number(x.structureProtection);if(hasNum(x.stop))return Number(x.stop);if(hasNum(x?.strategyAtConfirm?.invalidation))return Number(x.strategyAtConfirm.invalidation);if(hasNum(x?.strategyProfile?.invalidation))return Number(x.strategyProfile.invalidation);if(x?.setup&&hasNum(x.setup.invalidation))return Number(x.setup.invalidation);return null}
function testNoticeZone(x){
  const lo=Number(x?.lastEntryNotificationPreferredLow),hi=Number(x?.lastEntryNotificationPreferredHigh);
  if(Number.isFinite(lo)&&Number.isFinite(hi))return {low:Math.min(lo,hi),high:Math.max(lo,hi)};
  const zlo=Number(x?.lastEntryNotificationZoneLow),zhi=Number(x?.lastEntryNotificationZoneHigh);
  if(Number.isFinite(zlo)&&Number.isFinite(zhi))return {low:Math.min(zlo,zhi),high:Math.max(zlo,zhi)};
  return null;
}
function testNotifyPoint(x){const snap=Number(x?.lastEntryNotificationPrice);if(Number.isFinite(snap)&&snap>0)return snap;return Number(testIsReentryReady(x)?x.reentryEntryPrice:x.confirmationPrice)||null}
function testMonitorActionable(x){
  if(!x||testIsStale(x))return false;
  const status=String(x.status||''),state=String(x.monitorState||''),tier=String(x.notificationTier||'VALID').toUpperCase();
  if(status==='INVALID'||status==='DROPPED'||state==='WEAKENING')return false;
  if(testIsReachedWaiting(x))return false;
  if(testIsReentryReady(x))return ['HIGH','NORMAL'].includes(tier);
  return ['HIGH','NORMAL'].includes(tier);
}
function testMonitorSuggestedZone(x){
  if(!testMonitorActionable(x))return null;
  const z=testPreferredZone(x);if(!z)return null;
  const dir=x.direction==='SHORT'?-1:1,stop=testStructureStop(x),target=hasNum(x.target1R)?Number(x.target1R):null;
  if(Number.isFinite(stop)){
    if(dir>0&&z.low<=stop)return null;
    if(dir<0&&z.high>=stop)return null;
  }
  if(Number.isFinite(target)){
    if(dir>0&&z.high>=target)return null;
    if(dir<0&&z.low<=target)return null;
  }
  return z;
}
function testSuggestedPoint(x){const z=testMonitorSuggestedZone(x);return z?(z.low+z.high)/2:null}
function testEntryPlanMarkup(x){
  const saved=loadTestEntryPlans()[x.key]||{},zone=testMonitorSuggestedZone(x),zoneText=zone?`${price(zone.low)}～${price(zone.high)}`:'等待模型區間';
  const v=k=>saved[k]??'';
  return `<div class="testEntryPlanner" data-test-planner="${esc(x.key)}"><div class="testPlannerHead"><div><b>進場參考</b><span>依目前最佳策略 / 不追價邏輯，輸入部位後即時計算</span></div><span class="plannerTier ${testTierClass(x)}">${esc(testTierLabel(x))}</span></div><div class="testPlannerGrid"><div class="planEntryField"><label><span>預計進場</span><input data-plan-field="entry" inputmode="decimal" type="number" step="any" value="${esc(v('entry'))}" placeholder="${zone?price((zone.low+zone.high)/2):'點位'}"></label><div class="planEntryButtons"><button type="button" data-plan-use="suggested">建議價</button><button type="button" data-plan-use="notify">通知價</button><button type="button" data-plan-use="current">當下價</button></div></div><label><span>保證金 U</span><input data-plan-field="margin" inputmode="decimal" type="number" min="0" step="1" value="${esc(v('margin'))}" placeholder="300"></label><label><span>槓桿</span><input data-plan-field="lev" inputmode="numeric" type="number" min="1" max="125" step="1" value="${esc(v('lev'))}" placeholder="20"></label><label><span>想盈利 U</span><input data-plan-field="profit" inputmode="decimal" type="number" min="0" step="1" value="${esc(v('profit'))}" placeholder="100"></label><label><span>可虧損 U</span><input data-plan-field="loss" inputmode="decimal" type="number" min="0" step="1" value="${esc(v('loss'))}" placeholder="空白＝盈利÷2"></label></div><div class="testPlannerPointRow"><div><span>通知點位</span><b>${hasNum(testNotifyPoint(x))?price(testNotifyPoint(x)):'—'}</b></div><div><span>當下點位</span><b>${hasNum(x.currentPrice)?price(x.currentPrice):'—'}</b></div><div><span>建議進場</span><b>${hasNum(testSuggestedPoint(x))?price(testSuggestedPoint(x)):'—'}</b></div></div><div class="testPlannerOut"><div><span>較佳進場區</span><b data-plan-zone>${zoneText}</b></div><div><span>數量</span><b data-plan-qty>—</b></div><div><span>TP 參考</span><b data-plan-tp>—</b></div><div><span>結構 SL</span><b data-plan-sl>—</b></div><div><span>RR</span><b data-plan-rr>—</b></div><div><span>結構風險</span><b data-plan-risk>—</b></div></div><div class="testPlannerAdvice"><span>建議</span><b data-plan-advice>輸入預計進場、保證金與槓桿後計算。</b></div></div>`;
}
function updateTestPlanner(box){
  if(!box)return;const x=testSignalByKey(box.dataset.testPlanner);if(!x)return;
  const get=k=>box.querySelector(`[data-plan-field="${k}"]`),num=k=>{const v=Number(get(k)?.value);return Number.isFinite(v)&&v>0?v:null};
  const zone=testMonitorSuggestedZone(x),full=testFullEntryZone(x),dir=x.direction==='SHORT'?-1:1,entryInput=num('entry'),entry=entryInput||(zone?(zone.low+zone.high)/2:null),margin=num('margin'),lev=num('lev'),profitInput=num('profit'),lossInput=num('loss');
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
    else if(tooDeep)advice='你的預計價已超過完整策略區，代表結構可能正在變差；不要為了便宜硬接，等重新確認。';
    else if(structRisk&&loss&&structRisk>loss*1.10)advice=`點位在可接受區，但目前部位的結構停損約 ${structRisk.toFixed(structRisk>=100?0:1)}U，高於你設定 ${loss.toFixed(0)}U；降低保證金／槓桿或等更佳進場。`;
    else if(tier==='HIGH')advice='高勝率條件目前通過；只在較佳區內等 5 分 K 收回後分批，不追價。';
    else if(tier==='NORMAL')advice='普通勝率條件完整，未見明顯衰弱；仍只做目前最佳策略確認，不追價。';
    else advice='訊號有效但優勢未達高／普通級；若要做，只接受目前策略區間內確認。';
  }else if(zone)advice=`目前較佳進場區 ${price(zone.low)}～${price(zone.high)}；輸入你的預計點位即可判斷是否追價。`;
  if(qty&&profit&&tp)advice+=` 以目前部位，+${profit.toFixed(0)}U 約對應 TP ${price(tp)}。`;
  set('[data-plan-advice]',advice);
}
function bindTestPlanners(root=document){root.querySelectorAll?.('[data-test-planner]').forEach(box=>{updateTestPlanner(box);box.querySelectorAll('[data-plan-field]').forEach(inp=>inp.addEventListener('input',()=>updateTestPlanner(box)));box.querySelectorAll('[data-plan-use]').forEach(btn=>btn.addEventListener('click',()=>{const x=testSignalByKey(box.dataset.testPlanner),inp=box.querySelector('[data-plan-field="entry"]');if(!x||!inp)return;const kind=btn.dataset.planUse;let v=null;if(kind==='current')v=Number(x.currentPrice);else if(kind==='notify')v=testNotifyPoint(x);else v=testSuggestedPoint(x);if(Number.isFinite(v)&&v>0){inp.value=v;updateTestPlanner(box)}}))})}

function testMonitorExpired(x){
  const at=testMonitorNoticeMs(x);if(!(at>0))return true;
  // C 模式：手動 X 為主；DROPPED 已代表硬結構失守或連續弱勢K＋高週期逆向確認。
  const droppedAt=x?.droppedAt?Date.parse(x.droppedAt):0;
  if(String(x?.status||'')==='DROPPED'&&Number.isFinite(droppedAt)&&droppedAt>=at)return true;
  const ttl=Number(testSignalsState?.monitor?.ttlMs||4*60*60*1000),explicit=x?.monitorExpiresAt?Date.parse(x.monitorExpiresAt):0,expires=Number.isFinite(explicit)&&explicit>0?explicit:at+ttl;
  return Date.now()>=expires;
}
function testIsMonitorQualified(x){
  const tier=testMonitorNoticeTier(x);
  return testMonitorNoticeMs(x)>0&&['HIGH','NORMAL'].includes(tier)&&!testMonitorExpired(x);
}
function testMonitorCandidates(){
  if(!testSignalsState)return[];
  const rows=testSignalsState.rows||[],picked=new Map();
  // 只要曾經真正送出 HIGH / NORMAL，就保留在獨立系統監控佇列；目前變 BLOCKED、失效、達標都不會自己消失。
  rows.forEach(x=>{if(testIsMonitorQualified(x)&&!isTestJudgementDismissed(x))picked.set(x.key,x)});
  if(testFocusSymbol){const x=rows.find(r=>r.symbol===testFocusSymbol&&(!testFocusDirection||r.direction===testFocusDirection))||rows.find(r=>r.symbol===testFocusSymbol);if(x&&testIsMonitorQualified(x)){clearTestJudgementDismiss(x.key);picked.set(x.key,x)}}
  return [...picked.values()].sort((a,b)=>testMonitorNoticeMs(b)-testMonitorNoticeMs(a)||Number(b.priorityScore||0)-Number(a.priorityScore||0));
}
function testReachedCandidates(){return[]}
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
  return `${sourceHealth}<div class="testCrossIntro"><div><span>目前狀態</span><b>${esc(state)}</b></div><div><span>觀察排名 / 市場熱度</span><b>#${x.observationRank||'—'} / ${x.rank?`#${x.rank}`:'—'} · 熱度 ${hasNum(x.rankHeat)?Number(x.rankHeat).toFixed(0):'—'}</b></div><div><span>校準勝率</span><b>${win>=0?win.toFixed(1)+'%':'—'}${confirmed!=null&&win>=0?` · ${win-confirmed>=0?'+':''}${(win-confirmed).toFixed(1)}`:''}</b></div><div><span>進場策略</span><b>${esc(x.entryStrategy||'等最佳策略完成，不追價')}</b></div></div>
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
  const dynamic=hasNum(x.monitorScore)?Number(x.monitorScore).toFixed(0):'—',protect=hasNum(x.structureProtection)?price(x.structureProtection):(hasNum(x.stop)?price(x.stop):'—'),breakout=hasNum(x.breakoutLevel)?price(x.breakoutLevel):'—',topRatio=hasNum(x.monitorEvidence?.topPositionRatio)?Number(x.monitorEvidence.topPositionRatio).toFixed(2):'—',depth=hasNum(x.monitorEvidence?.depthImbalance)?`${Number(x.monitorEvidence.depthImbalance)>0?'+':''}${(Number(x.monitorEvidence.depthImbalance)*100).toFixed(1)}%`:'—',h1=x.monitorEvidence?.adverse1h?'逆向':'正常',ciLow=hasNum(x.winRateMeta?.conservativeLow)?`${Number(x.winRateMeta.conservativeLow).toFixed(1)}%`:'—',ciHigh=hasNum(x.winRateMeta?.confidenceHigh)?`${Number(x.winRateMeta.confidenceHigh).toFixed(1)}%`:'—',invalidWindow=testInvalidWindowText(x),invalidReason=testInvalidReasonText(x);
  const rankNow=Number(x.rank||0),priority=hasNum(x.priorityScore)?Number(x.priorityScore).toFixed(0):'—',heat=hasNum(x.rankHeat)?Number(x.rankHeat).toFixed(0):'—';
  const reZone=hasNum(x.reentryZoneLow)&&hasNum(x.reentryZoneHigh)?`${price(x.reentryZoneLow)}～${price(x.reentryZoneHigh)}`:'—',reScore=hasNum(x.reentryScore)?Number(x.reentryScore).toFixed(0):'—',reEntry=hasNum(x.reentryEntryPrice)?price(x.reentryEntryPrice):'—',reStop=hasNum(x.reentryStop)?price(x.reentryStop):'—',reTarget=hasNum(x.reentryTarget1R)?price(x.reentryTarget1R):'—';
  const reMeta=(x.reentryReasons||[]).length?`二進：${(x.reentryReasons||[]).map(esc).join('、')}`:'',adl=String(x.monitorEvidence?.adlRisk||x.lastCheck?.adlRisk||'—').toUpperCase(),fund=hasNum(x.monitorEvidence?.fundingPct)?`${Number(x.monitorEvidence.fundingPct).toFixed(4)}%`:hasNum(x.lastCheck?.fundingPct)?`${Number(x.lastCheck.fundingPct).toFixed(4)}%`:'—';
  const strategy=stale?'資料過期，暫停採用這筆進場判讀':esc(x.entryStrategy||'回踩區內等確認，不追價');
  const currentSuggestedZone=testMonitorSuggestedZone(x),preferred=currentSuggestedZone?`${price(currentSuggestedZone.low)}～${price(currentSuggestedZone.high)}`:'暫停進場';
  const noticeZone=testNoticeZone(x),noticeZoneText=noticeZone?`${price(noticeZone.low)}～${price(noticeZone.high)}`:'—';
  const suggestedMid=currentSuggestedZone?(Number(currentSuggestedZone.low)+Number(currentSuggestedZone.high))/2:null,notifyPoint=testNotifyPoint(x),currentPoint=Number(x.currentPrice);
  const stateLabel=esc(x.monitorLabel||x.statusLabel||'監控中');
  return `<details class="testMonitorItem ${isFocus?'focused':''} ${stale?'dataStale':''}" data-test-judge="${esc(x.key)}" ${open?'open':''}>
    <button type="button" class="judgeDismissBtn" data-test-dismiss="${esc(x.key)}" aria-label="從監控判讀移除 ${esc(x.symbol)}" title="移除這筆；下次新訊號會再出現">×</button>
    <summary>
      <div class="judgeLead">
        <div class="judgeTitleRow"><span class="testMonitorIndex">${i+1}.</span>${tvAnchor(x.symbol,'testMonitorSymbol tvNameLink')}${assetBadgeV2612(x)}<span class="testMonitorRankTag">${rankNow?`排名 ${rankNow}`:'排名 —'}</span>${freshTag}</div>
        <div class="judgeBadgeRow">${testTrendTag(x)}<span class="testMonitorDir ${long?'long':'short'}">${long?'做多':'做空'}</span><span class="testTierTag ${testMonitorTierClass(x)}">${esc(testMonitorTierLabel(x))}</span><span class="testMonitorState">${stateLabel}</span>${invalidWindow?`<span class="testMonitorRecover">${esc(invalidWindow)}</span>`:''}</div>
        <div class="judgeTimeRow"><span>通知 ${localTime(testMonitorNoticeAt(x))||signalTime} · ${esc(testMonitorExpiryText(x))}</span><b>更新 ${evalTime}</b></div>
      </div>
      <div class="judgePriceStrip"><div><span>通知點位</span><b>${hasNum(notifyPoint)?price(notifyPoint):'—'}</b><small>${noticeZone?`通知區 ${esc(noticeZoneText)}`:'實際送達價'}</small></div><div><span>當下點位</span><b>${hasNum(currentPoint)?price(currentPoint):'—'}</b><small>${stale?'現價仍更新':'即時價'}</small></div><div><span>目前建議進場</span><b>${hasNum(suggestedMid)?price(suggestedMid):'暫停'}</b><small>${hasNum(suggestedMid)?esc(preferred):(stale?'等判讀恢復':'目前未達可再次進場條件')}</small></div></div>
      <div class="testMonitorSummaryScore"><b>${winText}</b><span>${stale?'資料過期':'目前勝率'}</span><small>成立 ${confirmedRate}${delta?` · ${delta}`:''}</small></div>
    </summary>
    <div class="testMonitorBody">
      ${stale?`<div class="judgeStaleWarning">⚠ 資料已過期。現價可看，但勝率與進場建議暫停採用。</div>`:''}
      <div class="judgeCoreGrid">
        <div class="judgeCoreCell important"><span>當日排名 / 熱度</span><b>${rankNow?`${rankNow}`:'—'} / ${heat}</b></div>
        <div class="judgeCoreCell"><span>動態強度</span><b>${stale?'—':dynamic}</b></div>
        <div class="judgeCoreCell"><span>成立時勝率</span><b>${confirmedRate}</b></div>
        <div class="judgeCoreCell"><span>目前勝率</span><b>${winText}${delta?` · ${delta}`:''}</b></div>
        <div class="judgeCoreCell wide"><span>通知時建議區</span><b>${esc(noticeZoneText)}</b></div><div class="judgeCoreCell wide"><span>目前較佳進場區</span><b>${stale?'資料恢復後重算':esc(preferred)}</b></div>
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
        <div class="testFocusCell"><span>完整策略區</span><b>${esc(testZoneText(x.setup))}</b></div><div class="testFocusCell"><span>確認價</span><b>${hasNum(x.confirmationPrice)?price(x.confirmationPrice):'等待確認'}</b></div>
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
      <div class="testFocusActions"><button type="button" class="closeJudge" data-test-collapse-one>縮小此筆</button><button type="button" class="actualEntryBtn" data-actual-trade="${esc(x.key)}">實際建倉</button><button type="button" class="removeJudge" data-test-dismiss="${esc(x.key)}">移除判讀</button></div>
    </div>
  </details>`;
}

function renderReachedPool(rows){
  if(!rows.length)return'';
  const items=rows.map(x=>{const stale=testIsStale(x),win=testEffectiveWinRate(x),re=x.reentryStage==='WAIT_PULLBACK'?'等二次回踩':x.reentryStage==='WIN'?'二進達標':x.reentryStage==='FAILED'?'二進失效':'達標',zone=hasNum(x.reentryZoneLow)&&hasNum(x.reentryZoneHigh)?`${price(x.reentryZoneLow)}～${price(x.reentryZoneHigh)}`:'尚未形成';return `<div class="reachedRow ${stale?'dataStale':''}"><div><b>${tvAnchor(x.symbol,'tvNameLink reachedSymbol')}</b><span>排名 ${Number(x.rank||0)||'—'} · 達標 ${localTime(x.targetReachedAt)} · 更新 ${testLastEvalTime(x)} · ${re}</span></div><div><strong>${stale?'—':win>=0?win.toFixed(1)+'%':'—'}</strong><small>${stale?'資料過期':'二踩 '+zone}</small></div></div>`}).join('');
  return `<details class="reachedPool" data-persist-detail="monitorReachedPool" ${detailOpenAttr('monitorReachedPool')}><summary><span>達標池</span><b>${rows.length}</b><small>預設收起 · 出現二次回踩/二次確認會自動回到上方並通知</small></summary><div class="reachedList">${items}</div></details>`;
}
function monitorHistoryResultLabel(x){if(x?.status==='ACTIVE')return'追蹤中';if(x?.result==='WIN')return'1R達標';if(x?.result==='LOSS')return'失效';if(x?.result==='TIMEOUT')return'逾時';return x?.status||'已記錄'}
function monitorHistoryResultClass(x){return x?.result==='WIN'?'win':x?.result==='LOSS'?'loss':x?.status==='ACTIVE'?'active':'timeout'}
// UI_POLISH_V2610: pin user-entered Actual Trades above system monitor signals.
// Resolved records stay visible here for 24h (server-side window) or until the local X is pressed.
// Hiding from this monitor history never deletes the audited Actual Trade / performance record.
const ACTUAL_MONITOR_HISTORY_HIDE_PREF_V2610='position-alert-actual-monitor-history-hidden-v2610';
function actualMonitorRowsV2610(kind='active'){const a=testSignalsState?.actualMonitor;return Array.isArray(a?.[kind])?a[kind]:[]}
function actualMonitorRecordV2610(id){return [...actualMonitorRowsV2610('active'),...actualMonitorRowsV2610('recent')].find(x=>x?.id===id)||null}
function actualMonitorHiddenV2610(){try{const d=JSON.parse(localStorage.getItem(ACTUAL_MONITOR_HISTORY_HIDE_PREF_V2610)||'{}');return d&&typeof d==='object'?d:{}}catch{return{}}}
function actualMonitorHideHistoryV2610(id){if(!id)return;try{const d=actualMonitorHiddenV2610();d[id]=Date.now();const rows=Object.entries(d).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0)).slice(0,120);localStorage.setItem(ACTUAL_MONITOR_HISTORY_HIDE_PREF_V2610,JSON.stringify(Object.fromEntries(rows)))}catch{}renderTestFocus()}
function actualMonitorPnlTextV2610(v){if(!hasNum(v))return'—';const n=Number(v);return`${n>0?'+':''}${n.toFixed(Math.abs(n)>=100?0:Math.abs(n)>=10?1:2)} U`}
function actualMonitorPnlClassV2610(v){const n=Number(v);return!Number.isFinite(n)||Math.abs(n)<1e-9?'flat':n>0?'profit':'loss'}
function actualMonitorResultTextV2610(x){if(x?.status==='ACTIVE')return'追蹤中';if(x?.result==='WIN')return'TP 完成';if(x?.result==='LOSS')return'SP 失效';if(x?.result==='MANUAL')return'手動結束';return x?.firstOutcome==='WIN'?'曾先碰 TP':x?.firstOutcome==='LOSS'?'曾先碰 SP':'已結束'}
function actualMonitorTimeTextV2610(x){const iso=x?.resultAt||x?.updatedAt||x?.createdAt;return iso?`${perfDateTime(iso)} · ${ageText(iso)}`:'—'}
function actualMonitorLevelsV2610(x){const tps=[x?.tp1,x?.tp2].filter(hasNum).map(price).join(' / ')||'—',sps=[x?.sp1,x?.sp2].filter(hasNum).map(price).join(' / ')||'—';return {tps,sps}}
function actualMonitorActiveCardV2610(x){
  const long=x?.direction!=='SHORT',lv=actualMonitorLevelsV2610(x),pnlv=hasNum(x?.livePnl)?Number(x.livePnl):null,pnlText=actualMonitorPnlTextV2610(pnlv),hit=x?.tp1Hit&&!x?.tp2Hit?'TP1 已到':x?.tp2Hit?'TP2 已到':x?.sp1Hit||x?.sp2Hit?'SP 已到':'即時追蹤';
  return `<article class="actualMonitorCardV2610 ${long?'long':'short'}"><div class="actualMonitorTopV2610"><div><span class="actualMonitorLiveTagV2610">實倉</span>${tvAnchor(x.symbol,'tvNameLink actualMonitorSymbolV2610')}<span class="actualMonitorDirV2610 ${long?'long':'short'}">${long?'做多':'做空'}</span></div><b class="actualMonitorPnlV2610 ${actualMonitorPnlClassV2610(pnlv)}">${pnlText}</b></div><div class="actualMonitorMetaV2610"><span>建倉 ${perfDateTime(x.createdAt)}</span><span>${esc(hit)}</span></div><div class="actualMonitorPriceGridV2610"><div><span>成本</span><b>${price(x.entryPrice)}</b></div><div><span>當下</span><b>${hasNum(x.lastPrice)?price(x.lastPrice):'—'}</b></div><div><span>TP1 / TP2</span><b>${lv.tps}</b></div><div><span>SP1 / SP2</span><b>${lv.sps}</b></div></div><div class="actualMonitorActionsV2610"><button type="button" data-actual-monitor-edit="${esc(x.id)}">修改</button><button type="button" class="end" data-actual-monitor-close="${esc(x.id)}">結束追蹤</button></div></article>`;
}
function actualMonitorHistoryRowV2610(x){const long=x?.direction!=='SHORT',pnlv=hasNum(x?.estimatedPnl)?Number(x.estimatedPnl):null;return `<div class="actualMonitorHistoryRowV2610"><div class="actualMonitorHistoryMainV2610"><div>${tvAnchor(x.symbol,'tvNameLink actualMonitorHistorySymbolV2610')}<span class="actualMonitorDirV2610 ${long?'long':'short'}">${long?'多':'空'}</span><b class="actualMonitorHistoryResultV2610 ${String(x?.result||'').toLowerCase()}">${esc(actualMonitorResultTextV2610(x))}</b></div><span>${actualMonitorTimeTextV2610(x)} · 成本 ${price(x.entryPrice)}</span></div><div class="actualMonitorHistoryRightV2610"><b class="${actualMonitorPnlClassV2610(pnlv)}">${actualMonitorPnlTextV2610(pnlv)}</b><button type="button" data-actual-history-hide="${esc(x.id)}" aria-label="從監控歷史隱藏 ${esc(x.symbol)}" title="只從監控歷史隱藏，不刪除績效紀錄">×</button></div></div>`}
const ACTUAL_MONITOR_FOLD_PREF_V2619='position-alert-actual-monitor-fold-v2619';
function actualMonitorFoldOpenV2619(){try{const v=localStorage.getItem(ACTUAL_MONITOR_FOLD_PREF_V2619);return v===null?true:v==='1'}catch{return true}}
function actualMonitorFoldSaveV2619(v){try{localStorage.setItem(ACTUAL_MONITOR_FOLD_PREF_V2619,v?'1':'0')}catch{}}
function renderActualMonitorV2610(panel){
  if(!panel)return;panel.querySelector('.actualMonitorV2610')?.remove();
  const active=actualMonitorRowsV2610('active'),hidden=actualMonitorHiddenV2610(),recent=actualMonitorRowsV2610('recent').filter(x=>!hidden[x.id]);
  if(!active.length&&!recent.length)return;
  const shell=document.createElement('section');shell.className='actualMonitorV2610';
  const historyHours=Number(testSignalsState?.actualMonitor?.historyHours||24),open=actualMonitorFoldOpenV2619();
  shell.innerHTML=`<details class="actualMonitorFoldV2619" ${open?'open':''}><summary><div class="actualMonitorHeadV2610"><div><span>MY ACTUAL TRADES</span><div class="actualMonitorFoldTitleV2619"><b>我的實際建倉</b><span class="actualMonitorFoldActionV2619">${open?'縮小':'展開'}</span></div><small>實倉固定保留在監控 · 可獨立縮小 · 不受排行與觀察更新影響</small></div><em>${active.length} ACTIVE</em></div></summary><div class="actualMonitorFoldBodyV2619">${active.length?`<div class="actualMonitorListV2610">${active.map(actualMonitorActiveCardV2610).join('')}</div>`:'<div class="actualMonitorEmptyV2610">目前沒有追蹤中的實際建倉。</div>'}<details class="actualMonitorHistoryV2610" data-persist-detail="actualMonitorHistoryV2610" ${detailOpenAttr('actualMonitorHistoryV2610')}><summary><span>歷史</span><b>${recent.length}</b><small>結束後保留 ${historyHours} 小時 · × 可立即隱藏</small><i>⌄</i></summary><div class="actualMonitorHistoryListV2610">${recent.length?recent.map(actualMonitorHistoryRowV2610).join(''):`<div class="actualMonitorHistoryEmptyV2610">近 ${historyHours} 小時沒有已結束的實際建倉。</div>`}<small class="actualMonitorHistoryNoteV2610">× 或到期只會從「監控」畫面消失；績效、CSV、Railway Volume 原始紀錄仍完整保留。</small></div></details></div></details>`;
  const header=panel.querySelector('.testMonitorHeader');if(header)header.insertAdjacentElement('afterend',shell);else panel.prepend(shell);
  const fold=shell.querySelector('.actualMonitorFoldV2619');fold?.addEventListener('toggle',()=>{actualMonitorFoldSaveV2619(fold.open);const x=fold.querySelector('.actualMonitorFoldActionV2619');if(x)x.textContent=fold.open?'縮小':'展開'});
  bindPersistentDetails(shell);
}

window.addEventListener('actual-trade:saved',()=>{setTimeout(()=>void refreshTestSignals(true),80)});
document.addEventListener('click',e=>{
  const edit=e.target?.closest?.('[data-actual-monitor-edit]');if(edit){e.preventDefault();e.stopPropagation();const rec=actualMonitorRecordV2610(edit.dataset.actualMonitorEdit);if(rec)openActualTradeRecordModal(rec);return}
  const close=e.target?.closest?.('[data-actual-monitor-close]');if(close){e.preventDefault();e.stopPropagation();void (async()=>{await closeActualTrackedTrade(close.dataset.actualMonitorClose);setTimeout(()=>void refreshTestSignals(true),180)})();return}
  const hide=e.target?.closest?.('[data-actual-history-hide]');if(hide){e.preventDefault();e.stopPropagation();actualMonitorHideHistoryV2610(hide.dataset.actualHistoryHide)}
},true);
function renderMonitorHistory(rows){
  const list=(rows||[]).slice(0,40);if(!list.length)return'';
  const items=list.map(x=>{const restore=monitorHistoryRestorable(x);return `<div class="monitorHistoryRow"><div class="monitorHistoryMain"><div>${tvAnchor(x.symbol,'tvNameLink monitorHistorySymbol')}<span class="testMonitorDir ${x.direction==='SHORT'?'short':'long'}">${x.direction==='SHORT'?'做空':'做多'}</span><span class="testTierTag ${String(x.tier||'NORMAL').toLowerCase()}">${esc(x.tier==='HIGH'?'高勝率':'普通')}</span></div><span>${perfDateTime(x.notificationAt)} · ${esc(x.strategyLabel||'未分類')}${x.phase==='REENTRY'?' · 二次進場':''}</span></div><div class="monitorHistoryRight"><div class="monitorHistoryActions"><button type="button" data-monitor-history-edit="${esc(x.id)}">修改</button>${restore?`<button type="button" class="restore" data-monitor-history-restore="${esc(x.signalKey)}">恢復監控</button>`:''}</div><div class="monitorHistoryResult ${monitorHistoryResultClass(x)}"><b>${esc(monitorHistoryResultLabel(x))}</b><span>${hasNum(x.entryPrice)?price(x.entryPrice):'—'} → ${x.status==='ACTIVE'?'追蹤中':hasNum(x.result==='WIN'?x.target:x.stop)?price(x.result==='WIN'?x.target:x.stop):'—'}</span></div></div></div>`}).join('');
  return `<details class="monitorHistoryPool" data-persist-detail="monitorNoticeHistory" ${detailOpenAttr('monitorNoticeHistory')}><summary><span>通知歷史</span><b>${list.length}</b><small>可修改實際建倉；手動移除可在結構崩壞前恢復監控</small></summary><div class="monitorHistoryList">${items}</div></details>`;
}
function renderTestFocus(){
  const panel=$('testFocusPanel');if(!panel)return;
  if(!testSignalsState){if(testFocusSymbol){panel.classList.add('show');panel.innerHTML='<div class="testMonitorTitle">系統訊號監控</div><div class="testMonitorSub">載入訊號中…</div>'}else{panel.classList.remove('show');panel.innerHTML=''}return}
  let rows=testMonitorCandidates();const history=testSignalsState?.monitorHistory||[],actualMonitor=testSignalsState?.actualMonitor||{},actualActive=Array.isArray(actualMonitor.active)?actualMonitor.active:[],actualRecent=Array.isArray(actualMonitor.recent)?actualMonitor.recent:[];
  const reLive=testSignalsState?.liveStats?.reentry||{},reLiveText=hasNum(reLive.hitRate)?`${Number(reLive.hitRate).toFixed(1)}% / ${Number(reLive.sample||0)}`:`— / ${Number(reLive.sample||0)}`;
  if(!rows.length&&!history.length&&!actualActive.length&&!actualRecent.length){panel.classList.remove('show');panel.innerHTML='';return}
  const focusKey=testFocusSymbol?`${testFocusSymbol}:${testFocusDirection==='SHORT'?'SHORT':'LONG'}`:'';
  if(focusKey){const ix=rows.findIndex(x=>x.key===focusKey);if(ix>0){const [f]=rows.splice(ix,1);rows.unshift(f)}}
  if(rows.length===1&&!testMonitorOpenKeys.size)testMonitorOpenKeys.add(rows[0].key);if(focusKey)testMonitorOpenKeys.add(focusKey);
  const visible=rows.slice(0,6),more=rows.slice(6),cards=visible.map((x,i)=>renderMonitorJudgeCard(x,i,focusKey,reLiveText)).join(''),moreCards=more.map((x,i)=>renderMonitorJudgeCard(x,i+6,focusKey,reLiveText)).join('');
  const moreHtml=more.length?`<details class="moreMonitorPool" data-persist-detail="monitorMorePool" ${detailOpenAttr('monitorMorePool')}><summary>更多系統訊號 <b>+${more.length}</b></summary><div class="testMonitorList more">${moreCards}</div></details>`:'';
  const ttlMin=Number(testSignalsState?.monitor?.ttlMinutes||240),ttlText=ttlMin>=60?`${Math.round(ttlMin/60)} 小時`:`${ttlMin} 分鐘`;
  panel.classList.add('show');
  panel.innerHTML=`<div class="testMonitorHeader"><div class="testMonitorHeadLeft"><div class="testMonitorTitle">系統訊號監控 <small>${rows.length?`${rows.length} 筆`:'目前 0 筆'}</small></div><div class="testMonitorSub">真正送達的普通／高勝率通知使用獨立佇列，不占用下方交易員雷達。通知後不會因單次轉弱就消失；以手動 × 移除為主。若系統確認結構崩壞（連續 ${Number(testSignalsState?.badBars||3)} 根5分K弱勢＋高週期逆向，或硬結構失守）會自動移出；否則最長 ${ttlText} 後過期。</div></div><div class="testMonitorControls"><button type="button" data-test-expand-all>全部展開</button><button type="button" data-test-collapse-all>全部縮小</button></div></div>${rows.length?`<div class="testMonitorList">${cards}</div>${moreHtml}`:'<div class="testMonitorEmpty">目前沒有仍在期限內的系統通知。</div>'}${renderMonitorHistory(history)}`;
  renderActualMonitorV2610(panel);bindTestJudgementDetails();bindPersistentDetails(panel);
}
function goTestSignalToMonitor(symbol,direction){const dir=direction==='SHORT'?'SHORT':'LONG',x=(testSignalsState?.rows||[]).find(r=>r.symbol===symbol&&r.direction===dir);if(!testIsMonitorQualified(x))return;testFocusSymbol=symbol;testFocusDirection=dir;clearTestJudgementDismiss(`${symbol}:${testFocusDirection}`);testMonitorOpenKeys.add(`${symbol}:${testFocusDirection}`);try{history.replaceState(null,'',`${location.pathname}?page=monitor&testSignal=${encodeURIComponent(symbol)}&dir=${testFocusDirection}`)}catch{}setPage('monitor',{force:true,user:true});renderTestFocus();window.scrollTo({top:0,behavior:'smooth'})}

function testObservationProgress(x){if(x?.status==='CONFIRMED')return 100;return Math.max(0,Math.min(100,Number(x?.observationProgress||x?.strategyProfile?.progress||0)))}
function testStrategyName(x){return x?.strategyAtConfirm?.label||x?.strategyProfile?.label||x?.lastCheck?.strategyLabel||'多策略觀察'}
function testPlaybookMini(x){const rows=x?.strategyProfile?.candidates||x?.lastCheck?.strategyCandidates||[];if(!rows.length)return'';return `<div class="testPlaybookList">${rows.slice(0,5).map(s=>`<div class="testPlaybookRow"><span>${esc(s.label||s.id||'策略')}</span><div class="testPlaybookBar"><i style="width:${Math.max(0,Math.min(100,Number(s.progress||0)))}%"></i></div><b>${Math.round(Number(s.progress||0))}%</b></div>`).join('')}</div>`}
function renderTestSignalsBaseV2617(d){
  if(!d?.ok)return;testSignalsState=d;testSignalsFetchedAt=Date.now();const rows=(d.rows||[]).filter(observationVisibleV2616),live=d.liveStats||{};if(lastStatus)renderCalcPositions(lastStatus);
  const activeRows=rows.filter(x=>['WAIT_PULLBACK','TOUCHING','CONFIRMED','INVALID'].includes(x.status)&&!testIsReachedWaiting(x));
  const active=new Set(activeRows.map(x=>x.symbol)).size;
  const near=new Set(activeRows.filter(x=>testObservationProgress(x)>=70&&x.status!=='CONFIRMED').map(x=>x.symbol)).size;
  const eligible=new Set(activeRows.filter(x=>['HIGH','NORMAL'].includes(x.notificationTier)).map(x=>x.symbol)).size;
  const precisePerf=d.notificationPerformance||{};
  const liveHit=Number(precisePerf.sample||0)>0&&hasNum(precisePerf.hitRate)?`${Number(precisePerf.hitRate).toFixed(1)}%`:'—';
  const bestXp=Math.max(0,...rows.map(testObservationProgress).filter(Number.isFinite));
  $('testSummary').innerHTML=`<div class="testSummaryCell"><span>觀察標的</span><b>${active}</b><small>後台持續交叉驗證</small></div><div class="testSummaryCell"><span>接近通知</span><b>${near}</b><small>以標的數計算</small></div><div class="testSummaryCell"><span>可通知</span><b>${eligible}</b><small>影子 A＋B</small></div><div class="testSummaryCell"><span>實測勝率</span><b>${liveHit}</b><small>通知後真實追蹤</small></div>`;
  $('testGrid').innerHTML=rows.map(x=>{const bt=x.setup?.backtest||{},q=Math.max(0,Math.min(100,Number(x.qualityScore||x.setup?.setupScore||0))),progress=testObservationProgress(x),long=x.direction==='LONG',hist=hasNum(bt.hitRate)?`${Number(bt.hitRate).toFixed(1)}%`:'—',cal=testEffectiveWinRate(x)>=0?`${testEffectiveWinRate(x).toFixed(1)}%`:'—',avg=testSignedPct(bt.avgReturnPct,2),dynamic=hasNum(x.monitorScore)?Number(x.monitorScore).toFixed(0):'—',preferred=x.preferredEntryZone?`${price(x.preferredEntryZone.low)}～${price(x.preferredEntryZone.high)}`:'等待策略區間',moreKey=`testMore:${x.key}`,deepKey=`testDeep:${x.key}`,obsRank=x.observationRank||x.rank||'—',strategy=testStrategyName(x),next=x.strategyProfile?.nextStep||x.entryStrategy||'等待條件完成';return `<div class="testCard ${testStatusClass(x.status)}" data-observation-key="${esc(observationKeyV2616(x))}"><div class="testHead"><button type="button" class="observationCloseV2616" data-observation-close="${esc(observationKeyV2616(x))}" aria-label="關閉這筆觀察">×</button><div class="testRank">#${obsRank}</div><div class="testSymbolRow">${tvAnchor(x.symbol,'tvNameLink testSymbol')}${assetBadgeV2612(x)}${testTrendTag(x)}<span class="testDir ${long?'long':'short'}">${long?'做多':'做空'}</span><span class="testStrategyTag">${esc(strategy)}</span><span class="testTierTag ${testTierClass(x)}">${esc(testTierLabel(x))}</span></div><div class="testState"><b>${esc(x.statusLabel||'觀察中')}</b><small>${x.lastEvaluatedAt?`更新 ${localTime(x.lastEvaluatedAt)}`:x.updatedAt?`更新 ${localTime(x.updatedAt)}`:'—'}</small></div></div><div class="testQuality"><div class="testXpHead"><span>總經驗</span><div class="testQualityBar"><div class="testQualityFill" style="width:${progress}%"></div></div><strong>${Math.round(progress)}%</strong></div><div class="testStrategyNext"><b>${esc(strategy)}</b>｜${esc(next)}</div></div><div class="testQuickGrid"><div><span>校準勝率</span><b>${cal}</b></div><div><span>歷史1R</span><b>${hist}</b></div><div><span>動態強度</span><b>${dynamic}</b></div><div><span>90分報酬</span><b>${avg}</b></div><div class="wide"><span>目前最佳策略進場區</span><b>${esc(preferred)}</b></div></div><details class="testCardMore" data-persist-detail="${esc(moreKey)}" ${detailOpenAttr(moreKey)}><summary>更多數據</summary><div class="testMetrics"><div class="testMetric"><span>市場狀態</span><b>${esc(x.marketRegime||'—')}</b></div><div class="testMetric"><span>原市場熱度排名</span><b>${x.rank?`#${x.rank}`:'—'}</b></div><div class="testMetric"><span>回測樣本</span><b>${Number(bt.sample||0)}</b></div><div class="testMetric"><span>回測獲利因子</span><b>${hasNum(bt.profitFactor)?Number(bt.profitFactor).toFixed(2):'—'}</b></div><div class="testMetric"><span>5分 RSI</span><b>${hasNum(x.lastCheck?.rsi5)?Number(x.lastCheck.rsi5).toFixed(1):'—'}</b></div><div class="testMetric"><span>OI 15分</span><b>${x.dataHealth?.sources?.oi15?testSignedPct(x.lastCheck?.oi15mChangePct,1):'無資料'}</b></div><div class="testMetric"><span>資料完整度</span><b>${hasNum(x.dataHealth?.coveragePct)?Number(x.dataHealth.coveragePct).toFixed(0)+'%':'—'}</b></div><div class="testMetric"><span>狀態學習</span><b class="${Number(x.notificationGate?.learningAdjustment||0)>=0?'goodText':'badText'}">${Number(x.notificationGate?.learningAdjustment||0)>0?'+':''}${Number(x.notificationGate?.learningAdjustment||0)} 分</b></div><div class="testMetric"><span>通知分數</span><b>${hasNum(x.notificationGate?.rawScore)?Number(x.notificationGate.rawScore).toFixed(0):'—'} → ${hasNum(x.notificationGate?.score)?Number(x.notificationGate.score).toFixed(0):'—'}</b></div></div><div class="testPlaybookSection"><div class="testPlaybookSectionTitle">各策略經驗</div>${testPlaybookMini(x)||'<div class="crossMuted">策略資料累積中</div>'}</div><div class="testLevels"><div class="testLevel"><span>目前最佳策略區</span><b>${esc(preferred)}</b></div><div class="testLevel"><span>策略失效參考</span><b>${hasNum(x.strategyAtConfirm?.invalidation??x.strategyProfile?.invalidation)?price(x.strategyAtConfirm?.invalidation??x.strategyProfile?.invalidation):x.setup?price(x.setup.invalidation):'—'}</b></div><div class="testLevel"><span>確認價</span><b>${hasNum(x.confirmationPrice)?price(x.confirmationPrice):'等待確認'}</b></div></div></details><div class="testReasons">${testReasonChips(x)||'<span class="testReason">等待多策略條件完成</span>'}</div><div class="testActions obsTradeActions"><button type="button" class="observationActualBtn" data-actual-trade="${esc(x.key)}">實際建倉</button>${testIsMonitorQualified(x)?`<button type="button" class="monitorBtn" data-test-monitor="${esc(x.symbol)}" data-test-dir="${esc(x.direction)}">進入監控</button>`:`<div class="monitorGateNote">達到影子 A／B 通知門檻後，才會自動進入監控</div>`}</div><div class="testNotifyGate ${testTierClass(x)}">${esc(testNotifyGateText(x))}</div><details class="testDeepDetail" data-test-deep-detail="${esc(x.key)}" data-persist-detail="${esc(deepKey)}" ${detailOpenAttr(deepKey)}><summary><span>詳細</span><small>免費完整交叉比對</small></summary><div class="testDeepBody">${renderTestCrossDetail(x)}</div></details><details class="testAiWebDetail" data-test-ai-web data-test-ai-key="${esc(x.key)}" data-test-ai-symbol="${esc(x.symbol)}" data-test-ai-dir="${esc(x.direction)}" ${testAiOpenKeys.has(x.key)?'open':''}><summary><span>AI網搜</span><small>預估 US$0.01 起 · 2小時快取</small></summary><div class="testWebCross"><div data-test-web-analysis-body><div class="ideaAnalysisLoading">只有展開 AI網搜 才會產生 OpenAI API 費用；免費詳細不收費。</div></div></div></details></div>`}).join('')||'<div class="testEmpty">目前沒有進入觀察榜的標的。</div>';
  document.querySelectorAll('[data-observation-close]').forEach(b=>{if(b.dataset.v2616Bound==='1')return;b.dataset.v2616Bound='1';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();dismissObservationV2616(b.dataset.observationClose)},{capture:true})});
  bindTestDeepDetails();
  const th=d.notifyThresholds||{};$('testMethod').textContent=`觀察＝後台找機會：五套策略同步交叉驗證，100%只代表策略條件完成，不會直接進監控。只有真正達到影子 A／B 通知門檻、且通知成功送出後，才會進入監控。高勝率：校準≥${Number(th.highRate||68)}%、品質≥${Number(th.highScore||87)}、完整度≥${Number(th.highCoverage||90)}%、可信度≥${Number(th.highConfidence||86)}%。普通：校準≥${Number(th.normalRate||60)}%、品質≥${Number(th.normalScore||80)}。追價、結構失效、跨所明確逆向仍會阻擋通知。`;
  const ns=d.notifyStats||{},mode=loadShadowNoticeSourceV2616(),modeText=({MANUAL:'手動',AUTO:'自動',BOTH:'全開'})[mode]||'全開';
  if($('testNotifyDiag'))$('testNotifyDiag').innerHTML=`<b>${modeText}</b> · 自動影子 A ${Number(ns.high||0)} / B ${Number(ns.normal||0)} / 暫停 ${Number(ns.blocked||0)}<span>手機只允許：熬鷹建倉/加減/平倉，以及影子 A/B。手動＋自動共用 45 分鐘同標的去重。</span>`;
  const h=d.health||{},scanSec=hasNum(h.scanAgeMs)?Math.round(Number(h.scanAgeMs)/1000):null,healthText=Number(h.staleCount||0)>0?`過期 ${h.staleCount}`:Number(h.delayedCount||0)>0?`延遲 ${h.delayedCount}`:'正常';
  if($('testHealth')){const rt=h.realtime||{},pub=rt.public?.connected===true,mkt=rt.market?.connected===true,rad=rt.radar||{},p95=Math.max(Number(rt.public?.latency?.p95Ms||0),Number(rt.market?.latency?.p95Ms||0));$('testHealth').textContent=`系統 ${healthText} · 深度掃描 ${scanSec==null?'—':scanSec+'秒前'} · WS ${pub&&mkt?'雙路即時':'REST備援'}${p95?` p95 ${Math.round(p95)}ms`:''} · 全市場 ${Number(rad.scanned||0)} / 深度候選 ${Number(rad.deepCandidates||0)} · 觀察 ${Number(h.tracked||0)}`;}
  $('testAge').textContent=d.generatedAt?ageText(d.generatedAt):'—';renderTestFocus();
}
function renderTestSignals(d){
  const sig=testSignatureV2617(d),grid=$('testGrid'),root=document.querySelector('.page.active')||grid,active=pageFreezeCurrentV2619();
  testSignalsState=d;testSignalsFetchedAt=Date.now();
  if((active==='monitor'||active==='test')&&pageFreezeIsV2619(active)&&((active==='test'&&grid?.children?.length)||(active==='monitor'&&document.getElementById('testFocusPanel')?.children?.length))){pageFreezePendingV2619.test=d;pageFreezeSyncV2619();return}
  if(sig===lastTestSigV2617&&grid?.children?.length){pageFreezePendingV2619.test=null;pageFreezeSyncV2619();return}
  const a=captureViewportAnchorV2617(root);lastTestSigV2617=sig;pageFreezePendingV2619.test=null;renderTestSignalsBaseV2617(d);restoreViewportAnchorV2617(root,a);pageFreezeSyncV2619()
}

async function refreshTestSignals(force=false){
  if(testSignalsBusy)return;if(!force&&testSignalsState&&Date.now()-testSignalsFetchedAt<8_000){renderTestSignals(testSignalsState);return}testSignalsBusy=true;
  try{const r=await fetch(`/api/test-signals${force?'?force=1':''}`,{cache:'no-cache'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderTestSignals(d)}catch(e){if(testSignalsState)renderTestSignals(testSignalsState);else $('testGrid').innerHTML='<div class="testEmpty">觀察系統暫時不可用。</div>'}finally{testSignalsBusy=false}
}


function loadPerfSim(){const d=loadObject(PERF_SIM_PREF,{margin:300,leverage:20,costBps:12});return {margin:Math.max(1,Number(d.margin||300)),leverage:Math.max(1,Math.min(125,Number(d.leverage||20))),costBps:Math.max(0,Math.min(100,Number(d.costBps??12)))}}
function savePerfSim(v){try{localStorage.setItem(PERF_SIM_PREF,JSON.stringify(v))}catch{}}
function perfResultLabel(x){return x.status==='ACTIVE'?'追蹤中':x.result==='WIN'?`目標 ${hasNum(x.targetR)?Number(x.targetR).toFixed(2)+'R ':''}達成`:x.result==='LOSS'?'停損先到':'4小時逾時'}
function perfResultClass(x){return x.status==='ACTIVE'?'active':x.result==='WIN'?'win':x.result==='LOSS'?'loss':'timeout'}
function perfPct(v,d=2){return hasNum(v)?`${Number(v)>0?'+':''}${Number(v).toFixed(d)}%`:'—'}
function perfMoney(v){if(!hasNum(v))return'—';const x=Number(v);return`${x>=0?'+':'-'}${Math.abs(x).toFixed(2)} U`}
function perfDateTime(iso){if(!iso)return'—';try{return new Date(iso).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).replace(/^24:/,'00:')}catch{return'—'}}
function perfSimStats(records,cfg,summary={}){const resolved=(records||[]).filter(x=>x.status==='RESOLVED'),notional=cfg.margin*cfg.leverage,totalResolved=Number(summary.resolved||resolved.length),cumGross=hasNum(summary.cumulativeGrossReturnPct)?Number(summary.cumulativeGrossReturnPct):resolved.reduce((a,x)=>a+Number(x.grossReturnPct||0),0),total=notional*(cumGross-totalResolved*cfg.costBps/100)/100;return {resolved:totalResolved,notional,total}}
function perfBreakHtml(rows){if(!rows?.length)return'<div class="perfEmpty">樣本累積中</div>';return rows.slice(0,12).map(x=>`<div class="perfBreakRow"><b>${esc(({TREND_UP:'強多趨勢',TREND_DOWN:'強空趨勢',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算行情'})[x.key]||x.key)}</b><span>${Number(x.sample||0)}筆</span><span>${hasNum(x.hitRate)?Number(x.hitRate).toFixed(1)+'%':'—'}</span><span>PF ${hasNum(x.profitFactor)?pfTextV2612(x.profitFactor):'—'}</span></div>`).join('')}
function perfMs(v){if(!hasNum(v))return'—';const n=Number(v);return n<1000?`${Math.round(n)} ms`:`${(n/1000).toFixed(n<10000?2:1)} 秒`}
function perfCalibrationHtml(cal){if(!cal?.sample)return'<div class="perfEmpty">至少需要已結算通知後才開始校準</div>';const rows=(cal.bins||[]).map(x=>`<div class="perfCalRow"><b>${esc(x.key)}</b><span>${Number(x.sample||0)}筆</span><span>預測 ${Number(x.predicted||0).toFixed(1)}%</span><span class="${Number(x.gapPct||0)>=0?'goodText':'badText'}">實際 ${Number(x.actual||0).toFixed(1)}%</span></div>`).join('');return `<div class="perfOpsGrid"><div><span>校準樣本</span><b>${Number(cal.sample||0)}</b></div><div><span>預測平均</span><b>${hasNum(cal.meanPredicted)?Number(cal.meanPredicted).toFixed(1)+'%':'—'}</b></div><div><span>實際達標</span><b>${hasNum(cal.actualHitRate)?Number(cal.actualHitRate).toFixed(1)+'%':'—'}</b></div><div><span>校準誤差</span><b>${hasNum(cal.calibrationMaePct)?Number(cal.calibrationMaePct).toFixed(1)+'pt':'—'}</b></div><div><span>Brier</span><b>${hasNum(cal.brierScore)?Number(cal.brierScore).toFixed(4):'—'}</b></div><div><span>實際−預測</span><b>${hasNum(cal.gapPct)?`${Number(cal.gapPct)>0?'+':''}${Number(cal.gapPct).toFixed(1)}pt`:'—'}</b></div></div>${rows?`<div class="perfCalRows">${rows}</div>`:''}`}

function perfShadowSummaryHtml(s){if(!s)return'<div class="perfEmpty">影子樣本開始累積後顯示</div>';return `<div class="perfOpsGrid"><div><span>影子樣本</span><b>${Number(s.sample||0)}</b></div><div><span>已結算</span><b>${Number(s.resolved||0)}</b></div><div><span>1R達標率</span><b>${hasNum(s.hitRate)?Number(s.hitRate).toFixed(1)+'%':'—'}</b></div><div><span>影子 PF</span><b>${hasNum(s.profitFactor)?pfTextV2612(s.profitFactor):'—'}</b></div><div><span>可學習結算</span><b>${Number(s.learningEligibleResolved||0)}</b></div><div><span>去重有效樣本</span><b>${Number(s.learningEffectiveResolved||0)}</b><small>${Number(s.learningDedupMinutes||45)}分去相關</small></div><div><span>被擋樣本</span><b>${Number(s.blockedSample||0)}</b></div><div><span>被擋但達1R</span><b>${hasNum(s.blockedHitRate)?Number(s.blockedHitRate).toFixed(1)+'%':'—'}</b></div></div>`}
function perfLearningHtml(l){const rows=l?.patterns||[];if(!rows.length)return`<div class="perfEmpty">影子樣本累積中；至少 ${Number(l?.minSample||20)} 筆同模式後才開始自動加減分</div>`;return rows.slice(0,14).map(x=>{const a=Number(x.adjustment||0),f=x.features||{},dir=f.direction==='LONG'?'多':'空',reg=({TREND_UP:'強多',TREND_DOWN:'強空',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算'})[f.regime]||f.regime||'—';return `<div class="perfLearnRow"><div><b>${esc(f.strategyLabel||'未分類')} · ${esc(reg)} · ${dir}</b><small>OI ${esc(f.oi||'—')} · Taker ${esc(f.taker||'—')} · Depth ${esc(f.depth||'—')}</small></div><span>${Number(x.sample||0)}筆</span><span>${hasNum(x.hitRate)?Number(x.hitRate).toFixed(1)+'%':'—'}</span><span>PF ${hasNum(x.profitFactor)?pfTextV2612(x.profitFactor):'—'}</span><strong class="${a>0?'goodText':a<0?'badText':''}">${a>0?'+':''}${a}</strong></div>`}).join('')}
function perfActualSummaryHtml(s){if(!s||!Number(s.sample||0))return'<div class="perfEmpty">你按「實際建倉」後，這裡會開始累積。</div>';return `<div class="perfOpsGrid"><div><span>實際建倉</span><b>${Number(s.sample||0)}</b></div><div><span>追蹤中</span><b>${Number(s.active||0)}</b></div><div><span>已判定</span><b>${Number(s.decisive||0)}</b></div><div><span>TP先到率</span><b>${hasNum(s.tp1FirstRate)?Number(s.tp1FirstRate).toFixed(1)+'%':'—'}</b></div><div><span>SP先到率</span><b>${hasNum(s.sp1FirstRate)?Number(s.sp1FirstRate).toFixed(1)+'%':'—'}</b></div><div><span>模型 / 實倉一致率</span><b>${hasNum(s.modelActualAgreementRate)?Number(s.modelActualAgreementRate).toFixed(1)+'%':'—'}</b><small>${Number(s.comparableSample||0)}筆可比較</small></div><div><span>實際成本偏離通知</span><b>${hasNum(s.avgEntryDeviationPct)?Number(s.avgEntryDeviationPct).toFixed(3)+'%':'—'}</b></div><div><span>完整倉位估算損益</span><b class="${Number(s.estimatedPnl||0)>0?'goodText':Number(s.estimatedPnl||0)<0?'badText':''}">${perfMoney(s.estimatedPnl||0)}</b></div></div>`}
function perfActualRecentHtml(rows){const a=(rows||[]).slice(0,12);if(!a.length)return'';return a.map(x=>{const state=x.status==='ACTIVE'?'追蹤中':x.firstOutcome==='WIN'?'TP先到':x.firstOutcome==='LOSS'?'SP先到':x.result==='MANUAL'?'手動結束':'已結算',cls=x.status==='ACTIVE'?'active':x.firstOutcome==='WIN'?'win':x.firstOutcome==='LOSS'?'loss':'',last=hasNum(x.lastPrice)?price(x.lastPrice):'—';return `<div class="actualPerfRow"><div><b>${esc(x.symbol)} · ${x.direction==='SHORT'?'做空':'做多'}</b><span>成本 ${price(x.entryPrice)} · 現/末 ${last} · ${perfDateTime(x.createdAt)} · ${esc(x.strategyLabel||'未分類')}</span></div><div class="actualPerfRight"><strong class="${cls}">${state}${hasNum(x.estimatedPnl)?` · ${perfMoney(x.estimatedPnl)}`:''}</strong>${x.status==='ACTIVE'?`<button type="button" data-actual-close="${esc(x.id)}">手動結束</button>`:''}</div></div>`}).join('')}
function renderPerformance(d){
  if(!d?.ok)return;performanceState=d;performanceFetchedAt=Date.now();const sum=d.summary||{},records=d.records||d.recent||[],cfg=loadPerfSim(),sim=perfSimStats(records,cfg,sum),pnlClass=sim.total>0?'good':sim.total<0?'bad':'';
  if($('perfMargin'))$('perfMargin').value=String(cfg.margin);if($('perfLeverage'))$('perfLeverage').value=String(cfg.leverage);if($('perfCostBps'))$('perfCostBps').value=String(cfg.costBps);
  $('perfSummary').innerHTML=`<div class="perfCell"><span>通知樣本</span><b>${Number(sum.sample||0)}</b></div><div class="perfCell"><span>目標達標率</span><b>${hasNum(sum.hitRate)?Number(sum.hitRate).toFixed(1)+'%':'—'}</b></div><div class="perfCell"><span>PF</span><b>${hasNum(sum.profitFactor)?Number(sum.profitFactor).toFixed(2):'—'}</b></div><div class="perfCell"><span>期望R</span><b>${hasNum(sum.expectancyR)?Number(sum.expectancyR).toFixed(3):'—'}</b></div><div class="perfCell"><span>平均淨報酬</span><b>${hasNum(sum.avgNetReturnPct)?perfPct(sum.avgNetReturnPct,3):'—'}</b></div><div class="perfCell"><span>模擬總損益</span><b class="${pnlClass}">${perfMoney(sim.total)}</b></div>`;
  $('perfByTier').innerHTML=perfBreakHtml(sum.byTier);$('perfByRegime').innerHTML=perfBreakHtml(sum.byRegime);if($('perfByStrategy'))$('perfByStrategy').innerHTML=perfBreakHtml(sum.byStrategy);$('perfBySymbol').innerHTML=perfBreakHtml(sum.bySymbol);if($('perfShadowSummary'))$('perfShadowSummary').innerHTML=perfShadowSummaryHtml(d.shadowSummary);if($('perfActualSummary'))$('perfActualSummary').innerHTML=perfActualSummaryHtml(d.actualSummary);if($('perfActualRecent'))$('perfActualRecent').innerHTML=perfActualRecentHtml(d.actualTrades);if($('perfShadowByTier'))$('perfShadowByTier').innerHTML=perfBreakHtml(d.shadowSummary?.byTier);if($('perfStateLearning'))$('perfStateLearning').innerHTML=perfLearningHtml(d.stateLearning);
  const rt=d.realtime||testSignalsState?.health?.realtime||{},wsP95=Math.max(Number(rt.public?.latency?.p95Ms||0),Number(rt.market?.latency?.p95Ms||0));
  if($('perfLatency'))$('perfLatency').innerHTML=`<div class="perfOpsGrid"><div><span>訊號→送出 平均</span><b>${perfMs(sum.avgSignalToPushMs)}</b></div><div><span>訊號→送出 p95</span><b>${perfMs(sum.p95SignalToPushMs)}</b></div><div><span>Push服務平均</span><b>${perfMs(sum.avgPushServiceMs)}</b></div><div><span>手機回報 p95</span><b>${perfMs(sum.p95DeliveryLatencyMs)}</b></div><div><span>手機收到回報率</span><b>${hasNum(sum.deliveryAckRate)?Number(sum.deliveryAckRate).toFixed(1)+'%':'—'}</b></div><div><span>行情 WS p95</span><b>${wsP95?Math.round(wsP95)+' ms':'—'}</b></div></div>`;
  if($('perfCalibration'))$('perfCalibration').innerHTML=perfCalibrationHtml(sum.calibration);
  const recent=(d.recent||[]).slice(0,30);$('perfRecent').innerHTML=recent.map(x=>{const net=Number(x.grossReturnPct||0)-cfg.costBps/100,pnl=x.status==='RESOLVED'?cfg.margin*cfg.leverage*net/100:null;return `<div class="perfTrade"><div class="perfTradeHead"><div><span class="perfTradeSym">${esc(x.symbol)}</span><span class="perfTradeDir ${x.direction==='LONG'?'long':'short'}">${x.direction==='LONG'?'做多':'做空'}</span></div><div class="perfTradeResult ${perfResultClass(x)}">${perfResultLabel(x)}</div></div><div class="perfTradeMeta">${perfDateTime(x.notificationAt)} · ${esc(x.tier||'VALID')} · ${esc(x.strategyLabel||'未分類')} · ${esc(({TREND_UP:'強多',TREND_DOWN:'強空',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算'})[x.marketRegime]||x.marketRegime||'—')} · 通知價 ${price(x.entryPrice)}${hasNum(x.deliveryLatencyMs)?` · 手機 ${perfMs(x.deliveryLatencyMs)}`:''}</div><div class="perfTradeStats"><div class="perfTradeStat"><span>MFE / MAE</span><b>${perfPct(x.mfePct,2)} / -${Math.abs(Number(x.maePct||0)).toFixed(2)}%</b></div><div class="perfTradeStat"><span>結果 R</span><b>${hasNum(x.realizedR)?Number(x.realizedR).toFixed(2)+'R':hasNum(x.maxR)?'最高 '+Number(x.maxR).toFixed(2)+'R':'—'}</b></div><div class="perfTradeStat"><span>淨報酬估算</span><b>${x.status==='RESOLVED'?perfPct(net,3):'追蹤中'}</b></div><div class="perfTradeStat"><span>模擬損益</span><b>${x.status==='RESOLVED'?perfMoney(pnl):'—'}</b></div></div></div>`}).join('')||'<div class="perfEmpty">V10 上線後，第一則真正送達的進場通知會從這裡開始記錄。</div>';
  $('perfResolved').textContent=`已結算 ${Number(sum.resolved||0)} · 追蹤中 ${Number(sum.active||0)}`;$('perfAge').textContent=ageText(d.generatedAt);$('perfMethod').textContent=`${d.methodology||''}｜模擬：${cfg.margin}U × ${cfg.leverage}x = ${(cfg.margin*cfg.leverage).toFixed(0)}U 名義倉位；單輪成本 ${cfg.costBps}bps。`;
  const live=rt.public?.connected&&rt.market?.connected;if($('perfRealtime'))$('perfRealtime').textContent=live?`WS 雙路即時${wsP95?' · p95 '+Math.round(wsP95)+'ms':''}`:'REST / K線備援';
}
async function refreshPerformance(force=false){if(performanceBusy)return;if(!force&&performanceState&&Date.now()-performanceFetchedAt<5_000){renderPerformance(performanceState);return}performanceBusy=true;try{const [r,rr]=await Promise.all([fetch('/api/performance',{cache:'no-cache'}),fetch('/api/realtime',{cache:'no-cache'}).catch(()=>null)]),d=await r.json().catch(()=>null),rt=rr?.ok?await rr.json().catch(()=>null):null;if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);if(rt?.ok)d.realtime=rt;renderPerformance(d)}catch(e){if(performanceState)renderPerformance(performanceState);else $('perfRecent').innerHTML='<div class="perfEmpty">績效資料暫時不可用。</div>'}finally{performanceBusy=false}}
function initPerformanceControls(){for(const id of ['perfMargin','perfLeverage','perfCostBps'])$(id)?.addEventListener('change',()=>{const v={margin:Math.max(1,Number($('perfMargin')?.value||300)),leverage:Math.max(1,Math.min(125,Number($('perfLeverage')?.value||20))),costBps:Math.max(0,Math.min(100,Number($('perfCostBps')?.value||12)))};savePerfSim(v);if(performanceState)renderPerformance(performanceState)})}

function renderMarketFlowCoreV2612(d){
  if(!d?.ok)return;marketFlowState=d;marketFlowFetchedAt=Date.now();
  const sm=d.summary||{},dir=sm.direction==='LONG'?'long':sm.direction==='SHORT'?'short':'neutral';
  $('flowHero').className='flowHero';$('flowHero').innerHTML=`<div class="flowHeroTop"><div><div class="flowHeroTitle ${dir}">${esc(sm.label||'多空拉鋸')}</div><div class="flowHeroMeta">加權 ${signed(sm.weightedChangePct||0,2)} · ↑ ${sm.advancers||0} / ↓ ${sm.decliners||0}</div></div><div class="flowConfidence">${Number(sm.confidence||0)}<small>/100</small></div></div><div class="flowStats"><div class="flowStat"><span>廣度</span><b class="${Number(sm.breadth||0)>=0?'longText':'shortText'}">${signed(Number(sm.breadth||0)*100,1)}</b></div><div class="flowStat"><span>來源</span><b class="goldText">Binance</b></div><div class="flowStat"><span>更新</span><b>${ageText(d.generatedAt)}</b></div></div>`;
  const rows=(d.leaders||[]).slice(0,16);$('marketList').innerHTML=rows.map(x=>`<div class="marketRow"><div>${tvAnchor(x.symbol,'tvNameLink marketSym')}<div class="marketSub">${price(x.price)}</div></div><div class="marketMetric"><span>24h</span><b class="${Number(x.changePct)>=0?'longText':'shortText'}">${signed(x.changePct)}</b></div><div class="marketMetric"><span>額 / F</span><b>${fmtVol(x.quoteVolume)}</b><div class="marketSub">${signed(x.fundingPct,4)}</div></div></div>`).join('')||'<div class="loadingBox">—</div>';
  renderToday(d);
  const stale=$('flowStale');if(d.stale){stale.classList.add('show');stale.textContent='使用上一份市場快照'}else{stale.classList.remove('show');stale.textContent=''}
  $('flowAge').textContent=d.stale?'快照':ageText(d.generatedAt);
}
function renderMarketFlow(d){marketFlowMasterV2612=d;mountAssetSwitchesV2612();const view=marketViewV2612(d);renderMarketFlowCoreV2612(view);marketFlowState=d;marketFlowFetchedAt=Date.now();syncAssetSwitchesV2612();renderAssetTodayHeroV2612()}
async function refreshMarketFlow(force=false){
  if(marketFlowBusy)return;if(!force&&marketFlowState&&Date.now()-marketFlowFetchedAt<15000){renderMarketFlow(marketFlowState);return}
  marketFlowBusy=true;try{const r=await fetch('/api/market-flow',{cache:'no-cache'}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);renderMarketFlow(d)}catch(e){if(marketFlowState)renderMarketFlow({...marketFlowState,stale:true});else{$('todayBiases').innerHTML='<div class="loadingBox">—</div>';$('todayBiasList').innerHTML='<div class="loadingBox">—</div>';$('matrixChart').innerHTML='<div class="loadingBox">—</div>';$('flowHero').className='loadingBox';$('flowHero').textContent='市場資料暫時不可用';$('marketList').innerHTML='<div class="loadingBox">—</div>'}}finally{marketFlowBusy=false}
}

function initBriefControls(){
  if($('briefNotify'))$('briefNotify').checked=loadBriefNotify();
  $('briefNotify')?.addEventListener('change',async e=>{saveBriefNotify(e.currentTarget.checked);const sub=await getPushSubscription();if(!sub&&e.currentTarget.checked){$('briefMsg').textContent='先到「監控」同步 iPhone 通知';return}await syncPreferences().catch(()=>{});$('briefMsg').textContent=e.currentTarget.checked?'08:05 通知開':'通知關'});
  $('briefRefresh')?.addEventListener('click',()=>refreshDailyBrief(true));
}
initBriefControls();
function initTestNotifyControls(){
  const modes=document.querySelector('.testNotifyModes');if(modes)modes.innerHTML='<label><input type="radio" name="shadowNotifySourceV2616" value="MANUAL"><span><b>手動</b><small>只收手動影子 A/B</small></span></label><label><input type="radio" name="shadowNotifySourceV2616" value="AUTO"><span><b>自動</b><small>只收觀察自動判斷 A/B</small></span></label><label><input type="radio" name="shadowNotifySourceV2616" value="BOTH"><span><b>全開</b><small>兩路開啟 · 同標的不重複</small></span></label>';
  const sync=()=>{const source=loadShadowNoticeSourceV2616(),enabled=loadShadowNoticeMasterV2616(),toggle=$('testSignalNotify');if(toggle)toggle.checked=enabled;document.querySelectorAll('[name="shadowNotifySourceV2616"]').forEach(r=>r.checked=r.value===source)};sync();
  document.querySelectorAll('[name="shadowNotifySourceV2616"]').forEach(r=>r.addEventListener('change',async()=>{if(!r.checked)return;await applyShadowNoticeSourceV2616(r.value,loadShadowNoticeMasterV2616());const msg=$('testNotifyMsg');if(msg)msg.textContent=r.value==='MANUAL'?'只收手動影子 A/B':r.value==='AUTO'?'只收自動影子 A/B':'手動＋自動全開；45分鐘同標的去重'}));
  $('testSignalNotify')?.addEventListener('change',async e=>{if(e.currentTarget.checked&&!await getPushSubscription()){e.currentTarget.checked=false;const msg=$('testNotifyMsg');if(msg)msg.textContent='先到「監控」同步 iPhone 通知';return}await applyShadowNoticeSourceV2616(loadShadowNoticeSourceV2616(),e.currentTarget.checked);const msg=$('testNotifyMsg');if(msg)msg.textContent=e.currentTarget.checked?'A/B 影子通知已開':'影子通知已關'});
  window.addEventListener('shadow-notice-source:v2616',sync);
}
initTestNotifyControls();
initPerformanceControls();
mountPageLockV269();
document.querySelectorAll('.pageTab').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.page,{force:true,user:true})));

// Mobile horizontal swipe navigation: 今日 ↔ 績效 ↔ 流向 ↔ 建議 ↔ 監控 ↔ 觀察
const PAGE_SWIPE_ORDER=['today','performance','flow','ideas','monitor','test'];
let pageSwipeStart=null;
function pageSwipeBlockedTarget(target){
  if(!(target instanceof Element))return false;
  return Boolean(target.closest('input,textarea,select,button,a,summary,label,[contenteditable="true"],.pageTabs,.modalBackdrop.show,.sheet,.tvAppHint.show,.chartModal.show,.chartShell,.actualTradeModal.show,.actualTradeShell'));
}
function pageSwipeHasScrollableAncestor(target,dx){
  let el=target instanceof Element?target:null;
  while(el&&el!==document.body){
    const cs=getComputedStyle(el),overflowX=cs.overflowX;
    if((overflowX==='auto'||overflowX==='scroll')&&el.scrollWidth>el.clientWidth+4){
      const canLeft=el.scrollLeft>1,canRight=el.scrollLeft+el.clientWidth<el.scrollWidth-1;
      // Finger moves right => content normally scrolls left; finger moves left => content normally scrolls right.
      if((dx>0&&canLeft)||(dx<0&&canRight))return true;
    }
    el=el.parentElement;
  }
  return false;
}
function pageSwipeGo(_delta){return false}
document.addEventListener('touchstart',e=>{
  if(e.touches.length!==1||pageSwipeBlockedTarget(e.target)){pageSwipeStart=null;return}
  const t=e.touches[0];
  pageSwipeStart={x:t.clientX,y:t.clientY,at:performance.now(),target:e.target};
},{passive:true});
document.addEventListener('touchend',e=>{
  const start=pageSwipeStart;pageSwipeStart=null;
  if(!start||e.changedTouches.length!==1)return;
  const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y,dt=performance.now()-start.at;
  const ax=Math.abs(dx),ay=Math.abs(dy);
  if(dt>900||ax<64||ax<ay*1.35)return;
  if(pageSwipeHasScrollableAncestor(start.target,dx))return;
  // Finger swipes left => next page; finger swipes right => previous page.
  pageSwipeGo(dx<0?1:-1);
},{passive:true});
document.addEventListener('touchcancel',()=>{pageSwipeStart=null},{passive:true});

try{setPage(localStorage.getItem('position-alert-page-v78')||'today')}catch{setPage('today')}
// RAILWAY_EGRESS_V266: keep the existing 8-second foreground refresh, but stop paying for
// JSON responses while the browser/PWA is hidden. Push notifications and backend polling continue.
function refreshActivePageV266(){
  if(document.hidden)return;
  const active=document.querySelector('.pageTab.active')?.dataset?.page;
  if(active==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}
  else if(active==='flow')void refreshMarketFlow(false);
  else if(active==='ideas')void refreshRankedIdeas(false);
  else if(active==='test'||active==='monitor')void refreshTestSignals(false);
  else if(active==='performance')void refreshPerformance(false);
}
setInterval(refreshActivePageV266,8_000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshActivePageV266()});


/* PUSH_RECOVERY_V2665_20260904 */
setTimeout(backgroundPushRepairV2665,800);
window.addEventListener('pageshow',()=>setTimeout(backgroundPushRepairV2665,250));

/* NO_PAGE_LOCK_RUNTIME_V2664 */
function removeAllPageLocksV2664(){
  document.getElementById('pageLockTagV269')?.remove();
  document.querySelectorAll('.pageLockRowV269,#workspaceFreezeV2619,.workspaceFreezeV2619').forEach(x=>x.remove());
  document.documentElement.classList.remove('workspacePageLockedV2621');
  try{
    localStorage.removeItem('position-alert-page-lock-v269');
    localStorage.removeItem('position-alert-independent-page-freeze-v2619');
  }catch{}
}
document.addEventListener('DOMContentLoaded',removeAllPageLocksV2664);
window.addEventListener('pageshow',removeAllPageLocksV2664);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')removeAllPageLocksV2664()});
setTimeout(removeAllPageLocksV2664,40);
setTimeout(removeAllPageLocksV2664,350);
setTimeout(removeAllPageLocksV2664,1200);
