export const WORTH_WATCH_VERSION_V2682='V2.6.82';
export const WORTH_WATCH_DEFAULTS_V2682=Object.freeze({
  maxVisibleB:3,
  maxAgeMs:180_000,
  minCoverage:72,
  minConfidence:65,
  minProgress:80,
  minRr:1.15,
  maxChaseAtr:.45,
  maxFailureRisk:.40,
  negativeSupport:8,
  minBootcampExpR:-.12,
  minBootcampPf:.82,
  primaryBands:['PRIME','WATCH'],
  relativeMinScore:56,
  relativeMinWin:51.5,
  relativeMinHealth:90,
  relativeMinProgress:84,
  relativeMaxRank:15,
  relativeMaxChaseAtr:.30,
  primaryMinScore:58,
  primaryMinWin:52,
});

const HARD_TEXT_V2682=/價差>|高波動價差|ADL高風險|Funding擁擠|結構失效|結構徹底破壞|資料完整度過低|資料可信度過低|跨交易所趨勢逆向|BTC\/ETH大盤逆向|清算行情山寨|機構風險硬阻擋|30分＋1小時同步逆向/i;
const TERMINAL_V2682=new Set(['NO_TRACKER','DROPPED','EXPIRED','LOSS','WIN','TIMEOUT']);
const GOOD_STRUCTURE_V2682=new Set(['INTACT','RECLAIMING','OPPORTUNITY']);

function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function clamp(v,a=0,b=100){const n=Number(v);return Math.max(a,Math.min(b,Number.isFinite(n)?n:0))}
function uniq(a){return [...new Set((a||[]).filter(Boolean).map(x=>String(x)))]}
function rowText(row){return uniq([...(row?.blockers||[]),...(row?.candidateHardBlockers||[]),...(row?.candidateSoftWait||[]),...(row?.risks||[])]).join('｜')}
function baseSymbol(symbol){return String(symbol||'').toUpperCase().replace(/USDT$/,'').replace(/^1000(?=[A-Z])/,'')}
function bootcampMetrics(bootcamp){
  const b=bootcamp&&typeof bootcamp==='object'?bootcamp:{};
  return {
    support:finite(b.support),exp:finite(b.netExpectancyR),pf:finite(b.netProfitFactor),failure:finite(b.strengthFailureRisk)
  };
}
function bandBoost(band){return band==='PRIME'?6:band==='WATCH'?3:band==='RELATIVE'?0:-4}
function structureFloor(state){return state==='INTACT'?80:state==='RECLAIMING'?74:state==='OPPORTUNITY'?72:101}

