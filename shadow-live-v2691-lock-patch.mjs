import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'LIVE_SHADOW_LOCK_V2691';
const FN = `function applyLiveShadowPolicyV2690(edge, label){
  const L=String(label||edge?.strategyLabel||'');
  const reasons=Array.isArray(edge.hardBlockReasons)?edge.hardBlockReasons.slice():[];
  let capA=!!edge.capA, hardBlock=!!edge.hardBlock, adj=Number(edge.learningAdjustment||0);
  const allow=L.includes('流動性掃盤')||L.includes('順勢回踩');
  if(!allow){
    capA=true; hardBlock=true; adj=Math.min(adj,-4);
    const why='作者鎖：自動只准掃盤反轉／順勢回踩守住';
    if(!reasons.includes(why)) reasons.push(why);
  }else if(L.includes('流動性掃盤')){
    adj=Math.max(adj,1);
  }
  if(hardBlock) capA=true;
  return Object.assign({}, edge, {capA, hardBlock, hardBlockReasons:reasons, learningAdjustment:adj, liveShadowPolicy:'V2.6.91'});
}
`;

export function applyLiveShadowLockV2691Patch(){
  const file=path.join(ROOT,'server.js');
  let s=fs.readFileSync(file,'utf8');
  if(s.includes(MARKER) && s.includes('作者鎖：自動只准掃盤')) return {changed:false,reason:'already'};
  if(s.includes('function applyLiveShadowPolicyV2690(')){
    s=s.replace(/function applyLiveShadowPolicyV2690\([\s\S]*?\n\}\n/, FN);
  }else if(s.includes('function institutionalMentorEdgeV2622(t){')){
    s=s.replace('function institutionalMentorEdgeV2622(t){', FN+'function institutionalMentorEdgeV2622(t){');
  }else{
    throw new Error('mentor edge missing');
  }
  if(!s.includes(MARKER)) s='// '+MARKER+'\n'+s;
  fs.writeFileSync(file,s);
  return {changed:true,version:'V2.6.91'};
}
