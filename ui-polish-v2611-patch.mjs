import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='UI_POLISH_V2611';

function mustFile(...parts){const file=path.join(__dirname,...parts);if(!fs.existsSync(file))throw new Error(`[v2611-ui] missing ${parts.join('/')}`);return file}
function save(file,before,after){if(before===after)return false;fs.writeFileSync(file,after,'utf8');return true}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2611-ui] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function replaceOnce(src,oldText,newText,label){if(!src.includes(oldText))throw new Error(`[v2611-ui] anchor missing: ${label}`);return src.replace(oldText,newText)}

function patchApp(){
  const file=mustFile('public','app.js'),before=fs.readFileSync(file,'utf8');
  let s=before;if(s.includes(MARKER))return false;

  // 0) Notification settings UI mirrors the new actionable-only phone policy.
  const modeLoadOld="function loadTestSignalNotifyMode(){try{const v=String(localStorage.getItem(TEST_SIGNAL_NOTIFY_MODE_PREF)||'HIGH_NORMAL').toUpperCase();return ['HIGH','HIGH_NORMAL','ALL'].includes(v)?v:'HIGH_NORMAL'}catch{return'HIGH_NORMAL'}}";
  const modeLoadNew="function loadTestSignalNotifyMode(){try{const v=String(localStorage.getItem(TEST_SIGNAL_NOTIFY_MODE_PREF)||'HIGH_NORMAL').toUpperCase();return ['HIGH','HIGH_NORMAL'].includes(v)?v:'HIGH_NORMAL'}catch{return'HIGH_NORMAL'}}";if(s.includes(modeLoadOld))s=s.replace(modeLoadOld,modeLoadNew);
  const modeSaveOld="function saveTestSignalNotifyMode(v){try{localStorage.setItem(TEST_SIGNAL_NOTIFY_MODE_PREF,['HIGH','HIGH_NORMAL','ALL'].includes(String(v))?String(v):'HIGH_NORMAL')}catch{}}";
  const modeSaveNew="function saveTestSignalNotifyMode(v){try{localStorage.setItem(TEST_SIGNAL_NOTIFY_MODE_PREF,['HIGH','HIGH_NORMAL'].includes(String(v))?String(v):'HIGH_NORMAL')}catch{}}";if(s.includes(modeSaveOld))s=s.replace(modeSaveOld,modeSaveNew);
  s=s.replace("(cfg.eventTypes||DEFAULT_TYPES).filter(t=>t!=='CONSENSUS').map(t=>","(cfg.eventTypes||DEFAULT_TYPES).filter(t=>['OPEN','ADD','REDUCE','CLOSE'].includes(t)).map(t=>");

  // ABC notification tap: open 建議 and pin the manual A/B/C panel instead of landing at an ambiguous page top.
  const routeOldV2611="function handleNotificationRoute(){const q=new URLSearchParams(location.search),tv=q.get('tv'),page=q.get('page'),symbol=q.get('testSignal'),dir=q.get('dir');if(symbol&&/^[A-Z0-9]{5,24}$/.test(symbol)){testFocusSymbol=symbol;testFocusDirection=dir==='SHORT'?'SHORT':'LONG';clearTestJudgementDismiss(`${symbol}:${testFocusDirection}`);setPage(page==='test'?'test':'monitor',{force:true});void refreshTestSignals(false);return true}if(tv&&/^[A-Z0-9]{5,24}$/.test(tv)){history.replaceState(null,'',location.pathname);setPage('monitor',{force:true});setTimeout(()=>openTradingViewApp(tv),80);return true}if(page)setPage(page,{force:true});return false}";
  const routeNewV2611="function handleNotificationRoute(){const q=new URLSearchParams(location.search),tv=q.get('tv'),page=q.get('page'),symbol=q.get('testSignal'),dir=q.get('dir'),manual=q.get('manual');if(symbol&&/^[A-Z0-9]{5,24}$/.test(symbol)){testFocusSymbol=symbol;testFocusDirection=dir==='SHORT'?'SHORT':'LONG';clearTestJudgementDismiss(`${symbol}:${testFocusDirection}`);setPage(page==='test'?'test':'monitor',{force:true});void refreshTestSignals(false);return true}if(tv&&/^[A-Z0-9]{5,24}$/.test(tv)){history.replaceState(null,'',location.pathname);setPage('monitor',{force:true});setTimeout(()=>openTradingViewApp(tv),80);return true}if(manual==='1'){setPage('ideas',{force:true});for(const ms of [250,700,1400,2500])setTimeout(()=>{const el=document.getElementById('manualOpsPanel');if(el)el.scrollIntoView({block:'start',behavior:'auto'})},ms);return true}if(page)setPage(page,{force:true});return false}";
  if(s.includes(routeOldV2611))s=s.replace(routeOldV2611,routeNewV2611);

  // 1) Lock only the pages where accidental horizontal swipes are costly.
  const lockReadOld="function pageLockReadV269(){try{const d=JSON.parse(localStorage.getItem(PAGE_LOCK_PREF_V269)||'null');return d&&d.enabled===true?{enabled:true,page:String(d.page||'today')}:{enabled:false,page:''}}catch{return{enabled:false,page:''}}}";
  const lockReadNew="const PAGE_LOCK_ALLOWED_V2611=new Set(['ideas','monitor','test']);function pageLockReadV269(){try{const d=JSON.parse(localStorage.getItem(PAGE_LOCK_PREF_V269)||'null'),page=String(d?.page||'');if(d?.enabled===true&&PAGE_LOCK_ALLOWED_V2611.has(page))return{enabled:true,page};if(d?.enabled===true&&!PAGE_LOCK_ALLOWED_V2611.has(page))localStorage.removeItem(PAGE_LOCK_PREF_V269);return{enabled:false,page:''}}catch{return{enabled:false,page:''}}}";
  if(s.includes(lockReadOld))s=s.replace(lockReadOld,lockReadNew);
  else if(!s.includes('PAGE_LOCK_ALLOWED_V2611'))throw new Error('[v2611-ui] page lock read anchor not found');

  const lockSyncOld="function pageLockSyncV269(){const btn=document.getElementById('pageLockTagV269');if(!btn)return;const st=pageLockReadV269(),page=st.enabled?st.page:(document.querySelector('.pageTab.active')?.dataset?.page||'today');btn.classList.toggle('active',st.enabled);btn.setAttribute('aria-pressed',st.enabled?'true':'false');btn.title=st.enabled?`已鎖定「${pageLockPageNameV269(page)}」；點一下解除`:'鎖定目前頁面，避免左右滑誤切並記住此頁';const small=btn.querySelector('small');if(small)small.textContent=st.enabled?pageLockPageNameV269(page):''}";
  const lockSyncNew="function pageLockSyncV269(){const btn=document.getElementById('pageLockTagV269');if(!btn)return;const row=btn.closest('.pageLockRowV269'),current=document.querySelector('.pageTab.active')?.dataset?.page||'today',allowed=PAGE_LOCK_ALLOWED_V2611.has(current);row?.classList.toggle('v2611Hidden',!allowed);btn.hidden=!allowed;if(!allowed)return;const st=pageLockReadV269(),locked=st.enabled&&st.page===current;btn.classList.toggle('active',locked);btn.setAttribute('aria-pressed',locked?'true':'false');btn.setAttribute('aria-label',locked?`解除鎖定 ${pageLockPageNameV269(current)}`:`鎖定 ${pageLockPageNameV269(current)}`);btn.title=locked?'解除鎖定':'鎖定目前頁面';btn.querySelectorAll('span,small').forEach(x=>x.textContent='')}";
  if(s.includes(lockSyncOld))s=s.replace(lockSyncOld,lockSyncNew);
  else if(!s.includes("row?.classList.toggle('v2611Hidden'"))throw new Error('[v2611-ui] page lock sync anchor not found');

  // 2) TradingView return pin. Remember the symbol/card, not just the href/index.
  const capStart=s.indexOf('function tvReturnCaptureV268(a){');
  const capEnd=capStart>=0?s.indexOf('\nfunction tvReturnApplyV268(){',capStart):-1;
  if(capStart>=0&&capEnd>capStart){
    const cap=`function tvReturnCaptureV268(a){
  if(!a?.href||!String(a.href).includes('tradingview.com'))return;
  const card=a.closest('.rankCard,.testCard,.testMonitorCard,.actualTradeMonitorCard,.biasRow,.matrixCoin,.sg-candidate-card,.manual-card,.manual-shadow-history-row,.abc-sample-row'),symbol=String(a.dataset?.tvSymbol||a.textContent||'').toUpperCase().replace(/[^A-Z0-9]/g,''),page=document.querySelector('.pageTab.active')?.dataset?.page||'';
  const data={at:Date.now(),href:a.href,symbol,page,top:a.getBoundingClientRect().top,cardTop:card?.getBoundingClientRect().top??null,scrollY:window.scrollY||document.documentElement.scrollTop||0};
  window.__tvReturnHoldUntilV2611=Date.now()+12000;try{history.scrollRestoration='manual'}catch{}try{sessionStorage.setItem(TV_RETURN_KEY_V268,JSON.stringify(data))}catch{}
}`;
    s=s.slice(0,capStart)+cap+s.slice(capEnd);
  }else if(!s.includes('__tvReturnHoldUntilV2611'))throw new Error('[v2611-ui] TV capture anchor not found');

  const applyStart=s.indexOf('function tvReturnApplyV268(){');
  const applyEnd=applyStart>=0?s.indexOf('\nfunction tvReturnRestoreV268(){',applyStart):-1;
  if(applyStart>=0&&applyEnd>applyStart){
    const apply=`function tvReturnApplyV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000){tvReturnClearV268();return}
  const page=String(d.page||'').replace(/[^a-z0-9_-]/gi,'');
  if(page&&document.querySelector('.pageTab.active')?.dataset?.page!==page){try{setPage(page,{force:true})}catch{document.querySelector(\`.pageTab[data-page="\${page}"]\`)?.click()}}
  requestAnimationFrame(()=>{
    const sym=String(d.symbol||''),links=[...document.querySelectorAll('[data-tv-symbol]')].filter(x=>String(x.dataset?.tvSymbol||'').toUpperCase()===sym&&x.offsetParent!==null),target=links[0]||[...document.querySelectorAll('a[href]')].find(x=>x.href===d.href&&x.offsetParent!==null),card=target?.closest?.('.rankCard,.testCard,.testMonitorCard,.actualTradeMonitorCard,.biasRow,.matrixCoin,.sg-candidate-card,.manual-card,.manual-shadow-history-row,.abc-sample-row');
    tvReturnApplyingV268=true;let done=false;
    if(card&&Number.isFinite(Number(d.cardTop))){const delta=card.getBoundingClientRect().top-Number(d.cardTop);if(Math.abs(delta)<window.innerHeight*4){window.scrollBy({top:delta,left:0,behavior:'auto'});done=true}}
    if(!done&&target){const delta=target.getBoundingClientRect().top-Number(d.top||0);if(Math.abs(delta)<window.innerHeight*4){window.scrollBy({top:delta,left:0,behavior:'auto'});done=true}}
    if(!done)window.scrollTo({top:Number(d.scrollY||0),left:0,behavior:'auto'});
    requestAnimationFrame(()=>{tvReturnApplyingV268=false});
  })
}`;
    s=s.slice(0,applyStart)+apply+s.slice(applyEnd);
  }

  const restoreStart=s.indexOf('function tvReturnRestoreV268(){');
  const restoreEnd=restoreStart>=0?s.indexOf("\ndocument.addEventListener('click',e=>",restoreStart):-1;
  if(restoreStart>=0&&restoreEnd>restoreStart){
    const restore=`function tvReturnRestoreV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000)return;
  window.__tvReturnHoldUntilV2611=Date.now()+11000;tvReturnArmedV268=true;for(const t of tvReturnTimersV268)clearTimeout(t);tvReturnTimersV268=[];
  for(const ms of [0,70,160,320,600,1000,1600,2500,3800,5600,8000,10000])tvReturnTimersV268.push(setTimeout(()=>{if(tvReturnArmedV268)tvReturnApplyV268()},ms));
  tvReturnTimersV268.push(setTimeout(()=>{window.__tvReturnHoldUntilV2611=0;tvReturnClearV268()},10500));
}`;
    s=s.slice(0,restoreStart)+restore+s.slice(restoreEnd);
  }

  // Do not let the 8s refresh rerender the ranked list while iOS is returning from TV.
  const refreshOld="setInterval(()=>{const active=document.querySelector('.pageTab.active')?.dataset?.page;if(active==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}else if(active==='flow')void refreshMarketFlow(false);else if(active==='ideas')void refreshRankedIdeas(false);else if(active==='test'||active==='monitor')void refreshTestSignals(false);else if(active==='performance')void refreshPerformance(false)},8_000);";
  const refreshNew="setInterval(()=>{if(Number(window.__tvReturnHoldUntilV2611||0)>Date.now())return;const active=document.querySelector('.pageTab.active')?.dataset?.page;if(active==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}else if(active==='flow')void refreshMarketFlow(false);else if(active==='ideas')void refreshRankedIdeas(false);else if(active==='test'||active==='monitor')void refreshTestSignals(false);else if(active==='performance')void refreshPerformance(false)},8_000);";
  if(s.includes(refreshOld))s=s.replace(refreshOld,refreshNew);

  // 3) Ranked ideas: public/local Chinese project profile, zero AI/web-search charge.
  if(!s.includes('COIN_PROFILE_V2611')){
    const anchor='function ideaBiasClass(v){';
    if(!s.includes(anchor))throw new Error('[v2611-ui] ranked idea profile anchor not found');
    const profile=fs.readFileSync(mustFile('coin-profile-v2611.inc'),'utf8').trimEnd()+'\n\n'+anchor;
    s=s.replace(anchor,profile);
  }

  const detailOld='<details class="ideaDetail" data-idea-symbol="${esc(x.symbol)}" data-idea-dir="${esc(x.direction)}" data-persist-detail="idea:${esc(x.symbol)}:${esc(x.direction)}" ${detailOpenAttr(`idea:${x.symbol}:${x.direction}`)}><summary><span>展開（詳細）</span><b>AI網搜 · 2小時快取</b></summary><div class="ideaDetailBody" data-idea-analysis-body><div class="ideaAnalysisLoading">點開後才做即時網搜，避免浪費 API。</div></div></details>';
  const detailNew='<details class="ideaDetail coinProfileDetailV2611" data-persist-detail="idea:${esc(x.symbol)}:${esc(x.direction)}" ${detailOpenAttr(`idea:${x.symbol}:${x.direction}`)}><summary><span>幣種介紹</span><b>公開資料 · 中文整理</b></summary><div class="ideaDetailBody">${renderCoinProfileV2611(x)}</div></details>';
  if(s.includes(detailOld))s=s.replace(detailOld,detailNew);
  else if(!s.includes('coinProfileDetailV2611'))throw new Error('[v2611-ui] ranked detail anchor not found');

  const bindStart=s.indexOf('function bindIdeaDetails(){');
  const bindEnd=bindStart>=0?s.indexOf('\nfunction renderRankedIdeas(',bindStart):-1;
  if(bindStart>=0&&bindEnd>bindStart){s=s.slice(0,bindStart)+"function bindIdeaDetails(){bindPersistentDetails($('recGrid'))}"+s.slice(bindEnd)}

  s=`// ${MARKER}: icon-only page lock, TV return pin, local Chinese coin profiles.\n${s}`;
  const changed=save(file,before,s);if(changed)check(file);return changed;
}

