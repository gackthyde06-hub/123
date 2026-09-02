import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='RUNTIME_STABILITY_V2616';
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2616-runtime] ${path.basename(f)} syntax: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;fs.writeFileSync(f,a,'utf8');check(f);return true}
export function patchRuntimeStabilityV2616({serverPath=path.join(__dirname,'server.js'),htmlPath=path.join(__dirname,'public','index.html')}={}){
  let changed=false;
  if(fs.existsSync(serverPath)){
    const before=fs.readFileSync(serverPath,'utf8');let s=before;
    if(!s.includes(MARKER)){
      const anchor="async function getMarketFlow() {";
      if(!s.includes(anchor))throw new Error('[v2616-runtime] getMarketFlow anchor missing');
      const helper=`const ASYNC_DEADLINE_MS_V2616=Math.max(3500,Math.min(15000,Number(process.env.ASYNC_DEADLINE_MS_V2616||8000)));\nfunction deadlineV2616(p,ms=ASYNC_DEADLINE_MS_V2616,label='async'){let t;return Promise.race([Promise.resolve(p),new Promise((_,rej)=>{t=setTimeout(()=>rej(new Error(label+' timeout '+ms+'ms')),ms)})]).finally(()=>clearTimeout(t))}\n\n`;
      s=s.replace(anchor,helper+anchor);
      const marketOld="    const data = await marketFlowCache.inflight;\n    return { ...data, stale:false, cacheAgeMs:0 };";
      const marketNew="    const data = await deadlineV2616(marketFlowCache.inflight,ASYNC_DEADLINE_MS_V2616,'market-flow');\n    return { ...data, stale:false, cacheAgeMs:0 };";
      if(s.includes(marketOld))s=s.replace(marketOld,marketNew);
      const ideaOld="  try{return {...await rankedIdeasCache.inflight,stale:false,cacheAgeMs:0}}catch(e){if(rankedIdeasCache.data&&now-rankedIdeasCache.lastGoodAt<IDEA_STALE_MS)return {...rankedIdeasCache.data,stale:true,error:rankedIdeasCache.error,cacheAgeMs:now-rankedIdeasCache.lastGoodAt};throw e}";
      const ideaNew="  try{return {...await deadlineV2616(rankedIdeasCache.inflight,ASYNC_DEADLINE_MS_V2616,'ranked-ideas'),stale:false,cacheAgeMs:0}}catch(e){if(/timeout/i.test(String(e?.message||e)))rankedIdeasCache.inflight=null;if(rankedIdeasCache.data&&now-rankedIdeasCache.lastGoodAt<IDEA_STALE_MS)return {...rankedIdeasCache.data,stale:true,error:String(e?.message||e),cacheAgeMs:now-rankedIdeasCache.lastGoodAt};return {ok:true,generatedAt:new Date().toISOString(),stale:true,error:String(e?.message||e),radar:realtimeRadarSummary(),analyzed:0,rows:[],errors:1}}";
      if(!s.includes(ideaOld))throw new Error('[v2616-runtime] ranked ideas await anchor missing');
      s=s.replace(ideaOld,ideaNew);
      const manualOld="  const ideas=await getRankedIdeas(),rows=(ideas.rows||[]).slice(0,12).map((x,i)=>manualOpportunityOne(x,i+1,ideas.generatedAt)).sort((a,b)=>(({A:3,B:2,C:1}[b.grade]||0)-({A:3,B:2,C:1}[a.grade]||0))||b.executionScore-a.executionScore||a.rank-b.rank);";
      const manualNew="  let ideas;try{ideas=await deadlineV2616(getRankedIdeas(),ASYNC_DEADLINE_MS_V2616,'manual-opportunities')}catch(e){ideas=rankedIdeasCache.data||{ok:true,generatedAt:new Date().toISOString(),stale:true,error:String(e?.message||e),rows:[]}}const rows=(ideas.rows||[]).slice(0,12).map((x,i)=>manualOpportunityOne(x,i+1,ideas.generatedAt)).sort((a,b)=>(({A:3,B:2,C:1}[b.grade]||0)-({A:3,B:2,C:1}[a.grade]||0))||b.executionScore-a.executionScore||a.rank-b.rank);";
      if(s.includes(manualOld))s=s.replace(manualOld,manualNew);
      s=s.replace("<8*60*60*1000||testMonitorPersistedNotification(t,now)","<5*60*1000||testMonitorPersistedNotification(t,now)");
      s=`// ${MARKER}\n${s}`;
      changed=save(serverPath,before,s)||changed;
    }
  }
  if(fs.existsSync(htmlPath)){
    const before=fs.readFileSync(htmlPath,'utf8');let h=before;
    h=h.replace(/<script[^>]+src=["']\/(?:v2614-controls|v2615-stability)\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,'');
    h=h.replace(/\/app\.js\?v=[^"']+/g,'/app.js?v=102616');
    h=h.replace(/\/manual-mode-ui\.js\?v=[^"']+/g,'/manual-mode-ui.js?v=sg2616');
    h=h.replace(/\/actual-trade-hub-v2613\.js\?v=[^"']+/g,'/actual-trade-hub-v2613.js?v=sg2616');
    if(h!==before){fs.writeFileSync(htmlPath,h,'utf8');changed=true}
  }
  return {changed,marker:MARKER};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchRuntimeStabilityV2616());
