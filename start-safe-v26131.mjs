import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREPARE_TIMEOUT_MS = Math.max(10_000, Math.min(90_000, Number(process.env.UI_PREPARE_TIMEOUT_MS || 40_000)));

const HUB_FREEZE_MARKER = 'V26132_MUTATION_LOOP_FIX';

function patchHubFreezeLoop(){
  const publicDir=path.join(__dirname,'public');
  const hubPath=path.join(publicDir,'actual-trade-hub-v2613.js');
  const htmlPath=path.join(publicDir,'index.html');
  let hubOk=false;
  try{
    if(fs.existsSync(hubPath)){
      let js=fs.readFileSync(hubPath,'utf8');
      if(!js.includes(HUB_FREEZE_MARKER)){
        const old="}else{chip.textContent=already?'已建倉':'建倉';chip.disabled=already;chip.classList.toggle('active',already);chip.dataset.symbol=ctx.symbol;chip.dataset.direction=ctx.direction;chip.dataset.source=ctx.source}";
        const fixed="}else{/* "+HUB_FREEZE_MARKER+" */const label=already?'已建倉':'建倉';if(chip.textContent!==label)chip.textContent=label;if(chip.disabled!==already)chip.disabled=already;chip.classList.toggle('active',already);chip.dataset.symbol=ctx.symbol;chip.dataset.direction=ctx.direction;chip.dataset.source=ctx.source}";
        if(js.includes(old)) js=js.replace(old,fixed);
        else console.warn('[startup:v26132] Hub freeze anchor already changed; validating current file.');
        fs.writeFileSync(hubPath,js,'utf8');
      }
      const check=spawnSync(process.execPath,['--check',hubPath],{encoding:'utf8'});
      hubOk=check.status===0;
      if(!hubOk) console.error('[startup:v26132] Hub JS syntax invalid; disabling hub layer:',String(check.stderr||check.stdout||'').trim());
    }
    if(fs.existsSync(htmlPath)){
      let html=fs.readFileSync(htmlPath,'utf8');
      if(hubOk){
        html=html.replace(/\/actual-trade-hub-v2613\.js(?:\?[^\"']*)?/gi,'/actual-trade-hub-v2613.js?v=hub26132');
        html=html.replace(/\/actual-trade-hub-v2613\.css(?:\?[^\"']*)?/gi,'/actual-trade-hub-v2613.css?v=hub26132');
      }else{
        html=html.replace(/<script[^>]+src=[\"']\/actual-trade-hub-v2613\.js(?:\?[^\"']*)?[\"'][^>]*><\/script>\s*/gi,'');
      }
      fs.writeFileSync(htmlPath,html,'utf8');
    }
    if(hubOk) console.log('[startup:v26132] Actual Trade Hub mutation-loop freeze fixed + cache busted.');
  }catch(err){
    console.error('[startup:v26132] Hub safety patch failed; core app will continue:',String(err?.message||err));
  }
}

function fallbackHubAssets(){
  try{
    const publicDir=path.join(__dirname,'public');
    fs.mkdirSync(publicDir,{recursive:true});
    for(const name of ['actual-trade-hub-v2613.js','actual-trade-hub-v2613.css']){
      const src=path.join(__dirname,name),dst=path.join(publicDir,name);
      if(fs.existsSync(src))fs.copyFileSync(src,dst);
    }
    const htmlPath=path.join(publicDir,'index.html');
    if(!fs.existsSync(htmlPath))return;
    let html=fs.readFileSync(htmlPath,'utf8');
    if(!/actual-trade-hub-v2613\.css/i.test(html)){
      html=html.replace('</head>','<link rel="stylesheet" href="/actual-trade-hub-v2613.css?v=hub26131">\n</head>');
    }
    if(!/actual-trade-hub-v2613\.js/i.test(html)){
      html=html.replace('</body>','<script defer src="/actual-trade-hub-v2613.js?v=hub26131"></script>\n</body>');
    }
    fs.writeFileSync(htmlPath,html,'utf8');
    console.warn('[startup:v26131] fallback UI assets installed; server startup will continue.');
  }catch(err){
    console.warn('[startup:v26131] fallback UI copy failed:',String(err?.message||err));
  }
}

function runPrepare(){
  const prepare=path.join(__dirname,'prepare-ui.mjs');
  if(!fs.existsSync(prepare)){
    console.warn('[startup:v26131] prepare-ui.mjs missing; using committed public UI.');
    fallbackHubAssets();
    return false;
  }
  const r=spawnSync(process.execPath,[prepare],{
    cwd:__dirname,
    stdio:'inherit',
    timeout:PREPARE_TIMEOUT_MS,
    env:process.env,
  });
  if(r.status===0)return true;
  const reason=r.error?.code==='ETIMEDOUT'?`timeout>${PREPARE_TIMEOUT_MS}ms`:`exit=${r.status ?? 'unknown'}${r.signal?` signal=${r.signal}`:''}`;
  console.error(`[startup:v26131] UI prepare failed (${reason}). Fail-open: starting server with last valid public UI.`);
  fallbackHubAssets();
  return false;
}

runPrepare();
patchHubFreezeLoop();

const serverPath=path.join(__dirname,'server.js');
if(!fs.existsSync(serverPath)){
  console.error('[startup:v26131] FATAL: server.js not found.');
  process.exit(1);
}

const child=spawn(process.execPath,[serverPath],{cwd:__dirname,stdio:'inherit',env:process.env});
for(const sig of ['SIGTERM','SIGINT']){
  process.on(sig,()=>{try{child.kill(sig)}catch{}});
}
child.on('error',err=>{console.error('[startup:v26131] server spawn failed:',String(err?.message||err));process.exit(1)});
child.on('exit',(code,signal)=>{
  if(signal)console.error(`[startup:v26131] server exited by ${signal}`);
  process.exit(Number.isInteger(code)?code:1);
});