function patchPf(){
  const out={};
  for(const name of ['growth-abc-v264.js','manual-mode-ui.js']){
    const file=mustFile('public',name),before=fs.readFileSync(file,'utf8');let s=before;
    s=s.replaceAll("pf==null?'—':pf.toFixed(2)","pf==null?'—':pf>=99?'無虧損':pf.toFixed(2)");
    s=s.replaceAll("num(x.profitFactor)==null?'—':Number(x.profitFactor).toFixed(2)","num(x.profitFactor)==null?'—':Number(x.profitFactor)>=99?'無虧損':Number(x.profitFactor).toFixed(2)");
    out[name]=save(file,before,s);
    if(out[name]&&name.endsWith('.js'))check(file);
  }
  return out;
}

function patchIndex(){
  const file=mustFile('public','index.html'),before=fs.readFileSync(file,'utf8');let s=before;if(s.includes('UI_POLISH_V2611 styles'))return false;
  const css=`<style id="v2611-ui-polish">\n/* UI_POLISH_V2611 styles */\n.pageLockRowV269.v2611Hidden{display:none!important}.pageLockTagV269{width:27px!important;min-width:27px!important;height:27px!important;padding:0!important;justify-content:center!important;gap:0!important}.pageLockTagV269 span,.pageLockTagV269 small{display:none!important}.pageLockTagV269 i{margin:0!important}.coinProfileV2611{padding:2px 0 1px}.coinProfileTitle{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:3px 1px 9px}.coinProfileTitle b{color:#e3d8c7;font-size:14px}.coinProfileTitle span{color:#8ca9cc;font-size:9px;font-weight:850;text-align:right}.coinProfileGrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.coinProfileGrid>div{padding:9px;border:1px solid #252b2e;border-radius:10px;background:#0d1012}.coinProfileGrid>div.wide{grid-column:1/-1}.coinProfileGrid span{display:block;color:#716b63;font-size:8.5px;font-weight:850}.coinProfileGrid b{display:block;margin-top:4px;color:#cfc6b9;font-size:10px;line-height:1.55;font-weight:750}.coinProfileGrid .risk b{color:#bfae92}.coinProfileV2611>small{display:block;margin-top:8px;color:#625e58;font-size:8.5px;line-height:1.45}.coinProfileDetailV2611>summary b{color:#748eae!important}.testNotifyModes{grid-template-columns:repeat(2,1fr)!important}.testNotifyModes label:has(input[value=\"ALL\"]){display:none!important}.consensusSetting{display:none!important}\n@media(max-width:520px){.pageLockTagV269{width:29px!important;min-width:29px!important;height:29px!important}.coinProfileGrid{grid-template-columns:1fr}.coinProfileGrid>div.wide{grid-column:1}.coinProfileTitle b{font-size:15px}.coinProfileTitle span{font-size:9.5px}.coinProfileGrid span{font-size:9.5px}.coinProfileGrid b{font-size:11px}.coinProfileV2611>small{font-size:9.5px}}\n</style>\n<!-- UI_POLISH_V2611 styles -->`;
  s=s.replace('</head>',`${css}\n</head>`);return save(file,before,s);
}

export function patchUiPolishV2611(){const files={app:patchApp(),pf:patchPf(),index:patchIndex()};return{changed:Boolean(files.app||files.index||Object.values(files.pf).some(Boolean)),files,marker:MARKER}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchUiPolishV2611());
