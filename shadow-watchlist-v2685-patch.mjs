import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'SHADOW_WATCHLIST_V2685_20260906';

function abs(rel) {
  return path.join(ROOT, rel);
}

const SERVER_HELPERS = `
/* ${MARKER} */
function shadowRobustRiskPctV2685(rec){
  const entry=Number(rec?.entryPrice);
  const stop=Number(rec?.stop);
  const risk=Number(rec?.riskDistance)||((Number.isFinite(entry)&&Number.isFinite(stop))?Math.abs(entry-stop):NaN);
  if(!(entry>0&&risk>0)) return null;
  return risk/entry*100;
}
function shadowRobustNetRV2685(rec){
  const realized=Number(rec?.realizedR);
  const net=rec?.netReturnPct==null?null:Number(rec.netReturnPct);
  const riskPct=shadowRobustRiskPctV2685(rec);
  const thin=!(riskPct>0.15);
  let raw=null;
  if(Number.isFinite(realized)) raw=realized;
  else if(!thin && net!=null && Number.isFinite(net) && riskPct>0) raw=net/riskPct;
  if(raw==null || !Number.isFinite(raw)) return null;
  return Number(Math.max(-3, Math.min(3, raw)).toFixed(4));
}
function shadowCostRatioV2685(rec){
  const riskPct=shadowRobustRiskPctV2685(rec);
  const bps=Number(rec?.costBps);
  const costPct=Number.isFinite(bps)?bps/100:(typeof PERF_ROUND_TRIP_COST_BPS==='number'?PERF_ROUND_TRIP_COST_BPS/100:null);
  if(!(riskPct>0.15) || !(costPct>=0)) return null;
  return Number((costPct/riskPct).toFixed(4));
}
function shadowWilsonLowV2685(wins,n,z=1.96){
  if(!(n>0)) return 0;
  const p=wins/n, den=1+z*z/n, centre=p+z*z/(2*n), adj=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n);
  return (centre-adj)/den;
}
function shadowWatchlistV2685(){
  const rows=(typeof shadowPerformance!=='undefined'?shadowPerformance:[]).filter(x=>x?.version==='V10.2.2'&&x.status==='RESOLVED');
  const by=new Map();
  for(const x of rows){
    const sym=String(x.symbol||'').toUpperCase();
    if(!sym) continue;
    if(!by.has(sym)) by.set(sym,[]);
    by.get(sym).push(x);
  }
  const out=[];
  for(const [symbol,xs] of by.entries()){
    let wins=0,losses=0,timeouts=0;
    const rs=[], dirs=new Map(), strats=new Map();
    let latest=0;
    for(const x of xs){
      if(x.result==='WIN') wins++;
      else if(x.result==='LOSS') losses++;
      else if(x.result==='TIMEOUT') timeouts++;
      const r=shadowRobustNetRV2685(x);
      if(r!=null && (x.result==='WIN'||x.result==='LOSS')) rs.push(r);
      const d=String(x.direction||'UNKNOWN'); dirs.set(d,(dirs.get(d)||0)+1);
      const s=String(x.strategyLabel||x.strategyId||'未分類'); strats.set(s,(strats.get(s)||0)+1);
      const ms=Date.parse(x.shadowAt||x.resultAt||'')||0; if(ms>latest) latest=ms;
    }
    const decisive=wins+losses;
    if(decisive<12) continue;
    const gp=rs.filter(v=>v>0).reduce((a,b)=>a+b,0);
    const gl=Math.abs(rs.filter(v=>v<0).reduce((a,b)=>a+b,0));
    const pf=gl>0?gp/gl:(gp>0?99:null);
    const exp=rs.length?rs.reduce((a,b)=>a+b,0)/rs.length:null;
    const wr=wins/decisive;
    const wilson=shadowWilsonLowV2685(wins,decisive);
    const timeoutRate=timeouts/Math.max(1,xs.length);
    if(!(wilson>=0.45 && exp!=null && exp>=0 && pf!=null && pf>=1.15 && timeoutRate<=0.40)) continue;
    const direction=[...dirs.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'LONG';
    const strategy=[...strats.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'未分類';
    const tv=String(symbol).replace(/USDT$/,'USDT.P');
    out.push({
      symbol, assetClass: xs[0]?.assetClassAtEntry || (typeof researchAssetClass==='function'?researchAssetClass(symbol):'CRYPTO'),
      direction, strategy,
      sample: xs.length, decisive, wins, losses, timeouts,
      hitRate: Number((wr*100).toFixed(1)),
      wilsonLow: Number((wilson*100).toFixed(1)),
      netExpectancyR: Number(exp.toFixed(3)),
      netProfitFactor: Number(pf.toFixed(2)),
      timeoutRate: Number((timeoutRate*100).toFixed(1)),
      lastShadowAt: latest?new Date(latest).toISOString():null,
      grade: wilson>=0.55 && pf>=1.4 && decisive>=20 ? 'A_WATCH' : 'B_WATCH',
      action: 'OPEN_CHART',
      tradingView: 'https://www.tradingview.com/chart/?symbol=BINANCE:'+tv,
      note: '觀察清單，不是下單指令。先看 15m/1h 結構再決定。'
    });
  }
  out.sort((a,b)=>b.wilsonLow-a.wilsonLow || b.netExpectancyR-a.netExpectancyR || b.decisive-a.decisive);
  return {
    ok:true, version:'V2.6.85', marker:'${MARKER}', generatedAt:new Date().toISOString(),
    purpose:'Shadow 只篩值得打開 TradingView 的標的；不自動推播、不放寬正式 A/B。',
    gates:{minDecisive:12, minWilsonLow:0.45, minNetExpR:0, minNetPF:1.15, maxTimeoutRate:0.40, netRClip:'[-3,3]', minStopPct:0.15},
    count: out.length,
    items: out.slice(0,20)
  };
}
`;

