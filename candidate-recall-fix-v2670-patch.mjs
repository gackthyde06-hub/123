import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_REAL_RECALL_FIX_V2670_20260904';
const BASE='MARKETWIDE_CANDIDATE_RECALL_V2669_20260904';

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[candidate-v2670] ${label} syntax invalid: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function writeChecked(file,src,label){
  const tmp=`${file}.v2670-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function functionRange(src,name){
  const starts=[src.indexOf(`async function ${name}(`),src.indexOf(`function ${name}(`)].filter(x=>x>=0);
  if(!starts.length)return null;
  const start=Math.min(...starts),brace=src.indexOf('{',start);
  if(brace<0)return null;
  let depth=0,quote=null,escape=false,lineComment=false,blockComment=false,templateExpr=0;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue}
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
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0)return {start,end:i+1}}
  }
  return null;
}
function replaceFunction(src,name,code){
  const r=functionRange(src,name);
  if(!r)throw new Error(`[candidate-v2670] function missing: ${name}`);
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}

const BLOCK_FN=String.raw`
function manualCandidateBlockClassV2665(x,m){
  const hard=[],soft=[],push=(a,v)=>{v=String(v||'').trim();if(v&&!a.includes(v))a.push(v)};
  if(!x){push(hard,'資料不存在');return {hard,soft}}
  if(x?.trade?.status==='ACTIVE')push(hard,'已有實際建倉追蹤');

  const status=String(x?.trackerStatus||'NO_TRACKER').toUpperCase();
  const st=String(x?.structure?.state||'UNKNOWN').toUpperCase();

  // Candidate is a NEW research cycle. A previous terminal tracker must not permanently erase the symbol.
  if(['DROPPED','EXPIRED','LOSS','WIN','TIMEOUT'].includes(status))push(soft,'上一輪追蹤已結束，等待新一輪確認');

  if(st==='DESTROYED')push(hard,'結構徹底破壞');
  const rr=manualFinite(x?.entry?.rr);
  if(rr!=null&&rr<1)push(hard,'TP2 RR < 1');

  const qv=manualFinite(x?.quoteVolume);
  if(qv!=null&&qv<5_000_000)push(hard,'24h成交額過低');
  else if(qv!=null&&qv<20_000_000)push(soft,'流動性普通，需更嚴格等盤');

  const shN=Math.max(0,Number(x?.shadow?.sample||0)),shHit=manualFinite(x?.shadow?.hitRate),shPf=manualFinite(x?.shadow?.profitFactor);
  if(shN>=12&&((shPf!=null&&shPf<.75)||(shHit!=null&&shHit<40)))push(hard,'Shadow 同類樣本明顯負期望');
  else if(shN>=8&&shPf!=null&&shPf<.90)push(soft,'Shadow 同類 PF 偏弱');

  // IMPORTANT: candidate win rate is a RANKING signal, not a safety hazard.
  // Formal A/B still keeps its own threshold. Candidate never auto-pushes.
  if(m?.win!=null&&Number(m.win)<52)push(soft,'候選勝率尚未達正式門檻');

  const coverage=manualFinite(x?.dataHealth?.coverage),confidence=manualFinite(x?.dataHealth?.confidence);
  if(status==='NO_TRACKER'||['DROPPED','EXPIRED','LOSS','WIN','TIMEOUT'].includes(status)){
    push(soft,'等待最新 tracker / Structure 更新');
  }else{
    const age=Math.max(0,Number(x?.freshnessAgeMs||0));
    if(age>20*60_000)push(soft,'即時判讀已久，保留到候選自動歸檔');
    else if(age>5*60_000)push(soft,'即時判讀超過5分鐘，等待刷新');
    if(coverage!=null&&coverage<45)push(hard,'資料完整度過低');
    else if(coverage!=null&&coverage<72)push(soft,'資料完整度尚未達通知門檻');
    if(confidence!=null&&confidence<45)push(hard,'資料可信度過低');
    else if(confidence!=null&&confidence<65)push(soft,'資料可信度尚未達通知門檻');
  }

  if(!x?.structure)push(soft,'Structure V2 尚未完成');

  if(x?.institutionalEdge?.hardBlock===true){
    const rs=Array.isArray(x?.institutionalEdge?.hardBlockReasons)?x.institutionalEdge.hardBlockReasons:[];
    if(rs.length)for(const r of rs)push(hard,'機構風險：'+r);else push(hard,'機構風險硬阻擋');
  }

  const blockers=(Array.isArray(x?.blockers)?x.blockers:[]).map(v=>String(v));
  const has30=blockers.some(v=>/30分逆向/.test(v)),has1h=blockers.some(v=>/1小時逆向/.test(v));
  if(has30&&has1h)push(hard,'30分＋1小時同步逆向');

  for(const b of blockers){
    if(/距離回踩區|目前轉弱|15分逆向/.test(b)){push(soft,b);continue}
    if(/30分逆向|1小時逆向/.test(b)){if(!(has30&&has1h))push(soft,b);continue}
    if(/資料完整度|資料可信度/.test(b)){push(soft,b);continue}
    if(/價差|spread|ADL|Funding|擁擠|BTC\/ETH大盤逆向|跨交易所趨勢逆向|清算行情山寨|高波動價差|結構失效/i.test(b)){push(hard,b);continue}
    push(soft,b);
  }

  if(String(x?.notificationTier||'').toUpperCase()==='BLOCKED'&&!blockers.length)push(soft,'目前通知閘門未通過，候選層先保留研究');
  return {hard,soft};
}
`;

const BAND_FN=String.raw`
function manualCandidateBandV2665(x,m){
  if(!x||manualCandidateBlockClassV2665(x,m).hard.length)return 'DROP';
  if(manualCandidateFormalVisibleV2665(x,m))return 'FORMAL';

  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??0;
  const rank=Number(x?.rank||99),rankScore=Number(x?.rankScore||0),sample=Math.max(0,Number(x?.shadow?.sample||0));

  if(m.score>=66&&m.win>=57&&(sample>=6||cal>=60))return 'PRIME';
  if(m.score>=59&&m.win>=53&&(rank<=18||rankScore>=60||cal>=56||sample>=6))return 'WATCH';
  if(m.score>=54&&m.win>=50&&(rank<=24||rankScore>=52))return 'RELATIVE';

  // Observation-only fallback. This makes "candidate" a relative research list,
  // while still excluding true hard safety failures.
  if(rank<=15&&m.score>=50&&m.win>=48)return 'RESEARCH';
  if(rank<=8&&m.score>=48&&m.win>=47)return 'RESEARCH';

  return 'DROP';
}
`;

const PIPELINE_FN=String.raw`
function pipelineLine(p,rows){
  const a=Number(p?.formalA||0),b=Number(p?.formalB||0);
  const deep=Number(p?.deepAnalyzed??p?.analyzed??0);
  const universe=Number(p?.candidateUniverse??p?.ranked??0);
  const safe=Number(p?.hardSafe||0);
  return '深析 '+deep+' → 候選池 '+universe+' → 安全 '+safe+' → A/B '+(a+b)+' → 候選 '+rows.length;
}
`;

function patchServer(){
  const file=path.join(__dirname,'server.js');
  if(!fs.existsSync(file))throw new Error('[candidate-v2670] server.js missing');
  let src=fs.readFileSync(file,'utf8');
  if(src.includes(MARKER))return false;
  if(!src.includes(BASE))throw new Error('[candidate-v2670] V2669 marketwide candidate layer missing');

  src=replaceFunction(src,'manualCandidateBlockClassV2665',BLOCK_FN);
  src=replaceFunction(src,'manualCandidateBandV2665',BAND_FN);

  for(const needle of [
    "push(soft,'候選勝率尚未達正式門檻')",
    "push(soft,'上一輪追蹤已結束，等待新一輪確認')",
    "if(rank<=15&&m.score>=50&&m.win>=48)return 'RESEARCH'",
  ])if(!src.includes(needle))throw new Error('[candidate-v2670] invariant missing: '+needle);

  src='// '+MARKER+'\n'+src;
  writeChecked(file,src,'server.js');
  return true;
}
function patchUi(){
  const file=path.join(__dirname,'public','manual-candidate-v2664.js');
  const html=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(file))throw new Error('[candidate-v2670] candidate runtime missing');
  let js=fs.readFileSync(file,'utf8');
  if(!js.includes(MARKER)){
    js=replaceFunction(js,'pipelineLine',PIPELINE_FN);
    js=js.replace("const VERSION='2.6.69';","const VERSION='2.6.70';");
    js='/* '+MARKER+' */\n'+js;
    writeChecked(file,js,'candidate runtime');
  }
  if(fs.existsSync(html)){
    let h=fs.readFileSync(html,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.js\?v=[^"'<>]+/g,'/manual-candidate-v2664.js?v=2670-0904');
    fs.writeFileSync(html,h,'utf8');
  }
  return true;
}
export function patchCandidateRecallFixV2670(){
  const server=patchServer(),ui=patchUi();
  return {changed:Boolean(server||ui),version:'V2.6.70',candidateWinIsRanking:true,terminalTrackerSoft:true,pipelineFixed:true};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateRecallFixV2670());
