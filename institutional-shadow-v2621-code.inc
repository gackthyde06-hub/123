/* INSTITUTIONAL_SHADOW_EDGE_V2621
 * Institutional mentor layer.
 * Separates alpha (directional edge) from readiness/execution and risk.
 * Uses net-of-cost Shadow outcomes with de-correlation and conservative sample gates.
 */
const SHADOW_EDGE_VERSION_V2621='V2.6.21';
const SHADOW_EDGE_MIN_SAMPLE_V2621=Math.max(16,Math.min(60,Number(process.env.SHADOW_EDGE_MIN_SAMPLE||20)));
const SHADOW_EDGE_STRATEGY_SAMPLE_V2621=Math.max(24,Math.min(100,Number(process.env.SHADOW_EDGE_STRATEGY_SAMPLE||30)));
const SHADOW_EDGE_A_MIN_V2621=Math.max(56,Math.min(78,Number(process.env.SHADOW_EDGE_A_MIN||60)));
const SHADOW_EDGE_B_MIN_V2621=Math.max(44,Math.min(SHADOW_EDGE_A_MIN_V2621-2,Number(process.env.SHADOW_EDGE_B_MIN||48)));
const SHADOW_EDGE_A_COST_RATIO_V2621=Math.max(.20,Math.min(.50,Number(process.env.SHADOW_EDGE_A_COST_RATIO||.35)));
const SHADOW_EDGE_B_COST_RATIO_V2621=Math.max(SHADOW_EDGE_A_COST_RATIO_V2621,Math.min(.80,Number(process.env.SHADOW_EDGE_B_COST_RATIO||.60)));

