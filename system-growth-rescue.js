(()=>{
  'use strict';
  if(window.__SG_FETCH_RESCUE_V254__)return;
  window.__SG_FETCH_RESCUE_V254__=true;
  const nativeFetch=window.fetch.bind(window);
  const prefix='sg-http-v254:';
  const cacheGet=k=>{try{return localStorage.getItem(prefix+k)}catch{return null}};
  const cacheSet=(k,v)=>{try{localStorage.setItem(prefix+k,v)}catch{}};
  const urlOf=input=>{try{return new URL(typeof input==='string'?input:input?.url||'',location.href)}catch{return null}};
  window.fetch=async function(input,init={}){
    const u=urlOf(input),path=u?.pathname||'';
    const target=path==='/api/performance'||path==='/api/test-signals';
    if(!target)return nativeFetch(input,init);
    const key=path==='/api/performance'?'performance':'signals',timeout=key==='signals'?4500:7000;
    const ctrl=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=ctrl?setTimeout(()=>ctrl.abort(),timeout):null;
    try{
      const res=await nativeFetch(input,{...init,...(ctrl?{signal:ctrl.signal}:{})});
      if(res.ok){
        try{const text=await res.clone().text();if(text&&text[0]==='{')cacheSet(key,text)}catch{}
      }
      return res;
    }catch(err){
      const cached=cacheGet(key);
      if(cached)return new Response(cached,{status:200,headers:{'Content-Type':'application/json','X-SG-Fallback':'cache'}});
      if(key==='signals')return new Response(JSON.stringify({ok:true,rows:[],fallback:true,responseMode:'FRONTEND_RESCUE_V254'}),{status:200,headers:{'Content-Type':'application/json','X-SG-Fallback':'empty-signals'}});
      throw err;
    }finally{if(timer)clearTimeout(timer)}
  };
})();
