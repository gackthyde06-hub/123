import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARK='UI_POLISH_V26133_STALE_GUARD';

export function patchUiPolishV26133({appPath=path.join(__dirname,'public','app.js')}={}){
  if(!fs.existsSync(appPath))throw new Error(`[v26133-ui] app.js not found: ${appPath}`);
  let s=fs.readFileSync(appPath,'utf8');
  if(s.includes(MARK))return {changed:false,reason:'already'};
  const anchor="if(!d?.ok)return;testSignalsState=d;testSignalsFetchedAt=Date.now();const rows=d.rows||[],live=d.liveStats||{};if(lastStatus)renderCalcPositions(lastStatus);";
  if(!s.includes(anchor))throw new Error('[v26133-ui] renderTestSignals anchor missing');
  const replacement=`if(!d?.ok)return;/* ${MARK} */\n  const nowV26133=Date.now(),maxObservationAgeV26133=10*60*1000;\n  const rows=(d.rows||[]).filter(x=>{const raw=x?.lastEvaluatedAt||x?.updatedAt||x?.stateChangedAt||x?.confirmedAt||x?.createdAt;if(!raw)return true;const ms=Date.parse(raw);return !Number.isFinite(ms)||Math.max(0,nowV26133-ms)<=maxObservationAgeV26133});\n  testSignalsState={...d,rows};testSignalsFetchedAt=Date.now();const live=d.liveStats||{};if(lastStatus)renderCalcPositions(lastStatus);`;
  s=s.replace(anchor,replacement);
  fs.writeFileSync(appPath,s,'utf8');
  return {changed:true};
}
