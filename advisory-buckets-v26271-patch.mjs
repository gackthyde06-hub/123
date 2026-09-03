import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const MARKER='MANUAL_WORKSPACE_V2637_20260904';

function must(...p){const f=path.join(ROOT,...p);if(!fs.existsSync(f))throw new Error(`[v2637] missing ${p.join('/')}`);return f}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0||r.error)throw new Error(`[v2637] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`)}
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
  throw new Error(`[v2637] cannot parse function ${name}`);
}
function elementRangeById(html,id,tag){
  const re=new RegExp(`<${tag}\\b[^>]*\\bid=["']${id}["'][^>]*>`,'i'),m=re.exec(html);if(!m)return null;
  const start=m.index,openEnd=start+m[0].length,token=new RegExp(`<\\/?${tag}\\b[^>]*>`,'ig');token.lastIndex=openEnd;let depth=1,x;
  while((x=token.exec(html))){if(x[0][1]==='/')depth--;else depth++;if(depth===0)return{start,end:token.lastIndex}}
  return null;
}
function replaceElementById(html,id,tag,replacement){const r=elementRangeById(html,id,tag);if(!r)throw new Error(`[v2637] ${id} element missing`);return html.slice(0,r.start)+replacement+html.slice(r.end)}
function insertAfterElementById(html,id,tag,addition){const r=elementRangeById(html,id,tag);if(!r)throw new Error(`[v2637] ${id} element missing`);return html.slice(0,r.end)+addition+html.slice(r.end)}

const APP_HELPERS=`
// ${MARKER}_APP_HELPERS
const RANK_ORDER_KEY_V2637='rank-order-v2637';
const TEST_ORDER_KEY_V2637='test-order-v2637';
function readOrderV2637(k){try{const x=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
function writeOrderV2637(k,x){try{localStorage.setItem(k,JSON.stringify(x.slice(0,120)))}catch{}}
function stableRowsV2637(rows,keyFn,k){
  const old=readOrderV2637(k),pos=new Map(old.map((x,i)=>[String(x),i])),keep=[],fresh=[];
  for(const x of rows||[])(pos.has(String(keyFn(x)))?keep:fresh).push(x);
  keep.sort((a,b)=>pos.get(String(keyFn(a)))-pos.get(String(keyFn(b))));
  const out=[...keep,...fresh];writeOrderV2637(k,out.map(keyFn));return out;
}
const stableRankRowsV2637=rows=>stableRowsV2637(rows,x=>String(x?.symbol||'')+'|'+String(x?.direction||''),RANK_ORDER_KEY_V2637);
const stableTestDataV2637=d=>!d||!Array.isArray(d.rows)?d:{...d,rows:stableRowsV2637(d.rows,x=>String(x?.key||x?.symbol||'')+'|'+String(x?.direction||''),TEST_ORDER_KEY_V2637)};
let lastRankStructureSigV2637='';
`;