function replaceResearchNetR(src) {
  const start = src.indexOf('function researchNetR(rec){');
  if (start < 0) return src;
  const end = src.indexOf('function researchStats(', start);
  if (end < 0) return src;
  const next = `function researchNetR(rec){
  const robust=shadowRobustNetRV2685(rec);
  if(robust!=null) return robust;
  const net=rec?.netReturnPct==null?null:Number(rec.netReturnPct),entry=Number(rec?.entryPrice),risk=Number(rec?.riskDistance)||Math.abs(Number(rec?.entryPrice)-Number(rec?.stop));
  const riskPct=entry>0&&risk>0?risk/entry*100:null;
  if(!(riskPct>0.15) || net==null || !Number.isFinite(net)) return Number.isFinite(Number(rec?.realizedR))?Number(Math.max(-3,Math.min(3,Number(rec.realizedR))).toFixed(4)):null;
  return Number(Math.max(-3,Math.min(3,net/riskPct)).toFixed(4));
}
`;
  return src.slice(0, start) + next + src.slice(end);
}

function injectHelpers(src) {
  if (src.includes('function shadowWatchlistV2685()')) return src;
  const anchors = ["function researchNetR(rec){", "function shadowPerformanceAggregate(){", "app.get('/healthz'"];
  let i = -1;
  for (const a of anchors) {
    i = src.indexOf(a);
    if (i >= 0) break;
  }
  if (i < 0) i = 0;
  return src.slice(0, i) + SERVER_HELPERS + '\n' + src.slice(i);
}

function injectRoute(src) {
  if (src.includes("/api/shadow-watchlist")) return src;
  const route = `app.get('/api/shadow-watchlist',(_req,res)=>{try{res.set('cache-control','private, max-age=15');res.json(shadowWatchlistV2685())}catch(e){res.status(500).json({ok:false,error:String(e?.message||e)})}});\n\n`;
  const pos = src.indexOf("app.get('/healthz'");
  if (pos >= 0) return src.slice(0, pos) + route + src.slice(pos);
  return src + '\n' + route;
}

