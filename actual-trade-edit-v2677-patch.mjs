import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='ACTUAL_TRADE_EDIT_V2677_20260904';

function nodeCheck(file,label){
  const r=spawnSync(process.execPath,['--check',file],{cwd:__dirname,encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[v2677] ${label} syntax invalid: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function replaceOnce(src,oldText,newText,label){
  if(!src.includes(oldText))throw new Error(`[v2677] anchor missing: ${label}`);
  return src.replace(oldText,newText);
}

const OLD_FOOT='<div class=\\"actualTradeItemFootV2613\\"><span>已實際建倉 · 後端持續追蹤 TP / SP</span><button type=\\"button\\" class=\\"actualCloseChipV2613\\" data-v2613-close=\\"${esc(x.id)}\\">結案</button></div>';
const NEW_FOOT='<div class=\\"actualTradeItemFootV2613\\"><span>已實際建倉 · 後端持續追蹤 TP / SP</span><div class=\\"actualTradeItemActionsV2677\\"><button type=\\"button\\" class=\\"actualEditChipV2677\\" data-v2613-edit=\\"${esc(x.id)}\\">修改</button><button type=\\"button\\" class=\\"actualCloseChipV2613\\" data-v2613-close=\\"${esc(x.id)}\\">結案</button></div></div>';

const OPEN_EDIT=String.raw`
async function openEditTrade(id){
  const rec=records.find(x=>x.id===id&&x?.status==='ACTIVE');if(!rec)return;
  const modal=ensureModal();
  quickCtx={
    editId:rec.id,
    symbol:rec.symbol,
    direction:rec.direction==='SHORT'?'SHORT':'LONG',
    source:rec.source||'MANUAL_ACTUAL',
    signalKey:rec.signalKey||null,
    strategyId:rec.strategyId||null,
    strategyLabel:rec.strategyLabel||null,
    marketRegime:rec.marketRegime||null,
    notificationTier:rec.notificationTier||null
  };
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.classList.add('v2613TradeOpen');
  modal.querySelector('[data-v2613-title]').textContent=rec.symbol+'｜修改建倉';
  const side=modal.querySelector('[data-v2613-side]');side.textContent=sideText(rec.direction);side.className=sideClass(rec.direction);
  modal.querySelector('[data-v2613-source]').textContent='修改目前倉位';
  const save=modal.querySelector('[data-v2613-save]');if(save){save.textContent='儲存修改';save.disabled=false}
  setField('entry',rec.entryPrice);setField('tp1',rec.tp1);setField('tp2',rec.tp2);setField('sp1',rec.sp1);setField('sp2',rec.sp2);setField('margin',rec.margin);setField('leverage',rec.leverage);setField('quantity',rec.quantity);
  const msg=modal.querySelector('[data-v2613-msg]');
  if(msg)msg.textContent=rec.firstOutcome?'此筆已碰過 TP / SP；後端會保留績效稽核，若拒絕修改會直接顯示原因。':'已帶入目前建倉數字，修改後按「儲存修改」。';
}
`;

const CSS_APPEND=String.raw`
/* ACTUAL_TRADE_EDIT_V2677_20260904 */
.actualTradeItemActionsV2677{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex:0 0 auto}
.actualEditChipV2677{appearance:none;border:1px solid rgba(142,119,74,.44);border-radius:999px;background:rgba(43,35,20,.44);color:#d0b36f;height:26px;padding:0 10px;font-size:8.5px;font-weight:950;white-space:nowrap}
.actualEditChipV2677:active{transform:translateY(1px);border-color:#9b7a3c;color:#e6c779}
@media(max-width:520px){.actualTradeItemActionsV2677{gap:6px}.actualEditChipV2677{height:28px;font-size:9px;padding:0 10px}}
`;

export function patchActualTradeEditV2677(){
  const jsPath=path.join(__dirname,'actual-trade-hub-v2613.js');
  const cssPath=path.join(__dirname,'actual-trade-hub-v2613.css');
  if(!fs.existsSync(jsPath))throw new Error('[v2677] actual-trade-hub-v2613.js missing');
  if(!fs.existsSync(cssPath))throw new Error('[v2677] actual-trade-hub-v2613.css missing');

  let js=fs.readFileSync(jsPath,'utf8');
  let css=fs.readFileSync(cssPath,'utf8');

  if(js.includes(MARKER)&&css.includes(MARKER))return {changed:false,version:'V2.6.77'};

  for(const needle of [
    "fetch('/api/actual-trades',{method:'POST'",
    "fetch(`/api/actual-trades/${encodeURIComponent(id)}`",
    "data-v2613-close",
    "async function saveQuick()",
    "async function closeTrade(id)"
  ])if(!js.includes(needle))throw new Error('[v2677] actual trade source prerequisite missing: '+needle);

  if(!js.includes(MARKER)){
    js=replaceOnce(js,OLD_FOOT,NEW_FOOT,'trade footer actions');

    js=replaceOnce(
      js,
      "modal.querySelector('[data-v2613-title]').textContent=`${ctx.symbol}｜實際建倉`;",
      "modal.querySelector('[data-v2613-title]').textContent=`${ctx.symbol}｜實際建倉`;const createSave=modal.querySelector('[data-v2613-save]');if(createSave){createSave.textContent='儲存建倉';createSave.disabled=false}",
      'new trade modal save label reset'
    );

    js=replaceOnce(
      js,
      "try{const r=await fetch('/api/actual-trades',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);if(msg)msg.textContent='✅ 已建倉，正在移入「已建倉」。';",
      "try{const editing=Boolean(quickCtx?.editId),url=editing?`/api/actual-trades/${encodeURIComponent(quickCtx.editId)}`:'/api/actual-trades',method=editing?'PATCH':'POST',body=editing?{action:'update',...payload}:payload;const r=await fetch(url,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json().catch(()=>null);if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);if(msg)msg.textContent=editing?'✅ 已更新建倉數字。':'✅ 已建倉，正在移入「已建倉」。';",
      'save quick create/update branch'
    );

    js=replaceOnce(js,"async function closeTrade(id){",OPEN_EDIT.trim()+"\nasync function closeTrade(id){",'insert edit modal');

    js=replaceOnce(
      js,
      "const close=e.target.closest?.('[data-v2613-close]');if(close){e.preventDefault();e.stopPropagation();void closeTrade(close.dataset.v2613Close);return}",
      "const edit=e.target.closest?.('[data-v2613-edit]');if(edit){e.preventDefault();e.stopPropagation();void openEditTrade(edit.dataset.v2613Edit);return}const close=e.target.closest?.('[data-v2613-close]');if(close){e.preventDefault();e.stopPropagation();void closeTrade(close.dataset.v2613Close);return}",
      'bind edit before close'
    );

    js='// '+MARKER+'\n'+js;
  }

  if(!css.includes(MARKER))css+='\n'+CSS_APPEND.trim()+'\n';

  const tmpJs=jsPath+'.v2677-'+process.pid+'-'+Date.now()+'.tmp.js';
  const tmpCss=cssPath+'.v2677-'+process.pid+'-'+Date.now()+'.tmp.css';
  fs.writeFileSync(tmpJs,js,'utf8');fs.writeFileSync(tmpCss,css,'utf8');
  try{nodeCheck(tmpJs,'patched actual trade hub');fs.renameSync(tmpJs,jsPath);fs.renameSync(tmpCss,cssPath)}
  catch(e){try{fs.unlinkSync(tmpJs)}catch{};try{fs.unlinkSync(tmpCss)}catch{};throw e}

  const outJs=fs.readFileSync(jsPath,'utf8'),outCss=fs.readFileSync(cssPath,'utf8');
  for(const n of [MARKER,'data-v2613-edit','openEditTrade','action:\'update\'','儲存修改','actualTradeItemActionsV2677'])if(!outJs.includes(n)&&!outCss.includes(n))throw new Error('[v2677] post verify missing: '+n);

  return {changed:true,version:'V2.6.77',editButtonLeftOfClose:true,reusesActualTradeUpdateApi:true,revisionAuditPreserved:true};
}

if(import.meta.url===`file://${process.argv[1]}`){
  try{console.log(patchActualTradeEditV2677())}catch(e){console.error(e?.stack||e);process.exit(1)}
}
