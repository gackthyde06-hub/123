import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATCH_MARKER = 'STRUCTURE_ENGINE_V21_20260902';

function replaceOnce(source, needle, replacement, label, {required=true}={}) {
  const i = source.indexOf(needle);
  if (i < 0) {
    if (required) throw new Error(`[structure-v2] anchor missing: ${label}`);
    return source;
  }
  if (source.indexOf(needle, i + needle.length) >= 0) throw new Error(`[structure-v2] anchor ambiguous: ${label}`);
  return source.slice(0, i) + replacement + source.slice(i + needle.length);
}

function replaceRegexOnce(source, re, replacement, label, {required=true}={}) {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const matches = [...source.matchAll(new RegExp(re.source, flags))];
  if (matches.length !== 1) {
    if (!required && matches.length === 0) return source;
    throw new Error(`[structure-v2] ${label} matches=${matches.length}`);
  }
  return source.replace(re, replacement);
}

export function patchStructureEngineV2({ serverPath = process.env.STRUCTURE_V2_SERVER_PATH || path.join(__dirname, 'server.js') } = {}) {
  if (!fs.existsSync(serverPath)) throw new Error(`[structure-v2] server.js not found: ${serverPath}`);
  let src = fs.readFileSync(serverPath, 'utf8');
  if (src.includes(PATCH_MARKER)) {
    console.log('[structure-v2] already applied');
    return { changed:false, serverPath };
  }

  const original = src;
  try {
    const fileAnchor = "const ACTUAL_TRADE_FILE = path.join(DATA_DIR, 'actual-trades-v1026.json');";
    src = replaceOnce(src, fileAnchor, `${fileAnchor}\nconst STRUCTURE_LEARNING_FILE = path.join(DATA_DIR, 'structure-learning-v2.json');\nconst STRUCTURE_ENGINE_VERSION = 'S2.1.0';\nconst STRUCTURE_ENGINE_MARKER = '${PATCH_MARKER}';\nconst STRUCTURE_V2_MIN_SAMPLE = Math.max(12, Math.min(80, Number(process.env.STRUCTURE_V2_MIN_SAMPLE || 20)));\nconst STRUCTURE_V2_MAX_ADJUST = Math.max(2, Math.min(10, Number(process.env.STRUCTURE_V2_MAX_ADJUST || 8)));\nconst STRUCTURE_V2_EPISODE_MS = Math.max(15*60*1000, Math.min(2*60*60*1000, Number(process.env.STRUCTURE_V2_EPISODE_MS || 30*60*1000)));\nconst STRUCTURE_V2_HORIZON_MS = Math.max(90*60*1000, Math.min(8*60*60*1000, Number(process.env.STRUCTURE_V2_HORIZON_MS || 4*60*60*1000)));
const STRUCTURE_V2_NOTIFY_COOLDOWN_MS = Math.max(20*60*1000, Math.min(2*60*60*1000, Number(process.env.STRUCTURE_V2_NOTIFY_COOLDOWN_MS || 45*60*1000)));
const STRUCTURE_V2_NOTIFY_MIN_HEALTH = Math.max(55, Math.min(85, Number(process.env.STRUCTURE_V2_NOTIFY_MIN_HEALTH || 64)));
const STRUCTURE_V2_NOTIFY_MIN_CONFIDENCE = Math.max(55, Math.min(90, Number(process.env.STRUCTURE_V2_NOTIFY_MIN_CONFIDENCE || 65)));`, 'structure constants');

    const loadAnchor = "let actualTrades = Array.isArray(loadJson(ACTUAL_TRADE_FILE, [])) ? loadJson(ACTUAL_TRADE_FILE, []) : [];";
    src = replaceOnce(src, loadAnchor, `${loadAnchor}\nlet structureLearning = Array.isArray(loadJson(STRUCTURE_LEARNING_FILE, [])) ? loadJson(STRUCTURE_LEARNING_FILE, []) : [];\nlet structureLearningSaveTimer = null;\nlet structureLearningRevision = 1;`, 'structure load');

    // Price-only / Fib-only retracement is no longer allowed to declare a structure dead.
    const pullbackOld = `  const side = String(next.side || '').toUpperCase();\n  const invalidPrice = Number(next.invalidPrice);\n  const structuralInvalid = invalidPrice > 0 && (\n    side === 'SHORT' ? snapshot.marketPrice >= invalidPrice : snapshot.marketPrice <= invalidPrice\n  );\n\n  let eventType = null;\n  let reason = null;\n  if (!next.invalidSentAt && structuralInvalid) {\n    eventType = 'INVALIDATION';\n    reason = 'STRUCTURE';\n    next.invalidSentAt = new Date(now).toISOString();\n  } else if (snapshot.activated && !next.invalidSentAt && snapshot.retracementRatio >= PULLBACK_FIB_INVALID_RATIO) {\n    eventType = 'INVALIDATION';\n    reason = 'FIB_TOO_DEEP';\n    next.invalidSentAt = new Date(now).toISOString();\n    next.normalSentAt ||= next.invalidSentAt;\n    next.deepSentAt ||= next.invalidSentAt;\n  } else if (snapshot.activated && !next.deepSentAt && snapshot.retracementRatio >= PULLBACK_DEEP_RATIO) {\n    eventType = 'DEEP_PULLBACK';\n    reason = 'FIB_0618';\n    next.deepSentAt = new Date(now).toISOString();\n    next.normalSentAt ||= next.deepSentAt;\n  } else if (snapshot.activated && !next.normalSentAt && snapshot.retracementRatio >= PULLBACK_NORMAL_RATIO) {`;
    const pullbackNew = `  const side = String(next.side || '').toUpperCase();\n  const invalidPrice = Number(next.invalidPrice);\n  const structuralBreach = invalidPrice > 0 && (\n    side === 'SHORT' ? snapshot.marketPrice >= invalidPrice : snapshot.marketPrice <= invalidPrice\n  );\n  if (structuralBreach) next.structuralBreachSince ||= new Date(now).toISOString();\n  else { next.structuralBreachSince = null; next.structuralBreachPrice = null; }\n  if (structuralBreach) next.structuralBreachPrice = snapshot.marketPrice;\n\n  // Structure Engine V2 rule: a wick/touch, a price-only breach, or Fib 0.786 alone is NOT invalidation.\n  // The multi-timeframe structure engine below decides whether the market is merely damaged/reclaiming/opportunity or truly destroyed.\n  let eventType = null;\n  let reason = null;\n  if (snapshot.activated && !next.deepSentAt && snapshot.retracementRatio >= PULLBACK_FIB_INVALID_RATIO) {\n    eventType = 'DEEP_PULLBACK';\n    reason = 'FIB_0786_STRUCTURE_REVIEW';\n    next.deepSentAt = new Date(now).toISOString();\n    next.normalSentAt ||= next.deepSentAt;\n  } else if (snapshot.activated && !next.deepSentAt && snapshot.retracementRatio >= PULLBACK_DEEP_RATIO) {\n    eventType = 'DEEP_PULLBACK';\n    reason = 'FIB_0618';\n    next.deepSentAt = new Date(now).toISOString();\n    next.normalSentAt ||= next.deepSentAt;\n  } else if (snapshot.activated && !next.normalSentAt && snapshot.retracementRatio >= PULLBACK_NORMAL_RATIO) {`;
    src = replaceOnce(src, pullbackOld, pullbackNew, 'pullback false invalidation');

    const insertBeforeEntryStrategy = "function testEntryStrategy(t, statusLabel='') {";
    const structureCode = `
/* ${PATCH_MARKER}
   Structure Engine V2.1 — structure judgement is independent from notification strictness.
   Primary online sources stay Binance Copy BAPI + Binance Kline/WS; external mirrors are cross-checks, not truth.
   Deep pullback != invalidation. Wick != close. 5m damage != 15m/30m destruction. */
function scheduleStructureLearningSave(){
  if(structureLearningSaveTimer)return;
  structureLearningSaveTimer=setTimeout(()=>{structureLearningSaveTimer=null;structureLearning=structureLearning.slice(0,7000);saveJson(STRUCTURE_LEARNING_FILE,structureLearning)},1200);
  structureLearningSaveTimer.unref?.();
}
function structureV2Dir(t){return testSignalDirection(t?.direction)}
function structureV2Beyond(dir,price,level){return Number.isFinite(Number(price))&&Number.isFinite(Number(level))&&(dir>0?Number(price)<Number(level):Number(price)>Number(level))}
function structureV2Inside(dir,price,level){return Number.isFinite(Number(price))&&Number.isFinite(Number(level))&&(dir>0?Number(price)>=Number(level):Number(price)<=Number(level))}
function structureV2AssetClass(symbol){
  const b=String(symbol||'').toUpperCase().replace(/USDT$/,'');
  if(['XAU','XAG','WTI','BRENT','USOIL','UKOIL'].includes(b))return 'COMMODITY';
  if(/^(SOXL|SOXS|SKHYNIX|NVDA|TSLA|AAPL|MSFT|GOOGL|META|AMZN|AMD|MSTR|COIN|QQQ|SPY|VOO|NDX)/.test(b))return 'EQUITY_TOKEN';
  return 'CRYPTO';
}
function structureV2ProtectedSwing(rows,dir){
  const a=(rows||[]).slice(-80);if(a.length<12)return null;
  const sw=swingLevels(a,2),pts=dir>0?sw.lows:sw.highs,p=pts.at(-1)?.price;
  return Number.isFinite(Number(p))?Number(p):null;
}
function structureV2Retracement(t,price){
  const s=t?.setup||{},dir=structureV2Dir(t),lo=finiteMetric(s.impulseLow),hi=finiteMetric(s.impulseHigh),px=finiteMetric(price),range=(hi!=null&&lo!=null)?hi-lo:null;
  if(!(px>0&&range>0))return null;
  return clamp(dir>0?(hi-px)/range:(px-lo)/range,0,2.5);
}
function structureV2RetrBucket(r){if(!Number.isFinite(Number(r)))return 'NA';const x=Number(r);if(x<.382)return 'SHALLOW';if(x<.618)return 'NORMAL';if(x<.786)return 'DEEP';if(x<1)return 'VERY_DEEP';return 'BEYOND_IMPULSE'}
function structureV2TraderContext(t,now=Date.now()){
  const symbol=cleanFuturesSymbol(t?.symbol),side=String(t?.direction||'LONG').toUpperCase()==='SHORT'?'SHORT':'LONG',rows=recentEvents.filter(e=>e?.kind==='TRADER'&&e?.traderId===CORE_TRADER_ID&&e?.symbol===symbol&&e?.side===side).slice(0,30);
  const recent=rows.map(e=>({...e,_ms:new Date(e.ts||0).getTime()})).filter(e=>Number.isFinite(e._ms)&&now-e._ms<=6*60*60*1000);
  const last=recent[0]||null,lastAdd=recent.find(e=>e.type==='ADD')||null,lastReduce=recent.find(e=>e.type==='REDUCE')||null,lastClose=recent.find(e=>e.type==='CLOSE')||null;
  const age=x=>x?Math.max(0,(now-x._ms)/60000):null;
  const heldNow=!!states.get(CORE_TRADER_ID)?.positions?.has(positionKey(symbol,side));
  return {source:'Binance Copy BAPI/order_history + reconstructed live position',heldNow,lastAction:last?.type||null,lastActionAt:last?.ts||null,lastActionAgeMin:age(last),lastAddAt:lastAdd?.ts||null,lastAddAgeMin:age(lastAdd),lastReduceAt:lastReduce?.ts||null,lastReduceAgeMin:age(lastReduce),lastCloseAt:lastClose?.ts||null,lastCloseAgeMin:age(lastClose),recentAdds:recent.filter(e=>e.type==='ADD').length,recentReduces:recent.filter(e=>e.type==='REDUCE').length};
}
function structureV2Pattern({deep=false,veryDeep=false,wickSweep=false,reclaim15=false,break15=false,two15=false,break30=false,pocLost=false,pocReclaim=false}={}){
  if((deep||veryDeep)&&(wickSweep||reclaim15))return 'DEEP_RECLAIM';
  if(break15&&reclaim15)return 'FAILED_BREAK_RECLAIM';
  if(wickSweep)return 'LIQUIDITY_SWEEP';
  if(two15||break30)return 'STRUCTURE_BREAK';
  if(pocLost&&pocReclaim)return 'POC_RECLAIM';
  if(deep||veryDeep)return 'DEEP_RETRACE';
  return 'NORMAL_STRUCTURE';
}
function structureV2OutcomeSign(x){
  const o=String(x?.outcome||'');
  if(['STRUCTURE_HELD','RECLAIM_SUCCESS','DEEP_PULLBACK_SUCCESS','FALSE_INVALIDATION'].includes(o))return 1;
  if(['STRUCTURE_FAILED','DEEP_PULLBACK_FAILED','TRUE_INVALIDATION'].includes(o))return -1;
  return 0;
}
function structureV2Keys(t,state,bucket,assetClass=null,pattern=null){
  const strategy=t?.strategyAtConfirm||t?.strategyProfile||{},regime=String(t?.marketRegime||t?.lastCheck?.marketRegime||'UNKNOWN'),direction=String(t?.direction||'LONG'),asset=assetClass||structureV2AssetClass(t?.symbol),pat=pattern||'NA';
  return {detail:[asset,strategy.id||'UNKNOWN',regime,direction,state,bucket,pat].join('|'),core:[asset,strategy.id||'UNKNOWN',regime,direction,state].join('|'),broad:[asset,state,bucket].join('|')};
}
function structureV2EffectiveRows(){
  const rows=structureLearning.filter(x=>x?.version===STRUCTURE_ENGINE_VERSION&&x.status==='RESOLVED'&&x.learningEligible!==false&&structureV2OutcomeSign(x)!==0).sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
  const seenSymbol=new Map(),episodeCount=new Map(),out=[];
  for(const r of rows){
    const core=r?.keys?.core||r.keyCore||'NA',symbol=cleanFuturesSymbol(r.symbol),ts=new Date(r.at||0).getTime(),symbolKey=core+'|'+symbol,prev=seenSymbol.get(symbolKey);
    if(Number.isFinite(prev)&&Math.abs(prev-ts)<STRUCTURE_V2_EPISODE_MS)continue;
    seenSymbol.set(symbolKey,ts);
    const episode=String(r.marketEpisodeId||'NA'),episodeKey=core+'|'+episode,count=Number(episodeCount.get(episodeKey)||0);
    if(episode!=='NA'&&count>=3)continue; // cross-symbol correlation cap: max 3 samples per same market episode/state.
    episodeCount.set(episodeKey,count+1);out.push(r);
  }
  return out;
}
function structureV2Stats(rows){
  const a=(rows||[]).filter(x=>x?.status==='RESOLVED'&&structureV2OutcomeSign(x)!==0),wins=a.filter(x=>structureV2OutcomeSign(x)>0).length,losses=a.filter(x=>structureV2OutcomeSign(x)<0).length,sample=wins+losses;
  const rate=sample?wins/sample*100:null,smoothed=sample?(wins+8)/(sample+16)*100:null;
  const fav=a.map(x=>finiteMetric(x.maxFavorablePct)).filter(Number.isFinite),adv=a.map(x=>finiteMetric(x.maxAdversePct)).filter(Number.isFinite),avg=v=>v.length?v.reduce((s,x)=>s+x,0)/v.length:null;
  return {sample,wins,losses,hitRate:rate==null?null:Number(rate.toFixed(1)),smoothedHitRate:smoothed==null?null:Number(smoothed.toFixed(1)),avgFavorablePct:fav.length?Number(avg(fav).toFixed(3)):null,avgAdversePct:adv.length?Number(avg(adv).toFixed(3)):null};
}
function structureV2Learn(t,rawState,bucket,assetClass,pattern){
  const keys=structureV2Keys(t,rawState,bucket,assetClass,pattern),rows=structureV2EffectiveRows();
  for(const level of ['detail','core','broad']){
    const a=rows.filter(x=>String(x.keys?.[level]||'')===keys[level]),stats=structureV2Stats(a),n=stats.sample;
    if(n<STRUCTURE_V2_MIN_SAMPLE)continue;
    const cap=Math.min(STRUCTURE_V2_MAX_ADJUST,n>=100?8:n>=50?5:3),smooth=Number(stats.smoothedHitRate??50),raw=(smooth-55)*.16,adjustment=clamp(Math.round(raw),-cap,cap);
    return {active:true,level,key:keys[level],keys,adjustment,stats};
  }
  return {active:false,level:null,key:null,keys,adjustment:0,stats:{sample:0,wins:0,losses:0,hitRate:null,smoothedHitRate:null}};
}
function structureV2Assess(t,{rows5=[],rows15=[],rows30=[],rows1h=[],t5=null,t15=null,t30=null,t1h=null,deriv=null,micro=null,market=null}={}){
  const dir=structureV2Dir(t),last=rows5.at(-1),prev=rows5.at(-2),last15=rows15.at(-1),prev15=rows15.at(-2),last30=rows30.at(-1),px=finiteMetric(t?.livePrice)??finiteMetric(last?.close),orig=finiteMetric(t?.setup?.invalidation),protection=finiteMetric(t?.structureProtection)??finiteMetric(t?.stop)??orig,poc=finiteMetric(t?.setup?.poc15),atr5=Math.max(0,finiteMetric(t?.setup?.atr5)??finiteMetric(t5?.atr14)??0),atr15=Math.max(0,finiteMetric(t?.setup?.atr15)??finiteMetric(t15?.atr14)??0),retracement=structureV2Retracement(t,px),bucket=structureV2RetrBucket(retracement),assetClass=structureV2AssetClass(t?.symbol);
  const protected15=structureV2ProtectedSwing(rows15,dir),protected30=structureV2ProtectedSwing(rows30,dir),primary15=protected15??orig,primary30=protected30??primary15;
  const deep=Number.isFinite(retracement)&&retracement>=.618,veryDeep=Number.isFinite(retracement)&&retracement>=.786;
  const break5=protection!=null&&last?structureV2Beyond(dir,last.close,protection):false,two5=break5&&prev&&structureV2Beyond(dir,prev.close,protection);
  const softOrigBreak=orig!=null&&last15?structureV2Beyond(dir,last15.close,orig):false;
  const break15=primary15!=null&&last15?structureV2Beyond(dir,last15.close,primary15):softOrigBreak,two15=break15&&prev15&&structureV2Beyond(dir,prev15.close,primary15??orig);
  const break30=primary30!=null&&last30?structureV2Beyond(dir,last30.close,primary30):false;
  const wickSweep=primary15!=null&&last?(dir>0?Number(last.low)<primary15&&Number(last.close)>=primary15:Number(last.high)>primary15&&Number(last.close)<=primary15):false;
  const reclaim5=protection!=null&&last&&structureV2Inside(dir,last.close,protection)&&((prev&&structureV2Beyond(dir,prev.close,protection))||(dir>0?Number(last.low)<protection:Number(last.high)>protection));
  const reclaim15=primary15!=null&&last15&&structureV2Inside(dir,last15.close,primary15)&&((prev15&&structureV2Beyond(dir,prev15.close,primary15))||(dir>0?Number(last15.low)<primary15:Number(last15.high)>primary15));
  const pocLost=poc!=null&&last?structureV2Beyond(dir,last.close,poc):false,pocReclaim=poc!=null&&last&&structureV2Inside(dir,last.close,poc)&&prev&&structureV2Beyond(dir,prev.close,poc);
  const adverse30=t30?(dir>0?(t30.trend<0&&t30.momentum<=0):(t30.trend>0&&t30.momentum>=0)):false,adverse1h=t1h?(dir>0?(t1h.trend<0&&t1h.momentum<=0):(t1h.trend>0&&t1h.momentum>=0)):false,adverse15=t15?(dir>0?(t15.trend<0||(Number(t15.adx14)>=24&&Number(t15.diBias)<0)):(t15.trend>0||(Number(t15.adx14)>=24&&Number(t15.diBias)>0))):false;
  const marketOpposed=market?.dir!==0&&market?.dir!==dir,taker=finiteMetric(deriv?.takerRatio),depth=finiteMetric(micro?.depthImbalance),supportTaker=taker!=null?(dir>0?taker>=.99:taker<=1.01):false,supportDepth=depth!=null?(dir>0?depth>=-.02:depth<=.02):false,support15=!adverse15,support30=!adverse30,support1h=!adverse1h,supportMarket=!marketOpposed,trader=structureV2TraderContext(t),traderHeld=trader.heldNow===true,traderAdd=trader.lastAddAgeMin!=null&&trader.lastAddAgeMin<=120,traderReduce=trader.lastReduceAgeMin!=null&&trader.lastReduceAgeMin<=90,traderClose=trader.lastCloseAgeMin!=null&&trader.lastCloseAgeMin<=90;
  const supportCount=[supportTaker,supportDepth,support15,support30,support1h,supportMarket,traderHeld,traderAdd].filter(Boolean).length;
  const severeBreak=primary15!=null&&atr15>0&&last15?structureV2Beyond(dir,last15.close,primary15-dir*atr15*.55):false;
  const nearProtected=primary15!=null&&atr15>0&&px!=null?Math.abs(px-primary15)<=atr15*.55:false;
  const failedReclaim=break15&&!reclaim15&&!reclaim5;
  // DESTROYED needs acceptance, not a touch: protected 15m swing + 30m/1h agreement or a severe accepted break.
  const destroyed=(two15&&!reclaim15&&(break30||adverse1h)&&supportCount<=3)||(severeBreak&&break30&&adverse1h&&!reclaim15);
  const pattern=structureV2Pattern({deep,veryDeep,wickSweep,reclaim15,break15,two15,break30,pocLost,pocReclaim});
  let health=86;
  if(deep)health-=5;if(veryDeep)health-=6;if(pocLost)health-=4;if(two5)health-=5;if(softOrigBreak)health-=5;if(break15)health-=14;if(two15)health-=18;if(break30)health-=12;if(adverse15)health-=6;if(adverse30)health-=8;if(adverse1h)health-=10;if(marketOpposed)health-=4;if(failedReclaim)health-=6;
  if(wickSweep)health+=8;if(reclaim5)health+=7;if(reclaim15)health+=11;if(pocReclaim)health+=4;if(supportCount>=5)health+=5;if(traderHeld)health+=1;if(traderAdd)health+=3;if(traderReduce)health-=2;if(traderClose)health-=4;
  let rawState=destroyed?'DESTROYED':deep&&(wickSweep||reclaim5||reclaim15||nearProtected||traderAdd)&&supportCount>=3&&!break30&&!adverse1h?'OPPORTUNITY':(break15||two5||pocLost||deep||softOrigBreak)&&(reclaim5||reclaim15||pocReclaim)?'RECLAIMING':(break15||two5||pocLost||deep||softOrigBreak||adverse30||adverse1h)?'DAMAGED':'INTACT';
  const learning=structureV2Learn(t,rawState,bucket,assetClass,pattern);health=clamp(Math.round(health+Number(learning.adjustment||0)),0,100);
  let state=rawState;
  // Learning may refine only a borderline non-destroyed state. It can never resurrect confirmed destruction.
  if(rawState==='DAMAGED'&&deep&&learning.active&&learning.adjustment>=4&&(reclaim5||reclaim15||wickSweep||nearProtected)&&supportCount>=3)state='OPPORTUNITY';
  if(rawState==='OPPORTUNITY'&&learning.active&&learning.adjustment<=-4)state='RECLAIMING';
  const labels={INTACT:'完整',DAMAGED:'受損',RECLAIMING:'收復中',OPPORTUNITY:'深回踩機會',DESTROYED:'徹底破壞'},actions={INTACT:'結構正常，依原策略等進場區/確認',DAMAGED:'結構受損但未死，先等收復；不是直接判失效',RECLAIMING:'正在收復關鍵結構，等5分/15分收盤確認',OPPORTUNITY:'深回踩但主結構未確認破壞；確認收復後可視為較便宜的候選進場',DESTROYED:'15/30/60分已接受結構破壞，不進場'};
  const codes=[];if(deep)codes.push('DEEP_PULLBACK');if(veryDeep)codes.push('VERY_DEEP');if(wickSweep)codes.push('WICK_SWEEP');if(reclaim5)codes.push('RECLAIM_5M');if(reclaim15)codes.push('RECLAIM_15M');if(pocLost)codes.push('POC_LOST');if(pocReclaim)codes.push('POC_RECLAIM');if(softOrigBreak)codes.push('SOFT_INVALIDATION_BREACH');if(break15)codes.push('PROTECTED_SWING_15M_BREAK');if(two15)codes.push('BREAK_15M_X2');if(break30)codes.push('PROTECTED_SWING_30M_BREAK');if(adverse1h)codes.push('ADVERSE_1H');if(marketOpposed)codes.push('MARKET_OPPOSED');if(traderHeld)codes.push('CORE_TRADER_STILL_HOLDING');if(traderAdd)codes.push('CORE_TRADER_ADD_RECENT');if(traderReduce)codes.push('CORE_TRADER_REDUCE_RECENT');if(destroyed)codes.push('CONFIRMED_DESTROY');
  const reasons=[];if(wickSweep)reasons.push('掃過保護位但收盤收回');if(reclaim15)reasons.push('15分重新收復受保護 swing');else if(reclaim5)reasons.push('5分正在收復保護結構');if(deep)reasons.push(veryDeep?'回踩超過 0.786，但深回踩本身不等於失效':'回踩進入 0.618 深區');if(pocLost&&!pocReclaim)reasons.push('POC 暫時失守，只列弱化證據');if(two15)reasons.push('連續兩根15分收盤破受保護 swing');if(break30)reasons.push('30分也接受在破壞側');if(adverse1h)reasons.push('1H 高週期同步逆向');if(traderHeld&&!destroyed)reasons.push('核心交易員目前仍持有同方向，僅作弱佐證');if(traderAdd&&!destroyed)reasons.push('核心交易員近期仍加碼，僅作弱佐證');if(traderReduce&&!destroyed)reasons.push('核心交易員近期減碼，風險升高但不直接判死');if(supportCount>=4&&!destroyed)reasons.push('高週期/資金/深度多數仍支持原方向');
  const dataPct=Number(t?.dataHealth?.confidencePct),confidence=Number.isFinite(dataPct)?clamp(Math.round(dataPct*(learning.active?1:.92)),0,100):null;
  const episodeBucket=Math.floor(Date.now()/(15*60*1000)),marketEpisodeId=[assetClass,String(market?.regime||t?.marketRegime||'UNKNOWN'),String(t?.direction||'LONG'),episodeBucket].join('|');
  return {version:STRUCTURE_ENGINE_VERSION,at:new Date().toISOString(),state,rawState,label:labels[state],health,confidence,action:actions[state],hardInvalid:state==='DESTROYED',assetClass,pattern,marketEpisodeId,retracementRatio:Number.isFinite(retracement)?Number(retracement.toFixed(3)):null,retracementPct:Number.isFinite(retracement)?Number((retracement*100).toFixed(1)):null,retracementBucket:bucket,reasonCodes:codes,reasons:reasons.slice(0,7),learning,trader,levels:{originalInvalidation:orig,protection,poc15:poc,protectedSwing15:protected15,protectedSwing30:protected30,primary15,primary30},evidence:{deep,veryDeep,wickSweep,reclaim5,reclaim15,pocLost,pocReclaim,softOrigBreak,break5,two5,break15,two15,break30,adverse15,adverse30,adverse1h,marketOpposed,nearProtected,severeBreak,supportCount}};
}
function structureV2Finalize(rec,outcome,at=Date.now(),extra={}){
  if(!rec||rec.status!=='ACTIVE')return;rec.status='RESOLVED';rec.outcome=outcome;rec.outcomeAt=new Date(at).toISOString();rec.learningEligible=!['AMBIGUOUS','TIMEOUT','STATE_TRANSITION'].includes(outcome);Object.assign(rec,extra);structureLearningRevision++;scheduleStructureLearningSave();
}
function structureV2OutcomeLevels(t,a,price){
  const dir=structureV2Dir(t),atr5=Math.max(0,finiteMetric(t?.setup?.atr5)??0),atr15=Math.max(0,finiteMetric(t?.setup?.atr15)??0),anchor=Number(price),primary=finiteMetric(a?.levels?.primary15)??finiteMetric(a?.levels?.originalInvalidation)??anchor;
  const successMove=Math.max(atr5*.90,atr15*.28,anchor*.0012),failureMove=Math.max(atr15*.55,atr5*1.35,anchor*.0018);
  const successPrice=anchor+dir*successMove,failurePrice=primary-dir*failureMove;
  return {atr5AtEntry:atr5,atr15AtEntry:atr15,successMove,successPrice,failureMove,failurePrice,primaryLevel:primary};
}
function structureV2NewRecord(t,a,price){
  const now=new Date().toISOString(),strategy=t?.strategyAtConfirm||t?.strategyProfile||{},keys=structureV2Keys(t,a.rawState,a.retracementBucket,a.assetClass,a.pattern),id='structure-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),levels=structureV2OutcomeLevels(t,a,price);
  const rec={id,version:STRUCTURE_ENGINE_VERSION,at:now,signalKey:t.key,symbol:t.symbol,direction:t.direction,assetClass:a.assetClass,pattern:a.pattern,marketEpisodeId:a.marketEpisodeId,strategyId:strategy.id||null,strategyLabel:strategy.label||null,marketRegime:t.marketRegime||null,state:a.state,rawState:a.rawState,label:a.label,rawHealth:Number(a.health)-Number(a.learning?.adjustment||0),learningAdjustment:Number(a.learning?.adjustment||0),health:a.health,confidence:a.confidence,retracementRatio:a.retracementRatio,retracementBucket:a.retracementBucket,reasonCodes:a.reasonCodes,reasons:a.reasons,keys,price,entryPrice:finiteMetric(t.confirmationPrice),originalTradeTarget:finiteMetric(t.target1R),originalTradeStop:finiteMetric(t.stop),originalInvalidation:a.levels?.originalInvalidation??null,protection:a.levels?.protection??null,poc15:a.levels?.poc15??null,protectedSwing15:a.levels?.protectedSwing15??null,protectedSwing30:a.levels?.protectedSwing30??null,...levels,traderAtEntry:a.trader||null,traderLastAction:null,traderAddsDuringEpisode:0,traderReducesDuringEpisode:0,status:'ACTIVE',outcome:null,outcomeAt:null,learningEligible:true,lastPrice:price,lastAt:now,lastState:a.state,transitions:[],maxFavorablePct:0,maxAdversePct:0};
  structureLearning.unshift(rec);t.structureV2RecordId=id;t.structureV2RecordState=a.state;t.structureV2RecordAt=now;structureLearningRevision++;scheduleStructureLearningSave();return rec;
}
function structureV2Observe(t,a,{rows5=[]}={}){
  const last=rows5.at(-1),px=finiteMetric(t?.livePrice)??finiteMetric(last?.close);if(!(px>0)||!a)return;
  let rec=structureLearning.find(x=>x.id===t.structureV2RecordId&&x.status==='ACTIVE')||null;
  if(rec){
    const dir=structureV2Dir(t),anchor=finiteMetric(rec.price),fav=anchor>0?dir*(px-anchor)/anchor*100:0;rec.lastPrice=px;rec.lastAt=new Date().toISOString();rec.maxFavorablePct=Number(Math.max(Number(rec.maxFavorablePct||0),fav).toFixed(4));rec.maxAdversePct=Number(Math.max(Number(rec.maxAdversePct||0),-fav).toFixed(4));
    const trader=structureV2TraderContext(t),prevTraderAction=String(rec.traderLastAction||''),nowTraderAction=String(trader.lastAction||'');if(nowTraderAction&&nowTraderAction!==prevTraderAction){if(nowTraderAction==='ADD')rec.traderAddsDuringEpisode=Number(rec.traderAddsDuringEpisode||0)+1;if(nowTraderAction==='REDUCE')rec.traderReducesDuringEpisode=Number(rec.traderReducesDuringEpisode||0)+1;rec.traderLastAction=nowTraderAction;rec.traderLastActionAt=trader.lastActionAt||null;}
    const successPrice=finiteMetric(rec.successPrice),failurePrice=finiteMetric(rec.failurePrice),hitSuccess=successPrice!=null?(dir>0?px>=successPrice:px<=successPrice):false,hitFailure=failurePrice!=null?(dir>0?px<=failurePrice:px>=failurePrice):false,reclaimed=finiteMetric(rec.primaryLevel)!=null?structureV2Inside(dir,px,rec.primaryLevel):false;
    if(rec.state==='DESTROYED'){
      if(a.state!=='DESTROYED'&&reclaimed&&hitSuccess){structureV2Finalize(rec,'FALSE_INVALIDATION',Date.now(),{resolvedState:a.state});rec=null}
      else if(hitFailure||a.state==='DESTROYED'&&Number(rec.maxAdversePct||0)>=Math.max(.10,Math.abs(Number(rec.failureMove||0))/Math.max(1e-9,anchor)*100*.8)){structureV2Finalize(rec,'TRUE_INVALIDATION',Date.now(),{resolvedState:a.state});rec=null}
    }else{
      if(a.state==='DESTROYED'){structureV2Finalize(rec,rec.state==='OPPORTUNITY'?'DEEP_PULLBACK_FAILED':'STRUCTURE_FAILED',Date.now(),{resolvedState:a.state});rec=null}
      else if(hitFailure&&a.state==='DAMAGED'){structureV2Finalize(rec,rec.state==='OPPORTUNITY'?'DEEP_PULLBACK_FAILED':'STRUCTURE_FAILED',Date.now(),{resolvedState:a.state});rec=null}
      else if(hitSuccess){const o=rec.state==='OPPORTUNITY'?'DEEP_PULLBACK_SUCCESS':rec.state==='RECLAIMING'||rec.state==='DAMAGED'?'RECLAIM_SUCCESS':'STRUCTURE_HELD';structureV2Finalize(rec,o,Date.now(),{resolvedState:a.state});rec=null}
    }
    if(rec&&rec.lastState!==a.state){rec.transitions=Array.isArray(rec.transitions)?rec.transitions:[];rec.transitions.push({at:new Date().toISOString(),from:rec.lastState,to:a.state,health:a.health});rec.transitions=rec.transitions.slice(-20);rec.lastState=a.state;}
    if(rec&&Date.now()-new Date(rec.at||0).getTime()>=STRUCTURE_V2_HORIZON_MS){structureV2Finalize(rec,'TIMEOUT');rec=null}
  }
  if(!rec){
    const lastAt=t.structureV2RecordAt?new Date(t.structureV2RecordAt).getTime():0,same=String(t.structureV2RecordState||'')===String(a.state);
    if(!(same&&Number.isFinite(lastAt)&&Date.now()-lastAt<STRUCTURE_V2_EPISODE_MS))structureV2NewRecord(t,a,px);
  } else scheduleStructureLearningSave();
}
async function structureV2MaybeNotify(t,a){
  if(!a||!['OPPORTUNITY','RECLAIMING'].includes(a.state))return {sent:0,skipped:true};
  if(a.state==='RECLAIMING'&&!a.evidence?.deep&&!a.evidence?.veryDeep)return {sent:0,skipped:true};
  const health=Number(a.health||0),confidence=Number(a.confidence||0),spread=finiteMetric(t?.lastCheck?.spreadBps),adl=String(t?.lastCheck?.adlRisk||'unknown').toLowerCase(),crowded=t?.lastCheck?.fundingCrowded===true;
  if(health<STRUCTURE_V2_NOTIFY_MIN_HEALTH||confidence<STRUCTURE_V2_NOTIFY_MIN_CONFIDENCE||adl==='high'||crowded||(spread!=null&&spread>TEST_SIGNAL_MAX_SPREAD_BPS))return {sent:0,skipped:true};
  t.structureV2Alerts=t.structureV2Alerts&&typeof t.structureV2Alerts==='object'?t.structureV2Alerts:{};
  const k=a.state+':'+a.retracementBucket,last=new Date(t.structureV2Alerts[k]||0).getTime();if(Number.isFinite(last)&&last>0&&Date.now()-last<STRUCTURE_V2_NOTIFY_COOLDOWN_MS)return {sent:0,duplicate:true};
  const tier=health>=80&&confidence>=82&&a.evidence?.reclaim15?'HIGH':'NORMAL',title=(a.state==='OPPORTUNITY'?'🟡 ':'🔄 ')+t.symbol+'｜'+a.label+'｜非進場確認',body='結構 '+Math.round(health)+'｜'+(a.reasons||[]).slice(0,2).join(' · ')+'｜等5/15分收復/策略確認';
  const delivery=await sendPush({title,body,tag:'structure-v21-'+t.symbol+'-'+t.direction+'-'+a.state+'-'+Date.now(),renotify:true,data:{url:testMonitorRoute(t)}},{testSignal:true,testSignalTier:tier});
  if(delivery.sent>0)t.structureV2Alerts[k]=new Date().toISOString();
  return {tier,...delivery};
}
function structureV2Summary(){
  const all=structureLearning.filter(x=>x?.version===STRUCTURE_ENGINE_VERSION),resolved=all.filter(x=>x.status==='RESOLVED'),effective=structureV2EffectiveRows(),states={},patterns={},assets={};for(const x of all){states[x.state]=(states[x.state]||0)+1;patterns[x.pattern||'NA']=(patterns[x.pattern||'NA']||0)+1;assets[x.assetClass||'NA']=(assets[x.assetClass||'NA']||0)+1}
  const deep=effective.filter(x=>['DEEP_PULLBACK_SUCCESS','DEEP_PULLBACK_FAILED'].includes(x.outcome)),falseInv=effective.filter(x=>['TRUE_INVALIDATION','FALSE_INVALIDATION'].includes(x.outcome));
  return {version:STRUCTURE_ENGINE_VERSION,records:all.length,active:all.filter(x=>x.status==='ACTIVE').length,resolved:resolved.length,effective:effective.length,minLearningSample:STRUCTURE_V2_MIN_SAMPLE,maxAdjustment:STRUCTURE_V2_MAX_ADJUST,states,patterns,assets,overall:structureV2Stats(effective),deepPullback:{sample:deep.length,success:deep.filter(x=>x.outcome==='DEEP_PULLBACK_SUCCESS').length,successRate:deep.length?Number((deep.filter(x=>x.outcome==='DEEP_PULLBACK_SUCCESS').length/deep.length*100).toFixed(1)):null},invalidation:{sample:falseInv.length,trueInvalid:falseInv.filter(x=>x.outcome==='TRUE_INVALIDATION').length,falseInvalid:falseInv.filter(x=>x.outcome==='FALSE_INVALIDATION').length,falseInvalidRate:falseInv.length?Number((falseInv.filter(x=>x.outcome==='FALSE_INVALIDATION').length/falseInv.length*100).toFixed(1)):null},sourcePolicy:{trader:'Binance Copy BAPI/order_history primary; public mirrors cross-check only',market:'Binance Kline/WS primary; Bybit/OKX explicit fallback'}};
}
function structureV2CsvEscape(v){if(v==null)return'';const x=Array.isArray(v)?v.join('｜'):typeof v==='object'?JSON.stringify(v):String(v);return /[\",\n\r]/.test(x)?'\"'+x.replace(/\"/g,'\"\"')+'\"':x}

`
    src = replaceOnce(src, insertBeforeEntryStrategy, structureCode + insertBeforeEntryStrategy, 'insert structure engine');

    // Structure-aware entry language. Only confirmed destruction is a hard no-entry structure state.
    const entryHeadOld = `function testEntryStrategy(t, statusLabel='') {\n  const state=String(t?.monitorState||''),status=String(t?.status||''),label=String(statusLabel||testTrackerStatusLabel(t));\n  if(status==='INVALID'||status==='DROPPED'||state==='WEAKENING')return '暫停進場，等資料重新同向後再判讀';`;
    const entryHeadNew = `function testEntryStrategy(t, statusLabel='') {\n  const state=String(t?.monitorState||''),status=String(t?.status||''),label=String(statusLabel||testTrackerStatusLabel(t)),structure=t?.structureV2||null;\n  if(structure?.state==='DESTROYED'||status==='DROPPED')return '結構徹底破壞，不進場；等新的完整結構重新建立';\n  if(structure?.state==='OPPORTUNITY')return '深回踩但主結構未確認破壞；只在收復確認＋建議區間內分批';\n  if(structure?.state==='RECLAIMING')return '結構收復中，等5分/15分收盤確認後再進';\n  if(structure?.state==='DAMAGED')return '結構受損但未死，先等收復；不要把深回踩直接當失效';`;
    src = replaceOnce(src, entryHeadOld, entryHeadNew, 'entry strategy semantics');

    // Notification gate: WEAKENING / DAMAGED is no longer a hard block. DESTROYED remains a hard block.
    src = replaceOnce(src, `  if(t.status==='INVALID'||t.status==='DROPPED')blockers.push('結構失效');\n  if(t.monitorState==='WEAKENING')blockers.push('目前轉弱');`, `  if(t.status==='DROPPED'||t?.structureV2?.state==='DESTROYED')blockers.push('結構徹底破壞');\n  if(t?.structureV2?.state==='DAMAGED')highMissing.push?.('結構受損待收復');`, 'structure gate hard block');

    // The previous replacement injected highMissing before declaration; repair by moving the soft condition after highMissing is declared.
    src = src.replace("  if(t?.structureV2?.state==='DAMAGED')highMissing.push?.('結構受損待收復');\n", '');
    src = replaceOnce(src, `  const highMissing=[];`, `  const highMissing=[];\n  if(t?.structureV2?.state==='DAMAGED')highMissing.push('結構受損待收復');\n  if(t?.structureV2?.state==='RECLAIMING')highMissing.push('結構收復中');`, 'soft structure high tier');

    // Assess and persist every active tracker before monitor-state transitions.
    const assessAnchor = `  if(t.status==='INVALID'){`;
    src = replaceOnce(src, assessAnchor, `  t.structureV2=structureV2Assess(t,{rows5,rows15,rows30,rows1h,t5,t15,t30,t1h,deriv,micro,market});\n  structureV2Observe(t,t.structureV2,{rows5,rows15,rows30,rows1h});\n  // Separate early structure-watch alert: informative only, never counted as an entry notification.\n  void structureV2MaybeNotify(t,t.structureV2).catch(()=>{});\n\n${assessAnchor}`, 'structure assess');

    // Confirmed monitor: no binary invalidation from 5m weakness. Structure V2 owns the hard invalidation decision.
    const confirmedOld = `  const protection=Number(t.structureProtection||t.stop),last15=rows15.at(-1),prev15=rows15.at(-2);\n  const closeBreak2=dir>0?(last.close<protection&&prev.close<protection):(last.close>protection&&prev.close>protection);\n  const close15Break=last15&&prev15?(dir>0?(last15.close<protection&&prev15.close<protection):(last15.close>protection&&prev15.close>protection)):false;\n  if(t.breakoutAt&&(close15Break||(closeBreak2&&evidence.weakFlags>=TEST_MONITOR_WEAK_FLAGS))){\n    return testEnterInvalidation(t,{reason:'STRUCTURE',last,protection,entry,dir});\n  }`;
    const confirmedNew = `  const protection=Number(t.structureProtection||t.stop),last15=rows15.at(-1),prev15=rows15.at(-2);\n  const closeBreak2=dir>0?(last.close<protection&&prev.close<protection):(last.close>protection&&prev.close>protection);\n  const close15Break=last15&&prev15?(dir>0?(last15.close<protection&&prev15.close<protection):(last15.close>protection&&prev15.close>protection)):false;\n  if(t?.structureV2?.state==='DESTROYED'){\n    return testEnterInvalidation(t,{reason:'STRUCTURE_V2_DESTROYED',last,protection:t.structureV2?.levels?.originalInvalidation??protection,entry,dir});\n  }`;
    src = replaceOnce(src, confirmedOld, confirmedNew, 'confirmed invalidation');

    // Weakening may remain observable for >30m if the primary structure still exists. No auto-drop merely because time passed.
    const weakBlockRe = /  if\(t\.monitorState==='WEAKENING'\)\{[\s\S]*?\n  \}\n  return t;\n\}\n\nfunction testReentryLevels/;
    const weakBlockReplacement = `  if(t.monitorState==='WEAKENING'){\n    const weakAge=t.weakSince?Date.now()-new Date(t.weakSince).getTime():0;\n    if(t?.structureV2?.state==='DESTROYED'){\n      return testDropTracker(t,{reason:'Structure V2：高週期結構確認徹底破壞',last,dir,entry});\n    }\n    // DAMAGED / RECLAIMING / OPPORTUNITY are kept alive; elapsed time alone is not structural invalidation.\n    if(weakAge>=TEST_MONITOR_WEAK_MAX_MS&&t?.structureV2?.state==='INTACT'){t.weakSince=new Date().toISOString();}\n  }\n  return t;\n}\n\nfunction testReentryLevels`;
    src = replaceRegexOnce(src, weakBlockRe, weakBlockReplacement, 'weakening no timeout death');

    // Invalid monitor: drop only after confirmed destruction; allow reclaim / false-invalidation learning.
    const invalidDropRe = /  const last15=rows15\.at\(-1\),prev15=rows15\.at\(-2\),orig=Number\(t\.setup\?\.invalidation\);[\s\S]*?\n  if\(Number\(t\.recoverStreak\|\|0\)>=TEST_MONITOR_STATE_BARS\)\{/;
    const invalidDropReplacement = `  const last15=rows15.at(-1),prev15=rows15.at(-2),orig=Number(t.setup?.invalidation);\n  const hard15=Number.isFinite(orig)&&last15&&prev15?(dir>0?(last15.close<orig&&prev15.close<orig):(last15.close>orig&&prev15.close>orig)):false;\n  const atr15=Number(t.setup?.atr15||t15.atr14||0),deepBreak=Number.isFinite(orig)&&atr15>0?(dir>0?last.close<orig-atr15*.65:last.close>orig+atr15*.65):false;\n  if(t?.structureV2?.state==='DESTROYED'&&hard15&&(evidence.adverse30||evidence.adverse1h||evidence.adverseMarket)){\n    return testDropTracker(t,{reason:'Structure V2：15分連續收破＋高週期確認，原始結構徹底破壞',last,dir,entry});\n  }\n  if(Number(t.recoverStreak||0)>=TEST_MONITOR_STATE_BARS){`;
    src = replaceRegexOnce(src, invalidDropRe, invalidDropReplacement, 'invalid hard drop');

    const invalidTimeoutOld = `  if(t.reactivateUntil&&Date.now()>=new Date(t.reactivateUntil).getTime()){\n    return testDropTracker(t,{reason:'失效後 30 分鐘仍未重新收復保護結構',last,dir,entry});\n  }`;
    const invalidTimeoutNew = `  if(t.reactivateUntil&&Date.now()>=new Date(t.reactivateUntil).getTime()){\n    if(t?.structureV2?.state==='DESTROYED')return testDropTracker(t,{reason:'Structure V2：收復期限後仍為徹底破壞',last,dir,entry});\n    // Keep recoverable structure alive; the timer is not evidence of destruction.\n    t.reactivateUntil=new Date(Date.now()+TEST_MONITOR_REACTIVATE_MS).toISOString();\n  }`;
    src = replaceOnce(src, invalidTimeoutOld, invalidTimeoutNew, 'invalid timeout');

    // Public API: expose structure state separately from probability/quality.
    const publicOld = `    monitorState:t.monitorState||'WATCHING',monitorLabel:testMonitorStateLabel(t.monitorState,t.status),monitorClass:testMonitorStateClass(t.monitorState,t.status),monitorScore:t.monitorScore??null,`;
    const publicNew = `    monitorState:t.monitorState||'WATCHING',monitorLabel:testMonitorStateLabel(t.monitorState,t.status),monitorClass:testMonitorStateClass(t.monitorState,t.status),monitorScore:t.monitorScore??null,\n    structureV2:t.structureV2||null,structureState:t.structureV2?.state||null,structureLabel:t.structureV2?.label||null,structureHealth:t.structureV2?.health??null,structureAction:t.structureV2?.action||null,`;
    src = replaceOnce(src, publicOld, publicNew, 'public structure fields');

    // Add structure learning endpoints before actual-trades endpoints.
    const apiAnchor = `app.get('/api/actual-trades',(_req,res)=>res.json({ok:true,generatedAt:new Date().toISOString(),summary:actualTradeAggregate(),records:actualTrades.filter(x=>x?.version==='V10.2.6').slice(0,300)}));`;
    const apiCode = `app.get('/api/structure-learning',(_req,res)=>res.json({ok:true,generatedAt:new Date().toISOString(),summary:structureV2Summary(),recent:structureLearning.filter(x=>x?.version===STRUCTURE_ENGINE_VERSION).slice(0,300)}));\napp.get('/api/structure-learning.csv',(_req,res)=>{const cols=['at','symbol','direction','assetClass','pattern','marketEpisodeId','strategyId','strategyLabel','marketRegime','state','rawState','label','rawHealth','learningAdjustment','health','confidence','retracementRatio','retracementBucket','reasonCodes','reasons','price','entryPrice','originalInvalidation','protection','poc15','protectedSwing15','protectedSwing30','primaryLevel','successPrice','failurePrice','traderLastAction','traderAddsDuringEpisode','traderReducesDuringEpisode','status','outcome','outcomeAt','maxFavorablePct','maxAdversePct'];const rows=structureLearning.filter(x=>x?.version===STRUCTURE_ENGINE_VERSION),csv=[cols.join(','),...rows.map(x=>cols.map(k=>structureV2CsvEscape(x[k])).join(','))].join('\\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=structure-learning-v2-'+new Date().toISOString().slice(0,10)+'.csv');res.send('\\uFEFF'+csv)});\n${apiAnchor}`;
    src = replaceOnce(src, apiAnchor, apiCode, 'structure endpoints');

    // Expose summary in test signal response without changing existing notification thresholds.
    const responseNeedle = `return {ok:true,generatedAt:new Date(testSignalLastRunAt||Date.now()).toISOString(),scanMs:TEST_SIGNAL_SCAN_MS,`;
    src = replaceOnce(src, responseNeedle, `return {ok:true,generatedAt:new Date(testSignalLastRunAt||Date.now()).toISOString(),structureEngine:structureV2Summary(),scanMs:TEST_SIGNAL_SCAN_MS,`, 'test signal structure summary');

    // Update methodology wording only; this is observability, not a threshold relaxation.
    src = src.replace(`只有硬結構失守，或連續弱勢K達門檻且高週期同步轉弱後，才自動移出；其餘最長保留 4 小時。`, `Structure Engine V2 將深回踩、受損、收復與徹底破壞分開；wick/0.786/單純價格觸碰不再直接判死，只有15/30/60分結構確認破壞才以結構理由阻擋或移出。`);

    // Add structure diagnostics to /api/config testSignals block if exact anchor still exists.
    src = src.replace(`testSignals: { scanMs: TEST_SIGNAL_SCAN_MS, max: TEST_SIGNAL_MAX, confirmScore: TEST_SIGNAL_CONFIRM_SCORE, weakFlags: TEST_MONITOR_WEAK_FLAGS, stateBars: TEST_MONITOR_STATE_BARS, routeToMonitor: true, lifecycle: true, reentry:true, reentryScore:TEST_REENTRY_SCORE, reentryConfirmBars:TEST_REENTRY_CONFIRM_BARS },`, `testSignals: { scanMs: TEST_SIGNAL_SCAN_MS, max: TEST_SIGNAL_MAX, confirmScore: TEST_SIGNAL_CONFIRM_SCORE, weakFlags: TEST_MONITOR_WEAK_FLAGS, stateBars: TEST_MONITOR_STATE_BARS, routeToMonitor: true, lifecycle: true, reentry:true, reentryScore:TEST_REENTRY_SCORE, reentryConfirmBars:TEST_REENTRY_CONFIRM_BARS, structureEngine:{version:STRUCTURE_ENGINE_VERSION,minLearningSample:STRUCTURE_V2_MIN_SAMPLE,maxAdjustment:STRUCTURE_V2_MAX_ADJUST,notifyMinHealth:STRUCTURE_V2_NOTIFY_MIN_HEALTH,notifyMinConfidence:STRUCTURE_V2_NOTIFY_MIN_CONFIDENCE,notifyCooldownMinutes:Math.round(STRUCTURE_V2_NOTIFY_COOLDOWN_MS/60000)} },`);

    // Marker and syntax guard.
    src += `\n// ${PATCH_MARKER}\n`;
    fs.writeFileSync(serverPath, src, 'utf8');
    const check = spawnSync(process.execPath, ['--check', serverPath], { encoding:'utf8' });
    if (check.status !== 0) {
      fs.writeFileSync(serverPath, original, 'utf8');
      throw new Error(`[structure-v2] patched server syntax failed; rollback applied: ${String(check.stderr||check.stdout||'unknown').slice(0,900)}`);
    }
    console.log('[structure-v2] applied S2.1.0; deep pullback / reclaim / destruction learning enabled');
    return { changed:true, serverPath };
  } catch (e) {
    // Never leave a partially patched server on disk.
    try { fs.writeFileSync(serverPath, original, 'utf8'); } catch {}
    throw e;
  }
}
