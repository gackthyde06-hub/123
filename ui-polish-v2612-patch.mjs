import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='UI_POLISH_V2612';
function must(...p){const f=path.join(__dirname,...p);if(!fs.existsSync(f))throw new Error(`[v2612-ui] missing ${p.join('/')}`);return f}
function check(f){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});if(r.status!==0)throw new Error(`[v2612-ui] syntax invalid ${path.basename(f)}: ${String(r.stderr||r.stdout||'').trim()}`)}
function save(f,b,a){if(a===b)return false;fs.writeFileSync(f,a,'utf8');return true}
function replaceOnce(s,a,b,label){if(!s.includes(a))throw new Error(`[v2612-ui] anchor missing: ${label}`);return s.replace(a,b)}
function replaceBlock(s,start,end,block,label){const a=s.indexOf(start),b=a>=0?s.indexOf(end,a+start.length):-1;if(a<0||b<0)throw new Error(`[v2612-ui] block missing: ${label}`);return s.slice(0,a)+block+s.slice(b)}

function patchApp(){
  const f=must('public','app.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return false;
  const profiles=JSON.parse(fs.readFileSync(must('asset-profiles-v2612.json'),'utf8'));
  const profileJs=`const ASSET_PROFILES_UI_V2612=${JSON.stringify(profiles)};\nconst MARKET_ASSET_PREF_V2612='position-alert-market-asset-v2612',IDEA_ASSET_PREF_V2612='position-alert-idea-asset-v2612';\nlet marketAssetViewV2612=(()=>{try{return localStorage.getItem(MARKET_ASSET_PREF_V2612)==='TRADFI'?'TRADFI':'CRYPTO'}catch{return'CRYPTO'}})(),ideaAssetViewV2612=(()=>{try{const v=localStorage.getItem(IDEA_ASSET_PREF_V2612)||'ALL';return ['ALL','CRYPTO','TRADFI'].includes(v)?v:'ALL'}catch{return'ALL'}})(),marketFlowMasterV2612=null,rankedIdeasMasterV2612=null;\nfunction assetBaseUiV2612(symbol){return String(symbol||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'').replace(/^1000(?=[A-Z])/,'')}\nfunction assetClassUiV2612(x){if(String(x?.assetClass||'').toUpperCase()==='TRADFI')return'TRADFI';const b=assetBaseUiV2612(x?.symbol||x);return ASSET_PROFILES_UI_V2612[b]?.assetClass==='TRADFI'?'TRADFI':'CRYPTO'}\nfunction assetLabelUiV2612(x){return assetClassUiV2612(x)==='TRADFI'?'美股':'幣圈'}\nfunction assetBadgeV2612(x){const c=assetClassUiV2612(x);return \`<span class="assetBadgeV2612 ${'${c===\'TRADFI\'?\'tradfi\':\'crypto\'}'}">${'${c===\'TRADFI\'?\'美股\':\'幣圈\'}'}</span>\`}\nfunction pfTextV2612(v){const n=Number(v);return !Number.isFinite(n)?'—':n>=99?'無虧損':n.toFixed(2)}\n`;
  s=replaceOnce(s,"const ideaAnalysisInflight=new Map();",`const ideaAnalysisInflight=new Map();\n${profileJs}`,'asset UI state');

  // Runtime asset switches: Today + Flow share one market view; Ideas has an independent all/crypto/stock filter.
  const switchCode=`function mountAssetSwitchesV2612(){
  const make=(id,values,get,set)=>{const page=document.getElementById(id);if(!page||page.querySelector('.assetSwitchV2612'))return;const row=document.createElement('div');row.className='assetSwitchV2612';row.innerHTML=values.map(([k,t])=>\`<button type="button" data-asset-view="${'${k}'}">${'${t}'}</button>\`).join('');const anchor=page.querySelector('.sectionBar,.todayHero,.flowHero,.pageIntro');anchor?anchor.insertAdjacentElement('beforebegin',row):page.prepend(row);row.addEventListener('click',e=>{const b=e.target.closest('[data-asset-view]');if(!b)return;set(b.dataset.assetView);syncAssetSwitchesV2612();});};
  make('page-today',[['CRYPTO','幣圈'],['TRADFI','美股']],()=>marketAssetViewV2612,v=>{marketAssetViewV2612=v==='TRADFI'?'TRADFI':'CRYPTO';try{localStorage.setItem(MARKET_ASSET_PREF_V2612,marketAssetViewV2612)}catch{};if(marketFlowMasterV2612)renderMarketFlow(marketFlowMasterV2612);if(dailyBriefState)renderDailyBrief(dailyBriefState)});
  make('page-flow',[['CRYPTO','幣圈'],['TRADFI','美股']],()=>marketAssetViewV2612,v=>{marketAssetViewV2612=v==='TRADFI'?'TRADFI':'CRYPTO';try{localStorage.setItem(MARKET_ASSET_PREF_V2612,marketAssetViewV2612)}catch{};if(marketFlowMasterV2612)renderMarketFlow(marketFlowMasterV2612)});
  make('page-ideas',[['ALL','全部'],['CRYPTO','幣圈'],['TRADFI','美股']],()=>ideaAssetViewV2612,v=>{ideaAssetViewV2612=['ALL','CRYPTO','TRADFI'].includes(v)?v:'ALL';try{localStorage.setItem(IDEA_ASSET_PREF_V2612,ideaAssetViewV2612)}catch{};if(rankedIdeasMasterV2612)renderRankedIdeas(rankedIdeasMasterV2612)});syncAssetSwitchesV2612();
}
function syncAssetSwitchesV2612(){document.querySelectorAll('#page-today .assetSwitchV2612,#page-flow .assetSwitchV2612').forEach(r=>r.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.assetView===marketAssetViewV2612)));document.querySelectorAll('#page-ideas .assetSwitchV2612').forEach(r=>r.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.assetView===ideaAssetViewV2612)))}
function marketViewV2612(d){const k=marketAssetViewV2612==='TRADFI'?'tradfi':'crypto',v=d?.assetViews?.[k];return v?{...d,...v,assetViews:d.assetViews,assetCounts:d.assetCounts,generatedAt:d.generatedAt,source:d.source}:d}
function renderAssetTodayHeroV2612(){const d=marketViewV2612(marketFlowMasterV2612),sm=d?.summary||{},label=marketAssetViewV2612==='TRADFI'?'美股永續':'幣圈',score=Math.max(0,Math.min(100,Number(sm.confidence||50))),mood=sm.direction==='LONG'?'long':sm.direction==='SHORT'?'short':'neutral',topL=(d?.today?.topLongs||d?.topLongs||[]).slice(0,3).map(x=>x.symbol).join('、')||'—',topS=(d?.today?.topShorts||d?.topShorts||[]).slice(0,3).map(x=>x.symbol).join('、')||'—';const hero=$('todayHero');if(!hero||!d)return;hero.className='todayHero briefHero';hero.innerHTML=\`<div class="todayHeroTop"><div><div class="todayHeroTitle ${'${mood}'}">${'${label}'}｜${'${esc(sm.label||\'多空拉鋸\')}'}</div><div class="todayHeroMeta">Binance 永續 · ${'${ageText(d.generatedAt)}'} · 獨立市場樣本</div></div><div class="todayScore">${'${Math.round(score)}'}<small>${'${sm.direction===\'LONG\'?\'偏多\':sm.direction===\'SHORT\'?\'偏空\':\'中性\'}'}</small></div></div><ul class="briefBullets"><li>成交加權 ${'${signed(sm.weightedChangePct||0,2)}'} · 上漲 ${'${Number(sm.advancers||0)}'} / 下跌 ${'${Number(sm.decliners||0)}'}</li><li>偏多前段：${'${esc(topL)}'}</li><li>偏空前段：${'${esc(topS)}'}</li></ul><div class="briefAction">${'${marketAssetViewV2612===\'TRADFI\'?\'美股永續獨立看美股廣度／時段；學習不直接套用幣圈權重。\':\'幣圈維持 BTC/ETH、資金費率、OI、清算與跨所資料優先。\'}'}</div>\`;if($('todayAge'))$('todayAge').textContent=ageText(d.generatedAt)}
`;
  s=replaceOnce(s,'function fmtVol(v){',switchCode+'\nfunction fmtVol(v){','asset switch functions');

  // Wrap market rendering so both Today and Flow are genuinely split.
  if(s.includes('function renderMarketFlow(d){'))s=s.replace('function renderMarketFlow(d){','function renderMarketFlowCoreV2612(d){');
  else throw new Error('[v2612-ui] renderMarketFlow declaration missing');
  const marketWrapper=`function renderMarketFlow(d){marketFlowMasterV2612=d;mountAssetSwitchesV2612();const view=marketViewV2612(d);renderMarketFlowCoreV2612(view);marketFlowState=d;marketFlowFetchedAt=Date.now();syncAssetSwitchesV2612();renderAssetTodayHeroV2612()}\n`;
  s=replaceOnce(s,'async function refreshMarketFlow(force=false){',marketWrapper+'async function refreshMarketFlow(force=false){','market wrapper');

  // Daily hero follows the selected market instead of showing one blended market on a split page.
  s=s.replace("function renderDailyBrief(d){\n  if(!d?.ok)return;","function renderDailyBrief(d){\n  if(!d?.ok)return;if(marketFlowMasterV2612?.assetViews){dailyBriefState=d;dailyBriefFetchedAt=Date.now();renderAssetTodayHeroV2612();return;}");

  // Rich local profile. Public info is appended only on expand and uses the server cache.
  const oldProfile=/function renderCoinProfileV2611\(x\)\{[^\n]*\}/;
  if(!oldProfile.test(s))throw new Error('[v2612-ui] coin profile function missing');
  const richProfile=`function renderCoinProfileV2611(x){const base=assetBaseUiV2612(x?.symbol),tp=ASSET_PROFILES_UI_V2612[base]||null,p=COIN_PROFILE_V2611[base]||null,tradfi=assetClassUiV2612(x)==='TRADFI',sector=tp?.sector||x?.profile?.sector||p?.type||'加密資產',purpose=tp?.purpose||x?.profile?.purpose||p?.use||'用途與敘事需配合公開資料確認',name=tp?.name||p?.name||base,history=tp?.history||p?.history||\`本機背景資料正在累積；量化排名不受影響。\`,risk=tp?.risk||p?.risk||'以流動性、供需、事件與市場結構為主，不只看題材。',benchmark=tp?.benchmark|| (tradfi?'SPY / QQQ':'BTC / ETH'),session=x?.assetSessionLabel||x?.assetSession||(tradfi?'美股時段':'24H'),hit=Number.isFinite(Number(x?.historicalHitRate))?Number(x.historicalHitRate).toFixed(1)+'%':'—',sample=Number(x?.backtestSample||0),oi=Number.isFinite(Number(x?.metrics?.oiChangePct))?signed(x.metrics.oiChangePct,1):'—',taker=Number.isFinite(Number(x?.metrics?.takerRatio))?Number(x.metrics.takerRatio).toFixed(2):'—';return \`<div class="coinProfileV2611 assetProfileV2612"><div class="coinProfileTitle"><div><b>${'${esc(name)}'}</b>${'${assetBadgeV2612(x)}'}</div><span>${'${esc(sector)}'}</span></div><div class="assetPulseV2612"><div><span>量化估算</span><b>${'${Number(x?.estimatedWinRate||0).toFixed(1)}'}%</b></div><div><span>排名分</span><b>${'${Number(x?.rankScore||0).toFixed(0)}'}</b></div><div><span>歷史1R</span><b>${'${hit}'} / ${'${sample}'}</b></div><div><span>OI / Taker</span><b>${'${oi}'} / ${'${taker}'}</b></div></div><div class="coinProfileGrid"><div><span>型態 / 類型</span><b>${'${esc(tp?.subtype||p?.type||sector)}'}</b></div><div><span>參考市場</span><b>${'${esc(benchmark)}'} · ${'${esc(session)}'}</b></div><div class="wide"><span>主要作用</span><b>${'${esc(purpose)}'}</b></div><div class="wide"><span>歷史 / 背景</span><b>${'${esc(history)}'}</b></div><div class="wide risk"><span>交易時要知道</span><b>${'${esc(risk)}'}</b></div></div><small>本機中文背景先即時顯示；展開時才偶爾補公開資訊，伺服器快取 6 小時，避免每次刷新都查網路。</small></div>\`}`;
  s=s.replace(oldProfile,richProfile);

  // Existing analysis engine is re-enabled only on explicit expand, cache widened from 2h to 6h.
  const fetchStart=s.indexOf('async function fetchIdeaAnalysisShared('),fetchEnd=fetchStart>=0?s.indexOf('\nlet testSignalsState=',fetchStart):-1;
  if(fetchStart>=0&&fetchEnd>fetchStart){let b=s.slice(fetchStart,fetchEnd).replaceAll('2*60*60*1000','6*60*60*1000');s=s.slice(0,fetchStart)+b+s.slice(fetchEnd)}
  const loadStart=s.indexOf('async function loadIdeaAnalysis(details){'),loadEnd=loadStart>=0?s.indexOf('\nfunction bindIdeaDetails(){',loadStart):-1;
  if(loadStart>=0&&loadEnd>loadStart){let b=s.slice(loadStart,loadEnd).replaceAll('2*60*60*1000','6*60*60*1000').replace('正在搜尋最新消息與專案狀況…','正在補充最新公開資訊…').replace('網搜暫時不可用；量化排名仍正常。','公開資訊暫時不可用；量化排名與本機背景仍正常。');s=s.slice(0,loadStart)+b+s.slice(loadEnd)}
  s=s.replaceAll('AI網搜快取','公開資訊快取').replaceAll('AI網搜已更新 · 接下來2小時用快取','公開資訊已更新 · 接下來6小時用快取');

  // V2.6.11 local-only detail becomes a richer card + one far-right 「展開」 control.
  const detailOld='<details class="ideaDetail coinProfileDetailV2611" data-persist-detail="idea:${esc(x.symbol)}:${esc(x.direction)}" ${detailOpenAttr(`idea:${x.symbol}:${x.direction}`)}><summary><span>幣種介紹</span><b>公開資料 · 中文整理</b></summary><div class="ideaDetailBody">${renderCoinProfileV2611(x)}</div></details>';
  const detailNew='<details class="ideaDetail coinProfileDetailV2611 assetDetailV2612" data-idea-symbol="${esc(x.symbol)}" data-idea-dir="${esc(x.direction)}" data-persist-detail="idea:${esc(x.symbol)}:${esc(x.direction)}" ${detailOpenAttr(`idea:${x.symbol}:${x.direction}`)}><summary><span>展開</span></summary><div class="ideaDetailBody"><div data-idea-local-profile>${renderCoinProfileV2611(x)}</div><div class="assetPublicV2612" data-idea-analysis-body><div class="ideaAnalysisLoading">公開資訊會在展開時依快取需要更新。</div></div></div></details>';
  s=replaceOnce(s,detailOld,detailNew,'V2611 ranked detail');

  const bindStart=s.indexOf('function bindIdeaDetails(){'),bindEnd=bindStart>=0?s.indexOf('\nfunction renderRankedIdeas(',bindStart):-1;
  if(bindStart<0||bindEnd<0)throw new Error('[v2612-ui] bindIdeaDetails missing');
  const bind=`function bindIdeaDetails(){bindPersistentDetails($('recGrid'));document.querySelectorAll('#recGrid details[data-idea-symbol]').forEach(d=>{if(d.dataset.ideaBound!=='1'){d.dataset.ideaBound='1';d.addEventListener('toggle',()=>{if(d.open)void loadIdeaAnalysis(d)})}if(d.open)void loadIdeaAnalysis(d)})}`;
  s=s.slice(0,bindStart)+bind+s.slice(bindEnd);

  // Ranked list can show all / crypto / US stocks without changing the ranking engine itself.
  if(s.includes('function renderRankedIdeas(d){'))s=s.replace('function renderRankedIdeas(d){','function renderRankedIdeasCoreV2612(d){');else throw new Error('[v2612-ui] ranked render missing');
  const rankWrapper=`function renderRankedIdeas(d){rankedIdeasMasterV2612=d;mountAssetSwitchesV2612();const rows=(d?.rows||[]).filter(x=>ideaAssetViewV2612==='ALL'||assetClassUiV2612(x)===ideaAssetViewV2612);renderRankedIdeasCoreV2612({...d,rows});rankedIdeasState=d;rankedIdeasFetchedAt=Date.now();syncAssetSwitchesV2612()}\n`;
  s=replaceOnce(s,'async function refreshRankedIdeas(force=false){',rankWrapper+'async function refreshRankedIdeas(force=false){','rank wrapper');

  // Small market badge wherever a symbol is actionable/learned.
  s=s.replace("${tvAnchor(x.symbol,'tvNameLink rankSymbol')}<span class=\"recTag", "${tvAnchor(x.symbol,'tvNameLink rankSymbol')}${assetBadgeV2612(x)}<span class=\"recTag");
  s=s.replace("${tvAnchor(x.symbol,'tvNameLink testSymbol')}${testTrendTag(x)}", "${tvAnchor(x.symbol,'tvNameLink testSymbol')}${assetBadgeV2612(x)}${testTrendTag(x)}");
  s=s.replace("${tvAnchor(x.symbol,'testMonitorSymbol tvNameLink')}<span class=\"testMonitorRankTag\">", "${tvAnchor(x.symbol,'testMonitorSymbol tvNameLink')}${assetBadgeV2612(x)}<span class=\"testMonitorRankTag\">");

  // PF=99 is a no-loss sentinel everywhere, never present it as a literal 99.00 performance claim.
  s=s.replace("${hasNum(s.profitFactor)?Number(s.profitFactor).toFixed(2):'—'}","${hasNum(s.profitFactor)?pfTextV2612(s.profitFactor):'—'}");
  s=s.replaceAll("PF ${hasNum(x.profitFactor)?Number(x.profitFactor).toFixed(2):'—'}","PF ${hasNum(x.profitFactor)?pfTextV2612(x.profitFactor):'—'}");

  s=`// ${MARKER}: dual crypto/US-stock UI + asset-aware learning display + cached public info.\n${s}`;
  const changed=save(f,before,s);if(changed)check(f);return changed;
}

function patchManual(){
  const f=must('public','manual-mode-ui.js'),before=fs.readFileSync(f,'utf8');let s=before;if(s.includes(MARKER))return false;
  s=s.replace("const dirText=d=>d==='SHORT'?'做空':'做多';","const dirText=d=>d==='SHORT'?'做空':'做多';\nconst manualAssetBadgeV2612=x=>`<span class=\"manual-asset-v2612 ${String(x?.assetClass||'').toUpperCase()==='TRADFI'?'tradfi':'crypto'}\">${String(x?.assetClass||'').toUpperCase()==='TRADFI'?'美股':'幣圈'}</span>`;");
  s=s.replace('<b>${esc(x.symbol)}</b><span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">','<b>${esc(x.symbol)}</b>${manualAssetBadgeV2612(x)}<span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">');
  s=`// ${MARKER}\n${s}`;const changed=save(f,before,s);if(changed)check(f);return changed;
}

function patchIndex(){
  const f=must('public','index.html'),before=fs.readFileSync(f,'utf8');if(before.includes('UI_POLISH_V2612 styles'))return false;
  const css=`<style id="v2612-ui-polish">\n/* UI_POLISH_V2612 styles */\n.assetSwitchV2612{display:flex;justify-content:flex-end;gap:5px;margin:6px 2px 11px}.assetSwitchV2612 button{appearance:none;border:1px solid #2d3032;background:#0d0f10;color:#77736d;border-radius:999px;min-width:52px;height:30px;padding:0 11px;font-size:10px;font-weight:900;letter-spacing:.2px;transition:.16s ease}.assetSwitchV2612 button.active{border-color:#6c5732;background:#17130d;color:#e4c477;box-shadow:0 0 0 1px rgba(219,177,91,.05) inset}#page-ideas .assetSwitchV2612 button[data-asset-view="TRADFI"].active,#page-today .assetSwitchV2612 button[data-asset-view="TRADFI"].active,#page-flow .assetSwitchV2612 button[data-asset-view="TRADFI"].active{border-color:#40546d;background:#101720;color:#a9c7e9}.assetBadgeV2612,.manual-asset-v2612{display:inline-flex;align-items:center;justify-content:center;border:1px solid #3b3e40;border-radius:999px;padding:2px 6px;font-size:8px!important;line-height:1.15;font-weight:900;vertical-align:middle;white-space:nowrap;color:#8d8982;background:#111314}.assetBadgeV2612.tradfi,.manual-asset-v2612.tradfi{border-color:#405269;background:#10161e;color:#9ebbdc}.assetBadgeV2612.crypto,.manual-asset-v2612.crypto{border-color:#4b4130;background:#15130f;color:#b8a174}.rankTop .assetBadgeV2612,.testSymbolRow .assetBadgeV2612,.judgeTitleRow .assetBadgeV2612{margin-left:3px}.assetDetailV2612>summary{justify-content:flex-end!important;min-height:34px;padding:8px 2px 4px!important;border:0!important;background:transparent!important}.assetDetailV2612>summary span{font-size:10px!important;color:#7f94ad!important;font-weight:900!important;padding:4px 8px;border:1px solid #2d3b4b;border-radius:7px;background:#0d1218}.assetDetailV2612>summary b{display:none!important}.assetDetailV2612 .ideaDetailBody{padding-top:7px!important}.coinProfileTitle>div{display:flex;align-items:center;gap:7px;min-width:0}.assetPulseV2612{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 8px}.assetPulseV2612>div{border:1px solid #262a2d;background:#0c0e0f;border-radius:9px;padding:8px 7px;min-width:0}.assetPulseV2612 span{display:block;color:#706b64;font-size:8px;font-weight:800}.assetPulseV2612 b{display:block;margin-top:3px;color:#d2c8b9;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.assetPublicV2612{margin-top:9px;padding-top:9px;border-top:1px solid #25292b}.assetPublicV2612 .ideaAnalysisLoading{padding:8px 2px;color:#66615b;font-size:9px}.manual-asset-v2612{margin-left:5px}.perfLearnRow .assetBadgeV2612{margin-right:4px}\n@media(max-width:520px){.assetSwitchV2612{margin-top:4px;margin-bottom:10px}.assetSwitchV2612 button{height:32px;min-width:56px;font-size:11px}.assetBadgeV2612,.manual-asset-v2612{font-size:9px!important;padding:3px 6px}.assetPulseV2612{grid-template-columns:1fr 1fr}.assetPulseV2612 span{font-size:9px}.assetPulseV2612 b{font-size:11px}.assetDetailV2612>summary span{font-size:11px!important}}\n</style>\n<!-- UI_POLISH_V2612 styles -->`;
  return save(f,before,before.replace('</head>',`${css}\n</head>`));
}

export function patchUiPolishV2612(){const files={app:patchApp(),manual:patchManual(),index:patchIndex()};return {changed:Object.values(files).some(Boolean),files,marker:MARKER}}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchUiPolishV2612());
