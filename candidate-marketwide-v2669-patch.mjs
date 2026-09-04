import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='MARKETWIDE_CANDIDATE_RECALL_V2669_20260904';
const LIFECYCLE='CANDIDATE_LIFECYCLE_V2667_20260904';

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[candidate-v2669] ${label} syntax invalid: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function writeChecked(file,src,label){
  const tmp=`${file}.v2669-${process.pid}-${Date.now()}.tmp.js`;
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
    if(lineComment){
      if(ch==='\n')lineComment=false;
      continue;
    }
    if(blockComment){
      if(ch==='*'&&next==='/'){blockComment=false;i++;}
      continue;
    }
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
  if(!r)throw new Error(`[candidate-v2669] function missing: ${name}`);
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}

const BAND_FN=String.raw`
function manualCandidateBandV2665(x,m){
  if(!x||manualCandidateBlockClassV2665(x,m).hard.length)return 'DROP';
  if(manualCandidateFormalVisibleV2665(x,m))return 'FORMAL';
  const cal=manualFinite(x?.calibratedWinRate)??manualFinite(x?.estimatedWinRate)??0;
  const rank=Number(x?.rank||99),rankScore=Number(x?.rankScore||0),sample=Math.max(0,Number(x?.shadow?.sample||0));
  if(m.score>=66&&m.win>=57&&(sample>=6||cal>=60))return 'PRIME';
  if(m.score>=59&&m.win>=53&&(rank<=18||rankScore>=60||cal>=56||sample>=6))return 'WATCH';
  if(m.score>=55&&m.win>=52&&(rank<=24||rankScore>=54))return 'RELATIVE';
  if(m.win>=52&&rank<=30)return 'RESEARCH';
  return 'DROP';
}
`;

const RESPONSE_FN=String.raw`
async function manualOpportunityResponse(force=false){
  const base=await manualOpportunityResponseBaseV2664(force);
  const baseRows=Array.isArray(base?.rows)?base.rows:[];
  const ideas=await getRankedIdeas().catch(()=>null);

  const candidateUniverse=[...baseRows],seen=new Set(baseRows.map(x=>manualCandidateKeyV2664(x)));
  for(const [i,idea] of (Array.isArray(ideas?.rows)?ideas.rows:[]).slice(0,30).entries()){
    try{
      const row=manualOpportunityOne(idea,i+1,ideas?.generatedAt);
      if(!row)continue;
      const key=manualCandidateKeyV2664(row);
      if(seen.has(key))continue;
      seen.add(key);candidateUniverse.push(row);
    }catch{}
  }

  const candidates=manualStableCandidatesV2664(candidateUniverse);
  const byKey=new Map(candidates.map(x=>[x.candidateKey,x]));
  const rows=baseRows.map(x=>byKey.get(manualCandidateKeyV2664(x))||x);
  for(const c of candidates)if(!rows.some(x=>manualCandidateKeyV2664(x)===c.candidateKey))rows.push(c);

  const scored=candidateUniverse.map(x=>{const m=manualCandidateScoreV2664(x);return {x,m,cls:manualCandidateBlockClassV2665(x,m),formal:manualCandidateFormalVisibleV2665(x,m),band:manualCandidateBandV2665(x,m)}});
  const rejects=manualCandidateRejectSummaryV2665(candidateUniverse);
  const visibleA=baseRows.filter(x=>String(x.grade||'')==='A'&&manualCandidateFormalVisibleV2665(x,manualCandidateScoreV2664(x))).length;
  const visibleB=baseRows.filter(x=>String(x.grade||'')==='B'&&manualCandidateFormalVisibleV2665(x,manualCandidateScoreV2664(x))).length;
  const archive=manualCandidateArchiveRowsV2667();

  const pipeline={
    radarLimit:typeof RADAR_MAX_SYMBOLS==='number'?RADAR_MAX_SYMBOLS:null,
    deepAnalyzed:Number(ideas?.analyzed||0),
    candidateUniverse:candidateUniverse.length,
    formalUniverse:baseRows.length,
    hardSafe:scored.filter(v=>v.cls.hard.length===0).length,
    hardBlocked:scored.filter(v=>v.cls.hard.length>0).length,
    softWaiting:scored.filter(v=>v.cls.hard.length===0&&v.cls.soft.length>0).length,
    formalA:visibleA,formalB:visibleB,candidate:candidates.length,
    prime:scored.filter(v=>v.band==='PRIME').length,
    watch:scored.filter(v=>v.band==='WATCH').length,
    relative:scored.filter(v=>v.band==='RELATIVE').length,
    research:scored.filter(v=>v.band==='RESEARCH').length,
    topRejects:rejects.hard,topWaits:rejects.soft,radar:ideas?.radar||null,
    candidateArchiveCount:archive.length,recentArchived:archive.slice(0,5)
  };

  return {
    ...base,
    version:'V2.6.69',
    methodology:'大範圍市場雷達後，前40名做深度分析；正式A/B維持原門檻，候選從前30個深析結果做安全層後相對排名。只要存在沒有硬風險、候選勝率>=52%的相對前段標的，就能進研究候選；研究候選永不自動通知。',
    counts:{...(base?.counts||{}),A:visibleA,B:visibleB,C:rows.filter(x=>String(x.grade||'')==='C'&&x.candidate!==true).length,candidate:candidates.length},
    pipeline,
    rows
  };
}
`;

