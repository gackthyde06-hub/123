import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='UI_POLISH_V268';
const HISTORY_MINUTES=360;

function mustFile(...parts){
  const file=path.join(__dirname,...parts);
  if(!fs.existsSync(file))throw new Error(`[v268-ui] missing ${parts.join('/')}`);
  return file;
}
function save(file,before,after){if(before===after)return false;fs.writeFileSync(file,after,'utf8');return true}

function patchServer(){
  const file=mustFile('server.js'),before=fs.readFileSync(file,'utf8');
  let s=before;
  if(s.includes('ABC_SHADOW_UI_HISTORY_V268'))return false;
  const anchor='async function manualOpportunityLoop(){';
  if(!s.includes(anchor))throw new Error('[v268-ui] manualOpportunityLoop anchor not found');
  const code=`/* ABC_SHADOW_UI_HISTORY_V268
 * UI-only recent history. Learning ledgers are NOT deleted when these rows disappear from the screen.
 * Keeps /api/manual-opportunities small; detail rows are fetched only when the user opens History/SAMPLE.
 */
const ABC_SHADOW_UI_HISTORY_MINUTES_V268=${HISTORY_MINUTES};
const ABC_SHADOW_UI_HISTORY_LIMIT_V268=30;
const ABC_SHADOW_UI_SAMPLE_LIMIT_V268=12;
function abcShadowUiTimeV268(v){const n=v?Date.parse(v):0;return Number.isFinite(n)?n:0}
function abcShadowUiRecentV268(){
  const now=Date.now(),cutoff=now-ABC_SHADOW_UI_HISTORY_MINUTES_V268*60_000;
  const rows=shadowPerformance.filter(x=>abcShadowTagged(x)&&abcShadowUiTimeV268(x.shadowAt)>=cutoff)
    .sort((a,b)=>abcShadowUiTimeV268(b.shadowAt)-abcShadowUiTimeV268(a.shadowAt))
    .slice(0,ABC_SHADOW_UI_HISTORY_LIMIT_V268)
    .map(x=>({
      id:x.id,symbol:x.symbol,direction:x.direction==='SHORT'?'SHORT':'LONG',
      gradeAtEntry:abcShadowGrade(x.manualGradeAtEntry),gradeCurrent:abcShadowGrade(x.manualGradeCurrent||x.manualGradeAtEntry),
      shadowAt:x.shadowAt,lastSeenAt:x.abcLastSeenAt||x.lastPriceAt||x.shadowAt,status:x.status,result:x.result,resultAt:x.resultAt,
      learningEligible:x.learningEligible!==false,
      sampleEligible:x.status==='RESOLVED'&&x.learningEligible!==false&&['WIN','LOSS','TIMEOUT'].includes(String(x.result||'')),
      entryPrice:Number.isFinite(Number(x.entryPrice))?Number(x.entryPrice):null,
      stop:Number.isFinite(Number(x.stop))?Number(x.stop):null,
      target:Number.isFinite(Number(x.target))?Number(x.target):null
    }));
  return {ok:true,version:'V2.6.8',generatedAt:new Date(now).toISOString(),historyMinutes:ABC_SHADOW_UI_HISTORY_MINUTES_V268,limit:ABC_SHADOW_UI_HISTORY_LIMIT_V268,sampleLimit:ABC_SHADOW_UI_SAMPLE_LIMIT_V268,rows};
}
app.get('/api/manual-shadow-history',(_req,res)=>{res.set('cache-control','private, max-age=30');res.json(abcShadowUiRecentV268())});

`;
  s=s.replace(anchor,code+anchor);
  return save(file,before,s);
}

