import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_NARRATIVE_LAYOUT_V2676_20260904';

function checkJs(file,label){
  const r=spawnSync(process.execPath,['--check',file],{cwd:__dirname,encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error(`[v2676] ${label} syntax invalid: ${String(r.stderr||r.stdout||r.error?.message||'').trim()}`);
}
function functionRange(src,name){
  const needles=[`function ${name}(`,`async function ${name}(`];
  const starts=needles.map(n=>src.indexOf(n)).filter(i=>i>=0);
  if(!starts.length)return null;
  const start=Math.min(...starts),brace=src.indexOf('{',start);
  if(brace<0)return null;
  let depth=0,quote=null,escape=false,lineComment=false,blockComment=false;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue}
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\'){escape=true;continue}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0)return {start,end:i+1}}
  }
  return null;
}
function replaceFunction(src,name,code,{required=true}={}){
  const r=functionRange(src,name);
  if(!r){if(required)throw new Error(`[v2676] runtime function missing: ${name}`);return src}
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}
function assertAll(src,needles,label){for(const n of needles)if(!src.includes(n))throw new Error(`[v2676] ${label} missing: ${n}`)}

function verifyShadowLearningBridge(){
  const shadowPatchPath=path.join(__dirname,'shadow-learning-v264-patch.mjs');
  const shadowCodePath=path.join(__dirname,'shadow-learning-v264-code.inc');
  const recallPath=path.join(__dirname,'candidate-recall-v2665-patch.mjs');
  for(const f of [shadowPatchPath,shadowCodePath,recallPath])if(!fs.existsSync(f))throw new Error('[v2676] Shadow bridge source missing: '+path.basename(f));
  const patch=fs.readFileSync(shadowPatchPath,'utf8'),code=fs.readFileSync(shadowCodePath,'utf8'),recall=fs.readFileSync(recallPath,'utf8');
  assertAll(patch,['abcLearning=abcShadowLearningForTracker','Number(abcLearning.adjustment||0)','abcLearning:{sample:abcLearning.sample'],'Shadow score bridge');
  assertAll(code,['function abcShadowLearningForTracker(','ABC_SHADOW_MIN_GRADE_SAMPLE','learningEligible!==false'],'ABC Shadow learner');
  assertAll(recall,['const out={...x}','out.candidate=true','candidateEvidence'],'candidate ABC passthrough');
  return true;
}

