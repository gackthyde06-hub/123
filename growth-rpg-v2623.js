(()=>{
'use strict';
const VERSION='2.6.23';
const SKILLS=[
  ['direction','方向辨識'],['execution','執行品質'],['cost','成本效率'],
  ['regime','Regime適應'],['stability','穩定度'],['risk','風險過濾']
];
const STAGES=['collect','calibrate','forward','stable','master'];
let mentor=null,busy=false,lastFetch=0,lastSig='';
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const pct=v=>n(v)==null?'—':`${Number(v).toFixed(1)}%`;
const pf=v=>n(v)==null?'—':Number(v).toFixed(2);
const rr=v=>n(v)==null?'—':`${Number(v)>=0?'+':''}${Number(v).toFixed(3)}R`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function panel(){return document.getElementById('sgPanel')}
function stageIndex(m){
  const s=String(m?.stage||'');
  if(/實戰|成熟|Live|Master/i.test(s))return 4;
  if(/穩定/.test(s))return 3;
  if(/Forward|OOS|驗證/.test(s))return 2;
  if(/校準|成形|Edge/.test(s))return 1;
  return 0;
}
function mentorVerdict(m){
  const tr=m?.training||{},fw=m?.forward||{},st=m?.stability||{},co=m?.concentration||{},score=Number(m?.maturity?.score||0);
  if(Number(fw.sample||0)<Math.min(20,Number(fw.target||40)))return 'OOS 驗證樣本仍不足；先讓新資料證明舊 Edge。';
  if(Number(fw.netProfitFactor||0)<1)return 'Forward 扣成本仍未過 1；目前不應擴大信任。';
  if(Number(st.positiveFolds||0)<2)return 'Edge 還沒有跨時間穩定；繼續觀察不同市場狀態。';
  if(Number(co.top2Share||0)>.55)return '績效仍偏集中在少數標的；要等跨標的 Edge 成立。';
  if(score>=80&&Number(fw.netProfitFactor||0)>=1.15)return 'Forward Edge 正在成立；維持選擇性，不放寬硬閘門。';
  if(Number(tr.netProfitFactor||0)>=1.1)return 'Train 已出現局部 Edge，重點轉為 Forward 驗證與成本控制。';
  return '目前以蒐集乾淨樣本與淘汰負 Edge 型態為主。';
}
function decorateCore(){
  const p=panel();if(!p)return;
  const core=p.querySelector('.sg-core-card');if(!core)return;
  let img=core.querySelector('.sg-rpg-core-v2623');
  if(!img){img=document.createElement('img');img.className='sg-rpg-core-v2623';img.src='/sg-rpg-core-v2623.webp?v=2623';img.alt='';img.loading='lazy';img.decoding='async';core.appendChild(img)}
}
function decorateStages(){
  const p=panel();if(!p)return;
  const nodes=[...p.querySelectorAll('.sg-stage-node')].slice(0,5);
  nodes.forEach((node,i)=>{
    let img=node.querySelector('.sg-rpg-stage-icon-v2623');if(img)return;
    img=document.createElement('img');img.className='sg-rpg-stage-icon-v2623';img.src=`/sg-stage-${STAGES[i]||STAGES.at(-1)}-v2623.webp?v=2623`;img.alt='';img.loading='lazy';img.decoding='async';
    const dot=node.querySelector('i');if(dot)dot.replaceChildren(img);else node.prepend(img);
  });
}
function radarMetrics(){
  const p=panel();if(!p)return [];
  const labels=[...p.querySelectorAll('.sg-radar-label')].map(x=>String(x.textContent||'').trim()).filter(Boolean);
  const values=[...p.querySelectorAll('.sg-radar-value')].map(x=>String(x.textContent||'').trim()).filter(Boolean);
  return SKILLS.map((s,i)=>({key:s[0],label:labels[i]||s[1],value:values[i]||'—'}));
}
function decorateSkills(){
  const p=panel();if(!p)return;const card=p.querySelector('.sg-radar-card');if(!card)return;
  let root=card.querySelector('.sg-rpg-skills-v2623');if(!root){root=document.createElement('div');root.className='sg-rpg-skills-v2623';card.appendChild(root)}
  const rows=radarMetrics(),sig=JSON.stringify(rows);if(root.dataset.sig===sig)return;root.dataset.sig=sig;
  root.innerHTML=rows.map(x=>`<div><img src="/sg-skill-${x.key}-v2623.webp?v=2623" alt="" loading="lazy" decoding="async"><span>${esc(x.label)}</span><b>${esc(x.value)}</b></div>`).join('');
}
function renderMentor(){
  const p=panel();if(!p||!mentor?.ok)return;const core=p.querySelector('.sg-core-card');if(!core)return;
  document.getElementById('mentorGrowthV2622')?.setAttribute('hidden','');
  let root=core.querySelector('.sg-rpg-mentor-v2623');if(!root){root=document.createElement('section');root.className='sg-rpg-mentor-v2623';const stage=core.querySelector('.sg-stage');if(stage)stage.insertAdjacentElement('afterend',root);else core.appendChild(root)}
  const m=mentor.maturity||{},tr=mentor.training||{},fw=mentor.forward||{},st=mentor.stability||{},co=mentor.concentration||{},strong=mentor.strongest||{},idx=stageIndex(mentor.maturity),sig=JSON.stringify([m.score,m.stage,tr.sample,tr.netProfitFactor,tr.netExpectancyR,fw.sample,fw.target,fw.netProfitFactor,st.positiveFolds,st.totalFolds,co.top2Share,strong.label]);if(sig===lastSig&&root.children.length)return;lastSig=sig;
  const target=Math.max(1,Number(fw.target||40)),forwardPct=Math.max(0,Math.min(100,Number(fw.sample||0)/target*100));
  root.innerHTML=`<div class="sg-rpg-mentor-head-v2623"><img src="/sg-stage-${STAGES[idx]}-v2623.webp?v=2623" alt=""><div><span>SHADOW TRAINING</span><b>影子訓練 · ${esc(m.stage||'研究中')}</b></div><em>${Math.round(Number(m.score||0))}</em></div><div class="sg-rpg-mentor-grid-v2623"><div><span>Train Net PF</span><b>${pf(tr.netProfitFactor)}</b><small>${rr(tr.netExpectancyR)}</small></div><div><span>Forward OOS</span><b>${Number(fw.sample||0)}/${target}</b><small>PF ${pf(fw.netProfitFactor)}</small></div><div><span>穩定窗</span><b>${Number(st.positiveFolds||0)}/${Number(st.totalFolds||0)||3}</b><small>跨時間</small></div><div><span>集中度</span><b>${pct(Number(co.top2Share||0)*100)}</b><small>Top2</small></div></div><div class="sg-rpg-forward-v2623"><i style="width:${forwardPct.toFixed(1)}%"></i></div><div class="sg-rpg-mentor-foot-v2623"><div><span>目前最強</span><b>${esc(strong.label||'等待穩定 Edge')}</b></div><p>${esc(mentorVerdict(mentor))}</p></div>`;
}
async function fetchMentor(force=false){if(busy||(!force&&Date.now()-lastFetch<30000))return;busy=true;try{const c=new AbortController(),t=setTimeout(()=>c.abort(),6500);let r;try{r=await fetch('/api/shadow-mentor',{cache:'no-store',signal:c.signal})}finally{clearTimeout(t)}const d=await r.json().catch(()=>null);if(r.ok&&d?.ok){mentor=d;lastFetch=Date.now();renderMentor()}}catch(e){console.warn('[v2623-growth-rpg]',String(e?.message||e))}finally{busy=false}}
function decorate(){decorateCore();decorateStages();decorateSkills();renderMentor()}
function boot(){decorate();void fetchMentor(true);window.addEventListener('sg:rendered',()=>requestAnimationFrame(()=>{decorate();void fetchMentor(false)}));window.addEventListener('pageshow',()=>setTimeout(()=>{decorate();void fetchMentor(true)},120));document.addEventListener('click',e=>{if(e.target?.closest?.('#sgBrandToggle'))setTimeout(()=>{decorate();void fetchMentor(false)},120)},true);setInterval(()=>{const p=panel();if(p&&!p.hidden){decorate();void fetchMentor(false)}},15000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
