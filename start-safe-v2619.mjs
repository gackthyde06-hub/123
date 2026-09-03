import fs from 'node:fs';
import path from 'node:path';
import { spawn,spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
function run(file,timeout=30_000){
  const p=path.join(__dirname,file);
  if(!fs.existsSync(p)){console.error(`[v2619] missing ${file}`);return false}
  const r=spawnSync(process.execPath,[p],{cwd:__dirname,stdio:'inherit',timeout,env:process.env});
  if(r.status!==0){console.error(`[v2619] ${file} failed: ${r.error?.code||r.status}`);return false}
  return true;
}
const prepared=run('prepare-ui.mjs',60_000);
if(!prepared){console.error('[v2619] FATAL base prepare failed; refusing partial UI');process.exit(1)}
const workspace=run('workspace-v2619-patch.mjs',20_000);
if(!workspace){console.error('[v2619] FATAL workspace patch failed; refusing partial UI');process.exit(1)}
const server=path.join(__dirname,'server.js');
if(!fs.existsSync(server)){console.error('[v2619] FATAL server.js missing');process.exit(1)}
const child=spawn(process.execPath,[server],{cwd:__dirname,stdio:'inherit',env:process.env});
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig)}catch{}});
child.on('error',e=>{console.error('[v2619] server spawn failed:',String(e?.message||e));process.exit(1)});
child.on('exit',(c,s)=>{if(s)console.error('[v2619] server exited by',s);process.exit(Number.isInteger(c)?c:1)});