const HELPERS=String.raw`
/* CANDIDATE_NARRATIVE_LAYOUT_V2676_20260904 */
function hashV2676(v){let h=2166136261;for(const c of String(v||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function pickV2676(x,salt,arr){return arr[(hashV2676(String(x?.symbol||'')+'|'+String(x?.direction||'')+'|'+String(x?.candidateBand||'')+'|'+salt)%arr.length)]}
function cleanCondV2676(v){return String(v||'').replace(/^[-•·\s]+/,'').replace(/[。；;]+$/,'').replace(/\s+/g,' ').trim()}
function condKeyV2676(v){return cleanCondV2676(v).toLowerCase().replace(/[\s、，,。；;：:／/|+＋()（）\[\]【】「」『』]/g,'')}
function uniqCondV2676(items,used=[]){
  const seen=used.map(condKeyV2676).filter(Boolean),out=[];
  for(const raw of items||[]){
    const text=cleanCondV2676(raw),key=condKeyV2676(text);if(!key)continue;
    if(seen.some(k=>k===key||(k.length>=7&&key.includes(k))||(key.length>=7&&k.includes(key))))continue;
    seen.push(key);out.push(text);
  }
  return out;
}
function shadowBridgeV2676(x){
  const a=x?.abcLearning||{},s=x?.shadow||{},e=x?.candidateEvidence||{};
  const abcSample=Number(a.sample||0),legacySample=Number(e.shadowSample??s.sample??0);
  const useAbc=abcSample>0;
  const sample=useAbc?abcSample:legacySample;
  const hit=n(useAbc?a.hitRate:(e.shadowHitRate??s.hitRate));
  const pf=n(useAbc?a.profitFactor:(e.shadowProfitFactor??s.profitFactor));
  const exp=n(useAbc?a.expectancyR:s.expectancyR);
  const adj=n(useAbc?a.adjustment:s.adjustment)??0;
  const level=String(useAbc?(a.level||'ABC Shadow'):(e.shadowLevel||s.level||'Shadow'));
  const active=useAbc?a.active===true:sample>=6;
  return {useAbc,sample,hit,pf,exp,adj,level,active};
}
function signedV2676(v){const x=Number(v||0);return (x>0?'+':'')+x.toFixed(1)}
function shadowTextV2676(x){
  const sh=shadowBridgeV2676(x),name=sh.useAbc?'ABC Shadow':'Shadow';
  if(sh.sample<=0)return {tone:'neutral',text:pickV2676(x,'sh0',[
    '影子樣本尚未成形；這輪不把空白歷史當成優勢，先由即時結構與資金決定候選順位。',
    '目前沒有足夠的同型影子樣本可加權；系統只保留候選資格，等後續結果累積再調整。',
    '影子資料不足時不硬湊勝率；本輪分數主要來自盤面條件，Shadow 只持續收樣本。'
  ])};
  const stat=[name+' '+sh.sample+'筆',sh.hit!=null?'命中 '+sh.hit.toFixed(1)+'%':null,sh.pf!=null?'PF '+sh.pf.toFixed(2):null,sh.exp!=null?'期望 '+sh.exp.toFixed(2)+'R':null].filter(Boolean).join(' · ');
  if(sh.useAbc&&!sh.active)return {tone:'neutral',text:stat+'。樣本還沒到啟用門檻，ABC 回饋暫為 0 分；先累積，不提前放大權重。'};
  if(sh.adj>0)return {tone:'good',text:pickV2676(x,'sh+',[
    stat+'；影子回饋 '+signedV2676(sh.adj)+' 分已直接進候選排序。',
    stat+'。這組結果目前給 '+signedV2676(sh.adj)+' 分正向回饋，已納入候選分數。',
    stat+'；歷史回饋為 '+signedV2676(sh.adj)+' 分，排序已同步吃到這個學習結果。'
  ])};
  if(sh.adj<0)return {tone:'warn',text:pickV2676(x,'sh-',[
    stat+'；影子回饋 '+signedV2676(sh.adj)+' 分正在壓低候選排序，不會因短線看起來強就忽略歷史弱點。',
    stat+'。目前學習回饋是 '+signedV2676(sh.adj)+' 分，系統已把這個負項扣回候選分數。',
    stat+'；歷史端給 '+signedV2676(sh.adj)+' 分負回饋，因此即時盤面要更乾淨才可能升級。'
  ])};
  return {tone:'neutral',text:stat+'；目前影子調整 0.0 分，歷史不加分也不扣分，持續等待新結果更新。'};
}
function marketReadV2676(x){
  const s=x?.structure||{},st=String(s.state||'UNKNOWN'),dir=String(x?.direction||'LONG')==='SHORT'?'空方':'多方',m=candMetricV2671(x);
  const state=st==='INTACT'?'結構完整':st==='RECLAIMING'?'結構收復中':st==='DAMAGED'?'結構受損':st==='OPPORTUNITY'?'位於機會區':'結構待確認';
  const clues=[];
  if(m.vr!=null)clues.push({w:Math.abs(m.vr-1),t:m.vr>=1.15?'量比 '+m.vr.toFixed(2)+'×，成交有放大':m.vr<.75?'量比 '+m.vr.toFixed(2)+'×，成交偏冷':'量比 '+m.vr.toFixed(2)+'×，量能普通'});
  if(m.takerA!=null)clues.push({w:Math.abs(m.takerA)*4,t:m.takerA>=.03?'主動盤與'+dir+'同向':m.takerA<=-.05?'主動盤正在逆著'+dir:'主動盤暫時中性'});
  if(m.topA!=null)clues.push({w:Math.abs(m.topA)*4,t:m.topA>=.03?'大戶方向配合'+dir:m.topA<=-.06?'大戶方向與'+dir+'相反':'大戶方向沒有明顯偏移'});
  clues.sort((a,b)=>b.w-a.w);
  const clue=clues[0]?.t||'即時資金細項仍在補資料';
  return pickV2676(x,'market',[
    state+'；'+clue+'。',
    state+'，目前最值得注意的是：'+clue+'。',
    '盤面先看'+state+'；資金端以「'+clue+'」最有辨識度。',
    state+'。此刻不重複看分數，直接看盤面：'+clue+'。'
  ]);
}
function candidatePlanV2676(x){
  const g=x?.formalGap||{},soft=Array.isArray(x?.candidateSoftWait)?x.candidateSoftWait:[],hard=Array.isArray(x?.candidateHardBlockers)?x.candidateHardBlockers:[];
  const bAll=uniqCondV2676([...(g.toB||[]),...soft]);
  const trigger=bAll[0]||'即時結構與資金同步確認';
  const bRest=uniqCondV2676(bAll.slice(1),[trigger]).slice(0,2);
  const aRest=uniqCondV2676(g.toA||[],[trigger,...bRest]).slice(0,2);
  const hardUniq=uniqCondV2676(hard,[trigger,...bRest,...aRest]).slice(0,3);
  const next=pickV2676(x,'next',[
    '下一個只盯「'+trigger+'」；沒補上前，維持候選，不提前當正式訊號。',
    '升級前最關鍵的一件事是「'+trigger+'」；先等它發生，再重算 A/B。',
    '現在不用多看條件，先等「'+trigger+'」；這一項沒過，就不往正式層推。',
    '下一個判斷節點鎖定「'+trigger+'」；完成後才值得重新比較正式等級。'
  ]);
  return {trigger,bRest,aRest,hardUniq,next};
}
function actionTextV2676(x){
  const band=String(x?.candidateBand||'WATCH'),dir=String(x?.direction||'LONG')==='SHORT'?'空':'多';
  if(band==='PRIME')return pickV2676(x,'actP',[
    '優先開圖，但只照你的建倉規則執行；候選順位高不等於可以追價。',
    '放在第一檢查序列。真正下單仍等你的回踩/確認，不因候選標籤提前進場。',
    '可以先看這顆；若你的'+dir+'方進場條件沒有成立，就繼續等，不用硬做。'
  ]);
  if(band==='RELATIVE')return pickV2676(x,'actR',[
    '先保留在雷達，不急著打；它只是安全層裡相對前排，還不是正式優勢。',
    '目前用途是比較，不是執行。等它自己補強後再決定要不要移進正式名單。',
    '先觀察即可；相對排名只能讓它留下，不能替代你的進場確認。'
  ]);
  if(band==='RESEARCH')return pickV2676(x,'actX',[
    '只當研究標的；沒有新增明確證據就略過，不占用正式交易注意力。',
    '研究層先收資料，不下結論；等條件改善再回到可執行候選。',
    '先讓系統繼續追蹤，不需要主動找單；有新加分再看。'
  ]);
  return pickV2676(x,'actW',[
    '值得看，但先讓盤面證明自己；候選只是提醒你開圖，不是叫你進場。',
    '維持觀察，等你的進場規則成立再處理；現在不需要為了怕錯過而追。',
    '先看後等。只要你的確認條件沒到，就把它留在候選，不做額外動作。'
  ]);
}
function upgradeHtmlV2676(plan){
  const b=plan.bRest.length?plan.bRest.join(' · '):'B 條件已接近，只等下一個判斷節點';
  const a=plan.aRest.length?plan.aRest.join(' · '):'在 B 基礎上再需要更高一致性';
  return '<div class="candidate-upgrade-v2676"><b>升級路徑</b><div><span>B</span><p>'+esc(b)+'</p></div><div><span>A</span><p>'+esc(a)+'</p></div></div>';
}
`;

