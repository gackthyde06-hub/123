import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchResearchLayer } from './research-layer-patch.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
patchResearchLayer();
const publicDir=path.join(__dirname,'public');
const htmlPath=path.join(publicDir,'index.html');
const files=['system-growth.css','system-growth.js','premium-theme.css','premium-theme.js','sg-crystal-bg.svg'];

for(const name of files){
  const source=path.join(__dirname,name);
  const target=path.join(publicDir,name);
  if(!fs.existsSync(source))throw new Error(`[ui] missing ${name}`);
  fs.copyFileSync(source,target);
}

let html=fs.readFileSync(htmlPath,'utf8');
const removers=[
  /<link[^>]+href=["']\/system-growth\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/premium-theme\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<script[^>]+src=["']\/system-growth\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/premium-theme\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
];
for(const re of removers)html=html.replace(re,'');

const cssTags=[
  '<link rel="stylesheet" href="/system-growth.css?v=sg231">',
  '<link rel="stylesheet" href="/premium-theme.css?v=sg231">',
].join('\n');
const jsTags=[
  '<script defer src="/system-growth.js?v=sg231"></script>',
  '<script defer src="/premium-theme.js?v=sg231"></script>',
].join('\n');

html=html.replace('</head>',`${cssTags}\n</head>`);
html=html.replace('</body>',`${jsTags}\n</body>`);
fs.writeFileSync(htmlPath,html,'utf8');
console.log('[ui] premium integration v2.3.1 + research layer ready');
