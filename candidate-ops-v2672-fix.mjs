import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_OPS_BOOT_FIX_V2672_20260904';

function nodeCheck(file,label){
  const r=spawnSync(process.execPath,['--check',file],{cwd:__dirname,encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[v2672] ${label} syntax invalid: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function functionRange(src,name){
  const start=src.indexOf(`function ${name}(`);
  if(start<0)return null;
  const brace=src.indexOf('{',start);if(brace<0)return null;
  let depth=0,quote=null,escape=false,lineComment=false,blockComment=false,templateExpr=0;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue}
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\'){escape=true;continue}
      if(quote==='`'&&ch==='$'&&next==='{'){templateExpr++;i++;continue}
      if(quote==='`'&&templateExpr>0){if(ch==='{')templateExpr++;else if(ch==='}')templateExpr--;continue}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++; else if(ch==='}'){depth--;if(depth===0)return {start,end:i+1}}
  }
  return null;
}
function replaceFunction(src,name,code){
  const r=functionRange(src,name);
  if(!r)throw new Error(`[v2672] ${name} missing in V2671 source`);
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}
function assertIncludes(src,needles,label){
  for(const n of needles)if(!src.includes(n))throw new Error(`[v2672] ${label} missing: ${n}`);
}

const VERIFY_FIXED=String.raw`
function verifyABWorkspaceSource(){
  const f=path.join(__dirname,'advisory-buckets-v26271-patch.mjs');
  if(!fs.existsSync(f))throw new Error('[candidate-v2672] A/B workspace source missing');
  const s=fs.readFileSync(f,'utf8');

  if(!s.includes('/api/actual-trades'))throw new Error('[candidate-v2672] A/B actual-trades API missing');
  if(!(s.includes('data-build')||s.includes('data-save-trade')))throw new Error('[candidate-v2672] A/B 建倉 action missing');

  for(const needle of ['TP1','TP2','SP1','SP2','保證金','槓桿']){
    if(!s.includes(needle))throw new Error('[candidate-v2672] A/B 建倉欄 integrity missing: '+needle);
  }
  return true;
}
`;

export async function patchCandidateOpsV2672(){
  const opsPath=path.join(__dirname,'candidate-ops-v2671-patch.mjs');
  const advisoryPath=path.join(__dirname,'advisory-buckets-v26271-patch.mjs');
  if(!fs.existsSync(opsPath))throw new Error('[v2672] candidate-ops-v2671-patch.mjs missing');
  if(!fs.existsSync(advisoryPath))throw new Error('[v2672] advisory-buckets-v26271-patch.mjs missing');

  let ops=fs.readFileSync(opsPath,'utf8');
  const advisory=fs.readFileSync(advisoryPath,'utf8');

  if(!(advisory.includes('data-build')||advisory.includes('data-save-trade')))throw new Error('[v2672] advisory workspace has no recognized build action');
  if(!advisory.includes('/api/actual-trades'))throw new Error('[v2672] advisory workspace lost /api/actual-trades');

  ops=replaceFunction(ops,'verifyABWorkspaceSource',VERIFY_FIXED);
  if(!ops.includes(MARKER))ops=`// ${MARKER}\n${ops}`;
  fs.writeFileSync(opsPath,ops,'utf8');
  nodeCheck(opsPath,'repaired CandidateOps source');

  const mod=await import(`./candidate-ops-v2671-patch.mjs?v2672=${Date.now()}-${Math.random()}`);
  if(typeof mod.patchCandidateOpsV2671!=='function')throw new Error('[v2672] patchCandidateOpsV2671 export missing');
  await mod.patchCandidateOpsV2671();

  const serverPath=path.join(__dirname,'server.js');
  const runtimePath=path.join(__dirname,'public','manual-candidate-v2664.js');
  const server=fs.readFileSync(serverPath,'utf8');
  const runtime=fs.readFileSync(runtimePath,'utf8');

  assertIncludes(server,[
    "app.get('/api/manual-opportunities'",
    "app.get('/api/manual-candidate-history'",
    "app.post('/api/manual-candidate-dismiss'",
    "/api/actual-trades",
    'CANDIDATE_OPS_HISTORY_TRADE_V2671_20260904'
  ],'server CandidateOps stack');
  assertIncludes(runtime,[
    'CANDIDATE_OPS_HISTORY_TRADE_V2671_20260904',
    '候選歷史',
    '實際建倉資料',
    'data-cand-save-trade'
  ],'candidate runtime');

  nodeCheck(serverPath,'generated server.js');
  nodeCheck(runtimePath,'generated candidate runtime');

  return {changed:true,version:'V2.6.72',repairedSelectorMismatch:true,manualOpportunities:true,candidateHistory:true,candidateTrade:true,actualTrades:true};
}
if(import.meta.url===`file://${process.argv[1]}`)patchCandidateOpsV2672().then(x=>console.log(x)).catch(e=>{console.error(e?.stack||e);process.exit(1)});