const CARD_FN=String.raw`
function card(x){
  const id=keyOf(x),ck=String(x?.candidateKey||id),s=x.structure||{},open=opens()[id]===true,currentPx=n(x?.entry?.currentPrice),health=n(s.health),remain=Math.max(0,Math.ceil(Number(x?.candidateRemainingMs||0)/60000));
  const sh=shadowTextV2676(x),market=marketReadV2676(x),plan=candidatePlanV2676(x),action=actionTextV2676(x),d=candDraftV2671(ck);
  const fv=(k,f='')=>esc(Object.prototype.hasOwnProperty.call(d,k)?d[k]:(f??''));
  const hardHtml=plan.hardUniq.length?'<div class="candidate-hard-v2676"><b>硬失效</b><p>'+esc(plan.hardUniq.join(' · '))+'</p></div>':'';
  return '<article class="mw-card mw-candidate-card-v2664 candidate-narrative-v2666 candidate-v2667 candidate-v2671 candidate-v2676" data-candidate-id="'+esc(id)+'" data-candidate-key="'+esc(ck)+'">'+
    '<details '+(open?'open':'')+'>'+
      '<summary>'+
        '<span class="mw-grade candidate">候</span>'+
        '<div class="mw-main candidate-main-v2667"><div class="candidate-title-v2667"><a href="'+tvUrl(x.symbol)+'" target="_blank" rel="noopener">'+esc(x.symbol)+'</a><em class="'+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</em></div>'+candidateMetaV2667(x)+'</div>'+
        '<div class="mw-score candidate-score"><b>'+pct(x.candidateWinRate)+'</b><span>候選勝率</span></div>'+
        '<button type="button" class="candidate-delete-v2671" data-candidate-dismiss="'+esc(ck)+'" aria-label="移到候選歷史">×</button>'+
        '<i class="mw-chevron">⌄</i>'+
      '</summary>'+
      '<div class="mw-body">'+
        '<div class="candidate-topline-v2676">'+
          '<div><span>候選分</span><b>'+Math.round(Number(x.candidateScore||0))+'</b></div>'+
          '<div><span>現價</span><b>'+(currentPx==null?'—':px(currentPx))+'</b></div>'+
          '<div><span>結構</span><b>'+(health==null?'—':Math.round(health))+'</b></div>'+
          '<div><span>效期</span><b>'+(remain>0?remain+'分':'本輪')+'</b></div>'+
        '</div>'+
        '<div class="candidate-story-grid-v2676">'+
          '<section class="shadow '+sh.tone+'"><b>影子學習</b><p>'+esc(sh.text)+'</p></section>'+
          '<section><b>盤面現在</b><p>'+esc(market)+'</p></section>'+
          '<section><b>下一步</b><p>'+esc(plan.next)+'</p></section>'+
          '<section class="action"><b>執行</b><p>'+esc(action)+'</p></section>'+
        '</div>'+upgradeHtmlV2676(plan)+hardHtml+
        '<details class="candidate-trade-form-v2671"><summary><div><b>實際建倉資料</b><small>候選也可以直接記錄你的實際單</small></div><i>⌄</i></summary>'+
          '<div class="candidate-trade-grid-v2671">'+
            '<label><span>成本</span><input data-cand-f="entry" inputmode="decimal" value="'+fv('entry','')+'"></label>'+
            '<label><span>TP1</span><input data-cand-f="tp1" inputmode="decimal" value="'+fv('tp1','')+'"></label>'+
            '<label><span>TP2</span><input data-cand-f="tp2" inputmode="decimal" value="'+fv('tp2','')+'"></label>'+
            '<label><span>SP1</span><input data-cand-f="sp1" inputmode="decimal" value="'+fv('sp1','')+'"></label>'+
            '<label><span>SP2</span><input data-cand-f="sp2" inputmode="decimal" value="'+fv('sp2','')+'"></label>'+
            '<label><span>保證金 U</span><input data-cand-f="margin" inputmode="decimal" value="'+fv('margin','300')+'"></label>'+
            '<label><span>槓桿</span><input data-cand-f="leverage" inputmode="numeric" value="'+fv('leverage','20')+'"></label>'+
            '<label><span>數量（可空）</span><input data-cand-f="quantity" inputmode="decimal" value="'+fv('quantity','')+'"></label>'+
          '</div>'+
          '<div class="candidate-trade-actions-v2671"><button type="button" data-cand-fill-current>成本用現價 '+(currentPx==null?'—':px(currentPx))+'</button><button type="button" class="save" data-cand-save-trade>儲存並開始追蹤</button></div>'+
          '<div class="candidate-trade-msg-v2671" data-cand-msg></div>'+
        '</details>'+
      '</div>'+
    '</details>'+
  '</article>';
}
`;

