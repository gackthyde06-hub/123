(()=>{
'use strict';
const VERSION='2.6.39';
const DISMISS_KEY='manual-workspace-dismiss-v2638';
const ORDER_KEY='manual-workspace-order-v2638';
const DRAFT_KEY='manual-workspace-draft-v2638';
const OPEN_KEY='manual-workspace-open-v2638';
const NOTICE_HIDE_KEY='manual-notice-hidden-v2639';
let data=null,perf=null,busy=false,perfBusy=false,lastSig='',lastNoticeSig='',timer=null,touchStart=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const px=v=>{const x=n(v);if(x==null)return'—';if(x>=1000)return x.toLocaleString('en-US',{maximumFractionDigits:2});if(x>=1)return x.toLocaleString('en-US',{maximumFractionDigits:6});return x.toLocaleString('en-US',{maximumFractionDigits:8})};
const pct=v=>n(v)==null?'—':`${Number(v).toFixed(1)}%`;
const age=ms=>{const x=Math.max(0,Number(ms)||0),s=Math.round(x/1000);return s<60?`${s}秒前`:s<3600?`${Math.floor(s/60)}分前`:`${Math.floor(s/3600)}小時前`};
const dirText=d=>String(d).toUpperCase()==='SHORT'?'做空':'做多';
const tvUrl=s=>`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`BINANCE:${String(s||'').toUpperCase()}.P`)}`;
function readObj(k,f={}){try{const x=JSON.parse(localStorage.getItem(k)||'null');return x&&typeof x==='object'&&!Array.isArray(x)?x:f}catch{return f}}
function writeObj(k,x){try{localStorage.setItem(k,JSON.stringify(x))}catch{}}
function keyOf(x){return String(x?.id||[x?.symbol,x?.direction,x?.strategyId||x?.strategyLabel||''].join('|'))}
function dismissed(){return readObj(DISMISS_KEY,{})}
function drafts(){return readObj(DRAFT_KEY,{})}
function opens(){return readObj(OPEN_KEY,{})}
function draftVal(id,k,f=''){const d=drafts()[id]||{};return Object.prototype.hasOwnProperty.call(d,k)?d[k]:(f??'')}
function saveDraft(id,k,v){const d=drafts();d[id]={...(d[id]||{}),[k]:v};writeObj(DRAFT_KEY,d)}
function stableRows(rows,g){
  const all=readObj(ORDER_KEY,{A:[],B:[]}),old=Array.isArray(all[g])?all[g]:[],pos=new Map(old.map((k,i)=>[String(k),i])),keep=[],fresh=[];
  for(const x of rows)(pos.has(keyOf(x))?keep:fresh).push(x);
  keep.sort((a,b)=>pos.get(keyOf(a))-pos.get(keyOf(b)));
  fresh.sort((a,b)=>Number(b.executionScore||0)-Number(a.executionScore||0)||Number(b.calibratedWinRate||0)-Number(a.calibratedWinRate||0));
  const out=[...keep,...fresh];all[g]=out.map(keyOf);writeObj(ORDER_KEY,all);return out
}
async function json(url,opt={}){
  const c=new AbortController(),t=setTimeout(()=>c.abort('manual-opportunities-timeout'),15000);
  try{const r=await fetch(url,{cache:'no-store',signal:c.signal,...opt}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);return d}catch(e){if(e?.name==='AbortError'||/aborted|timeout/i.test(String(e?.message||e)))throw new Error('載入逾時，系統會自動重試');throw e}finally{clearTimeout(t)}
}
function currentPage(){return document.querySelector('.pageTab.active')?.dataset?.page||''}

function hiddenNotices(){return readObj(NOTICE_HIDE_KEY,{})}
function hideNotice(id){const h=hiddenNotices();h[String(id)]=Date.now();writeObj(NOTICE_HIDE_KEY,h);lastNoticeSig='';renderNotices()}
function resetHiddenNotices(){writeObj(NOTICE_HIDE_KEY,{});lastNoticeSig='';renderNotices()}
function noticeTime(x){const raw=x?.notificationAt||x?.resultAt||x?.createdAt||'';const t=new Date(raw).getTime();return Number.isFinite(t)?age(Date.now()-t):'—'}
function noticeOutcome(x){if(x?.status==='ACTIVE')return'追蹤中';if(x?.result==='WIN')return'TP先到';if(x?.result==='LOSS')return'SP先到';if(x?.result==='TIMEOUT')return'時間到';return x?.result||'已結束'}
function noticeRow(x,history=false){
  const id=String(x?.id||''),dir=x?.direction==='SHORT'?'做空':'做多',cls=x?.direction==='SHORT'?'short':'long',tier=String(x?.tier||x?.notificationTier||'').toUpperCase();
  return `<article class="mn-row ${history?'history':'auto'}">
    <div class="mn-main"><div><b>${esc(x.symbol||'—')}</b><em class="${cls}">${dir}</em>${tier?`<i>${esc(tier)}</i>`:''}</div><small>${noticeTime(x)} · ${history?noticeOutcome(x):'自動通知後持續追蹤'}</small></div>
    <div class="mn-level"><span>成本</span><b>${px(x.entryPrice)}</b><small>SP ${px(x.stop)} · TP ${px(x.target)}</small></div>
    ${history?`<div class="mn-result ${x?.result==='WIN'?'win':x?.result==='LOSS'?'loss':''}"><b>${esc(noticeOutcome(x))}</b><small>${n(x?.realizedR)==null?'':`${Number(x.realizedR)>=0?'+':''}${Number(x.realizedR).toFixed(2)}R`}</small></div>`:'<div class="mn-result live"><b>ACTIVE</b><small>${pct(x.calibratedWinRate)}</small></div>'}
    <button type="button" class="mn-x" data-hide-notice="${esc(id)}" aria-label="刪除顯示">×</button>
  </article>`
}
function renderNotices(){
  const mount=document.getElementById('manualWorkspaceV2638');if(!mount)return;
  let host=document.getElementById('manualNoticeLedgerV2639');
  if(!host){host=document.createElement('div');host.id='manualNoticeLedgerV2639';host.className='manual-notice-ledger-v2639';mount.appendChild(host)}
  const hidden=hiddenNotices(),recent=Array.isArray(perf?.recent)?perf.recent:[],visible=recent.filter(x=>!hidden[String(x?.id||'')]),auto=visible.filter(x=>x?.status==='ACTIVE').slice(0,12),history=visible.filter(x=>x?.status!=='ACTIVE').slice(0,24),hiddenCount=Object.keys(hidden).length;
  const sig=JSON.stringify([auto.map(x=>[x.id,x.status,x.lastPrice,x.result]),history.map(x=>[x.id,x.status,x.result,x.realizedR]),hiddenCount]);if(sig===lastNoticeSig&&host.children.length)return;lastNoticeSig=sig;
  const section=(kind,title,rows,sub)=>`<details class="mn-section ${kind}" ${kind==='auto'?'open':''}><summary><div><b>${title}</b><span>${rows.length}</span></div><small>${sub}</small><i>⌄</i></summary><div class="mn-list">${rows.length?rows.map(x=>noticeRow(x,kind==='history')).join(''):`<div class="mn-empty">${kind==='auto'?'目前沒有追蹤中的自動通知':'目前沒有歷史通知'}</div>`}</div></details>`;
  host.innerHTML=`${section('auto','自動通知',auto,'真正成功送出的進場通知 · ACTIVE')}${section('history','歷史通知',history,'已結束通知 · 可刪除顯示')}${hiddenCount?`<button type="button" class="mn-reset" data-reset-notice-hidden>恢復已刪除顯示 ${hiddenCount}</button>`:''}`
}
async function refreshPerformanceLedger(){
  if(perfBusy)return;perfBusy=true;
  try{perf=await json('/api/performance');renderNotices()}catch{}finally{perfBusy=false}
}

function ensureLayout(){
  const ideas=document.getElementById('page-ideas'),test=document.getElementById('page-test');if(!ideas||!test)return false;
  let rank=document.getElementById('rankMovedV2638');
  if(!rank){
    rank=document.createElement('section');rank.id='rankMovedV2638';rank.className='rank-moved-v2638';
    rank.innerHTML='<div class="rank-head-v2638"><b>建議排名</b><span id="rankAgeSlotV2638">—</span></div><div id="rankGridSlotV2638"></div>';
    const grid=document.getElementById('testGrid');
    if(grid)grid.insertAdjacentElement('afterend',rank);else test.appendChild(rank)
  }
  const rec=document.getElementById('recGrid'),ageEl=document.getElementById('ideaAge');
  if(rec&&rec.parentElement?.id!=='rankGridSlotV2638')document.getElementById('rankGridSlotV2638')?.appendChild(rec);
  if(ageEl&&ageEl.parentElement?.id!=='rankAgeSlotV2638'){
    const slot=document.getElementById('rankAgeSlotV2638');if(slot){slot.replaceWith(ageEl);ageEl.id='ideaAge';ageEl.classList.add('rank-age-v2638')}
  }
  let mount=document.getElementById('manualWorkspaceV2638');
  if(!mount){
    ideas.innerHTML='';
    mount=document.createElement('section');mount.id='manualWorkspaceV2638';mount.className='manual-workspace-v2638';ideas.appendChild(mount)
  }
  ensureDismissBox();
  return true
}
function ensureDismissBox(){
  const test=document.getElementById('page-test');if(!test)return null;
  let box=document.getElementById('manualDismissedV2638');
  if(!box){
    box=document.createElement('details');box.id='manualDismissedV2638';box.className='manual-dismissed-v2638';
    const rank=document.getElementById('rankMovedV2638');
    if(rank)rank.insertAdjacentElement('beforebegin',box);else test.appendChild(box)
  }
  return box
}
function eligible(x){return ['A','B'].includes(String(x?.grade||''))&&String(x?.notificationTier||'').toUpperCase()!=='BLOCKED'&&x?.institutionalEdge?.hardBlock!==true&&x?.trade?.status!=='ACTIVE'}
function closeCard(x){
  const d=dismissed();d[keyOf(x)]={at:Date.now(),id:keyOf(x),symbol:x.symbol,direction:x.direction,grade:x.grade};writeObj(DISMISS_KEY,d);
  const o=opens();delete o[keyOf(x)];writeObj(OPEN_KEY,o);lastSig='';render()
}
function restoreCard(id){const d=dismissed();delete d[id];writeObj(DISMISS_KEY,d);lastSig='';render()}
function field(id,k,f=''){return esc(draftVal(id,k,f))}
function card(x){
  const id=keyOf(x),e=x.entry||{},s=x.structure||{},sh=x.shadow||{},ab=x.abcLearning||{},o=opens(),open=o[id]===true;
  const entry=n(e.price),stop=n(e.stop),tp1=n(e.target),tp2=n(e.target2);
  const sample=ab.sample?`${ab.sample}筆 · ${pct(ab.hitRate)} · PF ${n(ab.profitFactor)==null?'—':Number(ab.profitFactor).toFixed(2)}`:'累積中';
  return `<article class="mw-card grade-${String(x.grade||'B').toLowerCase()}" data-id="${esc(id)}">
  <details ${open?'open':''}>
    <summary>
      <span class="mw-grade">${esc(x.grade)}</span>
      <div class="mw-main"><div><a href="${tvUrl(x.symbol)}" target="_blank" rel="noopener">${esc(x.symbol)}</a><em class="${x.direction==='SHORT'?'short':'long'}">${dirText(x.direction)}</em></div><small>${esc(s.label||'等待結構')} · ${esc(x.freshness||'')} ${age(x.freshnessAgeMs)}</small></div>
      <div class="mw-score"><b>${Math.round(Number(x.executionScore||0))}</b><span>執行</span></div>
      <button type="button" class="mw-x" data-dismiss="${esc(id)}" aria-label="移出手動標的">×</button>
      <i class="mw-chevron">⌄</i>
    </summary>
    <div class="mw-body">
      <div class="mw-quick">
        <div><span>校準勝率</span><b>${pct(x.calibratedWinRate)}</b></div>
        <div><span>順位</span><b>#${x.rank??'—'} · ${Math.round(Number(x.rankScore||0))}</b></div>
        <div><span>結構</span><b>${esc(s.label||'—')} ${n(s.health)==null?'':Math.round(s.health)}</b></div>
        <div><span>歷史樣本</span><b>${sh.sample||0}筆 · ${pct(sh.hitRate)}</b><small>PF ${n(sh.profitFactor)==null?'—':Number(sh.profitFactor).toFixed(2)}</small></div>
        <div><span>同級樣本</span><b>${sample}</b></div>
        <div><span>TP2 RR</span><b>${n(e.rr)==null?'—':Number(e.rr).toFixed(2)}</b></div>
      </div>
      <div class="mw-levels">
        <div><span>參考成本</span><b>${px(e.price)}</b></div><div><span>進場區</span><b>${n(e.zoneLow)!=null&&n(e.zoneHigh)!=null?`${px(e.zoneLow)}～${px(e.zoneHigh)}`:'—'}</b></div>
        <div><span>TP1 / TP2</span><b>${px(e.target)} / ${px(e.target2)}</b></div><div><span>SP1</span><b>${px(e.stop)}</b></div>
      </div>
      <div class="mw-reasons"><div><b>支持</b>${(x.reasons||[]).map(v=>`<span>${esc(v)}</span>`).join('')||'<span>—</span>'}</div><div><b>風險 / 還缺什麼</b>${(x.risks||[]).map(v=>`<span class="risk">${esc(v)}</span>`).join('')||'<span>目前無主要硬阻擋</span>'}</div></div>
      <div class="mw-form">
        <div class="mw-form-grid">
          <label><span>成本</span><input data-f="entry" inputmode="decimal" value="${field(id,'entry',entry??'')}"></label>
          <label><span>TP1</span><input data-f="tp1" inputmode="decimal" value="${field(id,'tp1',tp1??'')}"></label>
          <label><span>TP2</span><input data-f="tp2" inputmode="decimal" value="${field(id,'tp2',tp2??'')}"></label>
          <label><span>SP1</span><input data-f="sp1" inputmode="decimal" value="${field(id,'sp1',stop??'')}"></label>
          <label><span>SP2</span><input data-f="sp2" inputmode="decimal" value="${field(id,'sp2','')}"></label>
          <label><span>保證金 U</span><input data-f="margin" inputmode="decimal" value="${field(id,'margin',300)}"></label>
          <label><span>槓桿</span><input data-f="leverage" inputmode="numeric" value="${field(id,'leverage',20)}"></label>
          <label><span>數量（可空）</span><input data-f="quantity" inputmode="decimal" value="${field(id,'quantity','')}"></label>
        </div>
        <div class="mw-actions"><button type="button" data-current="${esc(id)}">成本用現價 ${px(e.currentPrice)}</button><button type="button" class="save" data-build="${esc(id)}">建立建倉追蹤</button></div>
        <div class="mw-msg" data-msg="${esc(id)}"></div>
      </div>
    </div>
  </details></article>`
}
function group(g,rows){return `<details class="mw-group grade-${g.toLowerCase()}" open><summary><div><b>${g}級</b><span>${rows.length}</span></div><small>${g==='A'?'優先':'次優先'} · 手動標的</small><i>⌄</i></summary><div class="mw-list">${rows.length?rows.map(card).join(''):`<div class="mw-empty">目前沒有 ${g} 級手動標的</div>`}</div></details>`}
function renderDismissed(){
  const box=ensureDismissBox();if(!box)return;
  const d=dismissed(),rows=(data?.rows||[]).filter(x=>d[keyOf(x)]).sort((a,b)=>(d[keyOf(b)]?.at||0)-(d[keyOf(a)]?.at||0));
  box.hidden=!rows.length;
  box.innerHTML=`<summary><b>手動略過</b><span>${rows.length}</span><small>只從手動頁移除，後台觀察與學習仍保留</small></summary><div class="md-list">${rows.map(x=>`<div class="md-row"><div><b>${esc(x.symbol)}</b><em class="${x.direction==='SHORT'?'short':'long'}">${dirText(x.direction)}</em><small>${esc(x.grade)}級 · 略過 ${age(Date.now()-Number(d[keyOf(x)]?.at||Date.now()))}</small></div><button type="button" data-restore="${esc(keyOf(x))}">恢復</button></div>`).join('')}</div>`
}
function render(){
  if(!ensureLayout()||!data)return;
  const mount=document.getElementById('manualWorkspaceV2638'),dis=dismissed(),all=(data.rows||[]).filter(x=>eligible(x)&&!dis[keyOf(x)]),a=stableRows(all.filter(x=>x.grade==='A'),'A'),b=stableRows(all.filter(x=>x.grade==='B'),'B');
  const sig=JSON.stringify([...a,...b].map(x=>[keyOf(x),x.executionScore,x.calibratedWinRate,x.structure?.state,x.entry?.price,x.entry?.target,x.entry?.stop,(x.risks||[]).join('|')]));
  if(sig!==lastSig||!mount.querySelector('.mw-shell')){
    lastSig=sig;mount.innerHTML=`<div class="mw-title"><b>手動標的</b><span>A＝高完成度 · B＝值得看；最後由你看盤扣扳機</span></div><div class="mw-shell">${group('A',a)}${group('B',b)}</div><div id="manualNoticeLedgerV2639" class="manual-notice-ledger-v2639"></div>`
  }
  renderDismissed();renderNotices()
}
function row(id){return (data?.rows||[]).find(x=>keyOf(x)===id)||null}
function inputVal(card,k){const v=card?.querySelector(`[data-f="${k}"]`)?.value;return v===''?null:Number(v)}
async function buildTrade(id){
  const x=row(id),card=document.querySelector(`.mw-card[data-id="${CSS.escape(id)}"]`),msg=card?.querySelector(`[data-msg="${CSS.escape(id)}"]`);if(!x||!card||!msg)return;
  const body={manualMode:true,manualGrade:x.grade,manualGradeScore:x.executionScore,manualGradeAt:data.generatedAt,manualOpportunityId:x.id,manualReasons:[...(x.reasons||[]),...(x.risks||[])].slice(0,8),signalKey:x.signalKey,notificationId:null,symbol:x.symbol,direction:x.direction,strategyId:x.strategyId,strategyLabel:x.strategyLabel,marketRegime:x.marketRegime,notificationTier:x.notificationTier,entryPrice:inputVal(card,'entry'),tp1:inputVal(card,'tp1'),tp2:inputVal(card,'tp2'),sp1:inputVal(card,'sp1'),sp2:inputVal(card,'sp2'),margin:inputVal(card,'margin'),quantity:inputVal(card,'quantity'),leverage:inputVal(card,'leverage'),manualSnapshot:{rank:x.rank,rankScore:x.rankScore,estimatedWinRate:x.estimatedWinRate,calibratedWinRate:x.calibratedWinRate,notificationTier:x.notificationTier,observationProgress:x.observationProgress,dataCoverage:x.dataHealth?.coverage,dataConfidence:x.dataHealth?.confidence,structureState:x.structure?.state,structureHealth:x.structure?.health,structureLearningAdjustment:x.structure?.learningAdjustment,shadowSample:x.shadow?.sample,shadowHitRate:x.shadow?.hitRate,shadowProfitFactor:x.shadow?.profitFactor,rr:x.entry?.rr,freshnessAgeMs:x.freshnessAgeMs,entryZoneLow:x.entry?.zoneLow,entryZoneHigh:x.entry?.zoneHigh,stop:x.entry?.stop,target:x.entry?.target,target2:x.entry?.target2}};
  msg.textContent='建立中…';
  try{await json('/api/actual-trades',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});msg.textContent='✓ 已建立，後台開始追蹤 TP / SP 與實際結果';setTimeout(()=>refresh(true),700)}catch(e){msg.textContent=`✕ ${e.message}`}
}
async function refresh(force=false){
  if(busy)return;if(document.querySelector('.mw-form input:focus'))return;busy=true;
  try{data=await json(`/api/manual-opportunities${force?'?force=1':''}`);render()}catch(e){const m=document.getElementById('manualWorkspaceV2638');if(m&&!data)m.innerHTML=`<div class="mw-empty">手動標的暫時不可用 · ${esc(e?.message||'連線延遲，系統會自動重試')}</div>`}finally{busy=false}
}
function refreshRank(){
  if(currentPage()!=='test')return;try{if(typeof window.refreshRankedIdeas==='function')void window.refreshRankedIdeas(false)}catch{}
}
function bind(){
  document.addEventListener('click',e=>{
    const d=e.target.closest?.('[data-dismiss]');if(d){e.preventDefault();e.stopPropagation();const x=row(d.dataset.dismiss);if(x)closeCard(x);return}
    const r=e.target.closest?.('[data-restore]');if(r){e.preventDefault();restoreCard(r.dataset.restore);return}
    const hn=e.target.closest?.('[data-hide-notice]');if(hn){e.preventDefault();hideNotice(hn.dataset.hideNotice);return}
    if(e.target.closest?.('[data-reset-notice-hidden]')){e.preventDefault();resetHiddenNotices();return}
    const c=e.target.closest?.('[data-current]');if(c){e.preventDefault();const x=row(c.dataset.current),card=c.closest('.mw-card'),i=card?.querySelector('[data-f="entry"]');if(x&&i&&n(x.entry?.currentPrice)!=null){i.value=String(x.entry.currentPrice);saveDraft(c.dataset.current,'entry',i.value)}return}
    const b=e.target.closest?.('[data-build]');if(b){e.preventDefault();void buildTrade(b.dataset.build);return}
    if(e.target.closest?.('.pageTab[data-page="test"]'))setTimeout(refreshRank,100)
  },true);
  document.addEventListener('input',e=>{const i=e.target.closest?.('.mw-card [data-f]');if(!i)return;const card=i.closest('.mw-card');saveDraft(card.dataset.id,i.dataset.f,i.value)});
  document.addEventListener('toggle',e=>{const d=e.target;if(!(d instanceof HTMLDetailsElement)||!d.closest?.('.mw-card'))return;const id=d.closest('.mw-card').dataset.id,o=opens();if(d.open)o[id]=true;else delete o[id];writeObj(OPEN_KEY,o)},{capture:true});
  document.addEventListener('touchstart',e=>{const t=e.touches?.[0];touchStart=t?{x:t.clientX,y:t.clientY}:null},{capture:true,passive:true});
  document.addEventListener('touchend',e=>{if(!touchStart)return;const t=e.changedTouches?.[0],dx=(t?.clientX??touchStart.x)-touchStart.x,dy=(t?.clientY??touchStart.y)-touchStart.y;touchStart=null;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.15)e.stopImmediatePropagation()},{capture:true,passive:true});
}
function boot(){ensureLayout();bind();void refresh(true);void refreshPerformanceLedger();timer=setInterval(()=>{if(document.visibilityState!=='visible')return;const p=currentPage();if(p==='ideas'||p==='test')void refresh(false);if(p==='ideas')void refreshPerformanceLedger();if(p==='test')refreshRank()},30000);window.addEventListener('pageshow',()=>{ensureLayout();void refresh(true);void refreshPerformanceLedger();refreshRank()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){ensureLayout();void refresh(false);void refreshPerformanceLedger();refreshRank()}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.ManualWorkspaceV2638={version:VERSION,refresh};
})();