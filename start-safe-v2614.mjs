import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const prep=path.join(__dirname,'prepare-ui.mjs');
if(fs.existsSync(prep)){const r=spawnSync(process.execPath,[prep],{cwd:__dirname,stdio:'inherit',timeout:45000,env:process.env});if(r.status!==0)console.warn('[v2614] prepare-ui fail-open');}
const patch=path.join(__dirname,'v2614-final-fix.mjs');
if(fs.existsSync(patch)){const r=spawnSync(process.execPath,[patch],{cwd:__dirname,stdio:'inherit',timeout:20000,env:process.env});if(r.status!==0)console.error('[v2614] final patch failed; starting last valid server/UI');}
const child=spawn(process.execPath,[path.join(__dirname,'server.js')],{cwd:__dirname,stdio:'inherit',env:process.env});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig)}catch{}});child.on('exit',(c)=>process.exit(Number.isInteger(c)?c:1));child.on('error',e=>{console.error(e);process.exit(1)});
