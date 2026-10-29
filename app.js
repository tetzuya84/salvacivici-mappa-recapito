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
      const finish = answer=>{modal.removeEventListener('cancel',onCancel);$('dialog-cancel').removeEventListener('click',onNo);$('dialog-confirm').removeEventListener('click',onYes);if(modal.open)modal.close();resolve(answer);};
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
  const GPS_REFINEMENT_MS=3800;
  const GPS_FIRST_FIX_TIMEOUT_MS=18000;
  const GPS_MAX_SAVE_AGE_MS=30000;
  const GPS_REENTER_REFRESH_MS=15000;
  let gpsWatch=null, gpsFirstTimer=null, gpsRefineTimer=null;
  let gpsBusy=false, gpsValidated=false, gpsSamples=[], gpsStartedAt=0;
  let gpsResolve=null,gpsPromise=null,gpsError=null;

  function stopGpsWatch(){
    if(gpsWatch!==null){navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null;}
    clearTimeout(gpsFirstTimer);clearTimeout(gpsRefineTimer);
    gpsFirstTimer=null;gpsRefineTimer=null;
    gpsBusy=false;
  }
  function updateGpsUI(){
    const gps=state.gps;
    $('save-button').disabled=gpsBusy||!state.db;
    $('gps-coordinates').hidden=!gps;
    $('gps-details').hidden=!gps;
    const fresh=!!gps&&gpsValidated&&SC.isFreshGps(gps,Date.now(),GPS_MAX_SAVE_AGE_MS);
    $('gps-chip').textContent=gpsBusy?'Misurazione…':fresh?'GPS acquisito':gpsError?'GPS non disponibile':gps?'Da aggiornare':'GPS automatico';
    $('gps-chip').classList.toggle('ready',fresh&&!gpsBusy);
    $('gps-title').textContent=gpsBusy?'Acquisizione automatica…':gps?'Coordinate rilevate':gpsError?'Posizione non disponibile':'GPS automatico';
    $('gps-description').textContent=gpsBusy?'Resta fermo: confronto più posizioni.':gps?`${gps.sampleCount||1} ${gps.sampleCount===1?'lettura':'letture'} GPS · scelta la precisione stimata migliore.`:gpsError?'Controlla i permessi: l’app riproverà alla riapertura.':'Si avvia da solo quando apri l’app.';
    if(gps){
      $('gps-lat').textContent=String(gps.lat);
      $('gps-lon').textContent=String(gps.lon);
      $('gps-details').textContent=`Precisione stimata: ±${Math.round(gps.accuracy)} m · ${new Date(gps.timestamp).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
    }
    const quality=$('gps-quality');
    quality.classList.remove('warning');
    if(gpsBusy){
      quality.hidden=false;
      quality.textContent=gpsSamples.length?`${gpsSamples.length} ${gpsSamples.length===1?'lettura valida':'letture valide'} raccolte · miglior precisione: ±${Math.round(SC.bestGpsSample(gpsSamples).accuracy)} m.`:'Ricerca del segnale GPS…';
    }else if(gpsError){
      quality.hidden=false;quality.classList.add('warning');
      quality.textContent=gpsError+' Puoi riprovare tornando su Salva o premendo Salva civico dopo aver compilato i campi.';
    }else if(gps){
      quality.hidden=false;
      if(!fresh){
        quality.classList.add('warning');quality.textContent='Posizione da aggiornare: verrà rilevata automaticamente prima di salvare.';
      }else{
        const spread=gps.spread||0,unstable=spread>Math.max(12,gps.accuracy*1.5),lowAccuracy=gps.accuracy>20;
        quality.classList.toggle('warning',unstable||lowAccuracy);
        quality.textContent=unstable?`Attenzione: le letture variano di ${Math.round(spread)} m. Verifica il punto prima di salvare.`:lowAccuracy?'Segnale poco preciso: verifica il punto prima di salvare.':gps.sampleCount<2?'Una sola lettura GPS valida.':`Posizione selezionata tra ${gps.sampleCount} letture (distanza massima tra misure: ${Math.round(spread)} m).`;
      }
    }else{quality.hidden=true;quality.textContent='';}
    updateNearWarning();
  }
  function updateNearWarning(){
    const box=$('nearby-warning');
    if(!state.gps||!state.records.length){box.hidden=true;return;}
    const latest=state.records[0],distance=SC.metersBetween(state.gps,latest);
    if(distance<=5){box.textContent=`Sei a circa ${Math.round(distance)} m dall’ultimo punto salvato (${latest.via}, ${latest.civico}). Puoi comunque salvare un civico diverso allo stesso ingresso.`;box.hidden=false;}
    else box.hidden=true;
  }
  function finishGps(error){
    if(!gpsBusy)return;
    stopGpsWatch();
    const best=SC.bestGpsSample(gpsSamples),success=!!best;
    if(best){
      state.gps={...best,sampleCount:gpsSamples.length,spread:SC.gpsSpread(gpsSamples)};
      gpsValidated=true;gpsError=null;
      autoComune(state.gps);
    }else{
      state.gps=null;gpsValidated=false;gpsError=geolocationError(error);
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
    gpsBusy=true;gpsValidated=false;gpsError=null;state.gps=null;
    if(!comuneManual)showComune('');
    gpsSamples=[];gpsStartedAt=Date.now();
    gpsPromise=new Promise(resolve=>{gpsResolve=resolve;});
    updateGpsUI();
    gpsFirstTimer=setTimeout(()=>finishGps({code:3}),GPS_FIRST_FIX_TIMEOUT_MS);
    try{
      gpsWatch=navigator.geolocation.watchPosition(position=>{
        if(!gpsBusy)return;
        const {latitude,longitude,accuracy}=position.coords,timestamp=position.timestamp;
        if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||!Number.isFinite(accuracy)||accuracy<=0)return;
        if(!Number.isFinite(timestamp)||timestamp<gpsStartedAt-1000||gpsSamples.some(s=>s.timestamp===timestamp))return;
        gpsSamples.push({lat:latitude,lon:longitude,accuracy,timestamp});
        if(gpsSamples.length===1){
          clearTimeout(gpsFirstTimer);gpsFirstTimer=null;
          gpsRefineTimer=setTimeout(()=>finishGps(),GPS_REFINEMENT_MS);
        }
        updateGpsUI();
        const best=SC.bestGpsSample(gpsSamples);
        if(gpsSamples.length>=GPS_TARGET_SAMPLES||(gpsSamples.length>=2&&best.accuracy<=5))finishGps();
      },error=>finishGps(error),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
    }catch(e){finishGps();}
    return gpsPromise||Promise.resolve(!!state.gps);
  }
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&!$('page-capture').hidden&&state.db&&!gpsBusy&&
       !SC.isFreshGps(state.gps,Date.now(),GPS_REENTER_REFRESH_MS))startGpsAcquisition();
  });

  function makeId(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():`sc-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  $('capture-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!state.db){toast('Archivio non disponibile. Salvataggio disabilitato.');return;}
    if(gpsBusy){toast('Attendi la fine del rilevamento GPS.');return;}
    const address=SC.splitAddress($('indirizzo').value);
    if(!address){
      $('indirizzo-warning').textContent='Scrivi via e civico insieme, ad esempio: Strada Campagnola 51 oppure Via Roma 73/A.';
      $('indirizzo-warning').hidden=false;
      $('indirizzo').focus();return;
    }
    if(!gpsValidated||!SC.isFreshGps(state.gps,Date.now(),GPS_MAX_SAVE_AGE_MS)){
      toast('Aggiorno la posizione prima del salvataggio…');
      if(!(await startGpsAcquisition()))return;
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
    if(!SC.isFreshGps(state.gps,Date.now(),GPS_MAX_SAVE_AGE_MS)){
      if(!(await startGpsAcquisition()))return;
      if(!SC.clean($('comune').value)){
        toast('Comune non individuato: correggilo prima del salvataggio.');return;
      }
      if(SC.clean($('comune').value)!==comune){
        toast('Il comune è cambiato con il nuovo GPS: controllalo e premi nuovamente Salva civico.');return;
      }
    }
    const record={id:makeId(),comune,via,civico,lat:state.gps.lat,lon:state.gps.lon,accuracy:state.gps.accuracy,createdAt:new Date().toISOString()};
    $('save-button').disabled=true;
    try{
      await writeOne(record);
      await refresh();
      $('indirizzo').value='';
      comuneManual=false;
      $('comune').hidden=true;$('comune-edit-label').hidden=true;
      state.gps=null;gpsValidated=false;updateGpsUI();
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
    // Apertura pulita: nessun valore dei campi viene ripristinato da sessioni precedenti.
    $('indirizzo').value='';showComune('');
    updateGpsUI();
    if(window.SCCloud)window.SCCloud.init({getRecords:readAll,applySnapshot,confirmAction,toast});
    setupAppUpdates();
    startGpsAcquisition();
  })();
})();