function patchCsvNetR(src) {
  if (src.includes('shadowRobustNetRV2685(x)')) return src;
  return src.replaceAll('netR:researchNetR(x)', 'netR:shadowRobustNetRV2685(x)??researchNetR(x),costRatioAtEntry:x.costRatioAtEntry??shadowCostRatioV2685(x)');
}

const PUBLIC_JS = `(()=>{const MARKER='${MARKER}';
function el(tag,cls,html){const n=document.createElement(tag);if(cls)n.className=cls;if(html!=null)n.innerHTML=html;return n}
function mount(){
  if(document.getElementById('shadowWatchlistV2685'))return;
  const host=document.getElementById('page-monitor')||document.getElementById('page-ideas')||document.querySelector('.wrap');
  if(!host)return;
  const box=el('section','traderCard');
  box.id='shadowWatchlistV2685';
  box.innerHTML='<div class="traderTop"><div class="traderMain"><div class="traderName">影子觀察清單</div><div class="stateInfo">穩健 netR · Wilson 下界 · 只給你開圖，不下單</div></div><div class="radarCount" id="shadowWatchCountV2685">讀取中</div></div><div id="shadowWatchBodyV2685" class="sourceNote">同步影子樣本…</div>';
  const radar=host.querySelector('#traders')||host.firstElementChild;
  if(radar&&radar.parentNode===host)host.insertBefore(box,radar);
  else host.prepend(box);
}
async function load(){
  mount();
  const body=document.getElementById('shadowWatchBodyV2685');
  const count=document.getElementById('shadowWatchCountV2685');
  if(!body)return;
  try{
    const r=await fetch('/api/shadow-watchlist',{cache:'no-store'});
    const d=await r.json();
    if(!d?.ok){body.textContent='觀察清單暫時無法計算';return}
    count.textContent=(d.count||0)+' 檔';
    if(!d.items?.length){body.textContent='目前沒有通過保守門檻的標的。這是好事：寧缺勿濫。';return}
    body.innerHTML=d.items.slice(0,8).map(x=>`<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><b class="consensusSymbol">${x.symbol}</b><span class="dirBadge ${String(x.direction).toLowerCase()}">${x.direction}</span><span class="levelBadge ${x.grade==='A_WATCH'?'high':'medium'}">${x.grade==='A_WATCH'?'優先看':'可看'}</span></div><div class="consensusMeta">${x.strategy} · 勝率 ${x.hitRate}% · 保守下界 ${x.wilsonLow}% · 期望 ${x.netExpectancyR}R · PF ${x.netProfitFactor} · 樣本 ${x.decisive}</div></div><div class="consensusScore"><a href="${x.tradingView}" target="_blank" rel="noopener" style="color:#e0bb68;text-decoration:none;font-size:11px">開圖</a><small>TIMEOUT ${x.timeoutRate}%</small></div></div>`).join('')+'<div class="sourceNote">'+d.purpose+'</div>';
  }catch(e){body.textContent='觀察清單讀取失敗'}
}
function boot(){mount();void load();setInterval(load,60000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
`;

function patchIndex(html) {
  if (html.includes('shadow-watchlist-v2685.js')) return html;
  return html.replace('</body>', '<script src="/shadow-watchlist-v2685.js?v=2685"></script>\n</body>');
}

export function applyShadowWatchlistPatch() {
  const serverPath = abs('server.js');
  let server = fs.readFileSync(serverPath, 'utf8');
  server = injectHelpers(server);
  server = replaceResearchNetR(server);
  server = injectRoute(server);
  server = patchCsvNetR(server);
  if (!server.includes(MARKER)) server = `// ${MARKER}\n` + server;
  fs.writeFileSync(serverPath, server);

  fs.writeFileSync(abs('public/shadow-watchlist-v2685.js'), PUBLIC_JS);
  const indexPath = abs('public/index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const next = patchIndex(html);
  if (next !== html) fs.writeFileSync(indexPath, next);

  return { marker: MARKER, route: true };
}

const isMain = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) console.log(applyShadowWatchlistPatch());
