import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PUB=path.join(ROOT,'public');
const MARKER='FINAL_UI_V2629';

const abs=(...p)=>path.join(ROOT,...p);
function must(...p){const f=abs(...p);if(!fs.existsSync(f))throw new Error(`[v2629-final] missing ${p.join('/')}`);return f}
function check(file){const r=spawnSync(process.execPath,['--check',file],{cwd:ROOT,encoding:'utf8',timeout:15_000});if(r.status!==0)throw new Error(`[v2629-final] syntax invalid ${path.relative(ROOT,file)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function saveJs(file,before,after){if(after===before)return false;const tmp=`${file}.v2629-${process.pid}-${Date.now()}.tmp.js`;fs.writeFileSync(tmp,after,'utf8');try{check(tmp);fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function run(file,label,timeout=20_000){const p=must(file);const r=spawnSync(process.execPath,[p],{cwd:ROOT,stdio:'inherit',timeout,env:process.env});if(r.status!==0||r.error)throw new Error(`[v2629-final] ${label} failed: ${r.error?.code||r.status||'unknown'}`)}
function requireToken(file,token,label){const s=fs.readFileSync(file,'utf8');if(!s.includes(token))throw new Error(`[v2629-final] ${label} invariant missing: ${token}`);return s}

function ensurePrerequisites(){
  fs.mkdirSync(PUB,{recursive:true});
  const app=must('public','app.js');
  if(!fs.readFileSync(app,'utf8').includes('UI_STABILITY_V2617')) run('ui-stability-v2617-patch.mjs','V2.6.17 stability recovery',28_000);
  requireToken(app,'UI_STABILITY_V2617','UI stability');

  const manual=must('public','manual-mode-ui.js');
  if(!fs.readFileSync(manual,'utf8').includes('ADVISORY_BUCKETS_V26271')) run('advisory-buckets-v26271-patch.mjs','A/B buckets recovery',24_000);
  requireToken(manual,'ADVISORY_BUCKETS_V26271','A/B advisory');

  for(const name of ['growth-status-v2625.js','growth-status-v2626.css']){
    fs.copyFileSync(must(name),path.join(PUB,name));
  }
}

function patchLegacyGrowth(){
  const f=must('public','system-growth.js');
  const before=fs.readFileSync(f,'utf8');
  if(before.includes(MARKER+'_LEGACY_GUARD'))return false;
  const needle="  function render(){\n    const panel=rootDoc.getElementById('sgPanel');if(!panel||!state.perf)return;const growthAnchor=";
  if(!before.includes(needle))throw new Error('[v2629-final] system-growth render anchor missing');
  const repl="  function render(){\n    const panel=rootDoc.getElementById('sgPanel');if(!panel||!state.perf)return;/* "+MARKER+"_LEGACY_GUARD */if(globalThis.window?.__SG_STATUS_UI_V2629===true||panel.querySelector?.('#sgStatusV2625'))return;const growthAnchor=";
  return saveJs(f,before,before.replace(needle,repl));
}

function patchGrowthStatus(){
  const f=must('public','growth-status-v2625.js');
  const before=fs.readFileSync(f,'utf8');
  let s=before;
  if(!s.includes(MARKER+'_STATUS')){
    const mount="function mount(){const panel=document.getElementById('sgPanel');if(!panel)return null;let root=document.getElementById(ROOT_ID);if(root)return root;root=document.createElement('section');root.id=ROOT_ID;root.className='sg-v2625';panel.prepend(root);return root}";
    const mount2="function mount(){const panel=document.getElementById('sgPanel');if(!panel)return null;window.__SG_STATUS_UI_V2629=true;let root=document.getElementById(ROOT_ID);if(root)return root;root=document.createElement('section');root.id=ROOT_ID;root.className='sg-v2625';root.dataset.finalUi='2629';panel.prepend(root);return root}";
    if(!s.includes(mount))throw new Error('[v2629-final] growth status mount anchor missing');
    s=s.replace(mount,mount2);
    const hide="function hideLegacyDecor(){document.querySelectorAll('.sg-rpg-core-v2623,.sg-rpg-skills-v2623,.sg-rpg-mentor-v2623,#sgStatusV2624').forEach(x=>x.setAttribute('hidden',''));document.getElementById('mentorGrowthV2622')?.setAttribute('hidden','')}";
    const hide2="function hideLegacyDecor(){/* "+MARKER+"_STATUS */const panel=document.getElementById('sgPanel'),root=document.getElementById(ROOT_ID);if(panel&&root){for(const child of [...panel.children]){if(child!==root)child.setAttribute('hidden','')}}document.querySelectorAll('.sg-rpg-core-v2623,.sg-rpg-skills-v2623,.sg-rpg-mentor-v2623,#sgStatusV2624').forEach(x=>x.setAttribute('hidden',''));document.getElementById('mentorGrowthV2622')?.setAttribute('hidden','')}";
    if(!s.includes(hide))throw new Error('[v2629-final] growth legacy-hide anchor missing');
    s=s.replace(hide,hide2);
  }
  return saveJs(f,before,s);
}

function patchManualAB(){
  const f=must('public','manual-mode-ui.js');
  const before=fs.readFileSync(f,'utf8');
  let s=before;
  if(s.includes(MARKER+'_MANUAL'))return false;

  s=s.replace("const VERSION='2.6.5'","const VERSION='2.6.29'");
  s=s.replace("filter:'A_AUTO',pref:","filter:'A_SUGGEST',pref:");
  s=s.replace("(v==='B'?'B_AUTO':'A_AUTO');\nconst gradeText=x=>bucketLabel(x);",`(v==='B'?'B_SUGGEST':'A_SUGGEST');
const MANUAL_ORDER_KEY_V2629='manual-bucket-order-v2629';
const manualRowKeyV2629=x=>String(x?.id||[x?.symbol,x?.direction,x?.strategyId||x?.strategyLabel||''].join('|'));
let manualOrderV2629=(()=>{try{const x=JSON.parse(localStorage.getItem(MANUAL_ORDER_KEY_V2629)||'{}');return x&&typeof x==='object'?x:{}}catch{return{}}})();
const stableBucketRowsV2629=(rows,bucket)=>{const prior=Array.isArray(manualOrderV2629[bucket])?manualOrderV2629[bucket]:[],pos=new Map(prior.map((k,i)=>[String(k),i])),existing=[],fresh=[];for(const x of rows){(pos.has(manualRowKeyV2629(x))?existing:fresh).push(x)}existing.sort((a,b)=>pos.get(manualRowKeyV2629(a))-pos.get(manualRowKeyV2629(b)));const out=[...existing,...fresh];manualOrderV2629[bucket]=out.map(manualRowKeyV2629);try{localStorage.setItem(MANUAL_ORDER_KEY_V2629,JSON.stringify(manualOrderV2629))}catch{}return out};
const gradeText=x=>bucketLabel(x);`);

  const rowsRe=/rows=bucketRows\.filter\(z=>z\.b===filter\)\.map\(z=>z\.x\)\.sort\(\(a,b\)=>filter\.endsWith\('SUGGEST'\)\?advisoryScore\(b\)-advisoryScore\(a\):Number\(b\.calibratedWinRate\|\|0\)-Number\(a\.calibratedWinRate\|\|0\)\|\|Number\(b\.executionScore\|\|0\)-Number\(a\.executionScore\|\|0\)\),stats=/;
  if(!rowsRe.test(s))throw new Error('[v2629-final] A/B stable-order anchor missing');
  s=s.replace(rowsRe,"rows=stableBucketRowsV2629(bucketRows.filter(z=>z.b===filter).map(z=>z.x).sort((a,b)=>filter.endsWith('SUGGEST')?advisoryScore(b)-advisoryScore(a):Number(b.calibratedWinRate||0)-Number(a.calibratedWinRate||0)||Number(b.executionScore||0)-Number(a.executionScore||0)),filter),stats=");

  s=s.replaceAll('A · 建議標的','A · 手動觀察');
  s=s.replaceAll('B · 建議標的','B · 手動觀察');
  s=s.replaceAll("A級 · 建議標的","A級 · 手動觀察標的");
  s=s.replaceAll("B級 · 建議標的","B級 · 手動觀察標的");
  s=s.replaceAll("'建議觀察'","'手動觀察'");
  s=s.replace('A/B 機會清單','A/B 手動觀察／自動通知');
  s=s.replace('自動通知＝已放行；建議標的＝接近門檻但尚未自動通知，可手動觀察是否進場','手動觀察＝A/B 接近門檻但尚未放行；自動通知＝已通過目前通知資格。兩者分開，不再混在一起。');
  s=s.replace('目前這個分類沒有標的。建議標的只保留真正接近通知門檻、且沒有硬阻擋的 A/B 候選。','目前這個 A/B 手動觀察分類沒有標的；有符合條件的候選會固定出現在這裡，不會因為自動刷新把分類切走。');

  const init="function init(){loadUiState();try{const f=localStorage.getItem(FILTER_KEY);if(f)state.filter=normalizeBucket(f)}catch{}mount();";
  const init2="function init(){loadUiState();try{const migration='manual-ab-default-v2629';const f=localStorage.getItem(FILTER_KEY);if(!localStorage.getItem(migration)){state.filter='A_SUGGEST';localStorage.setItem(FILTER_KEY,state.filter);localStorage.setItem(migration,'1')}else if(f)state.filter=normalizeBucket(f)}catch{}mount();";
  if(!s.includes(init))throw new Error('[v2629-final] A/B init migration anchor missing');
  s=s.replace(init,init2);
  s=`// ${MARKER}_MANUAL\n${s}`;
  for(const token of ['A_SUGGEST','B_SUGGEST','A · 手動觀察','B · 手動觀察','stableBucketRowsV2629','manual-ab-default-v2629'])if(!s.includes(token))throw new Error(`[v2629-final] manual invariant missing ${token}`);
  return saveJs(f,before,s);
}

function patchIndex(){
  const f=must('public','index.html');
  let h=fs.readFileSync(f,'utf8'),before=h;
  const cssSrc=must('ui-final-v2629.css');
  fs.copyFileSync(cssSrc,path.join(PUB,'ui-final-v2629.css'));
  h=h.replace(/\s*<link[^>]+href=["']\/growth-status-v2626\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  h=h.replace(/\s*<script[^>]+src=["']\/growth-status-v2625\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,'');
  h=h.replace(/\s*<link[^>]+href=["']\/ui-final-v2629\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  if(!h.includes('</head>')||!h.includes('</body>'))throw new Error('[v2629-final] index anchors missing');
  h=h.replace('</head>','<link rel="stylesheet" href="/growth-status-v2626.css?v=2629">\n<link rel="stylesheet" href="/ui-final-v2629.css?v=2629">\n</head>');
  h=h.replace('</body>','<script defer src="/growth-status-v2625.js?v=2629"></script>\n</body>');
  fs.writeFileSync(f,h,'utf8');
  return h!==before;
}

export function patchFinalUiV2629(){
  ensurePrerequisites();
  const out={legacyGrowth:patchLegacyGrowth(),growthStatus:patchGrowthStatus(),manual:patchManualAB(),index:patchIndex()};
  requireToken(must('public','system-growth.js'),MARKER+'_LEGACY_GUARD','legacy growth guard');
  requireToken(must('public','growth-status-v2625.js'),MARKER+'_STATUS','new growth UI');
  requireToken(must('public','manual-mode-ui.js'),MARKER+'_MANUAL','manual A/B UI');
  const html=fs.readFileSync(must('public','index.html'),'utf8');
  for(const token of ['/growth-status-v2625.js?v=2629','/growth-status-v2626.css?v=2629','/ui-final-v2629.css?v=2629'])if(!html.includes(token))throw new Error(`[v2629-final] index invariant missing ${token}`);
  console.log('[v2629-final] READY',out);
  return {changed:Object.values(out).some(Boolean),out,marker:MARKER};
}

if(import.meta.url===`file://${process.argv[1]}`)patchFinalUiV2629();