const UI_BAND_FN=String.raw`
function zhBandV2666(x){
  const b=String(x?.candidateBand||'WATCH');
  return b==='PRIME'?'優先候選':b==='RELATIVE'?'相對候選':b==='RESEARCH'?'研究候選':b==='COOLING'?'降溫候選':'觀察候選';
}
`;

function patchServer(){
  const file=path.join(__dirname,'server.js');
  if(!fs.existsSync(file))throw new Error('[candidate-v2669] server.js missing');
  let src=fs.readFileSync(file,'utf8');
  if(src.includes(MARKER))return false;
  if(!src.includes(LIFECYCLE))throw new Error('[candidate-v2669] V2667 lifecycle missing');
  if(!src.includes('TRADFI_LEARNING_V2612_20260902'))throw new Error('[candidate-v2669] TradFi layer missing');
  if(!src.includes('ABC_SHADOW_LEARNING_V265_20260902'))throw new Error('[candidate-v2669] Shadow learning missing');

  src=src.replace(/const RADAR_MAX_SYMBOLS = [^\n]+;/,"const RADAR_MAX_SYMBOLS = Math.max(120, Math.min(500, Number(process.env.RADAR_MAX_SYMBOLS || 300)));");
  src=src.replace(/const IDEA_SYMBOLS = [^\n]+;/,"const IDEA_SYMBOLS = Math.max(24, Math.min(48, Number(process.env.IDEA_SYMBOLS || 40)));");
  src=src.replace(/const TEST_SIGNAL_MAX = [^\n]+;/,"const TEST_SIGNAL_MAX = Math.max(12, Math.min(24, Number(process.env.TEST_SIGNAL_MAX || 20)));");

  src=src.replace(/\.slice\(0,Math\.min\(32,IDEA_SYMBOLS\+8\)\)/g,'.slice(0,Math.min(48,IDEA_SYMBOLS+8))');
  src=src.replace(/rows:enriched\.slice\(0,18\)/g,'rows:enriched.slice(0,30)');
  src=src.replace(/(\(ideas(?:\?\.|\.)rows\|\|\[\]\)\.slice\(0,)12(\)\.map\()/g,'$120$2');
  src=src.replace(/(data\.rows\.slice\(0,)12(\))/g,'$120$2');

  src=replaceFunction(src,'manualCandidateBandV2665',BAND_FN);
  src=replaceFunction(src,'manualOpportunityResponse',RESPONSE_FN);

  src=src.replace("const bandWeight={PRIME:3,WATCH:2,RELATIVE:1,DROP:0,FORMAL:0};","const bandWeight={PRIME:4,WATCH:3,RELATIVE:2,RESEARCH:1,DROP:0,FORMAL:0};");
  src=src.replace("return v.band==='RELATIVE'?cf>=1:cf>=MANUAL_CANDIDATE_CONFIRM_SCANS_V2664;","return ['RELATIVE','RESEARCH'].includes(v.band)?cf>=1:cf>=MANUAL_CANDIDATE_CONFIRM_SCANS_V2664;");

  for(const needle of ['RADAR_MAX_SYMBOLS || 300','IDEA_SYMBOLS || 40','TEST_SIGNAL_MAX || 20','rows:enriched.slice(0,30)','candidateUniverse.length',"return 'RESEARCH'",'research:scored.filter']){
    if(!src.includes(needle))throw new Error('[candidate-v2669] invariant missing: '+needle);
  }

  src='// '+MARKER+'\n'+src;
  writeChecked(file,src,'server.js');
  return true;
}
function patchUi(){
  const file=path.join(__dirname,'public','manual-candidate-v2664.js');
  const html=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(file))throw new Error('[candidate-v2669] candidate runtime missing');
  let js=fs.readFileSync(file,'utf8');
  if(!js.includes(MARKER)){
    js=replaceFunction(js,'zhBandV2666',UI_BAND_FN);
    js=js.replace("const VERSION='2.6.67';","const VERSION='2.6.69';");
    js='/* '+MARKER+' */\n'+js;
    writeChecked(file,js,'candidate runtime');
  }
  if(fs.existsSync(html)){
    let h=fs.readFileSync(html,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.js\?v=[^"'<>]+/g,'/manual-candidate-v2664.js?v=2669-0904');
    fs.writeFileSync(html,h,'utf8');
  }
  return true;
}
export function patchCandidateMarketwideV2669(){
  const server=patchServer(),ui=patchUi();
  return {changed:Boolean(server||ui),version:'V2.6.69',radar:300,deepAnalysis:40,candidateUniverse:30,formalUniverse:20,researchFallback:true};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateMarketwideV2669());
