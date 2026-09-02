import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='NOTIFICATION_CONTROL_V2616';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v2616-notify] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2616-notify] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const tmp=`${f}.v2616-${process.pid}-${Date.now()}.tmp.js`;fs.writeFileSync(tmp,a,'utf8');try{check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function replaceOnce(s,a,b,label){if(!s.includes(a))throw new Error(`[v2616-notify] anchor missing: ${label}`);return s.replace(a,b)}

function patchServer(){
  const f=must('server.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return false;

  // Shared 45-minute episode ledger: MANUAL and AUTO shadow paths cannot both ring for the same symbol+direction.
  const modeAnchor=/function cleanTestSignalNotifyMode\(value\) \{[\s\S]*?\n\}/;
  const mm=s.match(modeAnchor);if(!mm)throw new Error('[v2616-notify] clean mode anchor missing');
  const helper=`${mm[0]}\n\n/* ${MARKER}: phone whitelist = 熬鷹 order events + A/B shadow judgement only. */\nconst NOTICE_DEDUP_FILE_V2616=path.join(DATA_DIR,'notification-dedup-v2616.json');\nconst NOTICE_DEDUP_MS_V2616=Math.max(15*60_000,Math.min(120*60_000,Number(process.env.NOTICE_DEDUP_MS_V2616||45*60_000)));\nfunction noticeDedupKeyV2616(endpoint,symbol,direction){return [String(endpoint||'').slice(-96),cleanFuturesSymbol(symbol),String(direction||'LONG').toUpperCase()==='SHORT'?'SHORT':'LONG'].join('|')}\nfunction noticeDedupMapV2616(){const x=loadJson(NOTICE_DEDUP_FILE_V2616,{});return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}\nfunction noticeDedupCanSendV2616(endpoint,symbol,direction,now=Date.now()){const m=noticeDedupMapV2616(),at=Number(m[noticeDedupKeyV2616(endpoint,symbol,direction)]||0);return !(at>0&&now-at<NOTICE_DEDUP_MS_V2616)}\nfunction noticeDedupMarkV2616(endpoint,symbol,direction,now=Date.now()){const m=noticeDedupMapV2616(),cut=now-24*60*60_000;for(const [k,v] of Object.entries(m))if(Number(v)<cut)delete m[k];m[noticeDedupKeyV2616(endpoint,symbol,direction)]=now;saveJson(NOTICE_DEDUP_FILE_V2616,m)}\nfunction shadowGradeV2616(tier){return String(tier||'').toUpperCase()==='HIGH'?'A':String(tier||'').toUpperCase()==='NORMAL'?'B':null}\n`;
  s=s.replace(mm[0],helper);

  // Replace the whole subscription gate: all phone noise is denied unless it is an A/B auto shadow entry or a 熬鷹 order event.
  const subRe=/function subscriptionAllows\(rec, target = \{\}\) \{[\s\S]*?\n\}\n\nasync function sendPush/;
  if(!subRe.test(s))throw new Error('[v2616-notify] subscriptionAllows block missing');
  const subBlock=`function subscriptionAllows(rec, target = {}) {\n  const enabledTraders=new Set(rec?.enabledTraders||[]),enabledTypes=new Set(rec?.enabledTypes||EVENT_TYPES);\n  if(target.testSignal===true){\n    if(rec?.testSignalEnabled!==true)return false;\n    return ['HIGH','NORMAL'].includes(String(target.testSignalTier||'').toUpperCase());\n  }\n  const eventType=String(target.eventType||'').toUpperCase();\n  if(['OPEN','ADD','REDUCE','CLOSE'].includes(eventType)){\n    return String(target.traderId||'')===CORE_TRADER_ID;\n  }\n  return false;\n}\n\nasync function sendPush`;
  s=s.replace(subRe,subBlock);

  // Auto shadow push: A/B naming, one canonical tag, cross-path dedup before and after a successful send.
  const sendStart=s.indexOf('async function sendPush(payload, target = {}) {');
  if(sendStart<0)throw new Error('[v2616-notify] sendPush missing');
  const loopNeedle='  for (const rec of records) {\n    if (!subscriptionAllows(rec, target)) {';
  const loopPos=s.indexOf(loopNeedle,sendStart);if(loopPos<0)throw new Error('[v2616-notify] sendPush loop anchor missing');
  s=s.slice(0,loopPos)+loopNeedle.replace("    if (!subscriptionAllows(rec, target)) {","    if (!subscriptionAllows(rec, target)) {")+s.slice(loopPos+loopNeedle.length);
  const afterFilterNeedle='      continue;\n    }';
  const filterEnd=s.indexOf(afterFilterNeedle,loopPos);if(filterEnd<0)throw new Error('[v2616-notify] sendPush filter end missing');
  const insertAt=filterEnd+afterFilterNeedle.length;
  s=s.slice(0,insertAt)+`\n    if(target.shadowDedup===true&&!noticeDedupCanSendV2616(rec.endpoint,target.symbol,target.direction)){filtered++;keep.push(rec);continue;}`+s.slice(insertAt);
  const sentPos=s.indexOf('sent++;',insertAt);if(sentPos<0||sentPos>insertAt+6000)throw new Error('[v2616-notify] sendPush sent++ missing');
  s=s.slice(0,sentPos)+'sent++;if(target.shadowDedup===true)noticeDedupMarkV2616(rec.endpoint,target.symbol,target.direction);'+s.slice(sentPos+'sent++;'.length);

  // Force lifecycle push to entry-only A/B and make AUTO share the same dedup episode with MANUAL.
  const titleOld="  const {title:rawTitle,body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');const title=`${tier==='HIGH'?'高勝率單':'普通單'}｜${rawTitle}`;";
  const titleFallback="  const {title,body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');";
  const titleNew="  const {body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');const grade=shadowGradeV2616(tier);if(!entryType||!grade){t.lifecycleNotifications[code]=new Date().toISOString();return {processed:true,filteredPolicy:true,sent:0,tier,reason:'V2616_AB_ENTRY_ONLY'}};const title=`自動影子｜${grade}級｜${t.symbol} ${t.direction==='SHORT'?'做空':'做多'}`;";
  if(s.includes(titleOld))s=s.replace(titleOld,titleNew);else if(s.includes(titleFallback))s=s.replace(titleFallback,titleNew);else if(!s.includes('V2616_AB_ENTRY_ONLY'))throw new Error('[v2616-notify] lifecycle title anchor missing');
  s=s.replace(/tag:`test-life-\$\{code\}-\$\{t\.symbol\}-\$\{t\.direction\}-\$\{Date\.now\(\)\}`,renotify:true/g,"tag:`shadow-${t.symbol}-${t.direction}`,renotify:false");
  s=s.replace(/\},\{testSignal:true,testSignalTier:tier\}\);/,"},{testSignal:true,testSignalTier:tier,shadowDedup:true,symbol:t.symbol,direction:t.direction});");

  // Manual shadow: C is learning-only. User-facing MANUAL path is A/B only and shares the exact same episode key/tag as AUTO.
  s=s.replace("function manualNotifyMode(v){const x=String(v||'A').toUpperCase();return ['A','AB','ALL'].includes(x)?x:'A'}","function manualNotifyMode(_v){return 'AB'}");
  s=s.replace("function manualPrefAllows(pref,grade){if(pref?.enabled!==true)return false;const mode=manualNotifyMode(pref.mode);return mode==='ALL'||(mode==='AB'&&['A','B'].includes(grade))||(mode==='A'&&grade==='A')}","function manualPrefAllows(pref,grade){return pref?.enabled===true&&['A','B'].includes(String(grade||'').toUpperCase())}");
  const manualGate="        if(!manualPrefAllows(pref,row.grade)||row.freshness==='STALE'||row.trade?.status==='ACTIVE')continue;";
  if(s.includes(manualGate))s=s.replace(manualGate,manualGate+"\n        if(!noticeDedupCanSendV2616(rec.endpoint,row.symbol,row.direction))continue;");
  s=s.replace(/title:'ABC單｜'\+row\.grade\+'級｜'\+row\.symbol\+' '\+\(row\.direction==='SHORT'\?'做空':'做多'\)/g,"title:'手動影子｜'+row.grade+'級｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多')");
  s=s.replace(/title:'手動 '\+row\.grade\+'級｜'\+row\.symbol\+' '\+\(row\.direction==='SHORT'\?'做空':'做多'\)/g,"title:'手動影子｜'+row.grade+'級｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多')");
  s=s.replace(/tag:'abc-manual-'\+tag/g,"tag:'shadow-'+row.symbol+'-'+row.direction");
  s=s.replace(/tag:'manual-'\+tag/g,"tag:'shadow-'+row.symbol+'-'+row.direction");
  const manualSent="          pref.lastSent[tag]=now;dirty=true;";
  if(s.includes(manualSent))s=s.replace(manualSent,"          noticeDedupMarkV2616(rec.endpoint,row.symbol,row.direction,now);pref.lastSent[tag]=now;dirty=true;");

  // Daily brief still updates the Today page, but never rings the phone in this policy.
  s=s.replace("        if(rec.dailyBriefEnabled!==true){keep.push(rec);continue}","        if(true){keep.push(rec);continue} // V2616: Today data stays; phone push disabled");

  s=`// ${MARKER}\n${s}`;
  const changed=save(f,before,s);return changed;
}

