import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const MARKER='UI_RESTRUCTURE_V2635_20260904';

function must(...p){const f=path.join(ROOT,...p);if(!fs.existsSync(f))throw new Error(`[v2635] missing ${p.join('/')}`);return f}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0||r.error)throw new Error(`[v2635] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`)}
function saveJs(file,before,after){if(before===after)return false;const tmp=`${file}.${process.pid}.${Date.now()}.tmp.js`;fs.writeFileSync(tmp,after,'utf8');try{check(tmp);fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function replaceNamedFunction(src,name,replacement){
  const start=src.indexOf(`function ${name}(`);if(start<0)return src;
  const brace=src.indexOf('{',start);if(brace<0)return src;
  let depth=0,mode='code',esc=false;
  for(let i=brace;i<src.length;i++){
    const c=src[i],n=src[i+1];
    if(mode==='line'){if(c==='\n')mode='code';continue}
    if(mode==='block'){if(c==='*'&&n==='/'){mode='code';i++}continue}
    if(mode==='sq'||mode==='dq'||mode==='bt'){
      if(esc){esc=false;continue}
      if(c==='\\'){esc=true;continue}
      if((mode==='sq'&&c==="'")||(mode==='dq'&&c==='"')||(mode==='bt'&&c==='`'))mode='code';
      continue;
    }
    if(c==='/'&&n==='/'){mode='line';i++;continue}
    if(c==='/'&&n==='*'){mode='block';i++;continue}
    if(c==="'"){mode='sq';continue}
    if(c==='"'){mode='dq';continue}
    if(c==='`'){mode='bt';continue}
    if(c==='{')depth++;
    else if(c==='}'&&--depth===0)return src.slice(0,start)+replacement+src.slice(i+1);
  }
  throw new Error(`[v2635] cannot parse function ${name}`);
}
function elementRangeById(html,id,tag){
  const re=new RegExp(`<${tag}\\b[^>]*\\bid=["']${id}["'][^>]*>`,'i'),m=re.exec(html);if(!m)return null;
  const start=m.index,openEnd=start+m[0].length,token=new RegExp(`<\\/?${tag}\\b[^>]*>`,'ig');token.lastIndex=openEnd;let depth=1,x;
  while((x=token.exec(html))){if(x[0][1]==='/')depth--;else depth++;if(depth===0)return{start,end:token.lastIndex}}
  return null;
}
function replaceElementById(html,id,tag,replacement){const r=elementRangeById(html,id,tag);if(!r)throw new Error(`[v2635] ${id} element missing`);return html.slice(0,r.start)+replacement+html.slice(r.end)}
function insertAfterElementById(html,id,tag,addition){const r=elementRangeById(html,id,tag);if(!r)throw new Error(`[v2635] ${id} element missing`);return html.slice(0,r.end)+addition+html.slice(r.end)}

const APP_HELPERS=`
// ${MARKER}_HELPERS
const RANK_ORDER_KEY_V2635='rank-order-v2635';
const TEST_ORDER_KEY_V2635='test-order-v2635';
function readOrderV2635(k){try{const x=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function writeOrderV2635(k,x){try{localStorage.setItem(k,JSON.stringify(x.slice(0,80)))}catch{}}
function stableRowsByKeyV2635(rows,keyFn,storageKey){
  const old=readOrderV2635(storageKey),pos=new Map(old.map((k,i)=>[String(k),i])),keep=[],fresh=[];
  for(const x of rows||[])(pos.has(String(keyFn(x)))?keep:fresh).push(x);
  keep.sort((a,b)=>pos.get(String(keyFn(a)))-pos.get(String(keyFn(b))));
  const out=[...keep,...fresh];writeOrderV2635(storageKey,out.map(keyFn));return out;
}
function stableRankRowsV2635(rows){return stableRowsByKeyV2635(rows,x=>String(x?.symbol||'')+'|'+String(x?.direction||''),RANK_ORDER_KEY_V2635)}
function stableTestDataV2635(d){if(!d||!Array.isArray(d.rows))return d;return {...d,rows:stableRowsByKeyV2635(d.rows,x=>String(x?.key||x?.symbol||'')+'|'+String(x?.direction||''),TEST_ORDER_KEY_V2635)}}
let lastRankStructureSigV2635='';
`;

function patchApp(){
  const f=must('public','app.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER+'_APP'))return {changed:false,reason:'already'};

  // Keep existing app intact; add ordering helpers once.
  const anchor="const $=id=>document.getElementById(id);";
  if(!s.includes(anchor))throw new Error('[v2635] app root anchor missing');
  s=s.replace(anchor,anchor+APP_HELPERS);

  // A stale TradingView return state is never allowed to change pages.
  if(s.includes('function tvReturnApplyV268(')){
    s=replaceNamedFunction(s,'tvReturnApplyV268',`function tvReturnApplyV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000){tvReturnClearV268();return false}
  const wanted=String(d.page||''),active=document.querySelector('.pageTab.active')?.dataset?.page||'';
  if(wanted&&active!==wanted){tvReturnClearV268();return false}
  const sym=String(d.symbol||''),nodes=[...document.querySelectorAll('.rankCard,.testCard,.testMonitorCard,.actualTradeMonitorCard,.manual-card')].filter(x=>x.offsetParent!==null);
  let card=d.key?nodes.find(x=>typeof stableElementKeyV2617==='function'&&stableElementKeyV2617(x)===d.key)||null:null;
  if(!card&&sym)card=nodes.find(x=>String(x.querySelector?.('[data-tv-symbol]')?.dataset?.tvSymbol||'').toUpperCase()===sym)||null;
  const link=card?.querySelector?.('[data-tv-symbol]')||[...document.querySelectorAll('[data-tv-symbol]')].find(x=>String(x.dataset?.tvSymbol||'').toUpperCase()===sym&&x.offsetParent!==null)||null;
  if(card&&Number.isFinite(Number(d.cardTop))){const delta=card.getBoundingClientRect().top-Number(d.cardTop);if(Math.abs(delta)<window.innerHeight*1.5)window.scrollBy({top:delta,left:0,behavior:'auto'});return true}
  if(link&&Number.isFinite(Number(d.top))){const delta=link.getBoundingClientRect().top-Number(d.top);if(Math.abs(delta)<window.innerHeight*1.5)window.scrollBy({top:delta,left:0,behavior:'auto'});return true}
  return false
}`);
  }
  if(s.includes('function tvReturnRestoreV268(')){
    s=replaceNamedFunction(s,'tvReturnRestoreV268',`function tvReturnRestoreV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000){tvReturnClearV268();return}
  const wanted=String(d.page||''),active=document.querySelector('.pageTab.active')?.dataset?.page||'';
  if(wanted&&active!==wanted){tvReturnClearV268();return}
  if(window.__tvStableRestoreBusyV2635)return;window.__tvStableRestoreBusyV2635=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{try{tvReturnApplyV268()}finally{tvReturnClearV268();setTimeout(()=>window.__tvStableRestoreBusyV2635=false,120)}}))
}`);
  }

  // Background refresh must never move the viewport.
  if(s.includes('function restoreViewportAnchorV2617('))s=replaceNamedFunction(s,'restoreViewportAnchorV2617','function restoreViewportAnchorV2617(root,a){return}');

  // Disable horizontal swipe page switching completely. Tabs remain the only page switch.
  if(s.includes('function pageSwipeGo('))s=replaceNamedFunction(s,'pageSwipeGo','function pageSwipeGo(delta){return false}');

  // Observation keeps its current rows in place; new rows append.
  if(s.includes('function renderTestSignals(d){'))s=s.replace('function renderTestSignals(d){','function renderTestSignals(d){d=stableTestDataV2635(d);');

  // Ranking: preserve order and do not rebuild the whole DOM when the symbol set did not change.
  const rankNeedle="rankedIdeasState=d;rankedIdeasFetchedAt=Date.now();\n  const rows=d.rows||[];";
  if(s.includes(rankNeedle)){
    s=s.replace(rankNeedle,`rankedIdeasState=d;rankedIdeasFetchedAt=Date.now();
  const rows=stableRankRowsV2635(d.rows||[]),rankStructureSig=JSON.stringify(rows.map(x=>[x.symbol,x.direction]));
  if(rankStructureSig===lastRankStructureSigV2635&&$('recGrid')?.querySelector('.rankCard')){if($('ideaAge'))$('ideaAge').textContent=d.stale?'快照':ageText(d.generatedAt);return}
  lastRankStructureSigV2635=rankStructureSig;`);
  }

  // Page responsibilities: 建議 = manual page; 觀察 = observation + ranking.
  if(s.includes('function setPage(')){
    s=replaceNamedFunction(s,'setPage',`function setPage(name){
  const valid=['today','monitor','flow','ideas','test','performance'];if(!valid.includes(name))name='today';
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===\`page-\${name}\`));
  document.querySelectorAll('.pageTab').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  try{localStorage.setItem('position-alert-page-v78',name)}catch{}
  if(name==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}
  else if(name==='flow')void refreshMarketFlow(false);
  else if(name==='ideas'){try{window.ManualModeUI?.refresh?.(false)}catch{}}
  else if(name==='test'){void refreshTestSignals(false);void refreshRankedIdeas(false)}
  else if(name==='monitor')void refreshTestSignals(false);
  else if(name==='performance')void refreshPerformance(false)
}`);
  }

  s=`// ${MARKER}_APP\n${s}`;
  for(const token of ['pageSwipeGo(delta){return false','stableRankRowsV2635','stableTestDataV2635'])if(!s.includes(token))throw new Error(`[v2635] app invariant missing ${token}`);
  return {changed:saveJs(f,before,s)};
}

function patchManual(){
  const f=must('public','manual-mode-ui.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER+'_MANUAL'))return {changed:false,reason:'already'};

  const gradeRe=/const gradeText=[^\n]+;/;
  if(!gradeRe.test(s))throw new Error('[v2635] manual grade helper missing');
  const helpers=`const autoNotifyRowV2635=x=>['HIGH','NORMAL'].includes(String(x?.notificationTier||'').toUpperCase());
const manualEligibleV2635=x=>{const g=String(x?.grade||''),t=String(x?.notificationTier||'').toUpperCase(),edge=x?.institutionalEdge||{};return ['A','B'].includes(g)&&!autoNotifyRowV2635(x)&&t!=='BLOCKED'&&edge.hardBlock!==true};
const manualKeyV2635=x=>String(x?.id||[x?.symbol,x?.direction,x?.strategyId||x?.strategyLabel||''].join('|'));
const MANUAL_ORDER_KEY_V2635='manual-order-v2635';
let manualOrderV2635=(()=>{try{const x=JSON.parse(localStorage.getItem(MANUAL_ORDER_KEY_V2635)||'{}');return x&&typeof x==='object'?x:{A:[],B:[]}}catch{return{A:[],B:[]}}})();
const stableManualRowsV2635=(rows,g)=>{const old=Array.isArray(manualOrderV2635[g])?manualOrderV2635[g]:[],pos=new Map(old.map((k,i)=>[String(k),i])),keep=[],fresh=[];for(const x of rows)(pos.has(manualKeyV2635(x))?keep:fresh).push(x);keep.sort((a,b)=>pos.get(manualKeyV2635(a))-pos.get(manualKeyV2635(b)));fresh.sort((a,b)=>Number(b.executionScore||0)-Number(a.executionScore||0)||Number(b.calibratedWinRate||0)-Number(a.calibratedWinRate||0));const out=[...keep,...fresh];manualOrderV2635[g]=out.map(manualKeyV2635);try{localStorage.setItem(MANUAL_ORDER_KEY_V2635,JSON.stringify(manualOrderV2635))}catch{}return out};
let lastManualSigV2635='';
const manualSigV2635=(a,b)=>JSON.stringify([...a,...b].map(x=>[manualKeyV2635(x),x?.trade?.status||'',x?.entry?.price,x?.entry?.target,x?.entry?.target2,x?.entry?.stop,(x?.risks||[]).join('|')]));
const gradeText=x=>String(x?.grade||'')+'級';`;
  s=s.replace(gradeRe,helpers);
  s=s.replace(/gradeText\(x\.grade\)/g,'gradeText(x)');
  s=s.replaceAll('原 Shadow','樣本');
  s=s.replaceAll('ABC Shadow','同級實績');
  s=s.replaceAll('建議排名','順位');
  s=s.replaceAll('儲存並開始追蹤','建立倉位並追蹤');

  // No auto scroll after a manual refresh.
  if(s.includes('function restoreManualAnchor('))s=replaceNamedFunction(s,'restoreManualAnchor','function restoreManualAnchor(box,a){return}');

  // Replace only the manual page renderer; keep card(), form save, TP/SP, actual trade tracking untouched.
  if(!s.includes('function render('))throw new Error('[v2635] manual render missing');
  s=replaceNamedFunction(s,'render',`function render(){
  if(!mount()||!state.data)return;
  const box=document.getElementById('manualOpsPanel'),d=state.data,all=(d.rows||[]).filter(manualEligibleV2635);
  const aRows=stableManualRowsV2635(all.filter(x=>x.grade==='A'),'A'),bRows=stableManualRowsV2635(all.filter(x=>x.grade==='B'),'B');
  const sig=manualSigV2635(aRows,bRows);if(sig===lastManualSigV2635&&box.querySelector('.manual-groups-v2635'))return;lastManualSigV2635=sig;
  const group=(g,rows)=>\`<section class="manual-grade-group-v2635 grade-\${g.toLowerCase()}"><header><div><b>\${g}級</b><span>\${rows.length}</span></div><small>\${g==='A'?'優先看':'次優先'} · 適合手動觀察</small></header><div class="manual-list">\${rows.length?rows.map(card).join(''):\`<div class="manual-empty">目前沒有適合手動的 \${g} 級標的</div>\`}</div></section>\`;
  box.innerHTML=\`<div class="manual-groups-v2635">\${group('A',aRows)}\${group('B',bRows)}</div>\`;
}`);

  s=`// ${MARKER}_MANUAL\n${s}`;
  for(const token of ['manual-groups-v2635','manualEligibleV2635','建立倉位並追蹤'])if(!s.includes(token))throw new Error(`[v2635] manual invariant missing ${token}`);
  return {changed:saveJs(f,before,s)};
}

const CSS_OVERRIDE=String.raw`
/* ${MARKER}_CSS */
#manualOpsPanel{margin:0!important}
.manual-groups-v2635{display:grid;gap:14px}
.manual-grade-group-v2635{border:1px solid #34383a;border-radius:18px;background:rgba(22,25,27,.72);overflow:hidden}
.manual-grade-group-v2635>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;border-bottom:1px solid #303335;background:rgba(255,255,255,.025)}
.manual-grade-group-v2635>header>div{display:flex;align-items:center;gap:9px}.manual-grade-group-v2635>header b{font-size:18px;color:#e7c778}.manual-grade-group-v2635.grade-b>header b{color:#9fc4ed}
.manual-grade-group-v2635>header span{display:grid;place-items:center;min-width:26px;height:26px;padding:0 7px;border-radius:999px;border:1px solid #4b4f52;color:#d9d3c9;font-size:12px;font-weight:900;background:rgba(255,255,255,.035)}
.manual-grade-group-v2635>header small{color:#8e8a84;font-size:10px}.manual-grade-group-v2635 .manual-list{display:grid;gap:9px;padding:10px}
.manual-card{border-color:#34383a!important;background:rgba(30,34,37,.78)!important;box-shadow:none!important}
.manual-card summary{min-height:64px!important}.manual-card .manual-note{display:none!important}
.manual-card details[open] .manual-form[hidden]{display:block!important}.manual-card .manual-open-form{display:none!important}
.manual-card .manual-body{padding-top:3px!important}.manual-card .manual-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.manual-card .manual-levels{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.manual-form{margin-top:12px!important;border-top:1px solid #363a3c!important;padding-top:12px!important}
.manual-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.manual-form-grid input{height:44px!important;font-size:15px!important}
.manual-form-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}.manual-form-actions button{min-height:42px!important}
.rankMovedV2635{margin-top:18px;padding-top:16px;border-top:1px solid #2d3133}.rankMovedHeadV2635{display:flex;align-items:center;justify-content:space-between;margin:0 3px 9px}.rankMovedHeadV2635 b{font-size:16px;color:#d8c69f}.rankMovedHeadV2635 span{font-size:10px;color:#777}
.rankMovedV2635 .ideaNote{display:none!important}
#manualOpsPanel .manual-head,#manualOpsPanel .manual-grade-summary,#manualOpsPanel .manual-abc-shadow,#manualOpsPanel .manual-real-stats,#manualOpsPanel .manual-rank-history,#manualOpsPanel .manual-settings,#manualOpsPanel .manual-age{display:none!important}
html,body{scroll-behavior:auto!important}
#manualOpsPanel *,#recGrid *{animation:none!important}
@media(max-width:520px){.manual-grade-group-v2635>header{padding:12px}.manual-card .manual-metrics,.manual-card .manual-levels,.manual-form-grid{grid-template-columns:1fr 1fr!important}.rankMovedV2635{margin-top:16px}}
`;

function patchIndex(){
  const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let s=before;
  const cssSrc=must('advisory-buckets-v26271.css'),cssDst=path.join(ROOT,'public','advisory-buckets-v26271.css');fs.mkdirSync(path.dirname(cssDst),{recursive:true});fs.copyFileSync(cssSrc,cssDst);
  let css=fs.readFileSync(cssDst,'utf8');if(!css.includes(MARKER+'_CSS'))fs.writeFileSync(cssDst,css+'\n'+CSS_OVERRIDE,'utf8');

  // 建議 page = only manual A/B cards.
  s=replaceElementById(s,'page-ideas','section',`<section id="page-ideas" class="page"><div id="manualPageMountV2635"></div></section>`);

  // Ranking moves below observation list.
  const rankBlock=`
    <div id="rankMovedV2635" class="rankMovedV2635">
      <div class="rankMovedHeadV2635"><b>排名</b><span id="ideaAge">—</span></div>
      <div id="recGrid" class="recGrid"><div class="loadingBox">計算中…</div></div>
    </div>`;
  s=insertAfterElementById(s,'testGrid','div',rankBlock);

  s=s.replace(/\s*<link[^>]+href=["']\/advisory-buckets-v2627(?:1)?\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  if(!s.includes('</head>'))throw new Error('[v2635] index head missing');
  s=s.replace('</head>','<link rel="stylesheet" href="/advisory-buckets-v26271.css?v=2635">\n</head>');
  fs.writeFileSync(f,s,'utf8');
  return {changed:s!==before};
}

export function patchAdvisoryBucketsV26271(){
  const app=patchApp(),manual=patchManual(),index=patchIndex();
  console.log('[v2635] READY',app,manual,index);
  return {changed:Boolean(app.changed||manual.changed||index.changed),app,manual,index,marker:MARKER};
}
if(import.meta.url===`file://${process.argv[1]}`)patchAdvisoryBucketsV26271();
