import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_READING_LOCK_V2670_20260904';
const BASE='MARKETWIDE_CANDIDATE_RECALL_V2669_20260904';

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[candidate-v2670] ${label} syntax invalid: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function writeChecked(file,src,label){
  const tmp=`${file}.v2670-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function functionRange(src,name){
  const starts=[src.indexOf(`function ${name}(`),src.indexOf(`async function ${name}(`)].filter(x=>x>=0);
  if(!starts.length)return null;
  const start=Math.min(...starts),brace=src.indexOf('{',start);
  if(brace<0)return null;
  let depth=0,quote=null,escape=false,lineComment=false,blockComment=false,templateExpr=0;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue}
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
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0)return {start,end:i+1}}
  }
  return null;
}
function replaceFunction(src,name,code){
  const r=functionRange(src,name);
  if(!r)throw new Error(`[candidate-v2670] function missing: ${name}`);
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}

const HELPERS=String.raw`
const CANDIDATE_PIN_KEY_V2670='manual-candidate-reading-pins-v2670';
const CANDIDATE_PIN_TTL_V2670=30*60*1000;
let candidateRenderPendingV2670=false;

function candidateOpenIdsV2670(h){
  const s=new Set();
  try{
    for(const d of h.querySelectorAll('.candidate-v2667 details[open],.candidate-v2670 details[open]')){
      const a=d.closest('[data-candidate-id]'),k=a?.getAttribute('data-candidate-id');
      if(k)s.add(k);
    }
  }catch{}
  return s;
}
function candidatePinsLoadV2670(){
  try{
    const x=JSON.parse(localStorage.getItem(CANDIDATE_PIN_KEY_V2670)||'{}');
    return x&&typeof x==='object'&&!Array.isArray(x)?x:{};
  }catch{return{}}
}
function candidatePinsSaveV2670(pins){
  try{localStorage.setItem(CANDIDATE_PIN_KEY_V2670,JSON.stringify(pins))}catch{}
}
function candidateArchiveMapV2670(){
  const m=new Map(),rows=Array.isArray(data?.pipeline?.recentArchived)?data.pipeline.recentArchived:[];
  for(const a of rows){
    const k=[String(a?.symbol||''),String(a?.direction||'')].join('|');
    if(k&&!m.has(k))m.set(k,a);
  }
  return m;
}
function candidateRowsPinnedV2670(h){
  const now=Date.now(),open=candidateOpenIdsV2670(h),pins=candidatePinsLoadV2670();
  const current=(Array.isArray(data?.rows)?data.rows:[]).filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE');
  const currentMap=new Map();

  for(const x of current){
    const k=keyOf(x);if(!k)continue;
    currentMap.set(k,x);
    const old=pins[k]||{};
    pins[k]={
      row:x,
      firstSeen:Number(old.firstSeen||x?.candidateSince||now),
      expiresAt:Number(x?.candidateExpiresAt||old.expiresAt||now+CANDIDATE_PIN_TTL_V2670),
      order:Number(old.order||old.firstSeen||x?.candidateSince||now),
      lastSeen:now,
      status:'LIVE'
    };
  }

  const archives=candidateArchiveMapV2670();
  for(const [k,p] of Object.entries(pins)){
    const isOpen=open.has(k),expired=now>=Number(p.expiresAt||0);
    if(currentMap.has(k))continue;
    const a=archives.get(k);
    const reason=String(a?.reason||'');
    if(a){
      p.archiveReason=reason;
      p.archiveDetails=String(a?.details||'');
      if(reason==='BUILT')p.status='BUILT';
      else if(reason==='PROMOTED')p.status='PROMOTED';
      else if(reason==='HARD_INVALID')p.status='HARD_INVALID';
      else if(reason==='TTL_EXPIRED')p.status='EXPIRED';
    }else p.status='HOLDING';

    // Never pull the card out from under the user while they are reading it.
    if(isOpen)continue;

    // Once the user closes it, a definitive backend transition can leave the candidate list.
    if(['BUILT','PROMOTED','HARD_INVALID','EXPIRED'].includes(p.status)){delete pins[k];continue}
    if(expired){delete pins[k];continue}
    if(now-Number(p.lastSeen||0)>CANDIDATE_PIN_TTL_V2670){delete pins[k];continue}
  }

  candidatePinsSaveV2670(pins);
  return Object.entries(pins)
    .sort((a,b)=>Number(a[1].order||0)-Number(b[1].order||0))
    .slice(0,5)
    .map(([k,p])=>({
      ...(p.row||{}),
      candidate:true,
      candidateKey:k,
      candidatePinnedV2670:p.status!=='LIVE',
      candidatePinStatusV2670:p.status,
      candidateRemainingMs:Math.max(0,Number(p.expiresAt||now)-now)
    }));
}
function candidateBindReadingLockV2670(h){
  if(h?.dataset?.candidateReadingLockV2670==='1')return;
  if(!h?.dataset)return;
  h.dataset.candidateReadingLockV2670='1';
  h.addEventListener('toggle',e=>{
    const d=e.target;
    if(!(d instanceof HTMLDetailsElement))return;
    if(!d.closest('.candidate-v2667,.candidate-v2670'))return;
    if(d.open){
      // Opening a candidate is a hard UI lock: background refresh may update memory,
      // but this DOM is frozen until the user closes the card.
      candidateRowsPinnedV2670(h);
      return;
    }
    if(!h.querySelector('.candidate-v2667 details[open],.candidate-v2670 details[open]')&&candidateRenderPendingV2670){
      candidateRenderPendingV2670=false;
      setTimeout(()=>render(),0);
    }
  },true);
}
`;

const META_FN=String.raw`
function candidateMetaV2667(x){
  const left=zhBandV2666(x),structure=String(x?.structure?.label||'等待結構'),obs=observedV2667(x),remain=minsV2667(x?.candidateRemainingMs);
  const pinned=x?.candidatePinnedV2670===true;
  return '<div class="candidate-meta-v2667"><span>'+esc(left)+'</span><span>'+esc(structure)+'</span></div>'+
    '<div class="candidate-meta-v2667 sub"><span>已觀察 '+obs+' 分</span><span>'+remain+' 分後自動歸檔</span></div>'+
    (pinned?'<div class="candidate-reading-state-v2670">讀取鎖定中 · 後台刷新不會把這張卡抽掉</div>':'');
}
`;

const RENDER_FN=String.raw`
function render(){
  const h=ensureHost();if(!h||!data)return;
  candidateBindReadingLockV2670(h);

  // This is the key rule: if the user is reading an expanded candidate,
  // do not replace candidate DOM at all. Keep the exact text/scroll/open state.
  if(h.querySelector('.candidate-v2667 details[open],.candidate-v2670 details[open]')){
    candidateRenderPendingV2670=true;
    candidateRowsPinnedV2670(h);
    return;
  }

  const rows=candidateRowsPinnedV2670(h);
  const p=data.pipeline||{},line=pipelineLine(p,rows),rejects=Array.isArray(p.topRejects)?p.topRejects.slice(0,3):[];
  const rejectText=rejects.map(x=>esc(x.reason)+' '+Number(x.count||0)).join(' · ');
  const sig=JSON.stringify([rows.map(x=>[
    keyOf(x),Math.round(Number(x.candidateScore||0)),Number(x.candidateWinRate||0).toFixed(1),
    x.candidateBand,Math.ceil(Number(x.candidateRemainingMs||0)/60000),x.structure?.state,x.trackerStatus,x.candidatePinStatusV2670
  ]),line,rejectText]);
  if(sig===lastSig&&h.querySelector('.candidate-list-v2664'))return;
  lastSig=sig;

  h.innerHTML=
    '<summary class="candidate-group-summary-v2667">'+
      '<div class="candidate-group-title-v2667"><b>候選</b><span>'+rows.length+'</span></div>'+
      '<div class="candidate-group-copy-v2667"><strong>Shadow 學習後的手動候選</strong><small>'+esc(line)+'</small></div>'+
      '<i>⌄</i>'+
    '</summary>'+
    '<div class="mw-list candidate-list-v2664">'+
      (rows.length?rows.map(x=>card({...x})).join(''):'<div class="mw-empty">目前沒有通過 Shadow 安全篩選、且仍在候選有效期內的標的。'+esc(line)+(rejectText?' · 主要淘汰：'+rejectText:'')+'</div>')+
    '</div>';
}
`;

const CSS=String.raw`
/* CANDIDATE_READING_LOCK_V2670_20260904 */
.candidate-reading-state-v2670{
  margin-top:5px!important;
  color:#c9a85e!important;
  font-size:12.5px!important;
  line-height:1.45!important;
  white-space:normal!important;
}
.candidate-v2670 details[open],
.candidate-v2667 details[open]{
  scroll-margin-top:96px;
}
`;

export function patchCandidateReadingLockV2670(){
  const jsPath=path.join(__dirname,'public','manual-candidate-v2664.js');
  const cssPath=path.join(__dirname,'public','manual-candidate-v2664.css');
  const htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(jsPath))throw new Error('[candidate-v2670] candidate runtime missing');

  let js=fs.readFileSync(jsPath,'utf8');
  if(!js.includes(BASE))throw new Error('[candidate-v2670] V2669 marketwide candidate layer missing');
  if(!js.includes(MARKER)){
    const renderPos=js.indexOf('function render(');
    if(renderPos<0)throw new Error('[candidate-v2670] render missing');
    js=js.slice(0,renderPos)+HELPERS.trim()+'\n'+js.slice(renderPos);
    js=replaceFunction(js,'candidateMetaV2667',META_FN);
    js=replaceFunction(js,'render',RENDER_FN);
    js=js.replace("const VERSION='2.6.69';","const VERSION='2.6.70';");
    js='/* '+MARKER+' */\n'+js;
    writeChecked(jsPath,js,'candidate runtime');
  }

  let css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';
  if(!css.includes(MARKER)){css+='\n'+CSS+'\n';fs.writeFileSync(cssPath,css,'utf8')}

  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.js\?v=[^"'<>]+/g,'/manual-candidate-v2664.js?v=2670-0904');
    h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2670-0904');
    fs.writeFileSync(htmlPath,h,'utf8');
  }

  return {changed:true,version:'V2.6.70',readingLock:true,pinnedMinutes:30,backendRefreshDeferredWhileOpen:true};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateReadingLockV2670());
