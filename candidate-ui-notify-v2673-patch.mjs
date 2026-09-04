import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_UI_NOTIFY_CUSTOM_V2673_20260904';

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error('[v2673] '+label+' syntax invalid: '+String(r.stderr||r.stdout||r.error?.message||'').trim());
}
function writeChecked(file,src,label){
  const tmp=file+'.v2673-'+process.pid+'-'+Date.now()+'.tmp.js';
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function functionRange(src,name){
  const starts=[src.indexOf('async function '+name+'('),src.indexOf('function '+name+'(')].filter(x=>x>=0);
  if(!starts.length)return null;
  const start=Math.min(...starts);
  const paren=src.indexOf('(',start);
  if(paren<0)return null;

  let pDepth=0,quote=null,escape=false,lineComment=false,blockComment=false,paramEnd=-1;
  for(let i=paren;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue}
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\\\'){escape=true;continue}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='(')pDepth++;
    else if(ch===')'){pDepth--;if(pDepth===0){paramEnd=i;break}}
  }
  if(paramEnd<0)return null;
  const brace=src.indexOf('{',paramEnd);
  if(brace<0)return null;

  let depth=0;quote=null;escape=false;lineComment=false;blockComment=false;
  let templateExpr=0;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue}
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\\\'){escape=true;continue}
      if(quote==='`'&&ch==='$'&&next==='{'){templateExpr++;i++;continue}
      if(quote==='`'&&templateExpr>0){
        if(ch==='{')templateExpr++;
        else if(ch==='}')templateExpr--;
        continue;
      }
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0)return {start,end:i+1}}
  }
  return null;
}
function replaceFunction(src,name,code,{required=true}={}){
  const r=functionRange(src,name);
  if(!r){if(required)throw new Error('[v2673] function missing: '+name);return src}
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}
function insertBeforeLastClosure(src,code){
  const i=src.lastIndexOf('})();');
  if(i<0)throw new Error('[v2673] candidate runtime closure missing');
  return src.slice(0,i)+code.trim()+'\n'+src.slice(i);
}
function assertAll(src,needles,label){
  for(const n of needles)if(!src.includes(n))throw new Error('[v2673] '+label+' missing: '+n);
}

const SUBSCRIPTION_FN=String.raw`
function subscriptionAllows(rec, target = {}) {
  const enabledTraders=new Set(rec?.enabledTraders||[]),enabledTypes=new Set(rec?.enabledTypes||EVENT_TYPES);
  if(target.forceTest===true)return !target.endpoint||String(rec?.endpoint||'')===String(target.endpoint);

  if(target.candidateNotice===true){
    const pref=notificationCustomPrefsV2673();
    if(pref.candidateMode==='OFF')return false;
    return true;
  }

  if(target.testSignal===true){
    if(rec?.testSignalEnabled!==true)return false;
    const pref=notificationCustomPrefsV2673();
    const grade=shadowGradeV2616(target.testSignalTier);
    if(pref.formalMode==='A')return grade==='A';
    return ['A','B'].includes(String(grade||'').toUpperCase());
  }

  const eventType=String(target.eventType||'').toUpperCase();
  if(['OPEN','ADD','REDUCE','CLOSE'].includes(eventType)){
    return String(target.traderId||'')===CORE_TRADER_ID;
  }
  return false;
}
`;

const MANUAL_PREF_FN=String.raw`
function manualPrefAllows(pref,grade){
  if(pref?.enabled!==true)return false;
  const mode=notificationCustomPrefsV2673().formalMode;
  const g=String(grade||'').toUpperCase();
  return mode==='A'?g==='A':['A','B'].includes(g);
}
`;

