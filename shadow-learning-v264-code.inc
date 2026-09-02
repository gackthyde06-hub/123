/* ABC_SHADOW_LEARNING_V264_20260902
 * Purpose: every valid A/B/C opportunity is shadow-tracked even when the user never trades it.
 * The records live in the existing V10.2.2 shadow ledger so the already-audited state-learning
 * engine can learn from them after the normal de-correlation gate. Hard blockers are untouched.
 */
const ABC_SHADOW_SOURCE='ABC_AUTO_V264';
const ABC_SHADOW_EPISODE_MS=Math.max(20*60_000,Math.min(2*60*60_000,Number(process.env.ABC_SHADOW_EPISODE_MS||STATE_LEARNING_DEDUP_MS||45*60_000)));
const ABC_SHADOW_MIN_GRADE_SAMPLE=Math.max(12,Math.min(60,Number(process.env.ABC_SHADOW_MIN_GRADE_SAMPLE||20)));
const ABC_SHADOW_MAX_BONUS=Math.max(1,Math.min(5,Number(process.env.ABC_SHADOW_MAX_BONUS||4)));

function abcShadowTagged(x){return x?.version==='V10.2.2'&&x?.shadowSource===ABC_SHADOW_SOURCE}
function abcShadowGrade(v){const g=String(v||'C').toUpperCase();return ['A','B','C'].includes(g)?g:'C'}
function abcShadowStats(rows){return shadowStats((rows||[]).filter(x=>x?.status==='RESOLVED'&&['WIN','LOSS','TIMEOUT'].includes(x.result)))}
function abcShadowAdjustmentFromStats(stats){
  const sample=Number(stats?.sample||0);if(sample<ABC_SHADOW_MIN_GRADE_SAMPLE)return 0;
  const base=stateLearningAdjustmentFromStats(stats),cap=sample>=100?ABC_SHADOW_MAX_BONUS:sample>=50?Math.min(3,ABC_SHADOW_MAX_BONUS):Math.min(2,ABC_SHADOW_MAX_BONUS);
  return clamp(Number(base||0),-cap,cap);
}
function abcShadowLearningForTracker(t,direction,regime,strategyId){
  const all=shadowPerformance.filter(x=>abcShadowTagged(x)&&x.status==='RESOLVED'&&x.learningEligible!==false&&String(x.direction||'')===String(direction||''));
  let rows=all.filter(x=>String(x.strategyId||'')===String(strategyId||'')&&String(x.marketRegime||'')===String(regime||'')),level='策略×狀態';
  if(rows.length<ABC_SHADOW_MIN_GRADE_SAMPLE){rows=all.filter(x=>String(x.marketRegime||'')===String(regime||''));level='狀態×方向'}
  if(rows.length<ABC_SHADOW_MIN_GRADE_SAMPLE){rows=all;level='方向'}
  const stats=abcShadowStats(rows),adjustment=abcShadowAdjustmentFromStats(stats);
  return {sample:Number(stats.sample||0),hitRate:manualFinite(stats.hitRate),profitFactor:manualFinite(stats.profitFactor),expectancyR:manualFinite(stats.expectancyR),adjustment,level,active:Number(stats.sample||0)>=ABC_SHADOW_MIN_GRADE_SAMPLE};
}
function abcShadowLearningSummary(){
  const all=shadowPerformance.filter(abcShadowTagged),resolved=all.filter(x=>x.status==='RESOLVED'),eligible=resolved.filter(x=>x.learningEligible!==false),byGrade=['A','B','C'].map(key=>{const rows=eligible.filter(x=>abcShadowGrade(x.manualGradeAtEntry)===key),stats=abcShadowStats(rows);return {key,...stats,adjustment:abcShadowAdjustmentFromStats(stats)}});
  const overall=abcShadowStats(eligible),active=all.filter(x=>x.status==='ACTIVE').length;
  return {version:'V2.6.4',source:ABC_SHADOW_SOURCE,sample:all.length,active,resolved:resolved.length,learningEligibleResolved:eligible.length,minSample:ABC_SHADOW_MIN_GRADE_SAMPLE,maxBonus:ABC_SHADOW_MAX_BONUS,episodeMinutes:Math.round(ABC_SHADOW_EPISODE_MS/60000),overall,byGrade};
}
function abcShadowEpisodeRecord(row,now=Date.now()){
  const symbol=cleanFuturesSymbol(row?.symbol),direction=row?.direction==='SHORT'?'SHORT':'LONG';
  if(!symbol)return null;
  return shadowPerformance.find(x=>abcShadowTagged(x)&&x.symbol===symbol&&x.direction===direction&&Math.abs(now-new Date(x.shadowAt||0).getTime())<ABC_SHADOW_EPISODE_MS)||null;
}
function abcShadowLevelsValid(row){
  const e=manualFinite(row?.entry?.price),s=manualFinite(row?.entry?.stop),tg=manualFinite(row?.entry?.target),dir=row?.direction==='SHORT'?-1:1;
  return e>0&&s>0&&tg>0&&dir*(tg-e)>0&&dir*(s-e)<0&&Math.abs(e-s)>0;
}
function abcShadowCapture(rows){
  const now=Date.now(),audit={seen:0,created:0,updated:0,skippedNoTracker:0,skippedNoLevels:0,learningEligible:0};
  for(const row of rows||[]){
    audit.seen++;
    const t=row?.signalKey?testSignalTrackers.get(row.signalKey):null;if(!t){audit.skippedNoTracker++;continue}
    if(!abcShadowLevelsValid(row)){audit.skippedNoLevels++;continue}
    const existing=abcShadowEpisodeRecord(row,now);
    if(existing){
      const grade=abcShadowGrade(row.grade),old=abcShadowGrade(existing.manualGradeCurrent||existing.manualGradeAtEntry);
      if(old!==grade){existing.gradeTimeline=Array.isArray(existing.gradeTimeline)?existing.gradeTimeline:[];existing.gradeTimeline.push({at:new Date(now).toISOString(),from:old,to:grade,score:Number(row.executionScore||0)});existing.gradeTimeline=existing.gradeTimeline.slice(-12)}
      existing.manualGradeCurrent=grade;existing.manualExecutionScoreCurrent=Number(row.executionScore||0);existing.manualRankCurrent=Number(row.rank||0)||null;existing.structureStateCurrent=String(row.structure?.state||'UNKNOWN');existing.structureHealthCurrent=manualFinite(row.structure?.health);existing.abcLastSeenAt=new Date(now).toISOString();
      audit.updated++;continue;
    }
    const entry=Number(row.entry.price),stop=Number(row.entry.stop),target=Number(row.entry.target),risk=Math.abs(entry-stop);if(!(risk>0))continue;
    const features=stateLearningFeatures(t),keys=stateLearningKeys(features),learning=stateLearningAdjustment(t),grade=abcShadowGrade(row.grade),learningEligible=row.freshness!=='STALE'&&Number(row.dataHealth?.coverage||0)>=55&&Number(row.dataHealth?.confidence||0)>=50;
    const id=`abc-shadow-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const rec={id,version:'V10.2.2',shadowSource:ABC_SHADOW_SOURCE,signalKey:t.key,symbol:t.symbol,direction:t.direction,phase:'ABC_GRADE',shadowAt:new Date(now).toISOString(),entryPrice:entry,stop,target,riskDistance:risk,targetR:Number((testSignalDirection(t.direction)*(target-entry)/risk).toFixed(3)),strategyId:features.strategyId,strategyLabel:features.strategyLabel,marketRegime:features.regime,stateFeatures:features,stateKeys:keys,stateLabel:`ABC ${grade}｜${features.strategyLabel}｜${features.regime}｜${features.direction}`,rawScore:Number(row.executionScore||0),adjustedScore:Number(row.executionScore||0),learningAdjustmentAtEntry:Number(learning.adjustment||0),tierAtEntry:String(row.notificationTier||'VALID'),learningEligible,shadowProgress:manualFinite(row.observationProgress),blockReasons:Array.isArray(row.risks)?row.risks.slice(0,8):[],notified:Boolean(t.lastEntryNotificationAt||t.notificationSentAt),notificationId:t.lastEntryNotificationId||null,
      manualGradeAtEntry:grade,manualGradeCurrent:grade,manualExecutionScoreAtEntry:Number(row.executionScore||0),manualExecutionScoreCurrent:Number(row.executionScore||0),manualRankAtEntry:Number(row.rank||0)||null,manualRankCurrent:Number(row.rank||0)||null,structureStateAtEntry:String(row.structure?.state||'UNKNOWN'),structureStateCurrent:String(row.structure?.state||'UNKNOWN'),structureHealthAtEntry:manualFinite(row.structure?.health),structureHealthCurrent:manualFinite(row.structure?.health),structureLearningAdjustmentAtEntry:manualFinite(row.structure?.learningAdjustment),abcCreatedWithoutManualTrade:true,abcLastSeenAt:new Date(now).toISOString(),gradeTimeline:[],
      status:'ACTIVE',result:null,resultAt:null,exitPrice:null,grossReturnPct:null,netReturnPct:null,realizedR:null,mfePct:0,maePct:0,maxR:0,minR:0,snapshots:{},lastPrice:entry,lastPriceAt:new Date(now).toISOString(),lastSource:'abc-shadow-entry',costBps:PERF_ROUND_TRIP_COST_BPS};
    shadowPerformance.unshift(rec);shadowActiveSymbols.add(cleanFuturesSymbol(rec.symbol));scheduleShadowPerformanceSave();shadowOnPrice(rec.symbol,entry,now,'abc-shadow-entry');audit.created++;if(learningEligible)audit.learningEligible++;
  }
  return audit;
}
