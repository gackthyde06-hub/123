(()=>{
'use strict';
const VERSION='2.6.14',HUB_KEY='v2614-show-actual-hub',STALE_KEY='v2614-show-stale',MODE_KEY='v2614-notify-mode';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const get=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v}catch{return d}};
const set=(k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
function style(){if(q('#v2614-style'))return;const s=document.createElement('style');s.id='v2614-style';s.textContent=`
.v2614Ctl{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0 12px;padding:8px 10px;border:1px solid #2b3032;border-radius:12px;background:#0c0f10}.v2614Ctl b{font-size:10px;color:#d8bf80;margin-right:auto}.v2614Pill{display:inline-flex;align-items:center;gap:5px;font-size:9px;color:#9a9389}.v2614Pill input{accent-color:#d7ad55}.v2614Mode{height:30px;border:1px solid #3a3f40;border-radius:8px;background:#101314;color:#d9d1c6;font-size:9px;padding:0 7px}.v2614Hidden{display:none!important}.v2614Close{position:absolute;right:12px;top:12px;width:28px;height:28px;border-radius:9px;border:1px solid #3b4142;background:#111516;color:#aaa;font-size:17px;z-index:3}.actualTradeHubV2613{position:relative}
`;document.head.appendChild(s)}
function endpoint(){return navigator.serviceWorker?.getRegistration?.().then(r=>r?.pushManager?.getSubscription?.()).then(s=>s?.endpoint||null).catch(()=>null)}
async function saveNotify(mode,enabled=true){const ep=await endpoint();if(!ep)return;await fetch('/api/v2614-notify-preferences',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({endpoint:ep,mode,enabled}),cache:'no-store'}).catch(()=>{});set(MODE_KEY,mode)}
function hubVisible(){return get(HUB_KEY,'0')==='1'}
function staleVisible(){return get(STALE_KEY,'0')==='1'}
function applyHub(){const hub=q('#actualTradeHubV2613');if(!hub)return;hub.classList.toggle('v2614Hidden',!hubVisible());if(!q('.v2614Close',hub)){const b=document.createElement('button');b.className='v2614Close';b.type='button';b.textContent='×';b.title='關閉已建倉區';b.onclick=()=>{set(HUB_KEY,'0');applyHub();syncCtl()};hub.appendChild(b)}}
function hmAge(text){const m=String(text||'').match(/更新\s*(\d{1,2}):(\d{2})/);if(!m)return null;const now=new Date(),cur=now.getHours()*60+now.getMinutes(),then=Number(m[1])*60+Number(m[2]);let d=cur-then;if(d<0)d+=1440;return d}
function applyStale(){qa('#testGrid .testCard,#testGrid article').forEach(card=>{const mins=hmAge(card.textContent);const stale=mins!=null&&mins>4;card.classList.toggle('v2614Hidden',stale&&!staleVisible())});qa('#manualOpsPanel .manual-card').forEach(card=>{if(/\bC\b/.test(q('.manual-grade',card)?.textContent||''))card.classList.add('v2614Hidden')})}
function ensureCtl(){style();const page=q('#page-test');if(!page)return;let c=q('#v2614Ctl');if(!c){c=document.createElement('div');c.id='v2614Ctl';c.className='v2614Ctl';c.innerHTML=`<b>顯示 / 通知</b><label class="v2614Pill"><input type="checkbox" data-v2614-hub>已建倉</label><label class="v2614Pill"><input type="checkbox" data-v2614-stale>過期觀察</label><select class="v2614Mode" data-v2614-mode><option value="MANUAL">手動</option><option value="AUTO">自動</option><option value="BOTH">全開</option></select>`;const a=q('#actualTradeHubV2613',page)||q('.sectionBar',page)||page.firstElementChild;if(a)a.insertAdjacentElement('beforebegin',c);else page.prepend(c);q('[data-v2614-hub]',c).onchange=e=>{set(HUB_KEY,e.target.checked?'1':'0');applyHub()};q('[data-v2614-stale]',c).onchange=e=>{set(STALE_KEY,e.target.checked?'1':'0');applyStale()};q('[data-v2614-mode]',c).onchange=e=>saveNotify(e.target.value,true)}syncCtl()}
function syncCtl(){const c=q('#v2614Ctl');if(!c)return;q('[data-v2614-hub]',c).checked=hubVisible();q('[data-v2614-stale]',c).checked=staleVisible();q('[data-v2614-mode]',c).value=get(MODE_KEY,'BOTH')}
function tick(){ensureCtl();applyHub();applyStale();qa('#manualOpsPanel [data-filter="C"],#manualOpsPanel [data-filter="ALL"]').forEach(x=>x.classList.add('v2614Hidden'))}
document.addEventListener('DOMContentLoaded',()=>{tick();setInterval(tick,4000);saveNotify(get(MODE_KEY,'BOTH'),true)});
})();
