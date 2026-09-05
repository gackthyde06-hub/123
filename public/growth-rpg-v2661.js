(()=>{
'use strict';

const VERSION='2.6.61';
const ROOT_ID='growthRpgV2661';
const OPEN_KEY='sg-open-v256';
const MIGRATE_KEY='sg-v2661-migrated';
const HISTORY_KEY='sg-history-v2644';
const LOG_KEY='sg-log-v2644';
const SNAP_KEY='sg-snap-v2644';
const DETAILS_KEY='sg-details-v2644';
const EXPLORE_KEY='sg-explore-v2644';
const VISIT_KEY='sg-visits-v2644';

let mentor=null, perf=null, manual=null, signals=null, busy=false, lastSig='', timer=null;
let lastFetchAt=0,lastUserAt=0,pendingSnapshot=false;
const DATA_CACHE_KEY='sg-growth-data-v2652';

const AUTO_REFRESH_MS=900000;
const MIN_REFRESH_MS=720000;
const USER_IDLE_MS=180000;
const intelCache=new Map();

const n=v=>Number.isFinite(Number(v))?Number(v):null;
const has=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const fmt=(v,d=0)=>has(v)?Number(v).toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const pct=(v,d=1)=>has(v)?`${Number(v).toFixed(d)}%`:'—';
const pct01=v=>has(v)?`${Math.round(Number(v)*100)}%`:'—';
const pf=v=>has(v)?Number(v).toFixed(2):'—';
const signed=v=>has(v)?`${Number(v)>0?'+':''}${Number(v).toFixed(3)}R`:'—';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const age=ts=>{
  const t=new Date(ts||0).getTime(); if(!t)return'—';
  const s=Math.max(0,Math.floor((Date.now()-t)/1000));
  return s<60?`${s}秒前`:s<3600?`${Math.floor(s/60)}分前`:`${Math.floor(s/3600)}小時前`;
};
function read(k,f){try{const x=JSON.parse(localStorage.getItem(k)||'null');return x??f}catch{return f}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}

function initialOpen(){
  try{
    if(!localStorage.getItem(MIGRATE_KEY)){
      localStorage.setItem(MIGRATE_KEY,'1');
      localStorage.setItem(OPEN_KEY,'true');
      return true;
    }
    const raw=localStorage.getItem(OPEN_KEY);
    return raw==null?true:JSON.parse(raw)!==false;
  }catch{return true}
}
function ensureShell(){
  const wrap=document.querySelector('.wrap')||document.body;
  const top=wrap.querySelector('.top'),tabs=wrap.querySelector('.pageTabs');
  if(!top)return null;

  const brand=top.querySelector('.brandTitle');
  let btn=document.getElementById('sgBrandToggleV2661');

  if(brand){
    brand.className='brandTitle v53-brand';

    // Base HTML originally contains the plain text "交易監控".
    // Rebuild only this brand node so old generated header fragments cannot stack.
    let monitor=brand.querySelector('.v53-monitor');
    if(!monitor){
      brand.replaceChildren();

      monitor=document.createElement('span');
      monitor.className='v53-monitor';
      monitor.textContent='交易監控';
      brand.appendChild(monitor);

      btn=document.createElement('button');
      btn.type='button';
      btn.id='sgBrandToggleV2661';
      btn.className='v53-growth-toggle';
      btn.innerHTML='<span class="v53-slash">/</span><span class="v53-growth-name">系統養成</span><strong id="sgBrandLevelV2661">Lv.—</strong><i>⌄</i>';
      brand.appendChild(btn);
    }else if(!btn){
      btn=brand.querySelector('.v53-growth-toggle');
    }
  }

  let panel=document.getElementById('sgPanel');
  if(!panel){
    panel=document.createElement('section');
    panel.id='sgPanel';
    panel.className='v53-panel';
    if(tabs)tabs.insertAdjacentElement('beforebegin',panel);
    else top.insertAdjacentElement('afterend',panel);
  }else{
    panel.className='v53-panel';
  }

  const open=initialOpen();
  panel.hidden=!open;
  btn?.classList.toggle('open',open);
  return panel;
}
function ensureRoot(){
  const panel=ensureShell(); if(!panel)return null;
  let root=document.getElementById(ROOT_ID);
  if(!root){
    root=document.createElement('section');
    root.id=ROOT_ID; root.className='v53-root';
    panel.replaceChildren(root);
  }else{
    for(const c of [...panel.children])if(c!==root)c.remove();
  }
  return root;
}
function toggleGrowth(){
  const panel=ensureShell(),btn=document.getElementById('sgBrandToggleV2661');
  if(!panel)return;

  if(panel.hidden){
    if(pendingSnapshot){
      render();
      pendingSnapshot=false;
    }
    panel.hidden=false;
    write(OPEN_KEY,true);
    btn?.classList.add('open');
    return;
  }

  panel.hidden=true;
  write(OPEN_KEY,false);
  btn?.classList.remove('open');

  // The panel is hidden now, so refreshing cannot move the visible page.
  void refresh(false);
}

function xpModel(){
  const sh=perf?.shadowSummary||{}, sum=perf?.summary||{}, patterns=perf?.stateLearning?.patterns||[];
  const effective=Number(sh.learningEffectiveResolved||0);
  const eligible=Number(sh.learningEligibleResolved||0);
  const blocked=Number(sh.blockedSample||0);
  const notified=Number(sum.sample||0);
  return {effective,eligible,blocked,notified,patterns:patterns.length,xp:effective*35+eligible*8+blocked*2+notified*50+patterns.length*120};
}
function levelFromXp(total){
  let level=1,need=350,left=Math.max(0,Math.round(total||0));
  while(left>=need&&level<50){left-=need;level++;need=Math.round(350+level*150)}
  return {level,current:left,need,total:Math.round(total||0),ratio:need?clamp(left/need*100):0};
}
function stageFromEffective(x){
  x=Number(x||0);
  if(x<20)return{index:0,name:'探索',role:'探索者',next:'校準',from:0,to:20,desc:'先收樣本，先別急著下結論。'};
  if(x<50)return{index:1,name:'校準',role:'校準者',next:'驗證',from:20,to:50,desc:'開始分層，但核心仍是乾淨樣本。'};
  if(x<100)return{index:2,name:'驗證',role:'驗證者',next:'穩定',from:50,to:100,desc:'拿新行情驗證舊規律是否仍有效。'};
  if(x<300)return{index:3,name:'穩定',role:'守序者',next:'深化',from:100,to:300,desc:'重點轉向穩定度、回撤與跨狀態表現。'};
  if(x<600)return{index:4,name:'深化',role:'鍛造師',next:'專精',from:300,to:600,desc:'樣本夠大後，再談專精與重構。'};
  return{index:5,name:'專精',role:'策略大師',next:'大師',from:600,to:1000,desc:'跨市場、跨時間維持成熟 Edge。'};
}
const STAGES=['探索','校準','驗證','穩定','深化','專精'];

function weightedPatternScore(patterns,pred){
  const rows=(patterns||[]).filter(pred);
  if(!rows.length)return{score:50,sample:0,pf:null,hit:null};
  let w=0,hit=0,p=0,sample=0;
  for(const x of rows){
    const s=Math.max(1,Number(x.sample||0)); sample+=s; w+=s;
    hit+=(Number(x.hitRate)||0)*s; p+=(Number(x.profitFactor)||0)*s;
  }
  const hr=w?hit/w:0, pp=w?p/w:0;
  return {score:clamp(35+(hr-35)*.72+(pp-1)*18+Math.min(12,Math.log10(sample+1)*6),25,95),sample,pf:pp,hit:hr};
}
function buildMetrics(){
  const sh=perf?.shadowSummary||{}, sum=perf?.summary||{}, patterns=perf?.stateLearning?.patterns||[], rows=signals?.rows||manual?.rows||[];
  const x=xpModel(), level=levelFromXp(x.xp), stage=stageFromEffective(x.effective);
  const avg=rows.length?rows.reduce((a,r)=>a+clamp(r.observationProgress||r.strategyProfile?.progress||0),0)/rows.length:0;
  const hit=has(sh.hitRate)?Number(sh.hitRate):0, p=has(sh.profitFactor)?Number(sh.profitFactor):0, blockedHit=has(sh.blockedHitRate)?Number(sh.blockedHitRate):50;
  const trend=weightedPatternScore(patterns,r=>['TREND_UP','TREND_DOWN'].includes(String(r?.features?.regime||'')));
  const money=weightedPatternScore(patterns,r=>String(r?.features?.oi||'—')!=='—'||String(r?.features?.taker||'—')!=='—');
  const depth=weightedPatternScore(patterns,r=>String(r?.features?.depth||'—')!=='—');
  const selectivity=Number(sh.sample||0)>0?Number(sh.blockedSample||0)/Number(sh.sample||1):0;
  const riskConfidence=Math.min(1,Number(sh.blockedSample||0)/100),riskRaw=100-blockedHit;
  const attrs=[
    {code:'STR',label:'結構判讀',value:Math.round(clamp(42+avg*.22+(hit-35)*.30+(p-1)*10+Math.min(10,x.effective/5),30,96)),learn:[['平均觀察完成',`${Math.round(avg)}%`],['影子命中',pct(sh.hitRate)],['有效樣本',`${x.effective} 筆`]]},
    {code:'DEX',label:'趨勢掌握',value:Math.round(trend.sample?trend.score:clamp(42+avg*.18+(hit-35)*.25,30,92)),learn:[['趨勢樣本',`${trend.sample} 筆`],['趨勢 PF',pf(trend.pf)],['趨勢命中',pct(trend.hit)]]},
    {code:'INT',label:'資金嗅覺',value:Math.round(money.sample?money.score:clamp(45+(hit-35)*.25+Math.min(10,x.effective/6),30,92)),learn:[['OI/Taker 樣本',`${money.sample} 筆`],['資金 PF',pf(money.pf)],['資金命中',pct(money.hit)]]},
    {code:'SEN',label:'深度感知',value:Math.round(depth.sample?depth.score:clamp(44+(hit-35)*.20+Math.min(12,x.blocked/12),30,92)),learn:[['Depth 樣本',`${depth.sample} 筆`],['阻擋樣本',`${x.blocked} 筆`],['Depth PF',pf(depth.pf)]]},
    {code:'VIT',label:'風險控管',value:Math.round(clamp(50*(1-riskConfidence)+riskRaw*riskConfidence+Math.min(10,x.effective/10),30,96)),learn:[['阻擋命中',pct(sh.blockedHitRate)],['阻擋樣本',`${x.blocked} 筆`],['排除率',pct(selectivity*100)]]},
    {code:'WIL',label:'耐心紀律',value:Math.round(clamp(48+selectivity*42+Math.min(10,x.effective/8)-Math.min(8,Number(sum.sample||0)/10),35,96)),learn:[['選擇性',pct(selectivity*100)],['真正通知',`${x.notified} 筆`],['去相關有效',`${x.effective} 筆`]]}
  ];
  const blockers={};
  for(const r of rows)for(const b of r.notificationGate?.blockers||r.risks||[])blockers[String(b)]=(blockers[String(b)]||0)+1;
  const blockerTop=Object.entries(blockers).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const personality=selectivity>=.67?'耐心獵手':selectivity>=.5?'嚴格篩選型':'積極研究型';
  const best=[...patterns].sort((a,b)=>Number(b.adjustment||0)-Number(a.adjustment||0)||Number(b.profitFactor||0)-Number(a.profitFactor||0))[0]||null;
  const worst=[...patterns].sort((a,b)=>Number(a.adjustment||0)-Number(b.adjustment||0)||Number(a.profitFactor||0)-Number(b.profitFactor||0))[0]||null;
  return {sh,sum,patterns,rows,x,level,stage,attrs,selectivity,blockerTop,personality,best,worst};
}
function skillLevel(count){
  const c=Number(count||0), cuts=[5,20,50,100,200]; let lv=1;
  for(const x of cuts)if(c>=x)lv++;
  const prev=lv===1?0:cuts[lv-2],next=cuts[lv-1]??400;
  return {lv,current:c,next,ratio:clamp((c-prev)/Math.max(1,next-prev)*100),rank:lv>=6?'大師':lv>=5?'專精':lv>=4?'熟練':lv>=3?'進階':'初階'};
}

function recordHistory(m){
  const arr=read(HISTORY_KEY,[])||[],today=dateKey();
  const entry={date:today,xp:m.x.xp,effective:m.x.effective,hit:has(m.sh.hitRate)?Number(m.sh.hitRate):null,pf:has(m.sh.profitFactor)?Number(m.sh.profitFactor):null};
  const keep=arr.filter(r=>r?.date&&r.date!==today).concat(entry).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-14);
  write(HISTORY_KEY,keep);return keep;
}
function historySvg(rows){
  const list=(rows||[]).filter(r=>has(r.xp)).slice(-7);
  if(list.length<2)return'<div class="r43-empty">再累積幾天，這裡會開始畫出研究經驗曲線。</div>';
  const w=420,h=110,p=12,min=Math.min(...list.map(r=>Number(r.xp))),max=Math.max(...list.map(r=>Number(r.xp))),span=Math.max(1,max-min);
  const pts=list.map((r,i)=>`${p+i*(w-p*2)/(list.length-1)},${h-p-(Number(r.xp)-min)/span*(h-p*2)}`).join(' ');
  return `<svg class="r43-history-chart" viewBox="0 0 ${w} ${h}"><polyline points="${pts}"/>${pts.split(' ').map(pt=>{const [x,y]=pt.split(',');return`<circle cx="${x}" cy="${y}" r="4"/>`}).join('')}</svg><div class="r43-history-foot"><span>${esc(list[0].date.slice(5))}</span><b>${fmt(list.at(-1).xp)} XP</b><span>${esc(list.at(-1).date.slice(5))}</span></div>`;
}
function updateLog(m){
  let hist=read(LOG_KEY,[])||[],prev=read(SNAP_KEY,null);
  const cur={effective:m.x.effective,shadow:Number(m.sh.sample||0),notified:m.x.notified,pf:Number(m.sh.profitFactor||0),stage:m.stage.name,forward:Number(mentor?.forward?.sample||0)};
  const add=msg=>{if(msg)hist.unshift({at:Date.now(),msg});hist=hist.slice(0,10)};
  if(prev){
    if(cur.effective>Number(prev.effective||0))add(`去相關有效 +${cur.effective-Number(prev.effective||0)}`);
    if(cur.shadow>Number(prev.shadow||0))add(`影子樣本 +${cur.shadow-Number(prev.shadow||0)}`);
    if(cur.notified>Number(prev.notified||0))add(`真正通知 +${cur.notified-Number(prev.notified||0)}`);
    if(cur.forward>Number(prev.forward||0))add(`Forward OOS +${cur.forward-Number(prev.forward||0)}`);
    if(cur.pf&&Math.abs(cur.pf-Number(prev.pf||0))>=.05)add(`影子 PF → ${cur.pf.toFixed(2)}`);
    if(cur.stage!==prev.stage)add(`成長階段 → ${cur.stage}`);
  }
  write(SNAP_KEY,cur);write(LOG_KEY,hist);return hist;
}

function abilityGlyph(i){
  const p=[
    '<path d="M16 4 27 10v12L16 28 5 22V10Z"/><path d="M10 16h12M16 10v12"/>',
    '<path d="M6 19c4-8 7-11 10-11 4 0 7 4 10 11"/><path d="M8 23h16"/><circle cx="16" cy="10" r="3"/>',
    '<circle cx="16" cy="16" r="10"/><path d="M16 5v7M16 20v7M5 16h7M20 16h7"/><circle cx="16" cy="16" r="3"/>',
    '<path d="M6 10c3-3 6-4 10-4s7 1 10 4M8 16c2-2 5-3 8-3s6 1 8 3M11 22c1.5-1 3-1.5 5-1.5s3.5.5 5 1.5"/><circle cx="16" cy="26" r="1.8"/>',
    '<path d="M16 4 27 9v8c0 6-4 10-11 13C9 27 5 23 5 17V9Z"/><path d="m11 17 3 3 7-8"/>',
    '<path d="M7 24h18M9 21l4-9 4 5 3-10 3 14"/>'
  ];
  return `<svg viewBox="0 0 32 32" aria-hidden="true">${p[clamp(i,0,5)]}</svg>`;
}
function crestSvg(){
  return `<svg class="r43-crest" viewBox="0 0 140 160"><defs><linearGradient id="r43Crystal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6ebff"/><stop offset=".43" stop-color="#76ace0"/><stop offset=".72" stop-color="#e3c376"/><stop offset="1" stop-color="#8b6735"/></linearGradient></defs><path d="M70 7 104 43 91 118 70 151 49 118 36 43Z" fill="none" stroke="#d2ae62" stroke-width="2"/><path d="M70 18 93 47 82 108 70 136 58 108 47 47Z" fill="url(#r43Crystal)" opacity=".90"/><path d="M70 18V136M47 47h46M58 108h24" stroke="#f0dca7" opacity=".72"/><circle cx="70" cy="78" r="8" fill="#173052" stroke="#f0d38b" stroke-width="2"/><path d="M70 62 75 74 88 78 75 82 70 95 65 82 52 78 65 74Z" fill="#f5dc98"/></svg>`;
}
function stageIcon(i){
  const paths=[
    '<path d="M50 10 82 28v38L50 88 18 66V28Z"/><path d="M50 24v50M34 38h32"/>',
    '<circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="18"/><path d="M50 8v20M50 72v20M8 50h20M72 50h20"/>',
    '<path d="M16 56 38 78 86 28"/><path d="M80 52v30H18V18h42"/>',
    '<path d="M14 76h72M18 66l16-30 14 20 12-36 20 46"/>',
    '<path d="M50 8 82 24v26c0 20-13 34-32 42C31 84 18 70 18 50V24Z"/><path d="m34 50 10 10 22-26"/>',
    '<path d="M50 10 58 34 82 42 58 50 50 76 42 50 18 42 42 34Z"/><circle cx="50" cy="50" r="36"/>'
  ];
  return `<svg viewBox="0 0 100 100">${paths[clamp(i,0,5)]}</svg>`;
}

function title(en,zh,sub=''){return `<div class="r43-title"><span>${esc(en)}</span><b>${esc(zh)}</b>${sub?`<i>${esc(sub)}</i>`:''}</div>`}
function evidence(label,value,sub,tone='gold'){return `<div class="r43-evidence ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub)}</small></div>`}
function progress(label,val,sub,tone='gold'){const p=clamp(val);return `<div class="r43-progress"><div><span>${esc(label)}</span><small>${esc(sub)}</small></div><b>${Math.round(p)}%</b><i><u class="${tone}" style="width:${p}%"></u></i></div>`}
function patternText(x){
  if(!x)return'尚未形成可學習模式';
  const f=x.features||{},dir=f.direction==='SHORT'?'空':'多',reg=({TREND_UP:'強多',TREND_DOWN:'強空',CHOP:'震盪',HIGH_VOL:'高波動',LIQUIDATION:'清算'})[f.regime]||f.regime||'未分類';
  return `${f.strategyLabel||x.key||'未分類'} · ${reg} · ${dir} · ${Number(x.sample||0)}筆 · 命中 ${pct(x.hitRate)} · PF ${pf(x.profitFactor)} · 權重 ${Number(x.adjustment||0)>0?'+':''}${Number(x.adjustment||0)}`;
}
function stateText(r){
  const s=String(r?.structure?.state||'').toUpperCase(),status=String(r?.status||''),risk=(r?.risks||[]).join(' ');
  if(s==='DESTROYED')return'結構已破壞'; if(s==='DAMAGED')return'結構受損'; if(s==='RECLAIMING')return'正在收復'; if(s==='OPPORTUNITY')return'深回踩機會';
  if(/回踩|TOUCHING/i.test(risk)||status==='TOUCHING')return'正在回踩'; if(s==='INTACT')return'結構完整';
  return r?.structure?.label||'持續觀察';
}

function abcCard(g,stats,row){
  const sample=Number(stats?.sample||0),goal=[20,50,100,200,300].find(x=>sample<x)||500,prev=[0,20,50,100,200,300].filter(x=>x<=sample).at(-1)||0,p=clamp((sample-prev)/Math.max(1,goal-prev)*100),adj=Number(stats?.adjustment||0);
  return `<article class="r43-abc ${g.toLowerCase()}"><header><strong>${g}</strong><div><b>${g}級</b><span>${esc(row?stateText(row):'等待新樣本')}</span></div><em>${adj>0?'+':''}${adj}</em></header><div class="r43-abc-exp"><span>EXP ${sample} / ${goal}</span><i><u style="width:${p}%"></u></i></div><footer><span>樣本 ${sample}</span><span>命中 ${pct(stats?.hitRate)}</span><span>PF ${pf(stats?.profitFactor)}</span></footer></article>`;
}
function liveRow(r){
  const score=clamp(r.executionScore||0);
  return `<div class="r43-live-row"><span class="grade ${String(r.grade||'C').toLowerCase()}">${esc(r.grade||'C')}</span><div><b>${esc(r.symbol)} · ${r.direction==='SHORT'?'空':'多'}</b><small>${esc(stateText(r))} · 執行 ${Math.round(score)} · ${esc(r.freshness||'')}</small></div><i><u style="width:${score}%"></u></i></div>`;
}
function candidateCard(r){
  const id=esc(String(r.id||`${r.symbol}-${r.direction}`));
  return `<details class="r43-candidate" data-key="candidate-${id}"><summary><span class="grade ${String(r.grade||'C').toLowerCase()}">${esc(r.grade||'C')}</span><div><b>${esc(r.symbol)} · ${r.direction==='SHORT'?'做空':'做多'}</b><small>${esc(stateText(r))} · ${esc(r.freshness||'')}</small></div><strong>${Math.round(Number(r.executionScore||0))}</strong><i>⌄</i></summary><div class="r43-candidate-body"><div class="r43-candidate-grid"><div><span>校準勝率</span><b>${pct(r.calibratedWinRate)}</b></div><div><span>觀察完成</span><b>${Math.round(Number(r.observationProgress||0))}%</b></div><div><span>結構</span><b>${esc(r.structure?.label||r.structure?.state||'—')}</b></div><div><span>通知層級</span><b>${esc(r.notificationTier||'—')}</b></div></div><div class="r43-reasons">${(r.reasons||[]).slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('')||'<span>等待更多支持條件</span>'}</div><div class="r43-intel"><button type="button" data-intel data-symbol="${esc(r.symbol)}" data-direction="${esc(r.direction||'LONG')}">查最新情報</button><div data-intel-body></div></div></div></details>`;
}
function intelBody(d,cached){
  const good=(d?.bullish||[]).slice(0,3),bad=(d?.bearish||[]).slice(0,3),watch=(d?.watch||[]).slice(0,3),news=(d?.news||[]).slice(0,3);
  return `<div class="r43-intel-summary"><span>${esc(d?.bias||'中性')} · ${esc(d?.strength||'—')}</span><b>${esc(d?.summary||d?.action||'暫無摘要')}</b><small>${cached?'2 小時快取':'剛剛更新'}</small></div><div class="r43-intel-cols"><div><b>利多</b>${good.length?good.map(x=>`<span>${esc(x)}</span>`).join(''):'<span>未見明確額外利多</span>'}</div><div><b>利空</b>${bad.length?bad.map(x=>`<span>${esc(x)}</span>`).join(''):'<span>未見明確額外利空</span>'}</div></div>${watch.length?`<div class="r43-watch"><b>接下來看</b>${watch.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}${news.length?`<div class="r43-watch"><b>今日消息</b>${news.map(x=>`<span>${esc(x.text||x)}</span>`).join('')}</div>`:''}`;
}
async function loadIntel(btn){
  const symbol=btn.dataset.symbol||'',direction=btn.dataset.direction||'LONG',key=`${symbol}:${direction}`,box=btn.closest('.r43-intel')?.querySelector('[data-intel-body]');
  if(!box)return;
  const cached=intelCache.get(key);
  if(cached&&Date.now()-cached.at<2*60*60*1000){box.innerHTML=intelBody(cached.data,true);return}
  btn.disabled=true;btn.textContent='同步情報…';
  try{
    const d=await getJson(`/api/symbol-analysis?symbol=${encodeURIComponent(symbol)}&direction=${encodeURIComponent(direction)}`,7000);
    intelCache.set(key,{at:Date.now(),data:d});box.innerHTML=intelBody(d,false);
  }catch(e){box.innerHTML=`<div class="r43-intel-error">情報離線 · ${esc(e?.message||'未知錯誤')}</div>`}
  finally{btn.disabled=false;btn.textContent='查最新情報'}
}

function restoreDetails(root){
  const saved=read(DETAILS_KEY,{});
  root.querySelectorAll('details[data-key]').forEach(d=>{if(Object.prototype.hasOwnProperty.call(saved,d.dataset.key))d.open=!!saved[d.dataset.key]});
}
function saveDetail(d){const saved=read(DETAILS_KEY,{});saved[d.dataset.key]=!!d.open;write(DETAILS_KEY,saved)}
function explore(){return read(EXPLORE_KEY,{lesson:false,candidate:false,journal:false})}
function markExplore(k){const x=explore();if(!x[k]){x[k]=true;write(EXPLORE_KEY,x);updateExploreUi()}}
function updateExploreUi(){
  const box=document.querySelector('.r43-path');if(!box)return;
  const x=explore(),done=['lesson','candidate','journal'].filter(k=>x[k]).length;
  box.querySelector('[data-path-count]').textContent=`${done} / 3`;
  box.querySelectorAll('[data-jump]').forEach(b=>b.classList.toggle('done',!!x[b.dataset.jump]));
}
function updateVisits(){
  const arr=read(VISIT_KEY,[])||[],set=new Set(arr);set.add(dateKey());write(VISIT_KEY,[...set].sort().slice(-30));
}
function recentVisits(days=7){
  const set=new Set(read(VISIT_KEY,[])||[]);let c=0;
  for(let i=0;i<days;i++){const d=new Date();d.setDate(d.getDate()-i);if(set.has(dateKey(d)))c++}
  return c;
}



function captureExactScroll(){
  return {x:window.scrollX||0,y:window.scrollY||0};
}
function restoreExactScroll(pos){
  if(!pos)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    window.scrollTo({left:pos.x||0,top:pos.y||0,behavior:'auto'});
  }));
}

function captureGrowthViewport(){
  const root=document.getElementById(ROOT_ID);if(!root)return null;
  const chapters=[...root.querySelectorAll('.v53-anchor')];
  if(!chapters.length)return null;
  let best=null,bestDist=Infinity;
  for(const el of chapters){
    const top=el.getBoundingClientRect().top,dist=Math.abs(top-16);
    if(dist<bestDist){bestDist=dist;best={id:el.id,top}}
  }
  return best;
}
function restoreGrowthViewport(a){
  if(!a)return;
  requestAnimationFrame(()=>{
    const el=document.getElementById(a.id);if(!el)return;
    const delta=el.getBoundingClientRect().top-a.top;
    if(Math.abs(delta)>1&&Math.abs(delta)<window.innerHeight*.9){
      window.scrollBy({top:delta,left:0,behavior:'auto'});
    }
  });
}




function ff51GameModel(m){
  const sh=m.sh||{}, act=perf?.actualSummary||{}, fw=mentor?.forward||{}, st=mentor?.stability||{}, co=mentor?.concentration||{};
  const hit=Number(sh.hitRate||0), p=Number(sh.profitFactor||0);
  const hitScore=clamp((hit-35)/30*100);
  const pfScore=clamp((p-.80)/1.20*100);
  const oosSample=Number(fw.sample||0),oosTarget=Math.max(1,Number(fw.target||40));
  const oosPF=Number(fw.netProfitFactor||0);
  const oosScore=clamp((oosSample/oosTarget)*55+((oosPF-.8)/.8)*45);
  const stability=clamp(Number(st.score||0));
  const diversity=clamp(Number(co.score||0));
  const actualResolved=Number(act.resolved||0);
  const proof=clamp(actualResolved/8*100);
  const rankScore=clamp(hitScore*.18+pfScore*.20+oosScore*.21+stability*.16+diversity*.15+proof*.10);
  const rank=rankScore>=90?'EX':rankScore>=78?'S':rankScore>=65?'A':rankScore>=50?'B':'C';
  const title=rank==='EX'?'極限戰略士':rank==='S'?'戰略大師':rank==='A'?'高階戰術士':rank==='B'?'戰術士':'見習戰術士';
  const ap=Math.round(m.x.effective*2+oosSample*3+actualResolved*25+m.x.notified*5+m.patterns.length*20);

  const effectivePct=clamp(m.x.effective/Math.max(1,m.stage.to)*100);
  const oosPct=clamp(oosSample/oosTarget*100);
  const stableTarget=Math.max(3,Number(st.totalFolds||5));
  const stablePct=clamp(Number(st.positiveFolds||0)/stableTarget*100);
  const concentrationPct=clamp(Number(co.score||0));
  const actualPct=clamp(actualResolved/5*100);

  const trials=[
    {key:'sample',name:'去相關試煉',sub:`有效樣本 ${m.x.effective} / ${m.stage.to}`,pct:effectivePct,clear:effectivePct>=100},
    {key:'oos',name:'時空試煉',sub:`Forward ${oosSample} / ${oosTarget} · PF ${pf(fw.netProfitFactor)}`,pct:oosPct,clear:oosPct>=100&&oosPF>=1.15},
    {key:'stable',name:'穩定試煉',sub:`正向窗口 ${Number(st.positiveFolds||0)} / ${stableTarget}`,pct:stablePct,clear:stablePct>=100},
    {key:'diversity',name:'泛化試煉',sub:`Top2 ${pct01(co.top2Share)} · Score ${Math.round(Number(co.score||0))}`,pct:concentrationPct,clear:concentrationPct>=70},
    {key:'proof',name:'實戰試煉',sub:`已結算實際建倉 ${actualResolved} / 5`,pct:actualPct,clear:actualPct>=100}
  ];
  const clearCount=trials.filter(x=>x.clear).length;
  const readiness=Math.round(trials.reduce((a,x)=>a+x.pct,0)/trials.length);

  const buffs=[];
  if(p>=1.15)buffs.push({name:'EDGE UP',sub:`Shadow PF ${pf(p)}`,tone:'good'});
  if(oosPF>=1.15&&oosSample>=Math.min(20,oosTarget))buffs.push({name:'OOS SYNC',sub:`Forward PF ${pf(oosPF)}`,tone:'good'});
  if(Number(co.score||0)>=70)buffs.push({name:'DIVERSITY',sub:`Concentration ${Math.round(Number(co.score||0))}`,tone:'good'});
  if(Number(st.score||0)>=70)buffs.push({name:'STABLE',sub:`Stability ${Math.round(Number(st.score||0))}`,tone:'good'});
  if(!buffs.length)buffs.push({name:'CALIBRATING',sub:'持續累積有效樣本',tone:'neutral'});

  const warnings=(mentor?.warnings||[]).slice(0,5).map(x=>({name:'DEBUFF',sub:String(x),tone:'bad'}));
  return {rankScore,rank,title,ap,trials,clearCount,readiness,buffs,warnings};
}
function ff51Trial(t,i){
  return `<article class="ff51-trial ${t.clear?'clear':'locked'}">
    <div class="ff51-trial-glyph"><span>${String(i+1).padStart(2,'0')}</span><i>${t.clear?'✓':'◇'}</i></div>
    <div><b>${esc(t.name)}</b><small>${esc(t.sub)}</small><em><u style="width:${clamp(t.pct)}%"></u></em></div>
    <strong>${t.clear?'CLEAR':Math.round(t.pct)+'%'}</strong>
  </article>`;
}
function ff51BattleRows(){
  const rows=Array.isArray(perf?.recent)?perf.recent.slice(0,8):[];
  if(!rows.length)return '<div class="ff51-empty">尚無已送出通知的戰鬥紀錄。</div>';
  return rows.map(r=>{
    const result=String(r.result||r.status||'ACTIVE').toUpperCase();
    const rr=has(r.realizedR)?`${Number(r.realizedR)>0?'+':''}${Number(r.realizedR).toFixed(2)}R`:'—';
    const tone=result==='WIN'?'win':result==='LOSS'?'loss':'active';
    return `<div class="ff51-battle ${tone}">
      <span>${r.direction==='SHORT'?'SHORT':'LONG'}</span>
      <b>${esc(r.symbol||'—')}</b>
      <small>${esc(result)}</small>
      <strong>${rr}</strong>
    </div>`;
  }).join('');
}


function saveGrowthCache(){
  try{
    const safePerf=perf?{
      ok:true,
      generatedAt:perf.generatedAt,
      summary:perf.summary||{},
      shadowSummary:perf.shadowSummary||{},
      actualSummary:perf.actualSummary||{},
      stateLearning:{
        ...(perf.stateLearning||{}),
        patterns:Array.isArray(perf?.stateLearning?.patterns)?perf.stateLearning.patterns.slice(0,80):[]
      },
      recent:Array.isArray(perf.recent)?perf.recent.slice(0,60):[]
    }:null;
    const safeManual=manual?{
      ok:true,
      shadowLearning:manual.shadowLearning||{},
      rows:Array.isArray(manual.rows)?manual.rows.slice(0,24):[]
    }:null;
    const safeSignals=signals?{
      ok:true,
      rows:Array.isArray(signals.rows)?signals.rows.slice(0,24):[]
    }:null;
    write(DATA_CACHE_KEY,{
      at:Date.now(),
      mentor:mentor||null,
      perf:safePerf,
      manual:safeManual,
      signals:safeSignals
    });
  }catch{}
}
function restoreGrowthCache(){
  const c=read(DATA_CACHE_KEY,null);
  if(!c||!c.at)return false;
  if(c.mentor)mentor=c.mentor;
  if(c.perf)perf=c.perf;
  if(c.manual)manual=c.manual;
  if(c.signals)signals=c.signals;
  lastFetchAt=Number(c.at||0);
  return !!(mentor||perf||manual||signals);
}

function render(){
  const root=ensureRoot();if(!root)return;

  const m=buildMetrics(),game=ff51GameModel(m);
  const sh=m.sh,sum=m.sum,act=perf?.actualSummary||{},tr=mentor?.training||{},
        fw=mentor?.forward||{},st=mentor?.stability||{},co=mentor?.concentration||{},
        mat=mentor?.maturity||{},strong=mentor?.strongest||{};
  const patterns=Array.isArray(perf?.stateLearning?.patterns)?perf.stateLearning.patterns:[];
  const abc=manual?.shadowLearning||{},by=abc.byGrade||[],manualRows=manual?.rows||[];
  const logs=updateLog(m);
  const openDetails=[...root.querySelectorAll('details[open][data-v54-open]')].map(x=>x.dataset.v54Open);
  const lvEl=document.getElementById('sgBrandLevelV2661');
  if(lvEl)lvEl.textContent=`Lv.${m.level.level}`;

  const maturity=clamp(Number(mat.score ?? game.rankScore ?? 0));
  const forwardSample=Number(fw.sample||0),forwardTarget=Math.max(1,Number(fw.target||40));
  const forwardPct=clamp(Number(fw.progressPct||forwardSample/forwardTarget*100));
  const stable=Number(st.positiveFolds||0),stableTarget=Math.max(5,Number(st.totalFolds||5));
  const actualResolved=Number(act.resolved||0);

  const stageText=String(mat.stage||m.stage.name||'研究中');
  const stageIndex5=/實戰|成熟|MASTER|LIVE/i.test(stageText)?4:
                    /穩定|EDGE/i.test(stageText)?3:
                    /FORWARD|OOS|驗證/i.test(stageText)?2:
                    /校準|成形/i.test(stageText)?1:0;
  const stages=['樣本收集','校準中','OOS 驗證','Edge 穩定','實戰成熟'];

  const pfScore=v=>clamp(45+(Number(v||1)-1)*55);
  const direction=Math.round(clamp(m.attrs?.[1]?.value ?? 50));
  const execution=Math.round(clamp(
    (m.attrs?.[0]?.value ?? 50)*.55+
    (Number(st.score||50))*.25+
    Math.min(20,actualResolved*3)
  ));
  const cost=Math.round(pfScore(tr.netProfitFactor));
  const regime=Math.round(clamp(Number(st.score||m.attrs?.[1]?.value||50)));
  const stability=Math.round(clamp(
    Number(st.score||50)*.62+
    pfScore(fw.netProfitFactor)*.25+
    Math.min(13,forwardSample/4)
  ));
  const risk=Math.round(clamp(m.attrs?.[4]?.value ?? Number(co.score||50)));

  const attrs=[
    {label:'方向辨識',score:direction,sub:'辨識趨勢與反轉',icon:1},
    {label:'執行品質',score:execution,sub:'只在條件一致時放行',icon:0},
    {label:'成本效率',score:cost,sub:'扣成本後仍保留 Edge',icon:2},
    {label:'Regime 適應',score:regime,sub:'跨市場環境保持有效',icon:3},
    {label:'穩定度',score:stability,sub:'跨時間窗可持續',icon:4},
    {label:'風險過濾',score:risk,sub:'降權集中與大訊號',icon:5}
  ];

  const generalize=clamp(Math.round(Number(co.score||50)));
  const edgeQuest=clamp(Math.round(pfScore(tr.netProfitFactor)));
  const stableQuest=clamp(Math.round(stable/Math.max(1,stableTarget)*100));
  const actualQuest=clamp(Math.round(actualResolved/5*100));

  const warnings=(mentor?.warnings||[]).slice(0,2);
  const best=[...patterns].sort((a,b)=>Number(b.adjustment||0)-Number(a.adjustment||0)||Number(b.profitFactor||0)-Number(a.profitFactor||0))[0]||null;
  const worst=[...patterns].sort((a,b)=>Number(a.adjustment||0)-Number(b.adjustment||0)||Number(a.profitFactor||0)-Number(b.profitFactor||0))[0]||null;
  const gradeStat=g=>by.find(x=>x.key===g)||{};

  const sig=JSON.stringify([
    m.level,maturity,stageIndex5,attrs.map(x=>x.score),
    sh.sample,sh.hitRate,sh.profitFactor,m.x.effective,m.x.eligible,m.x.blocked,
    tr.netProfitFactor,forwardSample,fw.netProfitFactor,stable,co.score,co.top2Share,
    sum.sample,act.sample,act.resolved,
    by.map(x=>[x.key,x.sample,x.hitRate,x.profitFactor,x.adjustment]),
    patterns.slice(0,8).map(x=>[x.key,x.sample,x.hitRate,x.profitFactor,x.adjustment]),
    manualRows.slice(0,4).map(x=>[x.id,x.symbol,x.grade,x.executionScore,x.structure?.state]),
    warnings
  ]);
  if(sig===lastSig&&root.children.length)return;
  const viewport=captureGrowthViewport();
  const exactScroll=captureExactScroll();
  lastSig=sig;

  const eyeIcon=`<span class="v59-diamond v59-system-icon" aria-hidden="true"></span>`;
  const questGlyph=key=>{
    const icons={
      generalize:'<svg viewBox="0 0 32 32"><circle cx="8" cy="16" r="2.5"/><circle cx="24" cy="9" r="2.5"/><circle cx="24" cy="23" r="2.5"/><path d="M10.5 15 21.5 10.2M10.5 17 21.5 21.8"/></svg>',
      edge:'<svg viewBox="0 0 32 32"><path d="m18 5-8 12h6l-2 10 8-13h-6l2-9Z"/></svg>',
      oos:'<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="4"/><path d="M16 4v4M16 24v4M4 16h4M24 16h4"/></svg>',
      stable:'<svg viewBox="0 0 32 32"><path d="M16 5 24 8.5v7c0 5-3.3 8.4-8 11-4.7-2.6-8-6-8-11v-7L16 5Z"/><path d="M11.5 16h9"/></svg>',
      actual:'<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/><path d="m11 16 3.2 3.2L21.5 12"/></svg>'
    };
    return icons[key]||icons.generalize;
  };
  const quest=(key,title,p,sub,rule,current)=>`<details class="v54-quest" data-v54-open="quest-${key}">
    <summary>
      <div class="v60-quest-icon q-${key}">${questGlyph(key)}</div>
      <div><b>${esc(title)}</b><small>${esc(sub)}</small><i><u style="width:${clamp(p)}%"></u></i></div>
      <strong>${Math.round(clamp(p))}%</strong><em>⌄</em>
    </summary>
    <div class="v54-quest-detail">
      <div><span>目前數值</span><b>${esc(current)}</b></div>
      <div><span>晉階規則</span><b>${esc(rule)}</b></div>
      <p>${Math.round(clamp(p))>=100?'已達標，系統仍會持續監控是否失效。':'尚未達標；後台會繼續收樣本、驗證並更新權重。'}</p>
    </div>
  </details>`;

  root.innerHTML=`
  <section class="v53-card v53-hero v53-anchor" id="v53-overview">
    <div class="v53-hero-title v55-master-head">
      <div class="v53-emblem">${eyeIcon}</div>
      <div>
        <h2>系統養成</h2>
        <span>SYSTEM GROWTH MASTERY</span>
      </div>
      <strong>Lv.${m.level.level}</strong>
    </div>

    <div class="v53-summary">
      <div><span>目前階段</span><b>Lv.${m.level.level}</b><small>${esc(stageText)}</small></div>
      <div><span>成熟度</span><b class="gold">${Math.round(maturity)}%</b><small>${esc(strong.label||'局部 Edge')}</small></div>
      <div><span>Train Net PF</span><b>${pf(tr.netProfitFactor)}</b><small>成本後 Edge</small></div>
      <div><span>Forward OOS</span><b class="blue">${pf(fw.netProfitFactor)}</b><small>${fmt(forwardSample)}/${fmt(forwardTarget)} SAMPLE</small></div>
    </div>

    <div class="v53-warning ${warnings.length?'':'quiet'}">
      <i>ⓘ</i><span>${warnings.length?warnings.map(esc).join(' · '):'目前沒有重大研究警告，持續累積有效樣本。'}</span>
    </div>
  </section>

  <section class="v53-card v53-anchor" id="v53-status">
    <div class="v53-section-head">
      <div class="v53-section-icon">${abilityGlyph(4)}</div>
      <div><h3>角色狀態</h3><p>ROLE MASTERY</p></div>
      <strong class="v55-head-meta">${Math.round((attrs.reduce((a,x)=>a+x.score,0))/Math.max(1,attrs.length))} AVG</strong>
    </div>

    <div class="v53-attrs">
      ${attrs.map((a,i)=>{
        const src=m.attrs?.[a.icon]?.learn||m.attrs?.[i]?.learn||[];
        return `<details class="v54-attr" data-v54-open="attr-${i}">
          <summary>
            <div class="v53-attr-icon">${abilityGlyph(a.icon)}</div>
            <div><b>${esc(a.label)}</b><small>${esc(a.sub)}</small></div>
            <strong>${a.score}</strong>
            <em>⌄</em>
            <i><u style="width:${a.score}%"></u></i>
          </summary>
          <div class="v54-attr-detail">
            <div class="v54-detail-caption"><span>LEARNING SOURCE</span><b>目前學習依據</b></div>
            ${(src.length?src:[['目前能力分數',String(a.score)],['狀態','持續學習中']]).map(([k,v])=>`<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
          </div>
        </details>`;
      }).join('')}
    </div>
  </section>

  <section class="v53-card v53-anchor" id="v53-growth">
    <div class="v53-section-head">
      <div class="v53-section-icon">${abilityGlyph(1)}</div>
      <div><h3>成長進度</h3><p>GROWTH MASTERY</p></div>
      <strong class="v55-head-meta">${Math.round(maturity)}%</strong>
    </div>

    <div class="v53-stages">
      ${stages.map((s,i)=>`<div class="${i<stageIndex5?'done':i===stageIndex5?'current':''}">
        <i>${i<stageIndex5?'✓':i+1}</i><b>${esc(s)}</b><small>${i<stageIndex5?'完成':i===stageIndex5?'現在':'未解鎖'}</small>
      </div>`).join('')}
    </div>

    <div class="v53-overall">
      <div><b>整體進度 ${Math.round(maturity)}%</b><span>${esc(stageText)}</span></div>
      <i><u style="width:${maturity}%"></u></i>
    </div>

    <div class="v53-now"><b>現在：</b><span>${stageIndex5===0?'持續收集有效樣本':stageIndex5===1?'持續累積乾淨、去相關樣本。':stageIndex5===2?'用新資料驗證 Forward OOS。':stageIndex5===3?'檢查跨時間穩定與成本後 Edge。':'實戰驗證與長期泛化。'}</span></div>
  </section>

  <section class="v53-card v53-anchor" id="v53-quests">
    <div class="v53-section-head">
      <div class="v53-section-icon">${abilityGlyph(2)}</div>
      <div><h3>主線任務</h3><p>ASCENSION QUEST</p></div>
      <strong class="v55-head-meta">${Math.round(game.readiness)}%</strong>
    </div>

    <div class="v53-quests">
      ${quest('generalize','提升泛化能力',generalize,`Top2 ${pct01(co.top2Share)} · Concentration Score ${Math.round(Number(co.score||0))}`,'Concentration Score ≥ 70，並降低 Top2 集中度',`Score ${Math.round(Number(co.score||0))} · Top2 ${pct01(co.top2Share)}`)}
      ${quest('edge','強化成本後 Edge',edgeQuest,`Train Net PF ${pf(tr.netProfitFactor)}`,'Train Net PF 站上 1.00；理想維持 ≥ 1.15',`Train Net PF ${pf(tr.netProfitFactor)}`)}
      ${quest('oos','完成 Forward OOS',forwardPct,`${fmt(forwardSample)} / ${fmt(forwardTarget)} · PF ${pf(fw.netProfitFactor)}`,'Forward 樣本達目標，且 OOS PF 不失效',`${fmt(forwardSample)} / ${fmt(forwardTarget)} · PF ${pf(fw.netProfitFactor)}`)}
      ${quest('stable','通過穩定窗口',stableQuest,`${fmt(stable)} / ${fmt(stableTarget)} 正向窗口`,'跨時間正向窗口達標，避免只在單一時段有效',`${fmt(stable)} / ${fmt(stableTarget)} positive folds`)}
      ${quest('actual','累積實戰佐證',actualQuest,`${fmt(actualResolved)} / 5 已結算實際建倉`,'至少 5 筆已結算實際建倉，持續校驗通知與實戰落差',`${fmt(actualResolved)} / 5 resolved`)}
    </div>
  </section>

  <section class="v53-duo v53-anchor" id="v53-training">
    <section class="v53-card">
      <div class="v53-section-head compact">
        <div class="v53-section-icon">${abilityGlyph(3)}</div>
        <div><h3>每日訓練</h3><p>DAILY TRAINING</p></div>
        <strong class="v55-head-meta">ACTIVE</strong>
      </div>
      <div class="v53-training">
        ${[
          ['effective','去相關樣本更新',m.x.effective>=m.stage.to?'完成':'進行中',`有效 ${fmt(m.x.effective)} / Eligible ${fmt(m.x.eligible)}；持續排除重複與高度相關樣本。`],
          ['oos','Forward OOS 驗證',forwardPct>=100?'完成':'進行中',`Forward ${fmt(forwardSample)} / ${fmt(forwardTarget)}，目前 PF ${pf(fw.netProfitFactor)}。`],
          ['regime','Regime 穩定性檢查',stable>=3?'持續':'累積中',`目前 ${fmt(stable)} 個正向時間窗口，持續檢查跨市場環境。`],
          ['loss','失敗樣本回顧','持續',`失敗樣本保留，用來更新 Pattern、阻擋規則與降權依據。`],
          ['concentration','集中度降權',Number(co.score||0)>=70?'達標':'進行中',`Top2 ${pct01(co.top2Share)}，Concentration Score ${Math.round(Number(co.score||0))}。`]
        ].map(([k,t,s,d])=>`<details class="v54-training" data-v54-open="training-${k}">
          <summary><span>${esc(t)}</span><b>${esc(s)}</b><i>⌄</i></summary>
          <div>${esc(d)}</div>
        </details>`).join('')}
      </div>
    </section>

    <section class="v53-card">
      <div class="v53-section-head compact">
        <div class="v53-section-icon">${abilityGlyph(5)}</div>
        <div><h3>最近成長紀錄</h3><p>GROWTH MEMORY</p></div>
        <strong class="v55-head-meta">${fmt(logs.length)} LOG</strong>
      </div>
      <div class="v53-logs">
        ${logs.length?logs.slice(0,7).map(x=>`<div><time>${new Date(x.at).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})}</time><span>${esc(x.msg)}</span></div>`).join(''):'<div class="v53-empty">等待新的有效變化</div>'}
      </div>
    </section>
  </section>

  <details class="v53-card v53-research v53-anchor" id="v53-research">
    <summary><div class="v55-advanced-title"><span class="v59-diamond v59-research-icon" aria-hidden="true"></span><div><b>進階研究資料</b><small>ADVANCED RESEARCH · ABC / PERFORMANCE / PATTERN</small></div></div><i>⌄</i></summary>
    <div class="v53-research-body">
      <div class="v53-research-stats">
        <div><span>Shadow Sample</span><b>${fmt(sh.sample)}</b><small>Hit ${pct(sh.hitRate)}</small></div>
        <div><span>Effective</span><b>${fmt(m.x.effective)}</b><small>Eligible ${fmt(m.x.eligible)}</small></div>
        <div><span>Actual Trade</span><b>${fmt(act.sample)}</b><small>Resolved ${fmt(act.resolved||0)}</small></div>
        <div><span>Patterns</span><b>${fmt(patterns.length)}</b><small>Top2 ${pct01(co.top2Share)}</small></div>
      </div>

      <div class="v53-research-cols">
        <div>
          <h4>ABC 戰術學習</h4>
          <div class="v53-abc">
            ${['A','B','C'].map(g=>{const s=gradeStat(g);return `<div><strong>${g}</strong><span>Sample ${fmt(s.sample||0)}</span><b>Hit ${pct(s.hitRate)}</b><small>PF ${pf(s.profitFactor)} · ${Number(s.adjustment||0)>0?'+':''}${Number(s.adjustment||0)}</small></div>`}).join('')}
          </div>
        </div>

        <div>
          <h4>模式學習</h4>
          <div class="v53-patterns">
            <div><span>最佳模式</span><b>${esc(best?patternText(best):'累積中')}</b></div>
            <div><span>需降權</span><b>${esc(worst?patternText(worst):'累積中')}</b></div>
            <div><span>影子候選</span><b>${fmt(manualRows.length)} 個</b></div>
          </div>
        </div>
      </div>

      <div class="v54-game-research">
        <div>
          <h4>狀態效果</h4>
          <div class="v54-effects">
            ${game.buffs.map(x=>`<div class="good"><i>↑</i><span><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span></div>`).join('')}
            ${game.warnings.slice(0,3).map(x=>`<div class="bad"><i>↓</i><span><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></span></div>`).join('')}
          </div>
        </div>
        <div>
          <h4>晉階試煉</h4>
          <div class="v54-trials">
            ${game.trials.map(t=>`<div class="${t.clear?'clear':''}"><span>${esc(t.name)}</span><b>${t.clear?'CLEAR':Math.round(t.pct)+'%'}</b><i><u style="width:${clamp(t.pct)}%"></u></i></div>`).join('')}
          </div>
        </div>
      </div>

      <div class="v53-recent-title">最近通知績效</div>
      <div class="v53-recent">
        ${(perf?.recent||[]).slice(0,6).map(r=>`<div>
          <span>${r.direction==='SHORT'?'SHORT':'LONG'}</span>
          <b>${esc(r.symbol||'—')}</b>
          <small>${esc(String(r.result||r.status||'ACTIVE').toUpperCase())}</small>
          <strong>${has(r.realizedR)?`${Number(r.realizedR)>0?'+':''}${Number(r.realizedR).toFixed(2)}R`:'—'}</strong>
        </div>`).join('')||'<div class="v53-empty">尚無已送出通知績效。</div>'}
      </div>
    </div>
  </details>`;

  for(const key of openDetails){
    const d=root.querySelector(`details[data-v54-open="${key}"]`);
    if(d)d.open=true;
  }
  root.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{lastUserAt=Date.now()}));
  restoreGrowthViewport(viewport);
  restoreExactScroll(exactScroll);
  requestAnimationFrame(()=>maintainExternalUi());
}async function getJson(url,timeout=7000){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);
  try{
    const r=await fetch(url,{cache:'no-store',signal:c.signal});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);
    return d;
  }finally{clearTimeout(t)}
}
async function refresh(force=false){
  const now=Date.now();
  if(busy)return;
  if(!force&&now-lastFetchAt<MIN_REFRESH_MS)return;
  if(!force&&now-lastUserAt<USER_IDLE_MS)return;
  busy=true;

  const panel=document.getElementById('sgPanel');
  const exact=force?captureExactScroll():null;

  try{
    const res=await Promise.allSettled([
      getJson('/api/shadow-mentor',8000),
      getJson('/api/performance',8000),
      getJson('/api/manual-opportunities',6500),
      getJson('/api/test-signals',5500)
    ]);

    if(res[0].status==='fulfilled')mentor=res[0].value;
    if(res[1].status==='fulfilled')perf=res[1].value;
    if(res[2].status==='fulfilled')manual=res[2].value;
    if(res[3].status==='fulfilled')signals=res[3].value;

    lastFetchAt=Date.now();
    saveGrowthCache();

    const visible=panel&&!panel.hidden;

    if(force){
      render();
      pendingSnapshot=false;
      restoreExactScroll(exact);
    }else if(visible){
      const root=document.getElementById(ROOT_ID);
      if(!root||!root.children.length){
        render();
        pendingSnapshot=false;
      }else{
        // Visible UI never changes from an automatic refresh.
        pendingSnapshot=true;
      }
    }else{
      render();
      pendingSnapshot=false;
    }
  }catch(e){
    console.warn('[growth-v2661]',String(e?.message||e));
  }finally{
    busy=false;
  }
}





