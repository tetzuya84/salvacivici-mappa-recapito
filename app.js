(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const SC=window.SC;
  const state={records:[],gps:null,editingId:null,db:null,toastTimeout:0};
  const DBNAME='salvacivici-mappa-recapito-v1';
  const STORE='civici';
  let comuneManual=false;

  function toast(message){
    const box=$('toast');box.textContent=message;box.hidden=false;
    clearTimeout(state.toastTimeout);
    state.toastTimeout=setTimeout(()=>box.hidden=true,3700);
  }
  function dbOpen(){return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(new Error('Archivio locale non disponibile in questo browser.'));
    const request=indexedDB.open(DBNAME,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'});};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Impossibile aprire archivio.'));
  });}
  function readAll(){return new Promise((resolve,reject)=>{
    const request=state.db.transaction(STORE,'readonly').objectStore(STORE).getAll();
    request.onsuccess=()=>resolve(request.result||[]);
    request.onerror=()=>reject(request.error||new Error('Errore lettura dati.'));
  });}
  function writeOne(record){return new Promise((resolve,reject)=>{
    const transaction=state.db.transaction(STORE,'readwrite');
    transaction.objectStore(STORE).put(record);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error||new Error('Scrittura non riuscita.'));
    transaction.onabort=()=>reject(transaction.error||new Error('Scrittura annullata.'));
  });}
  function applySnapshot(records){return new Promise((resolve,reject)=>{
    const tx=state.db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);
    store.clear();
    records.forEach(r=>store.put(r));
    tx.oncomplete=()=>{refresh().then(resolve,reject);};
    tx.onerror=()=>reject(tx.error||new Error('Ripristino archivio non riuscito.'));
    tx.onabort=()=>reject(tx.error||new Error('Ripristino archivio annullato.'));
  });}
  function writeMany(records){return new Promise((resolve,reject)=>{
    const transaction=state.db.transaction(STORE,'readwrite');
    const store=transaction.objectStore(STORE);
    records.forEach(r=>store.put(r));
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error||new Error('Ripristino non riuscito.'));
    transaction.onabort=()=>reject(transaction.error||new Error('Ripristino annullato.'));
  });}
  function removeOne(id){return new Promise((resolve,reject)=>{
    const transaction=state.db.transaction(STORE,'readwrite');
    transaction.objectStore(STORE).delete(id);
    transaction.oncomplete=()=>resolve();
    transaction.onerror=()=>reject(transaction.error||new Error('Eliminazione non riuscita.'));
  });}
  async function refresh(){state.records=(await readAll()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));renderRecords();updateNearWarning();window.dispatchEvent(new Event('salvacivici:datachanged'));}

  function showPage(tab){
    document.querySelector('.app-shell').classList.toggle('is-capture',tab==='capture');
    ['capture','records','data'].forEach(name=>{
      $('page-'+name).hidden=name!==tab;
      const button=document.querySelector(`[data-tab="${name}"]`);
      button.classList.toggle('active',name===tab);
      if(name===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    if(tab==='records')renderRecords();
    if(tab==='capture'&&state.db&&!gpsBusy&&!SC.isFreshGps(state.gps,Date.now(),GPS_REENTER_REFRESH_MS))startGpsAcquisition();
    window.scrollTo({top:0,behavior:'auto'});
  }
  document.querySelectorAll('.tab').forEach(el=>el.addEventListener('click',()=>showPage(el.dataset.tab)));

  // Beta 0.6.9 — swipe orizzontale fra Salva, Archivio e Dati.
  // I gesti verticali mantengono GPS refresh / cloud sync; non intercettiamo i controlli.
  function setupHorizontalTabSwipe(){
    const pages=['capture','records','data'];
    const main=document.querySelector('main');
    const MIN_X=78,MAX_Y=85,MAX_DURATION=1000,EDGE=25;
    let start=null,locked=false;
    const currentTab=()=>pages.findIndex(name=>!$('page-'+name).hidden);
    const ignoredTarget=target=>target.closest('input,textarea,select,button,a,label,summary,dialog,[contenteditable],[role="button"],[data-no-swipe]');
    const reset=()=>{start=null;locked=false;};
    main.addEventListener('touchstart',event=>{
      reset();
      if(event.touches.length!==1||document.querySelector('dialog[open]')||ignoredTarget(event.target))return;
      const point=event.touches[0];
      const width=window.innerWidth||document.documentElement.clientWidth;
      // Preserva il gesto nativo Indietro di Safari ai bordi dello schermo.
      if(point.clientX<EDGE||point.clientX>width-EDGE)return;
      start={x:point.clientX,y:point.clientY,time:Date.now(),page:currentTab()};
    },{passive:true});
    main.addEventListener('touchmove',event=>{
      if(!start||event.touches.length!==1)return;
      const point=event.touches[0],dx=point.clientX-start.x,dy=point.clientY-start.y;
      if(!locked){
        if(Math.abs(dy)>18&&Math.abs(dy)>=Math.abs(dx)*0.85){reset();return;}
        if(Math.abs(dx)<18)return;
        if(Math.abs(dx)<Math.abs(dy)*1.35){reset();return;}
        locked=true;
      }
      if(event.cancelable)event.preventDefault();
    },{passive:false});
    main.addEventListener('touchend',event=>{
      if(!start)return;
      const point=event.changedTouches[0];
      const dx=point.clientX-start.x,dy=point.clientY-start.y;
      const next=start.page+(dx<0?1:-1);
      const valid=locked&&Date.now()-start.time<MAX_DURATION&&
        Math.abs(dx)>=MIN_X&&Math.abs(dy)<=MAX_Y&&
        Math.abs(dx)>=Math.abs(dy)*1.35&&next>=0&&next<pages.length;
      reset();
      if(valid&&!document.querySelector('dialog[open]'))showPage(pages[next]);
    },{passive:true});
    main.addEventListener('touchcancel',reset,{passive:true});
  }
  setupHorizontalTabSwipe();
  // All'avvio e al ritorno dalla Home la prima schermata è sempre Salva.
  // Non cancelliamo bozze durante la semplice navigazione fra applicazioni.
  let hiddenAt=0;
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){hiddenAt=Date.now();return;}
    if(hiddenAt&&Date.now()-hiddenAt>=1200&&!document.querySelector('dialog[open]')){
      showPage('capture');
    }
    hiddenAt=0;
  });
  window.addEventListener('pageshow',event=>{
    if(event.persisted&&!document.querySelector('dialog[open]'))showPage('capture');
  });

  // Beta 0.6.4 — pull-to-sync: lo swipe deliberato sostituisce i due pulsanti Dati.
  // Il trasferimento non parte se l'Archivio non è in cima o se si sta editando.
  function setupArchivePullToSync(){
    const page=$('page-records'),indicator=$('archive-pull'),label=$('archive-pull-label'),
      status=$('archive-pull-status'),keyboard=$('archive-sync-keyboard');
    const LIMIT=86,MAX=108;
    let start=null,travel=0,active=false,loading=false,resetTimer=0;
    const atTop=()=>Math.max(window.scrollY||0,document.documentElement.scrollTop||0,document.body.scrollTop||0)<=5;
    const reset=()=>{
      active=false;travel=0;start=null;
      indicator.style.height='0px';indicator.dataset.state='idle';
      label.textContent='Trascina per sincronizzare';
    };
    const setProgress=n=>{
      const amount=Math.min(MAX,Math.max(0,n));
      indicator.style.height=Math.round(amount*0.72)+'px';
      indicator.dataset.state=n>=LIMIT?'ready':'pulling';
      label.textContent=n>=LIMIT?'Rilascia per sincronizzare':'Trascina per sincronizzare';
    };
    async function performSync(){
      if(loading)return;
      // Un solo impulso brevissimo quando il gesto avvia davvero la sync.
      // iOS Safari/PWA non supporta navigator.vibrate: feedback visivo invariato.
      try{if(typeof navigator.vibrate==='function')navigator.vibrate(20);}catch(_){}
      loading=true;
      clearTimeout(resetTimer);
      indicator.dataset.state='loading';indicator.style.height='67px';
      label.textContent='Sincronizzazione in corso…';
      status.hidden=false;status.dataset.result='pending';status.textContent='Sincronizzazione in corso…';
      try{
        const result=await window.SCCloud?.syncFromArchive?.();
        if(!result){
          status.dataset.result='error';
          status.textContent='Cloud non disponibile. Riapri SalvaCivici e riprova.';
          label.textContent='Non disponibile';
        }else if(result.ok){
          status.dataset.result='success';
          status.textContent='Sincronizzazione completata · '+result.count+' civici.';
          label.textContent='Sincronizzato';
        }else{
          status.dataset.result='error';
          status.textContent=result.description||'Sincronizzazione non completata.';
          label.textContent='Controlla l’archivio';
        }
      }catch(error){
        status.dataset.result='error';
        status.textContent='Sincronizzazione non riuscita. Nessun civico eliminato.';
        label.textContent='Riprova';
      }finally{
        loading=false;
        resetTimer=setTimeout(reset,950);
      }
    }
    page.addEventListener('touchstart',event=>{
      start=null;
      if(page.hidden||loading||event.touches.length!==1||!atTop())return;
      if(document.querySelector('dialog[open]'))return;
      if(event.target.closest('input,textarea,button,select,[contenteditable="true"]'))return;
      start={x:event.touches[0].clientX,y:event.touches[0].clientY};
      travel=0;active=false;
    },{passive:true});
    page.addEventListener('touchmove',event=>{
      if(!start||loading||event.touches.length!==1)return;
      const dx=event.touches[0].clientX-start.x,
        dy=event.touches[0].clientY-start.y;
      if(!active&&(dy<9||Math.abs(dx)>dy*0.75||!atTop())){
        if(dy<0||Math.abs(dx)>Math.max(12,Math.abs(dy)))start=null;
        return;
      }
      if(!atTop()){reset();return;}
      active=true;travel=Math.max(0,dy);
      if(event.cancelable)event.preventDefault();
      setProgress(travel);
    },{passive:false});
    page.addEventListener('touchend',()=>{
      const shouldSync=active&&travel>=LIMIT;
      reset();
      if(shouldSync)void performSync();
    },{passive:true});
    page.addEventListener('touchcancel',reset,{passive:true});
    keyboard.addEventListener('click',()=>void performSync());
  }
  setupArchivePullToSync();


  function showComune(name){
    $('comune').value=name||'';
    $('comune-display').textContent=name||'Non individuato · correggi';
  }
  function autoComune(gps){
    if(comuneManual||!gps)return;
    const name=SC.getComune(gps.lat,gps.lon,window.SC_COMUNI||[]);
    showComune(name);
  }
  $('comune-edit').addEventListener('click',()=>{
    $('comune').hidden=false;
    $('comune-edit-label').hidden=false;
    $('comune').focus();
  });
  $('comune').addEventListener('input',()=>{
    comuneManual=true;
    $('comune-display').textContent=SC.clean($('comune').value)||'Comune da inserire';
  });
  $('indirizzo').addEventListener('input',()=>{$('indirizzo-warning').hidden=true;});

  function confirmAction(title,message,confirmLabel='Conferma'){
    return new Promise(resolve=>{
      const modal=$('confirm-dialog');
      $('dialog-title').textContent=title;$('dialog-message').textContent=message;$('dialog-confirm').textContent=confirmLabel;
      $('dialog-confirm').classList.toggle('danger-confirm',confirmLabel==='ELIMINA TUTTI');
      const finish = answer=>{modal.removeEventListener('cancel',onCancel);$('dialog-cancel').removeEventListener('click',onNo);$('dialog-confirm').removeEventListener('click',onYes);$('dialog-confirm').classList.remove('danger-confirm');if(modal.open)modal.close();resolve(answer);};
      const onNo=()=>finish(false),onYes=()=>finish(true),onCancel=event=>{event.preventDefault();finish(false);};
      modal.addEventListener('cancel',onCancel);$('dialog-cancel').addEventListener('click',onNo);$('dialog-confirm').addEventListener('click',onYes);
      modal.showModal();
    });
  }
  function geolocationError(error){
    if(location.protocol==='file:')return 'Per usare il GPS, apri l’app da un sito HTTPS, non direttamente dal file.';
    if(!window.isSecureContext)return 'Il GPS richiede una connessione sicura (HTTPS).';
    if(!error)return 'Errore GPS sconosciuto.';
    if(error.code===1)return 'Permesso GPS negato. Abilita la posizione nelle impostazioni di Safari.';
    if(error.code===2)return 'Posizione non disponibile. Riprova all’aperto.';
    if(error.code===3)return 'Tempo scaduto. Riprova quando il segnale migliora.';
    return 'Impossibile ottenere la posizione GPS.';
  }
  // L'apertura dell'app avvia più fix GPS freschi: nessun dato precedente viene sovrascritto
  // se la nuova acquisizione fallisce. Le stime del dispositivo non sono garanzie di errore.
  const GPS_TARGET_SAMPLES=3;
  const GPS_REFINEMENT_MS=14500;
  const GPS_FIRST_FIX_TIMEOUT_MS=16000;
  const GPS_MAX_SAVE_AGE_MS=30000;
  const GPS_REENTER_REFRESH_MS=15000;
  let gpsWatch=null, gpsFirstTimer=null, gpsRefineTimer=null, gpsPollTimers=[], gpsRequestId=0;
  let gpsBusy=false, gpsValidated=false, gpsSamples=[], gpsStartedAt=0;
  let gpsResolve=null,gpsPromise=null,gpsError=null;
  const MAP_REVIEW_MAX_AGE_MS=180000;
  const mapReview=window.SCMapReview.create({
    getCaptureGps:()=>state.gps||SC.bestGpsSample(gpsSamples),
    getCaptureReady:()=>gpsValidated&&state.gps?.sampleCount===GPS_TARGET_SAMPLES&&!gpsBusy,
    onCaptureConfirm:selection=>{
      updateGpsUI();
      toast(selection.moved?'Ingresso corretto sulla mappa. Pronto per il salvataggio.':'Posizione GPS confermata sulla mappa.');
    },
    onArchiveConfirm:async(record,selection)=>{
      if(!state.db){toast('Archivio non disponibile.');return false;}
      const current=state.records.find(r=>r.id===record.id);
      if(!current||!window.SCCloudMerge.same(current,record)){
        toast('Il civico è cambiato nell’archivio. Riapri la correzione.');return false;
      }
      const updated=SC.applyVerifiedPosition(current,selection);
      await writeOne(updated);
      await refresh();
      toast('Pin corretto. Per inviare la modifica nel cloud, sincronizza dall’Archivio.');
      return true;
    },
    toast
  });
  $('map-open').addEventListener('click',()=>mapReview.openCapture());

  function stopGpsWatch(){
    if(gpsWatch!==null){navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null;}
    clearTimeout(gpsFirstTimer);clearTimeout(gpsRefineTimer);
    gpsPollTimers.forEach(clearTimeout);gpsPollTimers=[];
    gpsFirstTimer=null;gpsRefineTimer=null;
    gpsBusy=false;
  }
  function updateGpsUI(){
    const gps=state.gps;
    const bestDuringAcquisition=gpsBusy||gpsError?SC.bestGpsSample(gpsSamples):null;
    const source=gps||bestDuringAcquisition;
    const quality=SC.gpsQuality(source?.accuracy);
    const complete=!!gps&&gpsValidated&&gps.sampleCount>=GPS_TARGET_SAMPLES;
    const fresh=complete&&SC.isFreshGps(gps,Date.now(),GPS_MAX_SAVE_AGE_MS);
    const count=gpsBusy||gpsError?gpsSamples.length:complete?gps.sampleCount:0;
    $('save-button').disabled=gpsBusy||!complete||!state.db;
    $('gps-coordinates').hidden=!gps;
    $('gps-chip').textContent=gpsBusy?`GPS ${count}/3`:fresh?'GPS pronto':gpsError?'GPS da ripetere':gps?'Da aggiornare':'GPS automatico';
    $('gps-chip').classList.toggle('ready',fresh&&!gpsBusy);
    $('gps-title').textContent=gpsBusy?'Misurazione GPS…':complete?`Qualità ${quality.label.toLowerCase()}`:gpsError?'GPS non pronto':'Qualità posizione GPS';
    $('gps-samples').textContent=`${count}/${GPS_TARGET_SAMPLES} letture`;
    $('gps-meter-fill').style.width=quality.score+'%';
    $('gps-meter').setAttribute('aria-valuenow',String(quality.score));
    $('gps-meter').setAttribute('aria-valuetext',`${count} letture su ${GPS_TARGET_SAMPLES}; ${source?'precisione stimata ±'+Math.round(source.accuracy)+' metri':'posizione non disponibile'}; ${complete?'pronto':gpsBusy?'in acquisizione':'non pronto'}`);
    $('gps-card').dataset.quality=gpsError?'incomplete':source?quality.tone:'none';
    $('gps-description').textContent=gpsBusy?`Attendi ${GPS_TARGET_SAMPLES} letture valide`:complete?'Precisione stimata, non potenza del segnale':gpsError?'Ripeti la rilevazione per salvare':'In attesa della posizione…';
    $('gps-details').textContent=source?`±${Math.round(source.accuracy)} m`:'—';
    if(gps){
      $('gps-lat').textContent=String(gps.lat);
      $('gps-lon').textContent=String(gps.lon);
    }
    const message=$('gps-quality');
    message.classList.toggle('warning',!!gpsError);
    if(gpsBusy){
      message.textContent=`${count}/3 rilevazioni · Salvataggio disponibile solo dopo la terza lettura valida.`;
    }else if(gpsError){
      message.textContent=gpsError;
    }else if(complete){
      const spread=gps.spread||0,unstable=spread>Math.max(12,gps.accuracy*1.5);
      message.classList.toggle('warning',unstable||gps.accuracy>35);
      message.textContent=unstable?`Letture distanti fino a ${Math.round(spread)} m: controlla il punto sulla mappa.`:
        !fresh?'Le coordinate non sono più recenti: verranno aggiornate prima del salvataggio.':
        gps.accuracy>35?'Precisione limitata: verifica la posizione prima del salvataggio.':'3 letture completate · Puoi salvare il civico.';
    }else{
      message.textContent='Attendo 3 rilevazioni GPS valide prima di abilitare Salva civico.';
    }
    $('gps-retry').hidden=gpsBusy||!gpsError;
    $('map-open').disabled=!source||!state.db;
    const selected=mapReview.getCaptureSelection();
    const info=$('map-review-note');
    if(selected){
      const offset=Math.round(SC.metersBetween(selected.original,selected.chosen));
      info.textContent=selected.moved
        ?'Pin spostato manualmente di '+offset+' m dal GPS originale · posizione verificata.'
        :'Posizione GPS verificata sulla mappa · ingresso confermato.';
      info.classList.add('reviewed');
    }else{
      info.textContent=source?'Il GPS non identifica necessariamente l’ingresso. Verifica il pin sulla mappa.':'Attendo il GPS per aprire la mappa.';
      info.classList.remove('reviewed');
    }
    mapReview.updateGps(source,complete);
    updateNearWarning();
  }
  function updateNearWarning(){
    const box=$('nearby-warning');
    if(!state.gps||!state.records.length){box.hidden=true;return;}
    const latest=state.records[0],selected=mapReview.getCaptureSelection();
    const reference=selected?.chosen||state.gps;
    const distance=SC.metersBetween(reference,latest);
    if(distance<=5){box.textContent=`Sei a circa ${Math.round(distance)} m dall’ultimo punto salvato (${latest.via}, ${latest.civico}). Puoi comunque salvare un civico diverso allo stesso ingresso.`;box.hidden=false;}
    else box.hidden=true;
  }
  function finishGps(error){
    if(!gpsBusy)return;
    stopGpsWatch();
    const best=SC.bestGpsSample(gpsSamples);
    const success=!!best&&SC.hasRequiredGpsReadings(gpsSamples,GPS_TARGET_SAMPLES);
    if(success){
      state.gps={...best,sampleCount:GPS_TARGET_SAMPLES,spread:SC.gpsSpread(gpsSamples)};
      gpsValidated=true;gpsError=null;
      autoComune(state.gps);
    }else{
      state.gps=null;gpsValidated=false;
      gpsError=error?.code===1?geolocationError(error):
        gpsSamples.length?`Ricevute solo ${gpsSamples.length} letture su 3. Salvataggio bloccato: premi «Riprova GPS» per una nuova rilevazione senza perdere l'indirizzo.`:
          geolocationError(error);
      toast(gpsError);
    }
    updateGpsUI();
    const resolve=gpsResolve;gpsResolve=null;gpsPromise=null;
    if(resolve)resolve(success);
  }
  function startGpsAcquisition(){
    if(gpsBusy)return gpsPromise||Promise.resolve(false);
    if(document.visibilityState==='hidden')return Promise.resolve(false);
    if(!navigator.geolocation){
      gpsError='GPS non disponibile su questo dispositivo.';
      state.gps=null;gpsValidated=false;updateGpsUI();return Promise.resolve(false);
    }
    const requestId=++gpsRequestId;
    mapReview.resetCapture();
    gpsBusy=true;gpsValidated=false;gpsError=null;state.gps=null;
    if(!comuneManual)showComune('');
    gpsSamples=[];gpsStartedAt=Date.now();
    gpsPromise=new Promise(resolve=>{gpsResolve=resolve;});
    updateGpsUI();
    gpsFirstTimer=setTimeout(()=>finishGps({code:3}),GPS_FIRST_FIX_TIMEOUT_MS);
    const acceptPosition=position=>{
      if(!gpsBusy||gpsRequestId!==requestId)return;
      const {latitude,longitude,accuracy}=position.coords,timestamp=position.timestamp;
      if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(accuracy)||accuracy<=0)return;
      if(!Number.isFinite(timestamp)||timestamp<gpsStartedAt-1000||gpsSamples.some(sample=>sample.timestamp===timestamp))return;
      gpsSamples.push({lat:latitude,lon:longitude,accuracy,timestamp});
      if(gpsSamples.length===1){
        clearTimeout(gpsFirstTimer);gpsFirstTimer=null;
        gpsRefineTimer=setTimeout(()=>finishGps({code:3}),GPS_REFINEMENT_MS);
      }
      updateGpsUI();
      // Neppure una precisione eccellente può chiudere il ciclo prima di 3 fix distinti.
      if(SC.hasRequiredGpsReadings(gpsSamples,GPS_TARGET_SAMPLES))finishGps();
    };
    const handleError=error=>{
      if(!gpsBusy||gpsRequestId!==requestId)return;
      if(error?.code===1||!gpsSamples.length)finishGps(error);
    };
    try{
      gpsWatch=navigator.geolocation.watchPosition(acceptPosition,handleError,{enableHighAccuracy:true,maximumAge:0,timeout:15000});
      // Su iOS da fermi watchPosition può non inviare tre callback: chiedi fix freschi aggiuntivi.
      // Timestamp identici non vengono conteggiati due volte.
      for(const delay of [2400,5400,9000]){
        gpsPollTimers.push(setTimeout(()=>{
          if(!gpsBusy||gpsRequestId!==requestId)return;
          navigator.geolocation.getCurrentPosition(acceptPosition,handleError,{enableHighAccuracy:true,maximumAge:0,timeout:8500});
        },delay));
      }
    }catch(e){finishGps();}
    return gpsPromise||Promise.resolve(!!gpsValidated);
  }
  $('gps-retry').addEventListener('click',()=>{void startGpsAcquisition();});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&!$('page-capture').hidden&&state.db&&!gpsBusy&&
       !SC.isFreshGps(state.gps,Date.now(),GPS_REENTER_REFRESH_MS))startGpsAcquisition();
  });

  // Beta 0.6.6: swipe Salva = azzera SOLO la bozza corrente e misura nuove coordinate.
  // Non cancella né modifica i civici già memorizzati nell'archivio.
  function resetCaptureForFreshGps(){
    if(gpsBusy){
      stopGpsWatch();
      const resolve=gpsResolve;gpsResolve=null;gpsPromise=null;
      if(resolve)resolve(false);
    }
    $('indirizzo').value='';
    $('indirizzo-warning').hidden=true;
    $('nearby-warning').hidden=true;
    comuneManual=false;
    $('comune').hidden=true;
    $('comune-edit-label').hidden=true;
    showComune('');
    state.gps=null;gpsValidated=false;gpsError=null;
    gpsSamples=[];updateGpsUI();
    return startGpsAcquisition();
  }
  function setupCapturePullToRefresh(){
    const page=$('page-capture'),indicator=$('capture-pull'),label=$('capture-pull-label'),
      status=$('capture-pull-status'),LIMIT=86,MAX=108;
    let start=null,travel=0,active=false,loading=false,resetTimer=0;
    const atTop=()=>Math.max(window.scrollY||0,document.documentElement.scrollTop||0,document.body.scrollTop||0)<=5;
    const reset=()=>{
      start=null;travel=0;active=false;
      indicator.style.height='0px';indicator.dataset.state='idle';
      label.textContent='Trascina per aggiornare il GPS';
    };
    const setProgress=distance=>{
      const amount=Math.min(MAX,Math.max(0,distance));
      indicator.style.height=Math.round(amount*0.72)+'px';
      indicator.dataset.state=distance>=LIMIT?'ready':'pulling';
      label.textContent=distance>=LIMIT?'Rilascia per azzerare e aggiornare':'Trascina per aggiornare il GPS';
    };
    async function performRefresh(){
      if(loading||page.hidden)return;
      loading=true;clearTimeout(resetTimer);
      indicator.dataset.state='loading';indicator.style.height='67px';
      label.textContent='Nuove coordinate GPS…';
      status.hidden=false;status.dataset.result='pending';
      status.textContent='Campi azzerati · rilevazione GPS in corso…';
      let success=false;
      try{success=await resetCaptureForFreshGps();}
      catch(_){success=false;}
      if(success&&state.gps&&gpsValidated){
        status.dataset.result='success';
        status.textContent='Nuova posizione GPS acquisita · campi pronti.';
        label.textContent='GPS aggiornato';
      }else{
        status.dataset.result='error';
        status.textContent='Campi azzerati. GPS non disponibile: verifica i permessi e riprova.';
        label.textContent='Riprova';
      }
      loading=false;resetTimer=setTimeout(reset,1000);
    }
    page.addEventListener('touchstart',event=>{
      start=null;
      if(page.hidden||loading||event.touches.length!==1||!atTop())return;
      if(document.querySelector('dialog[open]'))return;
      if(event.target.closest('input,textarea,button,select,[contenteditable="true"]'))return;
      start={x:event.touches[0].clientX,y:event.touches[0].clientY};
      travel=0;active=false;
    },{passive:true});
    page.addEventListener('touchmove',event=>{
      if(!start||loading||event.touches.length!==1)return;
      const dx=event.touches[0].clientX-start.x,dy=event.touches[0].clientY-start.y;
      if(!active&&(dy<9||Math.abs(dx)>dy*0.75||!atTop())){
        if(dy<0||Math.abs(dx)>Math.max(12,Math.abs(dy)))start=null;
        return;
      }
      if(!atTop()){reset();return;}
      active=true;travel=Math.max(0,dy);
      if(event.cancelable)event.preventDefault();
      setProgress(travel);
    },{passive:false});
    page.addEventListener('touchend',()=>{
      const shouldRefresh=active&&travel>=LIMIT;
      reset();
      if(shouldRefresh)void performRefresh();
    },{passive:true});
    page.addEventListener('touchcancel',reset,{passive:true});
  }
  setupCapturePullToRefresh();


  function makeId(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():`sc-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  $('capture-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!state.db){toast('Archivio non disponibile. Salvataggio disabilitato.');return;}
    if(gpsBusy){toast('Attendi tutte e 3 le rilevazioni GPS.');return;}
    if(!gpsValidated||state.gps?.sampleCount!==GPS_TARGET_SAMPLES){toast('Servono 3 rilevazioni GPS valide. Premi Riprova GPS oppure trascina verso il basso.');return;}
    const address=SC.splitAddress($('indirizzo').value);
    if(!address){
      $('indirizzo-warning').textContent='Scrivi via e civico insieme, ad esempio: Strada Campagnola 51 oppure Via Roma 73/A.';
      $('indirizzo-warning').hidden=false;
      $('indirizzo').focus();return;
    }
    let selectedPosition=mapReview.getCaptureSelection();
    if(selectedPosition&&Date.now()-selectedPosition.confirmedAt>MAP_REVIEW_MAX_AGE_MS){
      mapReview.resetCapture();
      toast('La verifica della posizione è troppo vecchia. Ripeti il GPS e controlla il pin.');
      void startGpsAcquisition();return;
    }
    if(!selectedPosition&&!SC.isFreshGps(state.gps,Date.now(),GPS_MAX_SAVE_AGE_MS)){
      toast('Aggiorno la posizione prima del salvataggio…');
      if(!(await startGpsAcquisition())||state.gps?.sampleCount!==GPS_TARGET_SAMPLES)return;
    }
    let comune=SC.clean($('comune').value);
    if(!comune){
      toast('Comune non individuato: usa Correggi per inserirlo.');
      $('comune-edit').click();return;
    }
    const {via,civico}=address;
    const draft={comune,via,civico,...state.gps};
    const duplicate=state.records.find(r=>SC.isSameCivic(draft,r));
    if(duplicate){
      const answer=await confirmAction('Civico già presente',`Hai già salvato ${duplicate.via}, ${duplicate.civico} (${duplicate.comune}). Vuoi registrare comunque un altro punto?`,'Salva comunque');
      if(!answer)return;
    }
    if(!selectedPosition&&!SC.isFreshGps(state.gps,Date.now(),GPS_MAX_SAVE_AGE_MS)){
      if(!(await startGpsAcquisition())||state.gps?.sampleCount!==GPS_TARGET_SAMPLES)return;
      if(!SC.clean($('comune').value)){
        toast('Comune non individuato: correggilo prima del salvataggio.');return;
      }
      if(SC.clean($('comune').value)!==comune){
        toast('Il comune è cambiato con il nuovo GPS: controllalo e premi nuovamente Salva civico.');return;
      }
    }
    if(!gpsValidated||state.gps?.sampleCount!==GPS_TARGET_SAMPLES){toast('GPS non completo: salvataggio annullato.');return;}
    if(!selectedPosition){
      const answer=await confirmAction('Posizione non verificata sulla mappa',
        'Le tre letture GPS non garantiscono la posizione dell’ingresso. Vuoi salvare comunque il civico senza verificare il pin sulla mappa?',
        'Salva GPS non verificato');
      if(!answer){mapReview.openCapture();return;}
    }
    if(!gpsValidated||state.gps?.sampleCount!==GPS_TARGET_SAMPLES||gpsBusy){
      toast('GPS non più completo: salvataggio annullato.');return;
    }
    const base={id:makeId(),comune,via,civico,lat:state.gps.lat,lon:state.gps.lon,accuracy:state.gps.accuracy,createdAt:new Date().toISOString()};
    const record=selectedPosition?SC.applyVerifiedPosition(base,selectedPosition):
      {...base,positionSource:'gps_unverified',gpsOriginal:{lat:state.gps.lat,lon:state.gps.lon,accuracy:state.gps.accuracy}};
    $('save-button').disabled=true;
    try{
      await writeOne(record);
      await refresh();
      $('indirizzo').value='';
      comuneManual=false;
      $('comune').hidden=true;$('comune-edit-label').hidden=true;
      state.gps=null;gpsValidated=false;mapReview.resetCapture();updateGpsUI();
      toast(`Civico ${record.civico} salvato.`);
      $('indirizzo').focus();
      if(document.visibilityState==='visible'&&!$('page-capture').hidden)startGpsAcquisition();
    }catch(e){toast('Salvataggio non riuscito. Controlla lo spazio disponibile.');}
    finally{updateGpsUI();}
  });

  function elt(tag,cls,content){const node=document.createElement(tag);if(cls)node.className=cls;if(content!==undefined)node.textContent=content;return node;}
  function renderRecords(){
    const term=SC.normalized($('search').value);
    const filtered=state.records.filter(r=>SC.normalized(`${r.comune} ${r.via} ${r.civico}`).includes(term));
    $('total-records').textContent=String(state.records.length);
    $('total-towns').textContent=String(new Set(state.records.map(r=>SC.normalized(r.comune))).size);
    const list=$('record-list');list.replaceChildren();
    $('records-empty').hidden=filtered.length>0;
    const fragment=document.createDocumentFragment();
    for(const r of filtered){
      const card=elt('article','record');
      const head=elt('div','record-head'),heading=elt('div');
      heading.append(elt('h3','',`${r.via}, ${r.civico}`),elt('p','',r.comune));
      head.append(heading,elt('span','record-badge','GPS'));
      const time=new Date(r.createdAt).toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'});
      const meta=elt('p','record-meta',`${time} · ${Number(r.lat).toFixed(6)}, ${Number(r.lon).toFixed(6)} · ±${Math.round(r.accuracy||0)} m`);
      const actions=elt('div','record-actions');
      const map=elt('a','','Apri mappa');map.href=`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lon}`;map.target='_blank';map.rel='noopener noreferrer';
      const edit=elt('button','','Modifica');edit.type='button';edit.addEventListener('click',()=>editRecord(r));
      const del=elt('button','delete','Elimina');del.type='button';del.addEventListener('click',()=>deleteRecord(r));
      actions.append(map,edit,del);card.append(head,meta,actions);fragment.append(card);
    }
    list.append(fragment);
  }
  $('search').addEventListener('input',renderRecords);
  function editRecord(record){
    state.editingId=record.id;$('edit-comune').value=record.comune;$('edit-via').value=record.via;$('edit-civico').value=record.civico;$('edit-dialog').showModal();
  }
  $('edit-cancel').addEventListener('click',()=>$('edit-dialog').close());
  $('edit-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const record=state.records.find(r=>r.id===state.editingId);if(!record)return;
    const comune=SC.clean($('edit-comune').value),via=SC.clean($('edit-via').value),civico=SC.clean($('edit-civico').value);
    if(!comune||!via||!civico){toast('Compila tutti i campi.');return;}
    const updated={...record,comune,via,civico};
    try{await writeOne(updated);$('edit-dialog').close();await refresh();toast('Civico aggiornato.');}catch(e){toast('Modifica non riuscita.');}
  });
  async function deleteRecord(r){
    const answer=await confirmAction('Eliminare il civico?',`Il punto ${r.via}, ${r.civico} (${r.comune}) sarà eliminato da questo dispositivo.`, 'Elimina');
    if(!answer)return;
    try{await removeOne(r.id);await refresh();toast('Civico eliminato.');}catch(e){toast('Eliminazione non riuscita.');}
  }


  // Il pulsante è volutamente separato dall'Elimina di un singolo record.
  // Se il cloud non è accessibile o non coincide con l'archivio locale, non cancella nulla.
  async function deleteAllAcquisitions(){
    if(!state.db){toast('Archivio non disponibile: nessun dato eliminato.');return;}
    const total=(await readAll()).length;
    if(!total){toast('Archivio già vuoto.');return;}
    const first=await confirmAction('Eliminare tutte le acquisizioni?',
      'Sono presenti '+total+' civici. Procedi solo DOPO avere verificato il loro inserimento negli archivi e nelle mappe: il backup JSON e My Maps non sono sincronizzati automaticamente.',
      'Prima conferma');
    if(!first)return;
    const second=await confirmAction('Seconda conferma: cancellazione totale',
      'Stai eliminando '+total+' civici da questo dispositivo E dal cloud condiviso. Anche gli altri dispositivi riceveranno l’archivio vuoto. I dati non saranno recuperabili dall’app senza un backup JSON.',
      'ELIMINA TUTTI');
    if(!second)return;
    const button=$('delete-all-records');
    button.disabled=true;
    try{
      const result=await window.SCCloud?.clearAll?.({expectedCount:total});
      if(!result?.ok)toast(result?.description||'Eliminazione non disponibile: nessun dato locale cancellato.');
    }catch(_){toast('Eliminazione non completata. Verifica lo stato cloud prima di riprovare.');}
    finally{button.disabled=false;}
  }
  $('delete-all-records').addEventListener('click',()=>void deleteAllAcquisitions());

  const filenameDate=()=>new Date().toISOString().slice(0,10);
  async function shareOrDownload(filename,mime,content){
    const file=new File([content],filename,{type:mime});
    try{
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],title:'SalvaCivici – Mappa Recapito'});
        return;
      }
    }catch(error){if(error.name==='AbortError')return;}
    const blob=new Blob([content],{type:mime});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
    toast(`Esportazione di ${filename} avviata.`);
  }
  $('export-csv').addEventListener('click',async()=>{
    if(!state.records.length){toast('Non ci sono civici da esportare.');return;}
    await shareOrDownload(`MappaCivici_${filenameDate()}.csv`,'text/csv;charset=utf-8',SC.csv(state.records));
  });
  $('export-json').addEventListener('click',async()=>{
    if(!state.records.length){toast('Non ci sono civici da salvare.');return;}
    const backup={app:'SalvaCivici',version:1,exportedAt:new Date().toISOString(),records:state.records};
    await shareOrDownload(`SalvaCivici_backup_${filenameDate()}.json`,'application/json',JSON.stringify(backup,null,2));
  });
  $('import-json').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>25*1024*1024){toast('Il file è troppo grande.');return;}
    let records;
    try{const backup=JSON.parse(await file.text());
      if(backup?.app!=='SalvaCivici'||backup?.version!==1||!Array.isArray(backup.records)||backup.records.length>100000||!backup.records.every(SC.isRecord))throw new Error('bad format');
      const ids=new Set();for(const r of backup.records){if(ids.has(r.id))throw new Error('duplicate ID');ids.add(r.id);}
      records=backup.records;
    }catch(e){toast('Backup non valido o formato non riconosciuto.');return;}
    const answer=await confirmAction('Ripristina backup',`Importare ${records.length} civici? I dati già presenti resteranno; eventuali punti con lo stesso ID saranno aggiornati.`,'Importa');
    if(!answer)return;
    try{await writeMany(records);await refresh();toast(`${records.length} civici importati.`);}catch(e){toast('Importazione non riuscita.');}
  });

  /* Aggiornamento versioni: nessun reset IndexedDB o localStorage. */
  function setupAppUpdates(){
    if(!('serviceWorker'in navigator)||location.protocol!=='https:')return;
    const banner=$('update-banner');
    let controller=navigator.serviceWorker.controller;
    let lastCheck=0;
    $('apply-update').addEventListener('click',async()=>{
      if(gpsBusy){toast('Termina prima il rilevamento GPS.');return;}
      if($('edit-dialog').open){toast('Termina prima la modifica del civico.');return;}
      if($('indirizzo').value.trim()){
        const proceed=await confirmAction('Aggiornare SalvaCivici?','Il civico che stai compilando non è ancora salvato. I civici già presenti nell’archivio rimarranno disponibili.','Aggiorna');
        if(!proceed)return;
      }
      location.reload();
    });
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      const next=navigator.serviceWorker.controller;
      if(controller&&next&&controller!==next)banner.hidden=false;
      controller=next;
    });
    navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
      const check=()=>{
        if(!navigator.onLine||document.visibilityState==='hidden'||Date.now()-lastCheck<45000)return;
        lastCheck=Date.now();
        reg.update().catch(()=>{});
      };
      check();
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
      window.addEventListener('online',check);
      window.addEventListener('pageshow',check);
    }).catch(()=>{});
  }
  (async()=>{
    try{state.db=await dbOpen();await refresh();}catch(error){toast('Archivio locale non disponibile: impossibile salvare i civici.');$('save-button').disabled=true;}
    // Apertura sempre dalla schermata Salva: non toccare l'archivio persistente.
    $('indirizzo').value='';showComune('');
    showPage('capture');
    updateGpsUI();
    if(window.SCCloud)window.SCCloud.init({getRecords:readAll,applySnapshot,confirmAction,toast});
    setupAppUpdates();
    startGpsAcquisition();
  })();
})();
