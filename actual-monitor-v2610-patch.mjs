import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='ACTUAL_MONITOR_V2610';

function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2610-actual-monitor] syntax invalid: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(file,before,after){if(before===after)return false;fs.writeFileSync(file,after,'utf8');return true}

function patchServer(){
  const file=path.join(__dirname,'server.js');
  if(!fs.existsSync(file))throw new Error('[v2610-actual-monitor] missing server.js');
  const before=fs.readFileSync(file,'utf8');
  let s=before;
  if(s.includes(MARKER))return false;

  const anchor='function testSignalResponse() {';
  if(!s.includes(anchor))throw new Error('[v2610-actual-monitor] testSignalResponse anchor missing');
  const helper=`/* ${MARKER}
 * Surface user-entered Actual Trades inside /api/test-signals so Monitor can always show them,
 * even after the source opportunity leaves B/observation/history. This is display-only plumbing:
 * trade tracking, TP/SP first-touch and learning rules remain unchanged.
 */
const ACTUAL_MONITOR_HISTORY_MS_V2610=Math.max(60*60*1000,Math.min(72*60*60*1000,Number(process.env.ACTUAL_MONITOR_HISTORY_MS||24*60*60*1000)));
const ACTUAL_MONITOR_ACTIVE_LIMIT_V2610=Math.max(4,Math.min(30,Number(process.env.ACTUAL_MONITOR_ACTIVE_LIMIT||16)));
const ACTUAL_MONITOR_HISTORY_LIMIT_V2610=Math.max(10,Math.min(60,Number(process.env.ACTUAL_MONITOR_HISTORY_LIMIT||30)));
function actualMonitorTimeV2610(x){const v=x?.resultAt||x?.updatedAt||x?.createdAt;const t=v?Date.parse(v):0;return Number.isFinite(t)?t:0}
function actualMonitorViewV2610(x){
  const last=finiteMetric(x?.lastPrice),livePnl=last>0?actualTradePnlAt(x,last):null;
  return {id:x.id,signalKey:x.signalKey||null,notificationId:x.notificationId||null,symbol:x.symbol,direction:x.direction,strategyId:x.strategyId||null,strategyLabel:x.strategyLabel||null,marketRegime:x.marketRegime||null,notificationTier:x.notificationTier||null,createdAt:x.createdAt,updatedAt:x.updatedAt,resultAt:x.resultAt||null,status:x.status,result:x.result||null,firstOutcome:x.firstOutcome||null,firstOutcomeAt:x.firstOutcomeAt||null,entryPrice:x.entryPrice,tp1:x.tp1,tp2:x.tp2,sp1:x.sp1,sp2:x.sp2,margin:x.margin,quantity:x.quantity,leverage:x.leverage,notional:x.notional,lastPrice:x.lastPrice,lastPriceAt:x.lastPriceAt,tp1Hit:x.tp1Hit===true,tp2Hit:x.tp2Hit===true,sp1Hit:x.sp1Hit===true,sp2Hit:x.sp2Hit===true,estimatedPnl:x.estimatedPnl,livePnl:Number.isFinite(Number(livePnl))?Number(livePnl):null,exitPrice:x.exitPrice??null,revisionCount:Number(x.revisionCount||0)};
}
function actualMonitorPayloadV2610(now=Date.now()){
  const all=actualTrades.filter(x=>x?.version==='V10.2.6');
  const active=all.filter(x=>x.status==='ACTIVE').sort((a,b)=>actualMonitorTimeV2610(b)-actualMonitorTimeV2610(a)).slice(0,ACTUAL_MONITOR_ACTIVE_LIMIT_V2610).map(actualMonitorViewV2610);
  const cutoff=now-ACTUAL_MONITOR_HISTORY_MS_V2610;
  const recent=all.filter(x=>x.status!=='ACTIVE'&&actualMonitorTimeV2610(x)>=cutoff).sort((a,b)=>actualMonitorTimeV2610(b)-actualMonitorTimeV2610(a)).slice(0,ACTUAL_MONITOR_HISTORY_LIMIT_V2610).map(actualMonitorViewV2610);
  return {version:'V2.6.10',active,recent,historyMs:ACTUAL_MONITOR_HISTORY_MS_V2610,historyHours:Math.round(ACTUAL_MONITOR_HISTORY_MS_V2610/3600000),activeLimit:ACTUAL_MONITOR_ACTIVE_LIMIT_V2610,historyLimit:ACTUAL_MONITOR_HISTORY_LIMIT_V2610};
}

`;
  s=s.replace(anchor,helper+anchor);

  const payloadAnchor='monitorHistory:testMonitorHistory(40),liveStats:testLiveAggregate()';
  const payloadNext='monitorHistory:testMonitorHistory(40),actualMonitor:actualMonitorPayloadV2610(now),liveStats:testLiveAggregate()';
  if(!s.includes(payloadAnchor))throw new Error('[v2610-actual-monitor] response payload anchor missing');
  s=s.replace(payloadAnchor,payloadNext);

  const changed=save(file,before,s);if(changed)check(file);return changed;
}

export function patchActualMonitorV2610(){return {changed:patchServer(),marker:MARKER}}
