(()=>{
'use strict';
const VERSION='2.6.33';
let panel=null,obs=null,lastHtml='',lastClass='sg-v2625',restoring=false;
function snapshot(root){if(!root)return;lastHtml=root.innerHTML;lastClass=root.className||'sg-v2625';document.documentElement.classList.add('v2633GrowthReady')}
function restore(){if(restoring||!panel)return;let root=panel.querySelector('#sgStatusV2625');if(root){snapshot(root);return}if(!lastHtml)return;restoring=true;root=document.createElement('section');root.id='sgStatusV2625';root.className=lastClass;root.dataset.finalUi='2633-guard';root.innerHTML=lastHtml;panel.prepend(root);restoring=false}
function attach(){const p=document.getElementById('sgPanel');if(!p){setTimeout(attach,120);return}if(panel===p&&obs)return;panel=p;const root=panel.querySelector('#sgStatusV2625');if(root)snapshot(root);obs?.disconnect();obs=new MutationObserver(()=>queueMicrotask(restore));obs.observe(panel,{childList:true});setInterval(()=>{const r=panel?.querySelector('#sgStatusV2625');if(r)snapshot(r);else restore()},2000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
window.GrowthGuardV2633={version:VERSION};
})();
