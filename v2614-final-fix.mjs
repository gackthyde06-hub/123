import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARK='V2614_FINAL_NOTIFICATION_UI';
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(`${path.basename(file)} syntax: ${String(r.stderr||r.stdout||'').trim()}`)}
function write(file,src){fs.writeFileSync(file,src,'utf8');check(file)}
function patchServer(){
  const file=path.join(__dirname,'server.js');if(!fs.existsSync(file))throw new Error('server.js missing');
  let s=fs.readFileSync(file,'utf8');if(s.includes(MARK))return false;

  // Unified source mode: MANUAL / AUTO / BOTH. Legacy values migrate to BOTH.
  s=s.replace(/function cleanTestSignalNotifyMode\(value\) \{[\s\S]*?\n\}/,`function cleanTestSignalNotifyMode(value) {\n  const v=String(value||'BOTH').toUpperCase();\n  if(['MANUAL','AUTO','BOTH'].includes(v))return v;\n  return 'BOTH';\n}`);

  // Manual ABC only keeps A/B; C never notifies.
  s=s.replace(/function manualNotifyMode\(v\)\{[^\n]*\}/,`function manualNotifyMode(v){return 'AB'}`);
  s=s.replace(/function manualPrefAllows\(pref,grade\)\{[^\n]*\}/,`function manualPrefAllows(pref,grade){return pref?.enabled===true&&['A','B'].includes(String(grade||'').toUpperCase())}`);

  // Auto strategy pushes are A/B shadow notifications only, with a stable cross-source tag.
  s=s.replace(
    /const \{title:rawTitle,body\}=testLifecycleMessage\(t,explicitTitle,explicitBody,options\.statusLabel\|\|''\);const title=`\$\{tier==='HIGH'\?'高勝率單':'普通單'\}｜\$\{rawTitle\}`;/,
    `const {title:rawTitle,body}=testLifecycleMessage(t,explicitTitle,explicitBody,options.statusLabel||'');const shadowGrade=tier==='HIGH'?'A':'B',title=\`影子\${shadowGrade}單｜\${rawTitle}\`;`
  );
  s=s.replace(/tag:`test-life-\$\{code\}-\$\{t\.symbol\}-\$\{t\.direction\}-\$\{Date\.now\(\)\}`,renotify:true/g,
    "tag:`shadow-${shadowGrade}-${t.symbol}-${t.direction}`,renotify:false");

  // Manual source uses same stable tag as AUTO. BOTH therefore replaces silently instead of ringing twice.
  s=s.replace(/title:'ABC單｜'\+row\.grade\+'級｜'\+row\.symbol\+' '\+\(row\.direction==='SHORT'\?'做空':'做多'\),body,tag:'abc-manual-'\+tag,renotify:false/g,
    "title:'影子'+row.grade+'單｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多'),body,tag:'shadow-'+row.grade+'-'+row.symbol+'-'+row.direction,renotify:false");
  s=s.replace(/title:'手動 '\+row\.grade\+'級｜'\+row\.symbol\+' '\+\(row\.direction==='SHORT'\?'做空':'做多'\),body,tag:'manual-'\+tag,renotify:false/g,
    "title:'影子'+row.grade+'單｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多'),body,tag:'shadow-'+row.grade+'-'+row.symbol+'-'+row.direction,renotify:false");

  // Add one unified preference API and force trader policy to 熬鷹 only.
  const apiAnchor="app.get('/healthz', (_req, res) => {";
  if(s.includes(apiAnchor)){
    const api=`/* ${MARK} */\napp.get('/api/v2614-notify-preferences',(req,res)=>{\n  const endpoint=String(req.query?.endpoint||'');const rec=loadSubRecords().find(x=>x.endpoint===endpoint)||null;const mp=manualPrefRows().find(x=>x.endpoint===endpoint)||null;\n  const mode=cleanTestSignalNotifyMode(rec?.testSignalNotifyMode||((mp?.enabled===true)?'BOTH':'AUTO'));\n  res.json({ok:true,enabled:rec?.testSignalEnabled===true||mp?.enabled===true,mode});\n});\napp.post('/api/v2614-notify-preferences',(req,res)=>{\n  const endpoint=String(req.body?.endpoint||''),enabled=req.body?.enabled!==false,mode=cleanTestSignalNotifyMode(req.body?.mode);if(!endpoint)return res.status(400).json({ok:false,error:'MISSING_ENDPOINT'});\n  const subs=loadSubRecords(),rec=subs.find(x=>x.endpoint===endpoint);if(!rec)return res.status(404).json({ok:false,error:'SUBSCRIPTION_NOT_FOUND'});\n  rec.testSignalEnabled=enabled&&mode!=='MANUAL';rec.testSignalNotifyMode=mode;rec.enabledTraders=[CORE_TRADER_ID];rec.enabledTypes=['OPEN','ADD','REDUCE','CLOSE'];rec.consensusEnabled=false;rec.dailyBriefEnabled=false;rec.preferenceVersion=114;saveSubRecords(subs);\n  const prefs=manualPrefRows();let p=prefs.find(x=>x.endpoint===endpoint);if(!p){p={endpoint,enabled:false,mode:'AB',lastSent:{}};prefs.push(p)}p.enabled=enabled&&mode!=='AUTO';p.mode='AB';p.lastSent=p.lastSent&&typeof p.lastSent==='object'?p.lastSent:{};manualSavePrefs(prefs);\n  res.json({ok:true,enabled,mode});\n});\n\n`;
    s=s.replace(apiAnchor,api+apiAnchor);
  }

  // Tighten subscription policy after previous patches.
  const fnStart=s.indexOf('function subscriptionAllows(rec, target = {}) {');
  const fnEnd=fnStart>=0?s.indexOf('\n}\n\nasync function sendPush',fnStart):-1;
  if(fnStart>=0&&fnEnd>fnStart){
    const replacement=`function subscriptionAllows(rec, target = {}) {\n  // ${MARK}: phone pushes = 熬鷹 order changes OR A/B shadow decisions only.\n  if(target.testSignal===true){\n    if(rec?.testSignalEnabled!==true)return false;\n    const mode=cleanTestSignalNotifyMode(rec?.testSignalNotifyMode);if(mode==='MANUAL')return false;\n    const tier=String(target.testSignalTier||'').toUpperCase();return tier==='HIGH'||tier==='NORMAL';\n  }\n  if(target.abcSignal===true)return false;\n  if(String(target.traderId||'')!==CORE_TRADER_ID)return false;\n  return ['OPEN','ADD','REDUCE','CLOSE'].includes(String(target.eventType||''));\n}`;
    s=s.slice(0,fnStart)+replacement+s.slice(fnEnd+2);
  }

  // Daily brief becomes UI-only; no phone ring.
  s=s.replace("if(rec.dailyBriefEnabled!==true){keep.push(rec);continue}","if(true){keep.push(rec);continue} // V2614 daily brief UI-only");

  s=`// ${MARK}\n`+s;write(file,s);return true;
}