function exactLabelNodes(label){
  const out=[];
  for(const el of document.querySelectorAll('h1,h2,h3,h4,h5,b,strong,span,div')){
    if((el.textContent||'').trim()===label)out.push(el);
  }
  return out.filter(el=>{
    try{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}catch{return true}
  });
}

function findOriginalStructureHeader(label){
  let el=label;
  for(let depth=0;el&&depth<8;depth++,el=el.parentElement){
    const txt=(el.textContent||'').trim();
    const r=el.getBoundingClientRect?.();
    if(r && r.height>=32 && r.height<=140 && txt.includes('結構記憶') && /SAMPLE/i.test(txt)){
      return el;
    }
  }
  return null;
}

function findOriginalStructureDiamond(header,label){
  if(!header||!label)return null;
  const lr=label.getBoundingClientRect();
  const candidates=[];

  // Search inside header first, then one parent level only.
  const scopes=[header,header.parentElement].filter(Boolean);
  for(const scope of scopes){
    for(const el of scope.querySelectorAll('span,div,i')){
      if(el===label||el.contains(label)||label.contains(el))continue;
      if(el.classList.contains('v61-structure-original-diamond'))return el;
      if(el.classList.contains('v59-heading-diamond')||
         el.classList.contains('v58-external-diamond')||
         el.classList.contains('v57-shared-diamond')||
         el.classList.contains('v60-structure-icon'))continue;

      if((el.textContent||'').trim())continue;
      const r=el.getBoundingClientRect();
      if(r.width<16||r.width>58||r.height<16||r.height>58||Math.abs(r.width-r.height)>10)continue;

      // Must be to the left of the title and vertically aligned with it.
      if(r.right>lr.left+12)continue;
      const vertical=Math.abs((r.top+r.height/2)-(lr.top+lr.height/2));
      if(vertical>52)continue;

      const cs=getComputedStyle(el);
      const hasBorder=[cs.borderTopWidth,cs.borderRightWidth,cs.borderBottomWidth,cs.borderLeftWidth]
        .some(v=>(parseFloat(v)||0)>=1);
      const rotated=cs.transform&&cs.transform!=='none';
      const cls=String(el.className||'').toLowerCase();

      if(!(hasBorder||rotated||cls.includes('diamond')))continue;

      const score=vertical*3 + Math.abs(lr.left-r.right);
      candidates.push([score,el]);
    }
  }

  candidates.sort((a,b)=>a[0]-b[0]);
  return candidates[0]?.[1]||null;
}