function patchApp(){
  const f=must('public','app.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER+'_APP'))return {changed:false,reason:'already'};
  const rootAnchor="const $=id=>document.getElementById(id);";
  if(!s.includes(rootAnchor))throw new Error('[v2637] app root anchor missing');
  s=s.replace(rootAnchor,rootAnchor+APP_HELPERS);

  if(s.includes('function restoreViewportAnchorV2617('))s=replaceNamedFunction(s,'restoreViewportAnchorV2617','function restoreViewportAnchorV2617(root,a){return}');
  if(s.includes('function pageSwipeGo('))s=replaceNamedFunction(s,'pageSwipeGo','function pageSwipeGo(delta){return false}');

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
  if(window.__tvRestoreBusyV2637)return;window.__tvRestoreBusyV2637=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{try{tvReturnApplyV268()}finally{tvReturnClearV268();setTimeout(()=>window.__tvRestoreBusyV2637=false,120)}}))
}`);
  }

  if(s.includes('function renderTestSignals(d){'))s=s.replace('function renderTestSignals(d){','function renderTestSignals(d){d=stableTestDataV2637(d);');

  const rankNeedle="rankedIdeasState=d;rankedIdeasFetchedAt=Date.now();\n  const rows=d.rows||[];";
  if(s.includes(rankNeedle)){
    s=s.replace(rankNeedle,`rankedIdeasState=d;rankedIdeasFetchedAt=Date.now();
  const rows=stableRankRowsV2637(d.rows||[]),rankStructureSig=JSON.stringify(rows.map(x=>[x.symbol,x.direction]));
  if(rankStructureSig===lastRankStructureSigV2637&&$('recGrid')?.querySelector('.rankCard')){if($('ideaAge'))$('ideaAge').textContent=d.stale?'快照':ageText(d.generatedAt);return}
  lastRankStructureSigV2637=rankStructureSig;`);
  }

  if(s.includes('function setPage(')){
    s=replaceNamedFunction(s,'setPage',`function setPage(name){
  const valid=['today','monitor','flow','ideas','test','performance'];if(!valid.includes(name))name='today';
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===\`page-\${name}\`));
  document.querySelectorAll('.pageTab').forEach(x=>x.classList.toggle('active',x.dataset.page===name));
  try{localStorage.setItem('position-alert-page-v78',name)}catch{}
  if(name==='today'){void refreshMarketFlow(false);void refreshDailyBrief(false)}
  else if(name==='flow')void refreshMarketFlow(false);
  else if(name==='ideas'){try{window.ManualModeUI?.refresh?.(false)}catch{}}
  else if(name==='test'){void refreshTestSignals(false);void refreshRankedIdeas(false);try{window.ManualModeUI?.renderDismissed?.()}catch{}}
  else if(name==='monitor')void refreshTestSignals(false);
  else if(name==='performance')void refreshPerformance(false)
}`);
  }

  s=`// ${MARKER}_APP\n${s}`;
  for(const t of ['pageSwipeGo(delta){return false','stableRankRowsV2637','stableTestDataV2637'])if(!s.includes(t))throw new Error(`[v2637] app invariant missing ${t}`);
  return {changed:saveJs(f,before,s)};
}

