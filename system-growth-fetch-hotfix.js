(()=>{
  'use strict';
  if(window.__SG_TEST_SIGNAL_TIMEOUT__)return;
  const nativeFetch=window.fetch.bind(window);
  const isTarget=input=>{
    const raw=typeof input==='string'?input:(input&&input.url)||'';
    try{const u=new URL(raw,window.location.href);return u.origin===window.location.origin&&u.pathname==='/api/test-signals'}catch{return String(raw).includes('/api/test-signals')}
  };
  window.fetch=function(input,init={}){
    if(!isTarget(input))return nativeFetch(input,init);
    const controller=new AbortController();
    const upstream=init&&init.signal;
    if(upstream?.aborted)controller.abort();
    else upstream?.addEventListener?.('abort',()=>controller.abort(),{once:true});
    const timer=setTimeout(()=>controller.abort(),4000);
    return nativeFetch(input,{...init,signal:controller.signal}).finally(()=>clearTimeout(timer));
  };
  window.__SG_TEST_SIGNAL_TIMEOUT__=true;
})();
