import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PUB=path.join(ROOT,'public');
const MARKER='GROWTH_STATUS_V2626_STABLE_20260904';
const ASSETS=['growth-status-v2625.js','growth-status-v2626.css'];

function must(p){if(!fs.existsSync(p))throw new Error(`[v2626-stable] missing ${path.basename(p)}`);return p}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0||r.error)throw new Error(`[v2626-stable] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`)}
function saveJs(file,before,after){if(before===after)return false;const tmp=`${file}.${process.pid}.${Date.now()}.tmp.js`;fs.writeFileSync(tmp,after,'utf8');try{check(tmp);fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function replaceNamedFunction(src,name,replacement){
  const start=src.indexOf(`function ${name}(`);if(start<0)return src;
  const brace=src.indexOf('{',start);if(brace<0)return src;
  let depth=0,mode='code',esc=false;
  for(let i=brace;i<src.length;i++){
    const c=src[i],n=src[i+1];
    if(mode==='line'){if(c==='\n')mode='code';continue}
    if(mode==='block'){if(c==='*'&&n==='/'){mode='code';i++}continue}
    if(mode==='sq'||mode==='dq'||mode==='bt'){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if((mode==='sq'&&c==="'")||(mode==='dq'&&c==='"')||(mode==='bt'&&c==='`'))mode='code';continue}
    if(c==='/'&&n==='/'){mode='line';i++;continue}
    if(c==='/'&&n==='*'){mode='block';i++;continue}
    if(c==="'"){mode='sq';continue}if(c==='"'){mode='dq';continue}if(c==='`'){mode='bt';continue}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(0,start)+replacement+src.slice(i+1);
  }
  throw new Error(`[v2626-stable] cannot parse function ${name}`);
}

function patchLegacyRenderer(){
  const f=path.join(PUB,'system-growth.js');if(!fs.existsSync(f))return {changed:false,reason:'missing'};
  const before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER+'_LEGACY'))return {changed:false,reason:'already'};
  const needle='function render(){',count=s.split(needle).length-1;
  if(count!==1)throw new Error(`[v2626-stable] system-growth render count ${count}`);
  s=s.replace(needle,`function render(){/* ${MARKER}_LEGACY */if(window.__USE_GROWTH_STATUS_V2626===true)return;`);
  if(s.includes('function restoreGrowthAnchor('))s=replaceNamedFunction(s,'restoreGrowthAnchor','function restoreGrowthAnchor(root,a){return}');
  s=`// ${MARKER}_LEGACY\n${s}`;
  return {changed:saveJs(f,before,s)};
}

function patchStatus(){
  const f=path.join(PUB,'growth-status-v2625.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER+'_STATUS'))return {changed:false,reason:'already'};
  s=s.replace("'use strict';","'use strict';\nwindow.__USE_GROWTH_STATUS_V2626=true;");
  if(!s.includes('function mount()'))throw new Error('[v2626-stable] growth mount missing');
  s=replaceNamedFunction(s,'mount',`function mount(){
  const panel=document.getElementById('sgPanel');if(!panel)return null;window.__USE_GROWTH_STATUS_V2626=true;
  let root=document.getElementById(ROOT_ID);if(root)return root;
  root=document.createElement('section');root.id=ROOT_ID;root.className='sg-v2625';root.dataset.stableGrowthUi='2626';
  panel.prepend(root);return root
}`);
  if(!s.includes('function hideLegacyDecor()'))throw new Error('[v2626-stable] hideLegacyDecor missing');
  s=replaceNamedFunction(s,'hideLegacyDecor',`function hideLegacyDecor(){
  const panel=document.getElementById('sgPanel'),root=document.getElementById(ROOT_ID);
  if(panel&&root)for(const child of [...panel.children]){if(child!==root)child.hidden=true}
  document.querySelectorAll('.sg-rpg-core-v2623,.sg-rpg-skills-v2623,.sg-rpg-mentor-v2623,#sgStatusV2624,#mentorGrowthV2622').forEach(x=>x.hidden=true)
}`);
  s=`// ${MARKER}_STATUS\n${s}`;
  return {changed:saveJs(f,before,s)};
}

function patchIndex(){
  const f=must(path.join(PUB,'index.html')),before=fs.readFileSync(f,'utf8');let s=before;
  for(const v of ['2623','2624','2625','2626']){
    s=s.replace(new RegExp(`\\s*<link[^>]+href=["']\\/growth-(?:rpg|status)-v${v}\\.css(?:\\?[^"']*)?["'][^>]*>`,'gi'),'');
    s=s.replace(new RegExp(`\\s*<script[^>]+src=["']\\/growth-(?:rpg|status)-v${v}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>`,'gi'),'');
  }
  s=s.replace('</head>',`<script>window.__USE_GROWTH_STATUS_V2626=true;</script>
<link rel="stylesheet" href="/growth-status-v2626.css?v=2626stable">
</head>`);
  s=s.replace('</body>',`<script defer src="/growth-status-v2625.js?v=2626stable"></script>
</body>`);
  fs.writeFileSync(f,s,'utf8');return {changed:s!==before};
}

export function patchGrowthStatusV2626(){
  fs.mkdirSync(PUB,{recursive:true});
  for(const a of ASSETS)fs.copyFileSync(must(path.join(ROOT,a)),path.join(PUB,a));
  check(path.join(PUB,'growth-status-v2625.js'));
  const legacy=patchLegacyRenderer(),status=patchStatus(),index=patchIndex();
  check(path.join(PUB,'growth-status-v2625.js'));if(fs.existsSync(path.join(PUB,'system-growth.js')))check(path.join(PUB,'system-growth.js'));
  console.log('[v2626-stable] READY',legacy,status,index);
  return {changed:Boolean(legacy.changed||status.changed||index.changed),legacy,status,index,marker:MARKER};
}
if(import.meta.url===`file://${process.argv[1]}`)patchGrowthStatusV2626();
