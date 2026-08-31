(()=>{
  'use strict';
  const VERSION='1.0.0';
  const OPEN_KEY='sg-open-v1';
  const SNAP_PREFIX='sg-day-v1-';
  const rootDoc=document;
  const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
  const has=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=(v,d=1)=>has(v)?`${Number(v).toFixed(d)}%`:'—';
  const num=(v,d=0)=>has(v)?Number(v).toLocaleString('en-US',{maximumFractionDigits:d}):'—';
  const pf=v=>has(v)?Number(v).toFixed(2):'—';
  const todayKey=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const state={open:false,loading:false,perf:null,signals:null,market:null,lastLoadedAt:0,intel:new Map(),timer:null};

  function safeParse(raw,fallback=null){try{return JSON.parse(raw)}catch{return fallback}}
  function getDayBase(){try{return safeParse(localStorage.getItem(SNAP_PREFIX+todayKey()),null)}catch{return null}}
  function setDayBase(v){try{if(!localStorage.getItem(SNAP_PREFIX+todayKey()))localStorage.setItem(SNAP_PREFIX+todayKey(),JSON.stringify(v))}catch{}}

  function levelFromXp(total){
    let level=1,spent=0,need=350;
    let left=Math.max(0,Math.round(total||0));
    while(left>=need&&level<50){left-=need;spent+=need;level+=1;need=Math.round(350+level*150)}
    return {level,current:left,need,total:Math.round(total||0),spent,ratio:need?clamp(left/need*100):0};
  }
  function skillLevel(count){
    const n=Number(count||0),cuts=[5,20,50,100,200];
    let lv=1;for(const c of cuts)if(n>=c)lv+=1;
    const prev=lv===1?0:cuts[lv-2],next=cuts[lv-1]??400;
    return {lv,current:n,next,ratio:clamp((n-prev)/Math.max(1,next-prev)*100)};
  }
  function weightedPatternScore(patterns,predicate){
    const rows=(patterns||[]).filter(predicate);if(!rows.length)return {score:50,sample:0,pf:null,hit:null};
    let w=0,hit=0,p=0,sample=0;
    for(const x of rows){const s=Math.max(1,Number(x.sample||0));sample+=s;w+=s;hit+=(Number(x.hitRate)||0)*s;p+=(Number(x.profitFactor)||0)*s}
    const hr=w?hit/w:0,pp=w?p/w:0;
    const score=clamp(35+(hr-35)*.72+(pp-1)*18+Math.min(12,Math.log10(sample+1)*6),25,95);
    return {score,sample,pf:pp,hit:hr};
  }
  function xpModel(perf){
    const sh=perf?.shadowSummary||{},sum=perf?.summary||{},patterns=perf?.stateLearning?.patterns||[];
    const effective=Number(sh.learningEffectiveResolved||0),eligible=Number(sh.learningEligibleResolved||0),blocked=Number(sh.blockedSample||0),notified=Number(sum.sample||0);
    const xp=effective*35+eligible*8+blocked*2+notified*50+patterns.length*120;
    return {xp,effective,eligible,blocked,notified,patterns:patterns.length};
  }
  function getMetrics(){
    const perf=state.perf||{},sh=perf.shadowSummary||{},sum=perf.summary||{},patterns=perf.stateLearning?.patterns||[],rows=state.signals?.rows||[];
    const xp=xpModel(perf),level=levelFromXp(xp.xp);
    const avgProgress=rows.length?rows.reduce((a,x)=>a+clamp(x.observationProgress||x.strategyProfile?.progress||0),0)/rows.length:0;
    const overallHit=has(sh.hitRate)?Number(sh.hitRate):0,overallPf=has(sh.profitFactor)?Number(sh.profitFactor):0;
    const blockedHit=has(sh.blockedHitRate)?Number(sh.blockedHitRate):50;
    const patternAll=weightedPatternScore(patterns,()=>true);
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
    const attrs=[
      {key:'structure',label:'結構判讀',value:Math.round(structure)},
      {key:'trend',label:'趨勢掌握',value:Math.round(trendScore)},
      {key:'money',label:'資金嗅覺',value:Math.round(moneyScore)},
      {key:'depth',label:'深度感知',value:Math.round(depthScore)},
      {key:'risk',label:'風險控管',value:Math.round(risk)},
      {key:'patience',label:'耐心紀律',value:Math.round(patience)},
    ];
    const tierCounts={HIGH:0,NORMAL:0,VALID:0,BLOCKED:0};
    for(const x of rows){const k=String(x.notificationTier||'VALID').toUpperCase();if(k in tierCounts)tierCounts[k]++}
    const blockers={};
    for(const x of rows){for(const b of x.notificationGate?.blockers||[]){blockers[b]=(blockers[b]||0)+1}}
    const blockerTop=Object.entries(blockers).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const personality=selectivity>=.67?'耐心獵手':selectivity>=.5?'嚴格篩選型':'積極研究型';
    const best=[...patterns].sort((a,b)=>Number(b.adjustment||0)-Number(a.adjustment||0)||Number(b.profitFactor||0)-Number(a.profitFactor||0))[0]||null;
    const worst=[...patterns].sort((a,b)=>Number(a.adjustment||0)-Number(b.adjustment||0)||Number(a.profitFactor||0)-Number(b.profitFactor||0))[0]||null;
    return {perf,sh,sum,patterns,rows,xp,level,attrs,tierCounts,blockerTop,personality,best,worst,selectivity,patternAll};
  }

  function radarSvg(attrs){
    const cx=150,cy=134,r=90,axes=6;
    const pt=(i,rr)=>{const a=-Math.PI/2+i*Math.PI*2/axes;return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]};
    const poly=rr=>Array.from({length:axes},(_,i)=>pt(i,rr).map(v=>v.toFixed(1)).join(',')).join(' ');
    const rings=[.25,.5,.75,1].map(k=>`<polygon points="${poly(r*k)}" class="sg-radar-ring"/>`).join('');
    const lines=Array.from({length:axes},(_,i)=>{const p=pt(i,r);return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" class="sg-radar-axis"/>`}).join('');
    const shape=attrs.map((x,i)=>pt(i,r*clamp(x.value)/100).map(v=>v.toFixed(1)).join(',')).join(' ');
    const dots=attrs.map((x,i)=>{const p=pt(i,r*clamp(x.value)/100);return `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" class="sg-radar-dot"/>`}).join('');
    const labels=attrs.map((x,i)=>{const p=pt(i,r+25),anchor=p[0]<cx-8?'end':p[0]>cx+8?'start':'middle',dy=p[1]<cy-20?'-3':p[1]>cy+20?'13':'4';return `<text x="${p[0]}" y="${p[1]}" text-anchor="${anchor}" class="sg-radar-label"><tspan x="${p[0]}" dy="${dy}">${esc(x.label)}</tspan><tspan x="${p[0]}" dy="14" class="sg-radar-value">${x.value}</tspan></text>`}).join('');
    return `<svg class="sg-radar" viewBox="0 0 300 270" role="img" aria-label="系統六維屬性雷達圖">${rings}${lines}<polygon points="${shape}" class="sg-radar-shape"/>${dots}${labels}</svg>`;
  }
  function strategyPatternCount(patterns,word){return (patterns||[]).filter(x=>String(x?.features?.strategyLabel||'').includes(word)).reduce((a,x)=>a+Number(x.sample||0),0)}
  function skillCard(icon,name,desc,count,meta=''){
    const s=skillLevel(count);
    return `<article class="sg-skill"><div class="sg-skill-head"><span class="sg-skill-icon">${icon}</span><div><b>${esc(name)}</b><small>Lv.${s.lv}</small></div></div><p>${esc(desc)}</p><div class="sg-skill-bar"><i style="width:${s.ratio}%"></i></div><div class="sg-skill-foot"><span>${num(s.current)} / ${num(s.next)}</span><em>${esc(meta||'研究經驗')}</em></div></article>`;
  }
  function achievement(label,desc,done,current,target,hidden=false){
    const ratio=target?clamp(Number(current||0)/target*100):(done?100:0);
    return `<div class="sg-ach ${done?'unlocked':'locked'}"><div class="sg-ach-medal">${done?'◆':hidden?'?':'◇'}</div><div class="sg-ach-copy"><b>${hidden&&!done?'隱藏成就':esc(label)}</b><span>${hidden&&!done?'條件達成時才會揭露':esc(desc)}</span><div class="sg-ach-progress"><i style="width:${ratio}%"></i></div><small>${done?'已解鎖':`${num(current)} / ${num(target)}`}</small></div></div>`;
  }
  function patternText(x){if(!x)return'尚未形成可學習模式';const f=x.features||{},dir=f.direction==='SHORT'?'空':'多',reg=({TREND_UP:'強多',TREND_DOWN:'強空',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算'})[f.regime]||f.regime||'未分類';return `${f.strategyLabel||'未分類'} · ${reg} · ${dir} · ${Number(x.sample||0)}筆 · 命中 ${has(x.hitRate)?Number(x.hitRate).toFixed(1)+'%':'—'} · PF ${pf(x.profitFactor)} · 權重 ${Number(x.adjustment||0)>0?'+':''}${Number(x.adjustment||0)}`}
  function formatAge(ts){if(!ts)return'—';const s=Math.max(0,Math.floor((Date.now()-new Date(ts).getTime())/1000));if(s<60)return`${s}秒前`;if(s<3600)return`${Math.floor(s/60)}分前`;return`${Math.floor(s/3600)}小時前`}
  function candidateRows(rows){
    const score=x=>({HIGH:4,NORMAL:3,VALID:2,BLOCKED:1})[String(x.notificationTier||'VALID').toUpperCase()]||0;
    return [...(rows||[])].filter(x=>!['DROPPED','EXPIRED'].includes(String(x.status||''))).sort((a,b)=>score(b)-score(a)||Number(b.observationProgress||0)-Number(a.observationProgress||0)||Number(a.observationRank||999)-Number(b.observationRank||999)).slice(0,4)
  }
  function candidateHtml(rows){
    const list=candidateRows(rows);if(!list.length)return'<div class="sg-empty">目前沒有值得深挖的候選，系統繼續巡邏。</div>';
    return list.map(x=>{const tier=String(x.notificationTier||'VALID').toUpperCase(),progress=Math.round(clamp(x.observationProgress||x.strategyProfile?.progress||0)),miss=(x.notificationGate?.normalMissing||x.notificationGate?.blockers||[]).slice(0,2).join('、')||'等待更多同向條件';return `<div class="sg-candidate"><div class="sg-candidate-main"><b>${esc(x.symbol)}</b><span class="${x.direction==='SHORT'?'short':'long'}">${x.direction==='SHORT'?'做空':'做多'}</span><em class="${tier.toLowerCase()}">${esc(({HIGH:'HIGH',NORMAL:'NORMAL',VALID:'VALID',BLOCKED:'BLOCKED'})[tier]||tier)}</em></div><div class="sg-candidate-bar"><i style="width:${progress}%"></i></div><div class="sg-candidate-meta"><span>${progress}% · ${esc(x.strategyAtConfirm?.label||x.strategyProfile?.label||x.lastCheck?.strategyLabel||'多策略觀察')}</span><small>${esc(miss)}</small></div></div>`}).join('')
  }

  function render(){
    const panel=rootDoc.getElementById('sgPanel');if(!panel||!state.perf)return;
    const m=getMetrics(),sh=m.sh,sum=m.sum,patterns=m.patterns,rows=m.rows;
    const dayBase=getDayBase();if(!dayBase)setDayBase({xp:m.xp.xp,effective:m.xp.effective,blocked:m.xp.blocked,notified:m.xp.notified,at:Date.now()});
    const base=getDayBase()||{xp:m.xp.xp,effective:m.xp.effective,blocked:m.xp.blocked,notified:m.xp.notified};
    const dx=Math.max(0,m.xp.xp-Number(base.xp||0)),de=Math.max(0,m.xp.effective-Number(base.effective||0)),db=Math.max(0,m.xp.blocked-Number(base.blocked||0)),dn=Math.max(0,m.xp.notified-Number(base.notified||0));
    const skillReturn=strategyPatternCount(patterns,'回踩'),skillBreak=strategyPatternCount(patterns,'突破'),depthResearch=Math.max(0,patterns.filter(x=>String(x?.features?.depth||'—')!=='—').reduce((a,x)=>a+Number(x.sample||0),0)),stateResearch=patterns.reduce((a,x)=>a+Number(x.sample||0),0);
    const personalitySub=m.best?`目前偏好：${esc(m.best.features?.strategyLabel||'多策略')} / ${esc(({TREND_UP:'強多',TREND_DOWN:'強空',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算'})[m.best.features?.regime]||m.best.features?.regime||'跨狀態')}`:'尚在建立偏好';
    const level=m.level;
    const badge=rootDoc.getElementById('sgBrandLevel');if(badge)badge.textContent=`Lv.${level.level}`;
    panel.innerHTML=`
      <div class="sg-panel-topline"><span>成長核心 · V${VERSION}</span><b>${formatAge(state.perf.generatedAt||state.signals?.generatedAt)}</b></div>
      <div class="sg-hero">
        <section class="sg-core-card">
          <div class="sg-kicker"><span class="sg-status-dot"></span>研究中</div>
          <div class="sg-level-row"><div><small>SYSTEM</small><strong>Lv.${level.level}</strong></div><div class="sg-personality"><span>系統型態</span><b>${esc(m.personality)}</b><small>${personalitySub}</small></div></div>
          <div class="sg-xp-row"><div><b>${num(level.current)} / ${num(level.need)} XP</b><span>${dx>0?`今日 +${num(dx)} XP`:'今日持續研究'}</span></div><small>總研究經驗 ${num(level.total)} XP</small></div>
          <div class="sg-xp"><i style="width:${level.ratio}%"></i></div>
          <p class="sg-tagline">讓等待有進度感，讓不交易也有成就感。</p>
          <div class="sg-today-growth"><div><span>今日有效樣本</span><b>+${de}</b></div><div><span>今日淘汰研究</span><b>+${db}</b></div><div><span>今日通知樣本</span><b>+${dn}</b></div></div>
        </section>
        <section class="sg-radar-card"><div class="sg-card-title"><b>六維屬性</b><span>成長指數 · 非勝率</span></div>${radarSvg(m.attrs)}</section>
      </div>
      <div class="sg-quick">
        <div><span>影子樣本</span><b>${num(sh.sample||0)}</b><small>已結算 ${num(sh.resolved||0)}</small></div>
        <div><span>去相關有效</span><b>${num(sh.learningEffectiveResolved||0)}</b><small>${num(sh.learningDedupMinutes||45)} 分去相關</small></div>
        <div><span>影子命中</span><b>${pct(sh.hitRate,1)}</b><small>PF ${pf(sh.profitFactor)}</small></div>
        <div><span>真正通知</span><b>${num(sum.sample||0)}</b><small>${m.tierCounts.HIGH} HIGH · ${m.tierCounts.NORMAL} NORMAL</small></div>
      </div>
      <section class="sg-live"><div class="sg-section-head"><div><b>正在發生</b><span>看它慢慢長大，不需要出手</span></div><span>${rows.length} 個觀察狀態</span></div>${candidateHtml(rows)}</section>
      <div class="sg-accordions">
        <details class="sg-accordion" open><summary><div><b>技能模組</b><span>能力不是手動加點，是被真實樣本養出來</span></div><em>展開 / 收合</em></summary><div class="sg-detail-body"><div class="sg-skills">
          ${skillCard('◎','回踩獵手','研究順勢回踩在不同市場狀態的真實表現',skillReturn,'回踩模式樣本')}
          ${skillCard('◇','破局之眼','追蹤突破與回測類策略是否真的能提高命中',skillBreak,'突破模式樣本')}
          ${skillCard('⬡','影子研究','沒通知也繼續追蹤，建立不帶選擇偏誤的研究池',m.xp.effective,'去相關有效樣本')}
          ${skillCard('◉','狀態學習','比較策略 × Regime × 資金 × 深度，強弱模式自動調權',stateResearch,'模式有效樣本')}
          ${skillCard('⌁','流動性雷達','把深度、價差與流動性條件納入勝敗對照',depthResearch,'Depth 模式樣本')}
          ${skillCard('△','危機預警','記錄被風險閘門擋下的候選，驗證「不做」是否正確',m.xp.blocked,'被擋樣本')}
        </div></div></details>
        <details class="sg-accordion"><summary><div><b>模型日誌</b><span>今天它學到什麼、偏好什麼、又怕什麼</span></div><em>${patterns.length} 個已啟動模式</em></summary><div class="sg-detail-body">
          <div class="sg-journal-grid"><div class="good"><span>目前最強模式</span><b>${esc(patternText(m.best))}</b></div><div class="bad"><span>目前最弱模式</span><b>${esc(patternText(m.worst))}</b></div></div>
          <div class="sg-journal-note"><span>目前最常阻擋</span><div>${m.blockerTop.length?m.blockerTop.map(([k,v])=>`<i>${esc(k)} <b>${v}</b></i>`).join(''):'<i>暫無集中風險</i>'}</div></div>
          <div class="sg-journal-note"><span>今日選擇</span><b>${m.tierCounts.HIGH+m.tierCounts.NORMAL>0?`有 ${m.tierCounts.HIGH+m.tierCounts.NORMAL} 個通知級候選；只處理系統真正放行的機會。`:'等待。沒有足夠好的機會，本身就是一個結果。'}</b></div>
        </div></details>
        <details class="sg-accordion"><summary><div><b>成就與里程碑</b><span>只獎勵研究、過濾、等待，不獎勵亂下單</span></div><em>${m.xp.effective>=20?'進階研究已開':'下一個：20 去相關樣本'}</em></summary><div class="sg-detail-body"><div class="sg-ach-grid">
          ${achievement('研究啟動','完成第一個去相關有效樣本',m.xp.effective>=1,m.xp.effective,1)}
          ${achievement('乾淨樣本','累積 20 個可真正影響學習的去相關樣本',m.xp.effective>=20,m.xp.effective,20)}
          ${achievement('鐵面守門員','累積研究 50 個被風險閘門擋下的候選',m.xp.blocked>=50,m.xp.blocked,50)}
          ${achievement('狀態覺醒','第一個同狀態模式達到學習門檻並開始調權',patterns.length>=1,patterns.length,1)}
          ${achievement('模型驗收 I','累積 50 個去相關有效樣本',m.xp.effective>=50,m.xp.effective,50)}
          ${achievement('真正校準','累積 20 個真正送達通知並完成追蹤的樣本',m.xp.notified>=20,m.xp.notified,20)}
          ${achievement('穩定專精','單一模式至少 50 筆、PF ≥ 1.30',patterns.some(x=>Number(x.sample||0)>=50&&Number(x.profitFactor||0)>=1.3),Math.max(0,...patterns.map(x=>Number(x.sample||0))),50,true)}
        </div></div></details>
        <details class="sg-accordion"><summary><div><b>情報檔案</b><span>真的無聊再點；只有按下按鈕才做 AI 網搜</span></div><em>2 小時快取</em></summary><div class="sg-detail-body"><div class="sg-intel-note">AI 情報使用既有標的分析端點；可能產生 OpenAI API 費用。系統不會自動亂搜，只有你按「查最新情報」才執行。</div><div id="sgIntelList" class="sg-intel-list">${intelListHtml(rows)}</div></div></details>
        <details class="sg-accordion"><summary><div><b>成長規則</b><span>所有 XP 與屬性都來自真實研究資料，不用假數字灌等級</span></div><em>查看公式</em></summary><div class="sg-detail-body"><div class="sg-rules"><div><b>+35 XP</b><span>每個去相關有效樣本</span></div><div><b>+8 XP</b><span>每個可學習已結算樣本</span></div><div><b>+2 XP</b><span>每個被擋候選的研究紀錄</span></div><div><b>+50 XP</b><span>每個真正通知樣本</span></div><div><b>+120 XP</b><span>每個達門檻、真正啟動的狀態模式</span></div></div><p class="sg-rule-note">六維屬性是「研究成熟度＋區分能力」的成長指數，不代表下一筆交易勝率，也不會反向修改 V10.2.7 的核心判斷。這層只讀取既有資料。</p></div></details>
      </div>
      <div class="sg-footer">真正的優勢，來自等待與過濾。每一次不交易，都是為了更好的出手。</div>`;
    bindIntelButtons(panel);
  }

  function intelListHtml(rows){
    const list=candidateRows(rows).slice(0,3);if(!list.length)return'<div class="sg-empty">目前沒有候選情報檔案。</div>';
    return list.map(x=>`<article class="sg-intel" data-sg-intel="${esc(x.symbol)}:${esc(x.direction)}"><div class="sg-intel-head"><div><b>${esc(x.symbol)}</b><span>${x.direction==='SHORT'?'做空':'做多'} · ${esc(x.strategyAtConfirm?.label||x.strategyProfile?.label||'多策略')}</span></div><button type="button" data-sg-intel-btn data-symbol="${esc(x.symbol)}" data-direction="${esc(x.direction)}">查最新情報</button></div><div class="sg-intel-body" data-sg-intel-body>尚未查詢。你可以先繼續等。</div></article>`).join('')
  }
  function bindIntelButtons(panel){
    panel.querySelectorAll('[data-sg-intel-btn]').forEach(btn=>btn.addEventListener('click',()=>loadIntel(btn)));
  }
  async function loadIntel(btn){
    const symbol=btn.dataset.symbol||'',direction=btn.dataset.direction||'LONG',key=`${symbol}:${direction}`,box=btn.closest('.sg-intel')?.querySelector('[data-sg-intel-body]');if(!box)return;
    const cached=state.intel.get(key);if(cached&&Date.now()-cached.at<2*60*60*1000){box.innerHTML=intelBody(cached.data,true);return}
    btn.disabled=true;btn.textContent='搜尋中…';box.innerHTML='<div class="sg-intel-loading">AI 正在搜尋最新消息並與市場資料交叉比對…</div>';
    try{const r=await fetch(`/api/symbol-analysis?symbol=${encodeURIComponent(symbol)}&direction=${encodeURIComponent(direction)}`,{cache:'no-store'}),d=await r.json();if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);state.intel.set(key,{at:Date.now(),data:d});box.innerHTML=intelBody(d,false)}catch(e){box.innerHTML=`<div class="sg-intel-loading">情報暫時不可用：${esc(e?.message||'未知錯誤')}</div>`}finally{btn.disabled=false;btn.textContent='查最新情報'}
  }
  function intelBody(d,cached){
    const good=(d.bullish||[]).slice(0,3),bad=(d.bearish||[]).slice(0,3),watch=(d.watch||[]).slice(0,3),news=(d.news||[]).slice(0,3);
    return `<div class="sg-intel-summary"><span>${esc(d.bias||'中性')} · ${esc(d.strength||'—')}</span><b>${esc(d.summary||d.action||'暫無摘要')}</b><small>${cached?'使用 2 小時內快取':'剛剛更新'} · ${esc(d.mode||'市場資料')}</small></div><div class="sg-intel-cols"><div><span>利多</span>${good.length?`<ul>${good.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>未見明確額外利多</p>'}</div><div><span>利空</span>${bad.length?`<ul>${bad.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>未見明確額外利空</p>'}</div></div>${watch.length?`<div class="sg-intel-watch"><span>接下來看</span><ul>${watch.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}${news.length?`<div class="sg-intel-news"><span>今日消息</span>${news.map(x=>`<p><i>${esc(x.tone||'中性')}</i>${esc(x.text||'')}</p>`).join('')}</div>`:''}`
  }

  async function getJson(path){const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(`${path} ${r.status}`);return r.json()}
  async function loadData(force=false){
    if(state.loading)return;if(!force&&state.perf&&Date.now()-state.lastLoadedAt<30_000){render();return}
    state.loading=true;setStatus('同步研究資料…');
    try{
      const [perf,signals]=await Promise.all([getJson('/api/performance'),getJson('/api/test-signals').catch(()=>null)]);
      state.perf=perf;state.signals=signals;state.lastLoadedAt=Date.now();render();setStatus('');
    }catch(e){setStatus(`養成資料暫時不可用 · ${e?.message||'未知錯誤'}`)}finally{state.loading=false}
  }
  function setStatus(text){const el=rootDoc.getElementById('sgLoading');if(el)el.textContent=text||''}
  function setOpen(open){
    state.open=!!open;const panel=rootDoc.getElementById('sgPanel'),btn=rootDoc.getElementById('sgBrandToggle');if(!panel||!btn)return;
    panel.hidden=!state.open;panel.classList.toggle('open',state.open);btn.classList.toggle('active',state.open);btn.setAttribute('aria-expanded',String(state.open));try{localStorage.setItem(OPEN_KEY,state.open?'1':'0')}catch{}
    if(state.open){void loadData(false);startTimer()}else stopTimer()
  }
  function startTimer(){stopTimer();state.timer=setInterval(()=>{if(state.open)void loadData(true)},60_000)}
  function stopTimer(){if(state.timer){clearInterval(state.timer);state.timer=null}}

  function init(){
    if(rootDoc.getElementById('sgPanel'))return;
    const brand=rootDoc.querySelector('.brandTitle'),top=rootDoc.querySelector('.top');
    if(!brand||!top){setTimeout(init,180);return}
    brand.classList.add('sg-brand');
    const btn=rootDoc.createElement('button');btn.type='button';btn.id='sgBrandToggle';btn.className='sg-brand-toggle';btn.setAttribute('aria-expanded','false');btn.innerHTML=`<span>系統養成</span><em id="sgBrandLevel">Lv.—</em>`;brand.appendChild(btn);
    const loading=rootDoc.createElement('div');loading.id='sgLoading';loading.className='sg-loading';loading.setAttribute('aria-live','polite');
    const panel=rootDoc.createElement('section');panel.id='sgPanel';panel.className='sg-panel';panel.hidden=true;panel.setAttribute('aria-label','系統養成');panel.innerHTML='<div class="sg-skeleton">讀取養成資料中…</div>';
    top.insertAdjacentElement('afterend',loading);loading.insertAdjacentElement('afterend',panel);
    btn.addEventListener('click',()=>setOpen(!state.open));
    let initial=false;try{const v=localStorage.getItem(OPEN_KEY);initial=v===null?true:v==='1'}catch{initial=true}
    setOpen(initial);
  }
  if(rootDoc.readyState==='loading')rootDoc.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