const RENDER_FN=String.raw`
function render(){
  const h=ensureHost();if(!h||!data)return;
  const rows=(data.rows||[]).filter(x=>x?.candidate===true&&x?.trade?.status!=='ACTIVE').slice(0,5);
  const p=data.pipeline||{},rejects=Array.isArray(p.topRejects)?p.topRejects.slice(0,3):[];
  const deep=Number(p.deepAnalyzed??p.analyzed??0),pool=Number(p.candidateUniverse??p.ranked??0),safe=Number(p.hardSafe||0),ab=Number(p.formalA||0)+Number(p.formalB||0);
  const pipe='深析 '+deep+' · 候選池 '+pool+' · 安全 '+safe+' · A/B '+ab;
  const rejectText=rejects.map(x=>esc(x.reason)+' '+Number(x.count||0)).join(' · ');
  const sig=JSON.stringify([rows.map(x=>[
    keyOf(x),Math.round(Number(x.candidateScore||0)),Number(x.candidateWinRate||0).toFixed(1),x.candidateBand,
    Math.ceil(Number(x.candidateRemainingMs||0)/60000),x.structure?.state,x.trackerStatus,n(x?.abcLearning?.adjustment),
    Number(x?.abcLearning?.sample||0),n(x?.marketMetrics?.volumeRatio),n(x?.marketMetrics?.takerRatio),n(x?.marketMetrics?.topRatio)
  ]),pipe,rejectText]);
  if(sig===lastSig&&h.querySelector('.candidate-list-v2664')){renderHistoryV2671();renderNotifyCustomV2673();return}
  lastSig=sig;
  h.innerHTML=
    '<summary class="candidate-group-summary-v2667 candidate-group-summary-v2671 candidate-group-summary-v2673 candidate-compact-v2676">'+
      '<div class="candidate-group-title-v2667"><b>候選</b><span>'+rows.length+'</span></div>'+
      '<small class="candidate-pipeline-v2676">'+esc(pipe)+'</small>'+
      '<button type="button" class="candidate-refresh-v2671 candidate-refresh-v2673" data-candidate-refresh aria-label="更新候選">↻</button>'+
      '<i>⌄</i>'+
    '</summary>'+
    '<div class="mw-list candidate-list-v2664">'+
      (rows.length?rows.map(card).join(''):'<div class="mw-empty">本輪沒有有效候選'+(rejectText?' · 主要淘汰：'+rejectText:'')+'</div>')+
    '</div>';
  renderHistoryV2671();renderNotifyCustomV2673();
}
`;

