import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CHART_UX_V262_20260902';

function syntaxCheck(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0)throw new Error(`[chart-ux] ${label} syntax invalid: ${String(r.stderr||r.stdout||'unknown').trim()}`);
}
function atomicWriteChecked(file,content,label){
  const tmp=`${file}.v262-${process.pid}-${Date.now()}.tmp.js`;
  fs.writeFileSync(tmp,content,'utf8');
  try{syntaxCheck(tmp,label);fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}

export function patchChartUxV262({appPath=path.join(__dirname,'public','app.js')}={}){
  let src=fs.readFileSync(appPath,'utf8');
  if(src.includes(MARKER))return {changed:false,reason:'already-applied'};

  const styleAnchor='function chartLineStyle(kind){';
  if(!src.includes(styleAnchor))throw new Error('[chart-ux] chartLineStyle anchor missing');
  const helpers=`/* ${MARKER} */
const CHART_TAIPEI_TZ='Asia/Taipei';
function chartTimeToDate(v){
  if(v===null||v===undefined||v==='')return null;
  if(typeof v==='object'&&Number.isFinite(Number(v.year))){const d=new Date(Date.UTC(Number(v.year),Number(v.month||1)-1,Number(v.day||1)));return Number.isNaN(d.getTime())?null:d}
  if(typeof v==='number'&&Number.isFinite(v)){const d=new Date(v>1e12?v:v*1000);return Number.isNaN(d.getTime())?null:d}
  if(typeof v==='string'){const n=Number(v);if(Number.isFinite(n)&&v.trim()!==''){const d=new Date(n>1e12?n:n*1000);if(!Number.isNaN(d.getTime()))return d}const d=new Date(v);return Number.isNaN(d.getTime())?null:d}
  return null
}
function chartTaipeiParts(v){const d=chartTimeToDate(v);if(!d)return null;try{const p={};for(const x of new Intl.DateTimeFormat('en-GB',{timeZone:CHART_TAIPEI_TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d))if(x.type!=='literal')p[x.type]=x.value;return p}catch{return null}}
function chartTaipeiFull(v){const p=chartTaipeiParts(v);return p?p.month+'/'+p.day+' '+p.hour+':'+p.minute:'—'}
function chartTaipeiClock(v){const p=chartTaipeiParts(v);return p?p.hour+':'+p.minute:'—'}
function chartTaipeiTick(v,tickType){const p=chartTaipeiParts(v);if(!p)return'';return Number(tickType)<=2?p.month+'/'+p.day:p.hour+':'+p.minute}
function chartIntervalMs(tf){return ({'5m':5,'15m':15,'30m':30,'1h':60})[String(tf)]*60*1000||15*60*1000}
function chartRelativeAge(ms){ms=Math.max(0,Number(ms)||0);if(ms<60e3)return Math.max(0,Math.floor(ms/1000))+'秒前';if(ms<3600e3)return Math.floor(ms/60e3)+'分前';if(ms<86400e3)return Math.floor(ms/3600e3)+'小時前';return Math.floor(ms/86400e3)+'天前'}
function chartKlineFreshness(lastTime,tf){const d=chartTimeToDate(lastTime),age=d?Math.max(0,Date.now()-d.getTime()):Infinity,base=chartIntervalMs(tf),freshMax=base*2.2+60e3,agingMax=base*4.5+60e3;return age<=freshMax?{key:'fresh',label:'即時',age}:age<=agingMax?{key:'aging',label:'偏舊',age}:{key:'stale',label:'可能過期',age}}
function chartRenderTimeMeta(ctx){const host=$('chartStatus');if(!host)return;let el=$('chartTimeMeta');if(!el){el=document.createElement('div');el.id='chartTimeMeta';el.className='chartTimeMeta';host.insertAdjacentElement('afterend',el)}if(!ctx){el.textContent='';el.className='chartTimeMeta';return}const signal=chartTimeToDate(ctx.signalAt),updated=chartTimeToDate(ctx.updatedAt),parts=[];if(signal)parts.push('訊號 '+chartTaipeiFull(signal)+' · '+chartRelativeAge(Date.now()-signal.getTime()));if(updated&&(!signal||Math.abs(updated-signal)>30e3))parts.push('最後判讀 '+chartTaipeiFull(updated));el.textContent=parts.length?'台灣時間 · '+parts.join(' · '):'台灣時間 · 即時行情';const age=updated?Date.now()-updated.getTime():(signal?Date.now()-signal.getTime():0);el.className='chartTimeMeta '+(age>2*3600e3?'aging':'fresh')}
function chartPriceLabelPlan(ctx){const minGap=window.matchMedia?.('(max-width:520px)')?.matches?34:25,placed=[],out={entry:false,stop:false,tp1:false,tp2:false};const items=[['entry',ctx.bestEntry,5],['stop',ctx.stop,5],['tp2',ctx.tp2,4],['tp1',ctx.tp1,3]].sort((a,b)=>b[2]-a[2]);for(const [key,value] of items){if(!(Number(value)>0))continue;const y=systemCandleSeries?.priceToCoordinate?.(Number(value));const show=Number.isFinite(y)&&placed.every(p=>Math.abs(p-y)>=minGap);out[key]=show;if(show)placed.push(y)}return out}
`
  src=src.replace(styleAnchor,helpers+styleAnchor);

  const priceLineOld="function chartAddPriceLine(value,title,color,style='dash',width=1){if(!systemCandleSeries||!(value>0))return;try{systemCandleSeries.createPriceLine({price:value,title,color,lineWidth:width,lineStyle:chartLineStyle(style),axisLabelVisible:true,lineVisible:true})}catch{}}";
  const priceLineNew="function chartAddPriceLine(value,title,color,style='dash',width=1,axisLabelVisible=true){if(!systemCandleSeries||!(value>0))return;try{systemCandleSeries.createPriceLine({price:value,title,color,lineWidth:width,lineStyle:chartLineStyle(style),axisLabelVisible:!!axisLabelVisible,lineVisible:true})}catch{}}";
  if(!src.includes(priceLineOld))throw new Error('[chart-ux] chartAddPriceLine anchor missing');
  src=src.replace(priceLineOld,priceLineNew);

  const signalReturnOld="return {symbol,direction:dir,status,strategy:testStrategyName(x),winRate:testEffectiveWinRate(x),bestEntry:best,zoneLow:zl,zoneHigh:zh,stop,tp1,tp2,current:chartFinite(x.currentPrice),notified:Boolean(x.notificationSentAt),reentryActive}";
  const signalReturnNew="return {symbol,direction:dir,status,strategy:testStrategyName(x),winRate:testEffectiveWinRate(x),bestEntry:best,zoneLow:zl,zoneHigh:zh,stop,tp1,tp2,current:chartFinite(x.currentPrice),notified:Boolean(x.notificationSentAt),reentryActive,signalAt:x.notificationSentAt||x.confirmedAt||x.firstSeenAt||x.createdAt||x.eventAt||null,updatedAt:x.updatedAt||x.lastCheckAt||x.currentPriceAt||x.stateChangedAt||null}";
  if(!src.includes(signalReturnOld))throw new Error('[chart-ux] signal context anchor missing');
  src=src.replace(signalReturnOld,signalReturnNew);

  const posReturnOld="return {symbol,direction:p.side==='SHORT'?'SHORT':'LONG',status:'實際持倉',strategy:t.name||'交易員',winRate:null,bestEntry:entry,zoneLow:null,zoneHigh:null,stop:null,tp1:null,tp2:null,current:chartFinite(p.markPrice),notified:false}";
  const posReturnNew="return {symbol,direction:p.side==='SHORT'?'SHORT':'LONG',status:'實際持倉',strategy:t.name||'交易員',winRate:null,bestEntry:entry,zoneLow:null,zoneHigh:null,stop:null,tp1:null,tp2:null,current:chartFinite(p.markPrice),notified:false,signalAt:p.openedAt||p.createdAt||null,updatedAt:p.updatedAt||p.markPriceAt||lastStatus?.updatedAt||null}";
  if(src.includes(posReturnOld))src=src.replace(posReturnOld,posReturnNew);

  const renderRe=/async function renderSystemChart\(\)\{[\s\S]*?\}\nasync function openSystemChart/;
  if(!renderRe.test(src))throw new Error('[chart-ux] renderSystemChart anchor missing');
  const renderNew=`async function renderSystemChart(){
  const symbol=systemChartSymbol,interval=systemChartInterval,request=++systemChartRequest,loading=$('chartLoading');if(!symbol)return;
  if(loading){loading.classList.add('show');loading.textContent='讀取 Binance K 線…'}chartDestroy();
  try{
    const [r,L]=await Promise.all([fetch(\`/api/chart-data?symbol=\${encodeURIComponent(symbol)}&interval=\${encodeURIComponent(interval)}&limit=260\`,{cache:'no-store'}),ensureChartLibrary()]),d=await r.json();
    if(request!==systemChartRequest)return;if(!r.ok||!d?.ok)throw new Error(d?.error||\`HTTP \${r.status}\`);
    const box=$('systemChart');if(!L?.createChart||!box)throw new Error('圖表元件載入失敗');
    systemChart=L.createChart(box,{width:Math.max(280,box.clientWidth),height:Math.max(340,box.clientHeight||410),layout:{background:{type:'solid',color:'#090b0c'},textColor:'#8f8981',fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang TC",sans-serif'},localization:{locale:'zh-TW',timeFormatter:time=>chartTaipeiFull(time)},grid:{vertLines:{color:'#171a1b'},horzLines:{color:'#171a1b'}},rightPriceScale:{borderColor:'#25292a',scaleMargins:{top:.08,bottom:.10}},timeScale:{borderColor:'#25292a',timeVisible:true,secondsVisible:false,rightOffset:7,barSpacing:7,minBarSpacing:3,tickMarkFormatter:(time,tickType)=>chartTaipeiTick(time,tickType)},crosshair:{vertLine:{color:'#62676a',labelBackgroundColor:'#33383a'},horzLine:{color:'#62676a',labelBackgroundColor:'#33383a'}},handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true}});
    const candleOpts={upColor:'#d65b5b',downColor:'#60c18a',wickUpColor:'#d65b5b',wickDownColor:'#60c18a',borderVisible:false,priceLineVisible:true,lastValueVisible:true};
    systemCandleSeries=systemChart.addSeries?systemChart.addSeries(L.CandlestickSeries,candleOpts):systemChart.addCandlestickSeries(candleOpts);
    const candles=(d.candles||[]).map(c=>({time:Number(c.time),open:Number(c.open),high:Number(c.high),low:Number(c.low),close:Number(c.close)}));systemCandleSeries.setData(candles);
    const ctx=systemChartContext||{},labels=chartPriceLabelPlan(ctx);
    chartAddPriceLine(ctx.bestEntry,'入場','#e7bd5f','solid',2,labels.entry);
    chartAddPriceLine(ctx.zoneLow,'','#84672f','dash',1,false);chartAddPriceLine(ctx.zoneHigh,'','#84672f','dash',1,false);
    chartAddPriceLine(ctx.stop,'SL','#d85b5b','dash',2,labels.stop);chartAddPriceLine(ctx.tp1,'TP1','#67bd83','dash',1,labels.tp1);chartAddPriceLine(ctx.tp2,'TP2','#67bd83','dash',1,labels.tp2);
    systemChart.timeScale().fitContent();
    systemChartResize=new ResizeObserver(()=>{if(systemChart&&box){systemChart.applyOptions({width:Math.max(280,box.clientWidth),height:Math.max(340,box.clientHeight||410)});requestAnimationFrame(chartUpdateBand)}});systemChartResize.observe(box);
    try{systemChart.timeScale().subscribeVisibleLogicalRangeChange(()=>requestAnimationFrame(chartUpdateBand))}catch{}requestAnimationFrame(()=>requestAnimationFrame(chartUpdateBand));
    if(loading)loading.classList.remove('show');
    const source=$('chartSource'),last=candles[candles.length-1],fresh=chartKlineFreshness(last?.time,interval);if(source){source.classList.remove('sg-chart-fresh','sg-chart-aging','sg-chart-stale');source.classList.add(\`sg-chart-\${fresh.key}\`);source.textContent=\`\${d.source||'Binance'} · \${interval} · \${candles.length}根 · 台灣時間 · 最後K線 \${chartTaipeiFull(last?.time)} · \${fresh.label}（\${Number.isFinite(fresh.age)?chartRelativeAge(fresh.age):'時間未知'}） · 刷新 \${chartTaipeiClock(Date.now())}\`}
    if(d.currentPrice&&$('chartCurrent'))$('chartCurrent').textContent=price(d.currentPrice)
  }catch(e){if(request!==systemChartRequest)return;if(loading){loading.classList.add('show');loading.innerHTML=\`圖表暫時無法載入<br><small>\${esc(e?.message||'未知錯誤')}</small>\`}}
}
async function openSystemChart`;
  src=src.replace(renderRe,renderNew);

  const loadingStatus="$('chartStatus').textContent='讀取系統最佳點位…';";
  if(src.includes(loadingStatus))src=src.replace(loadingStatus,loadingStatus+"chartRenderTimeMeta(null);");
  const contextAnchor='systemChartContext=ctx;';
  if(!src.includes(contextAnchor))throw new Error('[chart-ux] chart context assignment anchor missing');
  src=src.replace(contextAnchor,'systemChartContext=ctx;chartRenderTimeMeta(ctx);');

  atomicWriteChecked(appPath,src,'public/app.js');
  return {changed:true};
}

if(import.meta.url===`file://${process.argv[1]}`)patchChartUxV262();
