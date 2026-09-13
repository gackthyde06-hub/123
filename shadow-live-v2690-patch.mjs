import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'LIVE_SHADOW_POLICY_V2690';
const HELPER = `
function applyLiveShadowPolicyV2690(edge, label){
  const L=String(label||edge?.strategyLabel||'');
  const reasons=Array.isArray(edge.hardBlockReasons)?edge.hardBlockReasons.slice():[];
  let capA=!!edge.capA, hardBlock=!!edge.hardBlock, adj=Number(edge.learningAdjustment||0);
  if(L.includes('突破回測')){
    capA=true; hardBlock=true; adj=Math.min(adj,-3);
    if(!reasons.includes('即時影子：突破回測期望為負，禁止A/高勝率通知')) reasons.push('即時影子：突破回測期望為負，禁止A/高勝率通知');
  }else if(L.includes('動能')){
    capA=true;
    if(!reasons.includes('即時影子：動能續攻期望偏薄，限制A')) reasons.push('即時影子：動能續攻期望偏薄，限制A');
  }else if(L.includes('流動性掃盤')){
    adj=Math.max(adj,1);
  }
  if(hardBlock) capA=true;
  return Object.assign({}, edge, {capA, hardBlock, hardBlockReasons:reasons, learningAdjustment:adj, liveShadowPolicy:'V2.6.90'});
}
`;

const OLD_RETURN = '  return{version:SHADOW_MENTOR_VERSION_V2622,edgeScore:score,confidenceScore,level,sample:Number(stats.sample||0),stats,strategyStats,stateAdjustment:stateAdj,strategyAdjustment:strategyAdj,learningAdjustment,cost,costGateA:cost.aGate,costGateB:cost.bGate,stability,concentration,forward,trials,capA,hardBlock:hardBlockReasons.length>0,hardBlockReasons,poorStrategy,severeStrategy,assetClass:asset,regime,strategyId:String(features.strategyId||\'\'),strategyLabel:features.strategyLabel,direction,watchEligible,frozenTrain:true,forwardStartAt:SHADOW_MENTOR_STATE_V2622.startAt}';
const NEW_RETURN = '  return applyLiveShadowPolicyV2690({version:SHADOW_MENTOR_VERSION_V2622,edgeScore:score,confidenceScore,level,sample:Number(stats.sample||0),stats,strategyStats,stateAdjustment:stateAdj,strategyAdjustment:strategyAdj,learningAdjustment,cost,costGateA:cost.aGate,costGateB:cost.bGate,stability,concentration,forward,trials,capA,hardBlock:hardBlockReasons.length>0,hardBlockReasons,poorStrategy,severeStrategy,assetClass:asset,regime,strategyId:String(features.strategyId||\'\'),strategyLabel:features.strategyLabel,direction,watchEligible,frozenTrain:true,forwardStartAt:SHADOW_MENTOR_STATE_V2622.startAt}, features.strategyLabel)';

export function applyLiveShadowV2690Patch(){
  const file = path.join(ROOT, 'server.js');
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes(MARKER) && s.includes('applyLiveShadowPolicyV2690(') && s.includes('return applyLiveShadowPolicyV2690')) {
    return { changed:false, reason:'already' };
  }
  if (!s.includes('function institutionalMentorEdgeV2622(t){')) {
    throw new Error('institutionalMentorEdgeV2622 missing');
  }
  if (!s.includes(OLD_RETURN)) {
    throw new Error('mentor return fingerprint missing');
  }
  if (!s.includes('function applyLiveShadowPolicyV2690')) {
    s = s.replace('function institutionalMentorEdgeV2622(t){', HELPER + 'function institutionalMentorEdgeV2622(t){');
  }
  s = s.replace(OLD_RETURN, NEW_RETURN);
  if (!s.includes(MARKER)) s = '// ' + MARKER + '\n' + s;
  fs.writeFileSync(file, s);
  return { changed:true, version:'V2.6.90' };
}
