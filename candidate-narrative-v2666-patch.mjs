import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const MARKER='CANDIDATE_NARRATIVE_UI_V2666_20260904';

function check(file,label){
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0||r.error)throw new Error('[candidate-v2666] '+label+' syntax invalid: '+String(r.stderr||r.stdout||r.error?.message||'').trim());
}
function writeChecked(file,src,label){
  const tmp=file+'.v2666-'+process.pid+'-'+Date.now()+'.tmp.js';
  fs.writeFileSync(tmp,src,'utf8');
  try{check(tmp,label);fs.renameSync(tmp,file)}
  catch(e){try{fs.unlinkSync(tmp)}catch{};throw e}
}
function functionRange(src,name){
  const start=src.indexOf('function '+name+'(');
  if(start<0)return null;
  const brace=src.indexOf('{',start);if(brace<0)return null;
  let depth=0,quote=null,escape=false,lineComment=false,blockComment=false;
  for(let i=brace;i<src.length;i++){
    const ch=src[i],next=src[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++}continue}
    if(quote){
      if(escape){escape=false;continue}
      if(ch==='\\'){escape=true;continue}
      if(ch===quote)quote=null;
      continue;
    }
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
    if(ch==="'"||ch==='"'){quote=ch;continue}
    if(ch==='{')depth++;
    else if(ch==='}'){depth--;if(depth===0)return {start,end:i+1}}
  }
  return null;
}
function replaceFunction(src,name,code){
  const r=functionRange(src,name);
  if(!r)throw new Error('[candidate-v2666] runtime function missing: '+name);
  return src.slice(0,r.start)+code.trim()+src.slice(r.end);
}

const HELPERS=String.raw`
function zhDirV2666(x){return String(x?.direction||'LONG')==='SHORT'?'空方':'多方'}
function zhBandV2666(x){const b=String(x?.candidateBand||'WATCH');return b==='PRIME'?'優先候選':b==='RELATIVE'?'相對候選':'觀察候選'}
function shadowQualityV2666(x){
  const ev=x?.candidateEvidence||{},sample=Number(ev.shadowSample||0),hit=n(ev.shadowHitRate),pf=n(ev.shadowProfitFactor);
  if(sample<6)return {tone:'neutral',text:'同類 Shadow 樣本還少，現在主要靠即時結構與排名判斷。'};
  if(hit!=null&&pf!=null&&hit>=60&&pf>=1.2)return {tone:'good',text:'同類型 '+sample+' 筆，命中 '+hit.toFixed(1)+'%，PF '+pf.toFixed(2)+'，歷史表現偏強。'};
  if(hit!=null&&pf!=null&&hit>=55&&pf>=1.0)return {tone:'good',text:'同類型 '+sample+' 筆，命中 '+hit.toFixed(1)+'%，PF '+pf.toFixed(2)+'，目前有優勢，但還不是壓倒性。'};
  if(hit!=null&&pf!=null&&hit>=50&&pf>=.9)return {tone:'neutral',text:'同類型 '+sample+' 筆，命中 '+hit.toFixed(1)+'%，PF '+pf.toFixed(2)+'，屬於中性偏可用，還要看即時盤面。'};
  return {tone:'warn',text:'同類型 '+sample+' 筆的優勢不明顯，這顆現在只是相對排名靠前，不代表適合立刻下單。'};
}
function currentTextV2666(x){
  const s=x?.structure||{},st=String(s.state||'UNKNOWN'),dir=zhDirV2666(x),score=Math.round(Number(x.candidateScore||0)),win=pct(x.candidateWinRate),soft=Array.isArray(x.candidateSoftWait)?x.candidateSoftWait:[];
  let lead='';
  if(st==='INTACT')lead='結構目前完整，'+dir+'還有延續條件。';
  else if(st==='RECLAIMING')lead='結構正在收復，'+dir+'有機會，但還沒完成正式確認。';
  else if(st==='OPPORTUNITY')lead='目前在機會區附近，'+dir+'有條件，但需要看到收復或延續證據。';
  else if(st==='DAMAGED')lead='結構有受損，現在先當觀察，不適合急著出手。';
  else lead='Shadow 把它列進前段候選，但即時結構資料還在建立。';
  const wait=soft.length?'目前主要還在等：'+soft.slice(0,2).join('、')+'。':'目前沒有明顯等待型阻擋。';
  return lead+' Shadow 共識 '+score+' 分，候選勝率 '+win+'。'+wait;
}
function forecastTextV2666(x){
  const win=Number(x.candidateWinRate||0),dir=zhDirV2666(x),band=String(x.candidateBand||'WATCH');
  if(win>=64&&band==='PRIME')return '如果接下來結構沒有被破壞，量能與資金沒有明顯轉弱，'+dir+'延伸的機率目前偏高。反過來，如果收復失敗或大盤轉向，優勢會快速下降。';
  if(win>=59)return '目前比較偏向'+dir+'，但還屬於「有優勢、未確認」。如果後續結構與即時資金同向，才有機會升成正式 B / A；如果只是價格急拉急殺，先不追。';
  return '它是本輪安全標的裡相對較好的候選，但優勢還不夠厚。短線可能先震盪，等 Shadow 再拿到更多確認，方向才會更清楚。';
}
function adviceTextV2666(x){
  const band=String(x.candidateBand||'WATCH'),soft=Array.isArray(x.candidateSoftWait)?x.candidateSoftWait:[],g=x?.formalGap||{},toB=Array.isArray(g.toB)?g.toB:[];
  if(band==='PRIME'&&soft.length===0)return '列為優先觀察。先看 5 分 / 15 分是否繼續同向，再用你的盤感決定要不要打；不要因為它在候選就追價。';
  if(band==='PRIME')return '優先觀察，但先把等待條件看完：'+soft.slice(0,2).join('、')+'。條件沒補齊前，不把它當正式進場訊號。';
  if(band==='RELATIVE')return '先看，不急著打。它只是本輪相對前排；等 '+(toB.slice(0,2).join('、')||'正式確認條件')+' 補上，再重新評估。';
  return '放在觀察名單，等它自己變強。你要打的話，先確認即時結構、量能與大盤沒有反向，再由你自己決定進場位置。';
}
`;

