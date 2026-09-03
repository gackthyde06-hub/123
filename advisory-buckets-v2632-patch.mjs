import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const MARKER='ADVISORY_BUCKETS_V2632';
const must=(...p)=>{const f=path.join(ROOT,...p);if(!fs.existsSync(f))throw new Error(`[v2632-advisory] missing ${p.join('/')}`);return f};
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0||r.error)throw new Error(`[v2632-advisory] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const tmp=`${f}.v2632-${process.pid}-${Date.now()}.tmp.js`;fs.writeFileSync(tmp,a,'utf8');try{check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function requiredReplace(s,re,repl,label){const m=s.match(re);if(!m)throw new Error(`[v2632-advisory] ${label} anchor missing`);return s.replace(re,repl)}

function patchManual(){
  const f=must('public','manual-mode-ui.js'),before=fs.readFileSync(f,'utf8');
  if(before.includes(MARKER))return{changed:false,reason:'already'};
  if(!before.includes('UI_CONTROL_V2616'))throw new Error('[v2632-advisory] UI_CONTROL_V2616 missing; refusing unknown manual UI base');
  let s=before;

  s=s.replace("let state={data:null,busy:false,filter:'A',pref:","let state={data:null,busy:false,filter:'A_SUGGEST',pref:");

  const gradeRe=/const gradeText=g=>\(\{A:'[^']*',B:'[^']*',C:'[^']*'\}\)\[g\]\|\|g;/;
  const helpers=`const autoNotifyRow=x=>['HIGH','NORMAL'].includes(String(x?.notificationTier||'').toUpperCase());
const advisoryScore=x=>{const p=Number(x?.observationProgress||0),e=Number(x?.executionScore||0),w=Number(x?.calibratedWinRate||0),edge=Number(x?.institutionalEdge?.score||0),risk=Math.min(5,Array.isArray(x?.risks)?x.risks.length:0);return Math.max(0,Math.min(100,p*.34+e*.30+w*.20+edge*.16-risk*2.2))};
const suggestionEligible=x=>{const t=String(x?.notificationTier||'').toUpperCase(),g=String(x?.grade||''),edge=x?.institutionalEdge||{},p=Number(x?.observationProgress||0),e=Number(x?.executionScore||0),w=Number(x?.calibratedWinRate||0),score=advisoryScore(x);if(!['A','B'].includes(g)||autoNotifyRow(x)||t==='BLOCKED'||edge.hardBlock===true)return false;return score>=58&&(p>=68||e>=72||w>=56||Number(edge.score||0)>=60)};
const bucketOf=x=>{const g=String(x?.grade||'');if(!['A','B'].includes(g))return'HIDDEN';if(autoNotifyRow(x))return g+'_AUTO';if(suggestionEligible(x))return g+'_SUGGEST';return'HIDDEN'};
const bucketLabel=x=>\`${'${String(x?.grade||\'\')}'}級｜${'${autoNotifyRow(x)?\'自動通知標的\':\'手動觀察標的\'}'}\`;
const bucketNote=x=>autoNotifyRow(x)?'已達目前自動通知資格；這裡保留給你確認是否實際建倉。':'尚未達自動通知，但已接近門檻；列入手動觀察，仍缺的條件看下方「風險 / 還缺什麼」。';
const normalizeBucket=v=>['A_AUTO','A_SUGGEST','B_AUTO','B_SUGGEST'].includes(v)?v:(v==='B'?'B_SUGGEST':v==='A'?'A_SUGGEST':'A_SUGGEST');
const MANUAL_ORDER_KEY_V2632='manual-bucket-order-v2632';
const MANUAL_DEFAULT_MIGRATION_V2632='manual-ab-default-v2632';
const manualRowKeyV2632=x=>String(x?.id||[x?.symbol,x?.direction,x?.strategyId||x?.strategyLabel||''].join('|'));
let manualOrderV2632=(()=>{try{const x=JSON.parse(localStorage.getItem(MANUAL_ORDER_KEY_V2632)||'{}');return x&&typeof x==='object'?x:{}}catch{return{}}})();
const stableBucketRowsV2632=(rows,bucket)=>{const prior=Array.isArray(manualOrderV2632[bucket])?manualOrderV2632[bucket]:[],pos=new Map(prior.map((k,i)=>[String(k),i])),existing=[],fresh=[];for(const x of rows){(pos.has(manualRowKeyV2632(x))?existing:fresh).push(x)}existing.sort((a,b)=>pos.get(manualRowKeyV2632(a))-pos.get(manualRowKeyV2632(b)));const out=[...existing,...fresh];manualOrderV2632[bucket]=out.map(manualRowKeyV2632);try{localStorage.setItem(MANUAL_ORDER_KEY_V2632,JSON.stringify(manualOrderV2632))}catch{}return out};
const gradeText=x=>bucketLabel(x);`;
  s=requiredReplace(s,gradeRe,helpers,'grade helpers');
  s=s.replace(/gradeText\(x\.grade\)/g,'gradeText(x)');
  s=s.replace(/<span>A\/B[^<]*<\/span>/g,'<span>${esc(bucketNote(x))}</span>');

  const symbolRe=/<div class="manual-main"><div><b>\$\{esc\(x\.symbol\)\}<\/b><span class="\$\{x\.direction==='SHORT'\?'short':'long'\}">\$\{dirText\(x\.direction\)\}<\/span><\/div><small>/;
  s=requiredReplace(s,symbolRe,'<div class="manual-main"><div><b>${esc(x.symbol)}</b><span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">${dirText(x.direction)}</span><span class="manual-bucket-chip ${autoNotifyRow(x)?\'auto\':\'suggest\'}">${autoNotifyRow(x)?\'自動通知\':\'手動觀察\'}</span></div><small>','card bucket chip');

  const renderStart="  if(!mount()||!state.data)return;const box=document.getElementById('manualOpsPanel')";
  const a=s.indexOf(renderStart),endToken=';state.filter=filter;',b=a>=0?s.indexOf(endToken,a):-1;
  if(a<0||b<0)throw new Error('[v2632-advisory] render state anchor missing');
  const renderNew="  if(!mount()||!state.data)return;const box=document.getElementById('manualOpsPanel'),anchor=manualAnchor(box),d=state.data,filter=normalizeBucket(state.filter),bucketRows=(d.rows||[]).map(x=>({x,b:bucketOf(x)})).filter(z=>z.b!=='HIDDEN'),rows=stableBucketRowsV2632(bucketRows.filter(z=>z.b===filter).map(z=>z.x).sort((a,b)=>filter.endsWith('SUGGEST')?advisoryScore(b)-advisoryScore(a):Number(b.calibratedWinRate||0)-Number(a.calibratedWinRate||0)||Number(b.executionScore||0)-Number(a.executionScore||0)),filter),stats=(d.stats?.byGrade||[]).filter(x=>['A','B'].includes(x.key)),rankStats=(d.stats?.byRank||[]).filter(x=>x.key!=='無排名'),abc=d.shadowLearning||{},abcBy=abc.byGrade||[],source=window.loadShadowNoticeSourceV2616?.()||'BOTH',noticeOn=window.loadShadowNoticeMasterV2616?.()??state.pref.enabled;state.filter=filter;";
  s=s.slice(0,a)+renderNew+s.slice(b+endToken.length);

  const boxAnchor='  box.innerHTML=`';
  const count=(s.match(/  box\.innerHTML=`/g)||[]).length;if(count!==1)throw new Error(`[v2632-advisory] render html anchor expected 1, got ${count}`);
  const pre=`  const bucketCounts={A_AUTO:0,A_SUGGEST:0,B_AUTO:0,B_SUGGEST:0};for(const z of bucketRows)bucketCounts[z.b]=(bucketCounts[z.b]||0)+1;
  const bucketTitle={A_AUTO:'A級 · 自動通知',A_SUGGEST:'A級 · 手動觀察',B_AUTO:'B級 · 自動通知',B_SUGGEST:'B級 · 手動觀察'}[filter]||'A/B 機會';
`;
  s=s.replace(boxAnchor,pre+boxAnchor);

  const gradeBlock=/<div class="manual-grade-summary">[\s\S]*?<\/div><div class="manual-abc-shadow">/;
  const tabs=`<div class="manual-grade-summary v26271-buckets"><button class="bucket-a bucket-auto ${'${filter===\'A_AUTO\'?\'on\':\'\'}'}" data-filter="A_AUTO"><b>A · 自動通知</b><span>${'${bucketCounts.A_AUTO||0}'}</span><small>已達通知資格</small></button><button class="bucket-a bucket-suggest ${'${filter===\'A_SUGGEST\'?\'on\':\'\'}'}" data-filter="A_SUGGEST"><b>A · 手動觀察</b><span>${'${bucketCounts.A_SUGGEST||0}'}</span><small>接近門檻 · 自己決定進場</small></button><button class="bucket-b bucket-auto ${'${filter===\'B_AUTO\'?\'on\':\'\'}'}" data-filter="B_AUTO"><b>B · 自動通知</b><span>${'${bucketCounts.B_AUTO||0}'}</span><small>已達通知資格</small></button><button class="bucket-b bucket-suggest ${'${filter===\'B_SUGGEST\'?\'on\':\'\'}'}" data-filter="B_SUGGEST"><b>B · 手動觀察</b><span>${'${bucketCounts.B_SUGGEST||0}'}</span><small>接近門檻 · 自己決定進場</small></button></div><div class="manual-abc-shadow">`;
  s=requiredReplace(s,gradeBlock,tabs,'bucket tabs');

  s=s.replace(/<b>影子 A\/B 判斷<\/b><small>[^<]*<\/small>/,'<b>A/B 手動觀察／自動通知</b><small>自動通知＝已通過通知資格；手動觀察＝接近門檻但尚未放行。兩者分開，不再混在一起。</small>');
  s=s.replace('<div class="manual-age">更新 ${age(Date.now()-new Date(d.generatedAt).getTime())} · ${esc(d.methodology||\'\')}</div><div class="manual-list">','<div class="manual-age"><b>${esc(bucketTitle)}</b> · 更新 ${age(Date.now()-new Date(d.generatedAt).getTime())} · ${esc(d.methodology||\'\')}</div><div class="manual-list">');
  s=s.replace('目前這個等級沒有候選。這不是故障，代表條件還沒到。','目前這個分類沒有標的；有符合條件的 A/B 候選會固定出現在這裡。');

  const initRe=/try\{const f=localStorage\.getItem\(FILTER_KEY\);[^}]*\}catch\{\}/;
  const initNew="try{const f=localStorage.getItem(FILTER_KEY);if(!localStorage.getItem(MANUAL_DEFAULT_MIGRATION_V2632)){state.filter='A_SUGGEST';localStorage.setItem(FILTER_KEY,state.filter);localStorage.setItem(MANUAL_DEFAULT_MIGRATION_V2632,'1')}else if(f)state.filter=normalizeBucket(f)}catch{}";
  s=requiredReplace(s,initRe,initNew,'init filter');

  s=`// ${MARKER}\n${s}`;
  for(const token of ['A_AUTO','A_SUGGEST','B_AUTO','B_SUGGEST','stableBucketRowsV2632','A · 手動觀察','B · 手動觀察','manual-ab-default-v2632'])if(!s.includes(token))throw new Error(`[v2632-advisory] invariant missing ${token}`);
  return{changed:save(f,before,s)};
}

function patchIndex(){
  const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let s=before;
  const css=must('advisory-buckets-v26271.css'),pub=path.join(ROOT,'public');fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(css,path.join(pub,'advisory-buckets-v26271.css'));
  s=s.replace(/\s*<link[^>]+href=["']\/advisory-buckets-v2627(?:1)?\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  if(!s.includes('</head>'))throw new Error('[v2632-advisory] index </head> missing');
  s=s.replace('</head>','<link rel="stylesheet" href="/advisory-buckets-v26271.css?v=2632">\n</head>');
  fs.writeFileSync(f,s,'utf8');return{changed:s!==before};
}

export function patchAdvisoryBucketsV2632(){const manual=patchManual(),index=patchIndex();console.log('[v2632-advisory] READY',manual,index);return{changed:Boolean(manual.changed||index.changed),manual,index,marker:MARKER}}
if(import.meta.url===`file://${process.argv[1]}`)patchAdvisoryBucketsV2632();
