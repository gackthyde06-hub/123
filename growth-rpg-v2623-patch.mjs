import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const ASSETS=['growth-rpg-v2623.js','growth-rpg-v2623.css','sg-rpg-core-v2623.webp','sg-skill-direction-v2623.webp','sg-skill-execution-v2623.webp','sg-skill-cost-v2623.webp','sg-skill-regime-v2623.webp','sg-skill-stability-v2623.webp','sg-skill-risk-v2623.webp','sg-stage-collect-v2623.webp','sg-stage-calibrate-v2623.webp','sg-stage-forward-v2623.webp','sg-stage-stable-v2623.webp','sg-stage-master-v2623.webp'];
function must(p){if(!fs.existsSync(p))throw new Error(`[v2623-rpg] missing ${path.basename(p)}`);return p}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2623-rpg] syntax invalid ${path.basename(file)}: ${String(r.stderr||r.stdout||'').trim()}`)}
export function patchGrowthRpgV2623(){
  const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});
  for(const a of ASSETS){const src=must(path.join(__dirname,a)),dst=path.join(pub,a);fs.copyFileSync(src,dst)}
  check(path.join(pub,'growth-rpg-v2623.js'));
  const html=must(path.join(pub,'index.html'));let s=fs.readFileSync(html,'utf8'),before=s;
  s=s.replace(/\s*<link[^>]+href=["']\/growth-rpg-v2623\.css(?:\?[^"']*)?["'][^>]*>/gi,'');
  s=s.replace(/\s*<script[^>]+src=["']\/growth-rpg-v2623\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi,'');
  s=s.replace('</head>','<link rel="stylesheet" href="/growth-rpg-v2623.css?v=2623">\n</head>');
  s=s.replace('</body>','<script defer src="/growth-rpg-v2623.js?v=2623"></script>\n</body>');
  fs.writeFileSync(html,s,'utf8');
  return {changed:s!==before,assets:ASSETS.length};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchGrowthRpgV2623());
