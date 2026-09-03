import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PUB=path.join(ROOT,'public');
const MARKER='GROWTH_CLEAN_V2635_20260904';
const ASSETS=['growth-status-v2625.js','growth-status-v2626.css'];

function must(p){if(!fs.existsSync(p))throw new Error(`[v2635-growth] missing ${path.basename(p)}`);return p}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0||r.error)throw new Error(`[v2635-growth] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`)}
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
  throw new Error(`[v2635-growth] cannot parse function ${name}`);
}

const CLEAN_CSS=String.raw`
/* ${MARKER}_CSS */
.sg-v2625{gap:12px!important}
.sg-v25-card{background:linear-gradient(155deg,rgba(47,55,65,.88),rgba(36,43,52,.88))!important;border-color:rgba(190,166,118,.22)!important;box-shadow:0 8px 24px rgba(0,0,0,.10)!important}
.sg-v25-card>header{background:transparent!important;border:0!important;border-bottom:1px solid rgba(205,188,157,.16)!important;border-radius:0!important;padding:0 0 10px!important;margin-bottom:11px!important;box-shadow:none!important}
.sg-v25-card>header>svg{filter:none!important}.sg-v25-card>header b{color:#ead7b5!important}.sg-v25-card>header span{color:#a8a5a0!important}
.sg-v25-hero{background:linear-gradient(145deg,rgba(57,64,73,.92),rgba(43,50,59,.92))!important;border-color:rgba(216,177,108,.28)!important}
.sg-v25-emblem{background:rgba(216,177,108,.08)!important}
.sg-v25-summary>div,.sg-v25-attr,.sg-v25-quest,.sg-v25-stage-row,.sg-v25-training,.sg-v25-logs,.sg-v25-unlocks,.sg-v25-learn-grid>div{background:rgba(255,255,255,.045)!important;box-shadow:none!important}
.sg-v25-attr[open],.sg-v25-quest[open]{background:rgba(216,177,108,.055)!important}
.sg-v25-attr-icon,.sg-v25-qicon{background:rgba(255,255,255,.035)!important}
.sg-v25-stage-note,.sg-v25-watchline{background:rgba(255,255,255,.035)!important}
.sg-v25-train-row,.sg-v25-log-row,.sg-v25-unlock-row{background:transparent!important}
.sg-v25-stage>span{background:rgba(255,255,255,.045)!important}.sg-v25-stage.current>span{background:#e7c47f!important}
.sg-v2625 details,.sg-v2625 *{transition:none!important;animation:none!important}
`;

function patchLegacyRenderer(){
  const f=path.join(PUB,'system-growth.js');if(!fs.existsSync(f))return {changed:false,reason:'missing'};
  const before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER+'_LEGACY'))return {changed:false,reason:'already'};
  const needle='function render(){',count=s.split(needle).length-1;if(count!==1)throw new Error(`[v2635-growth] legacy render count ${count}`);
  s=s.replace(needle,`function render(){/* ${MARKER}_LEGACY */if(window.__USE_GROWTH_STATUS_V2635===true)return;`);
  if(s.includes('function restoreGrowthAnchor('))s=replaceNamedFunction(s,'restoreGrowthAnchor','function restoreGrowthAnchor(root,a){return}');
  s=`// ${MARKER}_LEGACY\n${s}`;return {changed:saveJs(f,before,s)};
}

function patchStatus(){
  const f=path.join(PUB,'growth-status-v2625.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER+'_STATUS'))return {changed:false,reason:'already'};
  s=s.replace("'use strict';","'use strict';\nwindow.__USE_GROWTH_STATUS_V2635=true;");
  s=s.replaceAll('SYSTEM GROWTH · SHADOW','SYSTEM GROWTH');
  s=s.replaceAll('影子養成總覽','系統養成');
  s=s.replaceAll('Shadow 正在把歷史結果拆成可驗證 Edge，先學會什麼時候該出手，也學會什麼時候不交易。','依據實際結果持續校準 Edge、穩定度與風險過濾。');
  s=s.replaceAll('點每一項展開，直接看 Shadow 現在學到了什麼','點開查看目前學習依據');
  s=s.replaceAll('影子學習資訊','學習依據');

  if(!s.includes('function mount()'))throw new Error('[v2635-growth] mount missing');
  s=replaceNamedFunction(s,'mount',`function mount(){
  const panel=document.getElementById('sgPanel');if(!panel)return null;window.__USE_GROWTH_STATUS_V2635=true;
  let root=document.getElementById(ROOT_ID);if(root)return root;
  root=document.createElement('section');root.id=ROOT_ID;root.className='sg-v2625';root.dataset.cleanGrowthUi='2635';panel.prepend(root);return root
}`);
  if(!s.includes('function hideLegacyDecor()'))throw new Error('[v2635-growth] hide legacy missing');
  s=replaceNamedFunction(s,'hideLegacyDecor',`function hideLegacyDecor(){
  const panel=document.getElementById('sgPanel'),root=document.getElementById(ROOT_ID);
  if(panel&&root)for(const child of [...panel.children])if(child!==root)child.hidden=true;
  document.querySelectorAll('.sg-rpg-core-v2623,.sg-rpg-skills-v2623,.sg-rpg-mentor-v2623,#sgStatusV2624,#mentorGrowthV2622').forEach(x=>x.hidden=true)
}`);
  s=`// ${MARKER}_STATUS\n${s}`;return {changed:saveJs(f,before,s)};
}

function patchIndex(){
  const f=must(path.join(PUB,'index.html')),before=fs.readFileSync(f,'utf8');let s=before;
  for(const v of ['2623','2624','2625','2626']){
    s=s.replace(new RegExp(`\\s*<link[^>]+href=["']\\/growth-(?:rpg|status)-v${v}\\.css(?:\\?[^"']*)?["'][^>]*>`,'gi'),'');
    s=s.replace(new RegExp(`\\s*<script[^>]+src=["']\\/growth-(?:rpg|status)-v${v}\\.js(?:\\?[^"']*)?["'][^>]*><\\/script>`,'gi'),'');
  }
  s=s.replace('</head>',`<script>window.__USE_GROWTH_STATUS_V2635=true;</script>
<link rel="stylesheet" href="/growth-status-v2626.css?v=2635">
</head>`);
  s=s.replace('</body>',`<script defer src="/growth-status-v2625.js?v=2635"></script>
</body>`);
  fs.writeFileSync(f,s,'utf8');return {changed:s!==before};
}

export function patchGrowthStatusV2626(){
  fs.mkdirSync(PUB,{recursive:true});
  for(const a of ASSETS)fs.copyFileSync(must(path.join(ROOT,a)),path.join(PUB,a));
  let css=fs.readFileSync(path.join(PUB,'growth-status-v2626.css'),'utf8');if(!css.includes(MARKER+'_CSS'))fs.writeFileSync(path.join(PUB,'growth-status-v2626.css'),css+'\n'+CLEAN_CSS,'utf8');
  check(path.join(PUB,'growth-status-v2625.js'));
  const legacy=patchLegacyRenderer(),status=patchStatus(),index=patchIndex();
  check(path.join(PUB,'growth-status-v2625.js'));if(fs.existsSync(path.join(PUB,'system-growth.js')))check(path.join(PUB,'system-growth.js'));
  console.log('[v2635-growth] READY',legacy,status,index);
  return {changed:Boolean(legacy.changed||status.changed||index.changed),legacy,status,index,marker:MARKER};
}
if(import.meta.url===`file://${process.argv[1]}`)patchGrowthStatusV2626();
