import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARK='MAINTENANCE_DIAGNOSTICS_V2618';
const file=path.join(__dirname,'server.js');

function checkJs(p){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`[v2618] syntax invalid: ${String(r.stderr||r.stdout||'').trim()}`);
}
function safeWrite(p,src){
  const tmp=`${p}.v2618-${process.pid}.tmp.js`;
  fs.writeFileSync(tmp,src,'utf8');
  checkJs(tmp);
  fs.renameSync(tmp,p);
}
function inject(){
  if(!fs.existsSync(file))throw new Error('[v2618] server.js missing');
  const before=fs.readFileSync(file,'utf8');
  if(before.includes(MARK))return {changed:false,reason:'already'};
  const code=String.raw`
/* ${MARK}
 * Read-only, sanitized runtime diagnostics for maintenance.
 * Intentionally exposes NO environment values, push endpoints, API keys, VAPID material,
 * DATA_DIR path, cookies, request headers, or user credentials.
 */
function maintenanceErrV2618(v){
  if(v==null||v==='')return null;
  return String(v)
    .replace(/https?:\/\/[^\s"'<>]+/gi,'[url]')
    .replace(/[A-Za-z0-9_=-]{32,}/g,'[redacted]')
    .slice(0,180);
}
function maintenanceCacheV2618(x){
  const now=Date.now();
  if(!x||typeof x!=='object')return {hasData:false,ageMs:null,lastGoodAgeMs:null,error:null,inflight:false};
  const at=Number(x.at||0),good=Number(x.lastGoodAt||0);
  return {
    hasData:Boolean(x.data),
    ageMs:at>0?Math.max(0,now-at):null,
    lastGoodAgeMs:good>0?Math.max(0,now-good):null,
    error:maintenanceErrV2618(x.error),
    inflight:Boolean(x.inflight),
  };
}
function maintenanceAssetsV2618(){
  try{
    const p=path.join(__dirname,'public','index.html');
    const html=fs.readFileSync(p,'utf8');
    const out=[];
    for(const m of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)/gi)){
      const v=String(m[1]||'');
      if(v&&!out.includes(v))out.push(v);
      if(out.length>=40)break;
    }
    return out;
  }catch{return[]}
}
function maintenanceCountV2618(fn){try{return fn()}catch{return null}}
app.get('/api/maintenance-diagnostics',(_req,res)=>{
  const now=Date.now();
  const actual=typeof actualTrades!=='undefined'&&Array.isArray(actualTrades)?actualTrades:[];
  const shadow=typeof shadowPerformance!=='undefined'&&Array.isArray(shadowPerformance)?shadowPerformance:[];
  const manualData=typeof manualOpportunityCache!=='undefined'&&manualOpportunityCache?.data?manualOpportunityCache.data:null;
  const rankedData=typeof rankedIdeasCache!=='undefined'&&rankedIdeasCache?.data?rankedIdeasCache.data:null;
  const testRows=typeof testSignalTrackers!=='undefined'&&testSignalTrackers instanceof Map?[...testSignalTrackers.values()]:[];
  const traderRows=typeof states!=='undefined'&&states instanceof Map?[...states.values()].map(s=>({
    id:String(s?.trader?.id||''),
    name:String(s?.trader?.name||''),
    lastFetch:s?.lastFetch||null,
    lastError:maintenanceErrV2618(s?.lastError),
    positions:maintenanceCountV2618(()=>s.positions?.size??0),
    liveOrders:Array.isArray(s?.latestOrders)?s.latestOrders.length:0,
    baselineReady:Boolean(s?.baselineReady),
  })):[];
  const manualRows=Array.isArray(manualData?.rows)?manualData.rows:[];
  const rankedRows=Array.isArray(rankedData?.rows)?rankedData.rows:[];
  const activeActual=actual.filter(x=>x?.status==='ACTIVE'&&!x?.resultAt&&!['WIN','LOSS','MANUAL','TIMEOUT'].includes(String(x?.result||'').toUpperCase()));
  const resolvedShadow=shadow.filter(x=>x?.status==='RESOLVED');
  const eligibleShadow=resolvedShadow.filter(x=>x?.learningEligible!==false);
  const uiAssets=maintenanceAssetsV2618();
  const moduleFiles=['start-safe-v2618.mjs','start-safe-v2617.mjs','ui-stability-v2617-patch.mjs','runtime-stability-v2616-patch.mjs','ui-control-v2616-patch.mjs','notification-control-v2616-patch.mjs','actual-trade-hub-v2613.js'];
  const modules=moduleFiles.map(name=>({name,present:fs.existsSync(path.join(__dirname,name))}));
  res.set('cache-control','no-store, max-age=0');
  res.set('pragma','no-cache');
  res.set('x-robots-tag','noindex, nofollow, noarchive');
  res.json({
    ok:true,
    maintenance:{
      version:'V2.6.18',
      access:'SANITIZED_READ_ONLY',
      generatedAt:new Date(now).toISOString(),
      note:'No secrets, credentials, environment values, subscription endpoints, or persistent-data paths are exposed.'
    },
    runtime:{
      build:typeof BUILD_VERSION!=='undefined'?String(BUILD_VERSION):null,
      node:process.version,
      uptimeSec:Math.round(process.uptime()),
      pid:process.pid,
    },
    freshness:{
      markPriceUpdatedAt:typeof markPriceUpdatedAt!=='undefined'?markPriceUpdatedAt:null,
      statsRunning:typeof statsRunning!=='undefined'?Boolean(statsRunning):null,
      screenRunning:typeof screenRunning!=='undefined'?Boolean(screenRunning):null,
      screenCursor:typeof screenCursor!=='undefined'?screenCursor:null,
      rankedIdeas:typeof rankedIdeasCache!=='undefined'?maintenanceCacheV2618(rankedIdeasCache):null,
      marketFlow:typeof marketFlowCache!=='undefined'?maintenanceCacheV2618(marketFlowCache):null,
      dailyBrief:typeof dailyBriefCache!=='undefined'?maintenanceCacheV2618(dailyBriefCache):null,
      manualIdeas:typeof manualOpportunityCache!=='undefined'?maintenanceCacheV2618(manualOpportunityCache):null,
    },
    counts:{
      rankedIdeas:rankedRows.length,
      manualA:manualRows.filter(x=>x?.grade==='A').length,
      manualB:manualRows.filter(x=>x?.grade==='B').length,
      manualC:manualRows.filter(x=>x?.grade==='C').length,
      testTrackers:testRows.length,
      actualActive:activeActual.length,
      actualTotal:actual.length,
      shadowTotal:shadow.length,
      shadowResolved:resolvedShadow.length,
      shadowLearningEligible:eligibleShadow.length,
      subscriptions:maintenanceCountV2618(()=>typeof loadSubRecords==='function'?loadSubRecords().length:null),
    },
    traders:traderRows,
    ui:{
      assets:uiAssets,
      duplicateAssets:uiAssets.filter((x,i,a)=>a.indexOf(x)!==i),
      moduleFiles:modules,
    }
  });
});
`;
  const anchors=[
    "app.get('/healthz', (_req, res) => {",
    'app.get("/healthz", (_req, res) => {',
    "app.get('/api/diagnostics',",
    'app.listen(',
  ];
  const anchor=anchors.find(a=>before.includes(a));
  if(!anchor)throw new Error('[v2618] no safe server route anchor found');
  const after=before.replace(anchor,code+'\n'+anchor);
  safeWrite(file,after);
  return {changed:true,anchor};
}
console.log('[v2618]',inject());
