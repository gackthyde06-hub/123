import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='SYSTEM_INTEGRITY_PREFLIGHT_V2668_20260904';

function read(rel){
  const f=path.join(__dirname,rel);
  if(!fs.existsSync(f))throw new Error(`[integrity-v2668] missing ${rel}`);
  return fs.readFileSync(f,'utf8');
}
function nodeCheck(rel){
  const f=path.join(__dirname,rel);
  if(!fs.existsSync(f))throw new Error(`[integrity-v2668] missing ${rel}`);
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[integrity-v2668] syntax ${rel}: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function must(src,needle,label){if(!src.includes(needle))throw new Error(`[integrity-v2668] ${label} missing: ${needle}`)}
function mustAny(src,needles,label){if(!needles.some(x=>src.includes(x)))throw new Error(`[integrity-v2668] ${label} missing`)}

export function runIntegrityPreflightV2668(){
  const server=read('server.js'),app=read('public/app.js'),sw=read('public/sw.js'),candidate=read('public/manual-candidate-v2664.js');

  for(const rel of ['server.js','public/app.js','public/sw.js','public/manual-candidate-v2664.js'])nodeCheck(rel);

  must(server,'MANUAL_RECOVERY_STABLE_V2664_20260904','ManualAB');
  must(server,'MANUAL_CANDIDATE_RECALL_V2665_20260904','CandidateRecall');
  must(server,'CANDIDATE_LIFECYCLE_V2667_20260904','CandidateLifecycle');
  must(server,"app.get('/api/manual-opportunities'",'manual opportunities');
  must(server,"app.get('/api/manual-candidate-archive'",'candidate archive');
  must(server,'manualNotificationEligibleV2665','manual notification gate');

  must(server,'ABC_SHADOW_LEARNING_V265_20260902','Shadow learning marker');
  must(server,'abcShadowLearningForTracker','Shadow adjustment');
  must(server,'abcShadowCapture','Shadow capture');
  must(server,'abcShadowLearningSummary','Shadow summary');
  mustAny(server,['abcTargetDerived','abcReferenceEntryPrice'],'Shadow research target');
  mustAny(server,['shadowLearning,abcCapture','shadowLearning, abcCapture'],'Shadow observability');

  must(server,'TRADFI_LEARNING_V2612_20260902','TradFi learning');
  must(server,'assetClassForSymbolV2612','asset-aware learning');
  must(server,'selectLearningIdeasV2612','learning selector');

  must(server,'manualCleanSnapshot','actual learning snapshot');
  must(server,"/api/actual-trades",'actual trade API');
  mustAny(server,['manualGradeScore','manualOpportunityId'],'actual trade metadata');

  must(server,'PUSH_RECOVERY_V2665_20260904','push recovery');
  must(server,"app.post('/api/test-push'",'general push test');
  must(server,"app.post('/api/test-signal-push'",'Shadow push test');
  must(server,"app.get('/api/push-health'",'push health');
  must(server,'NO_PUSH_SENT','honest push test');
  must(server,'if(target.forceTest===true)return !target.endpoint','test bypass');

  must(server,'V2616_AB_ENTRY_ONLY','formal Shadow A/B policy');
  must(server,'shadowGradeV2616','Shadow grade mapper');
  mustAny(server,["['A','B'].includes(String(grade||'').toUpperCase())","['A','B'].includes(String(row.grade||'').toUpperCase())"],'A/B allow-list');
  mustAny(server,['if(!row||row.candidate===true)return false','row.candidate===true'],'candidate auto-push block');

  must(app,'ensurePushReadyV2665','push subscription repair');
  must(app,'pushKeyMatchesV2665','VAPID repair');
  must(app,'backgroundPushRepairV2665','background repair');
  must(sw,'self.skipWaiting()','SW activation');
  must(sw,'self.clients.claim()','SW claim');
  must(sw,'notify-test-','test notification whitelist');
  must(sw,'shadow-test-','Shadow notification whitelist');

  must(candidate,'CANDIDATE_NARRATIVE_UI_V2666_20260904','candidate narrative');
  must(candidate,'CANDIDATE_LIFECYCLE_V2667_20260904','candidate lifecycle UI');
  must(candidate,'目前狀況','Chinese current status');
  must(candidate,'預計','Chinese forecast');
  must(candidate,'建議','Chinese advice');
  must(candidate,'分後自動歸檔','candidate expiry');

  for(const rel of ['institutional-shadow-v2621-patch.mjs','mentor-edge-v2622-patch.mjs','mentor-ui-v2622-patch.mjs','growth-status-v2626-patch.mjs','advisory-buckets-v26271-patch.mjs','lock-icon-v2620-patch.mjs','workspace-lock-v2621-patch.mjs']){
    if(fs.existsSync(path.join(__dirname,rel)))nodeCheck(rel);
  }

  return {ok:true,marker:MARKER,manualAB:true,candidates:true,shadowLearning:true,tradfiLearning:true,actualLearning:true,pushServer:true,pushClient:true,shadowABOnly:true,candidateAutoPush:false};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(JSON.stringify(runIntegrityPreflightV2668(),null,2));