export function evaluateWorthWatchV2682(row,bootcamp=null,overrides={}){
  const cfg={...WORTH_WATCH_DEFAULTS_V2682,...(overrides||{})};
  const blockers=[],notes=[];
  if(!row||row.candidate!==true)blockers.push('不是穩定候選');
  if(row?.trade?.status==='ACTIVE')blockers.push('已有實際建倉追蹤');
  const status=String(row?.trackerStatus||'NO_TRACKER').toUpperCase();
  if(TERMINAL_V2682.has(status))blockers.push('tracker 不在即時觀察狀態');
  const age=Math.max(0,Number(row?.freshnessAgeMs||0));
  if(age>cfg.maxAgeMs)blockers.push('判讀超過3分鐘');

  const hard=uniq(row?.candidateHardBlockers||[]);
  if(hard.length)blockers.push(...hard.map(x=>'硬風險：'+x));
  const allText=rowText(row);
  if(HARD_TEXT_V2682.test(allText))blockers.push('仍有硬風控阻擋');

  const coverage=finite(row?.dataHealth?.coverage),confidence=finite(row?.dataHealth?.confidence);
  if(coverage==null||coverage<cfg.minCoverage)blockers.push(`資料完整度<${cfg.minCoverage}`);
  if(confidence==null||confidence<cfg.minConfidence)blockers.push(`資料可信度<${cfg.minConfidence}`);

  const st=String(row?.structure?.state||'UNKNOWN').toUpperCase(),health=finite(row?.structure?.health),sconf=finite(row?.structure?.confidence);
  if(!GOOD_STRUCTURE_V2682.has(st))blockers.push('結構不是存活/收復/機會狀態');
  if(health==null||health<structureFloor(st))blockers.push('結構健康度不足');
  if(sconf!=null&&sconf<88)blockers.push('結構可信度不足');

  const progress=finite(row?.observationProgress)??0;
  if(progress<cfg.minProgress)blockers.push(`觀察完成度<${cfg.minProgress}`);
  if(String(row?.monitorState||'').toUpperCase()==='WEAKENING'||/目前轉弱/.test(allText))blockers.push('目前轉弱');
  if(/第一段已達標；只等二次回踩/.test(allText)&&row?.reentryReady!==true)blockers.push('第一段已達標，等二次回踩');
  if(/判讀已超過|判讀超過5分鐘/.test(allText))blockers.push('判讀已過期');

  const chase=finite(row?.chaseAtr);
  if(chase!=null&&chase>cfg.maxChaseAtr)blockers.push(`距離建議區>${cfg.maxChaseAtr.toFixed(2)}ATR`);
  const rr=finite(row?.entry?.rr);
  if(rr!=null&&rr<cfg.minRr)blockers.push(`TP2 RR<${cfg.minRr.toFixed(2)}`);

  const regime=String(row?.marketRegime||'UNKNOWN').toUpperCase(),sym=baseSymbol(row?.symbol);
  if(['HIGH_VOL','LIQUIDATION'].includes(regime)&&!['BTC','ETH'].includes(sym))blockers.push('高波動/清算環境山寨不升B');
  if(['HIGH_VOL','LIQUIDATION'].includes(regime)&&['BTC','ETH'].includes(sym)&&(health??0)<90)blockers.push('高波動主流需結構>=90');
  const strategy=String(row?.strategyLabel||'');
  if(strategy==='流動性掃盤反轉'&&!['RECLAIMING','OPPORTUNITY'].includes(st))blockers.push('掃流動性策略需先有收復證據');

  const bm=bootcampMetrics(bootcamp);
  if((bm.support??0)>=cfg.negativeSupport){
    if(bm.exp!=null&&bm.exp<cfg.minBootcampExpR)blockers.push('同型態 Shadow 淨期望明顯負');
    if(bm.pf!=null&&bm.pf<cfg.minBootcampPf)blockers.push('同型態 Shadow PF 明顯偏弱');
  }
  if(bm.failure!=null&&bm.failure>cfg.maxFailureRisk)blockers.push('強轉弱風險過高');

  const band=String(row?.candidateBand||'DROP').toUpperCase(),candidateScore=finite(row?.candidateScore)??0,candidateWin=finite(row?.candidateWinRate)??0,rank=finite(row?.rank)??99,rankScore=finite(row?.rankScore)??0;
  let mode='NONE';
  if(cfg.primaryBands.includes(band)&&candidateScore>=cfg.primaryMinScore&&candidateWin>=cfg.primaryMinWin)mode='PRIMARY';
  else if(band==='RELATIVE'&&candidateScore>=cfg.relativeMinScore&&candidateWin>=cfg.relativeMinWin&&(health??0)>=cfg.relativeMinHealth&&progress>=cfg.relativeMinProgress&&rank<=cfg.relativeMaxRank&&(chase==null||chase<=cfg.relativeMaxChaseAtr))mode='RELATIVE_FALLBACK';
  else blockers.push('候選相對品質未到B級值得看');

  let worth=candidateScore*.30+candidateWin*.18+(health??0)*.20+progress*.13+(coverage??0)*.06+(confidence??0)*.05+rankScore*.05+bandBoost(band);
  if(chase!=null)worth-=Math.max(0,chase-.10)*10;
  if(st==='RECLAIMING'||st==='OPPORTUNITY')worth+=1.5;
  if(bm.exp!=null)worth+=clamp(bm.exp*12,-4,4);
  if(bm.pf!=null){if(bm.pf>=1.10)worth+=1.5;else if(bm.pf<.95)worth-=1.5}
  worth=Number(clamp(worth,0,100).toFixed(1));

  if(mode==='PRIMARY'&&worth<68)blockers.push('綜合值得看分<68');
  if(mode==='RELATIVE_FALLBACK'&&worth<72)blockers.push('相對候選綜合分<72');
  if(!blockers.length){
    notes.push(`候選${band}｜值得看 ${worth.toFixed(1)}分`);
    notes.push(`Structure ${st} ${Math.round(health??0)}｜完成度 ${Math.round(progress)}%`);
    if(bm.support!=null)notes.push(`Shadow 支持 ${Math.round(bm.support)}｜Exp ${bm.exp==null?'—':(bm.exp>=0?'+':'')+bm.exp.toFixed(2)+'R'}｜PF ${bm.pf==null?'—':bm.pf.toFixed(2)}`);
    if(row?.strategyLabel)notes.push(String(row.strategyLabel));
  }
  return {
    eligible:blockers.length===0,
    version:WORTH_WATCH_VERSION_V2682,
    mode,
    score:worth,
    band,
    blockers:uniq(blockers),
    notes:uniq(notes),
    metrics:{candidateScore,candidateWin,rank,rankScore,progress,coverage,confidence,structureState:st,structureHealth:health,structureConfidence:sconf,chaseAtr:chase,rr,marketRegime:regime,strategyLabel:strategy,...bm}
  };
}

export function selectWorthWatchV2682(items,{max=WORTH_WATCH_DEFAULTS_V2682.maxVisibleB}={}){
  const a=(Array.isArray(items)?items:[]).filter(x=>x?.decision?.eligible===true).sort((a,b)=>{
    const ma=a.decision.mode==='PRIMARY'?1:0,mb=b.decision.mode==='PRIMARY'?1:0;
    return mb-ma||Number(b.decision.score||0)-Number(a.decision.score||0)||Number(a?.row?.rank||99)-Number(b?.row?.rank||99);
  });
  const out=[],seen=new Set();let fallback=0;
  for(const x of a){
    const key=[String(x?.row?.symbol||''),String(x?.row?.direction||'')].join('|');if(seen.has(key))continue;
    if(x.decision.mode==='RELATIVE_FALLBACK'&&fallback>=1)continue;
    out.push(x);seen.add(key);if(x.decision.mode==='RELATIVE_FALLBACK')fallback++;
    if(out.length>=Math.max(1,Number(max)||3))break;
  }
  return out;
}
