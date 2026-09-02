import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='ABC_SHADOW_LEARNING_V264_20260902';
function replaceOnce(src,oldText,newText,label){if(!src.includes(oldText))throw new Error(`[abc-shadow-v264] anchor missing: ${label}`);return src.replace(oldText,newText)}
function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(`[abc-shadow-v264] syntax invalid: ${String(r.stderr||r.stdout||'').trim()}`)}
export function patchShadowLearningV264({serverPath=path.join(__dirname,'server.js')}={}){
  let src=fs.readFileSync(serverPath,'utf8');if(src.includes(MARKER))return {changed:false,reason:'already-applied'};
  const code=fs.readFileSync(path.join(__dirname,'shadow-learning-v264-code.inc'),'utf8').trimEnd()+'\n\n';
  const insertAnchor='async function manualOpportunityLoop(){';
  src=replaceOnce(src,insertAnchor,code+insertAnchor,'helper insertion');
  const learnOld="const shadow=manualShadowEvidence(t,direction,regime,strategy.id||''),blockers=Array.isArray(tier?.blockers)?tier.blockers:[],lc=t?.lastCheck||{},ev=structure?.evidence||{},monitor=String(t?.monitorState||'WATCHING');";
  const learnNew="const shadow=manualShadowEvidence(t,direction,regime,strategy.id||''),abcLearning=abcShadowLearningForTracker(t,direction,regime,strategy.id||''),blockers=Array.isArray(tier?.blockers)?tier.blockers:[],lc=t?.lastCheck||{},ev=structure?.evidence||{},monitor=String(t?.monitorState||'WATCHING');";
  src=replaceOnce(src,learnOld,learnNew,'manual learning context');
  const scoreOld="let score=rankScore*.24+((manualFinite(tier?.score)??manualFinite(t?.monitorScore)??55))*0.24+structureHealth*.18+coverage*.08+confidence*.08+progress*.08+(calRate??50)*.06+50*.04+shadow.adjustment;";
  const scoreNew="let score=rankScore*.24+((manualFinite(tier?.score)??manualFinite(t?.monitorScore)??55))*0.24+structureHealth*.18+coverage*.08+confidence*.08+progress*.08+(calRate??50)*.06+50*.04+shadow.adjustment+Number(abcLearning.adjustment||0);";
  src=replaceOnce(src,scoreOld,scoreNew,'manual score learns ABC shadow');
  const shadowReturnOld="shadow:{sample:shadow.sample,hitRate:shadow.hitRate,profitFactor:shadow.profitFactor,expectancyR:shadow.expectancyR,level:shadow.level,adjustment:shadow.adjustment},dataHealth:{coverage,confidence},";
  const shadowReturnNew="shadow:{sample:shadow.sample,hitRate:shadow.hitRate,profitFactor:shadow.profitFactor,expectancyR:shadow.expectancyR,level:shadow.level,adjustment:shadow.adjustment},abcLearning:{sample:abcLearning.sample,hitRate:abcLearning.hitRate,profitFactor:abcLearning.profitFactor,expectancyR:abcLearning.expectancyR,level:abcLearning.level,adjustment:abcLearning.adjustment,active:abcLearning.active},dataHealth:{coverage,confidence},";
  src=replaceOnce(src,shadowReturnOld,shadowReturnNew,'manual response abc learning');
  const responseOld="const data={ok:true,version:'V2.6.3',generatedAt:new Date().toISOString(),ideasGeneratedAt:ideas.generatedAt,stale:ideas.stale===true,methodology:'建議排名＋觀察/通知閘門＋Structure V2＋Shadow 實測＋資料新鮮度＋TP2 RR。A/B/C 是手動執行優先級，不是保證勝率。',stats:manualActualBreakdown(),counts:{A:rows.filter(x=>x.grade==='A').length,B:rows.filter(x=>x.grade==='B').length,C:rows.filter(x=>x.grade==='C').length},rows};";
  const responseNew="const abcCapture=abcShadowCapture(rows),shadowLearning=abcShadowLearningSummary();const data={ok:true,version:'V2.6.4',generatedAt:new Date().toISOString(),ideasGeneratedAt:ideas.generatedAt,stale:ideas.stale===true,methodology:'建議排名＋觀察/通知閘門＋Structure V2＋全自動 ABC Shadow＋資料新鮮度＋TP2 RR。即使不下單，符合可驗證點位的 A/B/C 仍會進 Shadow；去相關後才影響學習與通知分數。',stats:manualActualBreakdown(),shadowLearning,abcCapture,counts:{A:rows.filter(x=>x.grade==='A').length,B:rows.filter(x=>x.grade==='B').length,C:rows.filter(x=>x.grade==='C').length},rows};";
  src=replaceOnce(src,responseOld,responseNew,'capture ABC shadow');
  // Add observability columns without changing existing result semantics.
  const csvOld="const cols=['shadowAt','symbol','direction','strategyLabel','marketRegime','stateLabel','tierAtEntry','finalTier','notified','learningEligible','shadowProgress','blockReasons','stateKeyCore','stateKeyBroad','rawScore','learningAdjustmentAtEntry','adjustedScore','entryPrice','stop','target','status','result','resultAt','mfePct','maePct','realizedR','grossReturnPct','netReturnPct'];";
  const csvNew="const cols=['shadowAt','shadowSource','manualGradeAtEntry','manualGradeCurrent','manualExecutionScoreAtEntry','symbol','direction','strategyLabel','marketRegime','stateLabel','tierAtEntry','finalTier','notified','learningEligible','shadowProgress','blockReasons','stateKeyCore','stateKeyBroad','rawScore','learningAdjustmentAtEntry','adjustedScore','entryPrice','stop','target','status','result','resultAt','mfePct','maePct','realizedR','grossReturnPct','netReturnPct'];";
  if(src.includes(csvOld))src=src.replace(csvOld,csvNew);
  const tmp=`${serverPath}.v264-${process.pid}-${Date.now()}.tmp.js`;fs.writeFileSync(tmp,src,'utf8');try{check(tmp);fs.renameSync(tmp,serverPath)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
  return {changed:true};
}
if(import.meta.url===`file://${process.argv[1]}`)patchShadowLearningV264();
