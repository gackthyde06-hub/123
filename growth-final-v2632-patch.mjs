import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PUB=path.join(ROOT,'public');
const MARKER='GROWTH_FINAL_V2632';
const must=(...p)=>{const f=path.join(ROOT,...p);if(!fs.existsSync(f))throw new Error(`[v2632-growth] missing ${p.join('/')}`);return f};
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0||r.error)throw new Error(`[v2632-growth] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const tmp=`${f}.v2632-${process.pid}-${Date.now()}.tmp.js`;fs.writeFileSync(tmp,a,'utf8');try{check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function requireToken(file,token,label){const s=fs.readFileSync(file,'utf8');if(!s.includes(token))throw new Error(`[v2632-growth] ${label} invariant missing: ${token}`);return s}

function copyAssets(){
  fs.mkdirSync(PUB,{recursive:true});
  for(const name of ['growth-status-v2625.js','growth-status-v2626.css','ui-final-v2629.css'])fs.copyFileSync(must(name),path.join(PUB,name));
}
function patchLegacyGrowth(){
  const f=must('public','system-growth.js'),before=fs.readFileSync(f,'utf8');
  if(before.includes(MARKER+'_LEGACY_GUARD'))return false;
  const start="function render(){\n    const panel=rootDoc.getElementById('sgPanel');if(!panel||!state.perf)return;";
  if(!before.includes(start))throw new Error('[v2632-growth] system-growth render anchor missing');
  const repl=start+`/* ${MARKER}_LEGACY_GUARD */if(globalThis.window?.__SG_STATUS_UI_V2632===true||panel.querySelector?.('#sgStatusV2625'))return;`;
  return save(f,before,before.replace(start,repl));
}
function patchStatus(){
  const f=must('public','growth-status-v2625.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER+'_STATUS'))return false;
  const mount="function mount(){const panel=document.getElementById('sgPanel');if(!panel)return null;let root=document.getElementById(ROOT_ID);if(root)return root;root=document.createElement('section');root.id=ROOT_ID;root.className='sg-v2625';panel.prepend(root);return root}";
  const mount2="function mount(){const panel=document.getElementById('sgPanel');if(!panel)return null;window.__SG_STATUS_UI_V2632=true;let root=document.getElementById(ROOT_ID);if(root)return root;root=document.createElement('section');root.id=ROOT_ID;root.className='sg-v2625';root.dataset.finalUi='2632';panel.prepend(root);return root}";
  if(!s.includes(mount))throw new Error('[v2632-growth] growth mount anchor missing');
  s=s.replace(mount,mount2);
  const hide="function hideLegacyDecor(){document.querySelectorAll('.sg-rpg-core-v2623,.sg-rpg-skills-v2623,.sg-rpg-mentor-v2623,#sgStatusV2624').forEach(x=>x.setAttribute('hidden',''));document.getElementById('mentorGrowthV2622')?.setAttribute('hidden','')}";
  const hide2="function hideLegacyDecor(){/* "+MARKER+"_STATUS */const panel=document.getElementById('sgPanel'),root=document.getElementById(ROOT_ID);if(panel&&root){for(const child of [...panel.children]){if(child!==root)child.setAttribute('hidden','')}}document.querySelectorAll('.sg-rpg-core-v2623,.sg-rpg-skills-v2623,.sg-rpg-mentor-v2623,#sgStatusV2624').forEach(x=>x.setAttribute('hidden',''));document.getElementById('mentorGrowthV2622')?.setAttribute('hidden','')}";
  if(!s.includes(hide))throw new Error('[v2632-growth] growth hide anchor missing');
  s=s.replace(hide,hide2);
  return save(f,before,s);
}
function patchIndex(){
  const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let h=before;
  h=h.replace(/\s*<link[^>]+href=["']\/growth-status-v2626\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  h=h.replace(/\s*<script[^>]+src=["']\/growth-status-v2625\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,'');
  h=h.replace(/\s*<link[^>]+href=["']\/ui-final-v2629\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  if(!h.includes('</head>')||!h.includes('</body>'))throw new Error('[v2632-growth] index anchors missing');
  h=h.replace('</head>','<link rel="stylesheet" href="/growth-status-v2626.css?v=2632">\n<link rel="stylesheet" href="/ui-final-v2629.css?v=2632">\n</head>');
  h=h.replace('</body>','<script defer src="/growth-status-v2625.js?v=2632"></script>\n</body>');
  fs.writeFileSync(f,h,'utf8');return h!==before;
}

export function patchGrowthFinalV2632(){
  requireToken(must('public','app.js'),'UI_STABILITY_V2617','UI stability');
  requireToken(must('public','manual-mode-ui.js'),'ADVISORY_BUCKETS_V2632','A/B advisory');
  copyAssets();
  const out={legacyGrowth:patchLegacyGrowth(),status:patchStatus(),index:patchIndex()};
  requireToken(must('public','system-growth.js'),MARKER+'_LEGACY_GUARD','legacy growth guard');
  requireToken(must('public','growth-status-v2625.js'),MARKER+'_STATUS','growth status');
  const html=fs.readFileSync(must('public','index.html'),'utf8');
  for(const token of ['/growth-status-v2625.js?v=2632','/growth-status-v2626.css?v=2632','/ui-final-v2629.css?v=2632'])if(!html.includes(token))throw new Error(`[v2632-growth] index invariant missing ${token}`);
  console.log('[v2632-growth] READY',out);return{changed:Object.values(out).some(Boolean),out,marker:MARKER};
}
if(import.meta.url===`file://${process.argv[1]}`)patchGrowthFinalV2632();
