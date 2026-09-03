import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='ADVISORY_BUCKETS_V26271';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v26271-advisory] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v26271-advisory] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function required(s,re,repl,label){const m=s.match(re);if(!m||m.length!==1)throw new Error(`[v26271-advisory] ${label} anchor ${!m?'missing':`ambiguous ${m.length}`}`);return s.replace(re,repl)}
function saveJs(f,before,after){if(after===before)return false;const tmp=`${f}.v26271-${process.pid}-${Date.now()}.tmp.js`;fs.writeFileSync(tmp,after,'utf8');try{check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function patchManual(){
  const f=must('public','manual-mode-ui.js');const before=fs.readFileSync(f,'utf8');if(before.includes(MARKER))return{changed:false,reason:'already'};
  if(before.includes('ADVISORY_BUCKETS_V2627'))throw new Error('[v26271-advisory] old V2627 runtime patch detected; redeploy from clean GitHub checkout');
  let s=`// ${MARKER}\n${before}`;
  s=required(s,/filter:'A',pref:/,"filter:'A_AUTO',pref:",'default filter');
  const gradeRe=/const gradeText=g=>\(\{A:'A級｜優先研究',B:'B級｜等待確認',C:'C級｜只觀察'\}\)\[g\]\|\|g;/;
  const helpers=`const autoNotifyRow=x=>['HIGH','NORMAL'].includes(String(x?.notificationTier||'').toUpperCase());\nconst advisoryScore=x=>{const p=Number(x?.observationProgress||0),e=Number(x?.executionScore||0),w=Number(x?.calibratedWinRate||0),edge=Number(x?.institutionalEdge?.score||0),risk=Math.min(5,Array.isArray(x?.risks)?x.risks.length:0);return Math.max(0,Math.min(100,p*.34+e*.30+w*.20+edge*.16-risk*2.2))};\nconst suggestionEligible=x=>{const t=String(x?.notificationTier||'').toUpperCase(),g=String(x?.grade||''),edge=x?.institutionalEdge||{},p=Number(x?.observationProgress||0),e=Number(x?.executionScore||0),w=Number(x?.calibratedWinRate||0),score=advisoryScore(x);if(!['A','B'].includes(g)||autoNotifyRow(x)||t==='BLOCKED'||edge.hardBlock===true)return false;return score>=58&&(p>=68||e>=72||w>=56||Number(edge.score||0)>=60)};\nconst bucketOf=x=>{const g=String(x?.grade||'');if(!['A','B'].includes(g))return'HIDDEN';if(autoNotifyRow(x))return g+'_AUTO';if(suggestionEligible(x))return g+'_SUGGEST';return'HIDDEN'};\nconst bucketLabel=x=>\`${'${String(x?.grade||\'\')}'}級｜${'${autoNotifyRow(x)?\'自動通知標的\':\'建議標的\'}'}\`;\nconst bucketNote=x=>autoNotifyRow(x)?'已達目前自動通知資格；這裡保留給你確認是否實際建倉。':'尚未達自動通知，但已接近門檻；可手動觀察，仍缺的條件看下方「風險 / 還缺什麼」。';\nconst normalizeBucket=v=>['A_AUTO','A_SUGGEST','B_AUTO','B_SUGGEST'].includes(v)?v:(v==='B'?'B_AUTO':'A_AUTO');\nconst gradeText=x=>bucketLabel(x);`;
  s=required(s,gradeRe,helpers,'grade helpers');
  s=s.replace(/gradeText\(x\.grade\)/g,'gradeText(x)');
  // V2622 already changed this sentence; support both old and current text.
  s=s.replace(/<span>(?:A\/B\/C 是手動執行優先級，不是勝率保證。A級也必須由你確認價格後才下單。|A\/B 是執行優先級；高 Edge 觀察只提供額外研究，不會自動下單。)<\/span>/g,'<span>${esc(bucketNote(x))}</span>');
  const symbolRe=/<div class="manual-main"><div><b>\$\{esc\(x\.symbol\)\}<\/b><span class="\$\{x\.direction==='SHORT'\?'short':'long'\}">\$\{dirText\(x\.direction\)\}<\/span><\/div><small>/;
  s=required(s,symbolRe,'<div class="manual-main"><div><b>${esc(x.symbol)}</b><span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">${dirText(x.direction)}</span><span class="manual-bucket-chip ${autoNotifyRow(x)?\'auto\':\'suggest\'}">${autoNotifyRow(x)?\'自動通知\':\'建議觀察\'}</span></div><small>','card bucket chip');
  const renderRe=/filter=state\.filter,rows=\(d\.rows\|\|\[\]\)\.filter\(x=>filter==='ALL'\|\|x\.grade===filter\),stats=/;
  s=required(s,renderRe,"filter=normalizeBucket(state.filter),bucketRows=(d.rows||[]).map(x=>({x,b:bucketOf(x)})).filter(z=>z.b!=='HIDDEN'),rows=bucketRows.filter(z=>z.b===filter).map(z=>z.x).sort((a,b)=>filter.endsWith('SUGGEST')?advisoryScore(b)-advisoryScore(a):Number(b.calibratedWinRate||0)-Number(a.calibratedWinRate||0)||Number(b.executionScore||0)-Number(a.executionScore||0)),stats=",'render bucket filter');
  const boxAnchor='  box.innerHTML=`';
  const count=(s.match(/  box\.innerHTML=`/g)||[]).length;if(count!==1)throw new Error(`[v26271-advisory] render html anchor expected 1, got ${count}`);
  const pre=`  const bucketCounts={A_AUTO:0,A_SUGGEST:0,B_AUTO:0,B_SUGGEST:0};for(const z of bucketRows)bucketCounts[z.b]=(bucketCounts[z.b]||0)+1;\n  const bucketTitle={A_AUTO:'A級 · 自動通知標的',A_SUGGEST:'A級 · 建議標的',B_AUTO:'B級 · 自動通知標的',B_SUGGEST:'B級 · 建議標的'}[filter]||'A/B 機會';\n`;
  s=s.replace(boxAnchor,pre+boxAnchor);
  const gradeBlock=/<div class="manual-grade-summary">[\s\S]*?<\/div><div class="manual-abc-shadow">/;
  const tabs=`<div class="manual-grade-summary v26271-buckets"><button class="bucket-a bucket-auto ${'${filter===\'A_AUTO\'?\'on\':\'\'}'}" data-filter="A_AUTO"><b>A · 自動通知</b><span>${'${bucketCounts.A_AUTO||0}'}</span><small>已達通知資格</small></button><button class="bucket-a bucket-suggest ${'${filter===\'A_SUGGEST\'?\'on\':\'\'}'}" data-filter="A_SUGGEST"><b>A · 建議標的</b><span>${'${bucketCounts.A_SUGGEST||0}'}</span><small>接近門檻 · 手動觀察</small></button><button class="bucket-b bucket-auto ${'${filter===\'B_AUTO\'?\'on\':\'\'}'}" data-filter="B_AUTO"><b>B · 自動通知</b><span>${'${bucketCounts.B_AUTO||0}'}</span><small>已達通知資格</small></button><button class="bucket-b bucket-suggest ${'${filter===\'B_SUGGEST\'?\'on\':\'\'}'}" data-filter="B_SUGGEST"><b>B · 建議標的</b><span>${'${bucketCounts.B_SUGGEST||0}'}</span><small>接近門檻 · 手動觀察</small></button></div><div class="manual-abc-shadow">`;
  s=required(s,gradeBlock,tabs,'bucket tabs');
  s=s.replace('<b>手動作戰清單</b><small>建議＋觀察＋Structure＋Shadow 幫你先篩；即使你不下單，ABC 也會自動留影學習</small>','<b>A/B 機會清單</b><small>自動通知＝已放行；建議標的＝接近門檻但尚未自動通知，可手動觀察是否進場</small>');
  s=s.replace('<div class="manual-age">更新 ${age(Date.now()-new Date(d.generatedAt).getTime())} · ${esc(d.methodology||\'\')}</div><div class="manual-list">','<div class="manual-age"><b>${esc(bucketTitle)}</b> · 更新 ${age(Date.now()-new Date(d.generatedAt).getTime())} · ${esc(d.methodology||\'\')}</div><div class="manual-list">');
  s=s.replace('目前這個等級沒有候選。這不是故障，代表條件還沒到。','目前這個分類沒有標的。建議標的只保留真正接近通知門檻、且沒有硬阻擋的 A/B 候選。');
  s=required(s,/if\(\['A','B','C','ALL'\]\.includes\(f\)\)state\.filter=f/,"if(f)state.filter=normalizeBucket(f)",'restore filter');
  // Final invariant checks before replacing production file.
  for(const token of ['A_AUTO','A_SUGGEST','B_AUTO','B_SUGGEST','suggestionEligible','manual-bucket-chip','bucketCounts'])if(!s.includes(token))throw new Error(`[v26271-advisory] invariant missing ${token}`);
  return{changed:saveJs(f,before,s)};
}
function patchIndex(){const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let s=before;
  s=s.replace(/\s*<link[^>]+href=["']\/advisory-buckets-v2627(?:1)?\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  if(!s.includes('</head>'))throw new Error('[v26271-advisory] index </head> missing');
  s=s.replace('</head>','<link rel="stylesheet" href="/advisory-buckets-v26271.css?v=26271">\n</head>');
  fs.writeFileSync(f,s,'utf8');return{changed:s!==before};
}
export function patchAdvisoryBucketsV26271(){const css=must('advisory-buckets-v26271.css');const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});fs.copyFileSync(css,path.join(pub,'advisory-buckets-v26271.css'));return{manual:patchManual(),index:patchIndex()}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchAdvisoryBucketsV26271());