function patchApp(){
  const file=mustFile('public','app.js'),before=fs.readFileSync(file,'utf8');
  let s=before;
  if(s.includes('TV_RETURN_POSITION_V268'))return false;
  const anchor="const $=id=>document.getElementById(id);";
  if(!s.includes(anchor))throw new Error('[v268-ui] app $ anchor not found');
  const helper=`${anchor}

// TV_RETURN_POSITION_V268: remember the exact viewport before opening TradingView.
// Mobile/PWA visibility refreshes can rerender cards after returning; re-pin the clicked row instead of jumping elsewhere.
const TV_RETURN_KEY_V268='position-alert-tv-return-v268';
let tvReturnTimersV268=[],tvReturnApplyingV268=false,tvReturnArmedV268=false;
function tvReturnReadV268(){try{return JSON.parse(sessionStorage.getItem(TV_RETURN_KEY_V268)||'null')}catch{return null}}
function tvReturnClearV268(){for(const t of tvReturnTimersV268)clearTimeout(t);tvReturnTimersV268=[];tvReturnArmedV268=false;try{sessionStorage.removeItem(TV_RETURN_KEY_V268)}catch{}}
function tvReturnCaptureV268(a){
  if(!a?.href||!String(a.href).includes('tradingview.com'))return;
  const same=[...document.querySelectorAll('a[href]')].filter(x=>x.href===a.href),idx=Math.max(0,same.indexOf(a));
  const data={at:Date.now(),href:a.href,index:idx,top:a.getBoundingClientRect().top,scrollY:window.scrollY||document.documentElement.scrollTop||0,page:document.querySelector('.pageTab.active')?.dataset?.page||''};
  try{sessionStorage.setItem(TV_RETURN_KEY_V268,JSON.stringify(data))}catch{}
}
function tvReturnApplyV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000){tvReturnClearV268();return}
  const page=String(d.page||'').replace(/[^a-z0-9_-]/gi,'');
  if(page){const tab=document.querySelector(\`.pageTab[data-page="\${page}"]\`);if(tab&&!tab.classList.contains('active'))tab.click()}
  requestAnimationFrame(()=>{
    const matches=[...document.querySelectorAll('a[href]')].filter(x=>x.href===d.href&&x.offsetParent!==null),target=matches[Math.min(Number(d.index||0),Math.max(0,matches.length-1))]||matches[0];
    tvReturnApplyingV268=true;
    if(target){const delta=target.getBoundingClientRect().top-Number(d.top||0);if(Math.abs(delta)<window.innerHeight*3)window.scrollBy({top:delta,left:0,behavior:'auto'});else window.scrollTo({top:Number(d.scrollY||0),left:0,behavior:'auto'})}
    else window.scrollTo({top:Number(d.scrollY||0),left:0,behavior:'auto'});
    requestAnimationFrame(()=>{tvReturnApplyingV268=false});
  })
}
function tvReturnRestoreV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000)return;
  tvReturnArmedV268=true;for(const t of tvReturnTimersV268)clearTimeout(t);tvReturnTimersV268=[];
  for(const ms of [20,160,420,900,1800,3200,5200,7600])tvReturnTimersV268.push(setTimeout(()=>{if(tvReturnArmedV268)tvReturnApplyV268()},ms));
  tvReturnTimersV268.push(setTimeout(tvReturnClearV268,8500));
}
document.addEventListener('click',e=>{const a=e.target?.closest?.('a[href]');if(a&&String(a.href||'').includes('tradingview.com'))tvReturnCaptureV268(a)},true);
for(const ev of ['pointerdown','touchstart','wheel'])document.addEventListener(ev,()=>{if(tvReturnArmedV268&&!tvReturnApplyingV268)tvReturnClearV268()},{passive:true,capture:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tvReturnRestoreV268()});
window.addEventListener('pageshow',()=>tvReturnRestoreV268());`;
  s=s.replace(anchor,helper);
  return save(file,before,s);
}

function patchSystemGrowth(){
  const file=mustFile('public','system-growth.js'),before=fs.readFileSync(file,'utf8');
  let s=before;
  s=s.replace("const VERSION='2.6.7-direct-tv';","const VERSION='2.6.8-ui-refine';");
  s=s.replaceAll('ABC 戰術養成','影子戰術');
  return save(file,before,s);
}

function patchGrowthAbc(){
  const file=mustFile('public','growth-abc-v264.js'),before=fs.readFileSync(file,'utf8');
  let s=before;
  s=s.replace("const VERSION='2.6.4'","const VERSION='2.6.8'");
  s=s.replaceAll('ABC 戰術養成','影子戰術');
  s=s.replace('<div class="sg-abc-battle-head"><b>正在發生</b><span>TURN STATUS · LIVE</span></div>','<div class="sg-abc-battle-head"><b>篩選中</b><span>TURN STATUS · LIVE</span></div>');
  return save(file,before,s);
}

