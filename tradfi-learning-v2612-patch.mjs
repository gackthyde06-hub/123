import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='TRADFI_LEARNING_V2612_20260902';

function check(file){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2612-tradfi] syntax invalid: ${String(r.stderr||r.stdout||'').trim()}`)}
function writeChecked(file,src){const tmp=`${file}.v2612-${process.pid}-${Date.now()}.tmp.js`;fs.writeFileSync(tmp,src,'utf8');try{check(tmp);fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}}
function replaceOnce(src,oldText,newText,label){if(!src.includes(oldText))throw new Error(`[v2612-tradfi] anchor missing: ${label}`);return src.replace(oldText,newText)}
function replaceBlock(src,start,end,newBlock,label){const a=src.indexOf(start),b=a>=0?src.indexOf(end,a+start.length):-1;if(a<0||b<0)throw new Error(`[v2612-tradfi] block missing: ${label}`);return src.slice(0,a)+newBlock+src.slice(b)}

export function patchTradfiLearningV2612({serverPath=path.join(__dirname,'server.js')}={}){
  let src=fs.readFileSync(serverPath,'utf8');
  if(src.includes(MARKER))return {changed:false,reason:'already-applied'};

  // More simultaneous learning slots, still bounded to avoid turning Railway into a brute-force scanner.
  src=src.replace(
    "const TEST_SIGNAL_MAX = Math.max(4, Math.min(12, Number(process.env.TEST_SIGNAL_MAX || 12)));",
    "const TEST_SIGNAL_MAX = Math.max(8, Math.min(18, Number(process.env.TEST_SIGNAL_MAX || 16)));"
  );
  src=src.replace(
    "const SYMBOL_ANALYSIS_CACHE_MS = Math.max(30 * 60 * 1000, Number(process.env.SYMBOL_ANALYSIS_CACHE_MS || 2 * 60 * 60 * 1000));",
    "const SYMBOL_ANALYSIS_CACHE_MS = Math.max(2 * 60 * 60 * 1000, Number(process.env.SYMBOL_ANALYSIS_CACHE_MS || 6 * 60 * 60 * 1000));"
  );

  // Asset classification and evergreen Chinese public background live in a small root JSON file.
  const assetHelpers=`/* ${MARKER} */