const SERVER_APPEND=String.raw`
/* CANDIDATE_UI_NOTIFY_CUSTOM_V2673_20260904 */
const NOTIFICATION_CUSTOM_FILE_V2673=path.join(DATA_DIR,'notification-custom-v2673.json');
const CANDIDATE_NOTICE_DEDUP_FILE_V2673=path.join(DATA_DIR,'candidate-notice-dedup-v2673.json');
const CANDIDATE_NOTICE_REARM_MS_V2673=30*60*1000;
const CANDIDATE_NOTICE_SCAN_MS_V2673=90*1000;
let candidateNoticeBusyV2673=false;

function notificationCustomPrefsV2673(){
  const raw=loadJson(NOTIFICATION_CUSTOM_FILE_V2673,{});
  const formal=String(raw?.formalMode||'AB').toUpperCase();
  const candidate=String(raw?.candidateMode||'OFF').toUpperCase();
  const minWin=Math.max(45,Math.min(80,Number(raw?.candidateMinWinRate??55)));
  return {
    formalMode:['A','AB'].includes(formal)?formal:'AB',
    candidateMode:['OFF','PRIME','WATCH','ALL'].includes(candidate)?candidate:'OFF',
    candidateMinWinRate:minWin,
    updatedAt:raw?.updatedAt||null
  };
}
function saveNotificationCustomPrefsV2673(next={}){
  const old=notificationCustomPrefsV2673();
  const formal=String(next?.formalMode??old.formalMode).toUpperCase();
  const candidate=String(next?.candidateMode??old.candidateMode).toUpperCase();
  const minWin=Math.max(45,Math.min(80,Number(next?.candidateMinWinRate??old.candidateMinWinRate)));
  const out={
    formalMode:['A','AB'].includes(formal)?formal:old.formalMode,
    candidateMode:['OFF','PRIME','WATCH','ALL'].includes(candidate)?candidate:old.candidateMode,
    candidateMinWinRate:minWin,
    updatedAt:new Date().toISOString()
  };
  saveJson(NOTIFICATION_CUSTOM_FILE_V2673,out);
  return out;
}
function candidateNoticeModeAllowsV2673(mode,band){
  const b=String(band||'').toUpperCase(),m=String(mode||'OFF').toUpperCase();
  if(m==='PRIME')return b==='PRIME';
  if(m==='WATCH')return ['PRIME','WATCH'].includes(b);
  if(m==='ALL')return ['PRIME','WATCH','RELATIVE','RESEARCH'].includes(b);
  return false;
}
function candidateNoticeDedupV2673(){
  const x=loadJson(CANDIDATE_NOTICE_DEDUP_FILE_V2673,{});
  return x&&typeof x==='object'&&!Array.isArray(x)?x:{};
}
function candidateNoticeCanSendV2673(symbol,direction,now=Date.now()){
  const m=candidateNoticeDedupV2673(),k=[cleanFuturesSymbol(symbol),String(direction||'LONG').toUpperCase()].join('|');
  const at=Number(m[k]||0);
  return !(at>0&&now-at<CANDIDATE_NOTICE_REARM_MS_V2673);
}
function candidateNoticeMarkV2673(symbol,direction,now=Date.now()){
  const m=candidateNoticeDedupV2673(),cut=now-24*60*60*1000;
  for(const [k,v] of Object.entries(m))if(Number(v)<cut)delete m[k];
  m[[cleanFuturesSymbol(symbol),String(direction||'LONG').toUpperCase()].join('|')]=now;
  saveJson(CANDIDATE_NOTICE_DEDUP_FILE_V2673,m);
}
function candidateNoticeLabelV2673(band){
  return ({PRIME:'優先候選',WATCH:'觀察候選',RELATIVE:'相對候選',RESEARCH:'研究候選'})[String(band||'').toUpperCase()]||'候選';
}
async function candidateNoticeTickV2673(){
  if(candidateNoticeBusyV2673)return;
  const pref=notificationCustomPrefsV2673();
  if(pref.candidateMode==='OFF')return;
  candidateNoticeBusyV2673=true;
  try{
    const data=await manualOpportunityResponse(false);
    const rows=(Array.isArray(data?.rows)?data.rows:[])
      .filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE')
      .filter(x=>candidateNoticeModeAllowsV2673(pref.candidateMode,x.candidateBand))
      .filter(x=>Number(x?.candidateWinRate||0)>=pref.candidateMinWinRate)
      .sort((a,b)=>Number(b?.candidateScore||0)-Number(a?.candidateScore||0))
      .slice(0,5);

    for(const x of rows){
      if(!candidateNoticeCanSendV2673(x.symbol,x.direction))continue;
      const label=candidateNoticeLabelV2673(x.candidateBand);
      const title='候選｜'+label+'｜'+x.symbol+' '+(x.direction==='SHORT'?'做空':'做多');
      const body='候選勝率 '+Number(x.candidateWinRate||0).toFixed(1)+'%｜Shadow '+Math.round(Number(x.candidateScore||0))+'分｜開圖後由你決定是否出手';
      const tag='candidate-'+x.symbol+'-'+x.direction;
      const result=await sendPush({
        title,body,tag,renotify:false,data:{url:'/?page=advice'}
      },{
        candidateNotice:true,
        candidateBand:x.candidateBand,
        symbol:x.symbol,
        direction:x.direction
      });
      if(Number(result?.sent||0)>0)candidateNoticeMarkV2673(x.symbol,x.direction);
    }
  }catch(e){
    console.warn('[v2673] candidate notice',String(e?.message||e));
  }finally{candidateNoticeBusyV2673=false}
}

app.get('/api/notification-custom-v2673',(_req,res)=>{
  res.json({ok:true,version:'V2.6.73',coreTrader:'熬鷹資本',coreTraderFixed:true,...notificationCustomPrefsV2673()});
});
app.post('/api/notification-custom-v2673',(req,res)=>{
  try{
    const out=saveNotificationCustomPrefsV2673(req.body||{});
    res.json({ok:true,version:'V2.6.73',coreTrader:'熬鷹資本',coreTraderFixed:true,...out});
  }catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}
});

setInterval(candidateNoticeTickV2673,CANDIDATE_NOTICE_SCAN_MS_V2673);
setTimeout(candidateNoticeTickV2673,20*1000);
`;

