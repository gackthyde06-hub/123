import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const BASE_MARKER='MANUAL_MODE_V263_20260902';
const MARKER='MANUAL_RECOVERY_STABLE_V2664_20260904';

const CANDIDATE_JS=String.raw`(()=>{
'use strict';
const VERSION='2.6.64';
const OPEN_KEY='manual-candidate-open-v2664';
const DRAFT_KEY='manual-candidate-draft-v2664';
let data=null,busy=false,lastSig='',timer=null,waitTimer=null;

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
  const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);
  try{
    const r=await fetch(url,{cache:'no-store',signal:c.signal,...opt});
    const d=await r.json().catch(()=>null);
    if(!r.ok||!d?.ok)throw new Error(d?.error||('HTTP '+r.status));
    return d;
  }finally{clearTimeout(t)}
}
function ensureHost(){
  const shell=document.querySelector('#manualWorkspaceV2638 .mw-shell');
  if(!shell)return null;
  let h=document.getElementById('manualCandidateV2664');
  if(!h){
    h=document.createElement('details');
    h.id='manualCandidateV2664';
    h.className='mw-group mw-candidate-group-v2664';
    h.open=true;
    shell.appendChild(h);
  }else if(h.parentElement!==shell)shell.appendChild(h);
  return h;
}
function waitForHost(){
  if(ensureHost()){if(waitTimer){clearInterval(waitTimer);waitTimer=null}render();return}
  if(waitTimer)return;
  let ntry=0;
  waitTimer=setInterval(()=>{
    ntry++;
    if(ensureHost()){clearInterval(waitTimer);waitTimer=null;render()}
    else if(ntry>=20){clearInterval(waitTimer);waitTimer=null}
  },500);
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
  const hold=Number(x.candidateHoldUntil||0)-Date.now();
  const stable=hold>0?'至少保留 '+Math.max(1,Math.ceil(hold/60000))+' 分':'穩定候選';
  return '<article class="mw-card mw-candidate-card-v2664" data-candidate-id="'+esc(id)+'">'+
    '<details '+(open?'open':'')+'>'+
      '<summary>'+
        '<span class="mw-grade candidate">候</span>'+
        '<div class="mw-main"><div><a href="'+tvUrl(x.symbol)+'" target="_blank" rel="noopener">'+esc(x.symbol)+'</a><em class="'+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</em></div>'+
        '<small>'+esc(s.label||'等待結構')+' · '+esc(stable)+' · '+age(x.freshnessAgeMs)+'</small></div>'+
        '<div class="mw-score candidate-score"><b>'+pct(x.candidateWinRate)+'</b><span>候選勝率</span></div>'+
        '<i class="mw-chevron">⌄</i>'+
      '</summary>'+
      '<div class="mw-body">'+
        '<div class="candidate-banner-v2664"><b>Shadow 目前最有機會</b><span>候選與正式 A/B 分開。這裡是累積樣本加權後的觀察優先名單，不會因候選身份自動通知。</span></div>'+
        '<div class="mw-quick candidate-metrics-v2664">'+
          '<div><span>候選勝率</span><b>'+pct(x.candidateWinRate)+'</b><small>校準＋Shadow 樣本加權</small></div>'+
          '<div><span>Shadow 共識分</span><b>'+Math.round(Number(x.candidateScore||0))+'</b><small>候選排序主分數</small></div>'+
          '<div><span>Shadow 相關樣本</span><b>'+Number(ev.shadowSample||0)+'筆 · '+pct(ev.shadowHitRate)+'</b><small>PF '+(n(ev.shadowProfitFactor)==null?'—':Number(ev.shadowProfitFactor).toFixed(2))+' · '+esc(ev.shadowLevel||'')+'</small></div>'+
          '<div><span>校準勝率</span><b>'+pct(ev.calibratedWinRate)+'</b><small>排名 #'+(x.rank??'—')+' · '+Math.round(Number(x.rankScore||0))+'分</small></div>'+
          '<div><span>結構</span><b>'+esc(s.label||'—')+' '+(n(s.health)==null?'':Math.round(s.health))+'</b><small>'+esc(x.trackerStatus||'')+'</small></div>'+
          '<div><span>TP2 RR</span><b>'+(n(e.rr)==null?'—':Number(e.rr).toFixed(2))+'</b><small>資料 '+Math.round(Number(x.dataHealth?.coverage||0))+'/'+Math.round(Number(x.dataHealth?.confidence||0))+'</small></div>'+
        '</div>'+
        '<div class="candidate-explain-v2664">'+
          '<section><b>為什麼現在選它</b>'+list(x.candidateReasons,'Shadow 還在累積證據')+'</section>'+
          '<section><b>離正式 B 還差什麼</b>'+list(g.toB,'已滿足主要 B 條件','gap')+'</section>'+
          '<section><b>離正式 A 還差什麼</b>'+list(g.toA,'已滿足主要 A 條件','gap')+'</section>'+
          '<section class="candidate-caution-v2664"><b>如果現在要打，注意</b>'+list(x.tradeCautions,'只在進場區執行，失效即退','warn')+'</section>'+
        '</div>'+
        '<div class="mw-levels">'+
          '<div><span>參考成本</span><b>'+px(e.price)+'</b></div>'+
          '<div><span>進場區</span><b>'+(n(e.zoneLow)!=null&&n(e.zoneHigh)!=null?px(e.zoneLow)+'～'+px(e.zoneHigh):'—')+'</b></div>'+
          '<div><span>TP1 / TP2</span><b>'+px(e.target)+' / '+px(e.target2)+'</b></div>'+
          '<div><span>SP1</span><b>'+px(e.stop)+'</b></div>'+
        '</div>'+
        '<div class="mw-form candidate-form-v2664">'+
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
          '<div class="mw-actions"><button type="button" data-candidate-current="'+esc(id)+'">成本用現價 '+px(e.currentPrice)+'</button><button type="button" class="save" data-candidate-build="'+esc(id)+'">以候選建立追蹤</button></div>'+
          '<div class="candidate-build-note-v2664">候選不是正式訊號。若 B/A 缺口還沒補齊就進場，等於主動接受較高不確定性；實際結果仍會完整回寫 actual-trades / 學習統計。</div>'+
          '<div class="mw-msg" data-candidate-msg="'+esc(id)+'"></div>'+
        '</div>'+
      '</div>'+
    '</details>'+
  '</article>';
}
function render(){
  const h=ensureHost();if(!h||!data)return;
  const rows=(data.rows||[]).filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE').slice(0,3);
  const sig=JSON.stringify(rows.map(x=>[
    keyOf(x),Math.round(Number(x.candidateScore||0)),Number(x.candidateWinRate||0).toFixed(1),
    x.structure?.state,x.trackerStatus,(x.formalGap?.toB||[]).join('|'),(x.formalGap?.toA||[]).join('|')
  ]));
  if(sig===lastSig&&h.querySelector('.candidate-list-v2664'))return;
  lastSig=sig;
  h.innerHTML='<summary><div><b>候選</b><span>'+rows.length+'</span></div><small>Shadow 全樣本加權後，目前最有機會 · 穩定保留 · 非正式 A/B</small><i>⌄</i></summary>'+
    '<div class="mw-list candidate-list-v2664">'+
      (rows.length?rows.map(card).join(''):'<div class="mw-empty">目前沒有通過高勝率門檻的候選。寧可空白，不塞低品質標的。</div>')+
    '</div>';
}
function row(id){return (data?.rows||[]).find(x=>x?.candidate===true&&keyOf(x)===id)||null}
function inputVal(card,k){const v=card?.querySelector('[data-cf="'+k+'"]')?.value;return v===''?null:Number(v)}
async function build(id){
  const x=row(id),card=document.querySelector('.mw-candidate-card-v2664[data-candidate-id="'+CSS.escape(id)+'"]'),msg=card?.querySelector('[data-candidate-msg="'+CSS.escape(id)+'"]');
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
    msg.textContent='✓ 已建立；後台照實際 TP / SP 結果回寫學習';
    setTimeout(()=>refresh(true),800);
  }catch(e){msg.textContent='✕ '+e.message}
}
async function refresh(force=false){
  if(busy)return;
  busy=true;
  try{
    data=await json('/api/manual-opportunities'+(force?'?force=1':''));
    waitForHost();render();
  }catch(e){
    const h=ensureHost();
    if(h&&!data)h.innerHTML='<summary><div><b>候選</b><span>0</span></div><small>候選資料暫時不可用</small><i>⌄</i></summary><div class="mw-empty">'+esc(e.message)+'</div>';
  }finally{busy=false}
}
function bind(){
  document.addEventListener('click',e=>{
    const c=e.target.closest?.('[data-candidate-current]');
    if(c){
      e.preventDefault();
      const x=row(c.dataset.candidateCurrent),card=c.closest('.mw-candidate-card-v2664'),i=card?.querySelector('[data-cf="entry"]');
      if(x&&i&&n(x.entry?.currentPrice)!=null){i.value=String(x.entry.currentPrice);saveDraft(c.dataset.candidateCurrent,'entry',i.value)}
      return;
    }
    const b=e.target.closest?.('[data-candidate-build]');
    if(b){e.preventDefault();void build(b.dataset.candidateBuild);return}
  },true);
  document.addEventListener('input',e=>{
    const i=e.target.closest?.('.mw-candidate-card-v2664 [data-cf]');
    if(!i)return;
    const id=i.closest('.mw-candidate-card-v2664')?.dataset?.candidateId;
    if(id)saveDraft(id,i.dataset.cf,i.value);
  });
  document.addEventListener('toggle',e=>{
    const d=e.target;
    if(!(d instanceof HTMLDetailsElement)||!d.closest?.('.mw-candidate-card-v2664'))return;
    const id=d.closest('.mw-candidate-card-v2664')?.dataset?.candidateId,o=opens();
    if(d.open)o[id]=true;else delete o[id];
    write(OPEN_KEY,o);
  },{capture:true});
}
function boot(){
  bind();waitForHost();void refresh(true);
  timer=setInterval(()=>{
    if(document.visibilityState!=='visible')return;
    const p=currentPage();
    if(p==='ideas'||p==='test')void refresh(false);
  },60000);
  window.addEventListener('pageshow',()=>{waitForHost();void refresh(false)});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){waitForHost();void refresh(false)}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.ManualCandidateV2664={version:VERSION,refresh};
})();`;

