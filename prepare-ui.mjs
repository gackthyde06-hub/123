import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchResearchLayer } from './research-layer-patch.mjs';
import { patchStructureEngineV2 } from './structure-engine-v2-patch.mjs';
import { patchTestSignalsStability } from './test-signals-stability-patch.mjs';
import { patchChartUxV262 } from './chart-ux-v262-patch.mjs';
import { patchManualModeV263 } from './manual-mode-backend-patch.mjs';
import { patchShadowLearningV264 } from './shadow-learning-v264-patch.mjs';
import { patchRailwayCostV266 } from './railway-egress-v266-patch.mjs';
import { patchRailwayHobbyV267 } from './railway-hobby-v267-patch.mjs';
import { patchUiPolishV267 } from './ui-polish-v267-patch.mjs';
import { patchUiPolishV268 } from './ui-polish-v268-patch.mjs';
import { patchUiPolishV269 } from './ui-polish-v269-patch.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));

// V2.6 clean rebase policy:
// 1) restore the proven pre-XAU System Growth UI baseline;
// 2) retain Research R1 + Structure Engine V2 + Structure Learning;
// 3) keep test-signal scans off the HTTP critical path;
// 4) do not load any V2.5.3/2.5.4/2.5.5 rescue/recovery frontend layers.
let researchLayerReady=false;
try{patchResearchLayer();researchLayerReady=true}catch(err){console.error('[ui:v269] Research R1 patch skipped:',String(err?.message||err))}
patchStructureEngineV2();
const stability=patchTestSignalsStability();
const chartUx=patchChartUxV262();
const manualMode=patchManualModeV263();
const abcShadow=patchShadowLearningV264();

const publicDir=path.join(__dirname,'public');
const htmlPath=path.join(publicDir,'index.html');
const files=['system-growth.css','system-growth.js','premium-theme.css','premium-theme.js','sg-crystal-bg.svg','structure-engine-v2-ui.js','structure-engine-v2.css','structure-learning-ui.js','structure-learning-ui.css','chart-ux-v262.css','manual-mode-ui.js','manual-mode-ui.css','growth-abc-v264.js','growth-abc-v264.css'];
for(const name of files){
  const source=path.join(__dirname,name),target=path.join(publicDir,name);
  if(!fs.existsSync(source))throw new Error(`[ui:v269] missing ${name}`);
  fs.copyFileSync(source,target);
}

// Remove generated public remnants from the failed rescue/recovery experiments.
for(const obsolete of ['system-growth-fetch-hotfix.js','system-growth-rescue.js','ui-recovery-v255.css']){
  try{const p=path.join(publicDir,obsolete);if(fs.existsSync(p))fs.unlinkSync(p)}catch{}
}

let html=fs.readFileSync(htmlPath,'utf8');
const removers=[
  /<link[^>]+href=["']\/system-growth\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/premium-theme\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/structure-engine-v2\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/structure-learning-ui\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/chart-ux-v262\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/manual-mode-ui\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/growth-abc-v264\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<link[^>]+href=["']\/ui-recovery-v255\.css(?:\?[^"']*)?["'][^>]*>\s*/gi,
  /<script[^>]+src=["']\/system-growth-fetch-hotfix\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/system-growth-rescue\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/system-growth\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/premium-theme\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/structure-engine-v2-ui\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/structure-learning-ui\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/manual-mode-ui\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
  /<script[^>]+src=["']\/growth-abc-v264\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,
];
for(const re of removers)html=html.replace(re,'');
html=html.replace(/<script\s+src=[\"']\/app\.js(?:\?[^\"']*)?[\"']><\/script>/i,'<script src=\"/app.js?v=10269\"></script>');

const cssTags=[
  '<link rel="stylesheet" href="/system-growth.css?v=sg269">',
  '<link rel="stylesheet" href="/premium-theme.css?v=sg269">',
  '<link rel="stylesheet" href="/structure-engine-v2.css?v=sg269">',
  '<link rel="stylesheet" href="/structure-learning-ui.css?v=sg269">',
  '<link rel="stylesheet" href="/chart-ux-v262.css?v=sg269">',
  '<link rel="stylesheet" href="/manual-mode-ui.css?v=sg269">',
  '<link rel="stylesheet" href="/growth-abc-v264.css?v=sg269">',
].join('\n');
const jsTags=[
  '<script defer src="/system-growth.js?v=sg269"></script>',
  '<script defer src="/premium-theme.js?v=sg269"></script>',
  '<script defer src="/structure-engine-v2-ui.js?v=sg269"></script>',
  '<script defer src="/structure-learning-ui.js?v=sg269"></script>',
  '<script defer src="/manual-mode-ui.js?v=sg269"></script>',
  '<script defer src="/growth-abc-v264.js?v=sg269"></script>',
].join('\n');
html=html.replace('</head>',`${cssTags}\n</head>`);
html=html.replace('</body>',`${jsTags}\n</body>`);
fs.writeFileSync(htmlPath,html,'utf8');

// V2.6.6 cost patch runs after UI generation; V2.6.7 Hobby profile runs after that.
// Neither changes trading thresholds or core server-side notification poll intervals.
const costOpt=patchRailwayCostV266();
const hobbyOpt=patchRailwayHobbyV267();
const uiPolish=patchUiPolishV267();
const uiRefine=patchUiPolishV268();
const uiV269=patchUiPolishV269();
console.log(`[ui:v269] clean rebase + TV return pin + shadow history + refined growth UI ready · Research R1=${researchLayerReady?'ready':'skipped'} · Structure=S2.1.0 · testSignals=${stability.changed?'nonblocking':'already-nonblocking'} · chartUx=${chartUx.changed?'patched':chartUx.reason||'ready'} · manual=${manualMode.changed?'patched':manualMode.reason||'ready'} · abcShadow=${abcShadow.changed?'patched':abcShadow.reason||'ready'} · RailwayEgress=${costOpt.changed?'optimized':'already-optimized'} · HobbyProfile=${hobbyOpt.changed?'optimized':'already-optimized'} · UiPolish267=${uiPolish.changed?'patched':'ready'} · UiRefine268=${uiRefine.changed?'patched':'ready'} · Ui269=${uiV269.changed?'patched':'ready'} · rescueLayers=OFF`);