const SW_FN=String.raw`
function allowedNoticeV2616(data={}){
  const tag=String(data.tag||'').toLowerCase(),text=String(data.title||'')+' '+String(data.body||'');
  if(/^notify-test-/.test(tag)||/^shadow-test-/.test(tag))return true;
  if(/^trader-/.test(tag)&&/(open|add|reduce|close)/.test(tag))return true;
  if(/^shadow-/.test(tag)&&/(影子|shadow)/i.test(text)&&/[AB]級/i.test(text))return true;
  if(/^candidate-/.test(tag)&&/候選/.test(text))return true;
  return false;
}
`;

const RENDER_FN=String.raw`
function render(){
  const h=ensureHost();if(!h||!data)return;
  const rows=(data.rows||[]).filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE').slice(0,5);
  const p=data.pipeline||{},rejects=Array.isArray(p.topRejects)?p.topRejects.slice(0,3):[];
  const rejectText=rejects.map(x=>esc(x.reason)+' '+Number(x.count||0)).join(' · ');
  const deep=Number(p.deepAnalyzed??p.analyzed??0),pool=Number(p.candidateUniverse??p.ranked??0),safe=Number(p.hardSafe||0),ab=Number(p.formalA||0)+Number(p.formalB||0);
  const line1='深析 '+deep+' → 候選池 '+pool+' → 安全 '+safe;
  const line2='A/B '+ab+' → 候選 '+rows.length;
  const sig=JSON.stringify([rows.map(x=>[
    keyOf(x),Math.round(Number(x.candidateScore||0)),Number(x.candidateWinRate||0).toFixed(1),
    x.candidateBand,Math.ceil(Number(x.candidateRemainingMs||0)/60000),x.structure?.state,x.trackerStatus,
    n(x?.marketMetrics?.volumeRatio),n(x?.marketMetrics?.takerRatio),n(x?.marketMetrics?.topRatio)
  ]),line1,line2,rejectText]);
  if(sig===lastSig&&h.querySelector('.candidate-list-v2664')){renderHistoryV2671();renderNotifyCustomV2673();return}
  lastSig=sig;

  h.innerHTML=
    '<summary class="candidate-group-summary-v2667 candidate-group-summary-v2671 candidate-group-summary-v2673">'+
      '<div class="candidate-group-title-v2667"><b>候選</b><span>'+rows.length+'</span></div>'+
      '<div class="candidate-group-copy-v2667 candidate-group-copy-v2673"><strong>Shadow 學習後的手動候選</strong><small><span>'+esc(line1)+'</span><span>'+esc(line2)+'</span></small></div>'+
      '<button type="button" class="candidate-refresh-v2671 candidate-refresh-v2673" data-candidate-refresh aria-label="更新候選">↻</button>'+
      '<i>⌄</i>'+
    '</summary>'+
    '<div class="mw-list candidate-list-v2664">'+
      (rows.length?rows.map(card).join(''):'<div class="mw-empty">本輪沒有正在有效期內的候選。'+esc(line1)+' · '+esc(line2)+(rejectText?' · 主要淘汰：'+rejectText:'')+'</div>')+
    '</div>';
  renderHistoryV2671();
  renderNotifyCustomV2673();
}
`;

