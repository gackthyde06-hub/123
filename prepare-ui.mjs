import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchResearchLayer } from './research-layer-patch.mjs';
import { patchStructureEngineV2 } from './structure-engine-v2-patch.mjs';
import { patchRuntimeResilience } from './runtime-resilience-patch.mjs';
import { patchUiRecoveryV255 } from './ui-recovery-v255-patch.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
let researchLayerReady=false;
try{patchResearchLayer();researchLayerReady=true}catch(err){console.error('[ui] Research R1 patch skipped:',String(err?.message||err))}
patchStructureEngineV2();
const resilience=patchRuntimeResilience();
const recovery=patchUiRecoveryV255();

const publicDir=path.join(__dirname,'public');
const htmlPath=path.join(publicDir,'index.html');
const files=['system-growth.css','system-growth.js','premium-theme.css','premium-theme.js','sg-crystal-bg.svg','structure-engine-v2-ui.js','structure-engine-v2.css','ui-recovery-v255.css'];
for(const name of files){const source=path.join(__dirname,name),target=path.join(publicDir,name);if(!fs.existsSync(source))throw new Error(`[ui] missing ${name}`);fs.copyFileSync(source,target)}
let html=fs.readFileSync(htmlPath,'utf8');
const removers=[
  /<link[^>]+href=["']\/system-growth\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/premium-theme\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/structure-engine-v2\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/ui-recovery-v255\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<script[^>]+src=["']\/system-growth-rescue\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/system-growth\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/premium-theme\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/structure-engine-v2-ui\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
];
for(const re of removers)html=html.replace(re,'');
const cssTags=[
  '<link rel="stylesheet" href="/system-growth.css?v=sg255">',
  '<link rel="stylesheet" href="/premium-theme.css?v=sg255">',
  '<link rel="stylesheet" href="/structure-engine-v2.css?v=sg255">',
  '<link rel="stylesheet" href="/ui-recovery-v255.css?v=sg255">',
].join('\n');
const jsTags=[
  '<script defer src="/system-growth.js?v=sg255"></script>',
  '<script defer src="/premium-theme.js?v=sg255"></script>',
  '<script defer src="/structure-engine-v2-ui.js?v=sg255"></script>',
].join('\n');
html=html.replace('</head>',`${cssTags}\n</head>`);
html=html.replace('</body>',`${jsTags}\n</body>`);
fs.writeFileSync(htmlPath,html,'utf8');
console.log(`[ui] V2.5.5 core-first recovery ready · Research R1=${researchLayerReady?'ready':'skipped'} · resilience=${resilience.server?.changed?'patched':resilience.server?.reason||'ok'} · recovery=${recovery.changed?'patched':recovery.reason||'ok'}`);
