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
const cssTag='<link rel="stylesheet" href="/system-growth.css?v=sg121">';
const jsTag='<script defer src="/system-growth.js?v=sg121"></script>';
let html=fs.readFileSync(htmlPath,'utf8');
const cssRe=/<link[^>]+href=["'][^"']*system-growth\.css[^"']*["'][^>]*>/i;
const jsRe=/<script[^>]+src=["'][^"']*system-growth\.js[^"']*["'][^>]*><\/script>/i;
if(cssRe.test(html))html=html.replace(cssRe,cssTag);else html=html.replace('</head>',`${cssTag}\n</head>`);
if(jsRe.test(html))html=html.replace(jsRe,jsTag);else html=html.replace('</body>',`${jsTag}\n</body>`);
fs.writeFileSync(htmlPath,html,'utf8');
console.log('[ui] system growth v1.2.1 ready');