const MANUAL_HELPERS=`
// ${MARKER}_MANUAL_HELPERS
const DISMISS_KEY_V2637='manual-dismissed-v2637';
const FEEDBACK_KEY_V2637='manual-decision-feedback-v2637';
const ORDER_KEY_V2637='manual-order-v2637';
const manualKeyV2637=x=>String(x?.id||[x?.symbol,x?.direction,x?.strategyId||x?.strategyLabel||''].join('|'));
function readDismissedV2637(){try{const x=JSON.parse(localStorage.getItem(DISMISS_KEY_V2637)||'{}');return x&&typeof x==='object'?x:{}}catch{return{}}}
function writeDismissedV2637(x){try{localStorage.setItem(DISMISS_KEY_V2637,JSON.stringify(x))}catch{}}
function recordDecisionV2637(x,action){try{const old=JSON.parse(localStorage.getItem(FEEDBACK_KEY_V2637)||'[]'),a=Array.isArray(old)?old:[];a.unshift({at:Date.now(),action,id:manualKeyV2637(x),symbol:x?.symbol||'',direction:x?.direction||'',grade:x?.grade||'',rank:x?.rank??null,score:x?.executionScore??null,winRate:x?.calibratedWinRate??null,signalKey:x?.signalKey||null});localStorage.setItem(FEEDBACK_KEY_V2637,JSON.stringify(a.slice(0,240)))}catch{}}
function isDismissedV2637(x){return !!readDismissedV2637()[manualKeyV2637(x)]}
function dismissManualV2637(id){const x=rowById(id);if(!x)return;const all=readDismissedV2637();all[manualKeyV2637(x)]={at:Date.now(),symbol:x.symbol,direction:x.direction,grade:x.grade,id:manualKeyV2637(x)};writeDismissedV2637(all);recordDecisionV2637(x,'DISMISS');state.openCards.delete(x.id);state.openForms.delete(x.id);state.drafts.delete(x.id);saveUiState();lastManualSigV2637='';render();renderDismissedV2637()}
function restoreManualV2637(id){const all=readDismissedV2637(),x=(state.data?.rows||[]).find(r=>manualKeyV2637(r)===id||String(r.id)===String(id));delete all[id];if(x)delete all[manualKeyV2637(x)];writeDismissedV2637(all);if(x)recordDecisionV2637(x,'RESTORE');lastManualSigV2637='';render();renderDismissedV2637()}
function readManualOrderV2637(){try{const x=JSON.parse(localStorage.getItem(ORDER_KEY_V2637)||'{}');return x&&typeof x==='object'?x:{A:[],B:[]}}catch{return{A:[],B:[]}}}
function stableManualRowsV2637(rows,g){const orders=readManualOrderV2637(),old=Array.isArray(orders[g])?orders[g]:[],pos=new Map(old.map((k,i)=>[String(k),i])),keep=[],fresh=[];for(const x of rows)(pos.has(manualKeyV2637(x))?keep:fresh).push(x);keep.sort((a,b)=>pos.get(manualKeyV2637(a))-pos.get(manualKeyV2637(b)));fresh.sort((a,b)=>Number(b.executionScore||0)-Number(a.executionScore||0)||Number(b.calibratedWinRate||0)-Number(a.calibratedWinRate||0));const out=[...keep,...fresh];orders[g]=out.map(manualKeyV2637);try{localStorage.setItem(ORDER_KEY_V2637,JSON.stringify(orders))}catch{}return out}
function manualEligibleV2637(x){const g=String(x?.grade||''),tier=String(x?.notificationTier||'').toUpperCase(),edge=x?.institutionalEdge||{},trade=x?.trade;return ['A','B'].includes(g)&&tier!=='BLOCKED'&&edge.hardBlock!==true&&trade?.status!=='ACTIVE'&&!isDismissedV2637(x)}
let lastManualSigV2637='';
function renderDismissedV2637(){const page=document.getElementById('page-test');if(!page)return;let box=document.getElementById('manualDismissedV2637');if(!box){box=document.createElement('details');box.id='manualDismissedV2637';box.className='manual-dismissed-v2637';const rank=document.getElementById('rankMovedV2637'),grid=document.getElementById('testGrid');if(rank)rank.insertAdjacentElement('beforebegin',box);else if(grid)grid.insertAdjacentElement('afterend',box);else page.appendChild(box)}const dis=readDismissedV2637(),rows=(state.data?.rows||[]).filter(x=>dis[manualKeyV2637(x)]).sort((a,b)=>(dis[manualKeyV2637(b)]?.at||0)-(dis[manualKeyV2637(a)]?.at||0));box.hidden=!rows.length;box.innerHTML=\`<summary><b>手動略過</b><span>\${rows.length}</span><small>只從手動清單移除，學習與觀察資料都保留</small></summary><div class="manual-dismissed-list-v2637">\${rows.map(x=>{const d=dis[manualKeyV2637(x)]||{};return \`<div class="manual-dismissed-row-v2637"><div><b>\${esc(x.symbol)}</b><span class="\${x.direction==='SHORT'?'short':'long'}">\${dirText(x.direction)}</span><small>\${esc(x.grade)}級 · \${age(Date.now()-Number(d.at||Date.now()))}</small></div><button type="button" data-restore-manual="\${esc(manualKeyV2637(x))}">恢復</button></div>\`}).join('')}</div>\`}
`;