function patchSw(){
  const f=must('public','sw.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return false;
  // v2611 may already be present. Replace its whitelist; otherwise inject a fresh one before the push listener.
  const whitelist=`// ${MARKER}: final device-side whitelist.\nfunction allowedNoticeV2616(data={}){const tag=String(data.tag||'').toLowerCase(),text=String(data.title||'')+' '+String(data.body||'');if(/^trader-/.test(tag)&&/(open|add|reduce|close)/.test(tag))return true;if(/^shadow-/.test(tag)&&/(影子|shadow)/i.test(text)&&/[AB]級/i.test(text))return true;return false}\n`;
  if(/function allowedNoticeV2611\(data=\{\}\)\{[\s\S]*?\n\}/.test(s)){
    s=s.replace(/function allowedNoticeV2611\(data=\{\}\)\{[\s\S]*?\n\}/,whitelist.trimEnd());
    s=s.replace('if(!allowedNoticeV2611(data))return;','if(!allowedNoticeV2616(data))return;');
  }else{
    s=s.replace("self.addEventListener('push',event=>{",whitelist+"self.addEventListener('push',event=>{");
    s=s.replace("  let data={};try{data=event.data?.json()||{}}catch{}\n", "  let data={};try{data=event.data?.json()||{}}catch{}\n  if(!allowedNoticeV2616(data))return;\n");
  }
  // Canonical shadow tags replace rather than renotify if a queued duplicate races in.
  s=s.replace('renotify:data.renotify??true,','renotify:data.renotify??false,');
  const changed=save(f,before,s);return changed;
}

export function patchNotificationControlV2616(){const files={server:patchServer(),sw:patchSw()};return {changed:Object.values(files).some(Boolean),files,marker:MARKER}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchNotificationControlV2616());
