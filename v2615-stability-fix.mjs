import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARK='V2615_STABILITY_UI_NOTIFY_DEDUP';
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(`${path.basename(file)} syntax: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(file,src){fs.writeFileSync(file,src,'utf8');check(file)}
function patchServer(){
  const file=path.join(__dirname,'server.js');if(!fs.existsSync(file))throw new Error('server.js missing');let s=fs.readFileSync(file,'utf8');if(s.includes(MARK))return false;
  // Observation rows must be current. Persisted real notifications still keep their independent monitor history.
  s=s.replace("<8*60*60*1000||testMonitorPersistedNotification(t,now)","<5*60*1000||testMonitorPersistedNotification(t,now)");
  // Cross-source A/B Shadow dedup persisted on each Push subscription.
  const helper=`const SHADOW_PUSH_DEDUP_MS_V2615=10*60*1000;\nfunction shadowPushKeyV2615(payload={}){const k=String(payload?.tag||'').toLowerCase();return /^shadow-[ab]-/.test(k)?k:null}\nfunction shadowPushRecentV2615(rec,key,now=Date.now()){if(!key)return false;const map=rec?.v2615ShadowPush&&typeof rec.v2615ShadowPush==='object'?rec.v2615ShadowPush:{};const at=Number(map[key]||0);return at>0&&now-at<SHADOW_PUSH_DEDUP_MS_V2615}\nfunction shadowPushMarkV2615(rec,key,now=Date.now()){if(!key)return;const old=rec?.v2615ShadowPush&&typeof rec.v2615ShadowPush==='object'?rec.v2615ShadowPush:{};const next={};for(const [k,v] of Object.entries(old)){if(now-Number(v)<24*60*60*1000)next[k]=Number(v)}next[key]=now;rec.v2615ShadowPush=next}\n\n`;
  const sendAnchor='async function sendPush(payload, target = {}) {';
  if(!s.includes(sendAnchor))throw new Error('[v2615] sendPush anchor missing');s=s.replace(sendAnchor,helper+sendAnchor);
  s=s.replace('  let eligible=0,sent=0,failed=0,filtered=0;','  let eligible=0,sent=0,failed=0,filtered=0,subDirty=false;');
  const gate=`    if (!subscriptionAllows(rec, target)) {\n      filtered++;\n      keep.push(rec);\n      continue;\n    }\n    eligible++;`;
  const gateNew=`    if (!subscriptionAllows(rec, target)) {\n      filtered++;\n      keep.push(rec);\n      continue;\n    }\n    const shadowKey=shadowPushKeyV2615(payload);\n    if(shadowKey&&shadowPushRecentV2615(rec,shadowKey)){filtered++;keep.push(rec);continue}\n    eligible++;`;
  if(!s.includes(gate))throw new Error('[v2615] sendPush gate anchor missing');s=s.replace(gate,gateNew);
  s=s.replace('      sent++;\n      keep.push(rec);','      sent++;\n      if(shadowKey){shadowPushMarkV2615(rec,shadowKey);subDirty=true}\n      keep.push(rec);');
  s=s.replace('  if (keep.length !== records.length) saveSubRecords(keep);','  if (keep.length !== records.length || subDirty) saveSubRecords(keep);');
  // Manual Shadow loop shares the same persisted dedup map with AUTO.
  s=s.replace('byEndpoint=new Map(subs.map(x=>[x.endpoint,x])),now=Date.now();let dirty=false;','byEndpoint=new Map(subs.map(x=>[x.endpoint,x])),now=Date.now();let dirty=false,subDirty=false;');
  const manualTag="        const tag=[row.symbol,row.direction,row.grade].join(':'),last=Number(pref.lastSent[tag]||0);if(last&&now-last<MANUAL_MODE_NOTIFY_COOLDOWN_MS)continue;";
  const manualTagNew="        const tag=[row.symbol,row.direction,row.grade].join(':'),last=Number(pref.lastSent[tag]||0),shadowKey='shadow-'+String(row.grade||'').toLowerCase()+'-'+String(row.symbol||'').toLowerCase()+'-'+String(row.direction||'').toLowerCase();if(last&&now-last<MANUAL_MODE_NOTIFY_COOLDOWN_MS)continue;if(shadowPushRecentV2615(rec,shadowKey,now))continue;";
  if(s.includes(manualTag))s=s.replace(manualTag,manualTagNew);
  s=s.replace('          pref.lastSent[tag]=now;dirty=true;','          pref.lastSent[tag]=now;shadowPushMarkV2615(rec,shadowKey,now);subDirty=true;dirty=true;');
  s=s.replace('    if(dirty)manualSavePrefs(prefs);','    if(dirty)manualSavePrefs(prefs);if(subDirty)saveSubRecords(subs);');
  s=`// ${MARK}\n`+s;save(file,s);return true;
}
function patchSw(){
  const file=path.join(__dirname,'public','sw.js');if(!fs.existsSync(file))return false;let s=fs.readFileSync(file,'utf8');
  s=s.replace(/function allowedNoticeV2611\(data=\{\}\)\{[\s\S]*?return false;\n\}/,`function allowedNoticeV2611(data={}){\n  const tag=String(data.tag||'').toLowerCase();\n  if(/^trader-[a-z0-9]+-(open|add|reduce|close)-/.test(tag))return true;\n  if(/^shadow-[ab]-/.test(tag))return true;\n  return false;\n}`);
  fs.writeFileSync(file,s,'utf8');check(file);return true;
}
function installUi(){
  const src=path.join(__dirname,'v2615-stability.js'),pub=path.join(__dirname,'public'),dst=path.join(pub,'v2615-stability.js');if(!fs.existsSync(src))throw new Error('v2615-stability.js missing');fs.copyFileSync(src,dst);check(dst);
  const html=path.join(pub,'index.html');if(!fs.existsSync(html))throw new Error('public/index.html missing');let h=fs.readFileSync(html,'utf8');
  h=h.replace(/<script[^>]+src=["']\/v2614-controls\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,'');
  h=h.replace(/<script[^>]+src=["']\/v2615-stability\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,'');
  h=h.replace(/\/app\.js\?v=[^"']+/g,'/app.js?v=102615');
  h=h.replace('</body>','<script defer src="/v2615-stability.js?v=2615"></script>\n</body>');fs.writeFileSync(html,h,'utf8');
}
export function patchV2615(){const out={server:patchServer(),sw:patchSw()};installUi();return out}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchV2615());