function patchManual(){
  const f=must('public','manual-mode-ui.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER+'_MANUAL'))return {changed:false,reason:'already'};
  const insertAt=s.indexOf('const dirText=');if(insertAt<0)throw new Error('[v2637] manual helper anchor missing');
  s=s.slice(0,insertAt)+MANUAL_HELPERS+s.slice(insertAt);
  s=s.replaceAll('影子 A/B 判斷','');s=s.replaceAll('影子A/B判斷','');s=s.replaceAll('MANUAL OPS · SHADOW LEARNING','');s=s.replaceAll('原 Shadow','歷史樣本');s=s.replaceAll('ABC Shadow','同級樣本');
  if(s.includes('function restoreManualAnchor('))s=replaceNamedFunction(s,'restoreManualAnchor','function restoreManualAnchor(box,a){return}');

  if(s.includes('function mount('))s=replaceNamedFunction(s,'mount',`function mount(){if(document.getElementById('manualOpsPanel'))return true;const page=document.getElementById('page-ideas');if(!page)return false;const box=document.createElement('section');box.id='manualOpsPanel';box.className='manual-ops';box.innerHTML='<div class="manual-empty">載入中…</div>';const target=document.getElementById('manualPageMountV2637');if(target)target.appendChild(box);else page.prepend(box);bind(box);return true}`);

  if(!s.includes('function card('))throw new Error('[v2637] manual card missing');
  s=replaceNamedFunction(s,'card',`function card(x){
  const e=x.entry||{},st=x.structure||{},sh=x.shadow||{},ab=x.abcLearning||{},d=defaults(),entry=num(e.price),stop=num(e.stop),tp1=num(e.target),tp2=num(e.target2),trade=x.trade,id=x.id,open=state.openCards.has(id);
  const sampleText=ab.sample?\`\${ab.sample}筆 · \${pct(ab.hitRate)} · PF \${num(ab.profitFactor)==null?'—':Number(ab.profitFactor).toFixed(2)}\`:'累積中';
  return \`<article class="manual-card manual-card-v2637 grade-\${String(x.grade||'B').toLowerCase()}" data-id="\${esc(id)}"><details \${open?'open':''}><summary><div class="manual-grade">\${esc(x.grade)}</div><div class="manual-main"><div><b>\${esc(x.symbol)}</b><span class="\${x.direction==='SHORT'?'short':'long'}">\${dirText(x.direction)}</span></div><small>\${esc(st.label||'等待結構')} · \${esc(x.freshness)} \${age(x.freshnessAgeMs)}</small></div><div class="manual-score"><b>\${x.executionScore}</b><span>執行分</span></div><button type="button" class="manual-x-v2637" data-dismiss-manual="\${esc(id)}" aria-label="移出手動清單">×</button><i class="manual-chevron-v2637">⌄</i></summary><div class="manual-body"><div class="manual-metrics"><div><span>順位</span><b>#\${x.rank} · \${Number(x.rankScore||0).toFixed(0)}</b></div><div><span>校準勝率</span><b>\${pct(x.calibratedWinRate)}</b></div><div><span>結構</span><b>\${esc(st.label||'—')} \${num(st.health)==null?'':Math.round(st.health)}</b><small>\${num(st.learningAdjustment)>0?'+':''}\${num(st.learningAdjustment)??0} 學習調整</small></div><div><span>歷史樣本</span><b>\${sh.sample||0}筆 · \${pct(sh.hitRate)}</b><small>PF \${num(sh.profitFactor)==null?'—':Number(sh.profitFactor).toFixed(2)}</small></div><div><span>同級樣本</span><b>\${sampleText}</b><small class="\${Number(ab.adjustment||0)>0?'learn-plus':Number(ab.adjustment||0)<0?'learn-minus':''}">調整 \${Number(ab.adjustment||0)>0?'+':''}\${Number(ab.adjustment||0)}</small></div><div><span>TP2 RR</span><b>\${num(e.rr)==null?'—':Number(e.rr).toFixed(2)}</b></div><div><span>資料品質</span><b>\${Math.round(x.dataHealth?.coverage||0)} / \${Math.round(x.dataHealth?.confidence||0)}</b><small>覆蓋 / 可信</small></div></div><div class="manual-levels"><div><span>參考成本</span><b>\${px(e.price)}</b></div><div><span>進場區</span><b>\${num(e.zoneLow)!=null&&num(e.zoneHigh)!=null?\`\${px(e.zoneLow)}～\${px(e.zoneHigh)}\`:'—'}</b></div><div><span>TP1 / TP2</span><b>\${px(e.target)} / \${px(e.target2)}</b></div><div><span>SP1</span><b>\${px(e.stop)}</b></div></div><div class="manual-reasons"><div><b>支持</b>\${(x.reasons||[]).map(v=>\`<span>\${esc(v)}</span>\`).join('')}</div><div><b>風險 / 還缺什麼</b>\${(x.risks||[]).length?(x.risks||[]).map(v=>\`<span class="risk">\${esc(v)}</span>\`).join(''):'<span>目前無主要硬阻擋</span>'}</div></div><div class="manual-form manual-form-v2637"><div class="manual-form-grid"><label><span>成本</span><input data-f="entry" inputmode="decimal" value="\${esc(draftValue(id,'entry',entry??''))}"></label><label><span>TP1</span><input data-f="tp1" inputmode="decimal" value="\${esc(draftValue(id,'tp1',tp1??''))}"></label><label><span>TP2</span><input data-f="tp2" inputmode="decimal" value="\${esc(draftValue(id,'tp2',tp2??''))}"></label><label><span>SP1</span><input data-f="sp1" inputmode="decimal" value="\${esc(draftValue(id,'sp1',stop??''))}"></label><label><span>SP2</span><input data-f="sp2" inputmode="decimal" value="\${esc(draftValue(id,'sp2',''))}"></label><label><span>保證金 U</span><input data-f="margin" inputmode="decimal" value="\${esc(draftValue(id,'margin',d.margin))}"></label><label><span>槓桿</span><input data-f="leverage" inputmode="numeric" value="\${esc(draftValue(id,'leverage',d.leverage))}"></label><label><span>數量（可空）</span><input data-f="quantity" inputmode="decimal" value="\${esc(draftValue(id,'quantity',''))}"></label></div><div class="manual-form-actions"><button type="button" data-fill-current>成本用現價 \${px(e.currentPrice)}</button><button type="button" class="save" data-save-trade>建立建倉追蹤</button></div><div class="manual-msg" data-msg></div></div></div></details></article>\`
}`);

  if(!s.includes('function render('))throw new Error('[v2637] manual render missing');
  s=replaceNamedFunction(s,'render',`function render(){
  if(!mount()||!state.data)return;const box=document.getElementById('manualOpsPanel'),d=state.data,all=(d.rows||[]).filter(manualEligibleV2637),aRows=stableManualRowsV2637(all.filter(x=>x.grade==='A'),'A'),bRows=stableManualRowsV2637(all.filter(x=>x.grade==='B'),'B');
  const sig=JSON.stringify([...aRows,...bRows].map(x=>[manualKeyV2637(x),x?.trade?.status||'',x?.entry?.price,x?.entry?.target,x?.entry?.target2,x?.entry?.stop,(x?.risks||[]).join('|')]));if(sig===lastManualSigV2637&&box.querySelector('.manual-workspace-v2637')){renderDismissedV2637();return}lastManualSigV2637=sig;
  const group=(g,rows)=>\`<details class="manual-grade-group-v2637 grade-\${g.toLowerCase()}" open><summary><div><b>\${g}級</b><span>\${rows.length}</span></div><small>\${g==='A'?'優先':'次優先'} · 手動標的</small><i>⌄</i></summary><div class="manual-list">\${rows.length?rows.map(card).join(''):\`<div class="manual-empty">目前沒有 \${g} 級手動標的</div>\`}</div></details>\`;
  box.innerHTML=\`<div class="manual-page-title-v2637"><b>手動標的</b><span>A / B 篩選後，可直接展開建倉</span></div><div class="manual-workspace-v2637">\${group('A',aRows)}\${group('B',bRows)}</div>\`;renderDismissedV2637()
}`);

  if(!s.includes('function bind('))throw new Error('[v2637] manual bind missing');
  s=replaceNamedFunction(s,'bind',`function bind(box){
  box.addEventListener('click',e=>{const dismiss=e.target.closest?.('[data-dismiss-manual]');if(dismiss){e.preventDefault();e.stopPropagation();dismissManualV2637(dismiss.dataset.dismissManual);return}const c=e.target.closest?.('.manual-card');if(!c)return;if(e.target.closest('[data-fill-current]')){e.preventDefault();const x=rowById(c.dataset.id),i=c.querySelector('[data-f="entry"]');if(i&&num(x?.entry?.currentPrice)!=null){i.value=String(x.entry.currentPrice);saveDraftField(c,i)}return}if(e.target.closest('[data-save-trade]')){e.preventDefault();void saveTrade(c);return}});
  box.addEventListener('toggle',e=>{const d=e.target;if(!(d instanceof HTMLDetailsElement))return;const card=d.closest('.manual-card');if(card){const id=card.dataset.id;if(d.open)state.openCards.add(id);else state.openCards.delete(id);saveUiState()}},{capture:true});
  box.addEventListener('input',e=>{const i=e.target.closest?.('[data-f]'),card=i?.closest?.('.manual-card');if(i&&card)saveDraftField(card,i)})
}`);

  if(s.includes('function init('))s=replaceNamedFunction(s,'init',`function init(){loadUiState();mount();void refresh(false);void loadPref();state.timer=setInterval(()=>{const p=document.querySelector('.pageTab.active')?.dataset?.page;if((p==='ideas'||p==='test')&&document.visibilityState==='visible')void refresh(false)},20_000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh(false)});window.addEventListener('pageshow',()=>void refresh(false));document.addEventListener('click',e=>{const b=e.target.closest?.('[data-restore-manual]');if(!b)return;e.preventDefault();restoreManualV2637(b.dataset.restoreManual)})}`);
  s=s.replace(/window\.ManualModeUI=\{version:VERSION,refresh\};/,'window.ManualModeUI={version:VERSION,refresh,renderDismissed:renderDismissedV2637};');

  s=`// ${MARKER}_MANUAL\n${s}`;
  for(const t of ['manual-x-v2637','manual-dismissed-v2637','建立建倉追蹤','renderDismissedV2637'])if(!s.includes(t))throw new Error(`[v2637] manual invariant missing ${t}`);
  if(s.includes('影子 A/B 判斷')||s.includes('影子A/B判斷'))throw new Error('[v2637] unwanted A/B heading survived');
  return {changed:saveJs(f,before,s)};
}

const CSS_OVERRIDE=String.raw`
/* ${MARKER}_CSS */
html,body{scroll-behavior:auto!important}
#manualOpsPanel *,#recGrid *,#manualDismissedV2637 *{animation:none!important}
#manualOpsPanel{margin:0!important}.manual-page-title-v2637{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:4px 2px 10px}.manual-page-title-v2637 b{font-size:19px;color:#ead0a0}.manual-page-title-v2637 span{font-size:10px;color:#817b72}
.manual-workspace-v2637{display:grid;gap:13px}.manual-grade-group-v2637{border:1px solid #3c4145;border-radius:17px;background:linear-gradient(155deg,#171c21,#121619);overflow:hidden}.manual-grade-group-v2637>summary{list-style:none;display:grid;grid-template-columns:1fr auto 18px;align-items:center;gap:9px;padding:13px 14px;cursor:pointer;background:linear-gradient(90deg,rgba(210,167,90,.08),rgba(89,118,149,.055));border-bottom:1px solid #30353a}.manual-grade-group-v2637>summary::-webkit-details-marker{display:none}.manual-grade-group-v2637>summary>div{display:flex;align-items:center;gap:9px}.manual-grade-group-v2637>summary b{font-size:18px;color:#e9c77f}.manual-grade-group-v2637.grade-b>summary b{color:#9fc0e6}.manual-grade-group-v2637>summary span{display:grid;place-items:center;min-width:27px;height:27px;padding:0 7px;border:1px solid #50575d;border-radius:999px;background:#232a30;color:#e5ded3;font-size:12px;font-weight:900}.manual-grade-group-v2637>summary small{color:#89847c;font-size:10px}.manual-grade-group-v2637>summary>i{font-style:normal;color:#958a78}.manual-grade-group-v2637:not([open])>summary{border-bottom:0}.manual-grade-group-v2637:not([open])>summary>i{transform:rotate(-90deg)}.manual-grade-group-v2637 .manual-list{display:grid;gap:9px;padding:10px}
.manual-card-v2637{position:relative!important;border:1px solid #343b41!important;border-radius:14px!important;background:linear-gradient(150deg,#20272d,#191f24)!important;box-shadow:0 8px 20px rgba(0,0,0,.15)!important;overflow:hidden}.manual-card-v2637 details>summary{position:relative;grid-template-columns:28px minmax(0,1fr) auto 30px 14px!important;padding:12px 11px!important;min-height:67px!important}.manual-card-v2637 .manual-grade{width:28px;height:28px;display:grid;place-items:center;border-radius:8px;background:#47391f;color:#f0cc80;font-size:13px!important}.manual-card-v2637.grade-b .manual-grade{background:#26384b;color:#a8caed}.manual-card-v2637 .manual-main b{font-size:17px!important}.manual-card-v2637 .manual-main small{font-size:9.5px!important;color:#817d77!important}.manual-card-v2637 .manual-score b{font-size:16px!important}.manual-card-v2637 .manual-score span{font-size:8px!important}.manual-x-v2637{width:29px;height:29px;display:grid;place-items:center;border:1px solid #4a5054;border-radius:9px;background:#262c31;color:#a9a49b;font-size:19px;line-height:1;cursor:pointer}.manual-x-v2637:hover{border-color:#7f5a4d;color:#ef9c87;background:#32231f}.manual-chevron-v2637{font-style:normal;color:#968c80}
.manual-card-v2637 .manual-body{padding:2px 11px 12px!important}.manual-card-v2637 .manual-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.manual-card-v2637 .manual-levels{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}.manual-card-v2637 .manual-metrics>div,.manual-card-v2637 .manual-levels>div{background:#1c2328!important;border-color:#343b40!important}.manual-card-v2637 .manual-reasons>div{background:#1b2227!important;border-color:#343a3f!important}.manual-form-v2637{display:block!important;margin-top:12px!important;padding-top:12px!important;border-top:1px solid #394047!important}.manual-form-v2637 .manual-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important}.manual-form-v2637 input{height:44px!important;background:#151b20!important;border-color:#3a4248!important;font-size:15px!important}.manual-form-v2637 input:focus{border-color:#c49b57!important}.manual-form-v2637 .manual-form-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}.manual-form-v2637 .manual-form-actions button{min-height:43px!important}.manual-form-v2637 .manual-form-actions .save{background:linear-gradient(135deg,#7a5b28,#b98e45)!important;color:#fff2d6!important;border-color:#c29a54!important}
#manualOpsPanel .manual-head,#manualOpsPanel .manual-grade-summary,#manualOpsPanel .manual-abc-shadow,#manualOpsPanel .manual-real-stats,#manualOpsPanel .manual-rank-history,#manualOpsPanel .manual-settings,#manualOpsPanel .manual-age,#manualOpsPanel .manual-note,#manualOpsPanel .manual-open-form{display:none!important}
.rankMovedV2637{margin-top:18px;padding-top:16px;border-top:1px solid #30353a}.rankMovedHeadV2637{display:flex;align-items:center;justify-content:space-between;margin:0 3px 9px}.rankMovedHeadV2637 b{font-size:16px;color:#d8c39b}.rankMovedHeadV2637 span{font-size:10px;color:#777}
.manual-dismissed-v2637{margin-top:13px;border:1px solid #343b40;border-radius:13px;background:#171d21;overflow:hidden}.manual-dismissed-v2637[hidden]{display:none!important}.manual-dismissed-v2637>summary{list-style:none;display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:8px;padding:11px 12px;cursor:pointer}.manual-dismissed-v2637>summary::-webkit-details-marker{display:none}.manual-dismissed-v2637>summary b{font-size:12px;color:#c7b48e}.manual-dismissed-v2637>summary>span{display:grid;place-items:center;min-width:22px;height:22px;border-radius:999px;background:#252d33;color:#cfc9bf;font-size:10px}.manual-dismissed-v2637>summary small{text-align:right;color:#77736c;font-size:9px}.manual-dismissed-list-v2637{border-top:1px solid #30363a}.manual-dismissed-row-v2637{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 11px;border-top:1px solid #282e32}.manual-dismissed-row-v2637:first-child{border-top:0}.manual-dismissed-row-v2637>div{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.manual-dismissed-row-v2637 b{font-size:13px}.manual-dismissed-row-v2637 span{font-size:9px}.manual-dismissed-row-v2637 small{width:100%;color:#77736c;font-size:8.5px}.manual-dismissed-row-v2637 button{height:32px;padding:0 10px;border:1px solid #4b545a;border-radius:8px;background:#222a30;color:#bdb7ad;font-size:9px}
@media(max-width:520px){.manual-page-title-v2637{display:block}.manual-page-title-v2637 span{display:block;margin-top:3px}.manual-card-v2637 details>summary{grid-template-columns:28px minmax(0,1fr) 28px 13px!important}.manual-card-v2637 .manual-score{display:none!important}.manual-form-v2637 .manual-form-grid{grid-template-columns:1fr 1fr!important}.manual-dismissed-v2637>summary{grid-template-columns:auto auto}.manual-dismissed-v2637>summary small{grid-column:1/-1;text-align:left}}
`;

function patchIndex(){
  const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let s=before;
  const cssSrc=must('advisory-buckets-v26271.css'),cssDst=path.join(ROOT,'public','advisory-buckets-v26271.css');fs.mkdirSync(path.dirname(cssDst),{recursive:true});fs.copyFileSync(cssSrc,cssDst);let css=fs.readFileSync(cssDst,'utf8');if(!css.includes(MARKER+'_CSS'))fs.writeFileSync(cssDst,css+'\n'+CSS_OVERRIDE,'utf8');
  s=replaceElementById(s,'page-ideas','section',`<section id="page-ideas" class="page"><div id="manualPageMountV2637"></div></section>`);
  const rankBlock=`<div id="rankMovedV2637" class="rankMovedV2637"><div class="rankMovedHeadV2637"><b>建議排名</b><span id="ideaAge">—</span></div><div id="recGrid" class="recGrid"><div class="loadingBox">計算中…</div></div></div>`;
  s=insertAfterElementById(s,'testGrid','div',rankBlock);
  s=s.replace(/\s*<link[^>]+href=["']\/advisory-buckets-v2627(?:1)?\.css(?:\?[^"']*)?["'][^>]*>/gi,'');if(!s.includes('</head>'))throw new Error('[v2637] index head missing');s=s.replace('</head>','<link rel="stylesheet" href="/advisory-buckets-v26271.css?v=2637">\n</head>');fs.writeFileSync(f,s,'utf8');return {changed:s!==before}
}

export function patchAdvisoryBucketsV26271(){const app=patchApp(),manual=patchManual(),index=patchIndex();console.log('[v2637] READY',app,manual,index);return {changed:Boolean(app.changed||manual.changed||index.changed),app,manual,index,marker:MARKER}}
if(import.meta.url===`file://${process.argv[1]}`)patchAdvisoryBucketsV26271();
