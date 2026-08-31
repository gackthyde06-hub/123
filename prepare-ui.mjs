import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const publicDir=path.join(__dirname,'public');
const htmlPath=path.join(publicDir,'index.html');
const assets=[
  ['system-growth.css',path.join(publicDir,'system-growth.css')],
  ['system-growth.js',path.join(publicDir,'system-growth.js')],
];

for(const [sourceName,target] of assets){
  const source=path.join(__dirname,sourceName);
  if(!fs.existsSync(source))throw new Error(`[ui] missing ${sourceName}`);
  fs.copyFileSync(source,target);
}

const cssTag='<link rel="stylesheet" href="/system-growth.css?v=sg100">';
const jsTag='<script defer src="/system-growth.js?v=sg100"></script>';
let html=fs.readFileSync(htmlPath,'utf8');
let changed=false;
if(!html.includes('/system-growth.css')){
  html=html.replace('</head>',`${cssTag}\n</head>`);
  changed=true;
}
if(!html.includes('/system-growth.js')){
  html=html.replace('</body>',`${jsTag}\n</body>`);
  changed=true;
}
if(changed)fs.writeFileSync(htmlPath,html,'utf8');
console.log(`[ui] system growth ready${changed?' + injected':' (already injected)'}`);
