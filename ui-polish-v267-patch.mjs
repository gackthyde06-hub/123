import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKER = 'UI_POLISH_V267';

function writeIfChanged(file,before,after){
  if(before===after)return false;
  fs.writeFileSync(file,after,'utf8');
  return true;
}
function mustFile(...parts){
  const file=path.join(__dirname,...parts);
  if(!fs.existsSync(file))throw new Error(`[v267-ui] missing ${parts.join('/')}`);
  return file;
}
function replaceOnce(text,from,to,label){
  if(text.includes(to))return text;
  if(!text.includes(from))throw new Error(`[v267-ui] ${label} anchor not found`);
  return text.replace(from,to);
}

function patchApp(){
  const file=mustFile('public','app.js'),before=fs.readFileSync(file,'utf8');
  let s=before;

  // All instrument names already render as normal TradingView anchors. Remove the old global
  // interception that turned those links into the internal chart modal.
  const oldIntercept=`const chartLink=e.target.closest('[data-tv-symbol]');if(chartLink){e.preventDefault();e.stopPropagation();void openSystemChart(chartLink.dataset.tvSymbol)}`;
  if(s.includes(oldIntercept))s=s.replace(oldIntercept,'');

  const oldTv=`function tvAnchor(symbol,cls='tvNameLink',label=''){const text=label||symbol;return \`<a class="\${esc(cls)}" href="\${esc(tradingViewLink(symbol))}" target="_blank" rel="noopener noreferrer" data-tv-symbol="\${esc(symbol)}" aria-label="開啟 \${esc(symbol)} 系統圖表">\${esc(text)}</a>\`}`;
  const newTv=`function tvAnchor(symbol,cls='tvNameLink',label=''){const text=label||symbol;return \`<a class="\${esc(cls)}" href="\${esc(tradingViewLink(symbol))}" target="_blank" rel="noopener noreferrer" data-tv-symbol="\${esc(symbol)}" aria-label="在 TradingView 網頁版開啟 \${esc(symbol)}">\${esc(text)}</a>\`}`;
  if(s.includes(oldTv))s=s.replace(oldTv,newTv);
  s=s.replace("else if(x.status==='DEEP_SENT'){text='深度回踩已提醒 · 點名稱開TV確認';cls='deep'}","else if(x.status==='DEEP_SENT'){text='深度回踩已提醒';cls='deep'}");

  // A tiny marker makes repeated startup patching easy to audit without changing behavior.
  if(!s.includes(MARKER))s=`// ${MARKER}: symbol names open TradingView Web directly; internal name-click chart disabled.\n${s}`;
  return writeIfChanged(file,before,s);
}

function patchIndex(){
  const file=mustFile('public','index.html'),before=fs.readFileSync(file,'utf8');
  let s=before;
  s=s.replace('名稱開系統圖表；圖內可直接看最佳入場 / SL / TP，右上可再跳官方 TV。','按標的名稱直接開啟 TradingView 網頁版。');

  // Remove the whole internal chart dialog from the DOM. Keep only sticky-tab CSS from the
  // old chart style block because that behavior is unrelated and still useful.
  s=s.replace(/\n<div id="chartModal" class="chartModal" aria-hidden="true">[\s\S]*?<\/div>\n\n<div id="labelModal" class="modalBackdrop" aria-hidden="true">/,
    '\n<div id="labelModal" class="modalBackdrop" aria-hidden="true">');
  s=s.replace(/<style id="v1020-chart-fixed-tabs">[\s\S]*?<\/style>/,
`<style id="v1020-chart-fixed-tabs">
/* V2.6.7 — internal chart removed; keep the useful sticky page tabs only. */
.pageTabs{position:sticky!important;top:env(safe-area-inset-top,0px)!important;z-index:90!important;background:var(--bg,#090b0c)!important;margin-top:0!important}
</style>`);
  if(!s.includes('V2.6.7 — direct TradingView Web'))s=s.replace('</head>',`<style id="v267-direct-tv">/* V2.6.7 — direct TradingView Web */\n.tvNameLink,.symTvLink,.matrixCoin,.sg-tv-link,.sl-tv-link,.manual-tv-link{text-decoration:none}\n</style>\n</head>`);
  return writeIfChanged(file,before,s);
}

