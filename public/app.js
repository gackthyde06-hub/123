const $=id=>document.getElementById(id);

let cfg=null,lastStatus=null,currentLabelId=null;
const TRADER_PREF='position-alert-traders-v59';
const TYPE_PREF='position-alert-types-v52';
const LABEL_PREF='position-alert-labels-v55';
const UI_PREF='position-alert-ui-v57';
const DEFAULT_TYPES=['OPEN','ADD','REDUCE','CLOSE','CONSENSUS'];

const ui=loadObject(UI_PREF,{activityOpen:[],positionsOpen:[],statsOpen:[],settingsOpen:false});
const activityOpen=new Set(ui.activityOpen||[]);
const positionsOpen=new Set(ui.positionsOpen||[]);
const statsOpen=new Set(ui.statsOpen||[]);

function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function price(v){const x=Number(v||0);if(!x)return'-';if(x>=1000)return x.toLocaleString('en-US',{maximumFractionDigits:2});if(x>=1)return x.toLocaleString('en-US',{maximumFractionDigits:6});return x.toLocaleString('en-US',{maximumFractionDigits:8})}
function localTime(iso){if(!iso)return'';try{return new Date(iso).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}catch{return''}}
function ageText(iso){if(!iso)return'尚未同步';const sec=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/1000));if(sec<60)return`${sec} 秒前`;const min=Math.floor(sec/60);if(min<60)return`${min} 分前`;const hr=Math.floor(min/60);return`${hr} 小時前`}
function defaultTraderIds(){return cfg?.traders?.map(t=>t.id)||[]}
function loadArray(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(Array.isArray(v))return v}catch{}return f}
function loadObject(k,f={}){try{const v=JSON.parse(localStorage.getItem(k)||'null');if(v&&typeof v==='object'&&!Array.isArray(v))return v}catch{}return f}
function saveUI(){localStorage.setItem(UI_PREF,JSON.stringify({activityOpen:[...activityOpen],positionsOpen:[...positionsOpen],statsOpen:[...statsOpen],settingsOpen:$('settingsPanel')?.open||false}))}
function loadEnabledTraders(){const valid=new Set(defaultTraderIds());return loadArray(TRADER_PREF,defaultTraderIds()).filter(id=>valid.has(id))}
function saveEnabledTraders(x){localStorage.setItem(TRADER_PREF,JSON.stringify(x))}
function loadEnabledTypes(){const valid=new Set(cfg?.eventTypes||DEFAULT_TYPES);return loadArray(TYPE_PREF,[...valid]).filter(x=>valid.has(x))}
function saveEnabledTypes(x){localStorage.setItem(TYPE_PREF,JSON.stringify(x))}
function loadLabels(){const saved=loadObject(LABEL_PREF,{}),out={};for(const t of cfg?.traders||[]){out[t.id]=saved[t.id]??t.defaultTag??''}return out}
function saveLabel(id,value){const labels=loadObject(LABEL_PREF,{});labels[id]=value;localStorage.setItem(LABEL_PREF,JSON.stringify(labels))}
function typeLabel(t){return({OPEN:'建倉',ADD:'加碼',REDUCE:'減碼',CLOSE:'平倉',CONSENSUS:'共識'})[t]||t}
function eventAction(e){if(e.type==='OPEN')return e.direction||'';if(e.type==='ADD')return'加碼';if(e.type==='REDUCE')return'減碼';if(e.type==='CLOSE')return'平倉';if(e.type==='CONSENSUS')return`${e.direction||''}共識`;return e.type||''}
function actionClass(e){const type=String(e?.type||'').toUpperCase(),side=String(e?.side||'').toUpperCase(),dir=String(e?.direction||'');if(type==='REDUCE')return'green';if(type==='CLOSE')return'gold';if(side==='LONG'||dir.includes('多'))return'red';if(side==='SHORT'||dir.includes('空'))return'green';return'gold'}
function activityClass(a){if(!a)return'';if(a.code==='REDUCING')return'reduce';if(a.code==='JUST_OPENED'||a.code==='ADDING')return'long';if(a.code==='JUST_CLOSED')return'close';return''}
function confidenceLabel(c){return({HIGH:'高',MEDIUM:'中',LOW:'低'})[c]||'低'}
function confidenceClass(c){return String(c||'LOW').toLowerCase()}
function signalClass(v){return String(v?.level||'WAIT').toLowerCase()}
function sourceClass(d){const s=String(d?.sourceType||'NONE').toLowerCase();return s==='live'?'live':s==='public'?'public':'none'}
function sourceStatusZh(v){return({OK:'正常',NO_HISTORY:'無歷史',PARSE_ERROR:'格式變更',ERROR:'暫時失敗',WAITING:'同步中',EMPTY:'空倉',EMPTY_CONFIRMING:'確認中'})[String(v||'WAITING')]||String(v||'同步中')}
function hasNum(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function numberText(v,d=0){if(!hasNum(v))return'—';return Number(v).toLocaleString('en-US',{maximumFractionDigits:d})}
function leverageText(v){return hasNum(v)?`${Number(v).toFixed(Number(v)%1?1:0)}x`:'—'}
function positionEmptyText(t){
  const p=String(t?.positionStatus||'WAITING');
  if(p==='ERROR')return'倉位來源暫時不可用 · 自動重試中';
  if(p==='PARSE_ERROR')return'Binance 倉位格式變更 · 訂單備援監控中';
  if(p==='EMPTY_CONFIRMING')return'目前無倉位 · 快照確認中';
  if(p==='WAITING')return'同步倉位中…';
  return'目前無倉位';
}
function eventValue(e){
  if(e?.kind==='CONSENSUS')return`${(e.traderNames||[]).length}人`;
  if(e?.priceLabel)return e.priceLabel;
  return price(e?.tradePrice||e?.entryPrice);
}
function pct(v,d=1){if(v===null||v===undefined||v==='')return'—';const x=Number(v);return Number.isFinite(x)?`${x.toFixed(d)}%`:'—'}
function signedPct(v,d=2){if(v===null||v===undefined||v==='')return'—';const x=Number(v);if(!Number.isFinite(x))return'—';return`${x>0?'+':''}${x.toFixed(d)}%`}
function pnl(v){if(v===null||v===undefined||v==='')return'—';const x=Number(v);if(!Number.isFinite(x))return'—';const digits=Math.abs(x)>=100?1:Math.abs(x)>=10?2:3;return`${x>0?'+':''}${x.toLocaleString('en-US',{maximumFractionDigits:digits})} U`}
function pfText(s){if(s?.profitFactor===null||s?.profitFactor===undefined||s?.profitFactor==='')return'—';const x=Number(s.profitFactor);if(!Number.isFinite(x))return'—';if(s?.pfNoLosses)return'≥9.9';return x>=9.9?'≥9.9':x.toFixed(2)}
function metricClass(v){const x=Number(v);if(!Number.isFinite(x)||x===0)return'gold';return x>0?'up':'down'}
function durationText(v){const x=Number(v);if(!Number.isFinite(x))return'—';if(x<60)return`${Math.round(x)} 分`;if(x<1440)return`${(x/60).toFixed(1)} 小時`;return`${(x/1440).toFixed(1)} 天`}
async function getPushSubscription(){if(!('serviceWorker'in navigator))return null;const r=await navigator.serviceWorker.getRegistration('/');return r?await r.pushManager.getSubscription():null}
async function syncPreferences(){const sub=await getPushSubscription();if(!sub)return;await fetch('/api/preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes()})})}
function b64ToUint8(base64){const padding='='.repeat((4-base64.length%4)%4),s=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}

function renderMaster(){const enabled=loadEnabledTraders();$('allToggle').checked=enabled.length===cfg.traders.length;$('allCount').textContent=`${enabled.length}/${cfg.traders.length}`}
function renderTypes(){const enabled=new Set(loadEnabledTypes());$('typeOptions').innerHTML=(cfg.eventTypes||DEFAULT_TYPES).map(t=>`<label class="typeChoice"><input class="typeToggle" type="checkbox" data-type="${esc(t)}" ${enabled.has(t)?'checked':''}><span>${esc(typeLabel(t))}</span></label>`).join('');document.querySelectorAll('.typeToggle').forEach(el=>el.addEventListener('change',async()=>{const types=[...document.querySelectorAll('.typeToggle:checked')].map(x=>x.dataset.type);saveEnabledTypes(types);await syncPreferences().catch(()=>{});$('msg').textContent='✅ 通知類型已更新'}))}
function renderLatest(events){
  const el=$('latest'),e=(events||[])[0];
  if(!e||!e.ts||Date.now()-new Date(e.ts).getTime()>30*60*1000){el.classList.remove('show');return}
  const title=e.kind==='CONSENSUS'?`${(e.traderNames||[]).length}人共識｜${eventAction(e)}`:`${e.traderName}｜${eventAction(e)}`;
  const body=e.kind==='CONSENSUS'?`${e.symbol}｜${(e.traderNames||[]).join('、')}`:`${e.symbol}｜${eventValue(e)}`;
  el.innerHTML=`<div><div class="latestTitle ${actionClass(e)}">${esc(title)}</div><div class="latestBody">${esc(body)}</div></div><div class="latestTime">${ageText(e.ts)}</div>`;
  el.classList.add('show')
}
function renderConsensus(rows){const panel=$('consensusPanel'),list=(rows||[]).slice(0,3);if(!list.length){panel.classList.remove('show');return}panel.innerHTML=`<div class="panelTitle"><b>即時共識</b><span>同幣種 · 同方向</span></div>`+list.map(c=>{const long=c.side==='LONG',level=String(c.level||'LOW').toLowerCase(),spread=Number.isFinite(Number(c.entrySpreadPct))?`價差 ${Number(c.entrySpreadPct).toFixed(2)}%`:'價差 —',time=Number.isFinite(Number(c.timeSpreadMin))?`時間差 ${Math.round(c.timeSpreadMin)}m`:'時間差 —';return`<div class="consensusRow"><div class="consensusMain"><div class="consensusLine"><span class="consensusSymbol">${esc(c.symbol)}</span><span class="dirBadge ${long?'long':'short'}">${esc(c.direction)}</span><span class="levelBadge ${level}">${c.level==='HIGH'?'高':c.level==='MEDIUM'?'中':'低'}</span></div><div class="consensusMeta">${c.count}/${c.total} 人 · ${spread} · ${time}</div></div><div class="consensusScore">${c.score}<small>共識強度</small></div></div>`}).join('');panel.classList.add('show')}
function positionRow(p,extra,open){const long=p.side==='LONG';return`<div class="pos ${extra&&!open?'hidden extraPos':extra?'extraPos':''}"><div class="symline"><span class="sym">${esc(p.symbol)}</span><span class="dirTag ${long?'long':'short'}">${esc(p.direction)}</span></div><div class="price ${long?'red':'green'}">${price(p.entryPrice)}</div></div>`}
function traderEvents(id,events){return(events||[]).filter(e=>e.traderId===id||(e.kind==='CONSENSUS'&&Array.isArray(e.traderIds)&&e.traderIds.includes(id))).slice(0,8)}
function eventRow(e){return`<div class="event"><span class="eventTime">${localTime(e.ts)}</span><span><span class="eventAct ${actionClass(e)}">${esc(eventAction(e))}</span> <span class="eventCoin">${esc(e.symbol||'')}</span></span><span class="eventPx ${actionClass(e)}">${esc(eventValue(e))}</span></div>`}

function traderCard(t,events){
  const enabled=loadEnabledTraders().includes(t.id);
  const list=t.positions||[],rest=list.slice(1);
  const openPos=positionsOpen.has(t.id),openAct=activityOpen.has(t.id),openStats=statsOpen.has(t.id);
  const evs=traderEvents(t.id,events),labels=loadLabels(),label=labels[t.id]||'';
  const live=t.recentStats||{},ref=t.referenceStats||{},d=t.displayStats||{},a=t.activity||{},sv=t.signalValue||{};

  let positions=list.length
    ? positionRow(list[0],false,openPos)+rest.map(p=>positionRow(p,true,openPos)).join('')
    : `<div class="emptyText">${esc(positionEmptyText(t))}</div>`;

  if(rest.length)positions+=`<button class="moreBtn" data-pos-id="${esc(t.id)}" data-count="${rest.length}">${openPos?'收合':`查看其餘 ${rest.length} 筆`}</button>`;

  const statsReady=Boolean(d.available);
  const sample=Number(d.sample||0);
  const confidence=d.confidence||'LOW';
  const staleness=t.lastFetch?ageText(t.lastFetch):'未同步';
  const signalText=sv.score===null||sv.score===undefined?(sv.label||'空倉'):String(sv.score);

  let metric1Label='資料狀態',metric1Value='等待',metric1Class='muted';
  if(hasNum(d.winRate)){
    metric1Label=`${d.sourceType==='PUBLIC'?'歷史勝率':'近期勝率'} · ${sample||'—'}筆`;
    metric1Value=pct(d.winRate);
    metric1Class=Number(d.winRate)>=50?'up':'down';
  }else if(hasNum(d.qualityScore)){
    metric1Label='公開評分';
    metric1Value=`${Number(d.qualityScore).toFixed(0)}/100`;
    metric1Class='gold';
  }

  let metric2Label='資料狀態',metric2Value='—',metric2Class='muted';
  if(hasNum(d.medianRoi)){
    metric2Label='中位 ROI';metric2Value=signedPct(d.medianRoi);metric2Class=metricClass(d.medianRoi);
  }else if(hasNum(d.profitFactor)){
    metric2Label='Profit Factor';metric2Value=pfText(d);metric2Class='gold';
  }else if(hasNum(d.reportedRoi)){
    metric2Label='平台 ROI';metric2Value=signedPct(d.reportedRoi,0);metric2Class=metricClass(d.reportedRoi);
  }else if(hasNum(d.avgDurationMin)){
    metric2Label='中位持倉';metric2Value=durationText(d.avgDurationMin);metric2Class='gold';
  }

  const sourceBadge=statsReady
    ? `<span class="dataBadge ${sourceClass(d)}">${esc(d.sourceLabel||'資料可用')}</span>`
    : `<span class="dataBadge none">資料等待</span>`;

  const confidenceBadge=statsReady
    ? `<span class="confidenceBadge ${confidenceClass(confidence)}">可信 ${confidenceLabel(confidence)}</span>`
    : '';

  const foot=[];
  if(hasNum(d.profitFactor)&&metric2Label!=='Profit Factor')foot.push(`PF ${pfText(d)}`);
  if(hasNum(d.avgRoi))foot.push(`Avg ROI ${signedPct(d.avgRoi)}`);
  if(hasNum(d.avgDurationMin))foot.push(`${d.sourceType==='PUBLIC'?'中位':'平均'}持倉 ${durationText(d.avgDurationMin)}`);
  if(hasNum(d.followers))foot.push(`跟隨 ${numberText(d.followers,0)}`);
  if(d.sourceType==='LIVE'&&Number(d.orderCount||t.statsOrderCount||0)>0)foot.push(`統計 ${Number(d.orderCount||t.statsOrderCount)} orders`);
  if(d.sourceType==='PUBLIC'&&hasNum(d.qualityScore))foot.push(`公開評分 ${Number(d.qualityScore).toFixed(0)}`);
  if(sv.reason)foot.push(sv.reason);

  const detailCells=[];
  detailCells.push(`<div class="statCell"><span>資料來源</span><b class="gold">${esc(d.sourceLabel||'等待資料')}</b></div>`);
  if(hasNum(d.winRate))detailCells.push(`<div class="statCell"><span>${d.sourceType==='PUBLIC'?'歷史勝率':'近期勝率'}</span><b class="${Number(d.winRate)>=50?'up':'down'}">${pct(d.winRate)}</b></div>`);
  if(hasNum(d.profitFactor))detailCells.push(`<div class="statCell"><span>Profit Factor</span><b>${pfText(d)}</b></div>`);
  if(sample>0)detailCells.push(`<div class="statCell"><span>完整交易樣本</span><b>${sample} 筆</b></div>`);
  if(hasNum(d.avgDurationMin))detailCells.push(`<div class="statCell"><span>${d.sourceType==='PUBLIC'?'中位持倉':'平均持倉'}</span><b>${durationText(d.avgDurationMin)}</b></div>`);
  if(hasNum(d.avgProfit))detailCells.push(`<div class="statCell"><span>平均獲利</span><b class="${metricClass(d.avgProfit)}">${pnl(d.avgProfit)}</b></div>`);
  if(hasNum(d.avgRoi))detailCells.push(`<div class="statCell"><span>平均 ROI</span><b class="${metricClass(d.avgRoi)}">${signedPct(d.avgRoi)}</b></div>`);
  if(hasNum(d.medianRoi))detailCells.push(`<div class="statCell"><span>中位 ROI</span><b class="${metricClass(d.medianRoi)}">${signedPct(d.medianRoi)}</b></div>`);
  if(hasNum(d.qualityScore))detailCells.push(`<div class="statCell"><span>公開評分</span><b class="gold">${Number(d.qualityScore).toFixed(0)}/100</b></div>`);
  if(hasNum(d.reportedRoi))detailCells.push(`<div class="statCell"><span>平台標示 ROI</span><b class="${metricClass(d.reportedRoi)}">${signedPct(d.reportedRoi,0)}</b></div>`);
  if(hasNum(d.followers))detailCells.push(`<div class="statCell"><span>跟隨者</span><b>${numberText(d.followers,0)}</b></div>`);
  if(hasNum(d.maxLeverage))detailCells.push(`<div class="statCell"><span>最高槓桿</span><b>${leverageText(d.maxLeverage)}</b></div>`);
  if(hasNum(d.reportedMdd))detailCells.push(`<div class="statCell"><span>平台 MDD</span><b class="down">${pct(-Math.abs(Number(d.reportedMdd)),1)}</b></div>`);
  detailCells.push(`<div class="statCell"><span>訊號價值</span><b class="gold">${esc(signalText)}${sv.label&&sv.score!=null?` · ${esc(sv.label)}`:''}</b></div>`);
  detailCells.push(`<div class="statCell"><span>統計更新</span><b>${d.updatedAt?ageText(d.updatedAt):'內建公開快照'}</b></div>`);

  return`<section class="traderCard">
    <div class="traderTop">
      <div class="traderMain">
        <div class="nameLine"><div class="traderName">${esc(t.name)}</div><button class="customTag ${label?'':'empty'}" data-label-id="${esc(t.id)}">${esc(label||'＋標籤')}</button></div>
        <div class="stateLine">
          <span class="statusBadge ${activityClass(a)}">${esc(a.label||'監控中')}</span>
          <span class="signalBadge ${signalClass(sv)}">訊號 ${esc(signalText)}</span>
          ${sourceBadge}${confidenceBadge}
          <span class="stateInfo">${list.length?`持倉 ${list.length}`:'空倉'} · ${staleness}</span>
        </div>
      </div>
      <label class="switch"><input class="traderToggle" data-id="${esc(t.id)}" type="checkbox" ${enabled?'checked':''}><span class="slider"></span></label>
    </div>

    <div class="metrics">
      <div class="metric"><div class="metricLabel">${esc(metric1Label)}</div><div class="metricValue ${metric1Class}">${esc(metric1Value)}</div></div>
      <div class="metric"><div class="metricLabel">${esc(metric2Label)}</div><div class="metricValue ${metric2Class}">${esc(metric2Value)}</div></div>
      <div class="metric"><div class="metricLabel">訊號價值</div><div class="metricValue signalValue ${signalClass(sv)}">${esc(signalText)}</div></div>
    </div>

    <div class="statFoot">${foot.map(x=>`<span>${esc(x)}</span>`).join('')}</div>

    <div class="positionBox">${positions}</div>

    <details class="details activity" data-activity-id="${esc(t.id)}" ${openAct?'open':''}>
      <summary><b>◷ 最近動靜</b><span>${evs.length?evs.length+' 筆':'無'}　⌄</span></summary>
      <div>${evs.length?evs.map(eventRow).join(''):'<div class="emptyText">尚無新動靜</div>'}</div>
    </details>

    <details class="details stats" data-stats-id="${esc(t.id)}" ${openStats?'open':''}>
      <summary><b>▦ 數據明細</b><span>${esc(d.sourceLabel||'等待資料')}　⌄</span></summary>
      <div class="statsGrid">${detailCells.join('')}</div>
      <div class="sourceNote">訂單 ${esc(sourceStatusZh(t.historyStatus))} · 倉位 ${esc(sourceStatusZh(t.positionStatus))}${t.referenceError?' · 公開資料暫用快照':''}</div>
    </details>
  </section>`
}
function bindCards(){document.querySelectorAll('.traderToggle').forEach(el=>el.addEventListener('change',async e=>{const set=new Set(loadEnabledTraders()),id=e.currentTarget.dataset.id;e.currentTarget.checked?set.add(id):set.delete(id);saveEnabledTraders([...set]);renderMaster();await syncPreferences().catch(()=>{});$('msg').textContent='✅ 交易員通知已更新'}));document.querySelectorAll('[data-pos-id]').forEach(btn=>btn.addEventListener('click',e=>{const id=e.currentTarget.dataset.posId,box=e.currentTarget.closest('.positionBox'),open=!positionsOpen.has(id);open?positionsOpen.add(id):positionsOpen.delete(id);box.querySelectorAll('.extraPos').forEach(x=>x.classList.toggle('hidden',!open));e.currentTarget.textContent=open?'收合':`查看其餘 ${e.currentTarget.dataset.count} 筆`;saveUI()}));document.querySelectorAll('[data-activity-id]').forEach(d=>d.addEventListener('toggle',e=>{const id=e.currentTarget.dataset.activityId;e.currentTarget.open?activityOpen.add(id):activityOpen.delete(id);saveUI()}));document.querySelectorAll('[data-stats-id]').forEach(d=>d.addEventListener('toggle',e=>{const id=e.currentTarget.dataset.statsId;e.currentTarget.open?statsOpen.add(id):statsOpen.delete(id);saveUI()}));document.querySelectorAll('[data-label-id]').forEach(btn=>btn.addEventListener('click',e=>openLabelSheet(e.currentTarget.dataset.labelId)))}
function renderTraders(list,events){$('traders').innerHTML=(list||[]).map(t=>traderCard(t,events)).join('');bindCards()}
function updateSync(){if(!lastStatus)return;const times=(lastStatus.traders||[]).map(t=>t.lastFetch?new Date(t.lastFetch).getTime():0).filter(Boolean);if(!times.length){$('syncAge').textContent='尚未同步';return}const oldest=new Date(Math.min(...times)).toISOString(),sec=Math.max(0,Math.round((Date.now()-new Date(oldest).getTime())/1000));$('syncAge').textContent=`資料 ${ageText(oldest)}`;$('dot').className=`dot ${sec<=10?'ok':sec<=25?'warn':'bad'}`}
function openLabelSheet(id){currentLabelId=id;$('labelInput').value=loadLabels()[id]||'';$('labelModal').classList.add('show');$('labelModal').setAttribute('aria-hidden','false');setTimeout(()=>$('labelInput').focus(),50)}
function closeLabelSheet(){$('labelModal').classList.remove('show');$('labelModal').setAttribute('aria-hidden','true');currentLabelId=null}
function saveLabelSheet(){if(!currentLabelId)return;saveLabel(currentLabelId,$('labelInput').value.trim().slice(0,10));closeLabelSheet();if(lastStatus)renderTraders(lastStatus.traders,lastStatus.events)}
async function refresh(){
  try{
    if(!cfg){
      const cr=await fetch('/api/config',{cache:'no-store'});
      if(!cr.ok)throw new Error(`config ${cr.status}`);
      cfg=await cr.json();
      renderTypes();
      if(localStorage.getItem(TRADER_PREF)===null)saveEnabledTraders(defaultTraderIds());
      else{
        const existing=loadEnabledTraders(),valid=new Set(defaultTraderIds());
        const merged=[...new Set([...existing,...defaultTraderIds().filter(id=>valid.has(id)&&!existing.includes(id))])];
        saveEnabledTraders(merged);
      }
      await syncPreferences().catch(()=>{})
    }

    const sr=await fetch('/api/status',{cache:'no-store'});
    if(!sr.ok)throw new Error(`status ${sr.status}`);
    const s=await sr.json();

    lastStatus=s;
    const ok=s.healthy>0;
    $('status').textContent=ok?`監控 ${s.healthy}/${s.total}`:'連線異常';
    renderMaster();
    renderLatest(s.events||[]);
    renderConsensus(s.consensus||[]);
    renderTraders(s.traders||[],s.events||[]);
    updateSync()
  }catch(e){
    $('dot').className='dot bad';
    $('status').textContent='連線異常';
    $('syncAge').textContent='等待重連'
  }
}

$('allToggle').addEventListener('change',async e=>{const ids=e.currentTarget.checked?defaultTraderIds():[];saveEnabledTraders(ids);renderMaster();if(lastStatus)renderTraders(lastStatus.traders,lastStatus.events);await syncPreferences().catch(()=>{});$('msg').textContent=e.currentTarget.checked?'✅ 全部交易員已開啟':'🔕 全部交易員已關閉'});
$('settingsPanel').open=!!ui.settingsOpen;$('settingsPanel').addEventListener('toggle',saveUI);
$('labelCancel').addEventListener('click',closeLabelSheet);$('labelSave').addEventListener('click',saveLabelSheet);$('labelModal').addEventListener('click',e=>{if(e.target===$('labelModal'))closeLabelSheet()});$('labelInput').addEventListener('keydown',e=>{if(e.key==='Enter')saveLabelSheet();if(e.key==='Escape')closeLabelSheet()});
$('subscribe').onclick=async()=>{try{if(!cfg)cfg=await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());if(!cfg.vapidPublicKey)throw new Error('伺服器尚未設定推播金鑰');if(!('serviceWorker'in navigator))throw new Error('此瀏覽器不支援通知');const reg=await navigator.serviceWorker.register('/sw.js?v=59'),permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('你沒有允許通知');const existing=await reg.pushManager.getSubscription(),sub=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(cfg.vapidPublicKey)});const r=await fetch('/api/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({subscription:sub,enabledTraders:loadEnabledTraders(),enabledTypes:loadEnabledTypes()})});if(!r.ok)throw new Error(await r.text());$('msg').textContent='✅ iPhone 通知已同步'}catch(e){$('msg').textContent=`❌ ${e.message}`}};
$('test').onclick=async()=>{const traderId=loadEnabledTraders()[0]||cfg?.traders?.[0]?.id,r=await fetch('/api/test-push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({traderId})});$('msg').textContent=r.ok?'✅ 測試通知已送出':`❌ 測試失敗：${await r.text()}`};

refresh();
setInterval(refresh,8000);
setInterval(updateSync,1000);
