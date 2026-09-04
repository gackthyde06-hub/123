import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const BASE_MARKER='NOTIFICATION_CONTROL_V2616';
const MARKER='PUSH_RECOVERY_V2665_20260904';

function must(...p){
  const f=path.join(__dirname,...p);
  if(!fs.existsSync(f))throw new Error(`[v2665-push] missing ${p.join('/')}`);
  return f;
}
function check(f,label=path.basename(f)){
  const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`[v2665-push] ${label} syntax invalid: ${String(r.stderr||r.stdout||'').trim()}`);
}
function save(f,b,a,label=path.basename(f)){
  if(a===b)return false;
  const ext=path.extname(f)||'.tmp',tmp=`${f}.v2665-${process.pid}-${Date.now()}${ext}`;
  fs.writeFileSync(tmp,a,'utf8');
  try{
    if(ext==='.js'||ext==='.mjs')check(tmp,label);
    fs.renameSync(tmp,f);
  }catch(e){
    try{fs.unlinkSync(tmp)}catch{}
    throw e;
  }
  return true;
}
function replaceOnce(s,a,b,label){
  if(s.includes(b))return s;
  if(!s.includes(a))throw new Error(`[v2665-push] anchor missing: ${label}`);
  return s.replace(a,b);
}
function replaceFunction(src,name,replacement){
  const token=`function ${name}(`,start=src.indexOf(token);
  if(start<0)return src;
  const brace=src.indexOf('{',start);
  if(brace<0)return src;
  let depth=0,quote=null,escape=false,templateExpr=0;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\'){escape=true;continue}
      if(quote==='`'&&ch==='$'&&next==='{'){templateExpr++;i++;continue}
      if(quote==='`'&&templateExpr>0){
        if(ch==='{')templateExpr++;
        else if(ch==='}')templateExpr--;
        continue;
      }
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){
      depth--;
      if(depth===0)return src.slice(0,start)+replacement+src.slice(i+1);
    }
  }
  return src;
}

/* ------------------------------------------------------------------
   First reproduce the intended V2.6.16 final phone policy if this is
   running on the normal v2611-prepared server.
   ------------------------------------------------------------------ */