function restoreStructureHeader(){
  // Remove only icons injected by our previous patches.
  document.querySelectorAll('.v59-heading-diamond,.v58-external-diamond,.v57-shared-diamond,.v60-structure-icon')
    .forEach(el=>el.remove());

  // Remove only our own layout classes from the previous patch.
  document.querySelectorAll('.v60-structure-head,.v60-structure-card,.v60-structure-title-group,.v60-structure-sample,.v60-structure-inner-title,.v60-structure-inner-kicker')
    .forEach(el=>{
      el.classList.remove(
        'v60-structure-head','v60-structure-card','v60-structure-title-group',
        'v60-structure-sample','v60-structure-inner-title','v60-structure-inner-kicker'
      );
    });

  const labels=exactLabelNodes('結構記憶');
  for(const label of labels){
    const header=findOriginalStructureHeader(label);
    if(!header)continue;

    const diamond=findOriginalStructureDiamond(header,label);
    if(!diamond)continue;

    // DO NOT alter header children, grid/flex, SAMPLE or title positions.
    // Only mark the existing diamond.
    diamond.classList.add('v61-structure-original-diamond');
    return;
  }
}

function removeLockUi(){
  const els=[...document.querySelectorAll('button,a,div,span,i')];
  for(const el of els){
    const text=(el.textContent||'').trim().toLowerCase();
    const meta=[
      el.id||'',el.className||'',el.getAttribute?.('aria-label')||'',
      el.getAttribute?.('title')||'',el.getAttribute?.('data-role')||'',
      el.getAttribute?.('data-action')||''
    ].join(' ').toLowerCase();

    const removeByMeta=meta.includes('lock')||text==='🔒'||text==='lock';
    let removeByShape=false;
    try{
      const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
      const small=r.width>10&&r.width<=64&&r.height>10&&r.height<=64;
      const nearRight=(window.innerWidth-r.right)<=30;
      const nearBottom=(window.innerHeight-r.bottom)<=115;
      const roundish=parseFloat(cs.borderTopLeftRadius||'0')>=18;
      removeByShape=(cs.position==='fixed'||cs.position==='sticky')&&small&&nearRight&&nearBottom&&roundish;
    }catch{}
    if(removeByMeta||removeByShape)el.remove();
  }
}