function edgeNumV2621(v){const n=Number(v);return Number.isFinite(n)?n:null}
function edgeAssetV2621(x){try{return String(x?.assetClass||assetClassForSymbolV2612(x?.symbol)||'CRYPTO').toUpperCase()}catch{return String(x?.assetClass||'CRYPTO').toUpperCase()}}
function edgeRiskPctV2621(x){const e=edgeNumV2621(x?.entryPrice),st=edgeNumV2621(x?.stop);return e>0&&st>0?Math.abs(st-e)/e*100:null}
function edgeNetRV2621(x){
  const nr=edgeNumV2621(x?.netR);if(nr!=null)return nr;
  const riskPct=edgeRiskPctV2621(x),netPct=edgeNumV2621(x?.netReturnPct);if(riskPct>0&&netPct!=null)return netPct/riskPct;
  const r=edgeNumV2621(x?.realizedR);if(r==null)return null;
  const bps=edgeNumV2621(x?.costBps)??PERF_ROUND_TRIP_COST_BPS;if(!(riskPct>0))return r;
  return r-((bps/100)/riskPct);
}
function edgeWilsonLowV2621(wins,n){if(!(n>0))return null;const z=1.281551565545,ph=wins/n,z2=z*z,den=1+z2/n,mid=ph+z2/(2*n),rad=z*Math.sqrt((ph*(1-ph)+z2/(4*n))/n);return Math.max(0,(mid-rad)/den)*100}
function edgeStatsV2621(rows){
  const a=(rows||[]).filter(x=>x?.status==='RESOLVED'&&x?.learningEligible!==false&&['WIN','LOSS','TIMEOUT'].includes(String(x?.result||''))),dec=a.filter(x=>['WIN','LOSS'].includes(x.result)),wins=dec.filter(x=>x.result==='WIN').length,losses=dec.length-wins,nr=a.map(edgeNetRV2621).filter(Number.isFinite),profit=nr.filter(v=>v>0).reduce((p,v)=>p+v,0),loss=Math.abs(nr.filter(v=>v<0).reduce((p,v)=>p+v,0)),hit=dec.length?wins/dec.length*100:null,pf=loss>0?profit/loss:(profit>0?99:null),exp=nr.length?nr.reduce((p,v)=>p+v,0)/nr.length:null;
  return {sample:a.length,decisive:dec.length,wins,losses,timeouts:a.length-dec.length,hitRate:hit==null?null:Number(hit.toFixed(1)),wilsonLow:hit==null?null:Number(edgeWilsonLowV2621(wins,dec.length).toFixed(1)),netProfitFactor:pf==null?null:Number(pf.toFixed(2)),netExpectancyR:exp==null?null:Number(exp.toFixed(3))};
}
function edgeDedupV2621(rows,keyFn){const sorted=[...(rows||[])].sort((a,b)=>new Date(b.shadowAt||0)-new Date(a.shadowAt||0)),seen=new Map(),out=[];for(const r of sorted){const k=String(keyFn?.(r)||cleanFuturesSymbol(r?.symbol)||'NA'),ts=new Date(r?.shadowAt||0).getTime(),prev=seen.get(k);if(Number.isFinite(prev)&&Number.isFinite(ts)&&Math.abs(prev-ts)<STATE_LEARNING_DEDUP_MS)continue;seen.set(k,ts);out.push(r)}return out}
function edgeAdjFromStatsV2621(st,cap=8){const n=Number(st?.sample||0);if(n<SHADOW_EDGE_MIN_SAMPLE_V2621)return 0;let raw=0,low=Number(st?.wilsonLow??50),pf=Number(st?.netProfitFactor??1),exp=Number(st?.netExpectancyR??0);if(low>=56)raw+=3;else if(low>=51)raw+=1;else if(low<42)raw-=3;if(pf>=1.25)raw+=3;else if(pf>=1.05)raw+=1;else if(pf<.55)raw-=6;else if(pf<.80)raw-=4;if(exp>=.10)raw+=3;else if(exp>=.02)raw+=1;else if(exp<=-.25)raw-=5;else if(exp<=-.10)raw-=3;const conf=Math.min(1,Math.sqrt(n/100));return clamp(Math.round(raw*conf),-cap,cap)}
function edgeCostV2621(t){const entry=edgeNumV2621(t?.reentryEntryPrice)??edgeNumV2621(t?.confirmationPrice)??edgeNumV2621(t?.currentPrice)??edgeNumV2621(realtimeBestPrice(t?.symbol)),stop=edgeNumV2621(t?.reentryStop)??edgeNumV2621(t?.structureProtection)??edgeNumV2621(t?.stop)??edgeNumV2621(t?.setup?.invalidation);if(!(entry>0&&stop>0))return {riskPct:null,costPct:PERF_ROUND_TRIP_COST_BPS/100,ratio:null,adjustment:-2,aGate:false,bGate:false};const riskPct=Math.abs(entry-stop)/entry*100,costPct=PERF_ROUND_TRIP_COST_BPS/100,ratio=riskPct>0?costPct/riskPct:99;let adjustment=0;if(ratio<=.12)adjustment=4;else if(ratio<=.20)adjustment=2;else if(ratio<=.35)adjustment=0;else if(ratio<=.50)adjustment=-4;else if(ratio<=.65)adjustment=-8;else adjustment=-16;return {riskPct:Number(riskPct.toFixed(4)),costPct:Number(costPct.toFixed(4)),ratio:Number(ratio.toFixed(3)),adjustment,aGate:ratio<=SHADOW_EDGE_A_COST_RATIO_V2621,bGate:ratio<=SHADOW_EDGE_B_COST_RATIO_V2621}}
function edgeRowsV2621(){return shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'&&x.learningEligible!==false&&['WIN','LOSS','TIMEOUT'].includes(String(x.result||'')))}
function edgeStrategyMatchV2621(x,features){const a=String(x?.strategyId||''),b=String(features?.strategyId||''),la=String(x?.strategyLabel||''),lb=String(features?.strategyLabel||'');if(a&&b&&a!=='UNKNOWN'&&b!=='UNKNOWN')return a===b;return la&&lb?la===lb:a===b}
function institutionalEdgeV2621(t){
  const features=stateLearningFeatures(t),asset=String(features.assetClass||edgeAssetV2621(t)),all=edgeRowsV2621(),sameAsset=all.filter(x=>edgeAssetV2621(x)===asset),strategyId=String(features.strategyId||''),direction=String(features.direction||t?.direction||'LONG'),regime=String(features.regime||'UNKNOWN');
  const exact=edgeDedupV2621(sameAsset.filter(x=>edgeStrategyMatchV2621(x,features)&&String(x.direction||'')===direction&&String(x.marketRegime||'')===regime),x=>cleanFuturesSymbol(x.symbol));
  const strategyDir=edgeDedupV2621(sameAsset.filter(x=>edgeStrategyMatchV2621(x,features)&&String(x.direction||'')===direction),x=>cleanFuturesSymbol(x.symbol));
  const strategyAll=edgeDedupV2621(sameAsset.filter(x=>edgeStrategyMatchV2621(x,features)),x=>`${cleanFuturesSymbol(x.symbol)}|${x.direction}`);
  const directionRows=edgeDedupV2621(sameAsset.filter(x=>String(x.direction||'')===direction),x=>`${cleanFuturesSymbol(x.symbol)}|${x.strategyId}`);
  let chosen=exact,level='同資產·策略×狀態×方向';if(chosen.length<SHADOW_EDGE_MIN_SAMPLE_V2621){chosen=strategyDir;level='同資產·策略×方向'}if(chosen.length<SHADOW_EDGE_STRATEGY_SAMPLE_V2621){chosen=strategyAll;level='同資產·策略'}if(chosen.length<SHADOW_EDGE_STRATEGY_SAMPLE_V2621){chosen=directionRows;level='同資產·方向'}
  const stats=edgeStatsV2621(chosen),strategyStats=edgeStatsV2621(strategyAll),stateAdj=edgeAdjFromStatsV2621(stats,6),strategyAdj=edgeAdjFromStatsV2621(strategyStats,8),cost=edgeCostV2621(t),ev=t?.monitorEvidence||t?.lastCheck||{};
  let score=55+stateAdj*2+strategyAdj*1.4+cost.adjustment;
  if(regime==='UNKNOWN')score-=5;
  if(ev.adverseMarket)score-=18;if(ev.adverse1h)score-=7;if(ev.adverse30)score-=4;if(String(ev.adlRisk||'').toLowerCase()==='high')score-=12;if(ev.fundingCrowded===true)score-=8;
  score=clamp(Math.round(score),0,100);
  const poorStrategy=Number(strategyStats.sample||0)>=SHADOW_EDGE_STRATEGY_SAMPLE_V2621&&(Number(strategyStats.netProfitFactor??1)<.80||Number(strategyStats.netExpectancyR??0)<-.10);
  const severeStrategy=Number(strategyStats.sample||0)>=SHADOW_EDGE_STRATEGY_SAMPLE_V2621&&(Number(strategyStats.netProfitFactor??1)<.55||Number(strategyStats.netExpectancyR??0)<-.25);
  const label=String(features.strategyLabel||'');const breakoutPoor=label.includes('突破回測')&&poorStrategy,momentumPoor=label.includes('動能')&&poorStrategy;
  const hardBlockReasons=[];if(cost.ratio!=null&&cost.ratio>.65)hardBlockReasons.push('成本/停損比過高');if(ev.adverseMarket)hardBlockReasons.push(asset==='TRADFI'?'美股大盤逆向':'BTC/ETH大盤逆向');if(severeStrategy&&breakoutPoor)hardBlockReasons.push('突破回測淨期望顯著為負');
  const capA=regime==='UNKNOWN'||poorStrategy||breakoutPoor||momentumPoor||!cost.aGate||stateAdj<=-4;
  const learningAdjustment=clamp(Math.round(stateAdj+strategyAdj*.55),-STATE_LEARNING_MAX_BONUS,STATE_LEARNING_MAX_BONUS);
  return {version:SHADOW_EDGE_VERSION_V2621,edgeScore:score,level,sample:Number(stats.sample||0),stats,strategyStats,stateAdjustment:stateAdj,strategyAdjustment:strategyAdj,learningAdjustment,cost,costGateA:cost.aGate,costGateB:cost.bGate,capA,hardBlock:hardBlockReasons.length>0,hardBlockReasons,poorStrategy,severeStrategy,assetClass:asset,regime,strategyId,strategyLabel:features.strategyLabel,direction};
}
