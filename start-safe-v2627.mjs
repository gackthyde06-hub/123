import fs from 'node:fs';
import path from 'node:path';
import { spawn,spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
function run(file,timeout=30_000){const p=path.join(__dirname,file);if(!fs.existsSync(p)){console.error(`[v2627] missing ${file}`);return false}const r=spawnSync(process.execPath,[p],{cwd:__dirname,stdio:'inherit',timeout,env:process.env});if(r.status!==0){console.error(`[v2627] ${file} failed: ${r.error?.code||r.status}`);return false}return true}
if(!run('prepare-ui.mjs',60_000)){console.error('[v2627] FATAL base prepare failed');process.exit(1)}
if(!run('workspace-v2619-patch.mjs',20_000)){console.error('[v2627] FATAL V2619 workspace failed');process.exit(1)}
if(!run('lock-icon-v2620-patch.mjs',12_000)){console.error('[v2627] FATAL V2620 lock failed');process.exit(1)}
if(!run('institutional-shadow-v2621-patch.mjs',20_000)){console.error('[v2627] FATAL V2621 shadow failed');process.exit(1)}
if(!run('workspace-lock-v2621-patch.mjs',16_000)){console.error('[v2627] FATAL V2621 workspace lock failed');process.exit(1)}
if(!run('mentor-edge-v2622-patch.mjs',22_000)){console.error('[v2627] FATAL mentor edge failed');process.exit(1)}
if(!run('mentor-ui-v2622-patch.mjs',14_000)){console.error('[v2627] FATAL mentor UI failed');process.exit(1)}
if(!run('growth-status-v2626-patch.mjs',14_000)){console.error('[v2627] FATAL V2626 growth UI failed');process.exit(1)}
if(!run('advisory-buckets-v2627-patch.mjs',16_000)){console.error('[v2627] FATAL advisory buckets failed');process.exit(1)}
const server=path.join(__dirname,'server.js');if(!fs.existsSync(server)){console.error('[v2627] FATAL server.js missing');process.exit(1)}
const child=spawn(process.execPath,[server],{cwd:__dirname,stdio:'inherit',env:process.env});for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig)}catch{}});child.on('error',e=>{console.error('[v2627] server spawn failed:',String(e?.message||e));process.exit(1)});child.on('exit',(c,s)=>{if(s)console.error('[v2627] server exited by',s);process.exit(Number.isInteger(c)?c:1)});