function applyBaseV2616Server(s){
  if(s.includes(BASE_MARKER))return s;

  const modeAnchor=/function cleanTestSignalNotifyMode\(value\) \{[\s\S]*?\n\}/;
  const mm=s.match(modeAnchor);
  if(!mm)throw new Error('[v2665-push] clean mode anchor missing');
  const helper=`${mm[0]}

/* ${BASE_MARKER}: phone whitelist = 熬鷹 order events + A/B shadow judgement only. */
const NOTICE_DEDUP_FILE_V2616=path.join(DATA_DIR,'notification-dedup-v2616.json');
const NOTICE_DEDUP_MS_V2616=Math.max(15*60_000,Math.min(120*60_000,Number(process.env.NOTICE_DEDUP_MS_V2616||45*60_000)));
function noticeDedupKeyV2616(endpoint,symbol,direction){return [String(endpoint||'').slice(-96),cleanFuturesSymbol(symbol),String(direction||'LONG').toUpperCase()==='SHORT'?'SHORT':'LONG'].join('|')}
function noticeDedupMapV2616(){const x=loadJson(NOTICE_DEDUP_FILE_V2616,{});return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}
function noticeDedupCanSendV2616(endpoint,symbol,direction,now=Date.now()){const m=noticeDedupMapV2616(),at=Number(m[noticeDedupKeyV2616(endpoint,symbol,direction)]||0);return !(at>0&&now-at<NOTICE_DEDUP_MS_V2616)}
function noticeDedupMarkV2616(endpoint,symbol,direction,now=Date.now()){const m=noticeDedupMapV2616(),cut=now-24*60*60_000;for(const [k,v] of Object.entries(m))if(Number(v)<cut)delete m[k];m[noticeDedupKeyV2616(endpoint,symbol,direction)]=now;saveJson(NOTICE_DEDUP_FILE_V2616,m)}
function shadowGradeV2616(tier){return String(tier||'').toUpperCase()==='HIGH'?'A':String(tier||'').toUpperCase()==='NORMAL'?'B':null}
`;
  s=s.replace(mm[0],helper);

  const subRe=/function subscriptionAllows\(rec,\s*target\s*=\s*\{\}\)\s*\{[\s\S]*?\n\}\s*\nasync function sendPush/;
  if(!subRe.test(s))throw new Error('[v2665-push] subscriptionAllows block missing');
  const subBlock=`function subscriptionAllows(rec, target = {}) {
  const enabledTraders=new Set(rec?.enabledTraders||[]),enabledTypes=new Set(rec?.enabledTypes||EVENT_TYPES);
  if(target.forceTest===true)return !target.endpoint||String(rec?.endpoint||'')===String(target.endpoint);
  if(target.testSignal===true){
    if(rec?.testSignalEnabled!==true)return false;
    return ['HIGH','NORMAL'].includes(String(target.testSignalTier||'').toUpperCase());
  }
  const eventType=String(target.eventType||'').toUpperCase();
  if(['OPEN','ADD','REDUCE','CLOSE'].includes(eventType)){
    return String(target.traderId||'')===CORE_TRADER_ID;
  }
  return false;
}

async function sendPush`;
  s=s.replace(subRe,subBlock);

  // Shared dedup for formal AUTO shadow pushes. Keep this insertion tolerant of formatting changes.
  const sendStart=s.indexOf('async function sendPush(payload, target = {}) {');
  if(sendStart<0)throw new Error('[v2665-push] sendPush missing');
  const eligiblePos=s.indexOf('eligible++;',sendStart);
  if(eligiblePos<0||eligiblePos>sendStart+9000)throw new Error('[v2665-push] sendPush eligible++ missing');
  const insertAt=eligiblePos+'eligible++;'.length;
  s=s.slice(0,insertAt)+`
    if(target.shadowDedup===true&&!noticeDedupCanSendV2616(rec.endpoint,target.symbol,target.direction)){filtered++;eligible--;keep.push(rec);continue;}`+s.slice(insertAt);

  const sentPos=s.indexOf('sent++;',insertAt);
  if(sentPos<0||sentPos>insertAt+7000)throw new Error('[v2665-push] sendPush sent++ missing');
  s=s.slice(0,sentPos)+'sent++;if(target.shadowDedup===true)noticeDedupMarkV2616(rec.endpoint,target.symbol,target.direction);'+s.slice(sentPos+'sent++;'.length);

  // AUTO shadow title/tag + strict A/B.
  const titleOld="const {title:rawTitle,body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');const title=`${tier==='HIGH'?'高勝率單':'普通單'}｜${rawTitle}`;";
  const titleFallback="const {title,body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');";
  const titleNew="  const {body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');const grade=shadowGradeV2616(tier);if(!entryType||!grade){t.lifecycleNotifications[code]=new Date().toISOString();return {processed:true,filteredPolicy:true,sent:0,tier,reason:'V2616_AB_ENTRY_ONLY'}};const title=`自動影子｜${grade}級｜${t.symbol} ${t.direction==='SHORT'?'做空':'做多'}`;";
  if(s.includes(titleOld))s=s.replace(titleOld,titleNew);
  else if(s.includes(titleFallback))s=s.replace(titleFallback,titleNew);
  else if(!s.includes('V2616_AB_ENTRY_ONLY'))throw new Error('[v2665-push] lifecycle title anchor missing');

  s=s.replace(/tag:`test-life-\$\{code\}-\$\{t\.symbol\}-\$\{t\.direction\}-\$\{Date\.now\(\)\}`,renotify:true/g,
    "tag:`shadow-${t.symbol}-${t.direction}`,renotify:false");
  s=s.replace(/\},\{testSignal:true,testSignalTier:tier\}\);/,
    "},{testSignal:true,testSignalTier:tier,shadowDedup:true,symbol:t.symbol,direction:t.direction});");

  // MANUAL shadow stays A/B only; candidate C is learning/observation only.
  s=s.replace("function manualNotifyMode(v){const x=String(v||'A').toUpperCase();return ['A','AB','ALL'].includes(x)?x:'A'}",
    "function manualNotifyMode(_v){return 'AB'}");
  s=s.replace("function manualPrefAllows(pref,grade){if(pref?.enabled!==true)return false;const mode=manualNotifyMode(pref.mode);return mode==='ALL'||(mode==='AB'&&['A','B'].includes(grade))||(mode==='A'&&grade==='A')}",
    "function manualPrefAllows(pref,grade){return pref?.enabled===true&&['A','B'].includes(String(grade||'').toUpperCase())}");

  const manualGate="        if(!manualPrefAllows(pref,row.grade)||row.freshness==='STALE'||row.trade?.status==='ACTIVE')continue;";
  if(s.includes(manualGate)&&!s.includes("noticeDedupCanSendV2616(rec.endpoint,row.symbol,row.direction)")){
    s=s.replace(manualGate,manualGate+"\n        if(!noticeDedupCanSendV2616(rec.endpoint,row.symbol,row.direction))continue;");
  }
  s=s.replace(/title:'ABC單｜'\+row\.grade\+'級｜'\+row\.symbol\+' '\+\(row\.direction==='SHORT'\?'做空':'做多'\)/g,
    "title:'手動影子｜'+row.grade+'級｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多')");
  s=s.replace(/title:'手動 '\+row\.grade\+'級｜'\+row\.symbol\+' '\+\(row\.direction==='SHORT'\?'做空':'做多'\)/g,
    "title:'手動影子｜'+row.grade+'級｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多')");
  s=s.replace(/tag:'abc-manual-'\+tag/g,"tag:'shadow-'+row.symbol+'-'+row.direction");
  s=s.replace(/tag:'manual-'\+tag/g,"tag:'shadow-'+row.symbol+'-'+row.direction");

  const manualSent="          pref.lastSent[tag]=now;dirty=true;";
  if(s.includes(manualSent)&&!s.includes("noticeDedupMarkV2616(rec.endpoint,row.symbol,row.direction,now);pref.lastSent")){
    s=s.replace(manualSent,"          noticeDedupMarkV2616(rec.endpoint,row.symbol,row.direction,now);pref.lastSent[tag]=now;dirty=true;");
  }

  // Daily brief remains UI data, no phone noise under current policy.
  s=s.replace("        if(rec.dailyBriefEnabled!==true){keep.push(rec);continue}",
    "        if(true){keep.push(rec);continue} // V2616: Today data stays; phone push disabled");

  s=`// ${BASE_MARKER}\n${s}`;
  return s;
}

