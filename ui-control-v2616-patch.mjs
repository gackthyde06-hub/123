import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='UI_CONTROL_V2616';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v2616-ui] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2616-ui] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const ext=path.extname(f)||'.tmp',tmp=`${f}.v2616-${process.pid}-${Date.now()}${ext}`;fs.writeFileSync(tmp,a,'utf8');try{if(ext==='.js'||ext==='.mjs')check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function replaceOnce(s,a,b,label){if(!s.includes(a))throw new Error(`[v2616-ui] anchor missing: ${label}`);return s.replace(a,b)}

function patchApp(){
  const f=must('public','app.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return false;

  const prefAnchor="const PERF_SIM_PREF='position-alert-perf-sim-v100';";
  const helpers=`${prefAnchor}\nconst OBS_DISMISS_PREF_V2616='position-alert-observation-dismiss-v2616';\nconst OBS_STALE_MS_V2616=3*60*1000;
const OBS_DISMISS_MS_V2616=6*60*60*1000;\nconst SHADOW_NOTICE_SOURCE_PREF_V2616='position-alert-shadow-notice-source-v2616';\nconst SHADOW_NOTICE_MASTER_PREF_V2616='position-alert-shadow-notice-master-v2616';
const IDEA_FALLBACK_PREF_V2616='position-alert-idea-fallback-v2616';\nfunction observationKeyV2616(x){return String(x?.key||[x?.symbol||'',x?.direction||''].join(':'))}\nfunction observationUpdatedMsV2616(x){const raw=x?.lastEvaluatedAt||x?.updatedAt||x?.generatedAt||x?.createdAt||'';const ms=raw?Date.parse(raw):0;return Number.isFinite(ms)?ms:0}\nfunction loadObservationDismissV2616(){try{const raw=JSON.parse(localStorage.getItem(OBS_DISMISS_PREF_V2616)||'{}'),now=Date.now(),out={};for(const [k,v] of Object.entries(raw&&typeof raw==='object'?raw:{})){const n=Number(v||0);if(n>now-24*60*60*1000)out[k]=n}if(JSON.stringify(raw)!==JSON.stringify(out))localStorage.setItem(OBS_DISMISS_PREF_V2616,JSON.stringify(out));return out}catch{return{}}}\nfunction observationVisibleV2616(x){const at=observationUpdatedMsV2616(x),now=Date.now();if(!(at>0)||now-at>OBS_STALE_MS_V2616)return false;const closed=Number(loadObservationDismissV2616()[observationKeyV2616(x)]||0);return !(closed>0&&now-closed<OBS_DISMISS_MS_V2616)}\nfunction dismissObservationV2616(key){if(!key)return;try{const d=loadObservationDismissV2616();d[String(key)]=Date.now();localStorage.setItem(OBS_DISMISS_PREF_V2616,JSON.stringify(d))}catch{}if(testSignalsState)renderTestSignals(testSignalsState)}\nfunction loadShadowNoticeSourceV2616(){try{const v=String(localStorage.getItem(SHADOW_NOTICE_SOURCE_PREF_V2616)||'BOTH').toUpperCase();return ['MANUAL','AUTO','BOTH'].includes(v)?v:'BOTH'}catch{return'BOTH'}}\nfunction loadShadowNoticeMasterV2616(){try{const v=localStorage.getItem(SHADOW_NOTICE_MASTER_PREF_V2616);return v===null?loadTestSignalNotify():v==='1'}catch{return loadTestSignalNotify()}}\nasync function applyShadowNoticeSourceV2616(source,enabled=true){source=['MANUAL','AUTO','BOTH'].includes(String(source||'').toUpperCase())?String(source).toUpperCase():'BOTH';enabled=enabled===true;try{localStorage.setItem(SHADOW_NOTICE_SOURCE_PREF_V2616,source);localStorage.setItem(SHADOW_NOTICE_MASTER_PREF_V2616,enabled?'1':'0')}catch{}saveTestSignalNotify(enabled&&(source==='AUTO'||source==='BOTH'));saveTestSignalNotifyMode('HIGH_NORMAL');const sub=await getPushSubscription().catch(()=>null);if(sub){await syncPreferences().catch(()=>{});await fetch('/api/manual-preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,enabled:enabled&&(source==='MANUAL'||source==='BOTH'),mode:'AB'})}).catch(()=>null)}try{window.dispatchEvent(new CustomEvent('shadow-notice-source:v2616',{detail:{source,enabled}}))}catch{}return{source,enabled}}\nfunction saveIdeaFallbackV2616(d){try{if(d?.ok&&Array.isArray(d.rows)&&d.rows.length)localStorage.setItem(IDEA_FALLBACK_PREF_V2616,JSON.stringify({at:Date.now(),data:d}))}catch{}}
function loadIdeaFallbackV2616(){try{const x=JSON.parse(localStorage.getItem(IDEA_FALLBACK_PREF_V2616)||'null');return x&&Date.now()-Number(x.at||0)<60*60*1000?x.data:null}catch{return null}}
window.loadShadowNoticeSourceV2616=loadShadowNoticeSourceV2616;window.loadShadowNoticeMasterV2616=loadShadowNoticeMasterV2616;window.applyShadowNoticeSourceV2616=applyShadowNoticeSourceV2616;\nif('serviceWorker'in navigator){navigator.serviceWorker.register('/sw.js?v=2616').then(r=>r.update()).catch(()=>{})}\n`;
  s=replaceOnce(s,prefAnchor,helpers,'prefs/helpers');

  // Fresh observation cards only. Old cards such as 21:28 at 00:xx disappear regardless of server retention.
  const renderStart="  if(!d?.ok)return;testSignalsState=d;testSignalsFetchedAt=Date.now();const rows=d.rows||[],live=d.liveStats||{};if(lastStatus)renderCalcPositions(lastStatus);";
  const renderNew="  if(!d?.ok)return;testSignalsState=d;testSignalsFetchedAt=Date.now();const rows=(d.rows||[]).filter(observationVisibleV2616),live=d.liveStats||{};if(lastStatus)renderCalcPositions(lastStatus);";
  s=replaceOnce(s,renderStart,renderNew,'fresh observation rows');

  // Every observation card gets a real X. Manual close stays hidden for 6h; background refresh cannot reopen it.
  s=s.replace('<div class="testCard ${testStatusClass(x.status)}">','<div class="testCard ${testStatusClass(x.status)}" data-observation-key="${esc(observationKeyV2616(x))}">');
  s=s.replace('<div class="testHead"><div class="testRank">','<div class="testHead"><button type="button" class="observationCloseV2616" data-observation-close="${esc(observationKeyV2616(x))}" aria-label="關閉這筆觀察">×</button><div class="testRank">');
  const deepBind='  bindTestDeepDetails();';
  s=replaceOnce(s,deepBind,`  document.querySelectorAll('[data-observation-close]').forEach(b=>{if(b.dataset.v2616Bound==='1')return;b.dataset.v2616Bound='1';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();dismissObservationV2616(b.dataset.observationClose)},{capture:true})});\n${deepBind}`,'observation close bind');

  // User-facing A/B naming. Internally HIGH/NORMAL thresholds are unchanged.
  s=s.replace("function testTierLabel(x){return({HIGH:'高勝率',NORMAL:'普通',VALID:'有效',BLOCKED:'暫停'})[String(x?.notificationTier||'VALID').toUpperCase()]||'有效'}","function testTierLabel(x){return({HIGH:'影子 A',NORMAL:'影子 B',VALID:'觀察',BLOCKED:'暫停'})[String(x?.notificationTier||'VALID').toUpperCase()]||'觀察'}");
  s=s.replace("function testMonitorTierLabel(x){return({HIGH:'高勝率通知',NORMAL:'普通通知'})[testMonitorNoticeTier(x)]||'已通知'}","function testMonitorTierLabel(x){return({HIGH:'影子 A 通知',NORMAL:'影子 B 通知'})[testMonitorNoticeTier(x)]||'已通知'}");
  s=s.replace("if(tier==='HIGH')return`高勝率通知條件通過${learn}`;if(tier==='NORMAL')return`普通通知條件通過${learn}`;","if(tier==='HIGH')return`影子 A 通知條件通過${learn}`;if(tier==='NORMAL')return`影子 B 通知條件通過${learn}`;");
  s=s.replace('高勝率＋普通勝率','影子 A＋B');
  s=s.replaceAll('普通／高勝率通知門檻','影子 A／B 通知門檻').replaceAll('普通或高勝率通知門檻','影子 A／B 通知門檻');

  // Unified source selector: MANUAL / AUTO / BOTH. One master switch controls both server paths.
  const initRe=/function initTestNotifyControls\(\)\{[\s\S]*?\n\}\ninitTestNotifyControls\(\);/;
  const initBlock=`function initTestNotifyControls(){\n  const modes=document.querySelector('.testNotifyModes');if(modes)modes.innerHTML='<label><input type="radio" name="shadowNotifySourceV2616" value="MANUAL"><span><b>手動</b><small>只收手動影子 A/B</small></span></label><label><input type="radio" name="shadowNotifySourceV2616" value="AUTO"><span><b>自動</b><small>只收觀察自動判斷 A/B</small></span></label><label><input type="radio" name="shadowNotifySourceV2616" value="BOTH"><span><b>全開</b><small>兩路開啟 · 同標的不重複</small></span></label>';\n  const sync=()=>{const source=loadShadowNoticeSourceV2616(),enabled=loadShadowNoticeMasterV2616(),toggle=$('testSignalNotify');if(toggle)toggle.checked=enabled;document.querySelectorAll('[name="shadowNotifySourceV2616"]').forEach(r=>r.checked=r.value===source)};sync();\n  document.querySelectorAll('[name="shadowNotifySourceV2616"]').forEach(r=>r.addEventListener('change',async()=>{if(!r.checked)return;await applyShadowNoticeSourceV2616(r.value,loadShadowNoticeMasterV2616());const msg=$('testNotifyMsg');if(msg)msg.textContent=r.value==='MANUAL'?'只收手動影子 A/B':r.value==='AUTO'?'只收自動影子 A/B':'手動＋自動全開；45分鐘同標的去重'}));\n  $('testSignalNotify')?.addEventListener('change',async e=>{if(e.currentTarget.checked&&!await getPushSubscription()){e.currentTarget.checked=false;const msg=$('testNotifyMsg');if(msg)msg.textContent='先到「監控」同步 iPhone 通知';return}await applyShadowNoticeSourceV2616(loadShadowNoticeSourceV2616(),e.currentTarget.checked);const msg=$('testNotifyMsg');if(msg)msg.textContent=e.currentTarget.checked?'A/B 影子通知已開':'影子通知已關'});\n  window.addEventListener('shadow-notice-source:v2616',sync);\n}\ninitTestNotifyControls();`;
  if(initRe.test(s))s=s.replace(initRe,initBlock);

  const diagOld="  const ns=d.notifyStats||{},mode=loadTestSignalNotifyMode(),modeText=({HIGH:'只開高勝率',HIGH_NORMAL:'高＋普通',ALL:'全部有效'})[mode]||'高＋普通';\n  if($('testNotifyDiag'))$('testNotifyDiag').innerHTML=`<b>${modeText}</b> · 目前高 ${Number(ns.high||0)} / 普通 ${Number(ns.normal||0)} / 有效 ${Number(ns.valid||0)} / 暫停 ${Number(ns.blocked||0)}<span>順勢回踩、突破回測、掃流動性、動能續攻、區間極值會自動競爭；只有最佳策略完成且通過風險閘門才推。</span>`;";
  const diagNew="  const ns=d.notifyStats||{},mode=loadShadowNoticeSourceV2616(),modeText=({MANUAL:'手動',AUTO:'自動',BOTH:'全開'})[mode]||'全開';\n  if($('testNotifyDiag'))$('testNotifyDiag').innerHTML=`<b>${modeText}</b> · 自動影子 A ${Number(ns.high||0)} / B ${Number(ns.normal||0)} / 暫停 ${Number(ns.blocked||0)}<span>手機只允許：熬鷹建倉/加減/平倉，以及影子 A/B。手動＋自動共用 45 分鐘同標的去重。</span>`;";
  if(s.includes(diagOld))s=s.replace(diagOld,diagNew);else{s=s.replace(/  const ns=d\.notifyStats\|\|\{\}[\s\S]*?if\(\$\('testNotifyDiag'\)\)\$\('testNotifyDiag'\)\.innerHTML=`[\s\S]*?`;/,diagNew)}

  // Recommendation page guard: malformed optional profile data must never blank the whole page.
  const recFnAnchor='async function refreshRankedIdeas(force=false){';
  if(s.includes(recFnAnchor)&&!s.includes('function safeRenderRankedIdeasV2616(')){
    const guard=`function renderRankedIdeasFallbackV2616(d){const grid=$('recGrid');if(!grid)return;const rows=(d?.rows||[]).slice(0,16);grid.innerHTML=rows.map((x,i)=>{const dir=x?.direction==='SHORT'?'SHORT':'LONG',reason=String(x?.reason||x?.profile?.purpose||'等待更多市場資料'),rate=Number(x?.estimatedWinRate);return \`<article class=\"rankCard\"><div class=\"rankHeadGrid\"><div class=\"rankNo\">\${i+1}</div><div class=\"rankMain\"><div class=\"rankTop\">\${tvAnchor(x?.symbol||'', 'tvNameLink rankSymbol')}<span class=\"recTag \${dir==='SHORT'?'short':'long'}\">\${dir==='SHORT'?'做空':'做多'}</span></div><div class=\"rankProfile\"><span>影子建議</span><b>\${esc(x?.profile?.purpose||'結構與市場資料交叉判斷')}</b></div></div><div class=\"rankWin\"><b>\${Number.isFinite(rate)?rate.toFixed(1)+'%':'—'}</b><span>量化估算</span></div></div><div class=\"rankReason\">\${esc(reason)}</div></article>\`}).join('')||'<div class=\"loadingBox\">目前沒有可顯示的建議；系統會自動重試。</div>';try{window.dispatchEvent(new CustomEvent('ranked-ideas:rendered'))}catch{}}
function safeRenderRankedIdeasV2616(d){try{renderRankedIdeas(d)}catch(e){console.warn('[v2616] recommendation render fallback',e);renderRankedIdeasFallbackV2616(d)}}
`;
    s=s.replace('{renderRankedIdeas(rankedIdeasState);return}','{safeRenderRankedIdeasV2616(rankedIdeasState);return}');
    s=s.replace(';renderRankedIdeas(d)}catch',';safeRenderRankedIdeasV2616(d)}catch');
    s=s.replace('if(rankedIdeasState)renderRankedIdeas({...rankedIdeasState,stale:true})','if(rankedIdeasState)safeRenderRankedIdeasV2616({...rankedIdeasState,stale:true})');
    s=s.replace('if(cached)renderRankedIdeas({...cached,stale:true})','if(cached)safeRenderRankedIdeasV2616({...cached,stale:true})');
    s=s.replace(recFnAnchor,guard+recFnAnchor);
  }

  // Force a new service worker generation so old noisy queues do not keep controlling the PWA.
  s=s.replace("navigator.serviceWorker.register('/sw.js?v=1021')","navigator.serviceWorker.register('/sw.js?v=2616')");

  s=`// ${MARKER}\n${s}`;
  const changed=save(f,before,s);return changed;
}

function patchManual(){
  const f=must('public','manual-mode-ui.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return false;
  s=s.replace(/const VERSION='[^']+',FILTER_KEY='manual-grade-filter-v263'/,"const VERSION='2.6.16',FILTER_KEY='manual-grade-filter-v263'");
  s=s.replace("const gradeText=g=>({A:'A級｜優先研究',B:'B級｜等待確認',C:'C級｜只觀察'})[g]||g;","const gradeText=g=>({A:'A級｜影子優先',B:'B級｜影子等待',C:'C級｜後台學習'})[g]||g;");

  const renderStart="  if(!mount()||!state.data)return;const box=document.getElementById('manualOpsPanel'),anchor=manualAnchor(box),d=state.data,filter=state.filter,rows=(d.rows||[]).filter(x=>filter==='ALL'||x.grade===filter),stats=d.stats?.byGrade||[],rankStats=(d.stats?.byRank||[]).filter(x=>x.key!=='無排名'),abc=d.shadowLearning||{},abcBy=abc.byGrade||[];";
  const renderNew="  if(!mount()||!state.data)return;const box=document.getElementById('manualOpsPanel'),anchor=manualAnchor(box),d=state.data,filter=['A','B'].includes(state.filter)?state.filter:'A',eligibleRows=(d.rows||[]).filter(x=>['A','B'].includes(x.grade)),rows=eligibleRows.filter(x=>x.grade===filter),stats=(d.stats?.byGrade||[]).filter(x=>['A','B'].includes(x.key)),rankStats=(d.stats?.byRank||[]).filter(x=>x.key!=='無排名'),abc=d.shadowLearning||{},abcBy=abc.byGrade||[],source=window.loadShadowNoticeSourceV2616?.()||'BOTH',noticeOn=window.loadShadowNoticeMasterV2616?.()??state.pref.enabled;state.filter=filter;";
  if(s.includes(renderStart))s=s.replace(renderStart,renderNew);else s=s.replace(/  if\(!mount\(\)\|\|!state\.data\)return;const box=document\.getElementById\('manualOpsPanel'\),anchor=manualAnchor\(box\),d=state\.data,filter=state\.filter,rows=\(d\.rows\|\|\[\]\)\.filter\(x=>filter==='ALL'\|\|x\.grade===filter\),stats=d\.stats\?\.byGrade\|\|\[\],rankStats=\(d\.stats\?\.byRank\|\|\[\]\)\.filter\(x=>x\.key!=='無排名'\),abc=d\.shadowLearning\|\|\{\},abcBy=abc\.byGrade\|\|\[\];/,renderNew);
  s=s.replace("${['A','B','C'].map(abcCell).join('')}","${['A','B'].map(abcCell).join('')}");

  const tabsOld='<div class="manual-grade-summary"><button class="${filter===\'A\'?\'on\':\'\'}" data-filter="A"><b>A</b><span>${d.counts?.A||0}</span><small>優先研究</small></button><button class="${filter===\'B\'?\'on\':\'\'}" data-filter="B"><b>B</b><span>${d.counts?.B||0}</span><small>等待確認</small></button><button class="${filter===\'C\'?\'on\':\'\'}" data-filter="C"><b>C</b><span>${d.counts?.C||0}</span><small>只觀察</small></button><button class="${filter===\'ALL\'?\'on\':\'\'}" data-filter="ALL"><b>ALL</b><span>${(d.rows||[]).length}</span><small>全部</small></button></div>';
  const tabsNew='<div class="manual-grade-summary"><button class="${filter===\'A\'?\'on\':\'\'}" data-filter="A"><b>A</b><span>${eligibleRows.filter(x=>x.grade===\'A\').length}</span><small>影子優先</small></button><button class="${filter===\'B\'?\'on\':\'\'}" data-filter="B"><b>B</b><span>${eligibleRows.filter(x=>x.grade===\'B\').length}</span><small>影子等待</small></button></div>';
  if(s.includes(tabsOld))s=s.replace(tabsOld,tabsNew);else s=s.replace(/<div class="manual-grade-summary">[\s\S]*?<\/div><div class="manual-abc-shadow">/,tabsNew+'<div class="manual-abc-shadow">');
  s=s.replace('<b>手動作戰清單</b><small>建議＋觀察＋Structure＋Shadow 幫你先篩；即使你不下單，ABC 也會自動留影學習</small>','<b>影子 A/B 判斷</b><small>建議＋觀察＋Structure＋Shadow 共同判斷；C 級只進後台學習，前台永遠不顯示。</small>');

  const settingsOld='<div class="manual-settings"><div><b>手動模式通知</b><span>只通知篩出的等級；不會自動下單</span></div><select data-notify-mode><option value="A" ${state.pref.mode===\'A\'?\'selected\':\'\'}>只通知 A級</option><option value="AB" ${state.pref.mode===\'AB\'?\'selected\':\'\'}>A＋B級</option><option value="ALL" ${state.pref.mode===\'ALL\'?\'selected\':\'\'}>A＋B＋C</option></select><label class="manual-switch"><input data-notify-toggle type="checkbox" ${state.pref.enabled?\'checked\':\'\'}><i></i></label></div>';
  const settingsNew='<div class="manual-settings"><div><b>影子通知來源</b><span>只發 A/B；全開時手動、自動同標的 45 分鐘只響一次</span></div><select data-notify-source><option value="MANUAL" ${source===\'MANUAL\'?\'selected\':\'\'}>手動</option><option value="AUTO" ${source===\'AUTO\'?\'selected\':\'\'}>自動</option><option value="BOTH" ${source===\'BOTH\'?\'selected\':\'\'}>全開</option></select><label class="manual-switch"><input data-notify-toggle type="checkbox" ${noticeOn?\'checked\':\'\'}><i></i></label></div>';
  if(s.includes(settingsOld))s=s.replace(settingsOld,settingsNew);else s=s.replace(/<div class="manual-settings">[\s\S]*?<\/div><div class="manual-age">/,settingsNew+'<div class="manual-age">');

  const savePrefStart=s.indexOf('async function savePref(){');
  if(savePrefStart<0){console.warn('[v2616-ui] manual savePref missing; source selector will still use main controls')}else{
  let savePrefEnd=-1,depth=0,started=false;
  for(let i=savePrefStart;i<s.length;i++){const ch=s[i];if(ch==='{'){depth++;started=true}else if(ch==='}'){depth--;if(started&&depth===0){savePrefEnd=i+1;break}}}
  if(savePrefEnd<0)throw new Error('[v2616-ui] manual savePref end missing');
  const savePrefNew=`async function savePref(){const source=window.loadShadowNoticeSourceV2616?.()||'BOTH',enabled=window.loadShadowNoticeMasterV2616?.()??state.pref.enabled;if(typeof window.applyShadowNoticeSourceV2616==='function'){await window.applyShadowNoticeSourceV2616(source,enabled);state.pref={enabled:enabled&&(source==='MANUAL'||source==='BOTH'),mode:'AB'};render();return}const ep=await endpoint();if(!ep)return;await j('/api/manual-preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:ep,enabled:enabled&&(source==='MANUAL'||source==='BOTH'),mode:'AB'})});state.pref={enabled:enabled&&(source==='MANUAL'||source==='BOTH'),mode:'AB'};render()}`;
  s=s.slice(0,savePrefStart)+savePrefNew+s.slice(savePrefEnd);}

  const changeOld="  box.addEventListener('change',e=>{if(e.target.matches('[data-notify-toggle]')){state.pref.enabled=e.target.checked;void savePref()}else if(e.target.matches('[data-notify-mode]')){state.pref.mode=e.target.value;void savePref()}});";
  const changeNew="  box.addEventListener('change',e=>{if(e.target.matches('[data-notify-toggle]')){const source=window.loadShadowNoticeSourceV2616?.()||'BOTH';void window.applyShadowNoticeSourceV2616?.(source,e.target.checked)}else if(e.target.matches('[data-notify-source]')){void window.applyShadowNoticeSourceV2616?.(e.target.value,window.loadShadowNoticeMasterV2616?.()??true)}});";
  if(s.includes(changeOld))s=s.replace(changeOld,changeNew);
  s=s.replace("if(['A','B','C','ALL'].includes(f))state.filter=f","if(['A','B'].includes(f))state.filter=f;else state.filter='A'");
  s=s.replace("state.pref={enabled:d.enabled===true,mode:d.mode||'A'};render()","state.pref={enabled:d.enabled===true,mode:'AB'};try{if(localStorage.getItem('position-alert-shadow-notice-master-v2616')===null&&d.enabled===true)localStorage.setItem('position-alert-shadow-notice-master-v2616','1')}catch{};render()");
  s=s.replace("A/B/C 是手動執行優先級，不是勝率保證。A級也必須由你確認價格後才下單。","A/B 是影子判斷優先級，不是勝率保證；C 級只留後台學習。A級也必須由你確認價格後才下單。");
  s=s.replace("ABC 影子 ","A/B 影子 ");

  s=`// ${MARKER}\n${s}`;
  const changed=save(f,before,s);return changed;
}

function patchIndex(){
  const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let base=before.replace(/\/app\.js\?v=[^\"']+/g,'/app.js?v=102616').replace(/\/manual-mode-ui\.js\?v=[^\"']+/g,'/manual-mode-ui.js?v=sg2616').replace(/\/actual-trade-hub-v2613\.js\?v=[^\"']+/g,'/actual-trade-hub-v2613.js?v=sg2616');if(base.includes('UI_CONTROL_V2616 styles')){if(base!==before)save(f,before,base);return base!==before;}
  const css=`<style id="v2616-ui-control">\n/* UI_CONTROL_V2616 styles */\n.testHead{position:relative!important;padding-right:34px!important}.observationCloseV2616{position:absolute;right:0;top:-2px;width:29px;height:29px;padding:0;border:1px solid #3b4042;border-radius:50%;background:#0c0f10;color:#8d8881;font-size:18px;font-weight:800;line-height:1;z-index:5}.observationCloseV2616:active{border-color:#8b6930;color:#e6c271}.testNotifyModes{grid-template-columns:repeat(3,1fr)!important}.testNotifyModes label{min-width:0}.testNotifyModes span{min-height:54px!important}.manual-grade-summary{grid-template-columns:repeat(2,1fr)!important}.manual-settings select{min-width:88px}.actualHubHiddenV2616{margin:2px 0 10px;display:flex;justify-content:flex-end}.actualHubReopenV2616{height:30px;padding:0 10px;border:1px solid #343a3c;border-radius:999px;background:#0c0f10;color:#9a9389;font-size:9px;font-weight:900}.actualHubHideV2616{position:absolute;right:9px;top:9px;width:29px;height:29px;border:1px solid #3b4042;border-radius:50%;background:#0c0f10;color:#8d8881;font-size:17px;z-index:8}.actualTradeHubV2613{position:relative}\n@media(max-width:520px){.observationCloseV2616{width:31px;height:31px}.testNotifyModes{grid-template-columns:repeat(3,1fr)!important;gap:5px}.testNotifyModes span{padding:7px 5px!important}.testNotifyModes b{font-size:10px!important}.testNotifyModes small{font-size:7.5px!important}.manual-grade-summary{grid-template-columns:1fr 1fr!important}}\n</style>\n<!-- UI_CONTROL_V2616 styles -->`;
  return save(f,before,base.replace('</head>',`${css}\n</head>`));
}

export function patchUiControlV2616(){const files={app:patchApp(),manual:patchManual(),index:patchIndex()};return {changed:Object.values(files).some(Boolean),files,marker:MARKER}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchUiControlV2616());