const UI_HELPERS=String.raw`
let notifyCustomDataV2673=null,notifyCustomBusyV2673=false,notifyCustomSigV2673='';
async function loadNotifyCustomV2673(force=false){
  if(notifyCustomBusyV2673&&!force)return;
  notifyCustomBusyV2673=true;
  try{
    notifyCustomDataV2673=await candJsonV2671('/api/notification-custom-v2673');
    notifyCustomSigV2673='';
    renderNotifyCustomV2673();
  }catch{}finally{notifyCustomBusyV2673=false}
}
function notifyCustomHostV2673(){
  const ledger=document.getElementById('manualNoticeLedgerV2639');
  if(!ledger)return null;
  let host=document.getElementById('notificationCustomV2673');
  if(!host){
    host=document.createElement('section');
    host.id='notificationCustomV2673';
    host.className='notification-custom-v2673';
    ledger.insertAdjacentElement('afterend',host);
  }
  return host;
}
function notifyBtnV2673(kind,value,label,current){
  return '<button type="button" data-notify-kind-v2673="'+kind+'" data-notify-value-v2673="'+value+'" class="'+(String(current)===String(value)?'active':'')+'">'+label+'</button>';
}
function renderNotifyCustomV2673(){
  const host=notifyCustomHostV2673();if(!host||!notifyCustomDataV2673)return;
  const d=notifyCustomDataV2673,formal=String(d.formalMode||'AB'),cand=String(d.candidateMode||'OFF'),minWin=Math.round(Number(d.candidateMinWinRate||55));
  const sig=[formal,cand,minWin].join('|');if(sig===notifyCustomSigV2673&&host.children.length)return;notifyCustomSigV2673=sig;
  host.innerHTML=
    '<div class="nc-head-v2673"><div><b>通知設定</b><small>只控制手機推播，不影響 Shadow 學習與候選排序</small></div><span>自定義</span></div>'+
    '<div class="nc-row-v2673 fixed"><div><b>熬鷹資本</b><small>監控內 OPEN / ADD / REDUCE / CLOSE</small></div><strong>固定通知</strong></div>'+
    '<div class="nc-row-v2673"><div><b>正式 Shadow</b><small>A 級或 A+B 自動通知</small></div><div class="nc-seg-v2673">'+
      notifyBtnV2673('formal','A','只 A',formal)+notifyBtnV2673('formal','AB','A + B',formal)+'</div></div>'+
    '<div class="nc-row-v2673 candidate"><div><b>候選通知</b><small>候選仍由你開圖判斷，不會變正式 A/B</small></div><div class="nc-candidate-controls-v2673">'+
      '<div class="nc-seg-v2673 candidate">'+
        notifyBtnV2673('candidate','OFF','關閉',cand)+
        notifyBtnV2673('candidate','PRIME','只優先',cand)+
        notifyBtnV2673('candidate','WATCH','優先＋觀察',cand)+
        notifyBtnV2673('candidate','ALL','全部候選',cand)+
      '</div>'+
      '<label><span>最低候選勝率</span><input type="number" min="45" max="80" step="1" data-candidate-min-win-v2673 value="'+minWin+'"><em>%</em></label>'+
    '</div></div>'+
    '<div class="nc-msg-v2673" data-notify-msg-v2673></div>';
}
async function saveNotifyCustomV2673(patch){
  const host=notifyCustomHostV2673(),msg=host?.querySelector('[data-notify-msg-v2673]');
  if(msg)msg.textContent='儲存中…';
  try{
    const body={formalMode:notifyCustomDataV2673?.formalMode||'AB',candidateMode:notifyCustomDataV2673?.candidateMode||'OFF',candidateMinWinRate:notifyCustomDataV2673?.candidateMinWinRate||55,...patch};
    notifyCustomDataV2673=await candJsonV2671('/api/notification-custom-v2673',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    notifyCustomSigV2673='';renderNotifyCustomV2673();
    const next=document.querySelector('[data-notify-msg-v2673]');if(next){next.textContent='✓ 已儲存';setTimeout(()=>{if(next.isConnected)next.textContent=''},1600)}
  }catch(e){if(msg)msg.textContent='✕ '+e.message}
}
function bindNotifyCustomV2673(){
  if(document.documentElement.dataset.notifyCustomV2673==='1')return;
  document.documentElement.dataset.notifyCustomV2673='1';
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-notify-kind-v2673]');if(!b)return;
    e.preventDefault();
    const kind=b.dataset.notifyKindV2673,value=b.dataset.notifyValueV2673;
    if(kind==='formal')saveNotifyCustomV2673({formalMode:value});
    else if(kind==='candidate')saveNotifyCustomV2673({candidateMode:value});
  },true);
  document.addEventListener('change',e=>{
    const input=e.target.closest?.('[data-candidate-min-win-v2673]');if(!input)return;
    const v=Math.max(45,Math.min(80,Number(input.value||55)));input.value=v;saveNotifyCustomV2673({candidateMinWinRate:v});
  });
  setTimeout(()=>loadNotifyCustomV2673(true),700);
  setInterval(()=>renderNotifyCustomV2673(),4000);
  setInterval(()=>loadNotifyCustomV2673(false),5*60*1000);
}
`;