function patchSystemGrowth(){
  const file=mustFile('public','system-growth.js'),before=fs.readFileSync(file,'utf8');
  let s=before;
  s=s.replace("const VERSION='2.3.1-stable-v264';","const VERSION='2.6.7-direct-tv';");

  if(!s.includes('function sgTradingViewLink(')){
    const anchor='  const rootDoc=document;';
    if(!s.includes(anchor))throw new Error('[v267-ui] system-growth rootDoc anchor not found');
    const helper=`${anchor}\n  function sgTradingViewLink(symbol){let clean=String(symbol||'').toUpperCase().trim().replace(/^BINANCE:/,'').replace(/\\.P$/,'').replace(/[^A-Z0-9]/g,'');return clean?\`https://www.tradingview.com/chart/?symbol=\${encodeURIComponent(\`BINANCE:\${clean}.P\`)}\`:'https://www.tradingview.com/chart/'}\n  function sgTvAnchor(symbol){return \`<a class="sg-tv-link" href="\${esc(sgTradingViewLink(symbol))}" target="_blank" rel="noopener noreferrer" aria-label="在 TradingView 網頁版開啟 \${esc(symbol)}">\${esc(symbol)}</a>\`}`;
    s=s.replace(anchor,helper);
  }

  s=s.replace('<i class="sg-candidate-glyph">${sigilSvg(sgType,iconGradeFromProgress(progress))}</i><b>${esc(x.symbol)}</b><span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">',
              '<i class="sg-candidate-glyph">${sigilSvg(sgType,iconGradeFromProgress(progress))}</i>${sgTvAnchor(x.symbol)}<span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">');
  s=s.replace('<section class="sg-live" id="sgCandidateSection"><div class="sg-section-head"><div><b>正在發生</b><span>LIVE RESEARCH</span></div>',
              '<section class="sg-live" id="sgCandidateSection"><div class="sg-section-head"><div><b>篩選中</b><span>LIVE RESEARCH</span></div>');
  s=s.replace('<article class="sg-intel" data-sg-intel="${esc(x.symbol)}:${esc(x.direction)}"><div class="sg-intel-head"><div><b>${esc(x.symbol)}</b><span>',
              '<article class="sg-intel" data-sg-intel="${esc(x.symbol)}:${esc(x.direction)}"><div class="sg-intel-head"><div>${sgTvAnchor(x.symbol)}<span>');

  if(!s.includes("panel.querySelectorAll('.sg-tv-link')")){
    const anchor="    panel.querySelectorAll('[data-sg-intel-btn]').forEach(btn=>btn.addEventListener('click',()=>loadIntel(btn)));";
    if(!s.includes(anchor))throw new Error('[v267-ui] system-growth bind anchor not found');
    s=s.replace(anchor,`${anchor}\n    panel.querySelectorAll('.sg-tv-link').forEach(a=>a.addEventListener('click',e=>{e.stopPropagation()}));`);
  }
  return writeIfChanged(file,before,s);
}

function patchSystemGrowthCss(){
  const file=mustFile('public','system-growth.css'),before=fs.readFileSync(file,'utf8');
  let s=before;
  if(!s.includes('/* UI_POLISH_V267 system growth TV */'))s+=`\n/* UI_POLISH_V267 system growth TV */\n.sg-tv-link{display:inline-flex;align-items:center;min-width:0;color:inherit!important;font:inherit;font-weight:950;text-decoration:none!important;cursor:pointer;overflow-wrap:anywhere;-webkit-tap-highlight-color:transparent}.sg-tv-link:hover{text-decoration:underline!important;text-underline-offset:3px}.sg-candidate-main>.sg-tv-link{font-size:inherit}.sg-intel-head .sg-tv-link{font-weight:900}\n`;
  return writeIfChanged(file,before,s);
}

function patchStructureLearning(){
  const file=mustFile('public','structure-learning-ui.js'),before=fs.readFileSync(file,'utf8');
  let s=before;
  s=s.replace("const VERSION='2.6.4';","const VERSION='2.6.7';");
  if(!s.includes('function slTradingViewLink(')){
    const anchor="  const levelZh=s=>({detail:'精細桶',core:'核心桶',broad:'廣義桶'})[String(s||'')]||'尚未啟動';";
    if(!s.includes(anchor))throw new Error('[v267-ui] structure helper anchor not found');
    s=s.replace(anchor,`${anchor}\n  function slTradingViewLink(symbol){let clean=String(symbol||'').toUpperCase().trim().replace(/^BINANCE:/,'').replace(/\\.P$/,'').replace(/[^A-Z0-9]/g,'');return clean?\`https://www.tradingview.com/chart/?symbol=\${encodeURIComponent(\`BINANCE:\${clean}.P\`)}\`:'https://www.tradingview.com/chart/'}\n  function slTvAnchor(symbol){return \`<a class="sl-tv-link" href="\${esc(slTradingViewLink(symbol))}" target="_blank" rel="noopener noreferrer" aria-label="在 TradingView 網頁版開啟 \${esc(symbol)}">\${esc(symbol)}</a>\`}`);
  }
  s=s.replace('<div class="sl-current-main"><b>${esc(x.symbol||\'—\')}</b><span>', '<div class="sl-current-main">${x.symbol?slTvAnchor(x.symbol):\'<b>—</b>\'}<span>');
  s=s.replace('<summary><i class="sg-acc-icon sl-icon"><span class="sl-memory-seal" aria-hidden="true"></span></i><div><b>結構記憶</b>',
              '<summary><i class="sg-acc-icon sl-icon"><svg viewBox="0 0 32 32" class="sl-memory-diamond" aria-hidden="true"><path d="M16 4 26 16 16 28 6 16Z" fill="none"/></svg></i><div><b>結構記憶</b>');
  return writeIfChanged(file,before,s);
}