const CSS=String.raw`
/* CANDIDATE_NARRATIVE_LAYOUT_V2676_20260904 */

/* 候選總覽：跟候選歷史同一種密度，不再做巨型 banner */
.mw-candidate-group-v2664>summary.candidate-compact-v2676{
  position:relative!important;
  display:grid!important;
  grid-template-columns:auto minmax(0,1fr) 34px 16px!important;
  align-items:center!important;
  gap:12px!important;
  width:100%!important;
  min-height:68px!important;
  margin:0!important;
  padding:12px 15px!important;
  box-sizing:border-box!important;
  overflow:hidden!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667{
  display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;
  width:auto!important;margin:0!important;padding:0!important;white-space:nowrap!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 b{
  font-size:18px!important;line-height:1.25!important;text-align:left!important;white-space:nowrap!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 span{
  display:grid!important;place-items:center!important;width:32px!important;min-width:32px!important;height:32px!important;
  margin:0!important;padding:0!important;font-size:14px!important;line-height:1!important;
}
.mw-candidate-group-v2664 .candidate-pipeline-v2676{
  display:block!important;min-width:0!important;width:100%!important;margin:0!important;padding:0!important;
  border:0!important;background:transparent!important;box-shadow:none!important;
  color:#98a4aa!important;font-size:13.5px!important;font-weight:560!important;line-height:1.42!important;
  text-align:center!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:normal!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-refresh-v2673{
  position:static!important;transform:none!important;justify-self:center!important;align-self:center!important;
  display:grid!important;place-items:center!important;width:32px!important;min-width:32px!important;max-width:32px!important;height:32px!important;
  margin:0!important;padding:0!important;box-sizing:border-box!important;overflow:hidden!important;
}
.mw-candidate-group-v2664>summary.candidate-compact-v2676>i{
  position:static!important;transform:none!important;justify-self:center!important;align-self:center!important;
  display:grid!important;place-items:center!important;width:16px!important;min-width:16px!important;height:22px!important;margin:0!important;padding:0!important;
}

/* 卡片控制項：X 真正固定成小方鈕，箭頭獨立，不再出現長條按鈕 */
.candidate-v2676>details>summary{position:relative!important;padding-right:56px!important;min-height:96px!important}
.candidate-v2676>details>summary>button.candidate-delete-v2671{
  position:absolute!important;top:11px!important;right:11px!important;left:auto!important;bottom:auto!important;
  display:grid!important;place-items:center!important;width:32px!important;min-width:32px!important;max-width:32px!important;height:32px!important;min-height:32px!important;max-height:32px!important;
  margin:0!important;padding:0!important;border-radius:9px!important;line-height:1!important;z-index:5!important;
}
.candidate-v2676>details>summary>.mw-chevron{
  position:absolute!important;right:20px!important;bottom:12px!important;top:auto!important;width:14px!important;height:18px!important;margin:0!important;padding:0!important;
}

/* 展開：四個區塊各講一件事；不再重複 Shadow/等待/B/A 同一句 */
.candidate-topline-v2676{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 10px}
.candidate-topline-v2676>div{min-width:0;padding:10px 11px;border:1px solid #34434d;border-radius:11px;background:#151e24}
.candidate-topline-v2676 span{display:block;margin-bottom:4px;color:#87939a;font-size:11.5px;line-height:1.3}
.candidate-topline-v2676 b{display:block;color:#edf0ee;font-size:16px;line-height:1.2;white-space:normal;overflow-wrap:anywhere}
.candidate-story-grid-v2676{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.candidate-story-grid-v2676 section{min-width:0;padding:12px 13px;border:1px solid #34434d;border-radius:12px;background:#151e24}
.candidate-story-grid-v2676 section.shadow{border-color:#43525a;background:#172128}
.candidate-story-grid-v2676 section.shadow.good{border-color:#466153}.candidate-story-grid-v2676 section.shadow.warn{border-color:#695044}
.candidate-story-grid-v2676 section.action{border-color:#5a4a31;background:#1b1c19}
.candidate-story-grid-v2676 section>b{display:block;margin:0 0 6px;color:#dfc27e;font-size:14px;line-height:1.25}
.candidate-story-grid-v2676 section p{margin:0;color:#d8dddf;font-size:14.5px;line-height:1.62;white-space:normal;word-break:break-word}
.candidate-upgrade-v2676{margin-top:9px;padding:11px 12px;border:1px solid #33424b;border-radius:12px;background:#141d22}
.candidate-upgrade-v2676>b{display:block;margin-bottom:7px;color:#aeb9be;font-size:12px;line-height:1.3}
.candidate-upgrade-v2676>div{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:start;gap:8px;padding:5px 0}
.candidate-upgrade-v2676>div+div{border-top:1px solid rgba(80,97,106,.35)}
.candidate-upgrade-v2676 span{display:grid;place-items:center;width:26px;height:22px;border-radius:7px;background:#213039;color:#dbc27f;font-size:12px;font-weight:800}
.candidate-upgrade-v2676 p{margin:0;color:#aeb8bd;font-size:13px;line-height:1.5;white-space:normal;word-break:break-word}
.candidate-hard-v2676{margin-top:9px;padding:10px 12px;border:1px solid #654840;border-radius:11px;background:#241b19}
.candidate-hard-v2676 b{display:block;margin-bottom:4px;color:#e0a295;font-size:12px}.candidate-hard-v2676 p{margin:0;color:#c7a9a1;font-size:13px;line-height:1.5}

@media(max-width:640px){
  .mw-candidate-group-v2664>summary.candidate-compact-v2676{
    grid-template-columns:auto minmax(0,1fr) 32px 14px!important;gap:8px!important;min-height:66px!important;padding:10px 11px!important;
  }
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667{gap:6px!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 b{font-size:17px!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-group-title-v2667 span{width:30px!important;min-width:30px!important;height:30px!important;font-size:13px!important}
  .mw-candidate-group-v2664 .candidate-pipeline-v2676{font-size:12.3px!important;line-height:1.38!important;text-align:center!important}
  .mw-candidate-group-v2664>summary.candidate-compact-v2676 .candidate-refresh-v2673{width:30px!important;min-width:30px!important;max-width:30px!important;height:30px!important}
  .candidate-v2676>details>summary{padding-right:50px!important;min-height:92px!important}
  .candidate-v2676>details>summary>button.candidate-delete-v2671{top:9px!important;right:9px!important;width:30px!important;min-width:30px!important;max-width:30px!important;height:30px!important;min-height:30px!important;max-height:30px!important}
  .candidate-v2676>details>summary>.mw-chevron{right:17px!important;bottom:10px!important}
  .candidate-topline-v2676{grid-template-columns:1fr 1fr!important;gap:7px!important}
  .candidate-topline-v2676>div{padding:9px 10px!important}
  .candidate-story-grid-v2676{grid-template-columns:1fr 1fr!important;gap:8px!important}
  .candidate-story-grid-v2676 section{padding:11px 12px!important}
  .candidate-story-grid-v2676 section p{font-size:14px!important;line-height:1.58!important}
}
@media(max-width:350px){
  .candidate-story-grid-v2676{grid-template-columns:1fr!important}
}

`;

