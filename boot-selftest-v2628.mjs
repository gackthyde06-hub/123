import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'v2628-boot-'));
for(const f of ['start-safe.mjs','start-safe-v2627.mjs']) fs.copyFileSync(path.join(ROOT,f),path.join(tmp,f));
fs.mkdirSync(path.join(tmp,'public'),{recursive:true});
const good="console.log('dummy server');\n";fs.writeFileSync(path.join(tmp,'server.js'),good);
fs.writeFileSync(path.join(tmp,'public','app.js'),"console.log('app')\n");
fs.writeFileSync(path.join(tmp,'prepare-ui.mjs'),"import fs from 'node:fs';fs.writeFileSync('server.js','this is invalid !!!');process.exit(1)\n");
fs.writeFileSync(path.join(tmp,'workspace-v2619-patch.mjs'),"process.exit(1)\n");
function run(entry){return spawnSync(process.execPath,[path.join(tmp,entry)],{cwd:tmp,encoding:'utf8',env:{...process.env,V2628_PREFLIGHT_ONLY:'1'}})}
let r=run('start-safe.mjs');if(r.status!==0)throw new Error('stable launcher preflight failed '+r.stderr);
if(fs.readFileSync(path.join(tmp,'server.js'),'utf8')!==good)throw new Error('rollback did not restore server');
r=run('start-safe-v2627.mjs');if(r.status!==0)throw new Error('legacy alias preflight failed '+r.stderr);
console.log('V2.6.28 BOOT SELFTEST PASS');
