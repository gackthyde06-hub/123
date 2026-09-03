(()=>{
'use strict';
const VERSION='2.6.24';
const ROOT_ID='sgStatusV2624';
const HISTORY_KEY='sg-v2624-growth-log';
const SNAP_KEY='sg-v2624-growth-snapshot';
let mentor=null,busy=false,lastFetch=0,lastRenderSig='';
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number(v)||0));
const pct=v=>num(v)==null?'—':`${Number(v).toFixed(0)}%`;
const pf=v=>num(v)==null?'—':Number(v).toFixed(2);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nowTime=()=>new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false});
function icon(name){
  const paths={
    eye:'<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/>',
    compass:'<circle cx="12" cy="12" r="8.2"/><path d="m15.7 8.3-2.1 5.3-5.3 2.1 2.1-5.3 5.3-2.1Z"/>',
    sword:'<path d="m14.8 3.2 6-1.2-1.2 6-9.7 9.7-3.6-3.6 8.5-10.9Z"/><path d="m5.4 13.2-2.6 2.6 5.4 5.4 2.6-2.6M3.4 20.6l3-3"/>',
    coins:'<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v4c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 9v4c0 1.7 3.1 3 7 3s7-1.3 7-3V9M5 13v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4"/>',
    cycle:'<path d="M19 7V3l-2 2a8 8 0 0 0-12.4 3M5 17v4l2-2a8 8 0 0 0 12.4-3"/><path d="M21 11a8 8 0 0 1-.6 3M3 13a8 8 0 0 1 .6-3"/>',
    shield:'<path d="M12 2 5 5v5c0 5 3 9 7 12 4-3 7-7 7-12V5l-7-3Z"/><path d="m9 12 2 2 4-5"/>',
    filter:'<path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z"/>',
    route:'<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 5h6c3 0 4 2 4 4s-1 4-4 4H9c-3 0-4 2-4 4v0"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2V0M22 12h2M12 22v2M2 12H0"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.7L16.5 9"/>',
    hourglass:'<path d="M6 2h12M6 22h12M7 2c0 5 2 6 5 10-3 4-5 5-5 10M17 2c0 5-2 6-5 10 3 4 5 5 5 10"/>',
    chart:'<path d="M4 19V5M4 19h16"/><path d="m7 15 4-4 3 2 5-7"/>',
    book:'<path d="M4 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4V4Z"/><path d="M20 4h-3a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h3V4Z"/>',
    spark:'<path d="m12 2 1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z"/>',
    lock:'<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.spark}</svg>`;
}
function stageIndex(m){const s=String(m?.stage||'');if(/實戰|成熟|Live|Master/i.test(s))return 4;if(/穩定/.test(s))return 3;if(/Forward|OOS|驗證/.test(s))return 2;if(/校準|成形|Edge/.test(s))return 1;return 0}
function stageName(i){return ['樣本收集','校準中','OOS 驗證','Edge 穩定','實戰成熟'][clamp(i,0,4)]}
function readRadar(){
  const p=document.getElementById('sgPanel');if(!p)return [];
  const labels=[...p.querySelectorAll('.sg-radar-label')].map(x=>String(x.textContent||'').trim()).filter(Boolean);
  const values=[...p.querySelectorAll('.sg-radar-value')].map(x=>num(String(x.textContent||'').replace(/[^0-9.-]/g,'')));
  const fallback=['方向辨識','執行品質','成本效率','Regime 適應','穩定度','風險過濾'];
  return fallback.map((label,i)=>({label:labels[i]||label,value:values[i]??null}));
}
function scoreFromPf(v){if(num(v)==null)return 45;return clamp(45+(Number(v)-1)*55)}
function getAttrs(m){
  const radar=readRadar(),st=m?.stability||{},co=m?.concentration||{},tr=m?.training||{},fw=m?.forward||{};
  const defaults=[
    ['方向辨識','compass',radar[0]?.value??Math.round(clamp(48+Number(m?.maturity?.score||0)*.42)),'辨識趨勢與反轉'],
    ['執行品質','sword',radar[1]?.value??Math.round(clamp(52+Number(st.score||50)*.35)),'條件一致才放行'],
    ['成本效率','coins',Math.round(scoreFromPf(tr.netProfitFactor)),'扣成本後仍有 Edge'],
    ['Regime 適應','cycle',radar[3]?.value??Math.round(clamp(Number(st.score||50))),'切換市場環境'],
    ['穩定度','shield',Math.round(clamp(Number(st.score||50))),'跨時間窗可持續'],
    ['風險過濾','filter',radar[5]?.value??Math.round(clamp(Number(co.score||50))),'淘汰不良訊號']
  ];
  return defaults.map(x=>({label:x[0],icon:x[1],value:clamp(x[2]),sub:x[3]}));
}
function questData(m){
  const tr=m?.training||{},fw=m?.forward||{},st=m?.stability||{},co=m?.concentration||{},maturity=Number(m?.maturity?.score||0);
  const generalize=clamp(Math.round((Number(co.score||50)*.52)+(Number(st.score||50)*.28)+(maturity*.20)));
  const cost=clamp(Math.round(scoreFromPf(tr.netProfitFactor)*.58+scoreFromPf(fw.netProfitFactor)*.42));
  const fwd=clamp(Number(fw.progressPct||0));
  return [
    {icon:'spark',title:'提升 A 級泛化能力',sub:'降低單一標的集中，讓優勢跨市場成立。',value:generalize,tone:'gold'},
    {icon:'shield',title:'強化成本後 Edge',sub:'只保留扣成本後仍有正期望的模式。',value:cost,tone:cost>=60?'gold':'blue'},
    {icon:'target',title:'完成 Forward OOS 驗證',sub:'讓未見過的新資料驗證舊 Edge。',value:fwd,tone:'blue'}
  ];
}
function trainingRows(m){
  const fw=m?.forward||{},st=m?.stability||{},co=m?.concentration||{},strong=m?.strongest||{};
  return [
    {icon:'coins',label:'去相關樣本更新',state:Number(m?.training?.sample||0)>=250?'完成':'進行中',cls:Number(m?.training?.sample||0)>=250?'ok':'run'},
    {icon:'shield',label:'Regime 穩定性檢查',state:Number(st.positiveFolds||0)>=2?'完成':'進行中',cls:Number(st.positiveFolds||0)>=2?'ok':'run'},
    {icon:'eye',label:'高 Edge 候選追蹤',state:strong?.label?'進行中':'等待',cls:strong?.label?'run':'wait'},
    {icon:'book',label:'失敗樣本回顧',state:Number(fw.netProfitFactor||0)>=1?'持續':'待補強',cls:Number(fw.netProfitFactor||0)>=1?'run':'warn'},
    {icon:'filter',label:'集中度降權',state:Number(co.top2Share||0)<=.45?'完成':'進行中',cls:Number(co.top2Share||0)<=.45?'ok':'run'}
  ];
}
function growthLog(m){
  let hist=[];try{hist=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');if(!Array.isArray(hist))hist=[]}catch{hist=[]}
  let prev=null;try{prev=JSON.parse(localStorage.getItem(SNAP_KEY)||'null')}catch{}
  const cur={sample:Number(m?.training?.sample||0),forward:Number(m?.forward?.sample||0),maturity:Number(m?.maturity?.score||0),stage:String(m?.maturity?.stage||''),pf:Number(m?.training?.netProfitFactor||0),fpf:Number(m?.forward?.netProfitFactor||0),folds:Number(m?.stability?.positiveFolds||0),top2:Number(m?.concentration?.top2Share||0)};
  const add=msg=>{if(!msg)return;hist.unshift({at:Date.now(),time:nowTime(),msg});hist=hist.slice(0,8)};
  if(prev){
    if(cur.sample>Number(prev.sample||0))add(`新增 ${cur.sample-Number(prev.sample||0)} 筆去相關有效樣本`);
    if(cur.forward>Number(prev.forward||0))add(`Forward OOS 新增 ${cur.forward-Number(prev.forward||0)} 筆驗證樣本`);
    if(cur.maturity>Number(prev.maturity||0))add(`成熟度提升至 ${cur.maturity}%`);
    if(cur.stage&&cur.stage!==prev.stage)add(`成長階段更新：${cur.stage}`);
    if(cur.folds>Number(prev.folds||0))add(`穩定窗口通過數提升至 ${cur.folds}`);
    if(cur.pf>Number(prev.pf||0)+.05)add(`Train Net PF 改善至 ${cur.pf.toFixed(2)}`);
    if(cur.fpf>Number(prev.fpf||0)+.05)add(`Forward Net PF 改善至 ${cur.fpf.toFixed(2)}`);
    if(cur.top2>0&&Number(prev.top2||0)>0&&cur.top2<Number(prev.top2)-.03)add(`Top2 集中度下降至 ${(cur.top2*100).toFixed(0)}%`);
  }
  if(!hist.length){
    if(m?.strongest?.label)add(`目前最強 Edge：${String(m.strongest.label).slice(0,28)}`);
    add(`系統正在 ${stageName(stageIndex(m?.maturity))}`);
  }
  try{localStorage.setItem(HISTORY_KEY,JSON.stringify(hist));localStorage.setItem(SNAP_KEY,JSON.stringify(cur))}catch{}
  return hist.slice(0,4);
}
function overallProgress(m){
  const i=stageIndex(m?.maturity),base=[8,28,48,70,90][i]||8,within=clamp(Number(m?.maturity?.score||0));return clamp(Math.round(base+within*.18),0,100)
}
function mount(){
  const panel=document.getElementById('sgPanel');if(!panel)return null;
  let root=document.getElementById(ROOT_ID);if(root)return root;
  root=document.createElement('section');root.id=ROOT_ID;root.className='sg-v2624';
  panel.prepend(root);return root;
}
function hideLegacyDecor(){
  document.querySelectorAll('.sg-rpg-core-v2623,.sg-rpg-skills-v2623,.sg-rpg-mentor-v2623').forEach(x=>x.setAttribute('hidden',''));
  document.getElementById('mentorGrowthV2622')?.setAttribute('hidden','');
}
function render(){
  const root=mount();if(!root||!mentor?.ok)return;hideLegacyDecor();
  const m=mentor,mat=m.maturity||{},tr=m.training||{},fw=m.forward||{},st=m.stability||{},co=m.concentration||{},attrs=getAttrs(m),quests=questData(m),trainRows=trainingRows(m),logs=growthLog(m),idx=stageIndex(mat),progress=overallProgress(m),target=Math.max(1,Number(fw.target||150)),stableTarget=Math.max(5,Number(st.totalFolds||0),5),stableNow=Math.min(Number(st.positiveFolds||0),stableTarget),sampleTarget=500,sampleNow=Number(tr.sample||0);
  const sig=JSON.stringify([mat.score,mat.stage,tr.sample,tr.netProfitFactor,tr.netExpectancyR,fw.sample,fw.netProfitFactor,fw.progressPct,st.score,st.positiveFolds,st.totalFolds,co.score,co.top2Share,m?.strongest?.label,attrs.map(x=>x.value),logs.map(x=>x.msg)]);if(sig===lastRenderSig&&root.children.length)return;lastRenderSig=sig;
  const stages=['樣本收集','校準中','OOS 驗證','Edge 穩定','實戰成熟'];
  const stageHtml=stages.map((s,i)=>`<div class="sg-v24-stage ${i<idx?'done':i===idx?'current':''}"><span>${i<idx?icon('check'):`<b>${i+1}</b>`}</span><em>${esc(s)}</em></div>`).join('<i class="sg-v24-stage-arrow">›</i>');
  const attrHtml=attrs.map(a=>`<div class="sg-v24-attr"><div class="sg-v24-icon">${icon(a.icon)}</div><span>${esc(a.label)}</span><b>${Math.round(a.value)}</b><div class="sg-v24-meter"><i style="width:${a.value}%"></i></div><small>${esc(a.sub)}</small></div>`).join('');
  const questHtml=quests.map(q=>`<div class="sg-v24-quest"><div class="sg-v24-qicon ${q.tone}">${icon(q.icon)}</div><div class="sg-v24-qcopy"><b>${esc(q.title)}</b><small>${esc(q.sub)}</small></div><div class="sg-v24-qprogress"><strong>${q.value}%</strong><span><i class="${q.tone}" style="width:${q.value}%"></i></span></div></div>`).join('');
  const trainingHtml=trainRows.slice(0,4).map(x=>`<div class="sg-v24-train-row"><span class="sg-v24-miniicon">${icon(x.icon)}</span><b>${esc(x.label)}</b><em class="${x.cls}">${esc(x.state)}</em></div>`).join('');
  const logHtml=logs.map(x=>`<div class="sg-v24-log-row"><time>${esc(x.time)}</time><span>${esc(x.msg)}</span></div>`).join('')||'<div class="sg-v24-empty">等待新的成長紀錄。</div>';
  const unlocks=[
    {icon:'coins',label:'有效樣本',now:sampleNow,target:sampleTarget,color:'gold'},
    {icon:'chart',label:'Forward OOS 樣本',now:Number(fw.sample||0),target,color:'blue'},
    {icon:'shield',label:'Net PF ≥ 1.15 的穩定窗口',now:stableNow,target:stableTarget,color:'blue'}
  ];
  const unlockHtml=unlocks.map(x=>{const v=clamp(x.now/Math.max(1,x.target)*100);return `<div class="sg-v24-unlock-row"><span class="sg-v24-miniicon">${icon(x.icon)}</span><b>${esc(x.label)}</b><em>${x.now} / ${x.target}</em><div><i class="${x.color}" style="width:${v}%"></i></div><strong>${Math.round(v)}%</strong></div>`}).join('');
  root.innerHTML=`
    <section class="sg-v24-card sg-v24-hero">
      <div class="sg-v24-hero-top"><div class="sg-v24-emblem">${icon('eye')}</div><div><span>SYSTEM GROWTH · SHADOW</span><h2>影子養成總覽</h2><p>用歷史結果校準判斷，讓未見樣本驗證真正可執行的 Edge。</p></div></div>
      <div class="sg-v24-summary">
        <div><span>目前階段</span><b>Lv.${Math.max(1,Math.round(Number(document.querySelector('#sgBrandLevel .sg-lv-num')?.textContent||13)))}</b><small>${esc(stageName(idx))}</small></div>
        <div><span>成熟度</span><b class="gold">${Math.round(Number(mat.score||0))}%</b><small>${esc(mat.stage||'研究中')}</small></div>
        <div><span>Train Net PF</span><b>${pf(tr.netProfitFactor)}</b><small>${Number(tr.netProfitFactor||0)>=1?'成本後正 Edge':'仍需篩選'}</small></div>
        <div><span>Forward OOS</span><b class="blue">${pf(fw.netProfitFactor)}</b><small>${Number(fw.sample||0)}/${target} SAMPLE</small></div>
      </div>
    </section>
    <section class="sg-v24-card"><header>${icon('shield')}<div><b>角色狀態</b><span>目前能力分布</span></div></header><div class="sg-v24-attrs">${attrHtml}</div></section>
    <section class="sg-v24-card"><header>${icon('route')}<div><b>成長進度</b><span>從研究到可驗證 Edge</span></div></header><div class="sg-v24-stage-row">${stageHtml}</div><div class="sg-v24-overall"><b>整體進度 ${progress}%</b><span><i style="width:${progress}%"></i></span></div></section>
    <section class="sg-v24-card"><header>${icon('target')}<div><b>主線任務</b><span>目前最重要的三件事</span></div></header><div class="sg-v24-quests">${questHtml}</div></section>
    <section class="sg-v24-duo">
      <div class="sg-v24-card"><header>${icon('hourglass')}<div><b>每日訓練</b><span>後台正在做什麼</span></div></header><div class="sg-v24-training">${trainingHtml}</div></div>
      <div class="sg-v24-card"><header>${icon('book')}<div><b>最近成長紀錄</b><span>只記錄真正變化</span></div></header><div class="sg-v24-logs">${logHtml}</div></div>
    </section>
    <section class="sg-v24-card"><header>${icon('spark')}<div><b>下一階解鎖條件</b><span>達標後進入 ${esc(stages[Math.min(4,idx+1)])}</span></div></header><div class="sg-v24-unlocks">${unlockHtml}</div><footer>持續用新資料證明 Edge，不因樣本變多就自動放寬交易門檻。</footer></section>`;
}
async function fetchMentor(force=false){if(busy||(!force&&Date.now()-lastFetch<30000))return;busy=true;try{const c=new AbortController(),t=setTimeout(()=>c.abort(),6500);let r;try{r=await fetch('/api/shadow-mentor',{cache:'no-store',signal:c.signal})}finally{clearTimeout(t)}const d=await r.json().catch(()=>null);if(r.ok&&d?.ok){mentor=d;lastFetch=Date.now();render()}}catch(e){console.warn('[v2624-growth-status]',String(e?.message||e))}finally{busy=false}}
function boot(){hideLegacyDecor();void fetchMentor(true);window.addEventListener('sg:rendered',()=>requestAnimationFrame(()=>{hideLegacyDecor();render();void fetchMentor(false)}));window.addEventListener('pageshow',()=>setTimeout(()=>{hideLegacyDecor();void fetchMentor(true)},140));document.addEventListener('click',e=>{if(e.target?.closest?.('#sgBrandToggle'))setTimeout(()=>{hideLegacyDecor();render();void fetchMentor(false)},140)},true);setInterval(()=>{const p=document.getElementById('sgPanel');if(p&&!p.hidden){hideLegacyDecor();render();void fetchMentor(false)}},15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
