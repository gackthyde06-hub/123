import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const results=[];
async function run(label,file,fn,{required=false}={}){
  try{
    const p=path.join(__dirname,file);
    if(!fs.existsSync(p)){results.push(`${label}=missing`);if(required)throw new Error(`${label} required patch missing: ${file}`);return null}
    const mod=await import(`./${file}?v2673=${Date.now()}-${Math.random()}`);
    const f=mod?.[fn];
    if(typeof f!=='function'){results.push(`${label}=no-export`);if(required)throw new Error(`${label} required export missing: ${fn}`);return null}
    const out=await f();results.push(`${label}=${out?.changed===false?'ready':'ok'}`);return out||{changed:false};
  }catch(e){console.error(`[v2673] ${label} FAILED:`,String(e?.stack||e?.message||e));results.push(`${label}=FAIL`);if(required)throw e;return null}
}
function copyAsset(name){try{const src=path.join(__dirname,name),dst=path.join(__dirname,'public',name);if(!fs.existsSync(src))return false;fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);return true}catch(e){console.warn(`[v2673] copy ${name}:`,String(e?.message||e));return false}}
function installAssets(){
  const publicDir=path.join(__dirname,'public'),htmlPath=path.join(publicDir,'index.html');fs.mkdirSync(publicDir,{recursive:true});
  const assets=['system-growth.css','system-growth.js','premium-theme.css','premium-theme.js','sg-crystal-bg.svg','structure-engine-v2-ui.js','structure-engine-v2.css','structure-learning-ui.js','structure-learning-ui.css','chart-ux-v262.css','manual-mode-ui.js','manual-mode-ui.css','growth-abc-v264.js','growth-abc-v264.css','actual-trade-hub-v2613.js','actual-trade-hub-v2613.css','actual-trade-edit-v2678.js','actual-trade-edit-v2678.css'];
  for(const a of assets)copyAsset(a);if(!fs.existsSync(htmlPath))return;let h=fs.readFileSync(htmlPath,'utf8');
  const names=['system-growth.css','premium-theme.css','structure-engine-v2.css','structure-learning-ui.css','chart-ux-v262.css','manual-mode-ui.css','growth-abc-v264.css','actual-trade-hub-v2613.css','actual-trade-edit-v2678.css'];
  for(const n of names)h=h.replace(new RegExp(`<link[^>]+href=["']/${n.replaceAll('.','\\.')}(?:\\?[^"']*)?["'][^>]*>\\s*`,'gi'),'');
  const scripts=['system-growth.js','premium-theme.js','structure-engine-v2-ui.js','structure-learning-ui.js','manual-mode-ui.js','growth-abc-v264.js','actual-trade-hub-v2613.js','actual-trade-edit-v2678.js'];
  for(const n of scripts)h=h.replace(new RegExp(`<script[^>]+src=["']/${n.replaceAll('.','\\.')}(?:\\?[^"']*)?["'][^>]*><\\/script>\\s*`,'gi'),'');
  h=h.replace(/<script\s+src=["']\/app\.js(?:\?[^"']*)?["']><\/script>/i,'<script src="/app.js?v=102673"></script>');
  const css=names.filter(n=>fs.existsSync(path.join(publicDir,n))).map(n=>`<link rel="stylesheet" href="/${n}?v=${n==='actual-trade-edit-v2678.css'?'sg2678':'sg2673'}">`).join('\n');
  const js=scripts.filter(n=>fs.existsSync(path.join(publicDir,n))).map(n=>`<script defer src="/${n}?v=${n==='actual-trade-edit-v2678.js'?'sg2678':'sg2673'}"></script>`).join('\n');
  h=h.replace('</head>',`${css}\n</head>`).replace('</body>',`${js}\n</body>`);fs.writeFileSync(htmlPath,h,'utf8');
}

await run('Research','research-layer-patch.mjs','patchResearchLayer');
await run('Structure','structure-engine-v2-patch.mjs','patchStructureEngineV2');
await run('SignalStability','test-signals-stability-patch.mjs','patchTestSignalsStability');
await run('Chart','chart-ux-v262-patch.mjs','patchChartUxV262');

