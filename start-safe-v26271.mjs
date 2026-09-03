import fs from 'node:fs';
import path from 'node:path';
import { spawn,spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
function run(file,timeout=30_000){const p=path.join(__dirname,file);if(!fs.existsSync(p)){console.error(`[v26271] missing ${file}`);return false}const r=spawnSync(process.execPath,[p],{cwd:__dirname,stdio:'inherit',timeout,env:process.env});if(r.status!==0){console.error(`[v26271] ${file} failed: ${r.error?.code||r.status}`);return false}return true}
if(!run('prepare-ui.mjs',60_000))process.exit(1);
for(const [f,t] of [['workspace-v2619-patch.mjs',20000],['lock-icon-v2620-patch.mjs',12000],['institutional-shadow-v2621-patch.mjs',20000],['workspace-lock-v2621-patch.mjs',16000],['mentor-edge-v2622-patch.mjs',22000],['mentor-ui-v2622-patch.mjs',14000],['growth-status-v2626-patch.mjs',14000],['advisory-buckets-v26271-patch.mjs',16000]]){if(!run(f,t)){console.error(`[v26271] FATAL ${f}`);process.exit(1)}}
const server=path.join(__dirname,'server.js');if(!fs.existsSync(server)){console.error('[v26271] server.js missing');process.exit(1)}
const child=spawn(process.execPath,[server],{cwd:__dirname,stdio:'inherit',env:process.env});for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig)}catch{}});child.on('error',()=>process.exit(1));child.on('exit',(c)=>process.exit(Number.isInteger(c)?c:1));