/* ------------------------------------------------------------------
   V2.6.65 recovery: user-triggered test must be a real end-to-end test.
   It bypasses A/B/trader preference filters but targets only the current
   subscription endpoint when supplied.
   ------------------------------------------------------------------ */
function applyRecoveryServer(s){
  if(s.includes(MARKER))return s;

  // Existing V2616 block from an earlier rerun: ensure forceTest bypass exists.
  const subNeedle="function subscriptionAllows(rec, target = {}) {\n  const enabledTraders=new Set(rec?.enabledTraders||[]),enabledTypes=new Set(rec?.enabledTypes||EVENT_TYPES);";
  const subNext=subNeedle+"\n  if(target.forceTest===true)return !target.endpoint||String(rec?.endpoint||'')===String(target.endpoint);";
  if(s.includes(subNeedle)&&!s.includes("if(target.forceTest===true)return !target.endpoint")){
    s=s.replace(subNeedle,subNext);
  }

  // Replace general test route. Old route returned ok:true even sent=0.
  const testRe=/app\.post\('\/api\/test-push',[\s\S]*?\n\}\);\s*app\.post\('\/api\/test-pullback-push'/;
  const testMatch=s.match(testRe);
  if(!testMatch)throw new Error('[v2665-push] test-push route block missing');
  const newTests=`app.post('/api/test-push', async (req, res) => {
  try {
    const endpoint=String(req.body?.endpoint||'');
    const result=await sendPush({
      title:'推播測試｜通知通道正常',
      body:'如果你看到這則，Service Worker、VAPID、Subscription、Railway Web Push 都正常。',
      tag:\`notify-test-\${Date.now()}\`,
      renotify:true,
      data:{url:'/?page=monitor'},
    }, {forceTest:true,endpoint:endpoint||null});
    if(result.sent<1)return res.status(503).json({ok:false,error:'NO_PUSH_SENT',...result,subscriptions:loadSubRecords().length});
    res.json({ok:true,...result,subscriptions:loadSubRecords().length});
  } catch (e) {
    res.status(500).json({ok:false,error:String(e?.message||e)});
  }
});

app.post('/api/test-pullback-push'`;
  s=s.replace(testRe,newTests);

  // Replace pullback test body only: it is a diagnostic, not a real PULLBACK policy event.
  const pullRe=/app\.post\('\/api\/test-pullback-push', async \(_req, res\) => \{[\s\S]*?\n\}\);/;
  if(!pullRe.test(s))throw new Error('[v2665-push] test-pullback route missing');
  s=s.replace(pullRe,`app.post('/api/test-pullback-push', async (req, res) => {
  try {
    const endpoint=String(req.body?.endpoint||'');
    const result=await sendPush({
      title:'策略測試｜影子通知通道正常',
      body:'BTCUSDT 做多｜這是測試，不是進場訊號。',
      tag:\`shadow-test-\${Date.now()}\`,
      renotify:true,
      data:{url:'/?page=monitor&testSignal=BTCUSDT&dir=LONG'},
    }, {forceTest:true,endpoint:endpoint||null});
    if(result.sent<1)return res.status(503).json({ok:false,error:'NO_PUSH_SENT',...result,subscriptions:loadSubRecords().length});
    res.json({ok:true,...result,subscriptions:loadSubRecords().length});
  } catch (e) {
    res.status(500).json({ok:false,error:String(e?.message||e)});
  }
});`);

  // Existing system test endpoint must also become a real force-test.
  const signalTestRe=/app\.post\('\/api\/test-signal-push', async \(_req, res\) => \{[\s\S]*?\n\}\);/;
  if(signalTestRe.test(s)){
    s=s.replace(signalTestRe,`app.post('/api/test-signal-push', async (req, res) => {
  try {
    const endpoint=String(req.body?.endpoint||'');
    const result=await sendPush({
      title:'影子測試｜A級通知通道正常',
      body:'BTCUSDT 做多｜測試用 A 級訊號，不會寫入績效或學習樣本。',
      tag:\`shadow-test-\${Date.now()}\`,
      renotify:true,
      data:{url:'/?page=monitor&testSignal=BTCUSDT&dir=LONG'},
    }, {forceTest:true,endpoint:endpoint||null});
    if(result.sent<1)return res.status(503).json({ok:false,error:'NO_PUSH_SENT',...result,subscriptions:loadSubRecords().length});
    res.json({ok:true,...result,subscriptions:loadSubRecords().length});
  } catch (e) {
    res.status(500).json({ok:false,error:String(e?.message||e)});
  }
});`);
  }

  // Read-only health endpoint. Does not expose subscription URLs or VAPID private key.
  const healthAnchor="app.get('/healthz'";
  const healthPos=s.indexOf(healthAnchor);
  if(healthPos<0)throw new Error('[v2665-push] healthz anchor missing');
  const health=`app.get('/api/push-health', (_req,res)=>{
  const records=loadSubRecords(),manual=typeof manualPrefRows==='function'?manualPrefRows():[];
  res.json({
    ok:true,
    version:'V2.6.65',
    subscriptions:records.length,
    autoShadowEnabled:records.filter(x=>x?.testSignalEnabled===true).length,
    manualShadowEnabled:manual.filter(x=>x?.enabled===true).length,
    coreTraderEnabled:records.filter(x=>(x?.enabledTraders||[]).includes(CORE_TRADER_ID)).length,
    vapidPublicFingerprint:String(vapid?.publicKey||'').slice(0,8)+'…'+String(vapid?.publicKey||'').slice(-6),
    tests:{general:'/api/test-push',shadow:'/api/test-signal-push'},
    policy:'CORE_TRADER + FORMAL_SHADOW_A_B; USER_TEST_BYPASS_ONLY'
  });
});

`;
  s=s.slice(0,healthPos)+health+s.slice(healthPos);

  s=`// ${MARKER}\n${s}`;
  return s;
}