const manualAB=await run('ManualAB','manual-mode-backend-patch.mjs','patchManualModeV263',{required:true});
const shadowLearning=await run('ShadowLearning','shadow-learning-v264-patch.mjs','patchShadowLearningV264',{required:true});
const tradfi=await run('TradFi','tradfi-learning-v2612-patch.mjs','patchTradfiLearningV2612',{required:true});
const candidateRecall=await run('CandidateRecall','candidate-recall-v2665-patch.mjs','patchCandidateRecallV2665',{required:true});
const candidateNarrative=await run('CandidateNarrative','candidate-narrative-v2666-patch.mjs','patchCandidateNarrativeV2666',{required:true});
const candidateLifecycle=await run('CandidateLifecycle','candidate-lifecycle-v2667-patch.mjs','patchCandidateLifecycleV2667',{required:true});
const candidateMarketwide=await run('CandidateMarketwide','candidate-marketwide-v2669-patch.mjs','patchCandidateMarketwideV2669',{required:true});
const candidateRecallFix=await run('CandidateRecallFix','candidate-recall-fix-v2670-patch.mjs','patchCandidateRecallFixV2670',{required:true});
const candidateOps=await run('CandidateOps2672','candidate-ops-v2672-fix.mjs','patchCandidateOpsV2672',{required:true});

installAssets();

await run('RailwayEgress','railway-egress-v266-patch.mjs','patchRailwayCostV266');
await run('Hobby','railway-hobby-v267-patch.mjs','patchRailwayHobbyV267');
await run('Ui267','ui-polish-v267-patch.mjs','patchUiPolishV267');
await run('Ui268','ui-polish-v268-patch.mjs','patchUiPolishV268');
await run('Ui269','ui-polish-v269-patch.mjs','patchUiPolishV269');
await run('ActualMonitor','actual-monitor-v2610-patch.mjs','patchActualMonitorV2610');
await run('Ui2610','ui-polish-v2610-patch.mjs','patchUiPolishV2610');
await run('Notify2611','notification-policy-v2611-patch.mjs','patchNotificationPolicyV2611');
await run('Ui2611','ui-polish-v2611-patch.mjs','patchUiPolishV2611');
await run('Ui2612','ui-polish-v2612-patch.mjs','patchUiPolishV2612');

const notify=await run('Notify2616','notification-control-v2616-patch.mjs','patchNotificationControlV2616',{required:true});
const ui=await run('Ui2616','ui-control-v2616-patch.mjs','patchUiControlV2616',{required:true});
const runtime=await run('Runtime2616','runtime-stability-v2616-patch.mjs','patchRuntimeStabilityV2616',{required:true});
const stable=await run('UiStability2617','ui-stability-v2617-patch.mjs','patchUiStabilityV2617',{required:true});
const integrity=await run('Integrity2668','integrity-preflight-v2668.mjs','runIntegrityPreflightV2668',{required:true});
const customNotify=await run('CandidateUiNotify2673','candidate-ui-notify-v2673-patch.mjs','patchCandidateUiNotifyV2673',{required:true});
const candidateHeader=await run('CandidateHeader2674','candidate-header-layout-v2674-patch.mjs','patchCandidateHeaderLayoutV2674',{required:true});
const candidateNarrativeLayout=await run('CandidateNarrativeLayout2676','candidate-narrative-layout-v2676-patch.mjs','patchCandidateNarrativeLayoutV2676',{required:true});
const candidateHeaderFinal=await run('CandidateHeaderFinal2680','candidate-header-final-v2680-patch.mjs','patchCandidateHeaderFinalV2680',{required:true});
const shadowBootcamp=await run('ShadowBootcamp2681','shadow-bootcamp-v2681-patch.mjs','patchShadowBootcampV2681',{required:true});

if(!manualAB||!shadowLearning||!tradfi||!candidateRecall||!candidateNarrative||!candidateLifecycle||!candidateMarketwide||!candidateRecallFix||!candidateOps||!notify||!ui||!runtime||!stable||!integrity||!customNotify||!candidateHeader||!candidateNarrativeLayout||!candidateHeaderFinal||!shadowBootcamp)throw new Error('V2.6.81 required stack incomplete; refusing partial deployment');
console.log('[v2681] READY · '+results.join(' · '));