function patchManualUi(){
  const file=path.join(__dirname,'public','manual-mode-ui.js');if(!fs.existsSync(file))return false;
  let s=fs.readFileSync(file,'utf8');if(s.includes(MARK))return false;
  // No C/ALL in recommendations: only shadow-observed A/B.
  s=s.replace("let state={data:null,busy:false,filter:'A'", "let state={data:null,busy:false,filter:'A'");
  s=s.replace(/rows=\(d\.rows\|\|\[\]\)\.filter\(x=>filter==='ALL'\|\|x\.grade===filter\)/,
    "rows=(d.rows||[]).filter(x=>['A','B'].includes(x.grade)&&(filter==='A'||filter==='B'?x.grade===filter:true))");
  s=s.replace(/<div class=\\"manual-grade-summary\\">[\s\S]*?<\/div><div class=\\"manual-abc-shadow\\">/,
    `<div class=\"manual-grade-summary\"><button class=\"${'${filter===\'A\'?\'on\':\'\'}'}\" data-filter=\"A\"><b>A</b><span>${'${d.counts?.A||0}'}</span><small>影子優先</small></button><button class=\"${'${filter===\'B\'?\'on\':\'\'}'}\" data-filter=\"B\"><b>B</b><span>${'${d.counts?.B||0}'}</span><small>影子觀察</small></button></div><div class=\"manual-abc-shadow\">`);
  s=s.replace("${['A','B','C'].map(abcCell).join('')}","${['A','B'].map(abcCell).join('')}");
  // Remove legacy notification selector; unified controller is inserted by v2614-controls.js.
  s=s.replace(/<div class=\\"manual-settings\\">[\s\S]*?<\/div><div class=\\"manual-age\\">/,
    `<div class=\"manual-settings v2614-notify-host\"><div><b>影子通知</b><span>通知來源在下方統一控制；A/B בלבד，不發 C。</span></div></div><div class=\"manual-age\">`);
  s=`// ${MARK}\n`+s;write(file,s);return true;
}

function patchSw(){
  const file=path.join(__dirname,'public','sw.js');if(!fs.existsSync(file))return false;
  let s=fs.readFileSync(file,'utf8');
  // v2611 guard is replaced by stricter v2614 guard where possible.
  s=s.replace(/function allowedNoticeV2611\(data=\{\}\)\{[\s\S]*?return false;\n\}/,
`function allowedNoticeV2611(data={}){\n  const tag=String(data.tag||'').toLowerCase(),text=String(data.title||'')+' '+String(data.body||'');\n  if(tag.startsWith('trader-5075281354358777856-')&&/(open|add|reduce|close)/.test(tag))return true;\n  if(/^shadow-[ab]-/.test(tag)||/影子[AB]單/i.test(text))return true;\n  return false;\n}`);
  fs.writeFileSync(file,s,'utf8');check(file);return true;
}

function installControls(){
  const pub=path.join(__dirname,'public'),src=path.join(__dirname,'v2614-controls.js'),dst=path.join(pub,'v2614-controls.js');
  if(fs.existsSync(src))fs.copyFileSync(src,dst);
  const html=path.join(pub,'index.html');if(!fs.existsSync(html))return;
  let h=fs.readFileSync(html,'utf8');h=h.replace(/<script[^>]+src=["']\/v2614-controls\.js(?:\?[^"']*)?["'][^>]*><\/script>\s*/gi,'');
  h=h.replace('</body>','<script defer src="/v2614-controls.js?v=2614"></script>\n</body>');
  h=h.replace(/\/app\.js\?v=[^"']+/g,'/app.js?v=102614');
  fs.writeFileSync(html,h,'utf8');
}

export function patchV2614(){const out={server:patchServer(),manualUi:patchManualUi(),sw:patchSw()};installControls();return out}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchV2614());
