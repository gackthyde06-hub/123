import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const ASSETS=['growth-status-v2624.js','growth-status-v2624.css'];
function must(p){if(!fs.existsSync(p))throw new Error(`[v2624-status] missing ${path.basename(p)}`);return p}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2624-status] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||'').trim()}`)}
export function patchGrowthStatusV2624(){
  const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
  for(const a of ASSETS)fs.copyFileSync(must(path.join(__dirname,a)),path.join(pub,a));
  check(path.join(pub,'growth-status-v2624.js'));
  const html=must(path.join(pub,'index.html'));let s=fs.readFileSync(html,'utf8'),before=s;
  s=s.replace(/\s*<link[^>]+href=["']\/growth-rpg-v2623\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  s=s.replace(/\s*<script[^>]+src=["']\/growth-rpg-v2623\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,'');
  s=s.replace(/\s*<link[^>]+href=["']\/growth-status-v2624\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  s=s.replace(/\s*<script[^>]+src=["']\/growth-status-v2624\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,'');
  s=s.replace('</head>','<link rel="stylesheet" href="/growth-status-v2624.css?v=2624">\n</head>');
  s=s.replace('</body>','<script defer src="/growth-status-v2624.js?v=2624"></script>\n</body>');
  fs.writeFileSync(html,s,'utf8');
  return {changed:s!==before,assets:ASSETS.length};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchGrowthStatusV2624());
