/* MANUAL_MODE_V263_20260902 */
const MANUAL_MODE_PREF_FILE=path.join(DATA_DIR,'manual-mode-preferences.json');
const MANUAL_MODE_REFRESH_MS=Math.max(30_000,Number(process.env.MANUAL_MODE_REFRESH_MS||60_000));
const MANUAL_MODE_NOTIFY_COOLDOWN_MS=Math.max(20*60_000,Number(process.env.MANUAL_MODE_NOTIFY_COOLDOWN_MS||90*60_000));
let manualOpportunityTimer=null,manualOpportunityBusy=false,manualOpportunityCache={at:0,data:null};

function manualPrefRows(){const a=loadJson(MANUAL_MODE_PREF_FILE,[]);return Array.isArray(a)?a:[]}
function manualSavePrefs(rows){saveJson(MANUAL_MODE_PREF_FILE,(rows||[]).slice(0,50))}
function manualNotifyMode(v){const x=String(v||'A').toUpperCase();return ['A','AB','ALL'].includes(x)?x:'A'}
function manualPrefAllows(pref,grade){if(pref?.enabled!==true)return false;const mode=manualNotifyMode(pref.mode);return mode==='ALL'||(mode==='AB'&&['A','B'].includes(grade))||(mode==='A'&&grade==='A')}
function manualFinite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function manualCleanSnapshot(x){
  if(!x||typeof x!=='object')return null;
  return {
    rank:manualFinite(x.rank),rankScore:manualFinite(x.rankScore),estimatedWinRate:manualFinite(x.estimatedWinRate),calibratedWinRate:manualFinite(x.calibratedWinRate),notificationTier:String(x.notificationTier||'').slice(0,20)||null,
    observationProgress:manualFinite(x.observationProgress),dataCoverage:manualFinite(x.dataCoverage),dataConfidence:manualFinite(x.dataConfidence),structureState:String(x.structureState||'').slice(0,30)||null,
    structureHealth:manualFinite(x.structureHealth),structureLearningAdjustment:manualFinite(x.structureLearningAdjustment),shadowSample:manualFinite(x.shadowSample),shadowHitRate:manualFinite(x.shadowHitRate),shadowProfitFactor:manualFinite(x.shadowProfitFactor),
    rr:manualFinite(x.rr),freshnessAgeMs:manualFinite(x.freshnessAgeMs),entryZoneLow:manualFinite(x.entryZoneLow),entryZoneHigh:manualFinite(x.entryZoneHigh),stop:manualFinite(x.stop),target:manualFinite(x.target),target2:manualFinite(x.target2)
  };
}
function manualGradeStats(rows){
  const all=rows||[],decisive=all.filter(x=>['WIN','LOSS'].includes(x.firstOutcome)),wins=decisive.filter(x=>x.firstOutcome==='WIN').length,losses=decisive.filter(x=>x.firstOutcome==='LOSS').length,resolved=all.filter(x=>x.status==='RESOLVED');
  const pnls=resolved.map(x=>Number(x.estimatedPnl)).filter(Number.isFinite),profits=pnls.filter(x=>x>0).reduce((a,b)=>a+b,0),lossSum=Math.abs(pnls.filter(x=>x<0).reduce((a,b)=>a+b,0));
  return {sample:all.length,active:all.filter(x=>x.status==='ACTIVE').length,resolved:resolved.length,decisive:decisive.length,wins,losses,hitRate:decisive.length?Number((wins/decisive.length*100).toFixed(1)):null,profitFactor:lossSum>0?Number((profits/lossSum).toFixed(2)):(profits>0?99:null),estimatedPnl:pnls.length?Number(pnls.reduce((a,b)=>a+b,0).toFixed(2)):0};
}
function manualActualBreakdown(){
  const rows=actualTrades.filter(x=>x?.version==='V10.2.6'&&(x.manualMode===true||['A','B','C'].includes(String(x.manualGrade||''))));
  const byGrade=['A','B','C'].map(key=>({key,...manualGradeStats(rows.filter(x=>String(x.manualGrade||'')===key))}));
  const bucket=x=>{const r=Number(x.manualRank);return r>0&&r<=3?'排名1–3':r>3&&r<=6?'排名4–6':r>6?'排名7+':'無排名'};
  const byRank=['排名1–3','排名4–6','排名7+','無排名'].map(key=>({key,...manualGradeStats(rows.filter(x=>bucket(x)===key))}));
  return {...manualGradeStats(rows),byGrade,byRank};
}
function manualShadowEvidence(t,direction,regime,strategyId){
  const all=shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'&&['WIN','LOSS','TIMEOUT'].includes(x.result)&&String(x.direction||'')===direction);
  let rows=all.filter(x=>String(x.strategyId||'')===String(strategyId||'')&&String(x.marketRegime||'')===String(regime||'')),level='策略×狀態';
  if(rows.length<8){rows=all.filter(x=>String(x.marketRegime||'')===String(regime||''));level='狀態'}
  if(rows.length<8){rows=all;level='方向'}
  const stats=shadowStats(rows),hit=manualFinite(stats.hitRate),pf=manualFinite(stats.profitFactor);let adjustment=0;
  if(stats.sample>=12&&hit!=null&&pf!=null){if(hit>=58&&pf>=1.15)adjustment=4;else if(hit>=53&&pf>=1.03)adjustment=2;else if(hit<=42||pf<.82)adjustment=-4;else if(hit<=47||pf<.93)adjustment=-2}
  return {sample:Number(stats.sample||0),hitRate:hit,profitFactor:pf,expectancyR:manualFinite(stats.expectancyR),level,adjustment};
}
function manualOpportunityId(idea,t){
  const epoch=t?.firstSeenAt||t?.confirmedAt||t?.createdAt||'';
  return ['manual-v263',cleanFuturesSymbol(idea?.symbol),String(idea?.direction||'LONG'),epoch||Math.floor(Date.now()/3600000)].join('|');
}
function manualOpportunityOne(idea,rank,ideasGeneratedAt){
  const direction=idea.direction==='SHORT'?'SHORT':'LONG',key=testSignalKey(idea.symbol,direction),t=testSignalTrackers.get(key)||null,now=Date.now();
  const strategy=t?.strategyAtConfirm||t?.strategyProfile||{},regime=String(t?.marketRegime||t?.lastCheck?.marketRegime||'UNKNOWN'),structure=t?.structureV2||null,st=String(structure?.state||'UNKNOWN');
  const tier=t?testSignalTier(t):null,cal=t?testCalibratedWinRate(t,{dynamic:['CONFIRMED','INVALID'].includes(t.status)}):null,calRate=manualFinite(cal?.rate)??manualFinite(idea.estimatedWinRate),rankScore=Math.max(0,Math.min(100,Number(idea.rankScore||0)));
  const progress=Math.max(0,Math.min(100,Number(t?.observationProgress||0))),coverage=Math.max(0,Math.min(100,Number(t?.dataHealth?.coveragePct||0))),confidence=Math.max(0,Math.min(100,Number(t?.dataHealth?.confidencePct||0))),structureHealth=Math.max(0,Math.min(100,Number(structure?.health||0)));
  const evaluatedAt=t?.lastEvaluatedAt||t?.updatedAt||ideasGeneratedAt,ageMs=evaluatedAt?Math.max(0,now-new Date(evaluatedAt).getTime()):99999999;
  const status=String(t?.status||'NO_TRACKER'),reentryActive=Boolean(t?.targetReachedAt),reentryReady=reentryActive&&String(t?.reentryStage||'')==='READY',executionConfirmed=reentryActive?reentryReady:status==='CONFIRMED';
  const zone=t?(testCurrentEntryZone(t)||t.strategyProfile?.entryZone||t.setup?.entryZone||null):null,zl=manualFinite(zone?.low??t?.setup?.zoneLow),zh=manualFinite(zone?.high??t?.setup?.zoneHigh);
  const normalEntry=zl!=null&&zh!=null?(zl+zh)/2:(manualFinite(t?.confirmationPrice)??manualFinite(t?.currentPrice)??manualFinite(idea.price));
  const entry=reentryReady?(manualFinite(t?.reentryEntryPrice)??normalEntry):normalEntry,stop=reentryReady?(manualFinite(t?.reentryStop)??manualFinite(t?.reentryInvalidation)):(manualFinite(t?.structureProtection)??manualFinite(t?.stop)??manualFinite(t?.setup?.invalidation));
  const sign=direction==='SHORT'?-1:1,risk=entry!=null&&stop!=null?Math.abs(entry-stop):null,target1=reentryReady?manualFinite(t?.reentryTarget1R):manualFinite(t?.target1R),target2=!reentryReady?manualFinite(t?.target15R):null,target2Final=target2??(entry!=null&&risk!=null?entry+sign*risk*1.5:null),rr=entry!=null&&stop!=null&&target2Final!=null&&risk>0?sign*(target2Final-entry)/risk:null;
  const shadow=manualShadowEvidence(t,direction,regime,strategy.id||''),blockers=Array.isArray(tier?.blockers)?tier.blockers:[],lc=t?.lastCheck||{},ev=structure?.evidence||{},monitor=String(t?.monitorState||'WATCHING');
  const reclaimConfirmed=st!=='OPPORTUNITY'||ev.reclaim15===true||ev.reclaim5===true||ev.wickSweep===true;
  const structureForA=st==='INTACT'||(st==='RECLAIMING'&&executionConfirmed)||(st==='OPPORTUNITY'&&executionConfirmed&&reclaimConfirmed);
  let score=rankScore*.24+((manualFinite(tier?.score)??manualFinite(t?.monitorScore)??55))*0.24+structureHealth*.18+coverage*.08+confidence*.08+progress*.08+(calRate??50)*.06+50*.04+shadow.adjustment;
  if(executionConfirmed)score+=6;else if(status==='TOUCHING'||String(t?.reentryStage||'')==='TOUCHING')score+=1;else score-=4;
  if(st==='INTACT')score+=4;else if(st==='RECLAIMING')score-=2;else if(st==='OPPORTUNITY')score+=reclaimConfirmed?1:-4;else if(st==='DAMAGED')score-=12;else if(st==='DESTROYED')score-=35;else score-=8;
  if(rr!=null){if(rr>=1.8)score+=4;else if(rr>=1.5)score+=2;else if(rr<1)score-=18;else if(rr<1.25)score-=8}
  if(ageMs>120_000)score-=8;if(ageMs>300_000)score-=20;if(monitor==='WEAKENING')score-=12;if(Number(lc.chaseAtr)>.45)score-=8;if(Number(lc.chaseAtr)>.70)score-=10;if(blockers.length)score-=Math.min(18,blockers.length*5);
  score=Math.round(Math.max(0,Math.min(100,score)));
  const hardC=!t||st==='DESTROYED'||ageMs>300_000||(rr!=null&&rr<1)||['DROPPED','EXPIRED','LOSS','WIN','TIMEOUT'].includes(status)||(status==='INVALID'&&st!=='RECLAIMING'&&st!=='OPPORTUNITY');
  const aReady=!hardC&&executionConfirmed&&ageMs<=120_000&&coverage>=78&&confidence>=72&&progress>=72&&structureForA&&(rr==null||rr>=1.5)&&blockers.length===0&&monitor!=='WEAKENING'&&Number(lc.chaseAtr||0)<=.45&&shadow.adjustment>-3&&score>=78;
  let grade=aReady?'A':(!hardC&&score>=60?'B':'C');if(st==='DAMAGED'&&grade==='A')grade='B';if(st==='RECLAIMING'&&!executionConfirmed&&grade==='A')grade='B';if(st==='OPPORTUNITY'&&!reclaimConfirmed&&grade==='A')grade='B';
  const reasons=[];const risks=[];
  reasons.push('建議排名 #'+rank+' · '+rankScore.toFixed(0)+'分');
  if(t)reasons.push('觀察完成度 '+Math.round(progress)+'% · '+(reentryActive?('二次進場 '+String(t.reentryStage||'等待')):status));else risks.push('尚無完整觀察追蹤，不能列 A');
  if(structure)reasons.push('結構 '+(structure.label||st)+' · '+Math.round(structureHealth)+'分'+(Number(structure.learning?.adjustment||0)!==0?' · 學習 '+(Number(structure.learning.adjustment)>0?'+':'')+Number(structure.learning.adjustment):''));else risks.push('Structure V2 尚未完成');
  if(shadow.adjustment<=-3)risks.push('同類 Shadow 實績偏弱，A級封頂');if(shadow.sample)reasons.push('Shadow '+shadow.sample+'筆 · 命中 '+(shadow.hitRate==null?'—':shadow.hitRate.toFixed(1)+'%')+' · PF '+(shadow.profitFactor==null?'—':shadow.profitFactor.toFixed(2)));else risks.push('同類 Shadow 樣本不足');
  if(rr!=null)reasons.push('TP2 RR '+rr.toFixed(2));else risks.push('RR 尚未建立');
  if(ageMs>120_000)risks.push('判讀已超過2分鐘');if(ageMs>300_000)risks.push('判讀超過5分鐘，降 C');if(st==='DAMAGED')risks.push('結構受損，先等收復');if(st==='RECLAIMING'&&!executionConfirmed)risks.push('結構仍在收復，未完成進場確認');if(reentryActive&&!reentryReady)risks.push('第一段已達標；只等二次回踩 READY，不追價');if(st==='OPPORTUNITY'&&!reclaimConfirmed)risks.push('深回踩尚未出現收復證據');if(st==='DESTROYED')risks.push('結構徹底破壞');if(monitor==='WEAKENING')risks.push('目前轉弱');if(blockers.length)risks.push(...blockers.slice(0,3));if(Number(lc.chaseAtr)>.45)risks.push('目前價格離建議區偏遠，不追價');if(coverage<78||confidence<72)risks.push('資料完整/可信度不足 A 級');
  const id=manualOpportunityId(idea,t),recent=actualTrades.find(x=>x?.version==='V10.2.6'&&x.manualOpportunityId===id)||null;
  return {
    id,grade,executionScore:score,generatedAt:new Date().toISOString(),evaluatedAt:evaluatedAt||null,rank,symbol:idea.symbol,direction,rankScore:Number(rankScore.toFixed(1)),modelScore:manualFinite(idea.modelScore),estimatedWinRate:manualFinite(idea.estimatedWinRate),historicalHitRate:manualFinite(idea.historicalHitRate),backtestSample:Number(idea.backtestSample||0),calibratedWinRate:calRate,notificationTier:String(tier?.tier||'').toUpperCase()||null,observationProgress:progress,
    freshnessAgeMs:ageMs,freshness:ageMs<=90_000?'LIVE':ageMs<=180_000?'DELAYED':'STALE',
    structure:structure?{state:st,label:structure.label,health:manualFinite(structure.health),confidence:manualFinite(structure.confidence),pattern:structure.pattern,learningAdjustment:manualFinite(structure.learning?.adjustment),learningActive:structure.learning?.active===true,reasons:(structure.reasons||[]).slice(0,4)}:null,
    shadow:{sample:shadow.sample,hitRate:shadow.hitRate,profitFactor:shadow.profitFactor,expectancyR:shadow.expectancyR,level:shadow.level,adjustment:shadow.adjustment},dataHealth:{coverage,confidence},
    entry:{price:entry,zoneLow:zl,zoneHigh:zh,stop,target:target1,target2:target2Final,rr:rr==null?null:Number(rr.toFixed(2)),currentPrice:manualFinite(realtimeBestPrice(idea.symbol))??manualFinite(idea.price)},
    signalKey:t?.key||null,strategyId:String(strategy?.id||''),strategyLabel:String(strategy?.label||''),marketRegime:regime,reasons:reasons.slice(0,7),risks:[...new Set(risks)].slice(0,8),
    trade:recent?{id:recent.id,status:recent.status,firstOutcome:recent.firstOutcome,result:recent.result,createdAt:recent.createdAt,estimatedPnl:recent.estimatedPnl}:null
  };
}
async function manualOpportunityResponse(force=false){
  const now=Date.now();if(!force&&manualOpportunityCache.data&&now-manualOpportunityCache.at<20_000)return manualOpportunityCache.data;
  const ideas=await getRankedIdeas(),rows=(ideas.rows||[]).slice(0,12).map((x,i)=>manualOpportunityOne(x,i+1,ideas.generatedAt)).sort((a,b)=>(({A:3,B:2,C:1}[b.grade]||0)-({A:3,B:2,C:1}[a.grade]||0))||b.executionScore-a.executionScore||a.rank-b.rank);
  const data={ok:true,version:'V2.6.3',generatedAt:new Date().toISOString(),ideasGeneratedAt:ideas.generatedAt,stale:ideas.stale===true,methodology:'建議排名＋觀察/通知閘門＋Structure V2＋Shadow 實測＋資料新鮮度＋TP2 RR。A/B/C 是手動執行優先級，不是保證勝率。',stats:manualActualBreakdown(),counts:{A:rows.filter(x=>x.grade==='A').length,B:rows.filter(x=>x.grade==='B').length,C:rows.filter(x=>x.grade==='C').length},rows};
  manualOpportunityCache={at:now,data};return data;
}
async function manualOpportunityLoop(){
  if(manualOpportunityBusy){manualOpportunityTimer=setTimeout(manualOpportunityLoop,MANUAL_MODE_REFRESH_MS);return}
  manualOpportunityBusy=true;
  try{
    const data=await manualOpportunityResponse(true),prefs=manualPrefRows(),subs=loadSubRecords(),byEndpoint=new Map(subs.map(x=>[x.endpoint,x])),now=Date.now();let dirty=false;
    for(const pref of prefs){
      if(pref?.enabled!==true)continue;const rec=byEndpoint.get(pref.endpoint);if(!rec?.subscription)continue;pref.lastSent=pref.lastSent&&typeof pref.lastSent==='object'?pref.lastSent:{};
      for(const row of data.rows.slice(0,8)){
        if(!manualPrefAllows(pref,row.grade)||row.freshness==='STALE'||row.trade?.status==='ACTIVE')continue;
        const tag=[row.symbol,row.direction,row.grade].join(':'),last=Number(pref.lastSent[tag]||0);if(last&&now-last<MANUAL_MODE_NOTIFY_COOLDOWN_MS)continue;
        try{
          const body='執行 '+row.executionScore+'分｜'+(row.structure?.label||'等待結構')+(row.entry?.rr?'｜TP2 RR '+row.entry.rr:'')+'｜手動篩選，非自動進場';
          await webpush.sendNotification(rec.subscription,JSON.stringify({title:'手動 '+row.grade+'級｜'+row.symbol+' '+(row.direction==='SHORT'?'做空':'做多'),body,tag:'manual-'+tag,renotify:false,data:{url:'/?page=ideas&manual=1'}}),{TTL:180,urgency:row.grade==='A'?'high':'normal'});
          pref.lastSent[tag]=now;dirty=true;
        }catch(e){if([404,410].includes(e?.statusCode)){pref.enabled=false;dirty=true}}
      }
    }
    if(dirty)manualSavePrefs(prefs);
  }catch(e){console.warn('[manual-v263]',String(e?.message||e))}
  finally{manualOpportunityBusy=false;manualOpportunityTimer=setTimeout(manualOpportunityLoop,MANUAL_MODE_REFRESH_MS);manualOpportunityTimer.unref?.()}
}

app.get('/api/manual-opportunities',async(req,res)=>{try{res.json(await manualOpportunityResponse(String(req.query?.force||'')==='1'))}catch(e){res.status(503).json({ok:false,error:String(e?.message||e)})}});
app.get('/api/manual-preferences',(req,res)=>{const endpoint=String(req.query?.endpoint||'');const p=manualPrefRows().find(x=>x.endpoint===endpoint);res.json({ok:true,enabled:p?.enabled===true,mode:manualNotifyMode(p?.mode)})});
app.post('/api/manual-preferences',(req,res)=>{const endpoint=String(req.body?.endpoint||'');if(!endpoint)return res.status(400).json({ok:false,error:'MISSING_ENDPOINT'});const rows=manualPrefRows(),idx=rows.findIndex(x=>x.endpoint===endpoint),old=idx>=0?rows[idx]:{},next={...old,endpoint,enabled:req.body?.enabled===true,mode:manualNotifyMode(req.body?.mode),updatedAt:new Date().toISOString(),lastSent:old.lastSent&&typeof old.lastSent==='object'?old.lastSent:{}};if(idx>=0)rows[idx]=next;else rows.push(next);manualSavePrefs(rows);res.json({ok:true,enabled:next.enabled,mode:next.mode})});
