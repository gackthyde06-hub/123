import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),PUB=path.join(ROOT,'public');
const log=s=>console.log(`[ui-final:V2.6.33] ${s}`);
function copy(name){const src=path.join(ROOT,name),dst=path.join(PUB,name);if(!fs.existsSync(src)){log(`WARN missing ${name}`);return false}fs.mkdirSync(PUB,{recursive:true});fs.copyFileSync(src,dst);return true}
function clean(h,name,kind){const e=name.replaceAll('.','\\.');return kind==='css'?h.replace(new RegExp(`\\s*<link[^>]+href=["']/${e}(?:\\?[^"']*)?["'][^>]*>`,`gi`),''):h.replace(new RegExp(`\\s*<script[^>]+src=["']/${e}(?:\\?[^"']*)?["'][^>]*><\\/script>`,`gi`),'')}
try{
  for(const n of ['manual-ab-v2633.js','manual-ab-v2633.css','growth-guard-v2633.js','growth-guard-v2633.css','growth-status-v2625.js','growth-status-v2626.css'])copy(n);
  const f=path.join(PUB,'index.html');if(!fs.existsSync(f)){log('WARN public/index.html missing; baseline deploy continues');process.exit(0)}
  let h=fs.readFileSync(f,'utf8');
  for(const n of ['manual-ab-v2633.css','growth-guard-v2633.css','growth-status-v2626.css'])h=clean(h,n,'css');
  for(const n of ['manual-ab-v2633.js','growth-guard-v2633.js','growth-status-v2625.js'])h=clean(h,n,'js');
  const css='<link rel="stylesheet" href="/growth-status-v2626.css?v=2633">\n<link rel="stylesheet" href="/growth-guard-v2633.css?v=2633">\n<link rel="stylesheet" href="/manual-ab-v2633.css?v=2633">';
  const js='<script defer src="/growth-status-v2625.js?v=2633"></script>\n<script defer src="/growth-guard-v2633.js?v=2633"></script>\n<script defer src="/manual-ab-v2633.js?v=2633"></script>';
  if(h.includes('</head>'))h=h.replace('</head>',`${css}\n</head>`);else log('WARN </head> missing');
  if(h.includes('</body>'))h=h.replace('</body>',`${js}\n</body>`);else log('WARN </body> missing');
  fs.writeFileSync(f,h,'utf8');log('overlay assets installed');
}catch(e){console.warn('[ui-final:V2.6.33] WARN nonfatal:',e?.stack||e)}