const CSS=String.raw`
/* CANDIDATE_UI_NOTIFY_CUSTOM_V2673_20260904 */
.mw-candidate-group-v2664{overflow:hidden!important}
.mw-candidate-group-v2664>.candidate-group-summary-v2673{
  width:100%!important;max-width:100%!important;box-sizing:border-box!important;overflow:hidden!important;
  grid-template-columns:auto minmax(0,1fr) 32px 12px!important;
  gap:10px!important;padding:14px 14px!important;
}
.candidate-group-copy-v2673{min-width:0!important}
.candidate-group-copy-v2673 strong{display:block!important;font-size:16px!important;line-height:1.3!important}
.candidate-group-copy-v2673 small{display:grid!important;gap:2px!important;margin-top:5px!important;min-width:0!important}
.candidate-group-copy-v2673 small span{
  display:block!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;
  font-size:13.5px!important;line-height:1.42!important;
}
.candidate-refresh-v2673{
  width:30px!important;min-width:30px!important;height:30px!important;
  align-self:center!important;justify-self:end!important;margin:0!important;
  position:static!important;transform:none!important;box-sizing:border-box!important;
}

.candidate-v2671>details>summary{
  position:relative!important;
  grid-template-columns:38px minmax(0,1fr) 78px!important;
  gap:11px!important;
  padding:17px 54px 17px 14px!important;
  min-height:112px!important;
}
.candidate-v2671>details>summary>.candidate-delete-v2671{
  position:absolute!important;top:11px!important;right:11px!important;
  width:31px!important;min-width:31px!important;height:31px!important;
  border-radius:9px!important;z-index:4!important;
}
.candidate-v2671>details>summary>.mw-chevron{
  position:absolute!important;right:18px!important;bottom:12px!important;
  width:auto!important;height:auto!important;margin:0!important;
  color:#ad956a!important;font-size:15px!important;z-index:2!important;
}
.candidate-v2671 .candidate-main-v2667{min-width:0!important}
.candidate-v2671 .candidate-meta-v2667{
  display:flex!important;flex-wrap:wrap!important;max-width:100%!important;
  white-space:normal!important;line-height:1.42!important;
}
.candidate-v2671 .candidate-meta-v2667.sub{display:flex!important;flex-wrap:wrap!important;white-space:normal!important}
.candidate-v2671 .candidate-score{align-self:center!important;justify-self:end!important}

.notification-custom-v2673{
  margin:16px 0 8px;border:1px solid #34434c;border-radius:16px;background:#11191e;overflow:hidden;
}
.nc-head-v2673{
  display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 17px;
  background:#172128;border-bottom:1px solid #30404a;
}
.nc-head-v2673 b{display:block;color:#e6d19a;font-size:18px;line-height:1.2}
.nc-head-v2673 small{display:block;margin-top:5px;color:#89969e;font-size:12.5px;line-height:1.45;white-space:normal}
.nc-head-v2673>span{flex:0 0 auto;border:1px solid #675632;border-radius:999px;padding:5px 9px;color:#d6b76d;font-size:11.5px}
.nc-row-v2673{
  display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;
  padding:15px 17px;border-bottom:1px solid #29363e;
}
.nc-row-v2673:last-of-type{border-bottom:0}
.nc-row-v2673>div:first-child b{display:block;color:#e3e7e6;font-size:15.5px}
.nc-row-v2673>div:first-child small{display:block;margin-top:4px;color:#87949b;font-size:12.5px;line-height:1.45;white-space:normal}
.nc-row-v2673.fixed strong{color:#e0c27d;font-size:13px}
.nc-seg-v2673{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.nc-seg-v2673 button{
  appearance:none;border:1px solid #40505a;background:#121a1f;color:#9eabb2;border-radius:9px;
  padding:8px 11px;font-size:12.5px;font-weight:700;white-space:nowrap
}
.nc-seg-v2673 button.active{border-color:#8c7138;background:#2a2112;color:#e7c977}
.nc-row-v2673.candidate{grid-template-columns:1fr!important;align-items:start!important}
.nc-candidate-controls-v2673{display:grid!important;gap:11px!important}
.nc-seg-v2673.candidate{justify-content:flex-start!important}
.nc-candidate-controls-v2673 label{display:flex;align-items:center;gap:8px;color:#98a4aa;font-size:12.5px}
.nc-candidate-controls-v2673 input{
  width:70px;border:1px solid #3d4b54;background:#0d1418;color:#edf0ee;border-radius:8px;
  padding:8px 9px;font-size:14px;outline:none
}
.nc-candidate-controls-v2673 em{font-style:normal;color:#7f8b91}
.nc-msg-v2673{min-height:18px;padding:0 17px 12px;color:#aeb8bd;font-size:12.5px}

@media(max-width:640px){
  .mw-candidate-group-v2664>.candidate-group-summary-v2673{
    grid-template-columns:auto minmax(0,1fr) 30px 10px!important;
    gap:8px!important;padding:13px 11px!important;
  }
  .candidate-group-copy-v2673 strong{font-size:15px!important}
  .candidate-group-copy-v2673 small span{font-size:12.5px!important}
  .candidate-v2671>details>summary{
    grid-template-columns:36px minmax(0,1fr) 68px!important;
    padding:16px 49px 16px 11px!important;gap:9px!important;
  }
  .candidate-v2671>details>summary>.candidate-delete-v2671{top:10px!important;right:9px!important}
  .candidate-v2671>details>summary>.mw-chevron{right:16px!important;bottom:11px!important}
  .nc-row-v2673{grid-template-columns:1fr!important;gap:10px!important;align-items:start!important}
  .nc-row-v2673.fixed{grid-template-columns:minmax(0,1fr) auto!important}
  .nc-seg-v2673{justify-content:flex-start!important}
  .nc-seg-v2673 button{padding:8px 9px;font-size:12px}
}
`;