const CARD=String.raw`
function card(x){
  const id=keyOf(x),s=x.structure||{},ev=x.candidateEvidence||{},g=x.formalGap||{},open=opens()[id]===true;
  const soft=Array.isArray(x.candidateSoftWait)?x.candidateSoftWait:[],hard=Array.isArray(x.candidateHardBlockers)?x.candidateHardBlockers:[];
  const sh=shadowQualityV2666(x),current=currentTextV2666(x),forecast=forecastTextV2666(x),advice=adviceTextV2666(x);
  const band=zhBandV2666(x),currentPx=n(x?.entry?.currentPrice);
  return '<article class="mw-card mw-candidate-card-v2664 candidate-narrative-v2666" data-candidate-id="'+esc(id)+'">'+
    '<details '+(open?'open':'')+'>'+
      '<summary>'+
        '<span class="mw-grade candidate">候</span>'+
        '<div class="mw-main"><div><a href="'+tvUrl(x.symbol)+'" target="_blank" rel="noopener">'+esc(x.symbol)+'</a><em class="'+(x.direction==='SHORT'?'short':'long')+'">'+(x.direction==='SHORT'?'做空':'做多')+'</em></div>'+
        '<small>'+esc(band)+' · '+esc(s.label||'等待結構')+' · '+age(x.freshnessAgeMs)+'</small></div>'+
        '<div class="mw-score candidate-score"><b>'+pct(x.candidateWinRate)+'</b><span>目前候選勝率</span></div>'+
        '<i class="mw-chevron">⌄</i>'+
      '</summary>'+
      '<div class="mw-body">'+
        '<div class="candidate-topline-v2666">'+
          '<div><span>Shadow 共識</span><b>'+Math.round(Number(x.candidateScore||0))+' 分</b></div>'+
          '<div><span>目前價格</span><b>'+(currentPx==null?'—':px(currentPx))+'</b></div>'+
          '<div><span>同類樣本</span><b>'+Number(ev.shadowSample||0)+' 筆</b></div>'+
          '<div><span>同類 PF</span><b>'+(n(ev.shadowProfitFactor)==null?'—':Number(ev.shadowProfitFactor).toFixed(2))+'</b></div>'+
        '</div>'+
        '<div class="candidate-shadow-read-v2666 '+sh.tone+'"><b>Shadow 怎麼看</b><p>'+esc(sh.text)+'</p></div>'+
        '<div class="candidate-analysis-grid-v2666">'+
          '<section><b>目前狀況</b><p>'+esc(current)+'</p></section>'+
          '<section><b>預計</b><p>'+esc(forecast)+'</p></section>'+
          '<section class="advice"><b>建議</b><p>'+esc(advice)+'</p></section>'+
        '</div>'+
        '<div class="candidate-why-v2666">'+
          '<div><b>還沒變正式 B 的原因</b>'+list((g.toB||[]).slice(0,4),'主要只差即時條件再確認','gap')+'</div>'+
          '<div><b>還沒變正式 A 的原因</b>'+list((g.toA||[]).slice(0,5),'A 級條件已接近完整','gap')+'</div>'+
        '</div>'+
        (soft.length?'<div class="candidate-wait-v2666"><b>目前等待</b><p>'+esc(soft.slice(0,3).join('、'))+'</p></div>':'')+
        (hard.length?'<div class="candidate-hard-v2666"><b>硬阻擋</b><p>'+esc(hard.slice(0,3).join('、'))+'</p></div>':'')+
      '</div>'+
    '</details>'+
  '</article>';
}
`;