function patchRuntime(){
  const jsPath=path.join(__dirname,'public','manual-candidate-v2664.js');
  if(!fs.existsSync(jsPath))throw new Error('[v2676] candidate runtime missing');
  let js=fs.readFileSync(jsPath,'utf8');
  if(js.includes(MARKER))return {changed:false,already:true};
  assertAll(js,['CANDIDATE_OPS_HISTORY_TRADE_V2671_20260904','CANDIDATE_UI_NOTIFY_CUSTOM_V2673_20260904','function card(','function render(){','function candidateSnapshotV2671('],'candidate runtime prerequisites');

  const cardAt=js.indexOf('function card(');
  if(cardAt<0)throw new Error('[v2676] card anchor missing');
  js=js.slice(0,cardAt)+HELPERS.trim()+'\n'+js.slice(cardAt);
  js=replaceFunction(js,'card',CARD_FN);
  js=replaceFunction(js,'render',RENDER_FN);
  js=replaceFunction(js,'candidateSnapshotV2671',`function candidateSnapshotV2671(x){\n  return {symbol:x?.symbol,direction:x?.direction,originalGrade:x?.originalGrade||x?.grade,candidateBand:x?.candidateBand,candidateScore:x?.candidateScore,candidateWinRate:x?.candidateWinRate,rank:x?.rank,rankScore:x?.rankScore,quoteVolume:x?.quoteVolume,shadow:x?.shadow||{},abcLearning:x?.abcLearning||{},candidateEvidence:x?.candidateEvidence||{},structure:x?.structure||null,softWait:x?.candidateSoftWait||[]}\n}`);

  const oldSnap='shadowSample:x.shadow?.sample,shadowHitRate:x.shadow?.hitRate,shadowProfitFactor:x.shadow?.profitFactor,freshnessAgeMs:x.freshnessAgeMs';
  const newSnap='shadowSample:x.shadow?.sample,shadowHitRate:x.shadow?.hitRate,shadowProfitFactor:x.shadow?.profitFactor,abcSample:x.abcLearning?.sample,abcHitRate:x.abcLearning?.hitRate,abcProfitFactor:x.abcLearning?.profitFactor,abcExpectancyR:x.abcLearning?.expectancyR,abcAdjustment:x.abcLearning?.adjustment,abcLevel:x.abcLearning?.level,abcActive:x.abcLearning?.active,freshnessAgeMs:x.freshnessAgeMs';
  if(js.includes(oldSnap))js=js.replace(oldSnap,newSnap);
  else if(!js.includes('abcSample:x.abcLearning?.sample'))throw new Error('[v2676] actual-trade Shadow snapshot anchor missing');

  js='/* '+MARKER+' */\n'+js;
  fs.writeFileSync(jsPath,js,'utf8');
  checkJs(jsPath,'generated candidate runtime');
  const final=fs.readFileSync(jsPath,'utf8');
  assertAll(final,[MARKER,'shadowBridgeV2676','abcLearning:x?.abcLearning||{}','abcSample:x.abcLearning?.sample','candidate-compact-v2676','影子學習','盤面現在','下一步','升級路徑'],'candidate runtime postcheck');
  return {changed:true};
}

