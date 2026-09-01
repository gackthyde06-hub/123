(()=>{
  'use strict';
  const VERSION='2.0.1';
  const INTERACT_HOLD_MS=30*60*1000;
  const OPEN_KEY='sg-open-v1';
  const SNAP_PREFIX='sg-day-v1-';
  const HISTORY_KEY='sg-history-v1';
  const PROGRESS_KEY='sg-progress-v20';
  const VISIT_KEY='sg-visits-v1';
  const DETAILS_KEY='sg-details-v219';
  const EXPLORE_PREFIX='sg-explore-v1-';
  const rootDoc=document;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
  const has=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=(v,d=1)=>has(v)?`${Number(v).toFixed(d)}%`:'—';
  const num=(v,d=0)=>has(v)?Number(v).toLocaleString('en-US',{maximumFractionDigits:d}):'—';
  const pf=v=>has(v)?Number(v).toFixed(2):'—';
  const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todayKey=()=>dateKey();
  const state={open:false,loading:false,perf:null,signals:null,lastLoadedAt:0,intel:new Map(),timer:null,toastTimer:null,renderKey:'',interactUntil:0};

  const hashString=s=>{s=String(s||'');let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h>>>0};
  const stageIconByIndex=i=>(['explore','ward','verify','stable','achievement'][Math.max(0,Math.min(4,Number(i)||0))]||'crest');
  function candidateIconType(x){
    const strategy=String(x?.strategyAtConfirm?.label||x?.strategyProfile?.label||x?.lastCheck?.strategyLabel||'');
    const seed=hashString(`${x?.symbol||''}|${strategy}|${x?.direction||''}`);
    const pools=strategy.includes('回踩')?['return','focus','ward','explore','atlas']
      :strategy.includes('突破')?['break','pulse','gate','wing','verify']
      :strategy.includes('深度')?['depth','sample','intel','state','codex']
      :strategy.includes('影子')?['shadow','dedup','history','risk','state']
      :(x?.direction==='SHORT'?['risk','state','wing','focus','break']:['state','sample','ward','atlas','explore']);
    return pools[seed%pools.length]||'state';
  }

  function safeParse(raw,fallback=null){try{return JSON.parse(raw)}catch{return fallback}}
  function storageGet(key,fallback=null){try{return safeParse(localStorage.getItem(key),fallback)}catch{return fallback}}
  function storageSet(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}

  function getDetailsState(){return storageGet(DETAILS_KEY,{})||{}}
  function detailKey(el){return el?.getAttribute?.('data-sg-detail-key')||el?.id||''}
  function captureDetailsState(root){
    if(!root)return getDetailsState();
    const saved=getDetailsState();
    root.querySelectorAll('details').forEach(el=>{const k=detailKey(el);if(k)saved[k]=!!el.open});
    storageSet(DETAILS_KEY,saved);
    return saved;
  }
  function restoreDetailsState(root){
    if(!root)return;
    const saved=getDetailsState();
    root.querySelectorAll('details').forEach(el=>{
      const k=detailKey(el);if(!k)return;
      if(Object.prototype.hasOwnProperty.call(saved,k))el.open=!!saved[k];
    });
  }
  function getDayBase(){return storageGet(SNAP_PREFIX+todayKey(),null)}
  function setDayBase(v){try{if(!localStorage.getItem(SNAP_PREFIX+todayKey()))localStorage.setItem(SNAP_PREFIX+todayKey(),JSON.stringify(v))}catch{}}
  function getExplore(){return storageGet(EXPLORE_PREFIX+todayKey(),{lesson:false,candidate:false,journal:false})||{lesson:false,candidate:false,journal:false}}
  function markExplore(key){const ex=getExplore();if(ex[key])return;ex[key]=true;storageSet(EXPLORE_PREFIX+todayKey(),ex);showToast(`章節 +1 · ${key==='lesson'?'解析':key==='candidate'?'候選':'日誌'}`);updateExploreUi()}
  function updateExploreUi(){const ex=getExplore(),done=['lesson','candidate','journal'].filter(k=>ex[k]).length,box=rootDoc.querySelector('[data-sg-explore]');if(!box)return;const count=box.querySelector('[data-sg-explore-count]'),note=box.querySelector('[data-sg-explore-note]');if(count)count.textContent=`${done} / 3`;if(note)note.textContent=done===3?'COMPLETE':'RESEARCH PATH';box.querySelectorAll('[data-sg-jump]').forEach(btn=>{const k=btn.dataset.sgJump,ok=!!ex[k];btn.classList.toggle('done',ok);const i=btn.querySelector('i');if(i)i.innerHTML=sigilSvg(ok?'verify':({lesson:'explore',candidate:'calibrate',journal:'journal'}[k]||'explore'),ok?3:1)})}
  function markInteraction(ms=INTERACT_HOLD_MS){state.interactUntil=Math.max(state.interactUntil||0,Date.now()+ms)}
  function updateVisits(){
    const today=todayKey(),arr=storageGet(VISIT_KEY,[])||[],set=new Set(arr.filter(Boolean));set.add(today);
    const sorted=[...set].sort().slice(-30);storageSet(VISIT_KEY,sorted);return sorted;
  }
  function recentVisitCount(days=7){const arr=new Set(storageGet(VISIT_KEY,[])||[]);let n=0;for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);if(arr.has(dateKey(d)))n++}return n}

  function levelFromXp(total){
    let level=1,spent=0,need=350,left=Math.max(0,Math.round(total||0));
    while(left>=need&&level<50){left-=need;spent+=need;level+=1;need=Math.round(350+level*150)}
    return {level,current:left,need,total:Math.round(total||0),spent,ratio:need?clamp(left/need*100):0};
  }
  function skillLevel(count){
    const n=Number(count||0),cuts=[5,20,50,100,200];let lv=1;for(const c of cuts)if(n>=c)lv+=1;
    const prev=lv===1?0:cuts[lv-2],next=cuts[lv-1]??400;
    return {lv,current:n,next,ratio:clamp((n-prev)/Math.max(1,next-prev)*100),rank:lv>=6?'大師':lv>=5?'專精':lv>=4?'熟練':lv>=3?'進階':'初階'};
  }
  function weightedPatternScore(patterns,predicate){
    const rows=(patterns||[]).filter(predicate);if(!rows.length)return {score:50,sample:0,pf:null,hit:null};
    let w=0,hit=0,p=0,sample=0;for(const x of rows){const s=Math.max(1,Number(x.sample||0));sample+=s;w+=s;hit+=(Number(x.hitRate)||0)*s;p+=(Number(x.profitFactor)||0)*s}
    const hr=w?hit/w:0,pp=w?p/w:0,score=clamp(35+(hr-35)*.72+(pp-1)*18+Math.min(12,Math.log10(sample+1)*6),25,95);return {score,sample,pf:pp,hit:hr};
  }
  function xpModel(perf){
    const sh=perf?.shadowSummary||{},sum=perf?.summary||{},patterns=perf?.stateLearning?.patterns||[];
    const effective=Number(sh.learningEffectiveResolved||0),eligible=Number(sh.learningEligibleResolved||0),blocked=Number(sh.blockedSample||0),notified=Number(sum.sample||0);
    const xp=effective*35+eligible*8+blocked*2+notified*50+patterns.length*120;
    return {xp,effective,eligible,blocked,notified,patterns:patterns.length};
  }
  function stageFromEffective(n){
    n=Number(n||0);if(n<20)return {index:0,name:'探索',from:0,to:20,desc:'先收樣本，先別急著下結論。'};
    if(n<50)return {index:1,name:'校準',from:20,to:50,desc:'開始分層，但核心仍是擴充乾淨樣本。'};
    if(n<100)return {index:2,name:'驗證',from:50,to:100,desc:'拿新行情驗證舊規律還能不能活。'};
    if(n<300)return {index:3,name:'穩定',from:100,to:300,desc:'重點改成穩定度、回撤與跨狀態表現。'};
    return {index:4,name:'深化',from:300,to:600,desc:'樣本夠大後，再談專精與重構。'};
  }
  function getMetrics(){
    const perf=state.perf||{},sh=perf.shadowSummary||{},sum=perf.summary||{},patterns=perf.stateLearning?.patterns||[],rows=state.signals?.rows||[];
    const xp=xpModel(perf),level=levelFromXp(xp.xp),stage=stageFromEffective(xp.effective);
    const avgProgress=rows.length?rows.reduce((a,x)=>a+clamp(x.observationProgress||x.strategyProfile?.progress||0),0)/rows.length:0;
    const overallHit=has(sh.hitRate)?Number(sh.hitRate):0,overallPf=has(sh.profitFactor)?Number(sh.profitFactor):0,blockedHit=has(sh.blockedHitRate)?Number(sh.blockedHitRate):50;
    const trend=weightedPatternScore(patterns,x=>['TREND_UP','TREND_DOWN'].includes(String(x?.features?.regime||'')));
    const funding=weightedPatternScore(patterns,x=>String(x?.features?.oi||'—')!=='—'||String(x?.features?.taker||'—')!=='—');
    const depth=weightedPatternScore(patterns,x=>String(x?.features?.depth||'—')!=='—');
    const structure=clamp(42+avgProgress*.22+(overallHit-35)*.30+(overallPf-1)*10+Math.min(10,xp.effective/5),30,94);
    const trendScore=trend.sample?trend.score:clamp(42+avgProgress*.18+(overallHit-35)*.25,30,90);
    const moneyScore=funding.sample?funding.score:clamp(45+(overallHit-35)*.25+Math.min(10,xp.effective/6),30,90);
    const depthScore=depth.sample?depth.score:clamp(44+(overallHit-35)*.20+Math.min(12,xp.blocked/12),30,90);
    const riskConfidence=Math.min(1,Number(sh.blockedSample||0)/100),riskRaw=100-blockedHit;
    const risk=clamp(50*(1-riskConfidence)+riskRaw*riskConfidence+Math.min(10,xp.effective/10),30,94);
    const selectivity=Number(sh.sample||0)>0?Number(sh.blockedSample||0)/Number(sh.sample||1):0;
    const patience=clamp(48+selectivity*42+Math.min(10,xp.effective/8)-Math.min(8,Number(sum.sample||0)/10),35,95);
    const attrs=[{key:'structure',label:'結構判讀',value:Math.round(structure)},{key:'trend',label:'趨勢掌握',value:Math.round(trendScore)},{key:'money',label:'資金嗅覺',value:Math.round(moneyScore)},{key:'depth',label:'深度感知',value:Math.round(depthScore)},{key:'risk',label:'風險控管',value:Math.round(risk)},{key:'patience',label:'耐心紀律',value:Math.round(patience)}];
    const tierCounts={HIGH:0,NORMAL:0,VALID:0,BLOCKED:0};for(const x of rows){const k=String(x.notificationTier||'VALID').toUpperCase();if(k in tierCounts)tierCounts[k]++}
    const blockers={};for(const x of rows){for(const b of x.notificationGate?.blockers||[]){blockers[b]=(blockers[b]||0)+1}}
    const blockerTop=Object.entries(blockers).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const personality=selectivity>=.67?'耐心獵手':selectivity>=.5?'嚴格篩選型':'積極研究型';
    const best=[...patterns].sort((a,b)=>Number(b.adjustment||0)-Number(a.adjustment||0)||Number(b.profitFactor||0)-Number(a.profitFactor||0))[0]||null;
    const worst=[...patterns].sort((a,b)=>Number(a.adjustment||0)-Number(b.adjustment||0)||Number(a.profitFactor||0)-Number(b.profitFactor||0))[0]||null;
    return {perf,sh,sum,patterns,rows,xp,level,stage,attrs,tierCounts,blockerTop,personality,best,worst,selectivity};
  }

  function radarSvg(attrs){
    const cx=150,cy=134,r=90,axes=6,pt=(i,rr)=>{const a=-Math.PI/2+i*Math.PI*2/axes;return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]},poly=rr=>Array.from({length:axes},(_,i)=>pt(i,rr).map(v=>v.toFixed(1)).join(',')).join(' ');
    const rings=[.25,.5,.75,1].map(k=>`<polygon points="${poly(r*k)}" class="sg-radar-ring"/>`).join(''),lines=Array.from({length:axes},(_,i)=>{const p=pt(i,r);return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" class="sg-radar-axis"/>`}).join('');
    const shape=attrs.map((x,i)=>pt(i,r*clamp(x.value)/100).map(v=>v.toFixed(1)).join(',')).join(' '),dots=attrs.map((x,i)=>{const p=pt(i,r*clamp(x.value)/100);return `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" class="sg-radar-dot"/>`}).join('');
    const labels=attrs.map((x,i)=>{const p=pt(i,r+25),anchor=p[0]<cx-8?'end':p[0]>cx+8?'start':'middle',dy=p[1]<cy-20?'-3':p[1]>cy+20?'13':'4';return `<text x="${p[0]}" y="${p[1]}" text-anchor="${anchor}" class="sg-radar-label"><tspan x="${p[0]}" dy="${dy}">${esc(x.label)}</tspan><tspan x="${p[0]}" dy="14" class="sg-radar-value">${x.value}</tspan></text>`}).join('');
    return `<svg class="sg-radar" viewBox="0 0 300 270" role="img" aria-label="系統六維屬性雷達圖">${rings}${lines}<circle cx="150" cy="134" r="9" class="sg-radar-core"/><polygon points="${shape}" class="sg-radar-shape"/>${dots}${labels}</svg>`;
  }
  function strategyPatternCount(patterns,word){return (patterns||[]).filter(x=>String(x?.features?.strategyLabel||'').includes(word)).reduce((a,x)=>a+Number(x.sample||0),0)}
  function patternText(x){if(!x)return'尚未形成可學習模式';const f=x.features||{},dir=f.direction==='SHORT'?'空':'多',reg=({TREND_UP:'強多',TREND_DOWN:'強空',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算'})[f.regime]||f.regime||'未分類';return `${f.strategyLabel||'未分類'} · ${reg} · ${dir} · ${Number(x.sample||0)}筆 · 命中 ${has(x.hitRate)?Number(x.hitRate).toFixed(1)+'%':'—'} · PF ${pf(x.profitFactor)} · 權重 ${Number(x.adjustment||0)>0?'+':''}${Number(x.adjustment||0)}`}
  function formatAge(ts){if(!ts)return'—';const s=Math.max(0,Math.floor((Date.now()-new Date(ts).getTime())/1000));if(s<60)return`${s}秒前`;if(s<3600)return`${Math.floor(s/60)}分前`;return`${Math.floor(s/3600)}小時前`}

  function renderKeyFor(perf,signals){
    try{
      const rows=(signals?.rows||[]).map(x=>({s:x.symbol,d:x.direction,t:x.notificationTier,p:x.observationProgress??x.strategyProfile?.progress,st:x.status,wr:x.calibratedWinRate,r:x.marketRegime,sl:x.strategyAtConfirm?.label||x.strategyProfile?.label||x.lastCheck?.strategyLabel,g:{s:x.notificationGate?.score,n:x.notificationGate?.normalMissing,b:x.notificationGate?.blockers}}));
      return JSON.stringify({sh:perf?.shadowSummary||{},sum:perf?.summary||{},patterns:perf?.stateLearning?.patterns||[],rows});
    }catch{return String(Date.now())}
  }

  function stagePath(m){
    const stages=[['探索',20,'explore'],['校準',50,'ward'],['驗證',100,'verify'],['穩定',300,'stable']],n=m.xp.effective;
    return `<div class="sg-stage-path">${stages.map(([label,cut,icon],i)=>`<div class="sg-stage-node ${n>=cut?'done':n>=([0,20,50,100][i]||0)?'current':''}"><i>${sigilSvg(n>=cut?'node-on':icon,n>=cut?3:(n>=([0,20,50,100][i]||0)?2:1))}</i><span>${label}</span><small>${cut}樣本</small></div>`).join('')}</div>`;
  }
  function recordHistory(m){
    const arr=storageGet(HISTORY_KEY,[])||[],today=todayKey(),entry={date:today,xp:m.xp.xp,effective:m.xp.effective,hit:has(m.sh.hitRate)?Number(m.sh.hitRate):null,pf:has(m.sh.profitFactor)?Number(m.sh.profitFactor):null};
    const keep=arr.filter(x=>x?.date&&x.date!==today).concat(entry).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-14);storageSet(HISTORY_KEY,keep);return keep;
  }
  function historySvg(rows){
    const list=(rows||[]).filter(x=>has(x.xp)).slice(-7);if(list.length<2)return `<div class="sg-history-empty">再回來幾天，這裡會開始畫出你的系統成長曲線。</div>`;
    const w=300,h=90,p=10,min=Math.min(...list.map(x=>Number(x.xp))),max=Math.max(...list.map(x=>Number(x.xp))),span=Math.max(1,max-min),pts=list.map((x,i)=>`${p+i*(w-p*2)/(list.length-1)},${h-p-(Number(x.xp)-min)/span*(h-p*2)}`).join(' ');
    return `<svg class="sg-history-svg" viewBox="0 0 ${w} ${h}" aria-label="近七日研究經驗曲線"><polyline points="${pts}" fill="none" class="sg-history-line"/>${pts.split(' ').map(pt=>{const [x,y]=pt.split(',');return `<circle cx="${x}" cy="${y}" r="3" class="sg-history-dot"/>`}).join('')}</svg><div class="sg-history-labels"><span>${esc(list[0].date.slice(5))}</span><b>${num(list[list.length-1].xp)} XP</b><span>${esc(list[list.length-1].date.slice(5))}</span></div>`;
  }

  const SG_GLYPH_TYPES=['crest','return','break','shadow','state','depth','risk','sample','dedup','hit','notify','explore','calibrate','verify','stable','journal','history','achievement','codex','intel'];
  function sigilSvg(type,grade=1){
    const g=Math.max(1,Math.min(5,Number(grade)||1));
    const wrap=(cls,inner)=>`<svg viewBox="0 0 32 32" class="sg-sigil-svg ${cls} sg-glyph-grade-${g}" aria-hidden="true">${inner}</svg>`;
    const ring=g>=3?`<circle cx="16" cy="16" r="13" class="sg-glyph-orbit" fill="none"/>`:'';
    const spark=g>=4?`<path class="sg-glyph-spark" d="M16 1v4M16 27v4M1 16h4M27 16h4" fill="none"/>`:'';
    const crown=g>=5?`<path class="sg-glyph-crown" d="M9 6l3 2 4-4 4 4 3-2" fill="none"/>`:'';
    const icons={
      crest:`<path d="M16 4 26 10v7c0 5.6-3.6 9.2-10 11-6.4-1.8-10-5.4-10-11v-7Z" fill="none"/><path d="M16 9v14" fill="none"/><path d="M10.5 14.2c1.8-1.8 3.6-2.7 5.5-2.7s3.7.9 5.5 2.7" fill="none"/><path d="M11.5 20c1.4-1.3 2.9-1.9 4.5-1.9 1.7 0 3.2.6 4.5 1.9" fill="none"/>`,
      ward:`<path d="M16 5 25 10v12l-9 5-9-5V10Z" fill="none"/><path d="M16 8v14" fill="none"/><path d="M11.5 14h9" fill="none"/><path d="M12.5 20c1.2-1.2 2.4-1.8 3.5-1.8s2.3.6 3.5 1.8" fill="none"/>`,
      return:`<circle cx="16" cy="16" r="9.5" fill="none"/><path d="M10 16c0-3.5 2.8-6.3 6.3-6.3 2.2 0 4.2 1.1 5.3 2.9" fill="none"/><path d="M19.8 9.6h3.9v3.9" fill="none"/><path d="M22.6 17.5c-.7 3.2-3.6 5.6-7 5.6-2.3 0-4.4-1.1-5.8-2.8" fill="none"/>`,
      break:`<path d="M16 4 26 16 16 28 6 16Z" fill="none"/><path d="M11 16h10M16 11v10" fill="none"/>`,
      gate:`<path d="M9 6h14v20H9z" fill="none"/><path d="M13 10h6v12h-6z" fill="none"/><path d="M16 10v12" fill="none"/>`,
      pulse:`<path d="M6 17h5l2-5 4 10 2-5h7" fill="none"/><circle cx="16" cy="16" r="10" fill="none"/>`,
      wing:`<path d="M8 22c5-1 8-5.2 8-12-5.1 1.2-8 4.7-8 12Zm16 0c-5-1-8-5.2-8-12 5.1 1.2 8 4.7 8 12Z" fill="none"/><path d="M16 10v14" fill="none"/>`,
      atlas:`<circle cx="16" cy="16" r="10" fill="none"/><path d="M16 6c2.7 2.5 4 5.9 4 10s-1.3 7.5-4 10M16 6c-2.7 2.5-4 5.9-4 10s1.3 7.5 4 10M6 16h20M8.5 10.5h15M8.5 21.5h15" fill="none"/>`,
      focus:`<circle cx="16" cy="16" r="10" fill="none"/><path d="M16 8v5M16 19v5M8 16h5M19 16h5" fill="none"/><circle cx="16" cy="16" r="3"/>`,
      shadow:`<path d="M16 5 25 10v12l-9 5-9-5V10Z" fill="none"/><circle cx="16" cy="16" r="3.5"/><path d="M16 8v5" fill="none"/>`,
      state:`<circle cx="16" cy="16" r="9.5" fill="none"/><circle cx="16" cy="16" r="3.5"/><path d="M16 6v4M16 22v4M6 16h4M22 16h4" fill="none"/>`,
      depth:`<path d="M7 11c2.2-2.2 4.8-3.3 7.8-3.3s5.6 1.1 7.8 3.3M9 16c1.8-1.6 3.8-2.4 6-2.4 2.4 0 4.6.8 6.5 2.4M11 21c1.4-1 2.8-1.5 4.3-1.5 1.7 0 3.2.5 4.8 1.5" fill="none"/><circle cx="16" cy="23.2" r="1.9"/>`,
      risk:`<path d="M16 6 26 24H6Z" fill="none"/><path d="M16 12v5" fill="none"/><circle cx="16" cy="21" r="1.6"/>`,
      sample:`<path d="M9 8h14v17H9z" fill="none"/><path d="M12 5h8v5h-8zM12 14h8M12 18h8M12 22h5" fill="none"/>`,
      dedup:`<circle cx="12" cy="16" r="6.5" fill="none"/><circle cx="20" cy="16" r="6.5" fill="none"/><path d="M13.5 16h5" fill="none"/>`,
      hit:`<circle cx="16" cy="16" r="10" fill="none"/><circle cx="16" cy="16" r="5" fill="none"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4" fill="none"/>`,
      notify:`<path d="M10 22h12M12 22v-8a4 4 0 0 1 8 0v8M14 25h4" fill="none"/><path d="M9 22h14" fill="none"/>`,
      explore:`<circle cx="16" cy="16" r="10" fill="none"/><path d="m19 11-2 6-6 2 2-6Z" fill="none"/>`,
      calibrate:`<path d="M6 16h20M16 6v20" fill="none"/><circle cx="16" cy="16" r="6" fill="none"/><circle cx="16" cy="16" r="2"/>`,
      node:`<circle cx="16" cy="16" r="9.5" fill="none"/><path d="M16 8v16" fill="none"/><path d="M11 12c1.2-1 2.9-1.6 5-1.6s3.8.6 5 1.6" fill="none"/>`,
      'node-on':`<circle cx="16" cy="16" r="9.5" fill="none"/><path d="M11 16l3.3 3.4L21.8 12" fill="none"/>`,
      verify:`<path d="M7 17l6 6L26 9" fill="none"/><path d="M24 16v9H7V8h11" fill="none"/>`,
      stable:`<path d="M7 23h18M9 20l4-8 4 5 3-9 3 12" fill="none"/>`,
      journal:`<path d="M8 6h14a3 3 0 0 1 3 3v17H11a3 3 0 0 1-3-3Z" fill="none"/><path d="M11 9h11M11 14h9M11 19h7" fill="none"/>`,
      history:`<circle cx="16" cy="16" r="10" fill="none"/><path d="M16 9v7l5 3M7 9H3V5" fill="none"/><path d="M5 7a13 13 0 0 1 8-4" fill="none"/>`,
      achievement:`<path d="M10 5h12v8a6 6 0 0 1-12 0Z" fill="none"/><path d="M10 8H6v2a5 5 0 0 0 5 5M22 8h4v2a5 5 0 0 1-5 5M16 19v5M11 27h10" fill="none"/>`,
      codex:`<path d="M7 7h9v19H7zM16 7h9v19h-9" fill="none"/><path d="M10 11h4M18 11h4M10 15h4M18 15h4" fill="none"/>`,
      intel:`<circle cx="14" cy="14" r="7" fill="none"/><path d="m19 19 7 7M11 14h6M14 11v6" fill="none"/>`,
      level:`<path d="M16 4 26 10v12l-10 6L6 22V10Z" fill="none"/><path d="M16 8l3 6 6 2-6 2-3 6-3-6-6-2 6-2Z" fill="none"/><circle cx="16" cy="16" r="2.5"/>`,
      zenith:`<circle cx="16" cy="16" r="11" fill="none"/><path d="M16 4l2.4 6.6L25 13l-6.6 2.4L16 22l-2.4-6.6L7 13l6.6-2.4Z" fill="none"/><path d="M10 22c1.8-1 3.8-1.5 6-1.5s4.2.5 6 1.5" fill="none"/><circle cx="16" cy="13" r="1.9"/>`
    };
    const body=icons[type]||icons.crest;
    return wrap(type,`${ring}${body}${spark}${crown}`);
  }
  function iconGradeFromProgress(ratio){return Math.max(1,Math.min(5,1+Math.floor(clamp(ratio)/25)))}
  function levelArtGrade(level){return Math.max(1,Math.min(5,1+Math.floor((Math.max(1,Number(level)||1)-1)/2)))}
  function glyph(type,grade=1,label=''){return `<span class="sg-ui-glyph sg-ui-glyph-${esc(type)} sg-ui-grade-${grade}" aria-hidden="true">${sigilSvg(type,grade)}</span>${label?`<span>${esc(label)}</span>`:''}`}


  function coreEmblem(m){
    const grade=levelArtGrade(m.level.level),step=iconGradeFromProgress(m.level.ratio),current=stageIconByIndex(m.stage.index);
    const stageTrack=['explore','ward','verify','stable'];
    const steps=stageTrack.map((icon,i)=>`<i class="${i<=m.stage.index?'on':''}">${sigilSvg(icon,i<=m.stage.index?Math.min(5,grade+1):1)}</i>`).join('');
    return `<aside class="sg-core-emblem sg-phase-${m.stage.index} sg-emblem-grade-${grade} sg-emblem-step-${step}" aria-hidden="true"><div class="sg-emblem-frame"><div class="sg-emblem-art">${sigilSvg(current,Math.min(5,grade+1))}</div><div class="sg-emblem-copy"><small>RESEARCH CREST</small><b>${esc(m.stage.name)}</b><span>${esc(m.personality)}</span></div></div><div class="sg-emblem-meta"><span>LV ${m.level.level}</span><span>${num(m.xp.effective)} SAMPLE</span></div><div class="sg-emblem-steps">${steps}</div></aside>`;
  }
  function systemLevelCrest(level,stageIndex=0){
    const grade=levelArtGrade(level.level),step=iconGradeFromProgress(level.ratio),icon='zenith';
    return `<span class="sg-level-crest-mini sg-level-mark sg-emblem-grade-${grade} sg-emblem-step-${step}" aria-hidden="true">${sigilSvg(icon,Math.min(5,grade+1))}<i>${Array.from({length:5},(_,i)=>`<b class="${i<step?'on':''}"></b>`).join('')}</i></span>`;
  }


  function skillCard(iconType,name,desc,count,meta=''){
    const s=skillLevel(count),step=iconGradeFromProgress(s.ratio),levelGrade=levelArtGrade(s.lv);
    const pips=Array.from({length:5},(_,i)=>`<i class="${i<step?'on':''}"></i>`).join('');
    return `<article class="sg-skill sg-skill-level-${s.lv} sg-skill-grade-${levelGrade} sg-skill-step-${step}"><div class="sg-skill-rank">${esc(s.rank)}</div><div class="sg-skill-head"><span class="sg-skill-icon">${sigilSvg(iconType,levelGrade)}<span class="sg-skill-pips">${pips}</span></span><div><b>${esc(name)}</b><small>Lv.${s.lv}</small></div></div><p>${esc(desc)}</p><div class="sg-skill-bar"><i style="width:${s.ratio}%"></i></div><div class="sg-skill-foot"><span>${num(s.current)} / ${num(s.next)}</span><em>${esc(meta||'研究經驗')}</em></div><div class="sg-skill-next">NEXT · ${num(Math.max(0,s.next-s.current))}</div></article>`;
  }
  function achievement(label,desc,done,current,target,hidden=false){
    const ratio=target?clamp(Number(current||0)/target*100):(done?100:0);return `<div class="sg-ach ${done?'unlocked':'locked'}"><div class="sg-ach-medal">${done?'◆':hidden?'?':'◇'}</div><div class="sg-ach-copy"><b>${hidden&&!done?'隱藏成就':esc(label)}</b><span>${hidden&&!done?'條件達成時才會揭露':esc(desc)}</span><div class="sg-ach-progress"><i style="width:${ratio}%"></i></div><small>${done?'已解鎖':`${num(current)} / ${num(target)}`}</small></div></div>`;
  }

  function candidateRows(rows){
    const score=x=>({HIGH:4,NORMAL:3,VALID:2,BLOCKED:1})[String(x.notificationTier||'VALID').toUpperCase()]||0;
    return [...(rows||[])].filter(x=>!['DROPPED','EXPIRED'].includes(String(x.status||''))).sort((a,b)=>score(b)-score(a)||Number(b.observationProgress||0)-Number(a.observationProgress||0)||Number(a.observationRank||999)-Number(b.observationRank||999)).slice(0,4)
  }
  function reasonsDone(x){
    const out=[];if(Number(x.observationProgress||0)>=60)out.push('策略完成度已進入中後段');if(Number(x.dataHealth?.coverage||x.notificationGate?.coverage||0)>=80)out.push('資料覆蓋度足夠');if(x.marketRegime)out.push(`市場狀態：${x.marketRegime}`);if(x.strategyAtConfirm?.label||x.strategyProfile?.label)out.push(`主策略：${x.strategyAtConfirm?.label||x.strategyProfile?.label}`);return out.slice(0,4)
  }
  function candidateHtml(rows){
    const list=candidateRows(rows);if(!list.length)return'<div class="sg-empty">目前無觀察候選</div>';
    return list.map((x,i)=>{const tier=String(x.notificationTier||'VALID').toUpperCase(),progress=Math.round(clamp(x.observationProgress||x.strategyProfile?.progress||0)),miss=(x.notificationGate?.normalMissing||x.notificationGate?.blockers||[]).slice(0,4),strategy=x.strategyAtConfirm?.label||x.strategyProfile?.label||x.lastCheck?.strategyLabel||'多策略觀察',done=reasonsDone(x),rate=has(x.calibratedWinRate)?`${Number(x.calibratedWinRate).toFixed(1)}%`:'—',score=has(x.notificationGate?.score)?Number(x.notificationGate.score).toFixed(0):'—',sgType=candidateIconType(x);return `<details class="sg-candidate-card dir-${x.direction==='SHORT'?'short':'long'} tier-${tier.toLowerCase()}" data-sg-candidate data-sg-detail-key="candidate:${esc(x.symbol)}:${esc(x.direction)}" ${i===0?'data-featured="1"':''}><summary><div class="sg-candidate-main"><i class="sg-candidate-glyph">${sigilSvg(sgType,iconGradeFromProgress(progress))}</i><b>${esc(x.symbol)}</b><span class="${x.direction==='SHORT'?'short':'long'}">${x.direction==='SHORT'?'做空':'做多'}</span><em class="${tier.toLowerCase()}">${esc(tier)}</em></div><div class="sg-candidate-bar"><i style="width:${progress}%"></i></div><div class="sg-candidate-meta"><span>${progress}% · ${esc(strategy)}</span><small>${miss.length?esc(miss.slice(0,2).join('、')):'條件完整度持續更新'}</small></div><i class="sg-chevron">⌄</i></summary><div class="sg-candidate-detail"><div class="sg-detail-grid"><div><span>校準</span><b>${rate}</b></div><div><span>評分</span><b>${score}</b></div><div><span>Regime</span><b>${esc(x.marketRegime||'未分類')}</b><small>${esc(x.freshness?.state||'')}</small></div></div><div class="sg-why"><div><span>已成立</span>${done.length?`<ul>${done.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>尚在前段</p>'}</div><div><span>待確認</span>${miss.length?`<ul>${miss.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>暫無明顯缺口</p>'}</div></div></div></details>`}).join('')
  }

  function lessonFor(m){
    const sh=m.sh||{}, nextStageMap=['校準','驗證','穩定','深化','專精'];
    const nextStageName=nextStageMap[Math.min(m.stage.index+1,nextStageMap.length-1)]||'深化';
    const nextStageNeed=Math.max(0,Number(m.stage.to||0)-Number(m.xp.effective||0));
    const nextLevelNeed=Math.max(0,Number(m.level.need||0)-Number(m.level.current||0));
    const blockerText=m.blockerTop?.length?m.blockerTop.slice(0,2).map(([k,v])=>`${k} × ${v}`).join('、'):'暫時沒有明顯集中阻礙';
    const readyCount=Number(m.tierCounts?.HIGH||0)+Number(m.tierCounts?.NORMAL||0);
    const phaseLine=nextStageNeed>0
      ? `再累積 ${num(nextStageNeed)} 筆去相關有效樣本，就會從「${m.stage.name}」往「${nextStageName}」推進。`
      : `目前已接近下一階段，可開始觀察是否具備跨狀態穩定性。`;
    const pfLine=has(sh.profitFactor)
      ? (Number(sh.profitFactor)>=1
          ? `PF ${pf(sh.profitFactor)}，代表獲利結構已不算差，但還需要更多新樣本證明不是短期運氣。`
          : `PF ${pf(sh.profitFactor)}，目前總獲利還沒蓋過總虧損，系統還在修正哪些條件該留、哪些該擋。`)
      : 'PF 尚未成形，現在先以樣本品質與去相關累積為主。';
    return {
      tag:'影子學習報告',
      title:`目前在${m.stage.name}階段，下一站是${nextStageName}`,
      lead:`影子樣本 ${num(sh.sample||0)} 筆，去相關有效 ${num(m.xp.effective||0)} 筆，影子命中 ${pct(sh.hitRate,1)}，${pfLine}`,
      focus: phaseLine,
      points:[
        `目前狀況：真正送達通知 ${num(m.sum?.sample||0)} 筆，通知級樣本 ${readyCount} 筆，系統型態偏向「${m.personality}」。`,
        `預計進步：距離下一等級還差 ${num(nextLevelNeed)} XP；若去相關樣本持續增加，會先強化「${m.stage.name}」的可信度，再往「${nextStageName}」走。`,
        `主要阻礙：${blockerText}。這些條件代表系統最常卡住的地方，也是現在最需要觀察的瓶頸。`,
        `正在克服：持續用 BLOCKED 與已通知樣本對照，清掉重複行情干擾，並讓 HIGH / NORMAL / BLOCKED 的差異逐步拉開。`
      ]
    };
  }
  function lessonHtml(m){const l=lessonFor(m);return `<details class="sg-lesson" data-sg-lesson data-sg-detail-key="lesson"><summary><div><span>${esc(l.tag)}</span><b>${esc(l.title)}</b><small>${esc(l.lead)}</small></div><i>展開</i></summary><div class="sg-lesson-body"><div class="sg-lesson-current"><span>目前重點</span><b>${esc(l.focus)}</b></div><ol>${l.points.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div></details>`}

  function explorationHtml(){
    const ex=getExplore(),done=['lesson','candidate','journal'].filter(k=>ex[k]).length;return `<section class="sg-explore" data-sg-explore><div class="sg-explore-head"><div><span>今日章節</span><b data-sg-explore-count>${done} / 3</b></div><small data-sg-explore-note>${done===3?'COMPLETE':'RESEARCH PATH'}</small></div><div class="sg-explore-grid sg-questline"><button type="button" data-sg-jump="lesson" class="${ex.lesson?'done':''}"><i>${sigilSvg(ex.lesson?'verify':'explore',ex.lesson?3:1)}</i><span>解析</span></button><button type="button" data-sg-jump="candidate" class="${ex.candidate?'done':''}"><i>${sigilSvg(ex.candidate?'verify':'calibrate',ex.candidate?3:1)}</i><span>候選</span></button><button type="button" data-sg-jump="journal" class="${ex.journal?'done':''}"><i>${sigilSvg(ex.journal?'verify':'journal',ex.journal?3:1)}</i><span>日誌</span></button></div></section>`;
  }

  function celebrateProgress(m,skillCounts){
    const snap={level:m.level.level,stage:m.stage.index,skills:skillCounts.map(v=>skillLevel(v).lv)};
    const prev=storageGet(PROGRESS_KEY,null);storageSet(PROGRESS_KEY,snap);if(!prev)return;
    if(snap.level>Number(prev.level||0)){showToast(`SYSTEM 升階 · Lv.${snap.level}`);return}
    if(snap.stage>Number(prev.stage||0)){showToast(`PHASE UP · ${m.stage.name}`);return}
    const names=['回踩獵手','破局之眼','影子研究','狀態學習','流動性雷達','危機預警'];
    for(let i=0;i<snap.skills.length;i++)if(snap.skills[i]>Number(prev.skills?.[i]||0)){showToast(`${names[i]} · Lv.${snap.skills[i]}`);return}
  }

  function render(){
    const panel=rootDoc.getElementById('sgPanel');if(!panel||!state.perf)return;captureDetailsState(panel);const m=getMetrics(),sh=m.sh,sum=m.sum,patterns=m.patterns,rows=m.rows;
    if(!getDayBase())setDayBase({xp:m.xp.xp,effective:m.xp.effective,blocked:m.xp.blocked,notified:m.xp.notified,at:Date.now()});
    const base=getDayBase()||{xp:m.xp.xp,effective:m.xp.effective,blocked:m.xp.blocked,notified:m.xp.notified},dx=Math.max(0,m.xp.xp-Number(base.xp||0)),de=Math.max(0,m.xp.effective-Number(base.effective||0)),db=Math.max(0,m.xp.blocked-Number(base.blocked||0)),dn=Math.max(0,m.xp.notified-Number(base.notified||0));
    const skillReturn=strategyPatternCount(patterns,'回踩'),skillBreak=strategyPatternCount(patterns,'突破'),depthResearch=Math.max(0,patterns.filter(x=>String(x?.features?.depth||'—')!=='—').reduce((a,x)=>a+Number(x.sample||0),0)),stateResearch=patterns.reduce((a,x)=>a+Number(x.sample||0),0),level=m.level,stagePct=clamp((m.xp.effective-m.stage.from)/Math.max(1,m.stage.to-m.stage.from)*100),history=recordHistory(m),visits=recentVisitCount(7);
    const personalitySub=m.best?`偏好：${esc(m.best.features?.strategyLabel||'多策略')} / ${esc(({TREND_UP:'強多',TREND_DOWN:'強空',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算'})[m.best.features?.regime]||m.best.features?.regime||'跨狀態')}`:'尚在建立偏好';
    const badge=rootDoc.getElementById('sgBrandLevel');if(badge)badge.innerHTML=`<span class="sg-lv-prefix">Lv.</span><span class="sg-lv-num">${level.level}</span>`;
    panel.innerHTML=`
      <div class="sg-panel-topline"><span><i class="sg-mini-sigil">${sigilSvg('crest',2)}</i> 成長核心 · V${VERSION}</span><div><b>${m.stage.name}</b><em>${formatAge(state.perf.generatedAt||state.signals?.generatedAt)}</em></div></div>
      <div class="sg-hero">
        <section class="sg-core-card">
          <div class="sg-kicker"><span class="sg-status-dot"></span>研究中 <em>近 7 日 ${visits}D</em></div>
          <div class="sg-core-intro">
            <div class="sg-core-main">
              <div class="sg-level-row"><div><small>SYSTEM</small><div class="sg-level-line"><strong class="sg-level-badge"><span class="sg-lv-prefix">Lv.</span><span class="sg-lv-num">${level.level}</span></strong>${systemLevelCrest(level,m.stage.index)}</div></div><div class="sg-personality"><span>系統型態</span><b>${esc(m.personality)}</b><small>${personalitySub}</small></div></div>
              <div class="sg-xp-row"><div><b>${num(level.current)} / ${num(level.need)} XP</b><span>${dx>0?`今日 +${num(dx)} XP`:'今日持續研究'}</span></div><small>總研究經驗 ${num(level.total)} XP</small></div><div class="sg-xp"><i style="width:${level.ratio}%"></i></div>
            </div>
            ${coreEmblem(m)}
          </div>
          <div class="sg-stage"><div><span>研究階段 · ${esc(m.stage.name)}</span><b>${m.xp.effective} / ${m.stage.to} 去相關樣本</b></div><div class="sg-stage-bar"><i style="width:${stagePct}%"></i></div><p>${esc(m.stage.desc)}</p>${stagePath(m)}</div>
          <div class="sg-today-growth"><div><span>今日有效樣本</span><b>+${de}</b></div><div><span>今日淘汰研究</span><b>+${db}</b></div><div><span>今日通知樣本</span><b>+${dn}</b></div></div>
        </section>
        <section class="sg-radar-card"><div class="sg-card-title"><b>六維屬性</b><span>研究成熟度 · 非勝率</span></div>${radarSvg(m.attrs)}<div class="sg-radar-hint">成熟度 · 非勝率</div></section>
      </div>
      <div class="sg-quick"><div><span class="sg-quick-title">${glyph('sample',iconGradeFromProgress(clamp((Number(sh.sample||0)/150)*100)),'影子樣本')}</span><b>${num(sh.sample||0)}</b><small>已結算 ${num(sh.resolved||0)}</small></div><div><span class="sg-quick-title">${glyph('dedup',iconGradeFromProgress(clamp((Number(sh.learningEffectiveResolved||0)/100)*100)),'去相關有效')}</span><b>${num(sh.learningEffectiveResolved||0)}</b><small>${num(sh.learningDedupMinutes||45)} 分去相關</small></div><div><span class="sg-quick-title">${glyph('hit',iconGradeFromProgress(clamp(Number(sh.hitRate||0))),'影子命中')}</span><b>${pct(sh.hitRate,1)}</b><small>PF ${pf(sh.profitFactor)}</small></div><div><span class="sg-quick-title">${glyph('notify',iconGradeFromProgress(clamp((Number(sum.sample||0)/30)*100)),'真正通知')}</span><b>${num(sum.sample||0)}</b><small>${m.tierCounts.HIGH} HIGH · ${m.tierCounts.NORMAL} NORMAL</small></div></div>
      ${explorationHtml()}
      <section id="sgLessonSection">${lessonHtml(m)}</section>
      <section class="sg-live" id="sgCandidateSection"><div class="sg-section-head"><div><b>正在發生</b><span>LIVE RESEARCH</span></div><span>${rows.length} 個觀察狀態</span></div>${candidateHtml(rows)}</section>
      <div class="sg-accordions">
        <details class="sg-accordion" data-sg-detail-key="skill-tree" open><summary><i class="sg-acc-icon">${sigilSvg('state',2)}</i><div><b>技能樹</b><span>SKILL BOARD</span></div><em>6 PATHS</em></summary><div class="sg-detail-body"><div class="sg-skills sg-skill-tree">
          ${skillCard('return','回踩獵手','辨識順勢回踩是否值得等，專看不同 Regime 的回踩勝率與延續性',skillReturn,'回踩模式樣本')}${skillCard('break','破局之眼','研究突破後的回測是否站穩，避免追到假突破或事件沖高回落',skillBreak,'突破模式樣本')}${skillCard('shadow','影子研究','把沒通知的樣本也納入研究，避免只記得贏單，降低主觀偏誤',m.xp.effective,'去相關有效樣本')}${skillCard('state','狀態學習','比較策略 × Regime × 資金 × 深度的組合，找出長期更有優勢的局',stateResearch,'模式有效樣本')}${skillCard('depth','流動性雷達','觀察掛單厚度、價差與流動性，避開容易滑價或被掃的區域',depthResearch,'Depth 模式樣本')}${skillCard('risk','危機預警','累積被擋樣本與反證訊號，提醒哪些情況看起來漂亮其實不該出手',m.xp.blocked,'被擋樣本')}
        </div></div></details>
        <details class="sg-accordion" id="sgJournal" data-sg-detail-key="journal"><summary><i class="sg-acc-icon">${sigilSvg('journal',2)}</i><div><b>模型日誌</b><span>MODEL LOG</span></div><em>${patterns.length} ACTIVE</em></summary><div class="sg-detail-body"><div class="sg-journal-grid"><div class="good"><span>目前最強模式</span><b>${esc(patternText(m.best))}</b></div><div class="bad"><span>目前最弱模式</span><b>${esc(patternText(m.worst))}</b></div></div><div class="sg-journal-note"><span>目前最常阻擋</span><div>${m.blockerTop.length?m.blockerTop.map(([k,v])=>`<i>${esc(k)} <b>${v}</b></i>`).join(''):'<i>暫無集中風險</i>'}</div></div><div class="sg-journal-note"><span>今日狀態</span><b>${m.tierCounts.HIGH+m.tierCounts.NORMAL>0?`READY · ${m.tierCounts.HIGH+m.tierCounts.NORMAL} 通知級`:'WAIT'}</b></div></div></details>
        <details class="sg-accordion" data-sg-detail-key="history"><summary><i class="sg-acc-icon">${sigilSvg('history',2)}</i><div><b>研究足跡</b><span>TRACE LOG</span></div><em>7D</em></summary><div class="sg-detail-body"><div class="sg-history-card">${historySvg(history)}</div></div></details>
        <details class="sg-accordion" data-sg-detail-key="milestones"><summary><i class="sg-acc-icon">${sigilSvg('achievement',2)}</i><div><b>成就與里程碑</b><span>MILESTONES</span></div><em>${m.xp.effective>=20?'進階已開':'20 SAMPLE'}</em></summary><div class="sg-detail-body"><div class="sg-ach-grid">${achievement('研究啟動','完成第一個去相關有效樣本',m.xp.effective>=1,m.xp.effective,1)}${achievement('乾淨樣本','累積 20 個可真正影響學習的去相關樣本',m.xp.effective>=20,m.xp.effective,20)}${achievement('鐵面守門員','累積研究 50 個被風險閘門擋下的候選',m.xp.blocked>=50,m.xp.blocked,50)}${achievement('狀態覺醒','第一個同狀態模式達到學習門檻並開始調權',patterns.length>=1,patterns.length,1)}${achievement('模型驗收 I','累積 50 個去相關有效樣本',m.xp.effective>=50,m.xp.effective,50)}${achievement('真正校準','累積 20 個真正送達通知並完成追蹤的樣本',m.xp.notified>=20,m.xp.notified,20)}${achievement('穩定專精','單一模式至少 50 筆、PF ≥ 1.30',patterns.some(x=>Number(x.sample||0)>=50&&Number(x.profitFactor||0)>=1.3),Math.max(0,...patterns.map(x=>Number(x.sample||0))),50,true)}</div></div></details>
        <details class="sg-accordion" data-sg-detail-key="codex"><summary><i class="sg-acc-icon">${sigilSvg('codex',2)}</i><div><b>研究手冊</b><span>CODEX</span></div><em>4 FILES</em></summary><div class="sg-detail-body"><div class="sg-manual"><details data-sg-detail-key="codex-dedup"><summary>45 分去相關，到底在防什麼？</summary><p>同一段行情會長出很多長得很像的訊號。全部算進去會灌水，所以系統把太近的樣本視為同群，讓去相關有效樣本更接近真正研究量。</p></details><details data-sg-detail-key="codex-pf"><summary>PF 為什麼比勝率更重要？</summary><p>PF = 總獲利 ÷ 總虧損。勝率不是全部；只要賺賠比夠好，PF 一樣能贏。</p></details><details data-sg-detail-key="codex-mfe"><summary>MFE / MAE 是什麼？</summary><p>MFE 看最多順著你跑多遠；MAE 看最多逆著你跑多深。拿來修 TP / SL 很實用。</p></details><details data-sg-detail-key="codex-state"><summary>狀態學習是在學什麼？</summary><p>不是學哪顆幣一定漲，而是比較策略、方向、Regime、OI、Taker、Depth 的組合，哪些長期更強。</p></details></div></div></details>
        <details class="sg-accordion" data-sg-detail-key="intel"><summary><i class="sg-acc-icon">${sigilSvg('intel',2)}</i><div><b>情報檔案</b><span>INTEL</span></div><em>AI · 2H</em></summary><div class="sg-detail-body"><div class="sg-intel-note">手動查詢 / 2 小時快取 / 可能產生 API 費用</div><div id="sgIntelList" class="sg-intel-list">${intelListHtml(rows)}</div></div></details>
        <details class="sg-accordion" data-sg-detail-key="formula"><summary><i class="sg-acc-icon">${sigilSvg('stable',2)}</i><div><b>成長規則</b><span>FORMULA</span></div><em>XP</em></summary><div class="sg-detail-body"><div class="sg-rules"><div><b>+35 XP</b><span>每個去相關有效樣本</span></div><div><b>+8 XP</b><span>每個可學習已結算樣本</span></div><div><b>+2 XP</b><span>每個被擋候選的研究紀錄</span></div><div><b>+50 XP</b><span>每個真正通知樣本</span></div><div><b>+120 XP</b><span>每個達門檻、真正啟動的狀態模式</span></div></div><p class="sg-rule-note">章節進度只記錄瀏覽，不計入模型 XP。</p></div></details>
      </div><div class="sg-footer"><i>◇</i><b>Observe · Filter · Upgrade</b><i>◇</i></div>`;
    bindPanelEvents(panel);
    restoreDetailsState(panel);
    celebrateProgress(m,[skillReturn,skillBreak,m.xp.effective,stateResearch,depthResearch,m.xp.blocked]);
  }

  function intelListHtml(rows){const list=candidateRows(rows).slice(0,3);if(!list.length)return'<div class="sg-empty">目前沒有候選情報檔案。</div>';return list.map(x=>`<article class="sg-intel" data-sg-intel="${esc(x.symbol)}:${esc(x.direction)}"><div class="sg-intel-head"><div><b>${esc(x.symbol)}</b><span>${x.direction==='SHORT'?'做空':'做多'} · ${esc(x.strategyAtConfirm?.label||x.strategyProfile?.label||'多策略')}</span></div><button type="button" class="sg-intel-btn" data-sg-intel-btn data-symbol="${esc(x.symbol)}" data-direction="${esc(x.direction)}">查最新情報</button></div><div class="sg-intel-body" data-sg-intel-body>尚未查詢</div></article>`).join('')}
  function bindPanelEvents(panel){
    const keepAlive=()=>markInteraction(180000);
    panel.addEventListener('pointerdown',keepAlive,{passive:true});
    panel.addEventListener('touchstart',keepAlive,{passive:true});
    panel.addEventListener('focusin',keepAlive);
    panel.addEventListener('mouseenter',keepAlive,{passive:true});
    panel.addEventListener('scroll',keepAlive,{passive:true,capture:true});
    panel.querySelectorAll('details').forEach(el=>{
      el.addEventListener('toggle',()=>{keepAlive();captureDetailsState(panel)});
      const summary=el.querySelector(':scope > summary');
      if(summary)summary.addEventListener('click',()=>setTimeout(()=>{keepAlive();captureDetailsState(panel)},0));
    });
    panel.querySelectorAll('[data-sg-intel-btn]').forEach(btn=>btn.addEventListener('click',()=>loadIntel(btn)));
    panel.querySelector('[data-sg-lesson]')?.addEventListener('toggle',e=>{if(e.currentTarget.open)markExplore('lesson')});
    panel.querySelectorAll('[data-sg-candidate]').forEach(el=>el.addEventListener('toggle',e=>{if(e.currentTarget.open)markExplore('candidate')}));
    panel.querySelector('#sgJournal')?.addEventListener('toggle',e=>{if(e.currentTarget.open)markExplore('journal')});
    panel.querySelectorAll('[data-sg-jump]').forEach(btn=>btn.addEventListener('click',()=>jumpTo(btn.dataset.sgJump)));
  }
  function jumpTo(key){
    markInteraction(180000);
    const map={lesson:'#sgLessonSection .sg-lesson',candidate:'#sgCandidateSection .sg-candidate-card',journal:'#sgJournal'},el=rootDoc.querySelector(map[key]);if(!el)return;
    if(el.tagName==='DETAILS')el.open=true;el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  }
  async function loadIntel(btn){
    const symbol=btn.dataset.symbol||'',direction=btn.dataset.direction||'LONG',key=`${symbol}:${direction}`,box=btn.closest('.sg-intel')?.querySelector('[data-sg-intel-body]');if(!box)return;
    const cached=state.intel.get(key);if(cached&&Date.now()-cached.at<2*60*60*1000){box.innerHTML=intelBody(cached.data,true);return}
    btn.disabled=true;btn.textContent='搜尋中…';box.innerHTML='<div class="sg-intel-loading">同步最新情報…</div>';
    try{const r=await fetch(`/api/symbol-analysis?symbol=${encodeURIComponent(symbol)}&direction=${encodeURIComponent(direction)}`,{cache:'no-store'}),d=await r.json();if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);state.intel.set(key,{at:Date.now(),data:d});box.innerHTML=intelBody(d,false)}catch(e){box.innerHTML=`<div class="sg-intel-loading">情報離線 · ${esc(e?.message||'未知錯誤')}</div>`}finally{btn.disabled=false;btn.textContent='查最新情報'}
  }
  function intelBody(d,cached){
    const good=(d.bullish||[]).slice(0,3),bad=(d.bearish||[]).slice(0,3),watch=(d.watch||[]).slice(0,3),news=(d.news||[]).slice(0,3);
    return `<div class="sg-intel-summary"><span>${esc(d.bias||'中性')} · ${esc(d.strength||'—')}</span><b>${esc(d.summary||d.action||'暫無摘要')}</b><small>${cached?'使用 2 小時內快取':'剛剛更新'} · ${esc(d.mode||'市場資料')}</small></div><div class="sg-intel-cols"><div><span>利多</span>${good.length?`<ul>${good.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>未見明確額外利多</p>'}</div><div><span>利空</span>${bad.length?`<ul>${bad.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>未見明確額外利空</p>'}</div></div>${watch.length?`<div class="sg-intel-watch"><span>接下來看</span><ul>${watch.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}${news.length?`<div class="sg-intel-news"><span>今日消息</span>${news.map(x=>`<p><i>${esc(x.tone||'中性')}</i>${esc(x.text||'')}</p>`).join('')}</div>`:''}`
  }

  function updateScrollRail(){
    const rail=rootDoc.getElementById('sgScrollRail');if(!rail)return;
    const y=window.scrollY||rootDoc.documentElement.scrollTop||0,max=Math.max(0,rootDoc.documentElement.scrollHeight-window.innerHeight);
    rail.classList.toggle('visible',state.open&&max>window.innerHeight*.7);
    rail.querySelector('[data-sg-scroll="top"]')?.classList.toggle('dim',y<220);
    rail.querySelector('[data-sg-scroll="bottom"]')?.classList.toggle('dim',max-y<220);
  }
  function mountScrollRail(){
    if(rootDoc.getElementById('sgScrollRail'))return;
    const rail=rootDoc.createElement('div');rail.id='sgScrollRail';rail.className='sg-scroll-rail';rail.innerHTML='<button type="button" data-sg-scroll="top" aria-label="回到最上方">⌃</button><span></span><button type="button" data-sg-scroll="bottom" aria-label="前往最下方">⌄</button>';
    rail.addEventListener('click',e=>{const btn=e.target.closest('[data-sg-scroll]');if(!btn)return;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;window.scrollTo({top:btn.dataset.sgScroll==='top'?0:rootDoc.documentElement.scrollHeight,behavior:reduce?'auto':'smooth'})});
    rootDoc.body.appendChild(rail);
    let ticking=false;window.addEventListener('scroll',()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{updateScrollRail();ticking=false})},{passive:true});window.addEventListener('resize',updateScrollRail,{passive:true});
  }

  function showToast(text){const t=rootDoc.getElementById('sgToast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}
  async function getJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(`${path} ${r.status}`);return r.json()}
  async function loadData(force=false){
    if(state.loading)return;
    if(force&&state.open&&Date.now()<Number(state.interactUntil||0))return;
    if(!force&&state.perf&&Date.now()-state.lastLoadedAt<30_000){render();return}
    state.loading=true;setStatus('同步研究資料…');
    try{
      const [perf,signals]=await Promise.all([getJson('/api/performance'),getJson('/api/test-signals').catch(()=>null)]);
      const key=renderKeyFor(perf,signals);
      state.perf=perf;state.signals=signals;state.lastLoadedAt=Date.now();
      if(key!==state.renderKey){
        const y=window.scrollY||0;
        state.renderKey=key;render();
        requestAnimationFrame(()=>{if(Math.abs((window.scrollY||0)-y)>2)window.scrollTo({top:y,behavior:'auto'})});
      }
      setStatus('');
    }catch(e){setStatus(`養成資料暫時不可用 · ${e?.message||'未知錯誤'}`)}finally{state.loading=false}
  }
  function setStatus(text){const el=rootDoc.getElementById('sgLoading');if(el)el.textContent=text||''}
  function setOpen(open){
    state.open=!!open;const panel=rootDoc.getElementById('sgPanel'),btn=rootDoc.getElementById('sgBrandToggle');if(!panel||!btn)return;panel.hidden=!state.open;panel.classList.toggle('open',state.open);btn.classList.toggle('active',state.open);btn.setAttribute('aria-expanded',String(state.open));try{localStorage.setItem(OPEN_KEY,state.open?'1':'0')}catch{}
    if(state.open){markInteraction(INTERACT_HOLD_MS);updateVisits();void loadData(false);startTimer()}else stopTimer();updateScrollRail()
  }
  function startTimer(){stopTimer();state.timer=setInterval(()=>{if(state.open)void loadData(true)},60_000)}
  function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null}}
  function init(){
    if(rootDoc.getElementById('sgPanel'))return;const brand=rootDoc.querySelector('.brandTitle'),top=rootDoc.querySelector('.top');if(!brand||!top){setTimeout(init,180);return}
    brand.classList.add('sg-brand');const btn=rootDoc.createElement('button');btn.type='button';btn.id='sgBrandToggle';btn.className='sg-brand-toggle';btn.setAttribute('aria-expanded','false');btn.innerHTML=`<span>系統養成</span><em id="sgBrandLevel" class="sg-inline-lv"><span class="sg-lv-prefix">Lv.</span><span class="sg-lv-num">—</span></em>`;brand.appendChild(btn);
    const loading=rootDoc.createElement('div');loading.id='sgLoading';loading.className='sg-loading';loading.setAttribute('aria-live','polite');const panel=rootDoc.createElement('section');panel.id='sgPanel';panel.className='sg-panel';panel.hidden=true;panel.setAttribute('aria-label','系統養成');panel.innerHTML='<div class="sg-skeleton">讀取養成資料中…</div>';
    const toast=rootDoc.createElement('div');toast.id='sgToast';toast.className='sg-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');rootDoc.body.appendChild(toast);mountScrollRail();
    top.insertAdjacentElement('afterend',loading);loading.insertAdjacentElement('afterend',panel);btn.addEventListener('click',()=>setOpen(!state.open));window.addEventListener('beforeunload',()=>captureDetailsState(panel));document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='hidden')return;captureDetailsState(panel)});let initial=false;try{const v=localStorage.getItem(OPEN_KEY);initial=v===null?true:v==='1'}catch{initial=true}setOpen(initial);
  }
  if(rootDoc.readyState==='loading')rootDoc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