function patchStructure(){
  const file=mustFile('public','structure-learning-ui.js'),before=fs.readFileSync(file,'utf8');
  let s=before;
  s=s.replace("const VERSION='2.6.7';","const VERSION='2.6.8';");
  const oldV267='<summary><i class="sg-acc-icon sl-icon"><svg viewBox="0 0 32 32" class="sl-memory-diamond" aria-hidden="true"><path d="M16 4 26 16 16 28 6 16Z" fill="none"/></svg></i><div><b>結構記憶</b>';
  const oldBase='<summary><i class="sg-acc-icon sl-icon"><span class="sl-memory-seal" aria-hidden="true"></span></i><div><b>結構記憶</b>';
  const next='<summary><span class="sl-memory-diamond" aria-hidden="true">◇</span><div><b>結構記憶</b>';
  if(s.includes(oldV267))s=s.replace(oldV267,next);else if(s.includes(oldBase))s=s.replace(oldBase,next);
  return save(file,before,s);
}

function patchStructureCss(){
  const file=mustFile('public','structure-learning-ui.css'),before=fs.readFileSync(file,'utf8');
  let s=before;
  if(!s.includes('/* UI_POLISH_V268 structure icon */'))s+=`\n/* UI_POLISH_V268 structure icon */\n.sl-memory-diamond{width:26px!important;height:26px!important;display:grid!important;place-items:center!important;align-self:center!important;color:#c7a85f!important;font-size:21px!important;font-family:Georgia,"Times New Roman",serif!important;font-weight:400!important;line-height:1!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;filter:none!important;padding:0!important;margin:0!important}.sl-icon{border:0!important;background:transparent!important;box-shadow:none!important}.sl-memory-seal{display:none!important}\n`;
  return save(file,before,s);
}

