import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const MARKER='ADVISORY_BUCKETS_V26271_STABLE_20260904';

function must(...p){const f=path.join(ROOT,...p);if(!fs.existsSync(f))throw new Error(`[v26271-stable] missing ${p.join('/')}`);return f}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0||r.error)throw new Error(`[v26271-stable] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`)}
function saveJs(file,before,after){if(before===after)return false;const tmp=`${file}.${process.pid}.${Date.now()}.tmp.js`;fs.writeFileSync(tmp,after,'utf8');try{check(tmp);fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function replaceNamedFunction(src,name,replacement){
  const start=src.indexOf(`function ${name}(`);if(start<0)return src;
  const brace=src.indexOf('{',start);if(brace<0)return src;
  let depth=0,mode='code',esc=false;
  for(let i=brace;i<src.length;i++){
    const c=src[i],n=src[i+1];
    if(mode==='line'){if(c==='\n')mode='code';continue}
    if(mode==='block'){if(c==='*'&&n==='/'){mode='code';i++}continue}
    if(mode==='sq'||mode==='dq'||mode==='bt'){
      if(esc){esc=false;continue}
      if(c==='\\'){esc=true;continue}
      if((mode==='sq'&&c==="'")||(mode==='dq'&&c==='"')||(mode==='bt'&&c==='`'))mode='code';
      continue;
    }
    if(c==='/'&&n==='/'){mode='line';i++;continue}
    if(c==='/'&&n==='*'){mode='block';i++;continue}
    if(c==="'"){mode='sq';continue}
    if(c==='"'){mode='dq';continue}
    if(c==='`'){mode='bt';continue}
    if(c==='{')depth++;
    else if(c==='}'&&--depth===0)return src.slice(0,start)+replacement+src.slice(i+1);
  }
  throw new Error(`[v26271-stable] cannot parse function ${name}`);
}
function replaceRequired(src,re,repl,label){if(!re.test(src))throw new Error(`[v26271-stable] ${label} anchor missing`);re.lastIndex=0;return src.replace(re,repl)}

function patchApp(){
  const f=must('public','app.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER+'_APP'))return {changed:false,reason:'already'};

  if(s.includes('function tvReturnApplyV268(')){
    s=replaceNamedFunction(s,'tvReturnApplyV268',`function tvReturnApplyV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000){tvReturnClearV268();return false}
  const wanted=String(d.page||''),active=document.querySelector('.pageTab.active')?.dataset?.page||'';
  if(wanted&&active!==wanted){tvReturnClearV268();return false}
  const sym=String(d.symbol||''),nodes=[...document.querySelectorAll('.rankCard,.testCard,.testMonitorCard,.actualTradeMonitorCard,.biasRow,.matrixCoin,.sg-candidate-card,.manual-card,.manual-shadow-history-row,.abc-sample-row,.actualTradeItemV2613')].filter(x=>x.offsetParent!==null);
  let card=d.key?nodes.find(x=>stableElementKeyV2617(x)===d.key)||null:null;
  if(!card&&sym)card=nodes.find(x=>String(x.querySelector?.('[data-tv-symbol]')?.dataset?.tvSymbol||'').toUpperCase()===sym)||null;
  const link=card?.querySelector?.('[data-tv-symbol]')||[...document.querySelectorAll('[data-tv-symbol]')].find(x=>String(x.dataset?.tvSymbol||'').toUpperCase()===sym&&x.offsetParent!==null)||null;
  if(card&&Number.isFinite(Number(d.cardTop))){const delta=card.getBoundingClientRect().top-Number(d.cardTop);if(Math.abs(delta)<window.innerHeight*2)window.scrollBy({top:delta,left:0,behavior:'auto'});return true}
  if(link&&Number.isFinite(Number(d.top))){const delta=link.getBoundingClientRect().top-Number(d.top);if(Math.abs(delta)<window.innerHeight*2)window.scrollBy({top:delta,left:0,behavior:'auto'});return true}
  return false
}`);
  }
  if(s.includes('function tvReturnRestoreV268(')){
    s=replaceNamedFunction(s,'tvReturnRestoreV268',`function tvReturnRestoreV268(){
  const d=tvReturnReadV268();if(!d||Date.now()-Number(d.at||0)>15*60_000){tvReturnClearV268();return}
  const wanted=String(d.page||''),active=document.querySelector('.pageTab.active')?.dataset?.page||'';
  if(wanted&&active!==wanted){tvReturnClearV268();return}
  if(window.__tvStableRestoreBusyV26271)return;window.__tvStableRestoreBusyV26271=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{try{tvReturnApplyV268()}finally{tvReturnClearV268();setTimeout(()=>window.__tvStableRestoreBusyV26271=false,120)}}))
}`);
  }
  if(s.includes('function restoreViewportAnchorV2617('))s=replaceNamedFunction(s,'restoreViewportAnchorV2617','function restoreViewportAnchorV2617(root,a){return}');
  s=`// ${MARKER}_APP\n${s}`;
  return {changed:saveJs(f,before,s)};
}

function patchManual(){
  const f=must('public','manual-mode-ui.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER+'_MANUAL'))return {changed:false,reason:'already'};

  s=s.replace(/filter:'(?:A|B|A_AUTO|A_SUGGEST|B_AUTO|B_SUGGEST)'/,"filter:'A_SUGGEST'");

  const gradeRe=/const gradeText=[^\n]+;/;
  const helpers=`const autoNotifyRow=x=>['HIGH','NORMAL'].includes(String(x?.notificationTier||'').toUpperCase());
const advisoryScore=x=>{const p=Number(x?.observationProgress||0),e=Number(x?.executionScore||0),w=Number(x?.calibratedWinRate||0),edge=Number(x?.institutionalEdge?.score||0),risk=Math.min(5,Array.isArray(x?.risks)?x.risks.length:0);return Math.max(0,Math.min(100,p*.34+e*.30+w*.20+edge*.16-risk*2.2))};
const suggestionEligible=x=>{const t=String(x?.notificationTier||'').toUpperCase(),g=String(x?.grade||''),edge=x?.institutionalEdge||{},p=Number(x?.observationProgress||0),e=Number(x?.executionScore||0),w=Number(x?.calibratedWinRate||0),score=advisoryScore(x);if(!['A','B'].includes(g)||autoNotifyRow(x)||t==='BLOCKED'||edge.hardBlock===true)return false;return score>=58&&(p>=68||e>=72||w>=56||Number(edge.score||0)>=60)};
const bucketOf=x=>{const g=String(x?.grade||'');if(!['A','B'].includes(g))return'HIDDEN';if(autoNotifyRow(x))return g+'_AUTO';if(suggestionEligible(x))return g+'_SUGGEST';return'HIDDEN'};
const bucketLabel=x=>String(x?.grade||'')+'級｜'+(autoNotifyRow(x)?'自動通知':'手動觀察');
const bucketNote=x=>autoNotifyRow(x)?'已達自動通知資格；保留在這裡讓你決定是否實際建倉。':'接近通知門檻但尚未自動放行；列入手動觀察，缺少的條件看「風險 / 還缺什麼」。';
const normalizeBucket=v=>['A_AUTO','A_SUGGEST','B_AUTO','B_SUGGEST'].includes(v)?v:(v==='B'?'B_SUGGEST':'A_SUGGEST');
const MANUAL_ORDER_KEY_V26271='manual-bucket-order-v26271-stable';
const MANUAL_DEFAULT_KEY_V26271='manual-bucket-default-v26271-stable';
const manualRowKeyV26271=x=>String(x?.id||[x?.symbol,x?.direction,x?.strategyId||x?.strategyLabel||''].join('|'));
let manualOrderV26271=(()=>{try{const x=JSON.parse(localStorage.getItem(MANUAL_ORDER_KEY_V26271)||'{}');return x&&typeof x==='object'?x:{}}catch{return{}}})();
const stableBucketRowsV26271=(rows,bucket)=>{const old=Array.isArray(manualOrderV26271[bucket])?manualOrderV26271[bucket]:[],pos=new Map(old.map((k,i)=>[String(k),i])),keep=[],fresh=[];for(const x of rows)(pos.has(manualRowKeyV26271(x))?keep:fresh).push(x);keep.sort((a,b)=>pos.get(manualRowKeyV26271(a))-pos.get(manualRowKeyV26271(b)));fresh.sort((a,b)=>bucket.endsWith('SUGGEST')?advisoryScore(b)-advisoryScore(a):Number(b.calibratedWinRate||0)-Number(a.calibratedWinRate||0)||Number(b.executionScore||0)-Number(a.executionScore||0));const out=[...keep,...fresh];manualOrderV26271[bucket]=out.map(manualRowKeyV26271);try{localStorage.setItem(MANUAL_ORDER_KEY_V26271,JSON.stringify(manualOrderV26271))}catch{}return out};
let lastManualRenderSigV26271='';
const manualRenderSigV26271=(filter,rows,source,noticeOn)=>JSON.stringify([filter,source,noticeOn,rows.map(x=>[manualRowKeyV26271(x),x?.notificationTier,Math.round(Number(x?.executionScore||0)),Math.round(Number(x?.calibratedWinRate||0)*10),Math.round(Number(x?.observationProgress||0)),Number(x?.entry?.currentPrice||0),x?.trade?.status||'',(x?.risks||[]).length])]);
const gradeText=x=>bucketLabel(x);`;
  s=replaceRequired(s,gradeRe,helpers,'grade helper');
  s=s.replace(/gradeText\(x\.grade\)/g,'gradeText(x)');
  s=s.replace(/<div class="manual-note"><b>\$\{gradeText\(x\)\}<\/b><span>[\s\S]*?<\/span><\/div>/,
    '<div class="manual-note"><b>${gradeText(x)}</b><span>${esc(bucketNote(x))}</span></div>');


  const renderLine=/  if\(!mount\(\)\|\|!state\.data\)return;const box=document\.getElementById\('manualOpsPanel'\),anchor=manualAnchor\(box\),d=state\.data,[^\n]+;/;
  const renderNew="  if(!mount()||!state.data)return;const box=document.getElementById('manualOpsPanel'),anchor=null,d=state.data,filter=normalizeBucket(state.filter),bucketRows=(d.rows||[]).map(x=>({x,b:bucketOf(x)})).filter(z=>z.b!=='HIDDEN'),rows=stableBucketRowsV26271(bucketRows.filter(z=>z.b===filter).map(z=>z.x),filter),stats=(d.stats?.byGrade||[]).filter(x=>['A','B'].includes(x.key)),rankStats=(d.stats?.byRank||[]).filter(x=>x.key!=='無排名'),abc=d.shadowLearning||{},abcBy=abc.byGrade||[],source=window.loadShadowNoticeSourceV2616?.()||'BOTH',noticeOn=window.loadShadowNoticeMasterV2616?.()??state.pref.enabled;state.filter=filter;";
  s=replaceRequired(s,renderLine,renderNew,'render state');

  const boxAnchor='  box.innerHTML=`';
  if(!s.includes(boxAnchor))throw new Error('[v26271-stable] render html anchor missing');
  const pre=`  const bucketCounts={A_AUTO:0,A_SUGGEST:0,B_AUTO:0,B_SUGGEST:0};for(const z of bucketRows)bucketCounts[z.b]=(bucketCounts[z.b]||0)+1;
  const bucketTitle={A_AUTO:'A級 · 自動通知',A_SUGGEST:'A級 · 手動觀察',B_AUTO:'B級 · 自動通知',B_SUGGEST:'B級 · 手動觀察'}[filter]||'A/B';
  const renderSig=manualRenderSigV26271(filter,rows,source,noticeOn);if(renderSig===lastManualRenderSigV26271&&box.querySelector('.manual-list'))return;lastManualRenderSigV26271=renderSig;
`;
  s=s.replace(boxAnchor,pre+boxAnchor);

  const gradeBlock=/<div class="manual-grade-summary">[\s\S]*?<\/div><div class="manual-abc-shadow">/;
  const tabs=`<div class="manual-grade-summary v26271-buckets"><button class="bucket-a bucket-auto \${filter==='A_AUTO'?'on':''}" data-filter="A_AUTO"><b>A · 自動通知</b><span>\${bucketCounts.A_AUTO||0}</span><small>已達通知資格</small></button><button class="bucket-a bucket-suggest \${filter==='A_SUGGEST'?'on':''}" data-filter="A_SUGGEST"><b>A · 手動觀察</b><span>\${bucketCounts.A_SUGGEST||0}</span><small>接近門檻 · 手動決定</small></button><button class="bucket-b bucket-auto \${filter==='B_AUTO'?'on':''}" data-filter="B_AUTO"><b>B · 自動通知</b><span>\${bucketCounts.B_AUTO||0}</span><small>已達通知資格</small></button><button class="bucket-b bucket-suggest \${filter==='B_SUGGEST'?'on':''}" data-filter="B_SUGGEST"><b>B · 手動觀察</b><span>\${bucketCounts.B_SUGGEST||0}</span><small>接近門檻 · 手動決定</small></button></div><div class="manual-abc-shadow">`;
  s=replaceRequired(s,gradeBlock,tabs,'bucket tabs');

  s=s.replace(/<b>(?:手動作戰清單|影子 A\/B 判斷|A\/B 機會清單)<\/b><small>[^<]*<\/small>/,
    '<b>A/B 機會清單</b><small>自動通知＝系統已放行；手動觀察＝接近門檻但尚未通知。C 級只留後台學習。</small>');
  s=s.replace('目前這個等級沒有候選。這不是故障，代表條件還沒到。','目前這個分類沒有標的；符合條件後會固定留在這裡，不因小幅分數波動亂換順序。');

  const initFilter=/try\{const f=localStorage\.getItem\(FILTER_KEY\);[^}]*\}catch\{\}/;
  const initNew="try{const f=localStorage.getItem(FILTER_KEY);if(!localStorage.getItem(MANUAL_DEFAULT_KEY_V26271)){state.filter='A_SUGGEST';localStorage.setItem(FILTER_KEY,state.filter);localStorage.setItem(MANUAL_DEFAULT_KEY_V26271,'1')}else if(f)state.filter=normalizeBucket(f)}catch{}";
  if(initFilter.test(s))s=s.replace(initFilter,initNew);

  if(s.includes('function restoreManualAnchor('))s=replaceNamedFunction(s,'restoreManualAnchor','function restoreManualAnchor(box,a){return}');

  s=`// ${MARKER}_MANUAL\n${s}`;
  for(const token of ['A · 手動觀察','B · 手動觀察','stableBucketRowsV26271','manualRenderSigV26271'])if(!s.includes(token))throw new Error(`[v26271-stable] invariant missing ${token}`);
  return {changed:saveJs(f,before,s)};
}

function patchIndex(){
  const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let s=before;
  const css=must('advisory-buckets-v26271.css'),pub=path.join(ROOT,'public');fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(css,path.join(pub,'advisory-buckets-v26271.css'));
  s=s.replace(/\s*<link[^>]+href=["']\/advisory-buckets-v2627(?:1)?\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  if(!s.includes('</head>'))throw new Error('[v26271-stable] index head missing');
  s=s.replace('</head>','<style id="stableNoMotionV26271">html,body{scroll-behavior:auto!important}#manualOpsPanel *,#sgPanel *{animation:none!important;transition:none!important}</style>\n<link rel="stylesheet" href="/advisory-buckets-v26271.css?v=26271stable">\n</head>');
  fs.writeFileSync(f,s,'utf8');return {changed:s!==before};
}

export function patchAdvisoryBucketsV26271(){
  const app=patchApp(),manual=patchManual(),index=patchIndex();
  console.log('[v26271-stable] READY',app,manual,index);
  return {changed:Boolean(app.changed||manual.changed||index.changed),app,manual,index,marker:MARKER};
}
if(import.meta.url===`file://${process.argv[1]}`)patchAdvisoryBucketsV26271();
