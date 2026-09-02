import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREPARE_TIMEOUT_MS = Math.max(10_000, Math.min(90_000, Number(process.env.UI_PREPARE_TIMEOUT_MS || 40_000)));
const HOTFIX='V26133_OBSERVATION_FRESH_SETTLE';

function copyHubAndBustCache(){
  const publicDir=path.join(__dirname,'public');
  fs.mkdirSync(publicDir,{recursive:true});
  const src=path.join(__dirname,'actual-trade-hub-v2613.js');
  const dst=path.join(publicDir,'actual-trade-hub-v2613.js');
  if(fs.existsSync(src))fs.copyFileSync(src,dst);
  const htmlPath=path.join(publicDir,'index.html');
  if(!fs.existsSync(htmlPath))return;
  let html=fs.readFileSync(htmlPath,'utf8');
  if(/actual-trade-hub-v2613\.js\?v=[^"']+/i.test(html))html=html.replace(/actual-trade-hub-v2613\.js\?v=[^"']+/ig,'actual-trade-hub-v2613.js?v=hub26133');
  else if(!/actual-trade-hub-v2613\.js/i.test(html))html=html.replace('</body>','<script defer src="/actual-trade-hub-v2613.js?v=hub26133"></script>\n</body>');
  html=html.replace(/app\.js\?v=[^"']+/ig,'app.js?v=1026133');
  fs.writeFileSync(htmlPath,html,'utf8');
}

function patchObservationFreshness(){
  const appPath=path.join(__dirname,'public','app.js');
  if(!fs.existsSync(appPath))return {changed:false,reason:'app.js missing'};
  let src=fs.readFileSync(appPath,'utf8');
  if(src.includes(HOTFIX))return {changed:false,reason:'already'};
  const re=/function renderTestSignals\(d\)\{\s*if\(!d\?\.ok\)return;testSignalsState=d;testSignalsFetchedAt=Date\.now\(\);const rows=d\.rows\|\|\[\],live=d\.liveStats\|\|\{\};if\(lastStatus\)renderCalcPositions\(lastStatus\);/;
  if(!re.test(src))return {changed:false,reason:'anchor missing'};
  const replacement=`function renderTestSignals(d){\n  /* ${HOTFIX}: UI 只顯示 3 分鐘內重新評估的觀察資料；Shadow/績效原始資料不刪。 */\n  if(!d?.ok)return;const now=Date.now(),rawRows=d.rows||[],rows=rawRows.filter(x=>{const at=Date.parse(x?.lastEvaluatedAt||x?.updatedAt||'');return Number.isFinite(at)&&now-at<=180000});testSignalsState={...d,rows};testSignalsFetchedAt=now;const live=d.liveStats||{};if(lastStatus)renderCalcPositions(lastStatus);`;
  src=src.replace(re,replacement);
  fs.writeFileSync(appPath,src,'utf8');
  const chk=spawnSync(process.execPath,['--check',appPath],{cwd:__dirname,encoding:'utf8'});
  if(chk.status!==0)throw new Error(`patched app.js syntax failed: ${chk.stderr||chk.stdout}`);
  return {changed:true,hiddenRule:'>180s'};
}

function installHotfix(){
  try{copyHubAndBustCache();const r=patchObservationFreshness();console.log('[startup:v26133] hotfix ready',r)}
  catch(err){console.error('[startup:v26133] hotfix install failed:',String(err?.message||err))}
}

function fallbackHubAssets(){try{copyHubAndBustCache()}catch(err){console.warn('[startup:v26133] fallback UI copy failed:',String(err?.message||err))}}

function runPrepare(){
  const prepare=path.join(__dirname,'prepare-ui.mjs');
  if(!fs.existsSync(prepare)){console.warn('[startup:v26133] prepare-ui.mjs missing; using committed public UI.');fallbackHubAssets();return false}
  const r=spawnSync(process.execPath,[prepare],{cwd:__dirname,stdio:'inherit',timeout:PREPARE_TIMEOUT_MS,env:process.env});
  if(r.status===0)return true;
  const reason=r.error?.code==='ETIMEDOUT'?`timeout>${PREPARE_TIMEOUT_MS}ms`:`exit=${r.status ?? 'unknown'}${r.signal?` signal=${r.signal}`:''}`;
  console.error(`[startup:v26133] UI prepare failed (${reason}). Fail-open: starting server with last valid public UI.`);fallbackHubAssets();return false;
}

runPrepare();
installHotfix();

const serverPath=path.join(__dirname,'server.js');
if(!fs.existsSync(serverPath)){console.error('[startup:v26133] FATAL: server.js not found.');process.exit(1)}
const child=spawn(process.execPath,[serverPath],{cwd:__dirname,stdio:'inherit',env:process.env});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig)}catch{}});
child.on('error',err=>{console.error('[startup:v26133] server spawn failed:',String(err?.message||err));process.exit(1)});
child.on('exit',(code,signal)=>{if(signal)console.error(`[startup:v26133] server exited by ${signal}`);process.exit(Number.isInteger(code)?code:1)});
