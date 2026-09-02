import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
function run(name,timeout){const f=path.join(__dirname,name);if(!fs.existsSync(f)){console.warn(`[v2615] ${name} missing`);return false}const r=spawnSync(process.execPath,[f],{cwd:__dirname,stdio:'inherit',timeout,env:process.env});if(r.status!==0){console.error(`[v2615] ${name} failed; fail-open`);return false}return true}
run('prepare-ui.mjs',45000);
run('v2614-final-fix.mjs',20000);
run('v2615-stability-fix.mjs',20000);
const child=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,stdio:'inherit',env:process.env});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig)}catch{}});child.on('exit',c=>process.exit(Number.isInteger(c)?c:1));child.on('error',e=>{console.error(e);process.exit(1)});