const ASSET_PROFILE_PATH_V2612=path.join(__dirname,'asset-profiles-v2612.json');
let ASSET_PROFILES_V2612={};try{ASSET_PROFILES_V2612=JSON.parse(fs.readFileSync(ASSET_PROFILE_PATH_V2612,'utf8'))||{}}catch(e){console.warn('[v2612-tradfi] asset profiles unavailable:',String(e?.message||e))}
const TRADFI_BASES_V2612=new Set(Object.entries(ASSET_PROFILES_V2612).filter(([,v])=>String(v?.assetClass||'').toUpperCase()==='TRADFI').map(([k])=>String(k).toUpperCase()));
function assetBaseV2612(symbol){return String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'').replace(/^1000(?=[A-Z])/,'')}
function assetClassForSymbolV2612(symbol){return TRADFI_BASES_V2612.has(assetBaseV2612(symbol))?'TRADFI':'CRYPTO'}
function assetProfileV2612(symbol){const base=assetBaseV2612(symbol),p=ASSET_PROFILES_V2612[base]||null;return p?{base,...p}:{base,assetClass:'CRYPTO',subtype:'CRYPTO'}}
function assetSessionV2612(symbol,at=Date.now()){
  if(assetClassForSymbolV2612(symbol)!=='TRADFI')return 'CRYPTO_24H';
  const d=new Date(at);let parts={};try{parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]))}catch{return'US_OTHER'}
  const wd=String(parts.weekday||''),h=Number(parts.hour||0),m=Number(parts.minute||0),min=h*60+m;if(['Sat','Sun'].includes(wd))return'US_WEEKEND';if(min>=570&&min<960)return'US_REGULAR';if(min>=240&&min<570)return'US_PRE';if(min>=960&&min<1200)return'US_AFTER';return'US_OVERNIGHT';
}
function assetSessionLabelV2612(v){return ({CRYPTO_24H:'幣圈24H',US_PRE:'美股盤前',US_REGULAR:'美股正規盤',US_AFTER:'美股盤後',US_OVERNIGHT:'美股隔夜',US_WEEKEND:'美股週末',US_OTHER:'美股其他'})[String(v||'')]||String(v||'—')}
function assetViewRowsV2612(rows,assetClass){return (rows||[]).filter(x=>assetClassForSymbolV2612(x?.symbol)===assetClass)}
`;
  src=replaceOnce(src,'function symbolBaseAsset(symbol){',assetHelpers+'\nfunction symbolBaseAsset(symbol){','asset helpers');

  // Stock / ETF profile beats the crypto fallback when the symbol belongs to TradFi.
  const profileStart='function symbolProjectProfile(symbol){';
  const profileEnd='\n\nasync function analyzeIdeaSymbol(row) {';
  const profileBlock=`function symbolProjectProfile(symbol){
  const ap=assetProfileV2612(symbol);if(ap.assetClass==='TRADFI')return {base:ap.base,name:ap.name,assetClass:'TRADFI',subtype:ap.subtype,sector:ap.sector,purpose:ap.purpose,history:ap.history,risk:ap.risk,benchmark:ap.benchmark,known:true};
  const base=symbolBaseAsset(symbol),known=SYMBOL_PROJECT_PROFILES[base];
  if(known)return {base,assetClass:'CRYPTO',subtype:'CRYPTO',sector:known.sector,purpose:known.purpose,known:true};
  return {base,assetClass:'CRYPTO',subtype:'CRYPTO',sector:'其他 / 新興加密資產',purpose:'題材與用途變動較快；展開後可用公開資訊快取補充。',known:false};
}`;
  src=replaceBlock(src,profileStart,profileEnd,profileBlock, 'symbol profile');

  // Every ranked row carries asset/session metadata so UI, Shadow and actual trade ledgers agree.
  src=src.replace(
    "symbol, price:row.price, changePct:row.changePct, quoteVolume:row.quoteVolume, fundingPct:row.fundingPct,",
    "symbol, assetClass:assetClassForSymbolV2612(symbol), assetSession:assetSessionV2612(symbol), assetSessionLabel:assetSessionLabelV2612(assetSessionV2612(symbol)), assetFamily:assetProfileV2612(symbol)?.subtype||'CRYPTO', price:row.price, changePct:row.changePct, quoteVolume:row.quoteVolume, fundingPct:row.fundingPct,"
  );

  // Keep the original market math, then build separate crypto / US-stock views from the same Binance feed.
  src=src.replace('function buildMarketFlow(tickers, premiums) {','function buildMarketFlowCoreV2612(tickers, premiums) {');
  const marketWrapper=`function buildMarketFlow(tickers,premiums){
  const allTick=Array.isArray(tickers)?tickers:[],allPrem=Array.isArray(premiums)?premiums:[];
  const cryptoTick=allTick.filter(x=>assetClassForSymbolV2612(x?.symbol)==='CRYPTO'),tradfiTick=allTick.filter(x=>assetClassForSymbolV2612(x?.symbol)==='TRADFI');
  const cryptoSet=new Set(cryptoTick.map(x=>String(x?.symbol||''))),tradfiSet=new Set(tradfiTick.map(x=>String(x?.symbol||'')));
  const combined=buildMarketFlowCoreV2612(allTick,allPrem),crypto=buildMarketFlowCoreV2612(cryptoTick,allPrem.filter(x=>cryptoSet.has(String(x?.symbol||'')))),tradfi=buildMarketFlowCoreV2612(tradfiTick,allPrem.filter(x=>tradfiSet.has(String(x?.symbol||''))));
  const decorate=(v,assetClass,label)=>({...v,assetClass,assetLabel:label,leaders:(v.leaders||[]).map(x=>({...x,assetClass})),recommendations:(v.recommendations||[]).map(x=>({...x,assetClass}))});
  return {...combined,assetViews:{crypto:decorate(crypto,'CRYPTO','幣圈'),tradfi:decorate(tradfi,'TRADFI','美股')},assetCounts:{crypto:cryptoTick.length,tradfi:tradfiTick.length},assetLearning:'V2.6.12 ASSET-AWARE'};
}

