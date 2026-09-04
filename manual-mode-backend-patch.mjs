import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='MANUAL_SHADOW_STABLE_CANDIDATE_V2663_20260904';
const BASE_MARKER='MANUAL_MODE_V263_20260902';

const CANDIDATE_JS=String.raw`(()=>{
'use strict';
const VERSION='2.6.63';
const OPEN_KEY='manual-candidate-open-v2663';
const DRAFT_KEY='manual-candidate-draft-v2663';
let data=null,busy=false,lastSig='',timer=null,observer=null;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const pct=v=>n(v)==null?'—':Number(v).toFixed(1)+'%';
const px=v=>{const x=n(v);if(x==null)return'—';if(x>=1000)return x.toLocaleString('en-US',{maximumFractionDigits:2});if(x>=1)return x.toLocaleString('en-US',{maximumFractionDigits:6});return x.toLocaleString('en-US',{maximumFractionDigits:8})};
const age=ms=>{const x=Math.max(0,Number(ms)||0),s=Math.round(x/1000);return s<60?s+'秒前':s<3600?Math.floor(s/60)+'分前':Math.floor(s/3600)+'小時前'};
const tvUrl=s=>'https://www.tradingview.com/chart/?symbol='+encodeURIComponent('BINANCE:'+String(s||'').toUpperCase()+'.P');
function read(k,f={}){try{const x=JSON.parse(localStorage.getItem(k)||'null');return x&&typeof x==='object'&&!Array.isArray(x)?x:f}catch{return f}}
function write(k,x){try{localStorage.setItem(k,JSON.stringify(x))}catch{}}
function currentPage(){return document.querySelector('.pageTab.active')?.dataset?.page||''}
function keyOf(x){return String(x?.candidateKey||[x?.symbol,x?.direction].join('|'))}
function opens(){return read(OPEN_KEY,{})}
function drafts(){return read(DRAFT_KEY,{})}
function draftVal(id,k,f=''){const d=drafts()[id]||{};return Object.prototype.hasOwnProperty.call(d,k)?d[k]:(f??'')}
function saveDraft(id,k,v){const d=drafts();d[id]={...(d[id]||{}),[k]:v};write(DRAFT_KEY,d)}
async function json(url,opt={}){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),7000);
  try{
    const r=await fetch(url,{cache:'no-store',signal:c.signal,...opt});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!d?.ok)throw new Error(d?.error||('HTTP '+r.status));
    return d;
  }finally{clearTimeout(t)}
}
function host(){
  const shell=document.querySelector('#manualWorkspaceV2638 .mw-shell');
  if(!shell)return null;
  let h=document.getElementById('manualCandidateV2663');
  if(!h){
    h=document.createElement('details');
    h.id='manualCandidateV2663';
    h.className='mw-group mw-candidate-group-v2663';
    h.open=true;
    shell.appendChild(h);
  }else if(h.parentElement!==shell)shell.appendChild(h);
  return h;
}
function list(v,empty='—',cls=''){
  const a=Array.isArray(v)?v.filter(Boolean):[];
  return a.length?a.map(x=>'<span class="'+cls+'">'+esc(x)+'</span>').join(''):'<span>'+esc(empty)+'</span>';
}
function formField(id,k,label,value){
  return '<label><span>'+label+'</span><input data-cf="'+k+'" inputmode="decimal" value="'+esc(draftVal(id,k,value??''))+'"></label>';
}
function card(x){
  const id=keyOf(x),e=x.entry||{},s=x.structure||{},ev=x.candidateEvidence||{},g=x.formalGap||{},open=opens()[id]===true;
  const cwin=n(x.candidateWinRate),cscore=n(x.candidateScore),hold=Number(x.candidateHoldUntil||0)-Date.now();
  const stable=hold>0?'穩定保留 '+Math.max(1,Math.ceil(hold/60000))+' 分':'穩定候選';
  const gradeText=x.originalGrade&&x.originalGrade!=='C'?x.originalGrade:'候選';
  return '<article class="mw-card mw-candidate-card-v2663" data-candidate-id="'+esc(id)+'">'+
    '<details '+(open?'open':'')+'>'+
      '<summary>'+
        '<span class="mw-grade candidate">候</span>'+
        '<div class="mw-main"><div><a href="'+tvUrl(x.symbol)+'" target="_blank" rel="noopener">'+esc(x.symbol)+'</a><em class="'+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</em></div>'+
        '<small>'+esc(s.label||'等待結構')+' · '+esc(stable)+' · '+age(x.freshnessAgeMs)+'</small></div>'+
        '<div class="mw-score candidate-score"><b>'+pct(cwin)+'</b><span>候選勝率</span></div>'+
        '<i class="mw-chevron">⌄</i>'+
      '</summary>'+
      '<div class="mw-body">'+
        '<div class="candidate-banner-v2663"><b>影子目前最看好的候選</b><span>不是正式 A / B，也不會因為只是候選就自動通知。</span></div>'+
        '<div class="mw-quick candidate-metrics-v2663">'+
          '<div><span>候選勝率</span><b>'+pct(cwin)+'</b><small>多來源加權，不是保證勝率</small></div>'+
          '<div><span>影子共識分</span><b>'+(cscore==null?'—':Math.round(cscore))+'</b><small>目前候選排序依據</small></div>'+
          '<div><span>影子相關樣本</span><b>'+Number(ev.shadowSample||0)+'筆 · '+pct(ev.shadowHitRate)+'</b><small>PF '+(n(ev.shadowProfitFactor)==null?'—':Number(ev.shadowProfitFactor).toFixed(2))+' · '+esc(ev.shadowLevel||'')+'</small></div>'+
          '<div><span>校準勝率</span><b>'+pct(ev.calibratedWinRate)+'</b><small>排名 #'+(x.rank??'—')+' · '+Math.round(Number(x.rankScore||0))+'分</small></div>'+
          '<div><span>結構</span><b>'+esc(s.label||'—')+' '+(n(s.health)==null?'':Math.round(s.health))+'</b><small>'+esc(x.trackerStatus||'')+'</small></div>'+
          '<div><span>TP2 RR</span><b>'+(n(e.rr)==null?'—':Number(e.rr).toFixed(2))+'</b><small>資料 '+Math.round(Number(x.dataHealth?.coverage||0))+'/'+Math.round(Number(x.dataHealth?.confidence||0))+'</small></div>'+
        '</div>'+
        '<div class="candidate-explain-v2663">'+
          '<section><b>為什麼它還留在候選</b>'+list(x.candidateReasons,'影子仍在累積判斷')+'</section>'+
          '<section><b>離正式 B 還差什麼</b>'+list(g.toB,'已符合 B 的主要條件','gap')+'</section>'+
          '<section><b>離正式 A 還差什麼</b>'+list(g.toA,'已符合 A 的主要條件','gap')+'</section>'+
          '<section class="candidate-caution-v2663"><b>如果你現在要打，注意</b>'+list(x.tradeCautions,'只在建議區內執行，失效即退','warn')+'</section>'+
        '</div>'+
        '<div class="mw-levels">'+
          '<div><span>參考成本</span><b>'+px(e.price)+'</b></div>'+
          '<div><span>進場區</span><b>'+(n(e.zoneLow)!=null&&n(e.zoneHigh)!=null?px(e.zoneLow)+'～'+px(e.zoneHigh):'—')+'</b></div>'+
          '<div><span>TP1 / TP2</span><b>'+px(e.target)+' / '+px(e.target2)+'</b></div>'+
          '<div><span>SP1</span><b>'+px(e.stop)+'</b></div>'+
        '</div>'+
        '<div class="mw-form candidate-form-v2663">'+
          '<div class="mw-form-grid">'+
            formField(id,'entry','成本',e.price)+
            formField(id,'tp1','TP1',e.target)+
            formField(id,'tp2','TP2',e.target2)+
            formField(id,'sp1','SP1',e.stop)+
            formField(id,'sp2','SP2','')+
            formField(id,'margin','保證金 U',300)+
            formField(id,'leverage','槓桿',20)+
            formField(id,'quantity','數量（可空）','')+
          '</div>'+
          '<div class="mw-actions"><button type="button" data-candidate-current="'+esc(id)+'">成本用現價 '+px(e.currentPrice)+'</button><button type="button" class="save candidate-build" data-candidate-build="'+esc(id)+'">以候選建立追蹤</button></div>'+
          '<div class="candidate-build-note-v2663">候選不是正式進場訊號。若沒有等到上面缺少的條件補齊，這筆就是你主動承擔較高不確定性。</div>'+
          '<div class="mw-msg" data-candidate-msg="'+esc(id)+'"></div>'+
        '</div>'+
      '</div>'+
    '</details>'+
  '</article>';
}
function render(){
  const h=host();if(!h||!data)return;
  const rows=(data.rows||[]).filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE').slice(0,3);
  const sig=JSON.stringify(rows.map(x=>[keyOf(x),Math.round(Number(x.candidateScore||0)),Number(x.candidateWinRate||0).toFixed(1),x.structure?.state,x.trackerStatus,(x.formalGap?.toB||[]).join('|'),(x.formalGap?.toA||[]).join('|')]));
  if(sig===lastSig&&h.querySelector('.candidate-list-v2663'))return;
  lastSig=sig;
  h.innerHTML='<summary><div><b>候選</b><span>'+rows.length+'</span></div><small>影子累積樣本加權後，目前最有機會 · 穩定保留，不等於正式 A/B</small><i>⌄</i></summary>'+
    '<div class="mw-list candidate-list-v2663">'+(rows.length?rows.map(card).join(''):'<div class="mw-empty">目前沒有通過高勝率門檻的候選。寧可空白，不塞低品質標的。</div>')+'</div>';
}
function row(id){return (data?.rows||[]).find(x=>x?.candidate===true&&keyOf(x)===id)||null}
function inputVal(card,k){const v=card?.querySelector('[data-cf="'+k+'"]')?.value;return v===''?null:Number(v)}
async function build(id){
  const x=row(id),card=document.querySelector('.mw-candidate-card-v2663[data-candidate-id="'+CSS.escape(id)+'"]'),msg=card?.querySelector('[data-candidate-msg="'+CSS.escape(id)+'"]');
  if(!x||!card||!msg)return;
  const body={
    manualMode:true,manualGrade:'C',manualGradeScore:x.candidateScore,manualGradeAt:data.generatedAt,
    manualOpportunityId:x.id,manualReasons:[...(x.candidateReasons||[]),...(x.tradeCautions||[])].slice(0,8),
    signalKey:x.signalKey,notificationId:null,symbol:x.symbol,direction:x.direction,strategyId:x.strategyId,
    strategyLabel:x.strategyLabel,marketRegime:x.marketRegime,notificationTier:'CANDIDATE',
    entryPrice:inputVal(card,'entry'),tp1:inputVal(card,'tp1'),tp2:inputVal(card,'tp2'),
    sp1:inputVal(card,'sp1'),sp2:inputVal(card,'sp2'),margin:inputVal(card,'margin'),
    quantity:inputVal(card,'quantity'),leverage:inputVal(card,'leverage'),
    manualSnapshot:{
      rank:x.rank,rankScore:x.rankScore,estimatedWinRate:x.estimatedWinRate,calibratedWinRate:x.calibratedWinRate,
      notificationTier:'CANDIDATE',observationProgress:x.observationProgress,dataCoverage:x.dataHealth?.coverage,
      dataConfidence:x.dataHealth?.confidence,structureState:x.structure?.state,structureHealth:x.structure?.health,
      structureLearningAdjustment:x.structure?.learningAdjustment,shadowSample:x.shadow?.sample,
      shadowHitRate:x.shadow?.hitRate,shadowProfitFactor:x.shadow?.profitFactor,rr:x.entry?.rr,
      freshnessAgeMs:x.freshnessAgeMs,entryZoneLow:x.entry?.zoneLow,entryZoneHigh:x.entry?.zoneHigh,
      stop:x.entry?.stop,target:x.entry?.target,target2:x.entry?.target2
    }
  };
  msg.textContent='建立中…';
  try{
    await json('/api/actual-trades',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    msg.textContent='✓ 已建立候選實倉追蹤；後台會照實際結果回寫學習';
    setTimeout(()=>refresh(true),800);
  }catch(e){msg.textContent='✕ '+e.message}
}
async function refresh(force=false){
  if(busy)return;
  busy=true;
  try{data=await json('/api/manual-opportunities'+(force?'?force=1':''));render()}
  catch{}finally{busy=false}
}
function bind(){
  document.addEventListener('click',e=>{
    const c=e.target.closest?.('[data-candidate-current]');
    if(c){
      e.preventDefault();
      const x=row(c.dataset.candidateCurrent),card=c.closest('.mw-candidate-card-v2663'),i=card?.querySelector('[data-cf="entry"]');
      if(x&&i&&n(x.entry?.currentPrice)!=null){i.value=String(x.entry.currentPrice);saveDraft(c.dataset.candidateCurrent,'entry',i.value)}
      return;
    }
    const b=e.target.closest?.('[data-candidate-build]');
    if(b){e.preventDefault();void build(b.dataset.candidateBuild);return}
  },true);
  document.addEventListener('input',e=>{
    const i=e.target.closest?.('.mw-candidate-card-v2663 [data-cf]');
    if(!i)return;
    const id=i.closest('.mw-candidate-card-v2663')?.dataset?.candidateId;
    if(id)saveDraft(id,i.dataset.cf,i.value);
  });
  document.addEventListener('toggle',e=>{
    const d=e.target;
    if(!(d instanceof HTMLDetailsElement)||!d.closest?.('.mw-candidate-card-v2663'))return;
    const id=d.closest('.mw-candidate-card-v2663')?.dataset?.candidateId,o=opens();
    if(d.open)o[id]=true;else delete o[id];
    write(OPEN_KEY,o);
  },{capture:true});
}
function boot(){
  bind();
  observer=new MutationObserver(()=>{if(currentPage()==='ideas'){host();render()}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  void refresh(true);
  timer=setInterval(()=>{if(document.visibilityState==='visible'&&(currentPage()==='ideas'||currentPage()==='test'))void refresh(false)},60000);
  window.addEventListener('pageshow',()=>void refresh(false));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh(false)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.ManualCandidateV2663={version:VERSION,refresh};
})();`;

