import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PUB=path.join(ROOT,'public');
const MARKER='GROWTH_UNIFIED_V2637_20260904';
const ASSETS=['growth-status-v2625.js','growth-status-v2626.css'];

function must(p){if(!fs.existsSync(p))throw new Error(`[v2637-growth] missing ${path.basename(p)}`);return p}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0||r.error)throw new Error(`[v2637-growth] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`)}
function saveJs(file,before,after){if(before===after)return false;const tmp=`${file}.${process.pid}.${Date.now()}.tmp.js`;fs.writeFileSync(tmp,after,'utf8');try{check(tmp);fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function replaceNamedFunction(src,name,replacement){
  const start=src.indexOf(`function ${name}(`);if(start<0)return src;const brace=src.indexOf('{',start);if(brace<0)return src;let depth=0,mode='code',esc=false;
  for(let i=brace;i<src.length;i++){const c=src[i],n=src[i+1];if(mode==='line'){if(c==='\n')mode='code';continue}if(mode==='block'){if(c==='*'&&n==='/'){mode='code';i++}continue}if(mode==='sq'||mode==='dq'||mode==='bt'){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if((mode==='sq'&&c==="'")||(mode==='dq'&&c==='"')||(mode==='bt'&&c==='`'))mode='code';continue}if(c==='/'&&n==='/'){mode='line';i++;continue}if(c==='/'&&n==='*'){mode='block';i++;continue}if(c==="'"){mode='sq';continue}if(c==='"'){mode='dq';continue}if(c==='`'){mode='bt';continue}if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(0,start)+replacement+src.slice(i+1)}throw new Error(`[v2637-growth] cannot parse ${name}`)
}

const PREMIUM_CSS=String.raw`
/* ${MARKER}_CSS */
:root{--g37-bg:#0e1319;--g37-panel:#151d26;--g37-panel2:#1a2430;--g37-panel3:#202c38;--g37-line:#364451;--g37-gold:#d9b66d;--g37-gold2:#f1cf8a;--g37-blue:#86abd8;--g37-green:#72c99b;--g37-text:#eee8df;--g37-muted:#9ca3aa}
.sg-v2625{display:grid!important;gap:13px!important;color:var(--g37-text)!important}.sg-v2625 *{box-sizing:border-box}.sg-v2625 details>summary{list-style:none}.sg-v2625 details>summary::-webkit-details-marker{display:none}
.sg-v25-card{background:linear-gradient(155deg,#1a2430 0%,#151d26 60%,#121920 100%)!important;border:1px solid rgba(210,177,109,.25)!important;box-shadow:0 15px 36px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.025)!important}
.sg-v25-card>header{background:linear-gradient(90deg,rgba(217,182,109,.10),rgba(74,103,135,.16))!important;border:1px solid rgba(199,173,121,.20)!important;border-radius:14px!important;padding:10px 12px!important;margin-bottom:12px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important}.sg-v25-card>header>svg{color:var(--g37-gold)!important;filter:none!important}.sg-v25-card>header b{color:#efd8ad!important}.sg-v25-card>header span{color:#9fa6ad!important}
.sg-v25-hero{background:radial-gradient(circle at 10% 0,rgba(214,172,92,.14),transparent 31%),radial-gradient(circle at 90% 0,rgba(75,116,162,.15),transparent 30%),linear-gradient(145deg,#1d2935,#17212b 62%,#121a22)!important;border-color:rgba(218,183,109,.34)!important}.sg-v25-emblem{background:linear-gradient(145deg,#2b3743,#222c36)!important;border-color:rgba(218,183,109,.42)!important;color:#f0cd83!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important}
.sg-v25-summary>div{background:linear-gradient(145deg,#222d38,#19232c)!important;border-color:#35434f!important}.sg-v25-summary span,.sg-v25-summary small{color:#999fa6!important}.sg-v25-summary b{color:#eee8df!important}.sg-v25-summary b.gold{color:#f0ca7d!important}.sg-v25-summary b.blue{color:#9bc1ed!important}
.sg-v25-attrs{gap:10px!important}.sg-v25-attr,.sg-v25-quest{background:linear-gradient(145deg,#202b36,#19232c)!important;border-color:#35434f!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}.sg-v25-attr[open],.sg-v25-quest[open]{background:linear-gradient(145deg,#27333f,#1e2933)!important;border-color:rgba(218,183,109,.40)!important}.sg-v25-attr-icon,.sg-v25-qicon{background:linear-gradient(145deg,#2b3742,#232e38)!important;border-color:rgba(218,183,109,.27)!important}.sg-v25-attr-copy span,.sg-v25-qcopy b{color:#e3d1b1!important}.sg-v25-attr-copy small,.sg-v25-qcopy small{color:#969da4!important}.sg-v25-attr>summary>b{color:#f1ece5!important}
.sg-v25-stage-row,.sg-v25-training,.sg-v25-logs,.sg-v25-unlocks,.sg-v25-learn-grid>div{background:linear-gradient(145deg,#202a34,#19232c)!important;border-color:#34414d!important}.sg-v25-stage>span{background:#25313c!important;border-color:#41505e!important;color:#98a2ab!important}.sg-v25-stage.done>span{background:#2a302d!important;border-color:rgba(217,182,109,.44)!important;color:#d8b66e!important}.sg-v25-stage.current>span{background:linear-gradient(145deg,#f0cf8a,#d3a95f)!important;color:#1b1710!important;border-color:#f1cf8a!important;box-shadow:0 0 18px rgba(217,182,109,.18)!important}
.sg-v25-stage-note,.sg-v25-watchline{background:linear-gradient(90deg,#202a33,#1a232c)!important;border-color:#34414d!important}.sg-v25-meter,.sg-v25-qprogress span,.sg-v25-overall span{background:#2b3742!important}.sg-v25-meter>i,.sg-v25-overall i{background:linear-gradient(90deg,#9a7239,#d8ad60 72%,#efcc84)!important}.sg-v25-qprogress i.blue{background:linear-gradient(90deg,#5378a6,#86adde)!important}.sg-v25-qprogress i.gold{background:linear-gradient(90deg,#9d753b,#dfb66b)!important}
.sg-v25-detail-title{border-color:#35434f!important}.sg-v25-learn-grid span{color:#8e969e!important}.sg-v25-learn-grid b{color:#ded8cf!important}.sg-v25-train-row,.sg-v25-log-row,.sg-v25-unlock-row{border-color:#313d48!important}.sg-v25-train-row b{color:#d2ccc3!important}.sg-v25-log-row span{color:#aab0b5!important}
.sg-v2625 details,.sg-v2625 *{transition:none!important;animation:none!important}
`;

function patchLegacy(){
  const f=path.join(PUB,'system-growth.js');if(!fs.existsSync(f))return {changed:false,reason:'missing'};const before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER+'_LEGACY'))return {changed:false,reason:'already'};
  const count=s.split('function render(){').length-1;if(count!==1)throw new Error(`[v2637-growth] legacy render count ${count}`);s=s.replace('function render(){',`function render(){/* ${MARKER}_LEGACY */if(window.__GROWTH_UNIFIED_V2637===true)return;`);if(s.includes('function restoreGrowthAnchor('))s=replaceNamedFunction(s,'restoreGrowthAnchor','function restoreGrowthAnchor(root,a){return}');s=`// ${MARKER}_LEGACY\n${s}`;return {changed:saveJs(f,before,s)}
}
function patchStatus(){
  const f=path.join(PUB,'growth-status-v2625.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER+'_STATUS'))return {changed:false,reason:'already'};
  s=s.replace("'use strict';","'use strict';\nwindow.__GROWTH_UNIFIED_V2637=true;");s=s.replaceAll('SYSTEM GROWTH · SHADOW','SYSTEM GROWTH');s=s.replaceAll('影子養成總覽','系統養成');s=s.replaceAll('Shadow 正在把歷史結果拆成可驗證 Edge，先學會什麼時候該出手，也學會什麼時候不交易。','實際結果、樣本品質、穩定度與風險過濾整合在同一套成長系統。');s=s.replaceAll('點每一項展開，直接看 Shadow 現在學到了什麼','點開查看目前學習依據');s=s.replaceAll('影子學習資訊','學習依據');
  if(!s.includes('function mount()'))throw new Error('[v2637-growth] mount missing');s=replaceNamedFunction(s,'mount',`function mount(){const panel=document.getElementById('sgPanel');if(!panel)return null;window.__GROWTH_UNIFIED_V2637=true;let root=document.getElementById(ROOT_ID);if(root)return root;for(const old of [...panel.children])old.hidden=true;root=document.createElement('section');root.id=ROOT_ID;root.className='sg-v2625';root.dataset.unifiedGrowth='2637';panel.prepend(root);return root}`);
  if(!s.includes('function hideLegacyDecor()'))throw new Error('[v2637-growth] hideLegacyDecor missing');s=replaceNamedFunction(s,'hideLegacyDecor',`function hideLegacyDecor(){const panel=document.getElementById('sgPanel'),root=document.getElementById(ROOT_ID);window.__GROWTH_UNIFIED_V2637=true;if(panel&&root)for(const child of [...panel.children])child.hidden=child!==root;document.querySelectorAll('.sg-rpg-core-v2623,.sg-rpg-skills-v2623,.sg-rpg-mentor-v2623,#sgStatusV2624,#mentorGrowthV2622,[data-legacy-growth],.old-growth,.sg-legacy').forEach(x=>x.hidden=true)}`);
  s=`// ${MARKER}_STATUS\n${s}`;return {changed:saveJs(f,before,s)}
}
function patchIndex(){
  const f=must(path.join(PUB,'index.html')),before=fs.readFileSync(f,'utf8');let s=before;
  // Remove every previous growth-status/rpg asset reference so only the unified renderer is mounted once.
  s=s.replace(/\s*<link[^>]+href=["']\/(?:growth-(?:rpg|status)-v\d+|growth-status-v2626)\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  s=s.replace(/\s*<script[^>]+src=["']\/(?:growth-(?:rpg|status)-v\d+|growth-status-v2625)\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,'');
  if(!s.includes('</head>')||!s.includes('</body>'))throw new Error('[v2637-growth] index anchors missing');
  s=s.replace('</head>',`<script>window.__GROWTH_UNIFIED_V2637=true;</script>\n<link rel="stylesheet" href="/growth-status-v2626.css?v=2637">\n</head>`);
  s=s.replace('</body>',`<script defer src="/growth-status-v2625.js?v=2637"></script>\n</body>`);
  fs.writeFileSync(f,s,'utf8');return {changed:s!==before}
}
export function patchGrowthStatusV2626(){fs.mkdirSync(PUB,{recursive:true});for(const a of ASSETS)fs.copyFileSync(must(path.join(ROOT,a)),path.join(PUB,a));let css=fs.readFileSync(path.join(PUB,'growth-status-v2626.css'),'utf8');if(!css.includes(MARKER+'_CSS'))fs.writeFileSync(path.join(PUB,'growth-status-v2626.css'),css+'\n'+PREMIUM_CSS,'utf8');check(path.join(PUB,'growth-status-v2625.js'));const legacy=patchLegacy(),status=patchStatus(),index=patchIndex();check(path.join(PUB,'growth-status-v2625.js'));if(fs.existsSync(path.join(PUB,'system-growth.js')))check(path.join(PUB,'system-growth.js'));console.log('[v2637-growth] READY',legacy,status,index);return {changed:Boolean(legacy.changed||status.changed||index.changed),legacy,status,index,marker:MARKER}}
if(import.meta.url===`file://${process.argv[1]}`)patchGrowthStatusV2626();
