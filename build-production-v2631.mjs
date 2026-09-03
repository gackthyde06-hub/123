import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const ROOT=path.dirname(fileURLToPath(import.meta.url));process.chdir(ROOT);const T0=Date.now();
const t=()=>`${((Date.now()-T0)/1000).toFixed(2)}s`,log=s=>console.log(`[build:V2.6.33 +${t()}] ${s}`),warn=s=>console.warn(`[build:V2.6.33 +${t()}] ${s}`);
function run(rel,label,timeout=180000,fatal=false){const p=path.join(ROOT,rel);if(!fs.existsSync(p)){const m=`SKIP ${label}: ${rel} missing`;if(fatal)throw new Error(m);warn(m);return false}const s=Date.now();log(`RUN ${label}`);const r=spawnSync(process.execPath,[p],{cwd:ROOT,stdio:'inherit',env:process.env,timeout});if(r.error||r.status!==0){const m=`${label} failed (${r.error?.code||r.status||'unknown'})`;if(fatal)throw new Error(m);warn(`NONFATAL ${m}`);return false}log(`OK ${label} (${((Date.now()-s)/1000).toFixed(2)}s)`);return true}
// Only the base is mandatory. User's Railway log already proved this stage succeeds.
run('prepare-ui.mjs','base prepare',240000,true);
// These layers also passed in the real Railway log. Keep them isolated so a stale optional anchor can never take production offline again.
for(const [f,l] of [
 ['workspace-v2619-patch.mjs','actual-trade workspace'],['lock-icon-v2620-patch.mjs','workspace lock icon'],['institutional-shadow-v2621-patch.mjs','institutional shadow'],['workspace-lock-v2621-patch.mjs','independent page lock'],['mentor-edge-v2622-patch.mjs','mentor edge / OOS'],['mentor-ui-v2622-patch.mjs','mentor UI']
])run(f,l,120000,false);
// V2.6.33 does not regex-patch generated manual/growth JS. It installs standalone overlays only.
run('deploy-ui-v2633.mjs','standalone stable UI overlay',30000,false);
// One final server syntax check. If this fails, starting the service would only crash anyway.
const server=path.join(ROOT,'server.js');if(!fs.existsSync(server))throw new Error('server.js missing');const c=spawnSync(process.execPath,['--check',server],{cwd:ROOT,encoding:'utf8',timeout:30000});if(c.status!==0||c.error)throw new Error(`server.js syntax invalid: ${String(c.stderr||c.stdout||c.error?.message||'').trim()}`);
log('BUILD PASS · runtime can start');
