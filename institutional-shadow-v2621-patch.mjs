import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='INSTITUTIONAL_SHADOW_EDGE_V2621';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v2621-shadow] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2621-shadow] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;const ext=path.extname(f)||'.tmp',tmp=`${f}.v2621-${process.pid}-${Date.now()}${ext}`;fs.writeFileSync(tmp,a,'utf8');try{if(ext==='.js'||ext==='.mjs')check(tmp);fs.renameSync(tmp,f)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}return true}
function replaceRange(s,startNeedle,endNeedle,replacement,label){const a=s.indexOf(startNeedle),b=a>=0?s.indexOf(endNeedle,a+startNeedle.length):-1;if(a<0||b<0)throw new Error(`[v2621-shadow] ${label} anchor missing`);return s.slice(0,a)+replacement+s.slice(b)}

function patchServer(){
  const f=must('server.js'),before=fs.readFileSync(f,'utf8');let s=before;
  if(s.includes(MARKER))return {changed:false,reason:'already'};
  if(!s.includes('TRADFI_LEARNING_V2612_20260902'))throw new Error('[v2621-shadow] V2612 asset-aware learning missing');
  if(!s.includes('ABC_SHADOW_LEARNING_V265_20260902'))throw new Error('[v2621-shadow] ABC Shadow layer missing');
  const helper=fs.readFileSync(must('institutional-shadow-v2621-code.inc'),'utf8').trimEnd()+'\n\n';

  const stateStart='function stateLearningAdjustment(t){',stateEnd='function stateLearningTable(limit=24)';
  if(!s.includes(stateStart)||!s.includes(stateEnd))throw new Error('[v2621-shadow] state learning boundary missing');
  const stateBlock=helper+`function stateLearningAdjustment(t){
  const features=stateLearningFeatures(t),actualEvidence=actualStateEvidence(features),institutionalEdge=institutionalEdgeV2621(t),shadowAdjustment=Number(institutionalEdge.learningAdjustment||0),adjustment=clamp(shadowAdjustment+Number(actualEvidence.adjustment||0),-STATE_LEARNING_MAX_BONUS,STATE_LEARNING_MAX_BONUS);
  return {adjustment,shadowAdjustment,actualAdjustment:Number(actualEvidence.adjustment||0),actualEvidence,level:institutionalEdge.level,key:null,features,stats:{sample:institutionalEdge.sample,hitRate:institutionalEdge.stats?.hitRate??null,profitFactor:institutionalEdge.stats?.netProfitFactor??null,expectancyR:institutionalEdge.stats?.netExpectancyR??null},active:institutionalEdge.sample>=SHADOW_EDGE_MIN_SAMPLE_V2621,crossAsset:false,institutionalEdge};
}
`;
  s=replaceRange(s,stateStart,stateEnd,stateBlock,'state learning');

  const tierStart=s.indexOf('function testSignalTier(t,{reentry=false}={}) {'),tierEnd=tierStart>=0?s.indexOf('\nfunction testPushCopy(',tierStart):-1;
  if(tierStart<0||tierEnd<0)throw new Error('[v2621-shadow] testSignalTier boundary missing');
  let tier=s.slice(tierStart,tierEnd);
  if(!/const hardSafe=blockers\.length===0;/.test(tier))throw new Error('[v2621-shadow] hardSafe anchor missing');
  tier=tier.replace(/const hardSafe=blockers\.length===0;/,'const institutional=institutionalEdgeV2621(t);for(const b of institutional.hardBlockReasons||[])if(!blockers.includes(b))blockers.push(b);\n  const hardSafe=blockers.length===0;');
  tier=tier.replace(/const highMissing=\[\];/,'const highMissing=[];\n  if(institutional.edgeScore<SHADOW_EDGE_A_MIN_V2621)highMissing.push(`Edge<${SHADOW_EDGE_A_MIN_V2621}`);\n  if(!institutional.costGateA)highMissing.push(`成本/停損比>${SHADOW_EDGE_A_COST_RATIO_V2621.toFixed(2)}`);\n  if(institutional.capA)highMissing.push(\'機構Edge封頂B\');');
  tier=tier.replace(/const normalMissing=\[\];/,'const normalMissing=[];\n  if(institutional.edgeScore<SHADOW_EDGE_B_MIN_V2621)normalMissing.push(`Edge<${SHADOW_EDGE_B_MIN_V2621}`);\n  if(!institutional.costGateB)normalMissing.push(`成本/停損比>${SHADOW_EDGE_B_COST_RATIO_V2621.toFixed(2)}`);');
  tier=tier.replaceAll('learning,rank,blockers','learning,institutionalEdge:institutional,rank,blockers');
  s=s.slice(0,tierStart)+tier+s.slice(tierEnd);
  s=s.replace('learning:tier.learning||null,rank:tier.rank','learning:tier.learning||null,institutionalEdge:tier.institutionalEdge||null,rank:tier.rank');

  const manualStart=s.indexOf('function manualOpportunityOne('),manualEnd=manualStart>=0?s.indexOf('\nasync function manualOpportunityResponse(',manualStart):-1;
  if(manualStart<0||manualEnd<0)throw new Error('[v2621-shadow] manual opportunity boundary missing');
  let manual=s.slice(manualStart,manualEnd);
  const mRe=/(const\s+)?shadow=manualShadowEvidence\(([^;]+?)\),abcLearning=abcShadowLearningForTracker\(([^;]+?)\),blockers=/;
  if(!mRe.test(manual))throw new Error('[v2621-shadow] manual learning anchor missing');
  manual=manual.replace(mRe,(_m,prefix,a,b)=>`${prefix||''}shadow=manualShadowEvidence(${a}),abcLearning=abcShadowLearningForTracker(${b}),institutional=institutionalEdgeV2621(t),blockers=`);
  const gradeNeedle="let grade=aReady?'A':(!hardC&&score>=60?'B':'C');";
  if(!manual.includes(gradeNeedle))throw new Error('[v2621-shadow] manual grade anchor missing');
  manual=manual.replace(gradeNeedle,"const institutionalA=!institutional.hardBlock&&!institutional.capA&&institutional.costGateA&&institutional.edgeScore>=SHADOW_EDGE_A_MIN_V2621;const institutionalB=!institutional.hardBlock&&institutional.costGateB&&institutional.edgeScore>=SHADOW_EDGE_B_MIN_V2621;let grade=(aReady&&institutionalA)?'A':(!hardC&&score>=60&&institutionalB?'B':'C');");
  manual=manual.replace('const reasons=[];const risks=[];',"const reasons=[];const risks=[];reasons.push(`機構 Edge ${institutional.edgeScore} · ${institutional.level}`);if(institutional.cost?.ratio!=null)reasons.push(`成本/停損比 ${institutional.cost.ratio.toFixed(2)}`);if(institutional.capA)risks.push('Edge 模型封頂 B');if(institutional.hardBlockReasons?.length)risks.push(...institutional.hardBlockReasons);");
  const returnRe=/shadow:\{sample:shadow\.sample,hitRate:shadow\.hitRate,profitFactor:shadow\.profitFactor,expectancyR:shadow\.expectancyR,level:shadow\.level,adjustment:shadow\.adjustment\},abcLearning:\{sample:abcLearning\.sample,hitRate:abcLearning\.hitRate,profitFactor:abcLearning\.profitFactor,expectancyR:abcLearning\.expectancyR,level:abcLearning\.level,adjustment:abcLearning\.adjustment,active:abcLearning\.active\},dataHealth:\{coverage,confidence\}/;
  if(!returnRe.test(manual))throw new Error('[v2621-shadow] manual return anchor missing');
  manual=manual.replace(returnRe,'shadow:{sample:shadow.sample,hitRate:shadow.hitRate,profitFactor:shadow.profitFactor,expectancyR:shadow.expectancyR,level:shadow.level,adjustment:shadow.adjustment},abcLearning:{sample:abcLearning.sample,hitRate:abcLearning.hitRate,profitFactor:abcLearning.profitFactor,expectancyR:abcLearning.expectancyR,level:abcLearning.level,adjustment:abcLearning.adjustment,active:abcLearning.active},institutionalEdge:{version:institutional.version,score:institutional.edgeScore,level:institutional.level,sample:institutional.sample,costRatio:institutional.cost?.ratio??null,costGateA:institutional.costGateA,costGateB:institutional.costGateB,capA:institutional.capA,hardBlock:institutional.hardBlock,strategyStats:institutional.strategyStats},dataHealth:{coverage,confidence}');
  s=s.slice(0,manualStart)+manual+s.slice(manualEnd);

  s=s.replace(/\.sort\(\(a,b\)=>\(\(\{A:3,B:2,C:1\}\[b\.grade\]\|\|0\)-\(\{A:3,B:2,C:1\}\[a\.grade\]\|\|0\)\)\|\|b\.executionScore-a\.executionScore\|\|a\.rank-b\.rank\)/,
    ".sort((a,b)=>(({A:3,B:2,C:1}[b.grade]||0)-({A:3,B:2,C:1}[a.grade]||0))||Number(b.institutionalEdge?.score||0)-Number(a.institutionalEdge?.score||0)||b.executionScore-a.executionScore||a.rank-b.rank)");

  if(s.includes('function abcShadowLearningForTracker(t,direction,regime,strategyId){')){
    const abc=`function abcShadowLearningForTracker(t,direction,regime,strategyId){
  const assetClass=assetClassForSymbolV2612(t?.symbol),all=edgeRowsV2621().filter(x=>abcShadowTagged(x)&&String(x.direction||'')===String(direction||'')),same=all.filter(x=>edgeAssetV2621(x)===assetClass);
  let rows=edgeDedupV2621(same.filter(x=>String(x.strategyId||'')===String(strategyId||'')&&String(x.marketRegime||'')===String(regime||'')),x=>cleanFuturesSymbol(x.symbol)),level='同資產·策略×狀態';if(rows.length<ABC_SHADOW_MIN_GRADE_SAMPLE){rows=edgeDedupV2621(same.filter(x=>String(x.strategyId||'')===String(strategyId||'')),x=>cleanFuturesSymbol(x.symbol));level='同資產·策略'}if(rows.length<ABC_SHADOW_MIN_GRADE_SAMPLE){rows=edgeDedupV2621(same,x=>String(cleanFuturesSymbol(x.symbol))+'|'+String(x.strategyId||''));level='同資產·方向'}
  let st=edgeStatsV2621(rows),adjustment=edgeAdjFromStatsV2621(st,rows.length>=100?4:rows.length>=50?3:2),crossAsset=false;if(st.sample<ABC_SHADOW_MIN_GRADE_SAMPLE){const g=edgeDedupV2621(all,x=>String(cleanFuturesSymbol(x.symbol))+'|'+String(x.strategyId||'')),gs=edgeStatsV2621(g);if(gs.sample>=Math.max(50,ABC_SHADOW_MIN_GRADE_SAMPLE*2)){st=gs;adjustment=clamp(edgeAdjFromStatsV2621(gs,1),-1,1);level='跨資產弱參考';crossAsset=true}else adjustment=0}
  return {sample:Number(st.sample||0),hitRate:manualFinite(st.hitRate),profitFactor:manualFinite(st.netProfitFactor),expectancyR:manualFinite(st.netExpectancyR),adjustment,level,active:st.sample>=ABC_SHADOW_MIN_GRADE_SAMPLE,assetClass,crossAsset,netOfCost:true};
}
`;
    s=replaceRange(s,'function abcShadowLearningForTracker(t,direction,regime,strategyId){','function abcShadowLearningSummary()',abc,'ABC institutional learning');
  }

  s=s.replace("const features=stateLearningFeatures(t),keys=stateLearningKeys(features),learning=stateLearningAdjustment(t),grade=abcShadowGrade(row.grade),learningEligible=",
    "const features=stateLearningFeatures(t),keys=stateLearningKeys(features),learning=stateLearningAdjustment(t),mentor=institutionalEdgeV2621(t),grade=abcShadowGrade(row.grade),learningEligible=");
  s=s.replace("learningAdjustmentAtEntry:Number(learning.adjustment||0),tierAtEntry:","learningAdjustmentAtEntry:Number(learning.adjustment||0),mentorModelVersion:SHADOW_EDGE_VERSION_V2621,institutionalEdgeAtEntry:Number(mentor.edgeScore||0),costRatioAtEntry:mentor.cost?.ratio??null,strategyNetPfAtEntry:mentor.strategyStats?.netProfitFactor??null,strategyNetExpRAtEntry:mentor.strategyStats?.netExpectancyR??null,tierAtEntry:");
  s=s.replace("'scoreMeaning','scoreBucket','netR']","'scoreMeaning','scoreBucket','netR','mentorModelVersion','institutionalEdgeAtEntry','costRatioAtEntry','strategyNetPfAtEntry','strategyNetExpRAtEntry']");

  s=`// ${MARKER}\n${s}`;
  return {changed:save(f,before,s)};
}

export function patchInstitutionalShadowV2621(){return patchServer()}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchInstitutionalShadowV2621());
