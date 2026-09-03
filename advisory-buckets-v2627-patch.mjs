import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='ADVISORY_BUCKETS_V2627';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v2627-advisory] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2627-advisory] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const tmp=`${f}.v2627-${process.pid}-${Date.now()}.tmp.js`;fs.writeFileSync(tmp,a,'utf8');try{check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function one(s,re,repl,label){const n=(s.match(re)||[]).length;if(n!==1)throw new Error(`[v2627-advisory] ${label} expected 1, got ${n}`);return s.replace(re,repl)}
function patchManual(){
 const f=must('public','manual-mode-ui.js'),before=fs.readFileSync(f,'utf8');if(before.includes(MARKER))return{changed:false,reason:'already'};let s=before;
 s=`// ${MARKER}\n${s}`;
 s=one(s,/filter:'A',pref:/,"filter:'A_SUGGEST',pref:",'default filter');
 const gradeRe=/const gradeText=g=>\(\{A:'A級｜優先研究',B:'B級｜等待確認',C:'C級｜只觀察'\}\)\[g\]\|\|g;/;
 const helpers=`const autoNotifyRow=x=>['HIGH','NORMAL'].includes(String(x?.notificationTier||'').toUpperCase());\nconst suggestionEligible=x=>{const t=String(x?.notificationTier||'').toUpperCase(),e=x?.institutionalEdge||{};return ['A','B'].includes(String(x?.grade||''))&&!autoNotifyRow(x)&&t!=='BLOCKED'&&e.hardBlock!==true};\nconst bucketOf=x=>{const g=String(x?.grade||'');if(!['A','B'].includes(g))return'HIDDEN';if(autoNotifyRow(x))return g+'_AUTO';if(suggestionEligible(x))return g+'_SUGGEST';return'HIDDEN'};\nconst bucketLabel=x=>\`${'${String(x?.grade||\'\')}'}級｜${'${autoNotifyRow(x)?\'自動通知標的\':\'建議標的\'}'}\`;\nconst bucketNote=x=>autoNotifyRow(x)?'已通過目前自動通知資格；是否建倉仍由你決定。':'接近通知門檻但尚未自動放行；可手動觀察，缺口看下方「風險 / 還缺什麼」。';\nconst bucketScore=x=>{const p=Number(x?.observationProgress||0),e=Number(x?.executionScore||0),w=Number(x?.calibratedWinRate||0),edge=Number(x?.institutionalEdge?.score||0),risk=Math.min(5,Array.isArray(x?.risks)?x.risks.length:0);return Math.max(0,Math.min(100,p*.36+e*.30+w*.18+edge*.16-risk*2))};\nconst normalizeBucket=v=>['A_AUTO','A_SUGGEST','B_AUTO','B_SUGGEST'].includes(v)?v:(v==='B'?'B_SUGGEST':'A_SUGGEST');\nconst gradeText=x=>bucketLabel(x);`;
 s=one(s,gradeRe,helpers,'grade helpers');
 s=s.replace(/gradeText\(x\.grade\)/g,'gradeText(x)');
 s=s.replace(/<span>A\/B\/C 是手動執行優先級，不是勝率保證。A級也必須由你確認價格後才下單。<\/span>/g,'<span>${esc(bucketNote(x))}</span>');
 const symbolNeedle='<div class="manual-main"><div><b>${esc(x.symbol)}</b><span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">${dirText(x.direction)}</span></div><small>';
 const symbolReplace='<div class="manual-main"><div><b>${esc(x.symbol)}</b><span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">${dirText(x.direction)}</span><span class="manual-bucket-chip ${autoNotifyRow(x)?\'auto\':\'suggest\'}">${autoNotifyRow(x)?\'自動通知\':\'建議觀察\'}</span></div><small>';
 if(!s.includes(symbolNeedle))throw new Error('[v2627-advisory] card symbol anchor missing');s=s.replace(symbolNeedle,symbolReplace);
 const renderVars=/filter=state\.filter,rows=\(d\.rows\|\|\[\]\)\.filter\(x=>filter==='ALL'\|\|x\.grade===filter\),stats=/;
 s=one(s,renderVars,"filter=normalizeBucket(state.filter),allBuckets=(d.rows||[]).map(x=>({x,b:bucketOf(x)})).filter(z=>z.b!=='HIDDEN'),rows=allBuckets.filter(z=>z.b===filter).map(z=>z.x).sort((a,b)=>filter.endsWith('SUGGEST')?bucketScore(b)-bucketScore(a):Number(b.calibratedWinRate||0)-Number(a.calibratedWinRate||0)||Number(b.institutionalEdge?.score||0)-Number(a.institutionalEdge?.score||0)),stats=",'render filter');
 const abcEnd=/const abcCell=g=>\{[\s\S]*?\};\n\s*box\.innerHTML=`/;
 const abcMatch=s.match(abcEnd);if(!abcMatch)throw new Error('[v2627-advisory] abc/render anchor missing');
 const prefix=abcMatch[0].slice(0,-'box.innerHTML=`'.length);
 const extra=`const bucketCounts={A_AUTO:0,A_SUGGEST:0,B_AUTO:0,B_SUGGEST:0};for(const z of allBuckets)bucketCounts[z.b]=(bucketCounts[z.b]||0)+1;\n  const bucketTitle={A_AUTO:'A級自動通知標的',A_SUGGEST:'A級建議標的',B_AUTO:'B級自動通知標的',B_SUGGEST:'B級建議標的'}[filter]||'A/B機會';\n  `;
 s=s.replace(abcMatch[0],prefix+extra+'box.innerHTML=`');
 const gradeBlock=/<div class="manual-grade-summary">[\s\S]*?<\/div><div class="manual-abc-shadow">/;
 const newBlock=`<div class=\\"manual-grade-summary v2627-buckets\\"><button class=\\"bucket-a bucket-auto ${'${filter===\'A_AUTO\'?\'on\':\'\'}'}\\" data-filter=\\"A_AUTO\\"><b>A · 自動通知</b><span>${'${bucketCounts.A_AUTO||0}'}</span><small>已達通知門檻</small></button><button class=\\"bucket-a bucket-suggest ${'${filter===\'A_SUGGEST\'?\'on\':\'\'}'}\\" data-filter=\\"A_SUGGEST\\"><b>A · 建議標的</b><span>${'${bucketCounts.A_SUGGEST||0}'}</span><small>接近門檻 · 手動觀察</small></button><button class=\\"bucket-b bucket-auto ${'${filter===\'B_AUTO\'?\'on\':\'\'}'}\\" data-filter=\\"B_AUTO\\"><b>B · 自動通知</b><span>${'${bucketCounts.B_AUTO||0}'}</span><small>已達通知門檻</small></button><button class=\\"bucket-b bucket-suggest ${'${filter===\'B_SUGGEST\'?\'on\':\'\'}'}\\" data-filter=\\"B_SUGGEST\\"><b>B · 建議標的</b><span>${'${bucketCounts.B_SUGGEST||0}'}</span><small>接近門檻 · 手動觀察</small></button></div><div class=\\"manual-abc-shadow\\">`;
 s=one(s,gradeBlock,newBlock,'bucket tabs');
 s=s.replace('<b>手動作戰清單</b><small>建議＋觀察＋Structure＋Shadow 幫你先篩；即使你不下單，ABC 也會自動留影學習</small>','<b>A/B 機會清單</b><small>自動通知＝已放行；建議標的＝幾乎達成但尚未自動通知，可手動觀察是否進場</small>');
 s=s.replace('<div class="manual-age">更新 ${age(Date.now()-new Date(d.generatedAt).getTime())} · ${esc(d.methodology||\'\')}</div><div class="manual-list">','<div class="manual-age"><b>${esc(bucketTitle)}</b> · 更新 ${age(Date.now()-new Date(d.generatedAt).getTime())} · ${esc(d.methodology||\'\')}</div><div class="manual-list">');
 s=s.replace('目前這個等級沒有候選。這不是故障，代表條件還沒到。','目前這個分類沒有標的。建議標的只收接近通知門檻、但還沒自動放行的 A/B 候選。');
 const initRe=/if\(\['A','B','C','ALL'\]\.includes\(f\)\)state\.filter=f/;
 s=one(s,initRe,"if(f)state.filter=normalizeBucket(f)",'init filter');
 return{changed:save(f,before,s)};
}
function patchIndex(){const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let s=before;s=s.replace(/\s*<link[^>]+href=["']\/advisory-buckets-v2627\.css(?:\?[^"']*)?["'][^>]*>/gi,'');s=s.replace('</head>','<link rel="stylesheet" href="/advisory-buckets-v2627.css?v=2627">\n</head>');fs.writeFileSync(f,s,'utf8');return{changed:s!==before}}
export function patchAdvisoryBucketsV2627(){const css=must('advisory-buckets-v2627.css');fs.copyFileSync(css,path.join(__dirname,'public','advisory-buckets-v2627.css'));return{manual:patchManual(),index:patchIndex()}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchAdvisoryBucketsV2627());