const CANDIDATE_CSS=String.raw`
/* V2.6.64 stable Shadow candidates */
.mw-candidate-group-v2664{border-color:#45525c!important;background:linear-gradient(155deg,#1b242b,#141b21)!important}
.mw-candidate-group-v2664>summary{background:linear-gradient(90deg,rgba(105,148,184,.13),rgba(207,171,96,.07))!important}
.mw-candidate-group-v2664>summary b{color:#b9d5ed!important}
.mw-candidate-group-v2664>summary small{color:#999fa4!important}
.mw-candidate-card-v2664{border-color:#40505b!important;background:linear-gradient(150deg,#202b34,#172028)!important}
.mw-grade.candidate{background:#2e4859!important;color:#c9e2f4!important}
.candidate-score b{color:#b9d9ef!important}
.candidate-banner-v2664{display:grid;gap:3px;margin-top:11px;padding:10px 11px;border:1px solid #43525c;border-radius:11px;background:linear-gradient(135deg,rgba(77,113,139,.20),rgba(160,127,67,.10))}
.candidate-banner-v2664 b{color:#d8e5ef;font-size:11px}
.candidate-banner-v2664 span{color:#919ca4;font-size:9px;line-height:1.45}
.candidate-explain-v2664{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
.candidate-explain-v2664 section{padding:10px;border:1px solid #37444d;border-radius:11px;background:#172128}
.candidate-explain-v2664 section>b{display:block;margin-bottom:6px;color:#c6b17f;font-size:10px}
.candidate-explain-v2664 section>span{display:block;color:#a7adb0;font-size:9px;line-height:1.5}
.candidate-explain-v2664 section>span.gap{color:#e0b08a}
.candidate-explain-v2664 section>span.warn{color:#efb08e}
.candidate-caution-v2664{border-color:#5a493c!important;background:linear-gradient(145deg,#211d1b,#1b2023)!important}
.candidate-caution-v2664>b{color:#e0b36e!important}
.candidate-build-note-v2664{margin-top:8px;padding:8px 9px;border-left:2px solid #a77b43;background:#1c1d1d;color:#a8a197;font-size:8.5px;line-height:1.45}
@media(max-width:520px){.candidate-explain-v2664{grid-template-columns:1fr}.candidate-metrics-v2664{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[manual-v2664] ${label} syntax invalid: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function writeChecked(file,src,label){
  const tmp=`${file}.v2664-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function replaceOnce(src,oldText,newText,label){
  if(src.includes(newText))return src;
  if(!src.includes(oldText))throw new Error(`[manual-v2664] anchor missing: ${label}`);
  return src.replace(oldText,newText);
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
function ensureBaseManual(src){
  if(src.includes(BASE_MARKER))return src;

  const helperFile=path.join(__dirname,'manual-mode-server-code.inc');
  const aggregateFile=path.join(__dirname,'manual-mode-aggregate-code.inc');
  if(!fs.existsSync(helperFile)||!fs.existsSync(aggregateFile))throw new Error('[manual-v2664] manual include files missing');

  const helperCode=fs.readFileSync(helperFile,'utf8').trimEnd()+'\n\n';
  const aggregateCode=fs.readFileSync(aggregateFile,'utf8').trimEnd();

  const helperAnchor="app.get('/api/market-flow', async (_req, res) => {";
  src=replaceOnce(src,helperAnchor,helperCode+helperAnchor,'base manual backend insertion');

  const dedupOld="const signalKey=String(body.signalKey||'').slice(0,100)||null;if(signalKey){const existing=actualTrades.find(x=>x?.version==='V10.2.6'&&x.status==='ACTIVE'&&x.signalKey===signalKey);if(existing)return {error:'這筆訊號已有追蹤中的實際建倉',existingId:existing.id}}";
  const dedupNew="const signalKey=String(body.signalKey||'').slice(0,100)||null,manualOpportunityId=String(body.manualOpportunityId||'').slice(0,160)||null;if(signalKey){const existing=actualTrades.find(x=>x?.version==='V10.2.6'&&x.status==='ACTIVE'&&x.signalKey===signalKey);if(existing)return {error:'這筆訊號已有追蹤中的實際建倉',existingId:existing.id}}if(manualOpportunityId){const existing=actualTrades.find(x=>x?.version==='V10.2.6'&&x.status==='ACTIVE'&&x.manualOpportunityId===manualOpportunityId);if(existing)return {error:'這個手動機會已有追蹤中的實際建倉',existingId:existing.id}}";
  src=replaceOnce(src,dedupOld,dedupNew,'manual actual dedup');

  const metaOld="source:'MANUAL_ACTUAL',strategyId:";
  const metaNew="source:'MANUAL_ACTUAL',manualMode:body.manualMode===true,manualGrade:['A','B','C'].includes(String(body.manualGrade||'').toUpperCase())?String(body.manualGrade).toUpperCase():null,manualGradeScore:finiteMetric(body.manualGradeScore),manualGradeAt:String(body.manualGradeAt||'').slice(0,40)||null,manualOpportunityId,manualReasons:Array.isArray(body.manualReasons)?body.manualReasons.slice(0,8).map(x=>String(x).slice(0,100)):[],manualSnapshot:manualCleanSnapshot(body.manualSnapshot),manualRank:finiteMetric(body.manualSnapshot?.rank),manualStructureState:String(body.manualSnapshot?.structureState||'').slice(0,30)||null,manualStructureHealth:finiteMetric(body.manualSnapshot?.structureHealth),manualShadowHitRate:finiteMetric(body.manualSnapshot?.shadowHitRate),manualShadowProfitFactor:finiteMetric(body.manualSnapshot?.shadowProfitFactor),manualRr:finiteMetric(body.manualSnapshot?.rr),strategyId:";
  src=replaceOnce(src,metaOld,metaNew,'manual actual metadata');

  const aggRe=/function actualTradeAggregate\(\)\{[\s\S]*?\n\}\n\nconst shadowActiveSymbols=/;
  if(!aggRe.test(src))throw new Error('[manual-v2664] actualTradeAggregate anchor missing');
  src=src.replace(aggRe,aggregateCode+'\n\nconst shadowActiveSymbols=');

  const csvNeedle="'leverage','notional'";
  if(src.includes(csvNeedle))src=src.replace(csvNeedle,"'leverage','manualMode','manualGrade','manualGradeScore','manualGradeAt','manualOpportunityId','manualRank','manualStructureState','manualStructureHealth','manualShadowHitRate','manualShadowProfitFactor','manualRr','notional'");

  src=replaceOnce(src,'    testSignalTimer = setTimeout(testSignalLoop, 8000);','    testSignalTimer = setTimeout(testSignalLoop, 8000);\n    manualOpportunityTimer=setTimeout(manualOpportunityLoop,12000);','manual timer start');
  src=replaceOnce(src,'  if (testSignalTimer) clearTimeout(testSignalTimer);','  if (testSignalTimer) clearTimeout(testSignalTimer);\n  if (manualOpportunityTimer) clearTimeout(manualOpportunityTimer);','manual timer stop');
  return src;
}

const CANDIDATE_SERVER=String.raw`
const MANUAL_CANDIDATE_MAX_V2664=3;
const MANUAL_CANDIDATE_CONFIRM_SCANS_V2664=2;
const MANUAL_CANDIDATE_MIN_SCORE_V2664=68;
const MANUAL_CANDIDATE_MIN_WIN_V2664=60;
const MANUAL_CANDIDATE_HARD_FLOOR_V2664=55;
const MANUAL_CANDIDATE_HOLD_MS_V2664=20*60*1000;
const MANUAL_CANDIDATE_MISS_MS_V2664=8*60*1000;
const MANUAL_CANDIDATE_REPLACE_EDGE_V2664=6;
const MANUAL_CANDIDATE_STATE_FILE_V2664=path.join(DATA_DIR,'manual-candidate-state-v2664.json');

function manualCandidateKeyV2664(x){return [String(x?.symbol||''),String(x?.direction||'')].join('|')}
function manualCandidateLoadStateV2664(){
  const rows=loadJson(MANUAL_CANDIDATE_STATE_FILE_V2664,[]);
  const map=new Map();
  for(const x of Array.isArray(rows)?rows:[]){
    if(!x?.key)continue;
    map.set(String(x.key),{
      firstSeen:Number(x.firstSeen||0),lastSeen:Number(x.lastSeen||0),confirm:Number(x.confirm||0),
      selected:x.selected===true,selectedAt:Number(x.selectedAt||0),snapshot:x.snapshot||null,metric:x.metric||null
    });
  }
  return map;
}
let manualCandidateStateV2664=manualCandidateLoadStateV2664();
function manualCandidateSaveStateV2664(){
  const rows=[...manualCandidateStateV2664.entries()].map(([key,x])=>({
    key,firstSeen:x.firstSeen,lastSeen:x.lastSeen,confirm:x.confirm,selected:x.selected===true,
    selectedAt:x.selectedAt,snapshot:x.snapshot,metric:x.metric
  })).slice(0,24);
  saveJson(MANUAL_CANDIDATE_STATE_FILE_V2664,rows);
}
function manualCandidateScoreV2664(x){
  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??50;
  const sh=manualFinite(x?.shadow?.hitRate)??50;
  const exec=manualFinite(x?.executionScore)??0;
  const rank=manualFinite(x?.rankScore)??0;
  const structure=manualFinite(x?.structure?.health)??45;
  const coverage=manualFinite(x?.dataHealth?.coverage)??40;
  const confidence=manualFinite(x?.dataHealth?.confidence)??40;
  const pf=manualFinite(x?.shadow?.profitFactor);
  const sample=Math.max(0,Number(x?.shadow?.sample||0));
  const rel=Math.min(1,sample/30);
  const pfAdj=pf==null?0:Math.max(-6,Math.min(7,(pf-1)*8));
  const score=cal*.31+sh*.19*rel+50*.19*(1-rel)+exec*.14+rank*.10+structure*.10+coverage*.04+confidence*.05+pfAdj;
  const win=sample>=8?(cal*.62+sh*.38):cal;
  return {score:Number(Math.max(0,Math.min(100,score)).toFixed(1)),win:Number(Math.max(0,Math.min(100,win)).toFixed(1)),sample};
}
function manualCandidateHardInvalidV2664(x,m){
  if(!x)return true;
  if(x?.trade?.status==='ACTIVE')return true;
  if(['DROPPED','EXPIRED','LOSS','WIN','TIMEOUT'].includes(String(x?.trackerStatus||'').toUpperCase()))return true;
  if(String(x?.structure?.state||'').toUpperCase()==='DESTROYED')return true;
  if(x?.institutionalEdge?.hardBlock===true)return true;
  if(String(x?.notificationTier||'').toUpperCase()==='BLOCKED')return true;
  const rr=manualFinite(x?.entry?.rr);
  if(rr!=null&&rr<1)return true;
  if(m.win<MANUAL_CANDIDATE_HARD_FLOOR_V2664)return true;
  return false;
}
function manualCandidateQualifiedV2664(x,m){
  if(!x||String(x.grade||'')!=='C'||manualCandidateHardInvalidV2664(x,m))return false;
  const shSample=Math.max(0,Number(x?.shadow?.sample||0));
  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??0;
  return m.score>=MANUAL_CANDIDATE_MIN_SCORE_V2664&&m.win>=MANUAL_CANDIDATE_MIN_WIN_V2664&&(shSample>=8||cal>=63);
}
function manualCandidateGapV2664(x){
  const toB=[],toA=[],st=String(x?.structure?.state||'UNKNOWN'),status=String(x?.trackerStatus||'NO_TRACKER');
  const age=Number(x?.freshnessAgeMs||0),coverage=Number(x?.dataHealth?.coverage||0),confidence=Number(x?.dataHealth?.confidence||0);
  const progress=Number(x?.observationProgress||0),score=Number(x?.executionScore||0),rr=manualFinite(x?.entry?.rr),chase=manualFinite(x?.chaseAtr);
  if(status==='NO_TRACKER')toB.push('還沒有完整 tracker；正式 B 需要即時觀察資料');
  if(age>300000)toB.push('要重新取得 5 分鐘內的判讀；目前過期會直接卡 C');
  if(score<60)toB.push('正式 B 執行分需 ≥60；目前 '+Math.round(score));
  if(!x?.structure)toB.push('Structure V2 尚未完成');
  if(st==='DAMAGED')toB.push('結構仍受損，先等收復');
  if(rr!=null&&rr<1.25)toB.push('RR 偏低；最好回到至少 1.25');
  if(!toB.length)toB.push('主要差在正式即時閘門重新確認，不是歷史勝率不足');

  if(x?.executionConfirmed!==true)toA.push('A 級需要正式進場確認');
  if(age>120000)toA.push('A 級要求判讀 ≤2 分鐘');
  if(coverage<78)toA.push('資料完整度需 ≥78；目前 '+Math.round(coverage));
  if(confidence<72)toA.push('資料可信度需 ≥72；目前 '+Math.round(confidence));
  if(progress<72)toA.push('觀察完成度需 ≥72；目前 '+Math.round(progress));
  if(!['INTACT','RECLAIMING','OPPORTUNITY'].includes(st))toA.push('結構還沒回到 A 級可接受狀態');
  if(rr!=null&&rr<1.5)toA.push('A 級 TP2 RR 需 ≥1.50；目前 '+rr.toFixed(2));
  if(String(x?.monitorState||'')==='WEAKENING')toA.push('目前仍在轉弱');
  if(chase!=null&&chase>.45)toA.push('離建議區太遠；A 級不允許追價');
  if(Array.isArray(x?.blockers)&&x.blockers.length)toA.push('通知閘門仍有阻擋：'+x.blockers.slice(0,2).join(' / '));
  if(!toA.length)toA.push('A 級主要只差即時確認維持');
  return {toB:toB.slice(0,5),toA:toA.slice(0,7)};
}
function manualCandidateCautionV2664(x){
  const a=[],e=x?.entry||{},st=String(x?.structure?.state||''),age=Number(x?.freshnessAgeMs||0),rr=manualFinite(e?.rr),chase=manualFinite(x?.chaseAtr);
  a.push('候選不是正式 A/B；最安全仍是等上面缺口補齊');
  if(age>300000)a.push('判讀已過期：進場前重新確認 5m/15m 沒有反向 BOS / CHoCH');
  if(chase!=null&&chase>.45)a.push('離建議區偏遠，不追；等回踩再看');
  if(st==='DAMAGED'||st==='RECLAIMING')a.push('結構未完整；只接受收復後回踩，不直接追');
  if(e?.zoneLow!=null&&e?.zoneHigh!=null)a.push('只在 '+e.zoneLow+'～'+e.zoneHigh+' 附近執行，離區就重評');
  if(e?.stop!=null)a.push('SP '+e.stop+' 為失效參考；失效不要硬扛');
  if(rr!=null&&rr<1.5)a.push('TP2 RR '+rr.toFixed(2)+'，報酬風險比仍不漂亮');
  return a.slice(0,6);
}
function manualCandidateReasonsV2664(x,m){
  const a=[],sh=x?.shadow||{};
  a.push('Shadow '+Number(sh.sample||0)+'筆 · 命中 '+(manualFinite(sh.hitRate)==null?'—':Number(sh.hitRate).toFixed(1)+'%')+' · PF '+(manualFinite(sh.profitFactor)==null?'—':Number(sh.profitFactor).toFixed(2)));
  a.push('校準勝率 '+(manualFinite(x.calibratedWinRate)==null?'—':Number(x.calibratedWinRate).toFixed(1)+'%')+' · Shadow 共識分 '+m.score);
  a.push('目前建議排名 #'+(x.rank??'—')+' · 排名分 '+Math.round(Number(x.rankScore||0)));
  if(x?.structure?.label)a.push('結構 '+x.structure.label+' · '+Math.round(Number(x.structure.health||0))+'分');
  return a.slice(0,5);
}
function manualCandidateDecorateV2664(x,st,m,now){
  const out={...x};
  out.candidate=true;
  out.candidateKey=manualCandidateKeyV2664(x);
  out.candidateScore=m.score;
  out.candidateWinRate=m.win;
  out.candidateSince=st.selectedAt||st.firstSeen||now;
  out.candidateHoldUntil=(st.selectedAt||now)+MANUAL_CANDIDATE_HOLD_MS_V2664;
  out.candidateStable=true;
  out.originalGrade=String(x.grade||'C');
  out.candidateEvidence={
    calibratedWinRate:manualFinite(x.calibratedWinRate),
    shadowSample:Number(x?.shadow?.sample||0),shadowHitRate:manualFinite(x?.shadow?.hitRate),
    shadowProfitFactor:manualFinite(x?.shadow?.profitFactor),shadowLevel:String(x?.shadow?.level||''),score:m.score
  };
  out.formalGap=manualCandidateGapV2664(x);
  out.tradeCautions=manualCandidateCautionV2664(x);
  out.candidateReasons=manualCandidateReasonsV2664(x,m);
  return out;
}
function manualStableCandidatesV2664(rows){
  const now=Date.now(),current=new Map(),formal=new Set();
  for(const x of rows||[]){
    const k=manualCandidateKeyV2664(x);
    if(['A','B'].includes(String(x.grade||'')))formal.add(k);
    const m=manualCandidateScoreV2664(x);
    current.set(k,{row:x,metric:m,qualified:manualCandidateQualifiedV2664(x,m),hardInvalid:manualCandidateHardInvalidV2664(x,m)});
    let st=manualCandidateStateV2664.get(k);
    if(!st)st={firstSeen:now,lastSeen:0,confirm:0,selected:false,selectedAt:0,snapshot:null,metric:null};
    const consecutive=st.lastSeen&&now-st.lastSeen<150000;
    st.confirm=consecutive?st.confirm+1:1;
    st.lastSeen=now;st.snapshot=x;st.metric=m;
    manualCandidateStateV2664.set(k,st);
  }
  for(const [k,st] of [...manualCandidateStateV2664]){
    if(formal.has(k)){manualCandidateStateV2664.delete(k);continue}
    const cur=current.get(k);
    if(cur?.hardInvalid){manualCandidateStateV2664.delete(k);continue}
    if(now-(st.lastSeen||0)>2*60*60*1000)manualCandidateStateV2664.delete(k);
  }

  let selected=[...manualCandidateStateV2664.entries()].filter(([k,st])=>st.selected&&!formal.has(k));
  const challengers=[...current.entries()]
    .filter(([k,v])=>!formal.has(k)&&v.qualified&&!manualCandidateStateV2664.get(k)?.selected&&manualCandidateStateV2664.get(k)?.confirm>=MANUAL_CANDIDATE_CONFIRM_SCANS_V2664)
    .sort((a,b)=>b[1].metric.score-a[1].metric.score||b[1].metric.win-a[1].metric.win||Number(a[1].row.rank||99)-Number(b[1].row.rank||99));

  while(selected.length<MANUAL_CANDIDATE_MAX_V2664&&challengers.length){
    const [k]=challengers.shift(),st=manualCandidateStateV2664.get(k);
    st.selected=true;st.selectedAt=now;manualCandidateStateV2664.set(k,st);
    selected.push([k,st]);
  }

  if(selected.length&&challengers.length){
    const replaceable=selected.filter(([k,st])=>now-(st.selectedAt||0)>=MANUAL_CANDIDATE_HOLD_MS_V2664)
      .sort((a,b)=>(a[1].metric?.score||0)-(b[1].metric?.score||0));
    const best=challengers[0];
    if(replaceable.length&&best){
      const weak=replaceable[0],weakScore=weak[1].metric?.score||0,bestScore=best[1].metric?.score||0;
      if(bestScore>=weakScore+MANUAL_CANDIDATE_REPLACE_EDGE_V2664){
        weak[1].selected=false;manualCandidateStateV2664.set(weak[0],weak[1]);
        const st=manualCandidateStateV2664.get(best[0]);st.selected=true;st.selectedAt=now;manualCandidateStateV2664.set(best[0],st);
      }
    }
  }

  const output=[];
  for(const [k,st] of manualCandidateStateV2664){
    if(!st.selected||formal.has(k))continue;
    const cur=current.get(k);
    if(!cur&&now-(st.lastSeen||0)>MANUAL_CANDIDATE_MISS_MS_V2664)continue;
    const x=cur?.row||st.snapshot,m=cur?.metric||st.metric;
    if(!x||!m||manualCandidateHardInvalidV2664(x,m))continue;
    output.push(manualCandidateDecorateV2664(x,st,m,now));
  }
  output.sort((a,b)=>{
    const sa=manualCandidateStateV2664.get(a.candidateKey),sb=manualCandidateStateV2664.get(b.candidateKey);
    return Number(sa?.selectedAt||0)-Number(sb?.selectedAt||0)||Number(b.candidateScore||0)-Number(a.candidateScore||0);
  });
  manualCandidateSaveStateV2664();
  return output.slice(0,MANUAL_CANDIDATE_MAX_V2664);
}

async function manualOpportunityResponse(force=false){
  const base=await manualOpportunityResponseBaseV2664(force);
  const baseRows=Array.isArray(base?.rows)?base.rows:[];
  const candidates=manualStableCandidatesV2664(baseRows);
  const byKey=new Map(candidates.map(x=>[x.candidateKey,x]));
  const rows=baseRows.map(x=>byKey.get(manualCandidateKeyV2664(x))||x);
  return {
    ...base,
    version:'V2.6.64',
    methodology:'正式 A/B 完全沿用原規則；候選獨立以 Shadow 累積樣本、校準勝率、PF、執行分、排名、Structure 與資料品質加權。新候選需連續2次確認；入選至少20分鐘；暫時掉榜8分鐘內保留；替換需新候選高6分。',
    counts:{...(base?.counts||{}),candidate:rows.filter(x=>x.candidate===true).length},
    rows
  };
}
`;

function upgradeStableCandidates(src){
  if(src.includes('manualStableCandidatesV2664'))return src;

  // Expose only the live gate fields needed for "why not formal A/B".
  const returnNeedle='id,grade,executionScore:score,generatedAt:';
  if(src.includes(returnNeedle)){
    src=src.replace(returnNeedle,'id,grade,trackerStatus:status,executionConfirmed,reentryReady,monitorState:monitor,chaseAtr:manualFinite(lc.chaseAtr),blockers:blockers.slice(0,6),executionScore:score,generatedAt:');
  }

  const r=functionRange(src,'manualOpportunityResponse');
  if(!r)throw new Error('[manual-v2664] manualOpportunityResponse missing after base install');
  const original=src.slice(r.start,r.end);
  const renamed=original.replace('async function manualOpportunityResponse(','async function manualOpportunityResponseBaseV2664(');
  src=src.slice(0,r.start)+renamed+'\n'+CANDIDATE_SERVER.trim()+'\n'+src.slice(r.end);

  // Candidates are manual observation only. They never enter automatic manual pushes,
  // even when notification mode is ALL.
  const loopNeedle='for(const row of data.rows.slice(0,8)){';
  if(src.includes(loopNeedle)&&!src.includes('if(row.candidate===true)continue;')){
    src=src.replace(loopNeedle,loopNeedle+'if(row.candidate===true)continue;');
  }
  return src;
}
function installCandidateAssets(){
  const pub=path.join(__dirname,'public');
  fs.mkdirSync(pub,{recursive:true});
  const js=path.join(pub,'manual-candidate-v2664.js'),css=path.join(pub,'manual-candidate-v2664.css');
  fs.writeFileSync(js,CANDIDATE_JS,'utf8');
  fs.writeFileSync(css,CANDIDATE_CSS,'utf8');
  check(js,'candidate runtime');

  const idx=path.join(pub,'index.html');
  if(!fs.existsSync(idx))return;
  let h=fs.readFileSync(idx,'utf8');
  h=h.replace(/\s*<script[^>]+src=["']\/manual-candidate-v2663\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,'');
  h=h.replace(/\s*<link[^>]+href=["']\/manual-candidate-v2663\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,'');
  h=h.replace(/\s*<script[^>]+src=["']\/manual-candidate-v2664\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,'');
  h=h.replace(/\s*<link[^>]+href=["']\/manual-candidate-v2664\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,'');
  if(!h.includes('</head>')||!h.includes('</body>'))throw new Error('[manual-v2664] index anchors missing');
  h=h.replace('</head>','<link rel="stylesheet" href="/manual-candidate-v2664.css?v=2664-0904">\n</head>');
  h=h.replace('</body>','<script defer src="/manual-candidate-v2664.js?v=2664-0904"></script>\n</body>');
  fs.writeFileSync(idx,h,'utf8');
}

export function patchManualModeV263({serverPath=path.join(__dirname,'server.js')}={}){
  let src=fs.readFileSync(serverPath,'utf8');
  if(src.includes(MARKER)){
    installCandidateAssets();
    return {changed:false,reason:'already-applied',route:src.includes("app.get('/api/manual-opportunities'")};
  }

  src=ensureBaseManual(src);
  src=upgradeStableCandidates(src);

  if(!src.includes("app.get('/api/manual-opportunities'"))throw new Error('[manual-v2664] /api/manual-opportunities route missing after patch');
  if(!src.includes('manualOpportunityTimer=setTimeout(manualOpportunityLoop,12000)'))throw new Error('[manual-v2664] manual notification loop timer missing');
  if(!src.includes('manualCleanSnapshot'))throw new Error('[manual-v2664] manual actual-trade learning metadata missing');

  src=`// ${MARKER}\n${src}`;
  writeChecked(serverPath,src,'server.js');
  installCandidateAssets();
  return {
    changed:true,
    route:true,
    notifications:true,
    actualLearning:true,
    candidateAutoPush:false,
    stableCandidates:true
  };
}

if(import.meta.url===`file://${process.argv[1]}`)console.log(patchManualModeV263());