`;
  src=replaceOnce(src,'async function fetchMarketFlowFresh() {',marketWrapper+'async function fetchMarketFlowFresh() {','market asset views');

  // Candidate pool reserves capacity for both markets instead of letting high-volume crypto crowd stocks out.
  const rankedBlock=`async function fetchRankedIdeasFresh() {
  const flow=await getMarketFlow(),radar=realtimeRadarCandidates(RADAR_MAX_SYMBOLS),merged=new Map();
  for(const x of [...radar,...(flow.leaders||[]),...(flow.assetViews?.tradfi?.leaders||[])])if(x?.symbol&&!merged.has(x.symbol))merged.set(x.symbol,x);
  const sorted=[...merged.values()].sort((a,b)=>Number(b.activityScore||0)-Number(a.activityScore||0)||Number(b.quoteVolume||0)-Number(a.quoteVolume||0));
  const crypto=sorted.filter(x=>assetClassForSymbolV2612(x.symbol)==='CRYPTO'),tradfi=sorted.filter(x=>assetClassForSymbolV2612(x.symbol)==='TRADFI');
  const picked=new Map();for(const x of sorted.slice(0,Math.max(12,IDEA_SYMBOLS-6)))picked.set(x.symbol,x);for(const x of crypto.slice(0,10))picked.set(x.symbol,x);for(const x of tradfi.slice(0,10))picked.set(x.symbol,x);
  const candidates=[...picked.values()].sort((a,b)=>Number(b.activityScore||0)-Number(a.activityScore||0)||Number(b.quoteVolume||0)-Number(a.quoteVolume||0)).slice(0,Math.min(32,IDEA_SYMBOLS+8));
  const analyzed=await mapPool(candidates,IDEA_CONCURRENCY,analyzeIdeaSymbol);
  const rows=analyzed.filter(x=>x&&!x.error&&x.direction!=='WAIT').sort((a,b)=>b.rankScore-a.rankScore||b.estimatedWinRate-a.estimatedWinRate||b.quoteVolume-a.quoteVolume);
  let cr=0,us=0;const enriched=rows.map((x,i)=>({...x,globalRank:i+1,assetRank:x.assetClass==='TRADFI'?++us:++cr}));
  return {ok:true,generatedAt:new Date().toISOString(),methodology:'V2.6.12：幣圈＋美股永續雙池雷達；15m+1h 趨勢/動能/量能 + OI/Taker/大戶/Funding + 回測；Shadow 採資產/時段分層學習，再用低權重跨市場經驗補樣本。',radar:realtimeRadarSummary(),analyzed:candidates.length,assetAnalyzed:{crypto:candidates.filter(x=>assetClassForSymbolV2612(x.symbol)==='CRYPTO').length,tradfi:candidates.filter(x=>assetClassForSymbolV2612(x.symbol)==='TRADFI').length},rows:enriched.slice(0,18),errors:analyzed.filter(x=>x?.error).length};
}

