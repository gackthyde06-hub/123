(()=>{
'use strict';
const VERSION='2.6.78';
const MODAL_ID='actualTradeEditModalV2678';
let currentId=null,busy=false,timer=null;
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sideText=d=>String(d||'').toUpperCase()==='SHORT'?'做空':'做多';
const sideClass=d=>String(d||'').toUpperCase()==='SHORT'?'short':'long';
function ensureModal(){
  let el=document.getElementById(MODAL_ID);if(el)return el;
  el=document.createElement('div');el.id=MODAL_ID;el.className='actualTradeEditModalV2678';el.setAttribute('aria-hidden','true');
  el.innerHTML=`<div class="actualTradeEditShellV2678" role="dialog" aria-modal="true" aria-labelledby="actualTradeEditTitleV2678">
    <div class="actualTradeEditHeadV2678"><div><span>ACTUAL POSITION EDIT</span><b id="actualTradeEditTitleV2678" data-v2678-title>修改建倉</b><small>只修改目前這筆建倉資料；後台保留修改紀錄。</small></div><button type="button" data-v2678-dismiss aria-label="關閉">×</button></div>
    <div class="actualTradeEditMetaV2678"><span data-v2678-side></span><span>ACTIVE</span></div>
    <div class="actualTradeEditGridV2678">
      <label><span>成本</span><input data-v2678-f="entryPrice" inputmode="decimal"></label>
      <label><span>TP1</span><input data-v2678-f="tp1" inputmode="decimal"></label>
      <label><span>TP2</span><input data-v2678-f="tp2" inputmode="decimal"></label>
      <label><span>SP1</span><input data-v2678-f="sp1" inputmode="decimal"></label>
      <label><span>SP2</span><input data-v2678-f="sp2" inputmode="decimal"></label>
      <label><span>保證金 U</span><input data-v2678-f="margin" inputmode="decimal"></label>
      <label><span>槓桿</span><input data-v2678-f="leverage" inputmode="numeric"></label>
      <label><span>數量（可空）</span><input data-v2678-f="quantity" inputmode="decimal"></label>
    </div>
    <div class="actualTradeEditHintV2678">至少保留一個 TP / SP。若沒有數量，需保留保證金＋槓桿。</div>
    <div class="actualTradeEditMsgV2678" data-v2678-msg></div>
    <div class="actualTradeEditActionsV2678"><button type="button" data-v2678-dismiss>取消</button><button type="button" class="save" data-v2678-save>儲存修改</button></div>
  </div>`;
  document.body.appendChild(el);return el;
}
function setField(name,v){const i=document.querySelector(`#${MODAL_ID} [data-v2678-f="${name}"]`);if(i)i.value=v==null?'':String(v)}
function fieldNum(name){const v=document.querySelector(`#${MODAL_ID} [data-v2678-f="${name}"]`)?.value?.trim();if(!v)return null;const n=Number(v);return Number.isFinite(n)?n:null}
function setMsg(text,tone=''){const m=document.querySelector(`#${MODAL_ID} [data-v2678-msg]`);if(m){m.textContent=text||'';m.dataset.tone=tone}}
function closeModal(){const el=document.getElementById(MODAL_ID);if(!el)return;el.classList.remove('show');el.setAttribute('aria-hidden','true');document.body.classList.remove('v2678TradeEditOpen');currentId=null;setMsg('')}
function validate(rec,p){
  if(!(p.entryPrice>0))return '成本必須大於 0';
  if(!(p.tp1>0||p.tp2>0||p.sp1>0||p.sp2>0))return '至少填一個 TP / SP';
  if(!(p.quantity>0)&&!(p.margin>0&&p.leverage>0))return '請填數量，或保證金＋槓桿';
  const dir=String(rec?.direction||'LONG').toUpperCase()==='SHORT'?-1:1;
  if([p.tp1,p.tp2].filter(x=>x!=null).some(x=>dir*(x-p.entryPrice)<=0))return 'TP 必須在獲利方向';
  if([p.sp1,p.sp2].filter(x=>x!=null).some(x=>dir*(x-p.entryPrice)>=0))return 'SP 必須在風險方向';
  return '';
}
async function getRecord(id){
  const r=await fetch('/api/actual-trades',{cache:'no-store'}),d=await r.json().catch(()=>null);
  if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);
  const rec=(Array.isArray(d.records)?d.records:[]).find(x=>String(x?.id||'')===String(id));
  if(!rec)throw new Error('找不到這筆建倉，請重新整理後再試');
  if(rec.status!=='ACTIVE'||rec.resultAt)throw new Error('這筆已結案，不能修改');
  return rec;
}
async function openEdit(id){
  if(busy)return;busy=true;const modal=ensureModal();currentId=String(id||'');
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.classList.add('v2678TradeEditOpen');setMsg('讀取目前建倉資料…');
  try{
    const rec=await getRecord(currentId);modal.dataset.direction=rec.direction||'LONG';
    modal.querySelector('[data-v2678-title]').textContent=`${rec.symbol||'—'}｜修改建倉`;
    const side=modal.querySelector('[data-v2678-side]');side.textContent=sideText(rec.direction);side.className=sideClass(rec.direction);
    for(const k of ['entryPrice','tp1','tp2','sp1','sp2','margin','leverage','quantity'])setField(k,rec[k]);
    modal.dataset.record=JSON.stringify({id:rec.id,direction:rec.direction});
    setMsg(rec.firstOutcome?'此筆已碰過 TP / SP；後端會依績效稽核規則決定是否允許修改。':'已帶入目前數字，修改後按「儲存修改」。');
  }catch(e){setMsg(`❌ ${e?.message||e}`,'error')}finally{busy=false}
}
async function saveEdit(){
  if(busy||!currentId)return;const modal=ensureModal(),save=modal.querySelector('[data-v2678-save]');
  let meta={};try{meta=JSON.parse(modal.dataset.record||'{}')}catch{}
  const p={entryPrice:fieldNum('entryPrice'),tp1:fieldNum('tp1'),tp2:fieldNum('tp2'),sp1:fieldNum('sp1'),sp2:fieldNum('sp2'),margin:fieldNum('margin'),quantity:fieldNum('quantity'),leverage:fieldNum('leverage')};
  const err=validate(meta,p);if(err){setMsg(`❌ ${err}`,'error');return}
  busy=true;if(save)save.disabled=true;setMsg('儲存修改中…');
  try{
    const r=await fetch(`/api/actual-trades/${encodeURIComponent(currentId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action:'update',...p})}),d=await r.json().catch(()=>null);
    if(!r.ok||!d?.ok)throw new Error(d?.error||`HTTP ${r.status}`);
    setMsg('✅ 已更新建倉數字。','ok');
    try{window.dispatchEvent(new CustomEvent('actual-trade:saved',{detail:{id:currentId,source:'v2678-edit'}}))}catch{}
    setTimeout(closeModal,350);
  }catch(e){setMsg(`❌ ${e?.message||e}`,'error')}finally{busy=false;if(save)save.disabled=false}
}
function syncButtons(){
  document.querySelectorAll('.actualTradeItemV2613[data-actual-id]').forEach(card=>{
    const id=card.dataset.actualId,foot=card.querySelector('.actualTradeItemFootV2613'),close=foot?.querySelector('[data-v2613-close]');if(!id||!foot||!close)return;
    let actions=foot.querySelector('.actualTradeActionsV2678');
    if(!actions){actions=document.createElement('div');actions.className='actualTradeActionsV2678';close.before(actions);actions.appendChild(close)}
    let edit=actions.querySelector('[data-v2678-edit]');
    if(!edit){edit=document.createElement('button');edit.type='button';edit.className='actualEditChipV2678';edit.dataset.v2678Edit=id;edit.textContent='修改';actions.insertBefore(edit,close)}else edit.dataset.v2678Edit=id;
  });
}
function bind(){
  if(document.documentElement.dataset.actualTradeEditV2678==='1')return;document.documentElement.dataset.actualTradeEditV2678='1';
  document.addEventListener('click',e=>{
    const edit=e.target.closest?.('[data-v2678-edit]');if(edit){e.preventDefault();e.stopPropagation();void openEdit(edit.dataset.v2678Edit);return}
    if(e.target.closest?.('[data-v2678-dismiss]')){e.preventDefault();closeModal();return}
    if(e.target.closest?.('[data-v2678-save]')){e.preventDefault();void saveEdit();return}
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById(MODAL_ID)?.classList.contains('show'))closeModal()});
  window.addEventListener('actual-trade:saved',()=>setTimeout(syncButtons,120));
}
function boot(){ensureModal();bind();syncButtons();timer=setInterval(syncButtons,1000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
