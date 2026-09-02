import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='MANUAL_MODE_V263_20260902';

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`[manual-v263] ${label} syntax invalid: ${String(r.stderr||r.stdout||'').trim()}`);
}
function writeChecked(file,src,label){
  const tmp=`${file}.v263-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function replaceOnce(src,oldText,newText,label){
  if(!src.includes(oldText))throw new Error(`[manual-v263] anchor missing: ${label}`);
  return src.replace(oldText,newText);
}

export function patchManualModeV263({serverPath=path.join(__dirname,'server.js')}={}){
  let src=fs.readFileSync(serverPath,'utf8');
  if(src.includes(MARKER))return {changed:false,reason:'already-applied'};
  const helperCode=fs.readFileSync(path.join(__dirname,'manual-mode-server-code.inc'),'utf8').trimEnd()+'\n\n';
  const aggregateCode=fs.readFileSync(path.join(__dirname,'manual-mode-aggregate-code.inc'),'utf8').trimEnd();

  const helperAnchor="app.get('/api/market-flow', async (_req, res) => {";
  src=replaceOnce(src,helperAnchor,helperCode+helperAnchor,'manual backend insertion');

  const dedupOld="const signalKey=String(body.signalKey||'').slice(0,100)||null;if(signalKey){const existing=actualTrades.find(x=>x?.version==='V10.2.6'&&x.status==='ACTIVE'&&x.signalKey===signalKey);if(existing)return {error:'這筆訊號已有追蹤中的實際建倉',existingId:existing.id}}";
  const dedupNew="const signalKey=String(body.signalKey||'').slice(0,100)||null,manualOpportunityId=String(body.manualOpportunityId||'').slice(0,160)||null;if(signalKey){const existing=actualTrades.find(x=>x?.version==='V10.2.6'&&x.status==='ACTIVE'&&x.signalKey===signalKey);if(existing)return {error:'這筆訊號已有追蹤中的實際建倉',existingId:existing.id}}if(manualOpportunityId){const existing=actualTrades.find(x=>x?.version==='V10.2.6'&&x.status==='ACTIVE'&&x.manualOpportunityId===manualOpportunityId);if(existing)return {error:'這個手動機會已有追蹤中的實際建倉',existingId:existing.id}}";
  src=replaceOnce(src,dedupOld,dedupNew,'manual actual dedup');

  const metaOld="source:'MANUAL_ACTUAL',strategyId:";
  const metaNew="source:'MANUAL_ACTUAL',manualMode:body.manualMode===true,manualGrade:['A','B','C'].includes(String(body.manualGrade||'').toUpperCase())?String(body.manualGrade).toUpperCase():null,manualGradeScore:finiteMetric(body.manualGradeScore),manualGradeAt:String(body.manualGradeAt||'').slice(0,40)||null,manualOpportunityId,manualReasons:Array.isArray(body.manualReasons)?body.manualReasons.slice(0,8).map(x=>String(x).slice(0,100)):[],manualSnapshot:manualCleanSnapshot(body.manualSnapshot),manualRank:finiteMetric(body.manualSnapshot?.rank),manualStructureState:String(body.manualSnapshot?.structureState||'').slice(0,30)||null,manualStructureHealth:finiteMetric(body.manualSnapshot?.structureHealth),manualShadowHitRate:finiteMetric(body.manualSnapshot?.shadowHitRate),manualShadowProfitFactor:finiteMetric(body.manualSnapshot?.shadowProfitFactor),manualRr:finiteMetric(body.manualSnapshot?.rr),strategyId:";
  src=replaceOnce(src,metaOld,metaNew,'manual actual metadata');

  const aggRe=/function actualTradeAggregate\(\)\{[\s\S]*?\n\}\n\nconst shadowActiveSymbols=/;
  if(!aggRe.test(src))throw new Error('[manual-v263] actualTradeAggregate anchor missing');
  src=src.replace(aggRe,aggregateCode+'\n\nconst shadowActiveSymbols=');

  const csvNeedle="'leverage','notional'";
  if(src.includes(csvNeedle))src=src.replace(csvNeedle,"'leverage','manualMode','manualGrade','manualGradeScore','manualGradeAt','manualOpportunityId','manualRank','manualStructureState','manualStructureHealth','manualShadowHitRate','manualShadowProfitFactor','manualRr','notional'");

  src=replaceOnce(src,'    testSignalTimer = setTimeout(testSignalLoop, 8000);','    testSignalTimer = setTimeout(testSignalLoop, 8000);\n    manualOpportunityTimer=setTimeout(manualOpportunityLoop,12000);','manual timer start');
  src=replaceOnce(src,'  if (testSignalTimer) clearTimeout(testSignalTimer);','  if (testSignalTimer) clearTimeout(testSignalTimer);\n  if (manualOpportunityTimer) clearTimeout(manualOpportunityTimer);','manual timer stop');

  writeChecked(serverPath,src,'server.js');
  return {changed:true};
}

if(import.meta.url===`file://${process.argv[1]}`)patchManualModeV263();
