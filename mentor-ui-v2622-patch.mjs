import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const __dirname=path.dirname(fileURLToPath(import.meta.url));const MARKER='MENTOR_UI_V2622';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v2622-ui] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2622-ui] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const ext=path.extname(f)||'.tmp',tmp=`${f}.v2622-${process.pid}-${Date.now()}${ext}`;fs.writeFileSync(tmp,a,'utf8');try{if(ext==='.js'||ext==='.mjs')check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function copy(name){const src=must(name),dst=path.join(__dirname,'public',name);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);if(name.endsWith('.js'))check(dst)}
function patchIndex(){const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');let s=before;for(const n of ['mentor-ui-v2622.css'])s=s.replace(new RegExp(`<link[^>]+href=["']/${n.replaceAll('.','\\.')}(?:\\?[^"']*)?["'][^>]*>\\s*`,'gi'),'');for(const n of ['mentor-ui-v2622.js'])s=s.replace(new RegExp(`<script[^>]+src=["']/${n.replaceAll('.','\\.')}(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'gi'),'');s=s.replace('</head>','<link rel="stylesheet" href="/mentor-ui-v2622.css?v=sg2622">\n</head>');s=s.replace('</body>','<script defer src="/mentor-ui-v2622.js?v=sg2622"></script>\n</body>');s=s.replace(/\/app\.js\?v=[^"']+/g,'/app.js?v=102622').replace(/\?v=sg2621/g,'?v=sg2622').replace(/\?v=sg2620/g,'?v=sg2622');return{changed:save(f,before,s)}}
function patchManual(){const f=path.join(__dirname,'public','manual-mode-ui.js');if(!fs.existsSync(f))return{changed:false,reason:'missing'};const before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return{changed:false,reason:'already'};s=s.replaceAll('A/B/C 是手動執行優先級，不是勝率保證。A級也必須由你確認價格後才下單。','A/B 是執行優先級；高 Edge 觀察只提供額外研究，不會自動下單。');s=`// ${MARKER}\n${s}`;return{changed:save(f,before,s)}}
export function patchMentorUiV2622(){copy('mentor-ui-v2622.js');copy('mentor-ui-v2622.css');const index=patchIndex(),manual=patchManual();return{changed:true,index,manual}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchMentorUiV2622());