function patchCss(){
  const cssPath=path.join(__dirname,'public','manual-candidate-v2664.css');
  if(!fs.existsSync(cssPath))throw new Error('[v2676] candidate CSS missing');
  let css=fs.readFileSync(cssPath,'utf8');
  if(!css.includes(MARKER)){css+='\n'+CSS+'\n';fs.writeFileSync(cssPath,css,'utf8')}
  const final=fs.readFileSync(cssPath,'utf8');
  assertAll(final,[MARKER,'candidate-compact-v2676','min-height:68px!important','candidate-story-grid-v2676','grid-template-columns:1fr 1fr','button.candidate-delete-v2671','max-width:32px!important'],'candidate CSS postcheck');
  return {changed:true};
}

function patchHtml(){
  const htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(htmlPath))return {changed:false};
  let h=fs.readFileSync(htmlPath,'utf8');
  h=h.replace(/\/manual-candidate-v2664\.js\?v=[^"'<>]+/g,'/manual-candidate-v2664.js?v=2676-0904');
  h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2676-0904');
  fs.writeFileSync(htmlPath,h,'utf8');
  return {changed:true};
}

export function patchCandidateNarrativeLayoutV2676(){
  const shadowBridge=verifyShadowLearningBridge();
  const runtime=patchRuntime(),css=patchCss(),html=patchHtml();
  return {
    changed:runtime.changed||css.changed||html.changed,
    version:'V2.6.76',
    compactHeader:true,
    noDuplicateCandidateCount:true,
    semanticNarrativeDedup:true,
    shadowLearningBridge:shadowBridge===true,
    abcShadowSnapshot:true,
    candidateDeleteCompact:true
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  try{console.log(patchCandidateNarrativeLayoutV2676())}catch(e){console.error(e?.stack||e);process.exit(1)}
}
