(()=>{
  'use strict';
  const VERSION='1.3.0';
  const OPEN_KEY='sg-open-v1';
  const SNAP_PREFIX='sg-day-v1-';
  const HISTORY_KEY='sg-history-v1';
  const PROGRESS_KEY='sg-progress-v13';
  const VISIT_KEY='sg-visits-v1';
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
  const state={open:false,loading:false,perf:null,signals:null,lastLoadedAt:0,intel:new Map(),timer:null,toastTimer:null};

  function safeParse(raw,fallback=null){try{return JSON.parse(raw)}catch{return fallback}}
  function storageGet(key,fallback=null){try{return safeParse(localStorage.getItem(key),fallback)}catch{return fallback}}
  function storageSet(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
  function getDayBase(){return storageGet(SNAP_PREFIX+todayKey(),null)}
  function setDayBase(v){try{if(!localStorage.getItem(SNAP_PREFIX+todayKey()))localStorage.setItem(SNAP_PREFIX+todayKey(),JSON.stringify(v))}catch{}}
  function getExplore(){return storageGet(EXPLORE_PREFIX+todayKey(),{lesson:false,candidate:false,journal:false})||{lesson:false,candidate:false,journal:false}}
  function markExplore(key){const ex=getExplore();if(ex[key])return;ex[key]=true;storageSet(EXPLORE_PREFIX+todayKey(),ex);showToast(`章節進度 +1 · ${key==='lesson'?'解析':key==='candidate'?'候選':'日誌'}`);updateExploreUi()}
  function updateExploreUi(){const ex=getExplore(),done=['lesson','candidate','journal'].filter(k=>ex[k]).length,box=rootDoc.querySelector('[data-sg-explore]');if(!box)return;const count=box.querySelector('[data-sg-explore-count]'),note=box.querySelector('[data-sg-explore-note]');if(count)count.textContent=`${done} / 3`;if(note)note.textContent=done===3?'COMPLETE':'RESEARCH PATH';box.querySelectorAll('[data-sg-jump]').forEach(btn=>{const k=btn.dataset.sgJump,ok=!!ex[k];btn.classList.toggle('done',ok);const i=btn.querySelector('i');if(i)i.textContent=ok?'◆':({lesson:'Ⅰ',candidate:'Ⅱ',journal:'Ⅲ'}[k]||'◇')})}
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
    n=Number(n||0);if(n<20)return {index:0,name:'探索期',from:0,to:20,desc:'先累積乾淨樣本，不急著相信任何漂亮結果。'};
    if(n<50)return {index:1,name:'校準期',from:20,to:50,desc:'開始看強弱分層，但仍以擴充樣本為主。'};
    if(n<100)return {index:2,name:'驗證期',from:50,to:100,desc:'檢查規律能不能在新行情裡繼續成立。'};
    if(n<300)return {index:3,name:'穩定期',from:100,to:300,desc:'開始重視跨市場狀態的穩定與回撤。'};
    return {index:4,name:'深化期',from:300,to:600,desc:'樣本夠大後，才值得談細分專精與模型重構。'};
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

  function stagePath(m){
    const stages=[['探索',20],['校準',50],['驗證',100],['穩定',300]],n=m.xp.effective;
    return `<div class="sg-stage-path">${stages.map(([label,cut],i)=>`<div class="sg-stage-node ${n>=cut?'done':n>=([0,20,50,100][i]||0)?'current':''}"><i>${n>=cut?'◆':i+1}</i><span>${label}</span><small>${cut}樣本</small></div>`).join('')}</div>`;
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

  function skillCard(icon,name,desc,count,meta=''){
    const s=skillLevel(count);return `<article class="sg-skill"><div class="sg-skill-rank">${esc(s.rank)}</div><div class="sg-skill-head"><span class="sg-skill-icon">${icon}</span><div><b>${esc(name)}</b><small>Lv.${s.lv}</small></div></div><p>${esc(desc)}</p><div class="sg-skill-bar"><i style="width:${s.ratio}%"></i></div><div class="sg-skill-foot"><span>${num(s.current)} / ${num(s.next)}</span><em>${esc(meta||'研究經驗')}</em></div><div class="sg-skill-next">NEXT · ${num(Math.max(0,s.next-s.current))}</div></article>`;
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
    return list.map((x,i)=>{const tier=String(x.notificationTier||'VALID').toUpperCase(),progress=Math.round(clamp(x.observationProgress||x.strategyProfile?.progress||0)),miss=(x.notificationGate?.normalMissing||x.notificationGate?.blockers||[]).slice(0,4),strategy=x.strategyAtConfirm?.label||x.strategyProfile?.label||x.lastCheck?.strategyLabel||'多策略觀察',done=reasonsDone(x),rate=has(x.calibratedWinRate)?`${Number(x.calibratedWinRate).toFixed(1)}%`:'—',score=has(x.notificationGate?.score)?Number(x.notificationGate.score).toFixed(0):'—';return `<details class="sg-candidate-card" data-sg-candidate ${i===0?'data-featured="1"':''}><summary><div class="sg-candidate-main"><b>${esc(x.symbol)}</b><span class="${x.direction==='SHORT'?'short':'long'}">${x.direction==='SHORT'?'做空':'做多'}</span><em class="${tier.toLowerCase()}">${esc(tier)}</em></div><div class="sg-candidate-bar"><i style="width:${progress}%"></i></div><div class="sg-candidate-meta"><span>${progress}% · ${esc(strategy)}</span><small>${miss.length?esc(miss.slice(0,2).join('、')):'條件完整度持續更新'}</small></div><i class="sg-chevron">⌄</i></summary><div class="sg-candidate-detail"><div class="sg-detail-grid"><div><span>校準</span><b>${rate}</b></div><div><span>評分</span><b>${score}</b></div><div><span>Regime</span><b>${esc(x.marketRegime||'未分類')}</b><small>${esc(x.freshness?.state||'')}</small></div></div><div class="sg-why"><div><span>已成立</span>${done.length?`<ul>${done.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>尚在前段</p>'}</div><div><span>待確認</span>${miss.length?`<ul>${miss.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:'<p>暫無明顯缺口</p>'}</div></div></div></details>`}).join('')
  }

  function lessonFor(m){
    const sh=m.sh,e=m.xp.effective;
    if(e<20)return {tag:'2 分鐘',title:'為什麼現在最重要的是樣本數？',lead:`目前只有 ${e} 個去相關有效樣本。這時候任何漂亮或難看的勝率，都很容易只是短期運氣。`,points:['先累積，暫時不要因幾筆輸贏改規則。','去相關後的樣本，比同一波行情重複十次更有價值。','到 20 / 50 / 100 筆，再逐步提高對統計的信任。'],focus:`下一個研究門檻：${Math.max(0,20-e)} 筆。`};
    if(has(sh.profitFactor)&&Number(sh.profitFactor)<1)return {tag:'2 分鐘',title:'PF < 1 到底代表什麼？',lead:`目前影子 PF ${pf(sh.profitFactor)}。意思是已結算樣本中，總獲利還沒蓋過總虧損。`,points:['PF 比單看勝率更接近「這套東西值不值得做」。','勝率高但每次小賺大賠，PF 仍可能很差。','現在的工作不是救數字，而是繼續讓篩選器接受考試。'],focus:'觀察 HIGH / NORMAL 是否逐步拉開和 BLOCKED 的差距。'};
    if(has(sh.hitRate)&&Number(sh.hitRate)<50&&Number(sh.profitFactor)>=1)return {tag:'2 分鐘',title:'勝率不到 50%，為什麼仍可能有優勢？',lead:`目前命中 ${pct(sh.hitRate,1)}、PF ${pf(sh.profitFactor)}。只要贏的平均幅度大於輸的，低於 50% 也可能是正期望。`,points:['勝率只是結果頻率，不是獲利大小。','真正要一起看：PF、期望 R、回撤。','不要為了追求 70% 勝率，把好 RR 犧牲掉。'],focus:'下一步看「策略表現」裡哪一類在拉高 PF。'};
    if(m.xp.blocked>=30)return {tag:'3 分鐘',title:'BLOCKED 為什麼不是垃圾資料？',lead:`系統已累積 ${m.xp.blocked} 個被擋研究樣本。這些是最重要的反證組之一。`,points:['如果 BLOCKED 後續普遍差，代表過濾器真的有價值。','如果 BLOCKED 常常大勝，就表示規則可能擋太多。','好模型不只研究「做了什麼」，也研究「沒做什麼」。'],focus:'打開模型日誌，看最常阻擋你的條件。'};
    return {tag:'3 分鐘',title:'怎麼知道「找到規律」不是過度擬合？',lead:`目前已有 ${m.patterns.length} 個啟動中的狀態模式。模式越多，不代表越強；要看新資料是否繼續支持。`,points:['先在舊資料找到模式，再用後續新樣本驗證。','不同 Regime 都能活下來，比單一行情神準更重要。','規則越細，越需要更多樣本才能相信。'],focus:'現在先看最強與最弱模式是否持續分化。'};
  }
  function lessonHtml(m){const l=lessonFor(m);return `<details class="sg-lesson" data-sg-lesson><summary><div><span>${esc(l.tag)} · 今日解析</span><b>${esc(l.title)}</b><small>${esc(l.lead)}</small></div><i>展開</i></summary><div class="sg-lesson-body"><div class="sg-lesson-current"><span>當前焦點</span><b>${esc(l.focus)}</b></div><ol>${l.points.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div></details>`}

  function explorationHtml(){
    const ex=getExplore(),done=['lesson','candidate','journal'].filter(k=>ex[k]).length;return `<section class="sg-explore" data-sg-explore><div class="sg-explore-head"><div><span>今日章節</span><b data-sg-explore-count>${done} / 3</b></div><small data-sg-explore-note>${done===3?'COMPLETE':'RESEARCH PATH'}</small></div><div class="sg-explore-grid sg-questline"><button type="button" data-sg-jump="lesson" class="${ex.lesson?'done':''}"><i>${ex.lesson?'◆':'Ⅰ'}</i><span>解析</span></button><button type="button" data-sg-jump="candidate" class="${ex.candidate?'done':''}"><i>${ex.candidate?'◆':'Ⅱ'}</i><span>候選</span></button><button type="button" data-sg-jump="journal" class="${ex.journal?'done':''}"><i>${ex.journal?'◆':'Ⅲ'}</i><span>日誌</span></button></div></section>`;
  }

  function celebrateProgress(m,skillCounts){
    const snap={level:m.level.level,stage:m.stage.index,skills:skillCounts.map(v=>skillLevel(v).lv)};
    const prev=storageGet(PROGRESS_KEY,null);storageSet(PROGRESS_KEY,snap);if(!prev)return;
    if(snap.level>Number(prev.level||0)){showToast(`SYSTEM 升階 · Lv.${snap.level}`);return}
    if(snap.stage>Number(prev.stage||0)){showToast(`研究階段解鎖 · ${m.stage.name}`);return}
    const names=['回踩獵手','破局之眼','影子研究','狀態學習','流動性雷達','危機預警'];
    for(let i=0;i<snap.skills.length;i++)if(snap.skills[i]>Number(prev.skills?.[i]||0)){showToast(`${names[i]} · Lv.${snap.skills[i]}`);return}
  }

  function render(){
    const panel=rootDoc.getElementById('sgPanel');if(!panel||!state.perf)return;const m=getMetrics(),sh=m.sh,sum=m.sum,patterns=m.patterns,rows=m.rows;
    if(!getDayBase())setDayBase({xp:m.xp.xp,effective:m.xp.effective,blocked:m.xp.blocked,notified:m.xp.notified,at:Date.now()});
    const base=getDayBase()||{xp:m.xp.xp,effective:m.xp.effective,blocked:m.xp.blocked,notified:m.xp.notified},dx=Math.max(0,m.xp.xp-Number(base.xp||0)),de=Math.max(0,m.xp.effective-Number(base.effective||0)),db=Math.max(0,m.xp.blocked-Number(base.blocked||0)),dn=Math.max(0,m.xp.notified-Number(base.notified||0));
    const skillReturn=strategyPatternCount(patterns,'回踩'),skillBreak=strategyPatternCount(patterns,'突破'),depthResearch=Math.max(0,patterns.filter(x=>String(x?.features?.depth||'—')!=='—').reduce((a,x)=>a+Number(x.sample||0),0)),stateResearch=patterns.reduce((a,x)=>a+Number(x.sample||0),0),level=m.level,stagePct=clamp((m.xp.effective-m.stage.from)/Math.max(1,m.stage.to-m.stage.from)*100),history=recordHistory(m),visits=recentVisitCount(7);
    const personalitySub=m.best?`偏好：${esc(m.best.features?.strategyLabel||'多策略')} / ${esc(({TREND_UP:'強多',TREND_DOWN:'強空',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算'})[m.best.features?.regime]||m.best.features?.regime||'跨狀態')}`:'尚在建立偏好';
    const badge=rootDoc.getElementById('sgBrandLevel');if(badge)badge.textContent=`Lv.${level.level}`;
    panel.innerHTML=`
      <div class="sg-panel-topline"><span><i class="sg-mini-sigil">◇</i> 成長核心 · V${VERSION}</span><div><b>${m.stage.name}</b><em>${formatAge(state.perf.generatedAt||state.signals?.generatedAt)}</em></div></div>
      <div class="sg-hero">
        <section class="sg-core-card">
          <div class="sg-kicker"><span class="sg-status-dot"></span>研究中 <em>近 7 日 ${visits}D</em></div><div class="sg-core-seal" aria-hidden="true"><i></i><b>◇</b><span></span></div>
          <div class="sg-level-row"><div><small>SYSTEM</small><strong>Lv.${level.level}</strong></div><div class="sg-personality"><span>系統型態</span><b>${esc(m.personality)}</b><small>${personalitySub}</small></div></div>
          <div class="sg-xp-row"><div><b>${num(level.current)} / ${num(level.need)} XP</b><span>${dx>0?`今日 +${num(dx)} XP`:'今日持續研究'}</span></div><small>總研究經驗 ${num(level.total)} XP</small></div><div class="sg-xp"><i style="width:${level.ratio}%"></i></div>
          <div class="sg-stage"><div><span>研究階段 · ${esc(m.stage.name)}</span><b>${m.xp.effective} / ${m.stage.to} 去相關樣本</b></div><div class="sg-stage-bar"><i style="width:${stagePct}%"></i></div><p>${esc(m.stage.desc)}</p>${stagePath(m)}</div>
          <div class="sg-today-growth"><div><span>今日有效樣本</span><b>+${de}</b></div><div><span>今日淘汰研究</span><b>+${db}</b></div><div><span>今日通知樣本</span><b>+${dn}</b></div></div>
        </section>
        <section class="sg-radar-card"><div class="sg-card-title"><b>六維屬性</b><span>研究成熟度 · 非勝率</span></div>${radarSvg(m.attrs)}<div class="sg-radar-hint">成熟度 · 非勝率</div></section>
      </div>
      <div class="sg-quick"><div><span>影子樣本</span><b>${num(sh.sample||0)}</b><small>已結算 ${num(sh.resolved||0)}</small></div><div><span>去相關有效</span><b>${num(sh.learningEffectiveResolved||0)}</b><small>${num(sh.learningDedupMinutes||45)} 分去相關</small></div><div><span>影子命中</span><b>${pct(sh.hitRate,1)}</b><small>PF ${pf(sh.profitFactor)}</small></div><div><span>真正通知</span><b>${num(sum.sample||0)}</b><small>${m.tierCounts.HIGH} HIGH · ${m.tierCounts.NORMAL} NORMAL</small></div></div>
      ${explorationHtml()}
      <section id="sgLessonSection">${lessonHtml(m)}</section>
      <section class="sg-live" id="sgCandidateSection"><div class="sg-section-head"><div><b>正在發生</b><span>LIVE RESEARCH</span></div><span>${rows.length} 個觀察狀態</span></div>${candidateHtml(rows)}</section>
      <div class="sg-accordions">
        <details class="sg-accordion" open><summary><div><b>技能樹</b><span>RESEARCH SKILLS</span></div><em>6 PATHS</em></summary><div class="sg-detail-body"><div class="sg-skills sg-skill-tree">
          ${skillCard('◎','回踩獵手','順勢回踩 · Regime 表現',skillReturn,'回踩模式樣本')}${skillCard('◇','破局之眼','突破 / 回測 · 事件命中',skillBreak,'突破模式樣本')}${skillCard('⬡','影子研究','未通知樣本 · 去偏誤研究',m.xp.effective,'去相關有效樣本')}${skillCard('◉','狀態學習','策略 × Regime × 資金 × 深度',stateResearch,'模式有效樣本')}${skillCard('⌁','流動性雷達','Depth / Spread / 流動性',depthResearch,'Depth 模式樣本')}${skillCard('△','危機預警','風險閘門 · 反證樣本',m.xp.blocked,'被擋樣本')}
        </div></div></details>
        <details class="sg-accordion" id="sgJournal"><summary><div><b>模型日誌</b><span>MODEL LOG</span></div><em>${patterns.length} ACTIVE</em></summary><div class="sg-detail-body"><div class="sg-journal-grid"><div class="good"><span>目前最強模式</span><b>${esc(patternText(m.best))}</b></div><div class="bad"><span>目前最弱模式</span><b>${esc(patternText(m.worst))}</b></div></div><div class="sg-journal-note"><span>目前最常阻擋</span><div>${m.blockerTop.length?m.blockerTop.map(([k,v])=>`<i>${esc(k)} <b>${v}</b></i>`).join(''):'<i>暫無集中風險</i>'}</div></div><div class="sg-journal-note"><span>今日狀態</span><b>${m.tierCounts.HIGH+m.tierCounts.NORMAL>0?`READY · ${m.tierCounts.HIGH+m.tierCounts.NORMAL} 通知級`:'WAIT'}</b></div></div></details>
        <details class="sg-accordion"><summary><div><b>研究足跡</b><span>HISTORY</span></div><em>7D</em></summary><div class="sg-detail-body"><div class="sg-history-card">${historySvg(history)}</div></div></details>
        <details class="sg-accordion"><summary><div><b>成就與里程碑</b><span>MILESTONES</span></div><em>${m.xp.effective>=20?'進階已開':'20 SAMPLE'}</em></summary><div class="sg-detail-body"><div class="sg-ach-grid">${achievement('研究啟動','完成第一個去相關有效樣本',m.xp.effective>=1,m.xp.effective,1)}${achievement('乾淨樣本','累積 20 個可真正影響學習的去相關樣本',m.xp.effective>=20,m.xp.effective,20)}${achievement('鐵面守門員','累積研究 50 個被風險閘門擋下的候選',m.xp.blocked>=50,m.xp.blocked,50)}${achievement('狀態覺醒','第一個同狀態模式達到學習門檻並開始調權',patterns.length>=1,patterns.length,1)}${achievement('模型驗收 I','累積 50 個去相關有效樣本',m.xp.effective>=50,m.xp.effective,50)}${achievement('真正校準','累積 20 個真正送達通知並完成追蹤的樣本',m.xp.notified>=20,m.xp.notified,20)}${achievement('穩定專精','單一模式至少 50 筆、PF ≥ 1.30',patterns.some(x=>Number(x.sample||0)>=50&&Number(x.profitFactor||0)>=1.3),Math.max(0,...patterns.map(x=>Number(x.sample||0))),50,true)}</div></div></details>
        <details class="sg-accordion"><summary><div><b>資料庫</b><span>CODEX</span></div><em>4 FILES</em></summary><div class="sg-detail-body"><div class="sg-manual"><details><summary>45 分去相關，到底在防什麼？</summary><p>同一波行情可能連續生出很多很像的訊號。如果全部當成獨立成功，勝率會被灌水。現在系統把太接近的樣本降成同一群，讓「21 個去相關有效」比「90 個影子樣本」更接近真正可用的研究量。</p></details><details><summary>PF 為什麼比勝率更重要？</summary><p>PF = 總獲利 ÷ 總虧損。勝率高但每次小賺大賠，PF 還是會差；勝率普通但贏的幅度夠大，PF 仍可能大於 1。</p></details><details><summary>MFE / MAE 是什麼？</summary><p>MFE 看進場後最多曾經往有利方向走多遠；MAE 看最多曾經逆你多少。它們能幫你判斷 TP 是否太遠、SL 是否太近，而不是只看最後輸贏。</p></details><details><summary>狀態學習是在學什麼？</summary><p>不是學「哪顆幣一定漲」，而是在比較策略、方向、市場 Regime、OI、Taker、Depth 等條件組合，哪些長期表現比較好，再有限度調整未來分數。</p></details></div></div></details>
        <details class="sg-accordion"><summary><div><b>情報檔案</b><span>INTEL</span></div><em>AI · 2H</em></summary><div class="sg-detail-body"><div class="sg-intel-note">按下才查 · 可能產生 API 費用 · 2 小時快取</div><div id="sgIntelList" class="sg-intel-list">${intelListHtml(rows)}</div></div></details>
        <details class="sg-accordion"><summary><div><b>成長規則</b><span>FORMULA</span></div><em>XP</em></summary><div class="sg-detail-body"><div class="sg-rules"><div><b>+35 XP</b><span>每個去相關有效樣本</span></div><div><b>+8 XP</b><span>每個可學習已結算樣本</span></div><div><b>+2 XP</b><span>每個被擋候選的研究紀錄</span></div><div><b>+50 XP</b><span>每個真正通知樣本</span></div><div><b>+120 XP</b><span>每個達門檻、真正啟動的狀態模式</span></div></div><p class="sg-rule-note">章節進度只記錄瀏覽，不計入模型 XP。</p></div></details>
      </div><div class="sg-footer"><i>◇</i><b>觀察 · 驗證 · 成長</b><i>◇</i></div>`;
    bindPanelEvents(panel);
    celebrateProgress(m,[skillReturn,skillBreak,m.xp.effective,stateResearch,depthResearch,m.xp.blocked]);
  }

  function intelListHtml(rows){const list=candidateRows(rows).slice(0,3);if(!list.length)return'<div class="sg-empty">目前沒有候選情報檔案。</div>';return list.map(x=>`<article class="sg-intel" data-sg-intel="${esc(x.symbol)}:${esc(x.direction)}"><div class="sg-intel-head"><div><b>${esc(x.symbol)}</b><span>${x.direction==='SHORT'?'做空':'做多'} · ${esc(x.strategyAtConfirm?.label||x.strategyProfile?.label||'多策略')}</span></div><button type="button" class="sg-intel-btn" data-sg-intel-btn data-symbol="${esc(x.symbol)}" data-direction="${esc(x.direction)}">查最新情報</button></div><div class="sg-intel-body" data-sg-intel-body>尚未查詢</div></article>`).join('')}
  function bindPanelEvents(panel){
    panel.querySelectorAll('[data-sg-intel-btn]').forEach(btn=>btn.addEventListener('click',()=>loadIntel(btn)));
    panel.querySelector('[data-sg-lesson]')?.addEventListener('toggle',e=>{if(e.currentTarget.open)markExplore('lesson')});
    panel.querySelectorAll('[data-sg-candidate]').forEach(el=>el.addEventListener('toggle',e=>{if(e.currentTarget.open)markExplore('candidate')}));
    panel.querySelector('#sgJournal')?.addEventListener('toggle',e=>{if(e.currentTarget.open)markExplore('journal')});
    panel.querySelectorAll('[data-sg-jump]').forEach(btn=>btn.addEventListener('click',()=>jumpTo(btn.dataset.sgJump)));
  }
  function jumpTo(key){
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
    if(state.loading)return;if(!force&&state.perf&&Date.now()-state.lastLoadedAt<30_000){render();return}state.loading=true;setStatus('同步研究資料…');
    try{const [perf,signals]=await Promise.all([getJson('/api/performance'),getJson('/api/test-signals').catch(()=>null)]);state.perf=perf;state.signals=signals;state.lastLoadedAt=Date.now();render();setStatus('')}catch(e){setStatus(`養成資料暫時不可用 · ${e?.message||'未知錯誤'}`)}finally{state.loading=false}
  }
  function setStatus(text){const el=rootDoc.getElementById('sgLoading');if(el)el.textContent=text||''}
  function setOpen(open){
    state.open=!!open;const panel=rootDoc.getElementById('sgPanel'),btn=rootDoc.getElementById('sgBrandToggle');if(!panel||!btn)return;panel.hidden=!state.open;panel.classList.toggle('open',state.open);btn.classList.toggle('active',state.open);btn.setAttribute('aria-expanded',String(state.open));try{localStorage.setItem(OPEN_KEY,state.open?'1':'0')}catch{}
    if(state.open){updateVisits();void loadData(false);startTimer()}else stopTimer();updateScrollRail()
  }
  function startTimer(){stopTimer();state.timer=setInterval(()=>{if(state.open)void loadData(true)},60_000)}
  function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null}}
  function init(){
    if(rootDoc.getElementById('sgPanel'))return;const brand=rootDoc.querySelector('.brandTitle'),top=rootDoc.querySelector('.top');if(!brand||!top){setTimeout(init,180);return}
    brand.classList.add('sg-brand');const btn=rootDoc.createElement('button');btn.type='button';btn.id='sgBrandToggle';btn.className='sg-brand-toggle';btn.setAttribute('aria-expanded','false');btn.innerHTML=`<span>系統養成</span><em id="sgBrandLevel">Lv.—</em>`;brand.appendChild(btn);
    const loading=rootDoc.createElement('div');loading.id='sgLoading';loading.className='sg-loading';loading.setAttribute('aria-live','polite');const panel=rootDoc.createElement('section');panel.id='sgPanel';panel.className='sg-panel';panel.hidden=true;panel.setAttribute('aria-label','系統養成');panel.innerHTML='<div class="sg-skeleton">讀取養成資料中…</div>';
    const toast=rootDoc.createElement('div');toast.id='sgToast';toast.className='sg-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');rootDoc.body.appendChild(toast);mountScrollRail();
    top.insertAdjacentElement('afterend',loading);loading.insertAdjacentElement('afterend',panel);btn.addEventListener('click',()=>setOpen(!state.open));let initial=false;try{const v=localStorage.getItem(OPEN_KEY);initial=v===null?true:v==='1'}catch{initial=true}setOpen(initial);
  }
  if(rootDoc.readyState==='loading')rootDoc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