function patchServer(){
  const file=path.join(__dirname,'server.js');
  if(!fs.existsSync(file))throw new Error('[v2673] server.js missing');
  let src=fs.readFileSync(file,'utf8');
  if(src.includes(MARKER))return false;

  assertAll(src,['PUSH_RECOVERY_V2665_20260904','CANDIDATE_OPS_HISTORY_TRADE_V2671_20260904','manualOpportunityResponse','shadowGradeV2616','sendPush'],'server prerequisites');

  src=replaceFunction(src,'subscriptionAllows',SUBSCRIPTION_FN);
  src=replaceFunction(src,'manualPrefAllows',MANUAL_PREF_FN,{required:false});
  src+='\n'+SERVER_APPEND+'\n';
  src='// '+MARKER+'\n'+src;
  writeChecked(file,src,'server.js');
  return true;
}
function patchSw(){
  const file=path.join(__dirname,'public','sw.js');
  if(!fs.existsSync(file))throw new Error('[v2673] sw.js missing');
  let src=fs.readFileSync(file,'utf8');
  if(src.includes(MARKER))return false;
  src=replaceFunction(src,'allowedNoticeV2616',SW_FN);
  src='// '+MARKER+'\n'+src;
  writeChecked(file,src,'sw.js');
  return true;
}
function patchCandidateUi(){
  const jsPath=path.join(__dirname,'public','manual-candidate-v2664.js');
  const cssPath=path.join(__dirname,'public','manual-candidate-v2664.css');
  const htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(jsPath))throw new Error('[v2673] candidate runtime missing');

  let js=fs.readFileSync(jsPath,'utf8');
  if(!js.includes(MARKER)){
    assertAll(js,['CANDIDATE_OPS_HISTORY_TRADE_V2671_20260904','function render(){','bindCandidateOpsV2671();'],'candidate UI prerequisites');
    const helperPos=js.indexOf('function zhDirV2666(');
    if(helperPos<0)throw new Error('[v2673] candidate helper anchor missing');
    js=js.slice(0,helperPos)+UI_HELPERS.trim()+'\n'+js.slice(helperPos);
    js=replaceFunction(js,'render',RENDER_FN);
    js=insertBeforeLastClosure(js,'bindNotifyCustomV2673();');
    js=js.replace("const VERSION='2.6.71';","const VERSION='2.6.73';");
    js='/* '+MARKER+' */\n'+js;
    writeChecked(jsPath,js,'candidate runtime');
  }

  let css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';
  if(!css.includes(MARKER)){css+='\n'+CSS+'\n';fs.writeFileSync(cssPath,css,'utf8')}

  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.js\?v=[^"'<>]+/g,'/manual-candidate-v2664.js?v=2673-0904');
    h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2673-0904');
    fs.writeFileSync(htmlPath,h,'utf8');
  }
  return true;
}
function verifyFinal(){
  const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
  const sw=fs.readFileSync(path.join(__dirname,'public','sw.js'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'public','manual-candidate-v2664.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'public','manual-candidate-v2664.css'),'utf8');

  assertAll(server,["/api/notification-custom-v2673","candidateNotice:true","candidateMode==='OFF'","formalMode==='A'","CORE_TRADER_ID","candidate-notice-dedup-v2673.json"],'server final');
  assertAll(sw,['candidate-','allowedNoticeV2616'],'SW final');
  assertAll(ui,['notificationCustomV2673','熬鷹資本','固定通知','只 A','A + B','候選通知','最低候選勝率','candidate-group-copy-v2673'],'candidate UI final');
  assertAll(css,['.candidate-group-summary-v2673','overflow:hidden!important','position:absolute!important;top:11px!important;right:11px!important','.notification-custom-v2673'],'candidate CSS final');

  check(path.join(__dirname,'server.js'),'final server.js');
  check(path.join(__dirname,'public','sw.js'),'final sw.js');
  check(path.join(__dirname,'public','manual-candidate-v2664.js'),'final candidate runtime');
}

export function patchCandidateUiNotifyV2673(){
  const files={server:patchServer(),sw:patchSw(),candidateUi:patchCandidateUi()};
  verifyFinal();
  return {changed:Object.values(files).some(Boolean),version:'V2.6.73',files,candidateHeaderTwoLines:true,refreshContained:true,deleteTopRight:true,formalModes:['A','AB'],candidateModes:['OFF','PRIME','WATCH','ALL'],coreTraderFixed:'熬鷹資本'};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateUiNotifyV2673());
