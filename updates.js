/* Beta 0.6.15 — aggiornamento PWA con un solo tocco; non modifica IndexedDB. */
(function(root){
'use strict';
function setup({beforeUpdate,notify}){
  const nav=root.navigator,doc=root.document;
  if(!('serviceWorker' in nav)||root.location.protocol!=='https:')return;
  const sw=nav.serviceWorker,button=doc.getElementById('apply-update'),banner=doc.getElementById('update-banner');
  if(!button||!banner)return;
  let registration=null,lastCheck=0,previousController=sw.controller,applying=false,reloading=false;
  const show=()=>{banner.hidden=false;};
  const fail=message=>{applying=false;button.disabled=false;button.textContent='Aggiorna';notify?.(message);};
  function reloadOnce(){
    if(reloading)return;
    reloading=true;
    const page=new URL(root.location.href);
    page.searchParams.set('_sc_reload',String(Date.now()));
    root.location.replace(page.href);
  }
  function watch(reg){
    if(reg.waiting&&sw.controller)show();
    reg.addEventListener('updatefound',()=>{
      const worker=reg.installing;
      if(worker)worker.addEventListener('statechange',()=>{
        if(worker.state==='installed'&&sw.controller)show();
      });
    });
  }
  sw.addEventListener('controllerchange',()=>{
    const now=sw.controller;
    if(applying){reloadOnce();return;}
    if(previousController&&now&&previousController!==now)show();
    previousController=now;
  });
  button.addEventListener('click',async()=>{
    if(applying)return;
    if(!nav.onLine){notify?.('Per aggiornare serve una connessione Internet.');return;}
    applying=true;
    try{
      if(!(await beforeUpdate())){applying=false;return;}
      button.disabled=true;button.textContent='Aggiornamento…';
      const reg=registration||await sw.getRegistration();
      if(!reg){reloadOnce();return;}
      if(!reg.waiting){try{await reg.update();}catch(_){}}
      if(reg.waiting){
        reg.waiting.postMessage({type:'SKIP_WAITING'});
        root.setTimeout(()=>{if(!reloading)reloadOnce();},4000);
      }else{
        // Un worker già attivo può aver preso il controllo prima del tocco.
        reloadOnce();
      }
    }catch(_){fail('Aggiornamento non riuscito: riprova con Internet attivo.');}
  });
  sw.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
    registration=reg;watch(reg);
    const check=()=>{
      if(!nav.onLine||doc.visibilityState==='hidden'||Date.now()-lastCheck<45000)return;
      lastCheck=Date.now();reg.update().catch(()=>{});
    };
    check();
    doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')check();});
    root.addEventListener('online',check);
    root.addEventListener('pageshow',check);
  }).catch(()=>{});
}
root.SCUpdates={setup};
})(window);