const CANDIDATE_CSS=String.raw`
/* V2.6.63 Shadow-stable candidates */
.mw-candidate-group-v2663{border-color:#46505a!important;background:linear-gradient(155deg,#1b232a,#141a20)!important}
.mw-candidate-group-v2663>summary{background:linear-gradient(90deg,rgba(116,158,193,.12),rgba(202,169,101,.08))!important}
.mw-candidate-group-v2663>summary b{color:#bad3ea!important}
.mw-candidate-group-v2663>summary small{color:#9aa1a6!important}
.mw-candidate-card-v2663{border-color:#40505b!important;background:linear-gradient(150deg,#202b34,#172028)!important}
.mw-grade.candidate{background:#304859!important;color:#c8e0f2!important}
.candidate-score b{color:#b8d9ef!important}
.candidate-banner-v2663{display:grid;gap:3px;margin-top:11px;padding:10px 11px;border:1px solid #43525c;border-radius:11px;background:linear-gradient(135deg,rgba(77,113,139,.20),rgba(160,127,67,.10))}
.candidate-banner-v2663 b{color:#d8e5ef;font-size:11px}
.candidate-banner-v2663 span{color:#919ca4;font-size:9px;line-height:1.45}
.candidate-explain-v2663{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.candidate-explain-v2663 section{padding:10px;border:1px solid #37444d;border-radius:11px;background:#172128}
.candidate-explain-v2663 section>b{display:block;margin-bottom:6px;color:#c6b17f;font-size:10px}
.candidate-explain-v2663 section>span{display:block;color:#a7adb0;font-size:9px;line-height:1.5}
.candidate-explain-v2663 section>span.gap{color:#e0b08a}
.candidate-explain-v2663 section>span.warn{color:#efb08e}
.candidate-caution-v2663{border-color:#5a493c!important;background:linear-gradient(145deg,#211d1b,#1b2023)!important}
.candidate-caution-v2663>b{color:#e0b36e!important}
.candidate-build-note-v2663{margin-top:8px;padding:8px 9px;border-left:2px solid #a77b43;background:#1c1d1d;color:#a8a197;font-size:8.5px;line-height:1.45}
.candidate-form-v2663{margin-top:12px}
@media(max-width:520px){.candidate-explain-v2663{grid-template-columns:1fr}.candidate-metrics-v2663{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`[manual-v2663] ${label} syntax invalid: ${String(r.stderr||r.stdout||'').trim()}`);
}
function saveChecked(file,src,label){
  const tmp=`${file}.v2663-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function functionRange(src,name){
  const start=src.indexOf(`async function ${name}(`);
  if(start<0)return null;
  const brace=src.indexOf('{',start);
  if(brace<0)return null;
  let depth=0,quote=null,escape=false,templateExpr=0;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\'){escape=true;continue}
      if(quote==='`'&&ch==='$'&&next==='{'){templateExpr++;i++;continue}
      if(quote==='`'&&templateExpr>0){
        if(ch==='{')templateExpr++;
        else if(ch==='}')templateExpr--;
        continue;
      }
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){
      depth--;
      if(depth===0)return {start,end:i+1};
    }
  }
  return null;
}
function replaceFunction(src,name,replacement){
  const r=functionRange(src,name);
  if(!r)throw new Error(`[manual-v2663] function ${name} not found`);
  return src.slice(0,r.start)+replacement+src.slice(r.end);
}
function installCandidateAssets(){
  const pub=path.join(__dirname,'public');
  fs.mkdirSync(pub,{recursive:true});
  const js=path.join(pub,'manual-candidate-v2663.js'),css=path.join(pub,'manual-candidate-v2663.css');
  fs.writeFileSync(js,CANDIDATE_JS,'utf8');fs.writeFileSync(css,CANDIDATE_CSS,'utf8');check(js,'candidate runtime');

  const idx=path.join(pub,'index.html');
  if(!fs.existsSync(idx))return;
  let h=fs.readFileSync(idx,'utf8');
  h=h.replace(/\s*<script[^>]+src=["']\/manual-candidate-v2663\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,'');
  h=h.replace(/\s*<link[^>]+href=["']\/manual-candidate-v2663\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,'');
  if(h.includes('</head>'))h=h.replace('</head>','<link rel="stylesheet" href="/manual-candidate-v2663.css?v=2663-0904">\n</head>');
  if(h.includes('</body>'))h=h.replace('</body>','<script defer src="/manual-candidate-v2663.js?v=2663-0904"></script>\n</body>');
  fs.writeFileSync(idx,h,'utf8');
}

const UPGRADED_RESPONSE=String.raw`
const MANUAL_CANDIDATE_MAX_V2663=3;
const MANUAL_CANDIDATE_CONFIRM_SCANS_V2663=2;
const MANUAL_CANDIDATE_MIN_SCORE_V2663=67;
const MANUAL_CANDIDATE_MIN_WIN_V2663=58;
const MANUAL_CANDIDATE_HARD_FLOOR_V2663=54;
const MANUAL_CANDIDATE_HOLD_MS_V2663=20*60*1000;
const MANUAL_CANDIDATE_MISS_MS_V2663=8*60*1000;
const MANUAL_CANDIDATE_REPLACE_EDGE_V2663=6;
const manualCandidateStateV2663=new Map();

function manualCandidateKeyV2663(x){return [String(x?.symbol||''),String(x?.direction||'')].join('|')}
function manualCandidateScoreV2663(x){
  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??50;
  const sh=manualFinite(x?.shadow?.hitRate)??50;
  const exec=manualFinite(x?.executionScore)??0;
  const rank=manualFinite(x?.rankScore)??0;
  const structure=manualFinite(x?.structure?.health)??45;
  const coverage=manualFinite(x?.dataHealth?.coverage)??40;
  const confidence=manualFinite(x?.dataHealth?.confidence)??40;
  const pf=manualFinite(x?.shadow?.profitFactor);
  const sample=Math.max(0,Number(x?.shadow?.sample||0));
  const sampleReliability=Math.min(1,sample/30);
  const pfAdj=pf==null?0:Math.max(-6,Math.min(7,(pf-1)*8));
  const score=cal*.31+sh*.19*sampleReliability+50*.19*(1-sampleReliability)+exec*.14+rank*.10+structure*.10+coverage*.04+confidence*.05+pfAdj;
  const win=sample>=8?(cal*.62+sh*.38):cal;
  return {score:Number(Math.max(0,Math.min(100,score)).toFixed(1)),win:Number(Math.max(0,Math.min(100,win)).toFixed(1)),sample};
}
function manualCandidateHardInvalidV2663(x,m){
  if(!x)return true;
  if(x?.trade?.status==='ACTIVE')return true;
  if(['DROPPED','EXPIRED','LOSS','WIN','TIMEOUT'].includes(String(x?.trackerStatus||'').toUpperCase()))return true;
  if(String(x?.structure?.state||'').toUpperCase()==='DESTROYED')return true;
  if(x?.institutionalEdge?.hardBlock===true)return true;
  if(String(x?.notificationTier||'').toUpperCase()==='BLOCKED')return true;
  const rr=manualFinite(x?.entry?.rr);
  if(rr!=null&&rr<1)return true;
  if(m.win<MANUAL_CANDIDATE_HARD_FLOOR_V2663)return true;
  return false;
}
function manualCandidateQualifiedV2663(x,m){
  if(!x||String(x.grade||'')!=='C')return false;
  if(manualCandidateHardInvalidV2663(x,m))return false;
  const shSample=Math.max(0,Number(x?.shadow?.sample||0));
  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??0;
  return m.score>=MANUAL_CANDIDATE_MIN_SCORE_V2663&&m.win>=MANUAL_CANDIDATE_MIN_WIN_V2663&&(shSample>=8||cal>=62);
}
function manualCandidateGapV2663(x){
  const toB=[],toA=[],st=String(x?.structure?.state||'UNKNOWN'),status=String(x?.trackerStatus||''),age=Number(x?.freshnessAgeMs||0);
  const coverage=Number(x?.dataHealth?.coverage||0),confidence=Number(x?.dataHealth?.confidence||0),progress=Number(x?.observationProgress||0),score=Number(x?.executionScore||0),rr=manualFinite(x?.entry?.rr),chase=manualFinite(x?.chaseAtr);
  if(age>300000)toB.push('需要重新取得 5 分鐘內的即時判讀；目前這是最常把它卡在 C 的原因');
  if(score<60)toB.push('正式 B 執行分需至少 60；目前 '+Math.round(score));
  if(rr!=null&&rr<1.25)toB.push('RR 偏低；最好先回到至少 1.25 以上再考慮');
  if(st==='DAMAGED')toB.push('結構仍受損，要先看到收復');
  if(status==='NO_TRACKER')toB.push('缺完整觀察 tracker，等系統建立即時追蹤');
  if(!toB.length)toB.push('主要差在即時閘門重新確認，不是歷史勝率不足');

  if(x?.executionConfirmed!==true)toA.push('A 級需要正式進場確認，目前還沒有');
  if(age>120000)toA.push('A 級要求判讀 2 分鐘內，目前已超時');
  if(coverage<78)toA.push('資料完整度需 ≥78；目前 '+Math.round(coverage));
  if(confidence<72)toA.push('資料可信度需 ≥72；目前 '+Math.round(confidence));
  if(progress<72)toA.push('觀察完成度需 ≥72；目前 '+Math.round(progress));
  if(!['INTACT','RECLAIMING','OPPORTUNITY'].includes(st))toA.push('結構還沒回到可接受狀態');
  if(rr!=null&&rr<1.5)toA.push('A 級 TP2 RR 需 ≥1.50；目前 '+rr.toFixed(2));
  if(chase!=null&&chase>.45)toA.push('離建議區太遠；A 級不允許追價');
  if(Array.isArray(x?.blockers)&&x.blockers.length)toA.push('仍有通知閘門阻擋：'+x.blockers.slice(0,2).join(' / '));
  if(!toA.length)toA.push('A 級主要只差即時確認維持，不需再補歷史樣本');
  return {toB:toB.slice(0,5),toA:toA.slice(0,7)};
}
function manualCandidateCautionV2663(x){
  const a=[],e=x?.entry||{},st=String(x?.structure?.state||''),age=Number(x?.freshnessAgeMs||0),chase=manualFinite(x?.chaseAtr),rr=manualFinite(e?.rr);
  a.push('候選不是正式進場訊號；最安全做法仍是等上面的 B/A 缺口補齊');
  if(age>300000)a.push('即時判讀已過期：若要打，至少重新確認 5m/15m 沒有反向 BOS / CHoCH');
  if(chase!=null&&chase>.45)a.push('目前離建議區偏遠，不追；等回踩進場區再看');
  if(st==='DAMAGED'||st==='RECLAIMING')a.push('結構不是完整 INTACT；只接受收復後的回踩，不接受直接追價');
  if(e?.zoneLow!=null&&e?.zoneHigh!=null)a.push('只在 '+e.zoneLow+'～'+e.zoneHigh+' 附近執行，離開區間就重新評估');
  if(e?.stop!=null)a.push('SP '+e.stop+' 是結構失效參考；若失效不要用加碼硬扛');
  if(rr!=null&&rr<1.5)a.push('TP2 RR 只有 '+rr.toFixed(2)+'，報酬風險比還不夠漂亮');
  return a.slice(0,6);
}
function manualCandidateReasonsV2663(x,m){
  const a=[],sh=x?.shadow||{};
  a.push('影子相關樣本 '+Number(sh.sample||0)+'筆 · 命中 '+(manualFinite(sh.hitRate)==null?'—':Number(sh.hitRate).toFixed(1)+'%')+' · PF '+(manualFinite(sh.profitFactor)==null?'—':Number(sh.profitFactor).toFixed(2)));
  a.push('校準勝率 '+(manualFinite(x.calibratedWinRate)==null?'—':Number(x.calibratedWinRate).toFixed(1)+'%')+' · 影子共識分 '+m.score);
  a.push('目前建議排名 #'+(x.rank??'—')+' · 排名分 '+Math.round(Number(x.rankScore||0)));
  if(x?.structure?.label)a.push('結構 '+x.structure.label+' · '+Math.round(Number(x.structure.health||0))+'分');
  return a.slice(0,5);
}
function manualCandidateDecorateV2663(x,state,m,now){
  const out={...x};
  out.candidate=true;
  out.candidateKey=manualCandidateKeyV2663(x);
  out.candidateScore=m.score;
  out.candidateWinRate=m.win;
  out.candidateSince=state.selectedAt||state.firstSeen||now;
  out.candidateHoldUntil=(state.selectedAt||now)+MANUAL_CANDIDATE_HOLD_MS_V2663;
  out.candidateStable=true;
  out.originalGrade=String(x.grade||'C');
  out.candidateEvidence={
    calibratedWinRate:manualFinite(x.calibratedWinRate),
    shadowSample:Number(x?.shadow?.sample||0),
    shadowHitRate:manualFinite(x?.shadow?.hitRate),
    shadowProfitFactor:manualFinite(x?.shadow?.profitFactor),
    shadowLevel:String(x?.shadow?.level||''),
    score:m.score
  };
  out.formalGap=manualCandidateGapV2663(x);
  out.tradeCautions=manualCandidateCautionV2663(x);
  out.candidateReasons=manualCandidateReasonsV2663(x,m);
  return out;
}
function manualStableCandidatesV2663(rows){
  const now=Date.now(),current=new Map(),formalKeys=new Set();
  for(const x of rows||[]){
    const k=manualCandidateKeyV2663(x);
    if(['A','B'].includes(String(x.grade||'')))formalKeys.add(k);
    const m=manualCandidateScoreV2663(x);
    current.set(k,{row:x,metric:m,qualified:manualCandidateQualifiedV2663(x,m),hardInvalid:manualCandidateHardInvalidV2663(x,m)});
    let st=manualCandidateStateV2663.get(k);
    if(!st)st={firstSeen:now,lastSeen:0,confirm:0,selected:false,selectedAt:0,snapshot:null,metric:null};
    const consecutive=st.lastSeen&&now-st.lastSeen<150000;
    st.confirm=consecutive?st.confirm+1:1;
    st.lastSeen=now;st.snapshot=x;st.metric=m;
    manualCandidateStateV2663.set(k,st);
  }

  for(const [k,st] of [...manualCandidateStateV2663]){
    if(formalKeys.has(k)){manualCandidateStateV2663.delete(k);continue}
    if(now-(st.lastSeen||0)>2*60*60*1000)manualCandidateStateV2663.delete(k);
  }

  let selected=[...manualCandidateStateV2663.entries()].filter(([k,st])=>st.selected&&!formalKeys.has(k));
  for(const [k,st] of selected){
    const cur=current.get(k);
    if(cur?.hardInvalid){manualCandidateStateV2663.delete(k);continue}
    if(!cur&&now-(st.lastSeen||0)>MANUAL_CANDIDATE_MISS_MS_V2663){manualCandidateStateV2663.delete(k);continue}
  }
  selected=[...manualCandidateStateV2663.entries()].filter(([k,st])=>st.selected&&!formalKeys.has(k));

  const challengers=[...current.entries()]
    .filter(([k,v])=>!formalKeys.has(k)&&v.qualified&&!manualCandidateStateV2663.get(k)?.selected&&manualCandidateStateV2663.get(k)?.confirm>=MANUAL_CANDIDATE_CONFIRM_SCANS_V2663)
    .sort((a,b)=>b[1].metric.score-a[1].metric.score||b[1].metric.win-a[1].metric.win||Number(a[1].row.rank||99)-Number(b[1].row.rank||99));

  while(selected.length<MANUAL_CANDIDATE_MAX_V2663&&challengers.length){
    const [k]=challengers.shift(),st=manualCandidateStateV2663.get(k);
    st.selected=true;st.selectedAt=now;manualCandidateStateV2663.set(k,st);
    selected.push([k,st]);
  }

  if(selected.length&&challengers.length){
    const replaceable=selected
      .filter(([k,st])=>now-(st.selectedAt||0)>=MANUAL_CANDIDATE_HOLD_MS_V2663)
      .sort((a,b)=>(a[1].metric?.score||0)-(b[1].metric?.score||0));
    const best=challengers[0];
    if(replaceable.length&&best){
      const weak=replaceable[0];
      const weakScore=weak[1].metric?.score||0,bestScore=best[1].metric?.score||0;
      if(bestScore>=weakScore+MANUAL_CANDIDATE_REPLACE_EDGE_V2663){
        weak[1].selected=false;manualCandidateStateV2663.set(weak[0],weak[1]);
        const st=manualCandidateStateV2663.get(best[0]);st.selected=true;st.selectedAt=now;manualCandidateStateV2663.set(best[0],st);
      }
    }
  }

  const output=[];
  for(const [k,st] of manualCandidateStateV2663){
    if(!st.selected||formalKeys.has(k))continue;
    const cur=current.get(k),x=cur?.row||st.snapshot,m=cur?.metric||st.metric;
    if(!x||!m)continue;
    if(!cur&&now-(st.lastSeen||0)>MANUAL_CANDIDATE_MISS_MS_V2663)continue;
    output.push(manualCandidateDecorateV2663(x,st,m,now));
  }
  output.sort((a,b)=>{
    const sa=manualCandidateStateV2663.get(a.candidateKey),sb=manualCandidateStateV2663.get(b.candidateKey);
    return Number(sa?.selectedAt||0)-Number(sb?.selectedAt||0)||Number(b.candidateScore||0)-Number(a.candidateScore||0);
  });
  return output.slice(0,MANUAL_CANDIDATE_MAX_V2663);
}

async function manualOpportunityResponse(force=false){
  const now=Date.now();
  if(!force&&manualOpportunityCache.data&&now-manualOpportunityCache.at<20_000)return manualOpportunityCache.data;
  const ideas=await getRankedIdeas();
  const baseRows=(ideas.rows||[]).slice(0,12)
    .map((x,i)=>manualOpportunityOne(x,i+1,ideas.generatedAt))
    .sort((a,b)=>(({A:3,B:2,C:1}[b.grade]||0)-({A:3,B:2,C:1}[a.grade]||0))||b.executionScore-a.executionScore||a.rank-b.rank);
  const candidates=manualStableCandidatesV2663(baseRows);
  const byKey=new Map(candidates.map(x=>[manualCandidateKeyV2663(x),x]));
  const rows=baseRows.map(x=>byKey.get(manualCandidateKeyV2663(x))||x);
  for(const c of candidates){
    if(!rows.some(x=>manualCandidateKeyV2663(x)===c.candidateKey))rows.push(c);
  }
  const data={
    ok:true,version:'V2.6.63',generatedAt:new Date().toISOString(),ideasGeneratedAt:ideas.generatedAt,stale:ideas.stale===true,
    methodology:'正式 A/B 維持原規則。候選獨立使用影子累積樣本、校準勝率、執行分、排名、結構、資料品質與 PF 加權；新候選需連續確認 2 次，入選後至少穩定保留 20 分鐘，除非硬失效；更換需新候選高至少 6 分。',
    stats:manualActualBreakdown(),
    counts:{A:rows.filter(x=>x.grade==='A').length,B:rows.filter(x=>x.grade==='B').length,C:rows.filter(x=>x.grade==='C').length,candidate:rows.filter(x=>x.candidate===true).length},
    rows
  };
  manualOpportunityCache={at:now,data};
  return data;
}`;

export function patchManualModeV263({serverPath=path.join(__dirname,'server.js')}={}){
  let src=fs.readFileSync(serverPath,'utf8');
  if(src.includes(MARKER)){installCandidateAssets();return {changed:false,reason:'already-applied'};}
  if(!src.includes(BASE_MARKER))throw new Error('[manual-v2663] existing Manual Mode V263 backend is missing; refusing unknown server');

  // Expose the exact live gate state needed to explain "why not formal A/B".
  if(!src.includes('trackerStatus:status,')){
    const needle='id,grade,executionScore:score,generatedAt:';
    if(!src.includes(needle))throw new Error('[manual-v2663] manual row return anchor missing');
    src=src.replace(
      needle,
      'id,grade,trackerStatus:status,executionConfirmed,reentryReady,monitorState:monitor,chaseAtr:manualFinite(lc.chaseAtr),blockers:blockers.slice(0,6),executionScore:score,generatedAt:'
    );
  }

  src=replaceFunction(src,'manualOpportunityResponse',UPGRADED_RESPONSE.trim());

  // Candidates are manual-only. Never let a C candidate enter the automatic manual push loop.
  const notifyOld="if(!manualPrefAllows(pref,row.grade)||row.freshness==='STALE'||row.trade?.status==='ACTIVE')continue;";
  const notifyNew="if(!manualPrefAllows(pref,row.grade)||row.candidate===true||row.freshness==='STALE'||row.trade?.status==='ACTIVE')continue;";
  if(src.includes(notifyOld))src=src.replace(notifyOld,notifyNew);
  else if(!src.includes('row.candidate===true'))throw new Error('[manual-v2663] notification safety anchor missing');

  src=`// ${MARKER}\n${src}`;
  saveChecked(serverPath,src,'server.js');
  installCandidateAssets();
  return {changed:true,mode:'strict A/B + stable high-confidence shadow candidates'};
}

if(import.meta.url===`file://${process.argv[1]}`)console.log(patchManualModeV263());