function patchServer(){
  const f=must('server.js'),before=fs.readFileSync(f,'utf8');
  let s=before;
  s=applyBaseV2616Server(s);
  s=applyRecoveryServer(s);
  const changed=save(f,before,s,'server.js');
  if(changed)check(f,'server.js');
  return changed;
}

function patchSw(){
  const f=must('public','sw.js'),before=fs.readFileSync(f,'utf8');
  let s=before;

  // First reproduce current V2616 device whitelist when absent.
  if(!s.includes(BASE_MARKER)){
    const whitelist=`// ${BASE_MARKER}: final device-side whitelist.
function allowedNoticeV2616(data={}){
  const tag=String(data.tag||'').toLowerCase(),text=String(data.title||'')+' '+String(data.body||'');
  if(/^trader-/.test(tag)&&/(open|add|reduce|close)/.test(tag))return true;
  if(/^shadow-/.test(tag)&&/(影子|shadow)/i.test(text)&&/[AB]級/i.test(text))return true;
  return false;
}
`;
    if(/function allowedNoticeV2611\(data=\{\}\)\{[\s\S]*?\n\}/.test(s)){
      s=s.replace(/function allowedNoticeV2611\(data=\{\}\)\{[\s\S]*?\n\}/,whitelist.trimEnd());
      s=s.replace('if(!allowedNoticeV2611(data))return;','if(!allowedNoticeV2616(data))return;');
    }else{
      s=s.replace("self.addEventListener('push',event=>{",whitelist+"self.addEventListener('push',event=>{");
      const dataLine="  let data={};try{data=event.data?.json()||{}}catch{}\n";
      if(s.includes(dataLine)&&!s.includes('if(!allowedNoticeV2616(data))return;')){
        s=s.replace(dataLine,dataLine+"  if(!allowedNoticeV2616(data))return;\n");
      }
    }
    s=s.replace('renotify:data.renotify??true,','renotify:data.renotify??false,');
  }

  // Recovery: user-triggered test tags are explicitly allowed.
  if(!s.includes(MARKER)){
    const old="  if(/^trader-/.test(tag)&&/(open|add|reduce|close)/.test(tag))return true;\n  if(/^shadow-/.test(tag)&&/(影子|shadow)/i.test(text)&&/[AB]級/i.test(text))return true;";
    const next="  if(/^notify-test-/.test(tag)||/^shadow-test-/.test(tag))return true;\n  if(/^trader-/.test(tag)&&/(open|add|reduce|close)/.test(tag))return true;\n  if(/^shadow-/.test(tag)&&/(影子|shadow)/i.test(text)&&/[AB]級/i.test(text))return true;";
    if(!s.includes(old))throw new Error('[v2665-push] SW whitelist anchor missing');
    s=s.replace(old,next);

    // Ensure a deployed whitelist takes control immediately instead of waiting behind old SW.
    if(!s.includes('PUSH_RECOVERY_SKIP_WAITING_V2665')){
      s=`// PUSH_RECOVERY_SKIP_WAITING_V2665
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// ${MARKER}
${s}`;
    }
  }

  return save(f,before,s,'sw.js');
}