function patchStructureCss(){
  const file=mustFile('public','structure-learning-ui.css'),before=fs.readFileSync(file,'utf8');
  let s=before;
  if(!s.includes('/* UI_POLISH_V267 simple structure diamond */'))s+=`\n/* UI_POLISH_V267 simple structure diamond */\n.sl-memory-seal{display:none!important}.sl-icon{display:inline-flex!important;align-items:center!important;justify-content:center!important}.sl-memory-diamond{width:25px;height:25px;display:block;stroke:#c7a85f;stroke-width:1.65;stroke-linejoin:round;filter:none}.sl-tv-link{color:inherit!important;text-decoration:none!important;font:inherit;font-weight:900;cursor:pointer;-webkit-tap-highlight-color:transparent}.sl-tv-link:hover{text-decoration:underline!important;text-underline-offset:3px}\n`;
  return writeIfChanged(file,before,s);
}

function patchManual(){
  const jsFile=mustFile('public','manual-mode-ui.js'),jsBefore=fs.readFileSync(jsFile,'utf8');
  let j=jsBefore;
  j=j.replace("const VERSION='2.6.5'","const VERSION='2.6.7'");
  if(!j.includes('function manualTradingViewLink(')){
    const anchor="const dirText=d=>d==='SHORT'?'做空':'做多';";
    if(!j.includes(anchor))throw new Error('[v267-ui] manual helper anchor not found');
    j=j.replace(anchor,`${anchor}\nfunction manualTradingViewLink(symbol){let clean=String(symbol||'').toUpperCase().trim().replace(/^BINANCE:/,'').replace(/\\.P$/,'').replace(/[^A-Z0-9]/g,'');return clean?\`https://www.tradingview.com/chart/?symbol=\${encodeURIComponent(\`BINANCE:\${clean}.P\`)}\`:'https://www.tradingview.com/chart/'}\nfunction manualTvAnchor(symbol){return \`<a class="manual-tv-link" href="\${esc(manualTradingViewLink(symbol))}" target="_blank" rel="noopener noreferrer" aria-label="在 TradingView 網頁版開啟 \${esc(symbol)}">\${esc(symbol)}</a>\`}`);
  }
  j=j.replace('<div class="manual-main"><div><b>${esc(x.symbol)}</b><span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">',
              '<div class="manual-main"><div>${manualTvAnchor(x.symbol)}<span class="${x.direction===\'SHORT\'?\'short\':\'long\'}">');
  const jsChanged=writeIfChanged(jsFile,jsBefore,j);

  const cssFile=mustFile('public','manual-mode-ui.css'),cssBefore=fs.readFileSync(cssFile,'utf8');
  let c=cssBefore;
  c=c.replace('.manual-card.grade-a{border-color:#6d5328;box-shadow:inset 3px 0 #d6a94e}', '.manual-card.grade-a{border-color:rgba(109,83,40,.55);box-shadow:inset 3px 0 rgba(183,137,54,.38)}');
  c=c.replace('.manual-card.grade-b{border-color:rgba(88,135,197,.42);box-shadow:inset 4px 0 #6f9ed9}', '.manual-card.grade-b{border-color:rgba(88,135,197,.34);box-shadow:inset 3px 0 rgba(111,158,217,.42)}');
  if(!c.includes('/* UI_POLISH_V267 manual */'))c+=`\n/* UI_POLISH_V267 manual */\n.manual-tv-link{color:inherit!important;text-decoration:none!important;font:inherit;font-weight:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}.manual-tv-link:hover{text-decoration:underline!important;text-underline-offset:3px}\n`;
  const cssChanged=writeIfChanged(cssFile,cssBefore,c);
  return jsChanged||cssChanged;
}

export function patchUiPolishV267(){
  const files={
    app:patchApp(),
    html:patchIndex(),
    growth:patchSystemGrowth(),
    growthCss:patchSystemGrowthCss(),
    structure:patchStructureLearning(),
    structureCss:patchStructureCss(),
    manual:patchManual(),
  };
  return {changed:Object.values(files).some(Boolean),files,marker:MARKER};
}
