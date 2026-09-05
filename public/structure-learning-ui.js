(()=>{
  'use strict';
  const VERSION='2.6.8';
  const REFRESH_MS=30_000;
  const BOOT_RETRY_MS=1_500;
  let snapshot={learning:null,signals:null,updatedAt:0};
  let busy=false;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number.isFinite(Number(v))?Number(v):null;
  const pct=v=>n(v)==null?'—':`${Number(v).toFixed(1)}%`;
  const stateZh=s=>({INTACT:'完整',DAMAGED:'受損',RECLAIMING:'收復中',OPPORTUNITY:'深回踩機會',DESTROYED:'徹底破壞'})[String(s||'')]||String(s||'—');
  const patternZh=s=>({NORMAL_STRUCTURE:'正常結構',DEEP_RETRACE:'深回踩',DEEP_RECLAIM:'深回踩收復',FAILED_BREAK_RECLAIM:'假跌破收復',LIQUIDITY_SWEEP:'流動性掃盤',STRUCTURE_BREAK:'結構破壞',POC_RECLAIM:'POC收復'})[String(s||'')]||String(s||'—');
  const outcomeZh=s=>({STRUCTURE_HELD:'結構守住',STRUCTURE_FAILED:'結構失敗',RECLAIM_SUCCESS:'收復成功',DEEP_PULLBACK_SUCCESS:'深回踩成功',DEEP_PULLBACK_FAILED:'深回踩失敗',FALSE_INVALIDATION:'假失效／後續收復',TRUE_INVALIDATION:'真失效'})[String(s||'')]||String(s||'—');
  const outcomeSign=s=>['STRUCTURE_HELD','RECLAIM_SUCCESS','DEEP_PULLBACK_SUCCESS','FALSE_INVALIDATION'].includes(String(s||''))?1:['STRUCTURE_FAILED','DEEP_PULLBACK_FAILED','TRUE_INVALIDATION'].includes(String(s||''))?-1:0;
  const levelZh=s=>({detail:'精細桶',core:'核心桶',broad:'廣義桶'})[String(s||'')]||'尚未啟動';
  function slTradingViewLink(symbol){let clean=String(symbol||'').toUpperCase().trim().replace(/^BINANCE:/,'').replace(/\.P$/,'').replace(/[^A-Z0-9]/g,'');return clean?`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`BINANCE:${clean}.P`)}`:'https://www.tradingview.com/chart/'}
  function slTvAnchor(symbol){return `<a class="sl-tv-link" href="${esc(slTradingViewLink(symbol))}" target="_blank" rel="noopener noreferrer" aria-label="在 TradingView 網頁版開啟 ${esc(symbol)}">${esc(symbol)}</a>`}

  function adjustmentHtml(value,active=true){
    const x=n(value)??0;
    if(!active)return '<b class="sl-adj wait">0</b><small>樣本不足，不調權</small>';
    if(x>0)return `<b class="sl-adj plus">+${x}</b><small>學習加分</small>`;
    if(x<0)return `<b class="sl-adj minus">${x}</b><small>學習減分</small>`;
    return '<b class="sl-adj flat">0</b><small>學習中性</small>';
  }

  function viewportPin(exclude=null){const node=document.elementFromPoint(Math.max(12,Math.min(window.innerWidth/2,220)),Math.min(120,window.innerHeight/3));if(!node||(exclude&&exclude.contains(node)))return null;const el=node.closest?.('.page,.pageTabs,.sg-panel,.rankCard,.perfHero')||node;return el?.isConnected?{node:el,top:el.getBoundingClientRect().top}:null}
  function restoreViewportPin(pin){if(!pin?.node?.isConnected)return;requestAnimationFrame(()=>{if(!pin.node.isConnected)return;const delta=pin.node.getBoundingClientRect().top-pin.top;if(Math.abs(delta)>1&&Math.abs(delta)<window.innerHeight*1.5)window.scrollBy({top:delta,left:0,behavior:'auto'})})}

  async function fetchJson(path,timeout=4_500){
    const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctrl?setTimeout(()=>ctrl.abort(),timeout):null;
    try{
      const r=await fetch(path,{cache:'no-store',...(ctrl?{signal:ctrl.signal}:{})});
      if(!r.ok)throw new Error(`${path} ${r.status}`);
      return await r.json();
    }finally{if(timer)clearTimeout(timer)}
  }

  function currentRows(){
    const rows=Array.isArray(snapshot.signals?.rows)?snapshot.signals.rows:[];
    return rows.filter(x=>x?.structureV2&&!['DROPPED','EXPIRED'].includes(String(x?.status||'')))
      .sort((a,b)=>(n(b?.structureV2?.health)??-1)-(n(a?.structureV2?.health)??-1)).slice(0,5);
  }

  function bucketProgress(s){
    const min=Math.max(1,n(snapshot.learning?.summary?.minLearningSample)??20);
    if(s?.learning?.active){
      const sample=n(s.learning?.stats?.sample)??min;
      return {sample,min,active:true,level:s.learning.level||null};
    }
    const keyset=s?.learning?.keys||{};
    const recent=Array.isArray(snapshot.learning?.recent)?snapshot.learning.recent:[];
    for(const level of ['detail','core','broad']){
      const k=keyset[level];if(!k)continue;
      const sample=recent.filter(r=>r?.status==='RESOLVED'&&r?.learningEligible!==false&&outcomeSign(r?.outcome)!==0&&String(r?.keys?.[level]||'')===String(k)).length;
      if(sample>0)return {sample,min,active:false,level};
    }
    return {sample:0,min,active:false,level:null};
  }

  function currentRowHtml(x){
    const s=x.structureV2||{},learn=s.learning||{},bp=bucketProgress(s),health=n(s.health),raw=health==null?null:health-(n(learn.adjustment)??0);
    const progress=Math.min(100,Math.round(bp.sample/Math.max(1,bp.min)*100));
    return `<div class="sl-current-row state-${esc(String(s.state||'').toLowerCase())}">
      <div class="sl-current-main">${x.symbol?slTvAnchor(x.symbol):'<b>—</b>'}<span>${esc(x.direction==='SHORT'?'空':'多')}</span><em>${esc(stateZh(s.state))}</em></div>
      <div class="sl-current-structure"><strong>${esc(patternZh(s.pattern))}</strong><small>${esc((s.reasons||[]).slice(0,2).join(' · ')||s.action||'多週期結構判讀')}</small></div>
      <div class="sl-current-score"><span>結構 ${health==null?'—':Math.round(health)}</span><small>${raw==null?'':'原始 '+Math.round(raw)+' → '}學習後</small></div>
      <div class="sl-current-adjust">${adjustmentHtml(learn.adjustment,learn.active===true)}</div>
      <div class="sl-bucket"><span>${esc(levelZh(bp.level))} ${bp.sample}/${bp.min}</span><i><u style="width:${progress}%"></u></i></div>
    </div>`;
  }

  function summaryHtml(mode='growth'){
    const d=snapshot.learning||{},s=d.summary||{},overall=s.overall||{},deep=s.deepPullback||{},inv=s.invalidation||{};
    const effective=n(s.effective)??0,min=n(s.minLearningSample)??20,maxAdj=n(s.maxAdjustment)??8,rows=currentRows();
    const activeNow=rows.filter(x=>x?.structureV2?.learning?.active===true).length;
    const recent=(Array.isArray(d.recent)?d.recent:[]).filter(x=>x?.status==='RESOLVED'&&outcomeSign(x?.outcome)!==0).slice(0,4);
    const readyText=activeNow?`${activeNow} 個目前結構已啟動學習調權`:`每個同類結構桶至少 ${min} 筆有效樣本才開始加減分`;
    const rowsHtml=rows.length?rows.map(currentRowHtml).join(''):'<div class="sl-empty">目前沒有可顯示的即時結構候選；學習資料仍會持續累積。</div>';
    const historyHtml=recent.length?recent.map(r=>`<div class="sl-history-row"><span>${esc(r.symbol||'—')} · ${esc(stateZh(r.state))}</span><b class="${outcomeSign(r.outcome)>0?'good':'bad'}">${esc(outcomeZh(r.outcome))}</b><small>${n(r.learningAdjustment)>0?'+':''}${n(r.learningAdjustment)??0} 分</small></div>`).join(''):'<div class="sl-empty compact">尚無已結算的結構學習紀錄。</div>';
    return `<div class="sl-head"><div><span>${mode==='growth'?'STRUCTURE MASTERY':'STRUCTURE LEARNING'}</span><b>${mode==='growth'?'結構記憶':'結構學習績效'}</b></div><em>S${esc(String(s.version||'2.1').replace(/^S/i,''))}</em></div>
      <div class="sl-summary-grid">
        <div><span>有效結構樣本</span><b>${effective}</b><small>總紀錄 ${n(s.records)??0}</small></div>
        <div><span>結構命中</span><b>${pct(overall.hitRate)}</b><small>${n(overall.sample)??0} 筆有效</small></div>
        <div><span>深回踩成功</span><b>${pct(deep.successRate)}</b><small>${n(deep.sample)??0} 筆</small></div>
        <div><span>假失效率</span><b>${pct(inv.falseInvalidRate)}</b><small>失效樣本 ${n(inv.sample)??0}</small></div>
      </div>
      <div class="sl-rule"><b>${esc(readyText)}</b><span>調權上限 ±${maxAdj}；學習只修正非 DESTROYED 邊界狀態，不能把已確認徹底破壞的結構救回來。</span></div>
      <div class="sl-subtitle"><b>目前判讀＋學習加減分</b><span>即時結構分數 = 原始結構分數 + 歷史同型態學習分</span></div>
      <div class="sl-current-list">${rowsHtml}</div>
      <div class="sl-subtitle"><b>最近學到的結構結果</b><span>獨立於 TP / SL，直接判斷結構後續有沒有守住</span></div>
      <div class="sl-history">${historyHtml}</div>`;
  }

  function renderGrowth(){
    const panel=document.getElementById('sgPanel');if(!panel||panel.hidden||!snapshot.learning)return;
    let box=panel.querySelector('#slGrowthPanel'),mountPin=null;
    if(!box){
      mountPin=viewportPin(panel);
      box=document.createElement('details');box.id='slGrowthPanel';box.className='sg-accordion sl-growth-panel';box.open=true;box.dataset.sgDetailKey='structure-learning';
      const live=panel.querySelector('#sgCandidateSection'),accordions=panel.querySelector('.sg-accordions');
      if(accordions)accordions.prepend(box);else if(live)live.insertAdjacentElement('afterend',box);else panel.appendChild(box);
    }
    const sig=JSON.stringify([snapshot.updatedAt,snapshot.learning?.summary,currentRows().map(x=>[x.symbol,x.direction,x.structureV2?.state,x.structureV2?.health,x.structureV2?.learning?.adjustment])]);
    if(box.dataset.slSig===sig)return;const rect=box.getBoundingClientRect(),keepTop=rect.bottom>0&&rect.top<window.innerHeight?rect.top:null;box.dataset.slSig=sig;
    box.innerHTML=`<summary><span class="sl-memory-diamond" aria-hidden="true">◇</span><div><b>結構記憶</b><span>STRUCTURE MASTERY</span></div><em>${n(snapshot.learning?.summary?.effective)??0} SAMPLE</em></summary><div class="sg-detail-body sl-body">${summaryHtml('growth')}</div>`;
    if(keepTop!=null)requestAnimationFrame(()=>{const delta=box.getBoundingClientRect().top-keepTop;if(Math.abs(delta)>1&&Math.abs(delta)<window.innerHeight)window.scrollBy({top:delta,left:0,behavior:'auto'})});else restoreViewportPin(mountPin);
  }

  function renderPerformance(){
    const page=document.getElementById('page-performance');if(!page||!snapshot.learning)return;
    let box=page.querySelector('#slPerformancePanel'),mountPin=null;
    if(!box){
      mountPin=viewportPin(page);
      box=document.createElement('section');box.id='slPerformancePanel';box.className='sl-performance-panel';
      const hero=page.querySelector('.perfHero');
      if(hero)hero.insertAdjacentElement('afterend',box);else page.prepend(box);
    }
    const sig=JSON.stringify([snapshot.updatedAt,snapshot.learning?.summary,currentRows().map(x=>[x.symbol,x.direction,x.structureV2?.state,x.structureV2?.health,x.structureV2?.learning?.adjustment])]);
    if(box.dataset.slSig===sig)return;box.dataset.slSig=sig;
    box.innerHTML=`${summaryHtml('performance')}<div class="sl-export"><a href="/api/structure-learning.csv">結構學習 CSV</a><span>影子績效看「交易訊號」；這裡另外看「結構判讀本身」是否真的有效。</span></div>`;restoreViewportPin(mountPin);
  }

  function renderAll(){try{renderGrowth();renderPerformance()}catch(e){console.warn('[structure-learning-ui] render skipped',e?.message||e)}}

  async function refresh(){
    if(busy)return;busy=true;
    try{
      const [learning,signals]=await Promise.allSettled([fetchJson('/api/structure-learning',4_000),fetchJson('/api/test-signals',4_000)]);
      if(learning.status==='fulfilled'&&learning.value?.ok)snapshot.learning=learning.value;
      if(signals.status==='fulfilled'&&signals.value?.ok)snapshot.signals=signals.value;
      if(snapshot.learning){snapshot.updatedAt=Date.now();renderAll()}
    }catch{}finally{busy=false}
  }

  function init(){
    void refresh();
    // No MutationObserver here: UI is intentionally passive so it cannot trap the main app again.
    setInterval(()=>{renderAll()},2_000);
    setInterval(()=>{if(document.visibilityState==='visible')void refresh()},REFRESH_MS);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});
    document.addEventListener('click',e=>{
      if(e.target?.closest?.('#sgBrandToggle,.pageTab'))setTimeout(()=>{renderAll()},BOOT_RETRY_MS);
    },{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  window.StructureLearningUI={version:VERSION,refresh};
})();