const CSS=String.raw`
/* CANDIDATE_NARRATIVE_UI_V2666 */
.candidate-narrative-v2666 summary{min-height:86px!important;align-items:center!important;gap:12px!important}
.candidate-narrative-v2666 .mw-main a{font-size:22px!important;line-height:1.15!important;letter-spacing:.2px!important}
.candidate-narrative-v2666 .mw-main em{font-size:12px!important;padding:5px 8px!important}
.candidate-narrative-v2666 .mw-main small{display:block!important;margin-top:7px!important;max-width:100%!important;font-size:13px!important;line-height:1.5!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
.candidate-narrative-v2666 .candidate-score b{font-size:20px!important;line-height:1.15!important}
.candidate-narrative-v2666 .candidate-score span{font-size:11.5px!important;line-height:1.35!important;white-space:normal!important}
.candidate-topline-v2666{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:4px 0 12px}
.candidate-topline-v2666>div{min-width:0;padding:12px 13px;border:1px solid #35434c;border-radius:12px;background:#172128}
.candidate-topline-v2666 span{display:block;margin-bottom:6px;color:#8f989f;font-size:12px;line-height:1.35}
.candidate-topline-v2666 b{display:block;color:#eef0ee;font-size:18px;line-height:1.2}
.candidate-shadow-read-v2666{margin:0 0 12px;padding:13px 14px;border:1px solid #41515b;border-radius:12px;background:linear-gradient(145deg,#1b252c,#172027)}
.candidate-shadow-read-v2666.good{border-color:#456151}.candidate-shadow-read-v2666.warn{border-color:#635044}
.candidate-shadow-read-v2666>b{display:block;margin-bottom:6px;color:#cdb57b;font-size:14px}
.candidate-shadow-read-v2666 p{margin:0;color:#c7cdd0;font-size:15px;line-height:1.72;white-space:normal;word-break:break-word}
.candidate-analysis-grid-v2666{display:grid;grid-template-columns:1fr;gap:10px}
.candidate-analysis-grid-v2666 section{padding:14px 15px;border:1px solid #34434d;border-radius:12px;background:#151e24}
.candidate-analysis-grid-v2666 section.advice{border-color:#5b4a2f;background:linear-gradient(145deg,#1d1d19,#171d20)}
.candidate-analysis-grid-v2666 section>b{display:block;margin-bottom:7px;color:#e0c27d;font-size:16px;letter-spacing:.2px}
.candidate-analysis-grid-v2666 section p{margin:0;color:#e1e4e3;font-size:16px;line-height:1.75;white-space:normal;word-break:break-word}
.candidate-why-v2666{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.candidate-why-v2666>div{padding:12px 13px;border:1px solid #34434d;border-radius:12px;background:#151d23}
.candidate-why-v2666 b{display:block;margin-bottom:7px;color:#bfc8cd;font-size:13.5px}
.candidate-why-v2666 span{display:block;margin:4px 0;color:#9ea8ad;font-size:13px;line-height:1.55;white-space:normal}
.candidate-wait-v2666,.candidate-hard-v2666{margin-top:10px;padding:11px 13px;border-radius:11px}
.candidate-wait-v2666{border:1px solid #5d5038;background:#1e1d18}.candidate-hard-v2666{border:1px solid #65443f;background:#211918}
.candidate-wait-v2666 b,.candidate-hard-v2666 b{display:block;margin-bottom:5px;color:#d7b86e;font-size:13.5px}
.candidate-wait-v2666 p,.candidate-hard-v2666 p{margin:0;color:#bfc5c7;font-size:13.5px;line-height:1.6;white-space:normal}
.candidate-hard-v2666 p{color:#e4a49b!important}
@media(max-width:640px){
  .candidate-topline-v2666{grid-template-columns:repeat(2,minmax(0,1fr))}
  .candidate-why-v2666{grid-template-columns:1fr}
  .candidate-narrative-v2666 .mw-main a{font-size:21px!important}
  .candidate-narrative-v2666 .mw-main small{font-size:13px!important}
  .candidate-analysis-grid-v2666 section p{font-size:15.5px!important;line-height:1.72!important}
  .candidate-shadow-read-v2666 p{font-size:14.5px!important}
}
`;