`;
  src=replaceBlock(src,'async function fetchRankedIdeasFresh() {','async function getRankedIdeas() {',rankedBlock,'ranked ideas dual pool');

  // Selection for forward testing also guarantees a TradFi quota while preserving the strongest global names.
  const selectHelper=`function selectLearningIdeasV2612(ideas){
  const rows=Array.isArray(ideas?.rows)?ideas.rows:[],picked=new Map();for(const x of rows.slice(0,Math.min(12,TEST_SIGNAL_MAX)))picked.set(testSignalKey(x.symbol,x.direction),x);for(const cls of ['CRYPTO','TRADFI'])for(const x of rows.filter(y=>assetClassForSymbolV2612(y.symbol)===cls).slice(0,4))picked.set(testSignalKey(x.symbol,x.direction),x);return [...picked.values()].sort((a,b)=>Number(a.globalRank||99)-Number(b.globalRank||99)).slice(0,TEST_SIGNAL_MAX)
}
`;
  src=replaceOnce(src,'function syncTestIdeas(ideas) {',selectHelper+'function syncTestIdeas(ideas) {','learning selector');
  src=src.replace('(ideas?.rows||[]).slice(0,TEST_SIGNAL_MAX).forEach((idea,i)=>{','selectLearningIdeasV2612(ideas).forEach((idea,i)=>{');
  src=src.replace('newTestTracker(idea,i+1)','newTestTracker(idea,Number(idea.assetRank||idea.globalRank||i+1))');
  src=src.replace('old.rank=i+1;old.idea={...idea};','old.rank=Number(idea.assetRank||idea.globalRank||i+1);old.idea={...idea};');

  // Public tracker exposes the same asset identity used by learning and UI.
  src=src.replace(
    "key:t.key,symbol:t.symbol,direction:t.direction,label:t.direction==='LONG'?'做多':'做空',rank:t.rank,",
    "key:t.key,symbol:t.symbol,assetClass:assetClassForSymbolV2612(t.symbol),assetSession:assetSessionV2612(t.symbol),assetSessionLabel:assetSessionLabelV2612(assetSessionV2612(t.symbol)),direction:t.direction,label:t.direction==='LONG'?'做多':'做空',rank:t.rank,"
  );

  // Asset-aware hierarchical learning. Same-market evidence has full weight; cross-market experience is only a small fallback.
  const featuresBlock=`function stateLearningFeatures(t){
  const dir=testSignalDirection(t?.direction),lc=t?.lastCheck||{},strategy=t?.strategyAtConfirm||t?.strategyProfile||{},oi=finiteMetric(lc.oi15mChangePct)??finiteMetric(lc.oiChangePct),taker=finiteMetric(lc.takerRatio),depth=finiteMetric(lc.depthImbalance),top=finiteMetric(lc.topPositionRatio),marketAlign=Number(lc.marketAlign||0),regime=String(t?.marketRegime||lc.marketRegime||'NORMAL'),assetClass=assetClassForSymbolV2612(t?.symbol),assetSession=assetSessionV2612(t?.symbol),assetFamily=assetProfileV2612(t?.symbol)?.subtype||'CRYPTO';
  const bucket=(v,kind)=>{if(v==null)return 'NA';if(kind==='oi')return v>=.35?'RISING':v<=-.35?'FALLING':'FLAT';if(kind==='taker')return dir>0?(v>=1.02?'ALIGNED':v<=.96?'OPPOSED':'NEUTRAL'):(v<=.98?'ALIGNED':v>=1.04?'OPPOSED':'NEUTRAL');if(kind==='depth')return dir>0?(v>=.06?'ALIGNED':v<=-.10?'OPPOSED':'NEUTRAL'):(v<=-.06?'ALIGNED':v>=.10?'OPPOSED':'NEUTRAL');if(kind==='top')return dir>0?(v>=1.02?'ALIGNED':v<=.96?'OPPOSED':'NEUTRAL'):(v<=.98?'ALIGNED':v>=1.04?'OPPOSED':'NEUTRAL');return 'NA'};
  return {assetClass,assetSession,assetFamily,strategyId:String(strategy.id||'UNKNOWN'),strategyLabel:String(strategy.label||'未分類'),regime,direction:t?.direction||'LONG',oi:bucket(oi,'oi'),taker:bucket(taker,'taker'),depth:bucket(depth,'depth'),top:bucket(top,'top'),market:marketAlign>0?'ALIGNED':marketAlign<0?'OPPOSED':'NEUTRAL'};
}
`;
  src=replaceBlock(src,'function stateLearningFeatures(t){','function stateLearningKeys(features)',featuresBlock,'state learning features');
  src=src.replace(/function stateLearningKeys\(features\)\{[^\n]*\}/,
    "function stateLearningKeys(features){const f=features||{},a=f.assetClass||'CRYPTO',s=f.assetSession||'UNKNOWN';return {detail:[a,s,f.strategyId,f.regime,f.direction,f.oi,f.taker,f.depth,f.top,f.market].join('|'),core:[a,s,f.strategyId,f.regime,f.direction].join('|'),broad:[a,f.strategyId,f.regime,f.direction].join('|'),global:[f.strategyId,f.regime,f.direction].join('|')}}"
  );

  const effBlock=`function shadowLearningKeysV2612(rec){const f={...(rec?.stateFeatures||{}),assetClass:rec?.assetClass||rec?.stateFeatures?.assetClass||assetClassForSymbolV2612(rec?.symbol),assetSession:rec?.assetSession||rec?.stateFeatures?.assetSession||assetSessionV2612(rec?.symbol,new Date(rec?.shadowAt||Date.now()).getTime()),assetFamily:rec?.assetFamily||rec?.stateFeatures?.assetFamily||assetProfileV2612(rec?.symbol)?.subtype||'CRYPTO',strategyId:rec?.strategyId||rec?.stateFeatures?.strategyId||'UNKNOWN',regime:rec?.marketRegime||rec?.stateFeatures?.regime||'NORMAL',direction:rec?.direction||rec?.stateFeatures?.direction||'LONG',oi:rec?.stateFeatures?.oi||'NA',taker:rec?.stateFeatures?.taker||'NA',depth:rec?.stateFeatures?.depth||'NA',top:rec?.stateFeatures?.top||'NA',market:rec?.stateFeatures?.market||'NEUTRAL'};return stateLearningKeys(f)}
