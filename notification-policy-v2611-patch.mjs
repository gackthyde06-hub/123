import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='NOTIFICATION_POLICY_V2611';
function mustFile(...parts){const f=path.join(__dirname,...parts);if(!fs.existsSync(f))throw new Error(`[v2611-notify] missing ${parts.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2611-notify] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(b===a)return false;fs.writeFileSync(f,a,'utf8');return true}

function patchServer(){
  const f=mustFile('server.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return false;

  // System strategy push: only entry-type HIGH/NORMAL. No status/recovery/target/invalidation noise.
  const tierNeedle="  const tier=String(options.tier||(options.reentry?t.reentryNotificationTier:t.confirmNotificationTier)||t.confirmNotificationTier||testSignalTier(t,{reentry:!!options.reentry}).tier);\n  if(tier==='BLOCKED')return {processed:false,blocked:true,sent:0};\n  const entryType=code==='CONFIRMED'||(options.reentry&&String(options.statusLabel||'').includes('二次確認'));";
  const tierNext="  const tier=String(options.tier||(options.reentry?t.reentryNotificationTier:t.confirmNotificationTier)||t.confirmNotificationTier||testSignalTier(t,{reentry:!!options.reentry}).tier);\n  const entryType=code==='CONFIRMED'||(options.reentry&&String(options.statusLabel||'').includes('二次確認'));\n  if(!entryType){t.lifecycleNotifications[code]=new Date().toISOString();return {processed:true,filteredPolicy:true,sent:0,tier,reason:'V2611_ENTRY_ONLY'};}\n  if(!['HIGH','NORMAL'].includes(tier))return {processed:false,blocked:true,sent:0,tier,reason:'V2611_HIGH_NORMAL_ONLY'};";
  if(s.includes(tierNeedle))s=s.replace(tierNeedle,tierNext);
  else if(!s.includes('V2611_ENTRY_ONLY'))throw new Error('[v2611-notify] test lifecycle policy anchor not found');

  // Make the remaining system-entry push self-explanatory on the lock screen.
  const titleOld="  const {title,body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');";
  const titleNew="  const {title:rawTitle,body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');const title=`${tier==='HIGH'?'高勝率單':'普通單'}｜${rawTitle}`;";
  if(s.includes(titleOld))s=s.replace(titleOld,titleNew);

  // Trader push: real trader order changes only. Pullback/status/consensus alerts stay visible in UI but no longer make the phone ring.
  const subNeedle="function subscriptionAllows(rec, target = {}) {\n  const enabledTraders = new Set(rec?.enabledTraders || []);\n  const enabledTypes = new Set(rec?.enabledTypes || EVENT_TYPES);\n  const isConsensus = target.eventType === 'CONSENSUS';";
  const subNext="function subscriptionAllows(rec, target = {}) {\n  const enabledTraders = new Set(rec?.enabledTraders || []);\n  const enabledTypes = new Set(rec?.enabledTypes || EVENT_TYPES);\n  const isConsensus = target.eventType === 'CONSENSUS';\n  // ${MARKER}: only user-actionable categories may become phone pushes.\n  if(isConsensus||['PULLBACK','DEEP_PULLBACK','INVALIDATION'].includes(String(target.eventType||'')))return false;\n  if(target.abcSignal===true)return rec?.testSignalEnabled===true;";
  if(s.includes(subNeedle))s=s.replace(subNeedle,subNext);
  else if(!s.includes(MARKER))throw new Error('[v2611-notify] subscription policy anchor not found');

  const testModeOld="    if(mode==='HIGH') return tier==='HIGH';\n    if(mode==='HIGH_NORMAL') return tier==='HIGH'||tier==='NORMAL';\n    return tier!=='BLOCKED';";
  const testModeNew="    // V2.6.11 removes generic VALID/status pushes even when legacy ALL was saved.\n    if(mode==='HIGH') return tier==='HIGH';\n    return tier==='HIGH'||tier==='NORMAL';";
  if(s.includes(testModeOld))s=s.replace(testModeOld,testModeNew);

  const traderTypeOld="  const typeAllowed = target.eventType\n    ? enabledTypes.has(target.eventType)\n    : true;\n  return traderAllowed && typeAllowed;";
  const traderTypeNew="  const traderOrderType=['OPEN','ADD','REDUCE','CLOSE'].includes(String(target.eventType||''));\n  const typeAllowed = target.eventType ? traderOrderType&&enabledTypes.has(target.eventType) : true;\n  return traderAllowed && typeAllowed;";
  if(s.includes(traderTypeOld))s=s.replace(traderTypeOld,traderTypeNew);

  // Trader and daily brief taps now always have a deterministic destination.
  s=s.replace("data: { url: event.kind === 'PULLBACK' ? tradingViewLaunchUrl(event.symbol) : '/' },","data: { url: event.kind === 'TRADER' ? '/?page=today' : event.kind === 'PULLBACK' ? tradingViewLaunchUrl(event.symbol) : '/?page=today' },");
  s=s.replace("data:{url:'/'},","data:{url:'/?page=today'},");

  // A/B/C manual-opportunity alerts are the user's ABC alerts: keep them, make the category explicit, and route to the manual list.
  const manualPushOld="await webpush.sendNotification(rec.subscription,JSON.stringify({title:'手動 '+row.grade+'級｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多'),body,tag:'manual-'+tag,renotify:false,data:{url:'/?page=ideas&manual=1'}}),{TTL:180,urgency:row.grade==='A'?'high':'normal'});";
  const manualPushNew="await webpush.sendNotification(rec.subscription,JSON.stringify({title:'ABC單｜'+row.grade+'級｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多'),body,tag:'abc-manual-'+tag,renotify:false,data:{url:'/?page=ideas&manual=1'}}),{TTL:180,urgency:row.grade==='A'?'high':'normal'});";
  if(s.includes(manualPushOld))s=s.replace(manualPushOld,manualPushNew);
  else if(!s.includes("title:'ABC單｜'+row.grade"))throw new Error('[v2611-notify] ABC manual push anchor not found');

  s=`// ${MARKER}: high/normal entry + ABC + trader orders + daily brief only.\n${s}`;
  const changed=save(f,before,s);if(changed)check(f);return changed;
}

function patchSw(){
  const f=mustFile('public','sw.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return false;
  const old=`self.addEventListener('push',event=>{\n  let data={};try{data=event.data?.json()||{}}catch{}\n  const meta=data.data||{},noticeId=meta.noticeId||null,receivedAt=Date.now();\n  const shown=self.registration.showNotification(data.title||'倉位',{`;
  const next=`// ${MARKER}: final client-side guard against old/queued status-noise notifications.\nfunction allowedNoticeV2611(data={}){\n  const tag=String(data.tag||'').toLowerCase(),text=String(data.title||'')+' '+String(data.body||'');\n  if(tag.startsWith('daily-brief-'))return true;\n  if(/^trader-[a-z0-9]+-(open|add|reduce|close)-/.test(tag))return true;\n  if(/^test-life-confirmed-/.test(tag)||/^test-life-reentry-\\d+-/.test(tag))return true;\n  if(/(?:^|[^A-Z])ABC(?:[^A-Z]|$)|影子戰術|ABC單/i.test(text)||tag.includes('abc'))return true;\n  return false;\n}\nfunction noticeRouteV2611(data={},meta={}){const tag=String(data.tag||'').toLowerCase(),text=String(data.title||'')+' '+String(data.body||'');if(tag.startsWith('daily-brief-')||tag.startsWith('trader-'))return '/?page=today';if(tag.includes('abc')||/(?:^|[^A-Z])ABC(?:[^A-Z]|$)|影子戰術|ABC單/i.test(text))return meta.url&&meta.url!=='/'?meta.url:'/?page=monitor';return meta.url||'/?page=monitor'}\nself.addEventListener('push',event=>{\n  let data={};try{data=event.data?.json()||{}}catch{}\n  if(!allowedNoticeV2611(data))return;\n  const meta=data.data||{},noticeId=meta.noticeId||null,receivedAt=Date.now(),route=noticeRouteV2611(data,meta);\n  const shown=self.registration.showNotification(data.title||'倉位',{`;
  if(!s.includes(old))throw new Error('[v2611-notify] service worker push anchor not found');
  s=s.replace(old,next);
  s=s.replace("data:{...meta,url:meta.url||'/'}","data:{...meta,url:route}");
  const changed=save(f,before,s);if(changed)check(f);return changed;
}

export function patchNotificationPolicyV2611(){const files={server:patchServer(),sw:patchSw()};return{changed:Object.values(files).some(Boolean),files,marker:MARKER}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchNotificationPolicyV2611());