function patchApp(){
  const f=must('public','app.js'),before=fs.readFileSync(f,'utf8');
  let s=before;
  if(s.includes(MARKER))return false;

  const b64Anchor="function b64ToUint8(base64){const padding='='.repeat((4-base64.length%4)%4),s=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}";
  if(!s.includes(b64Anchor))throw new Error('[v2665-push] b64 helper anchor missing');

  const helpers=`${b64Anchor}
function pushB64UrlV2665(buf){
  try{
    const a=new Uint8Array(buf||new ArrayBuffer(0));let raw='';
    for(const b of a)raw+=String.fromCharCode(b);
    return btoa(raw).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
  }catch{return''}
}
function pushKeyMatchesV2665(sub,publicKey){
  try{
    const current=sub?.options?.applicationServerKey;
    if(!current)return true;
    return pushB64UrlV2665(current)===String(publicKey||'').replace(/=+$/,'');
  }catch{return true}
}
async function ensurePushReadyV2665({forceResubscribe=false,requestPermission=true}={}){
  if(!cfg)cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());
  if(!cfg?.vapidPublicKey)throw new Error('伺服器沒有 VAPID 推播金鑰');
  if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('此瀏覽器不支援 Web Push');

  const reg=await navigator.serviceWorker.register('/sw.js?v=2665',{scope:'/'});
  try{await reg.update()}catch{}

  let permission=Notification.permission;
  if(permission==='default'&&requestPermission)permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('瀏覽器通知權限不是允許');

  let sub=await reg.pushManager.getSubscription();
  const mismatch=sub&&!pushKeyMatchesV2665(sub,cfg.vapidPublicKey);
  if(sub&&(forceResubscribe||mismatch)){
    try{await sub.unsubscribe()}catch{}
    sub=null;
  }
  if(!sub){
    sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:b64ToUint8(cfg.vapidPublicKey)
    });
  }

  const r=await fetch('/api/subscribe',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({
      subscription:sub,
      enabledTraders:loadEnabledTraders(),
      enabledTypes:loadEnabledTypes(),
      consensusEnabled:loadConsensusEnabled(),
      dailyBriefEnabled:loadBriefNotify(),
      testSignalEnabled:loadTestSignalNotify(),
      testSignalNotifyMode:loadTestSignalNotifyMode(),
      dailyBriefIntervalHours:24,
      preferenceVersion:100
    })
  });
  if(!r.ok)throw new Error('訂閱同步失敗 '+r.status);
  try{localStorage.setItem('push-subscription',JSON.stringify(sub.toJSON?.()||sub))}catch{}
  return {reg,sub,mismatch,repaired:mismatch||forceResubscribe};
}
async function sendPushTestV2665(route){
  let ready=await ensurePushReadyV2665({requestPermission:true});
  const fire=async()=>fetch(route,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({endpoint:ready.sub.endpoint})
  }).then(async r=>({r,d:await r.json().catch(()=>({}))}));
  let out=await fire();
  if(!out.r.ok||Number(out.d?.sent||0)<1){
    ready=await ensurePushReadyV2665({forceResubscribe:true,requestPermission:true});
    out=await fire();
  }
  if(!out.r.ok||Number(out.d?.sent||0)<1){
    throw new Error((out.d?.error||'NO_PUSH_SENT')+'｜sent '+Number(out.d?.sent||0)+' / failed '+Number(out.d?.failed||0)+' / subscriptions '+Number(out.d?.subscriptions||0));
  }
  return out.d;
}
async function backgroundPushRepairV2665(){
  try{
    if(Notification.permission!=='granted'||!('serviceWorker'in navigator))return;
    const reg=await navigator.serviceWorker.getRegistration('/');
    const sub=await reg?.pushManager?.getSubscription();
    if(!sub)return;
    if(!cfg)cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());
    if(cfg?.vapidPublicKey&&!pushKeyMatchesV2665(sub,cfg.vapidPublicKey)){
      await ensurePushReadyV2665({forceResubscribe:true,requestPermission:false});
    }
  }catch(e){console.warn('[v2665-push] background repair',String(e?.message||e))}
}
`;
  s=s.replace(b64Anchor,helpers);

  // Replace legacy sync button and tests.
  const subscribeRe=/\$\('subscribe'\)\.onclick=async\(\)=>\{try\{[\s\S]*?\}\};/;
  if(!subscribeRe.test(s))throw new Error('[v2665-push] subscribe handler missing');
  s=s.replace(subscribeRe,`$('subscribe').onclick=async()=>{try{const x=await ensurePushReadyV2665({requestPermission:true});$('msg').textContent=x.repaired?'✅ 推播訂閱已修復並重新同步':'✅ iPhone 通知已同步'}catch(e){$('msg').textContent='❌ '+e.message}};`);

  const testRe=/\$\('test'\)\.onclick=async\(\)=>\{[\s\S]*?\};/;
  if(!testRe.test(s))throw new Error('[v2665-push] test handler missing');
  s=s.replace(testRe,`$('test').onclick=async()=>{try{const d=await sendPushTestV2665('/api/test-push');$('msg').textContent='✅ 測試通知真正送出 · sent '+d.sent}catch(e){$('msg').textContent='❌ 測試失敗：'+e.message}};`);

  const pullRe=/\$\('testPullback'\)\.onclick=async\(\)=>\{[\s\S]*?\};/;
  if(pullRe.test(s)){
    s=s.replace(pullRe,`$('testPullback').onclick=async()=>{try{const d=await sendPushTestV2665('/api/test-pullback-push');$('msg').textContent='✅ 策略測試真正送出 · sent '+d.sent}catch(e){$('msg').textContent='❌ 策略測試失敗：'+e.message}};`);
  }

  // Existing installed subscribers heal silently if server VAPID changed after deployment.
  const tail=`
/* ${MARKER} */
setTimeout(backgroundPushRepairV2665,800);
window.addEventListener('pageshow',()=>setTimeout(backgroundPushRepairV2665,250));
`;
  s+=tail;

  return save(f,before,s,'app.js');
}

export function patchNotificationControlV2616(){
  const files={server:patchServer(),sw:patchSw(),app:patchApp()};
  return {
    changed:Object.values(files).some(Boolean),
    files,
    marker:MARKER,
    testsAreEndToEnd:true,
    staleVapidAutoHeal:true,
    formalPolicyPreserved:true
  };
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchNotificationControlV2616());