function shadowLearningEffectiveRows(){
  const rows=shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'&&x.learningEligible!==false).sort((a,b)=>new Date(b.shadowAt||0)-new Date(a.shadowAt||0)),seen=new Map(),out=[];
  for(const rec of rows){const core=shadowLearningKeysV2612(rec).core,k=\`${'${core}'}|${'${cleanFuturesSymbol(rec.symbol)}'}\`,ts=new Date(rec.shadowAt||0).getTime(),prev=seen.get(k);if(Number.isFinite(prev)&&Math.abs(prev-ts)<STATE_LEARNING_DEDUP_MS)continue;seen.set(k,ts);out.push(rec)}return out;
}
`;
  src=replaceBlock(src,'function shadowLearningEffectiveRows(){','function stateLearningAdjustmentFromStats(stats)',effBlock,'shadow effective rows');

  const indexBlock=`function stateLearningIndex(){
  if(shadowLearningIndexCache.revision===shadowLearningRevision&&shadowLearningIndexCache.maps)return shadowLearningIndexCache.maps;
  const resolved=shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'&&x.learningEligible!==false).sort((a,b)=>new Date(b.shadowAt||0)-new Date(a.shadowAt||0)),maps={detail:new Map(),core:new Map(),broad:new Map(),global:new Map()},seen={detail:new Map(),core:new Map(),broad:new Map(),global:new Map()};
  for(const rec of resolved){const ts=new Date(rec.shadowAt||0).getTime(),symbol=cleanFuturesSymbol(rec.symbol),keys=shadowLearningKeysV2612(rec);for(const level of ['detail','core','broad','global']){const key=keys[level];if(!key)continue;const correlationKey=\`${'${key}'}|${'${symbol}'}\`,prev=seen[level].get(correlationKey);if(Number.isFinite(prev)&&Math.abs(prev-ts)<STATE_LEARNING_DEDUP_MS)continue;seen[level].set(correlationKey,ts);if(!maps[level].has(key))maps[level].set(key,[]);maps[level].get(key).push(rec)}}shadowLearningIndexCache={revision:shadowLearningRevision,maps};return maps;
}
`;
  src=replaceBlock(src,'function stateLearningIndex(){','function actualStateEvidence(features)',indexBlock,'state learning index');

  const evidenceBlock=`function actualStateEvidence(features){const assetClass=String(features?.assetClass||'CRYPTO'),rows=actualTrades.filter(x=>x?.version==='V10.2.6'&&['WIN','LOSS'].includes(x.firstOutcome)&&assetClassForSymbolV2612(x.symbol)===assetClass&&String(x.strategyId||'')===String(features.strategyId||'')&&String(x.marketRegime||'')===String(features.regime||'')&&String(x.direction||'')===String(features.direction||''));const sample=rows.length,wins=rows.filter(x=>x.firstOutcome==='WIN').length,hitRate=sample?wins/sample*100:null;let adjustment=0;if(sample>=12){if(hitRate>=65)adjustment=1;else if(hitRate<=40)adjustment=-1}return {sample,hitRate:hitRate==null?null:Number(hitRate.toFixed(1)),adjustment,assetClass}}
`;
  src=replaceBlock(src,'function actualStateEvidence(features)','function stateLearningAdjustment(t)',evidenceBlock,'actual state evidence');

  const adjustBlock=`function stateLearningAdjustment(t){
  const features=stateLearningFeatures(t),keys=stateLearningKeys(features),idx=stateLearningIndex(),actualEvidence=actualStateEvidence(features);
  for(const level of ['detail','core','broad']){const rows=idx[level].get(keys[level])||[],stats=shadowStats(rows);if(stats.sample>=STATE_LEARNING_MIN_SAMPLE){const shadowAdjustment=stateLearningAdjustmentFromStats(stats),adjustment=clamp(shadowAdjustment+Number(actualEvidence.adjustment||0),-STATE_LEARNING_MAX_BONUS,STATE_LEARNING_MAX_BONUS);return {adjustment,shadowAdjustment,actualAdjustment:Number(actualEvidence.adjustment||0),actualEvidence,level,key:keys[level],features,stats,active:true,crossAsset:false}}}
  const globalRows=idx.global.get(keys.global)||[],globalStats=shadowStats(globalRows),globalMin=Math.max(40,STATE_LEARNING_MIN_SAMPLE*2);if(globalStats.sample>=globalMin){const globalRaw=stateLearningAdjustmentFromStats(globalStats),shadowAdjustment=clamp(globalRaw,-1,1),adjustment=clamp(shadowAdjustment+Number(actualEvidence.adjustment||0),-2,2);return {adjustment,shadowAdjustment,actualAdjustment:Number(actualEvidence.adjustment||0),actualEvidence,level:'global',key:keys.global,features,stats:globalStats,active:true,crossAsset:true}}
  return {adjustment:Number(actualEvidence.adjustment||0),shadowAdjustment:0,actualAdjustment:Number(actualEvidence.adjustment||0),actualEvidence,level:null,key:null,features,stats:{sample:0,hitRate:null,profitFactor:null,expectancyR:null},active:Boolean(actualEvidence.adjustment),crossAsset:false};
}
`;
  src=replaceBlock(src,'function stateLearningAdjustment(t){','function stateLearningTable(limit=24)',adjustBlock,'state learning adjustment');

  // New Shadow entries persist the asset regime explicitly; old entries are migrated logically by shadowLearningKeysV2612.
  src=src.replace(
    "signalKey:t.key,symbol:t.symbol,direction:t.direction,phase:'FIRST_ENTRY'",
    "signalKey:t.key,symbol:t.symbol,assetClass:features.assetClass,assetSession:features.assetSession,assetFamily:features.assetFamily,direction:t.direction,phase:'FIRST_ENTRY'"
  );
  src=src.replace(
    "byTier:group(x=>x.finalTier||x.tierAtEntry||'VALID'),byRegime:group(x=>x.marketRegime),byStrategy:group(x=>x.strategyLabel||x.strategyId||'未分類')",
    "byAssetClass:group(x=>x.assetClass||assetClassForSymbolV2612(x.symbol)),bySession:group(x=>x.assetSession||assetSessionV2612(x.symbol,new Date(x.shadowAt||Date.now()).getTime())),byTier:group(x=>x.finalTier||x.tierAtEntry||'VALID'),byRegime:group(x=>x.marketRegime),byStrategy:group(x=>x.strategyLabel||x.strategyId||'未分類')"
  );
  src=src.replace(
    "symbol,direction,source:'MANUAL_ACTUAL'",
    "symbol,direction,assetClass:assetClassForSymbolV2612(symbol),assetSession:assetSessionV2612(symbol),source:'MANUAL_ACTUAL'"
  );

  // TradFi must be able to earn HIGH/NORMAL without impossible crypto-only blockers.
  src=src.replace(
    "function testSignalTier(t,{reentry=false}={}) {\n  const cal=",
    "function testSignalTier(t,{reentry=false}={}) {\n  const assetClass=assetClassForSymbolV2612(t?.symbol),tradfi=assetClass==='TRADFI';\n  const cal="
  );
  src=src.replace("if(ev.adverseMarket)blockers.push('BTC/ETH大盤逆向');","if(ev.adverseMarket)blockers.push(tradfi?'美股大盤逆向':'BTC/ETH大盤逆向');");
  src=src.replace("if(Number(cross?.available||0)>0&&Number(cross?.consensus||0)===-dir)blockers.push('跨交易所趨勢逆向');","if(!tradfi&&Number(cross?.available||0)>0&&Number(cross?.consensus||0)===-dir)blockers.push('跨交易所趨勢逆向');");
  src=src.replace("if(regime==='LIQUIDATION'&&!['BTCUSDT','ETHUSDT'].includes(t.symbol)&&score<90)blockers.push('清算行情山寨品質<90');","if(!tradfi&&regime==='LIQUIDATION'&&!['BTCUSDT','ETHUSDT'].includes(t.symbol)&&score<90)blockers.push('清算行情山寨品質<90');");
  src=src.replace("if(!(sources.topPos===true||sources.topAccount===true))highMissing.push('關鍵資料缺:大戶');","if(!tradfi&&!(sources.topPos===true||sources.topAccount===true))highMissing.push('關鍵資料缺:大戶');");
  src=src.replace("if(regime==='LIQUIDATION'&&!['BTCUSDT','ETHUSDT'].includes(t.symbol))normalMissing.push('清算行情山寨只允許最高級確認');","if(!tradfi&&regime==='LIQUIDATION'&&!['BTCUSDT','ETHUSDT'].includes(t.symbol))normalMissing.push('清算行情山寨只允許最高級確認');");

  // TradFi uses its own broad-market breadth instead of BTC/ETH as the market compass.
  const tradfiMarketHelper=`function testTradfiMarketContextV2612(){const sm=marketFlowCache?.data?.assetViews?.tradfi?.summary||{},dir=sm.direction==='LONG'?1:sm.direction==='SHORT'?-1:0,valid=Number(sm.advancers||0)+Number(sm.decliners||0);return {raw:Number(sm.weightedChangePct||0),dir,ok:valid>0,valid,total:Math.max(1,valid),source:'BINANCE_TRADFI_BREADTH'}}\n`;
  src=replaceOnce(src,'async function runTestSignalScan(force=false) {',tradfiMarketHelper+'async function runTestSignalScan(force=false) {','tradfi market context');
  src=src.replace('analyzeTestTracker(t,market)',"analyzeTestTracker(t,assetClassForSymbolV2612(t.symbol)==='TRADFI'?testTradfiMarketContextV2612():market)");

  // Do not waste crypto-only cross-exchange fallbacks for stock/ETF perpetuals.
  src=src.replace('if(ENABLE_CROSS_EXCHANGE&&oiChangePct==null){',"if(assetClassForSymbolV2612(key)==='CRYPTO'&&ENABLE_CROSS_EXCHANGE&&oiChangePct==null){");
  src=src.replaceAll('if(ENABLE_CROSS_EXCHANGE&&takerRatio==null){',"if(assetClassForSymbolV2612(key)==='CRYPTO'&&ENABLE_CROSS_EXCHANGE&&takerRatio==null){");
  src=src.replace('if(ENABLE_CROSS_EXCHANGE&&globalLongShortRatio==null){',"if(assetClassForSymbolV2612(key)==='CRYPTO'&&ENABLE_CROSS_EXCHANGE&&globalLongShortRatio==null){");
  if(src.includes('async function testFetchCrossExchange(symbol){'))src=src.replace('async function testFetchCrossExchange(symbol){',"async function testFetchCrossExchange(symbol){\n  if(assetClassForSymbolV2612(symbol)==='TRADFI')return {available:0,consensus:0,source:'TRADFI_BINANCE_ONLY',skipped:true};");
  else src=src.replace('async function testFetchCrossExchange(symbol) {',"async function testFetchCrossExchange(symbol) {\n  if(assetClassForSymbolV2612(symbol)==='TRADFI')return {available:0,consensus:0,source:'TRADFI_BINANCE_ONLY',skipped:true};");
  src=src.replace("market:{source:'Binance BTC/ETH'}","market:{source:assetClassForSymbolV2612(t.symbol)==='TRADFI'?'Binance 美股永續廣度':'Binance BTC/ETH'}");
  src=src.replace("const qualityWeights={k5:1,k15:1,k30:1,h1:1,oi15:.5,oi1h:.5,taker:1,globalLs:1,topPos:1,topAccount:1,depth:1,funding:1,basis:1,adl:1,mark:1,market:1,backtest:1};","const tradfiQualityV2612=assetClassForSymbolV2612(t.symbol)==='TRADFI';const qualityWeights=tradfiQualityV2612?{k5:1,k15:1,k30:1,h1:1,oi15:.5,oi1h:.5,taker:1,depth:1,funding:1,mark:1,market:1,backtest:1}:{k5:1,k15:1,k30:1,h1:1,oi15:.5,oi1h:.5,taker:1,globalLs:1,topPos:1,topAccount:1,depth:1,funding:1,basis:1,adl:1,mark:1,market:1,backtest:1};");
  src=src.replaceAll("label:'BTC/ETH同向'","label:'大盤同向'");
  src=src.replaceAll("BTC/ETH同向","大盤同向");

  // ABC grade learning follows the same asset boundary; cross-asset ABC is only a tiny large-sample fallback.
  if(src.includes('function abcShadowLearningForTracker(t,direction,regime,strategyId){')){
    const abcLearn=`function abcShadowLearningForTracker(t,direction,regime,strategyId){\n  const assetClass=assetClassForSymbolV2612(t?.symbol),all=shadowPerformance.filter(x=>abcShadowTagged(x)&&x.status==='RESOLVED'&&x.learningEligible!==false&&String(x.direction||'')===String(direction||'')),same=all.filter(x=>assetClassForSymbolV2612(x.symbol)===assetClass);\n  let rows=same.filter(x=>String(x.strategyId||'')===String(strategyId||'')&&String(x.marketRegime||'')===String(regime||'')),level='同資產·策略×狀態';if(rows.length<ABC_SHADOW_MIN_GRADE_SAMPLE){rows=same.filter(x=>String(x.marketRegime||'')===String(regime||''));level='同資產·狀態×方向'}if(rows.length<ABC_SHADOW_MIN_GRADE_SAMPLE){rows=same;level='同資產·方向'}\n  let stats=abcShadowStats(rows),adjustment=abcShadowAdjustmentFromStats(stats),crossAsset=false;if(Number(stats.sample||0)<ABC_SHADOW_MIN_GRADE_SAMPLE){const globalMin=Math.max(40,ABC_SHADOW_MIN_GRADE_SAMPLE*2),g=abcShadowStats(all);if(Number(g.sample||0)>=globalMin){stats=g;adjustment=clamp(abcShadowAdjustmentFromStats(g),-1,1);level='跨資產弱參考';crossAsset=true}else adjustment=0}\n  return {sample:Number(stats.sample||0),hitRate:manualFinite(stats.hitRate),profitFactor:manualFinite(stats.profitFactor),expectancyR:manualFinite(stats.expectancyR),adjustment,level,active:!crossAsset?Number(stats.sample||0)>=ABC_SHADOW_MIN_GRADE_SAMPLE:Number(stats.sample||0)>=Math.max(40,ABC_SHADOW_MIN_GRADE_SAMPLE*2),assetClass,crossAsset};\n}\n`;
    src=replaceBlock(src,'function abcShadowLearningForTracker(t,direction,regime,strategyId){','function abcShadowLearningSummary()',abcLearn,'ABC asset-aware learning');
    src=src.replace("signalKey:t.key,symbol:t.symbol,direction:t.direction,phase:'ABC_GRADE'","signalKey:t.key,symbol:t.symbol,assetClass:features.assetClass,assetSession:features.assetSession,assetFamily:features.assetFamily,direction:t.direction,phase:'ABC_GRADE'");
  }

  // Manual A/B/C and ABC Shadow receive a balanced crypto/TradFi pool and use per-market rank.
  if(src.includes('async function manualOpportunityResponse(force=false){')){
    const manualSelect=`function selectManualIdeasV2612(ideas){const rows=Array.isArray(ideas?.rows)?ideas.rows:[],picked=new Map();for(const x of rows.slice(0,10))picked.set(testSignalKey(x.symbol,x.direction),x);for(const cls of ['CRYPTO','TRADFI'])for(const x of rows.filter(y=>assetClassForSymbolV2612(y.symbol)===cls).slice(0,6))picked.set(testSignalKey(x.symbol,x.direction),x);return [...picked.values()].sort((a,b)=>Number(a.globalRank||99)-Number(b.globalRank||99)).slice(0,16)}\n`;
    src=replaceOnce(src,'async function manualOpportunityResponse(force=false){',manualSelect+'async function manualOpportunityResponse(force=false){','manual balanced pool');
    src=src.replace("const ideas=await getRankedIdeas(),rows=(ideas.rows||[]).slice(0,12).map((x,i)=>manualOpportunityOne(x,i+1,ideas.generatedAt))","const ideas=await getRankedIdeas(),rows=selectManualIdeasV2612(ideas).map((x,i)=>manualOpportunityOne(x,Number(x.assetRank||x.globalRank||i+1),ideas.generatedAt))");
    src=src.replace('for(const row of data.rows.slice(0,8)){','for(const row of data.rows.slice(0,12)){');
  }

  // Manual A/B/C uses same asset-aware Shadow evidence. This code exists after V2.6.3 patch in prepare-ui.
  if(src.includes('function manualShadowEvidence(t,direction,regime,strategyId){')){
    const manualEvidence=`function manualShadowEvidence(t,direction,regime,strategyId,symbol=''){
  const assetClass=assetClassForSymbolV2612(t?.symbol||symbol),all=shadowPerformance.filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED'&&['WIN','LOSS','TIMEOUT'].includes(x.result)&&String(x.direction||'')===direction&&assetClassForSymbolV2612(x.symbol)===assetClass);
  let rows=all.filter(x=>String(x.strategyId||'')===String(strategyId||'')&&String(x.marketRegime||'')===String(regime||'')),level='同資產·策略×狀態';
  if(rows.length<8){rows=all.filter(x=>String(x.marketRegime||'')===String(regime||''));level='同資產·狀態'}if(rows.length<8){rows=all;level='同資產·方向'}
  const stats=shadowStats(rows),hit=manualFinite(stats.hitRate),pf=manualFinite(stats.profitFactor);let adjustment=0;if(stats.sample>=12&&hit!=null&&pf!=null){if(hit>=58&&pf>=1.15)adjustment=4;else if(hit>=53&&pf>=1.03)adjustment=2;else if(hit<=42||pf<.82)adjustment=-4;else if(hit<=47||pf<.93)adjustment=-2}return {sample:Number(stats.sample||0),hitRate:hit,profitFactor:pf,expectancyR:manualFinite(stats.expectancyR),level,adjustment,assetClass};
}
`;
    src=replaceBlock(src,'function manualShadowEvidence(t,direction,regime,strategyId){','function manualOpportunityId(idea,t)',manualEvidence,'manual shadow evidence');
    src=src.replace("manualShadowEvidence(t,direction,regime,strategy.id||'')","manualShadowEvidence(t,direction,regime,strategy.id||'',idea.symbol)");
    src=src.replace(
      "id,grade,executionScore:score,generatedAt:new Date().toISOString(),evaluatedAt:evaluatedAt||null,rank,symbol:idea.symbol,direction,",
      "id,grade,executionScore:score,generatedAt:new Date().toISOString(),evaluatedAt:evaluatedAt||null,rank,symbol:idea.symbol,assetClass:assetClassForSymbolV2612(idea.symbol),assetSession:assetSessionV2612(idea.symbol),assetSessionLabel:assetSessionLabelV2612(assetSessionV2612(idea.symbol)),direction,"
    );
  }

  // Extend exported CSVs with asset context without changing legacy columns used by old tools.
  src=src.replace("const cols=['shadowAt','symbol','direction'","const cols=['shadowAt','symbol','assetClass','assetSession','direction'");
  src=src.replace("const cols=['createdAt','symbol','direction'","const cols=['createdAt','symbol','assetClass','assetSession','direction'");

  src=`// ${MARKER}\n${src}`;
  writeChecked(serverPath,src);
  return {changed:true,marker:MARKER};
}

if(import.meta.url===`file://${process.argv[1]}`)console.log(patchTradfiLearningV2612());