function maintainExternalUi(){
  removeLockUi();
  restoreStructureHeader();
}

let v61UiFixTimer=null;
function startUiFixers(){
  maintainExternalUi();
  setTimeout(maintainExternalUi,250);
  setTimeout(maintainExternalUi,900);
  setTimeout(maintainExternalUi,2200);

  if(v61UiFixTimer)clearInterval(v61UiFixTimer);
  let runs=0;
  v61UiFixTimer=setInterval(()=>{
    maintainExternalUi();
    if(++runs>=18){
      clearInterval(v61UiFixTimer);
      v61UiFixTimer=null;
    }
  },2500);
}

function boot(){
  const panel=ensureShell();if(!panel)return;
  updateVisits();ensureRoot();

  const cached=restoreGrowthCache();
  if(cached)render();

  startUiFixers();

  const noteUser=()=>{lastUserAt=Date.now()};
  document.addEventListener('pointerdown',noteUser,{capture:true,passive:true});
  document.addEventListener('touchstart',noteUser,{capture:true,passive:true});
  document.addEventListener('keydown',noteUser,{capture:true});

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#sgBrandToggleV2661')){
      e.preventDefault();
      toggleGrowth();
    }
  },true);

  // First network fetch is non-forced. If growth is visible, data is staged only.
  void refresh(false);

  window.addEventListener('pageshow',()=>{
    startUiFixers();
    void refresh(false);
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      startUiFixers();
      void refresh(false);
    }
  });

  timer=setInterval(()=>{
    if(document.visibilityState==='visible')void refresh(false);
  },AUTO_REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

window.GrowthRpgV2661={version:VERSION,refresh};
})();