export function patchCandidateNarrativeV2666(){
  const jsPath=path.join(__dirname,'public','manual-candidate-v2664.js');
  const cssPath=path.join(__dirname,'public','manual-candidate-v2664.css');
  const htmlPath=path.join(__dirname,'public','index.html');
  if(!fs.existsSync(jsPath))throw new Error('[candidate-v2666] candidate runtime missing; CandidateRecall V2665 must run first');

  let js=fs.readFileSync(jsPath,'utf8');
  if(!js.includes(MARKER)){
    if(!js.includes('candidateBand'))throw new Error('[candidate-v2666] V2665 candidate data not detected');
    const insertAt=js.indexOf('function card(');
    if(insertAt<0)throw new Error('[candidate-v2666] card renderer missing');
    js=js.slice(0,insertAt)+HELPERS.trim()+'\n'+js.slice(insertAt);
    js=replaceFunction(js,'card',CARD);
    js=js.replace("const VERSION='2.6.65';","const VERSION='2.6.66';");
    js='/* '+MARKER+' */\n'+js;
    writeChecked(jsPath,js,'candidate runtime');
  }

  let css=fs.existsSync(cssPath)?fs.readFileSync(cssPath,'utf8'):'';
  if(!css.includes(MARKER)){css+='\n'+CSS+'\n';fs.writeFileSync(cssPath,css,'utf8')}

  if(fs.existsSync(htmlPath)){
    let h=fs.readFileSync(htmlPath,'utf8');
    h=h.replace(/\/manual-candidate-v2664\.js\?v=[^"'<>]+/g,'/manual-candidate-v2664.js?v=2666-0904');
    h=h.replace(/\/manual-candidate-v2664\.css\?v=[^"'<>]+/g,'/manual-candidate-v2664.css?v=2666-0904');
    fs.writeFileSync(htmlPath,h,'utf8');
  }
  return {changed:true,version:'V2.6.66',entrySuggestionRemoved:true,chineseNarrative:true,largerText:true};
}
if(import.meta.url===`file://${process.argv[1]}`)console.log(patchCandidateNarrativeV2666());
