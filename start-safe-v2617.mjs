import fs from 'node:fs';
import path from 'node:path';
import { spawn,spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
function run(file,timeout=30_000){const p=path.join(__dirname,file);if(!fs.existsSync(p)){console.error(`[v2617] missing ${file}`);return false}const r=spawnSync(process.execPath,[p],{cwd:__dirname,stdio:'inherit',timeout,env:process.env});if(r.status!==0){console.error(`[v2617] ${file} failed: ${r.error?.code||r.status}`);return false}return true}
let ready=run('prepare-ui.mjs',50_000);
if(!ready){console.error('[v2617] full prepare failed; retrying deterministic final layers only.');const pub=path.join(__dirname,'public');fs.mkdirSync(pub,{recursive:true});for(const n of ['actual-trade-hub-v2613.js','actual-trade-hub-v2613.css']){const a=path.join(__dirname,n),b=path.join(pub,n);if(fs.existsSync(a))fs.copyFileSync(a,b)}const n=run('notification-control-v2616-patch.mjs',12_000),u=run('ui-control-v2616-patch.mjs',12_000),r=run('runtime-stability-v2616-patch.mjs',12_000),st=run('ui-stability-v2617-patch.mjs',12_000);ready=n&&u&&r&&st}
if(!ready){console.error('[v2617] FATAL final layer incomplete; refusing half-patched UI.');process.exit(1)}
const server=path.join(__dirname,'server.js');if(!fs.existsSync(server)){console.error('[v2617] FATAL server.js missing');process.exit(1)}
const child=spawn(process.execPath,[server],{cwd:__dirname,stdio:'inherit',env:process.env});for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig)}catch{}});child.on('error',e=>{console.error('[v2617] server spawn failed:',String(e?.message||e));process.exit(1)});child.on('exit',(c,s)=>{if(s)console.error('[v2617] server exited by',s);process.exit(Number.isInteger(c)?c:1)});