function patchManual(){
  const jsFile=mustFile('public','manual-mode-ui.js'),before=fs.readFileSync(jsFile,'utf8');
  let s=before;
  s=s.replace("const VERSION='2.6.7'","const VERSION='2.6.8'");
  const oldState="let state={data:null,busy:false,filter:'A',pref:{enabled:false,mode:'A'},endpoint:null,timer:null,openCards:new Set(),openForms:new Set(),rankOpen:false,drafts:new Map()};";
  const newState="let state={data:null,busy:false,filter:'A',pref:{enabled:false,mode:'A'},endpoint:null,timer:null,openCards:new Set(),openForms:new Set(),rankOpen:false,shadowHistoryOpen:false,sampleOpen:new Set(),shadowRecent:null,shadowRecentAt:0,shadowRecentBusy:false,drafts:new Map()};";
  if(s.includes(oldState))s=s.replace(oldState,newState);

  const oldLoad="try{const d=JSON.parse(localStorage.getItem(UI_KEY)||'{}');state.openCards=new Set(Array.isArray(d.openCards)?d.openCards:[]);state.openForms=new Set(Array.isArray(d.openForms)?d.openForms:[]);state.rankOpen=d.rankOpen===true}catch{}";
  const newLoad="try{const d=JSON.parse(localStorage.getItem(UI_KEY)||'{}');state.openCards=new Set(Array.isArray(d.openCards)?d.openCards:[]);state.openForms=new Set(Array.isArray(d.openForms)?d.openForms:[]);state.rankOpen=d.rankOpen===true;state.shadowHistoryOpen=d.shadowHistoryOpen===true;state.sampleOpen=new Set(Array.isArray(d.sampleOpen)?d.sampleOpen.filter(x=>['A','B','C'].includes(x)):[])}catch{}";
  if(s.includes(oldLoad))s=s.replace(oldLoad,newLoad);

  const oldSave="storageSet"; // sentinel only; actual replacement below is exact to V2.6.5 source.
  void oldSave;
  const saveNeedle="localStorage.setItem(UI_KEY,JSON.stringify({openCards:[...state.openCards].slice(-30),openForms:[...state.openForms].slice(-12),rankOpen:state.rankOpen}))";
  const saveNext="localStorage.setItem(UI_KEY,JSON.stringify({openCards:[...state.openCards].slice(-30),openForms:[...state.openForms].slice(-12),rankOpen:state.rankOpen,shadowHistoryOpen:state.shadowHistoryOpen,sampleOpen:[...state.sampleOpen]}))";
  if(s.includes(saveNeedle))s=s.replace(saveNeedle,saveNext);

  if(!s.includes('function shadowHistoryHtmlV268(')){
    const anchor="const outcomeText=t=>!t?'':t.status==='ACTIVE'?'實倉追蹤中':t.firstOutcome==='WIN'?'TP先到':t.firstOutcome==='LOSS'?'SP先到':'已結案';";
    if(!s.includes(anchor))throw new Error('[v268-ui] manual outcomeText anchor not found');
    const helper=`${anchor}
const SHADOW_HISTORY_CACHE_MS_V268=60_000;
function shadowRowsV268(){return Array.isArray(state.shadowRecent?.rows)?state.shadowRecent.rows:[]}
function shadowMinutesV268(){return Number(state.shadowRecent?.historyMinutes||${HISTORY_MINUTES})}
function shadowAgeV268(iso){const t=iso?Date.parse(iso):0;return Number.isFinite(t)&&t>0?age(Date.now()-t):'—'}
function shadowResultV268(x){if(x?.status==='ACTIVE')return'追蹤中';if(x?.result==='WIN')return'成功';if(x?.result==='LOSS')return'失敗';if(x?.result==='TIMEOUT')return'超時';return x?.status==='RESOLVED'?'已結算':'觀察中'}
function shadowResultClassV268(x){return x?.result==='WIN'?'good':x?.result==='LOSS'?'bad':x?.status==='ACTIVE'?'active':''}
function shadowSampleDetailV268(g){
  if(state.shadowRecentBusy&&!state.shadowRecent)return'<div class="abc-sample-empty">載入樣本明細…</div>';
  if(!state.shadowRecent)return'<div class="abc-sample-empty">展開後載入近 6 小時的樣本標的。</div>';
  const limit=Number(state.shadowRecent.sampleLimit||12),rows=shadowRowsV268().filter(x=>x.sampleEligible&&x.gradeAtEntry===g).slice(0,limit);
  if(!rows.length)return \`<div class="abc-sample-empty">近 \${shadowMinutesV268()} 分鐘沒有可顯示的 \${g} 級已結算樣本；舊樣本仍保留在學習統計。</div>\`;
  return \`<div class="abc-sample-list">\${rows.map(x=>\`<div class="abc-sample-row"><div>\${manualTvAnchor(x.symbol)}<span>\${x.direction==='SHORT'?'空':'多'} · \${shadowAgeV268(x.shadowAt)}</span></div><b class="\${shadowResultClassV268(x)}">\${shadowResultV268(x)}</b></div>\`).join('')}<small>只顯示近 \${shadowMinutesV268()} 分鐘；超時只從畫面隱藏，不刪除學習樣本。</small></div>\`;
}
function abcShadowCellV268(g,x){const sample=Number(x.sample||0),open=state.sampleOpen.has(g);return \`<details class="abc-shadow-stat grade-\${g.toLowerCase()}" data-abc-grade="\${g}" \${open?'open':''}><summary><span>\${g}級影子</span><b>\${sample} SAMPLE</b><small>\${sample?pct(x.hitRate):'累積中'} · PF \${num(x.profitFactor)==null?'—':Number(x.profitFactor).toFixed(2)} · 學習 \${Number(x.adjustment||0)>0?'+':''}\${Number(x.adjustment||0)}</small><i>⌄</i></summary>\${shadowSampleDetailV268(g)}</details>\`}
function shadowHistoryHtmlV268(){const rows=shadowRowsV268().slice(0,Number(state.shadowRecent?.limit||30)),open=state.shadowHistoryOpen;return \`<details class="manual-shadow-history" \${open?'open':''}><summary><span>歷史</span><b>\${state.shadowRecent?rows.length:'—'}</b><small>保留近 \${shadowMinutesV268()} 分鐘 · 最多 30 筆</small><i>⌄</i></summary><div class="manual-shadow-history-list">\${state.shadowRecentBusy&&!state.shadowRecent?'<div class="manual-shadow-history-empty">載入歷史…</div>':!state.shadowRecent?'<div class="manual-shadow-history-empty">展開後載入最近進入影子的標的。</div>':rows.length?rows.map(x=>\`<div class="manual-shadow-history-row"><div><strong>\${x.gradeCurrent||x.gradeAtEntry||'C'}</strong>\${manualTvAnchor(x.symbol)}<span>\${x.direction==='SHORT'?'空':'多'} · \${shadowAgeV268(x.shadowAt)}</span></div><b class="\${shadowResultClassV268(x)}">\${shadowResultV268(x)}</b></div>\`).join(''):'<div class="manual-shadow-history-empty">近 6 小時尚無影子歷史。</div>'}<small class="manual-shadow-history-note">到期只從這個歷史列表自動消失，Shadow / SAMPLE 統計與模型學習紀錄不會刪除。</small></div></details>\`}
async function loadShadowRecentV268(force=false){if(state.shadowRecentBusy)return;if(!force&&state.shadowRecent&&Date.now()-state.shadowRecentAt<SHADOW_HISTORY_CACHE_MS_V268)return;state.shadowRecentBusy=true;try{state.shadowRecent=await j('/api/manual-shadow-history');state.shadowRecentAt=Date.now()}catch(e){state.shadowRecent={ok:false,historyMinutes:${HISTORY_MINUTES},limit:30,sampleLimit:12,rows:[],error:String(e?.message||e)}}finally{state.shadowRecentBusy=false;render()}}`;
    s=s.replace(anchor,helper);
  }

  const abcOld="const abcCell=g=>{const x=abcBy.find(y=>y.key===g)||{};return `<div class=\"abc-shadow-stat grade-${g.toLowerCase()}\"><span>${g}級影子</span><b>${Number(x.sample||0)} SAMPLE</b><small>${x.sample?pct(x.hitRate):'累積中'} · PF ${num(x.profitFactor)==null?'—':Number(x.profitFactor).toFixed(2)} · 學習 ${Number(x.adjustment||0)>0?'+':''}${Number(x.adjustment||0)}</small></div>`};";
  if(s.includes(abcOld))s=s.replace(abcOld,"const abcCell=g=>abcShadowCellV268(g,abcBy.find(y=>y.key===g)||{});");
  const historyAnchor=" · 去相關 ${Number(abc.episodeMinutes||45)} 分</div></div><div class=\"manual-real-stats\">";
  const historyNext=" · 去相關 ${Number(abc.episodeMinutes||45)} 分</div></div>${shadowHistoryHtmlV268()}<div class=\"manual-real-stats\">";
  if(s.includes(historyAnchor)&&!s.includes('${shadowHistoryHtmlV268()}'))s=s.replace(historyAnchor,historyNext);

  const toggleOld="else if(d.classList.contains('manual-rank-history'))state.rankOpen=d.open;saveUiState()";
  const toggleNew="else if(d.classList.contains('manual-rank-history'))state.rankOpen=d.open;else if(d.classList.contains('manual-shadow-history')){state.shadowHistoryOpen=d.open;if(d.open)void loadShadowRecentV268(false)}else if(d.matches('.abc-shadow-stat[data-abc-grade]')){const g=d.dataset.abcGrade;if(d.open)state.sampleOpen.add(g);else state.sampleOpen.delete(g);if(d.open)void loadShadowRecentV268(false)}saveUiState()";
  if(s.includes(toggleOld))s=s.replace(toggleOld,toggleNew);

  const initNeedle="mount();void refresh(false);void loadPref();state.timer=setInterval";
  const initNext="mount();void refresh(false);void loadPref();if(state.shadowHistoryOpen||state.sampleOpen.size)void loadShadowRecentV268(false);state.timer=setInterval";
  if(s.includes(initNeedle))s=s.replace(initNeedle,initNext);

  const jsChanged=save(jsFile,before,s);

  const cssFile=mustFile('public','manual-mode-ui.css'),cssBefore=fs.readFileSync(cssFile,'utf8');
  let c=cssBefore;
  if(!c.includes('/* UI_POLISH_V268 manual history */'))c+=`\n/* UI_POLISH_V268 manual history */\n.manual-card.grade-b{border-color:rgba(88,135,197,.22)!important;box-shadow:inset 2px 0 rgba(82,109,143,.16)!important}\n.abc-shadow-stat{display:block!important;padding:0!important;overflow:hidden!important}.abc-shadow-stat>summary{list-style:none;display:grid;grid-template-columns:auto 1fr auto;gap:5px 8px;align-items:center;padding:9px;cursor:pointer}.abc-shadow-stat>summary::-webkit-details-marker{display:none}.abc-shadow-stat>summary span{grid-column:1;color:#756f67;font-size:10px;font-weight:850}.abc-shadow-stat>summary b{grid-column:2;text-align:right;margin:0;color:#d8d1c6;font-size:13px}.abc-shadow-stat>summary small{grid-column:1/3;color:#6e6a64;font-size:9.5px;line-height:1.4}.abc-shadow-stat>summary i{grid-column:3;grid-row:1/3;align-self:center;color:#66615a;font-style:normal;transition:transform .16s}.abc-shadow-stat[open]>summary i{transform:rotate(180deg)}.abc-shadow-stat.grade-b>summary b{color:#7f9fc9}.abc-sample-list{border-top:1px solid #20272a;padding:7px 9px 9px}.abc-sample-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;padding:7px 0;border-top:1px solid #1d2326}.abc-sample-row:first-child{border-top:0}.abc-sample-row>div{min-width:0}.abc-sample-row .manual-tv-link{font-size:11px;font-weight:900}.abc-sample-row span{display:block;margin-top:2px;color:#6d6861;font-size:8.5px}.abc-sample-row>b,.manual-shadow-history-row>b{font-size:9px;color:#8a8379}.abc-sample-row>b.good,.manual-shadow-history-row>b.good{color:#6fcf95}.abc-sample-row>b.bad,.manual-shadow-history-row>b.bad{color:#df7777}.abc-sample-row>b.active,.manual-shadow-history-row>b.active{color:#d3ac59}.abc-sample-list>small{display:block;margin-top:6px;color:#5f5b56;font-size:8.5px;line-height:1.45}.abc-sample-empty{padding:9px;border-top:1px solid #20272a;color:#68635d;font-size:9px;line-height:1.45}.manual-shadow-history{margin:0 10px 9px;border:1px solid #252b2e;border-radius:11px;background:#0b0f11;overflow:hidden}.manual-shadow-history>summary{list-style:none;display:grid;grid-template-columns:auto auto 1fr auto;align-items:center;gap:8px;padding:9px 10px;cursor:pointer}.manual-shadow-history>summary::-webkit-details-marker{display:none}.manual-shadow-history>summary span{color:#b7a37d;font-size:10px;font-weight:900}.manual-shadow-history>summary b{color:#ddba69;font-size:12px}.manual-shadow-history>summary small{color:#67635d;font-size:8.5px}.manual-shadow-history>summary i{color:#66615a;font-style:normal;transition:transform .16s}.manual-shadow-history[open]>summary i{transform:rotate(180deg)}.manual-shadow-history-list{border-top:1px solid #202528;padding:4px 9px 8px}.manual-shadow-history-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px 1px;border-top:1px solid #1e2426}.manual-shadow-history-row:first-child{border-top:0}.manual-shadow-history-row>div{min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap}.manual-shadow-history-row strong{display:inline-grid;place-items:center;width:20px;height:20px;border:1px solid #41464a;border-radius:6px;color:#aaa39a;font-size:9px}.manual-shadow-history-row .manual-tv-link{font-size:11px;font-weight:900}.manual-shadow-history-row span{color:#6d6861;font-size:8.5px}.manual-shadow-history-empty{padding:10px 2px;color:#68635d;font-size:9px}.manual-shadow-history-note{display:block;padding-top:6px;color:#5f5b56;font-size:8.5px;line-height:1.45}\n@media(max-width:520px){.manual-shadow-history>summary{grid-template-columns:auto auto 1fr auto}.manual-shadow-history>summary small{font-size:9px}.abc-shadow-stat>summary span{font-size:10.5px}.abc-shadow-stat>summary b{font-size:13.5px}.abc-shadow-stat>summary small{font-size:9.5px}.abc-sample-row .manual-tv-link,.manual-shadow-history-row .manual-tv-link{font-size:12px}}\n`;
  const cssChanged=save(cssFile,cssBefore,c);
  return jsChanged||cssChanged;
}

export function patchUiPolishV268(){
  const files={server:patchServer(),app:patchApp(),growth:patchSystemGrowth(),growthAbc:patchGrowthAbc(),structure:patchStructure(),structureCss:patchStructureCss(),manual:patchManual()};
  return {changed:Object.values(files).some(Boolean),files,marker:MARKER};
}
