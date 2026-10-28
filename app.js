(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const SC=window.SC;
  const state={records:[],gps:null,editingId:null,db:null,toastTimeout:0};
  const DBNAME='salvacivici-mappa-recapito-v1';
  const STORE='civici';

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
  async function refresh(){state.records=(await readAll()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));renderRecords();updateNearWarning();}

  function showPage(tab){
    ['capture','records','data'].forEach(name=>{
      $('page-'+name).hidden=name!==tab;
      const button=document.querySelector(`[data-tab="${name}"]`);
      button.classList.toggle('active',name===tab);
      if(name===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    if(tab==='records')renderRecords();
    window.scrollTo({top:0,behavior:'auto'});
  }
  document.querySelectorAll('.tab').forEach(el=>el.addEventListener('click',()=>showPage(el.dataset.tab)));

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
  function updateGpsUI(){
    const gps=state.gps;
    $('gps-button').textContent=gps?'↻ Rileva di nuovo':'◎ Rileva GPS';
    $('gps-coordinates').hidden=!gps;$('gps-details').hidden=!gps;
    $('gps-chip').textContent=gps?'GPS acquisito':'Non rilevata';$('gps-chip').classList.toggle('ready',!!gps);
    $('gps-title').textContent=gps?'Coordinate rilevate':'Pronto a rilevare';
    $('gps-description').textContent=gps?'Puoi ripetere il rilevamento quando vuoi.':'Acquisisci la posizione quando sei davanti al civico.';
    if(gps){
      $('gps-lat').textContent=String(gps.lat);$('gps-lon').textContent=String(gps.lon);
      $('gps-details').textContent=`Precisione stimata: ±${Math.round(gps.accuracy)} m · ${new Date(gps.timestamp).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`+(gps.accuracy>30?' · Segnale poco preciso':'');
    }
    updateNearWarning();
  }
  function updateNearWarning(){
    const box=$('nearby-warning');
    if(!state.gps||!state.records.length){box.hidden=true;return;}
    const latest=state.records[0],distance=SC.metersBetween(state.gps,latest);
    if(distance<=5){box.textContent=`Sei a circa ${Math.round(distance)} m dall’ultimo punto salvato (${latest.via}, ${latest.civico}). Puoi comunque salvare un civico diverso allo stesso ingresso.`;box.hidden=false;}
    else box.hidden=true;
  }
  $('gps-button').addEventListener('click',()=>{
    if(!navigator.geolocation){toast('Il GPS non è disponibile su questo dispositivo.');return;}
    const button=$('gps-button');button.disabled=true;button.textContent='Rilevamento in corso…';
    navigator.geolocation.getCurrentPosition(position=>{
      const {latitude,longitude,accuracy}=position.coords;
      state.gps={lat:latitude,lon:longitude,accuracy,timestamp:position.timestamp};
      button.disabled=false;updateGpsUI();toast('Coordinate GPS acquisite.');
    },error=>{button.disabled=false;updateGpsUI();toast(geolocationError(error));},{enableHighAccuracy:true,maximumAge:0,timeout:25000});
  });

  function makeId(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():`sc-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  $('capture-form').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!state.db){toast('Archivio non disponibile. Salvataggio disabilitato.');return;}
    const comune=SC.clean($('comune').value),via=SC.clean($('via').value),civico=SC.clean($('civico').value);
    if(!comune||!via||!civico){toast('Compila comune, via e civico.');(!comune?$('comune'):!via?$('via'):$('civico')).focus();return;}
    if(!state.gps){toast('Prima rileva la posizione GPS.');return;}
    const draft={comune,via,civico,...state.gps};
    const duplicate=state.records.find(r=>SC.isSameCivic(draft,r));
    if(duplicate){
      const answer=await confirmAction('Civico già presente',`Hai già salvato ${duplicate.via}, ${duplicate.civico} (${duplicate.comune}). Vuoi registrare comunque un altro punto?`,'Salva comunque');
      if(!answer)return;
    }
    const record={id:makeId(),comune,via,civico,lat:state.gps.lat,lon:state.gps.lon,accuracy:state.gps.accuracy,createdAt:new Date().toISOString()};
    $('save-button').disabled=true;
    try{
      await writeOne(record);
      try{localStorage.setItem('salvacivici-last-town',comune);localStorage.setItem('salvacivici-last-road',via);}catch(e){}
      await refresh();$('civico').value='';state.gps=null;updateGpsUI();toast(`Civico ${record.civico} salvato.`);$('civico').focus();
    }catch(e){toast('Salvataggio non riuscito. Controlla lo spazio disponibile.');}
    finally{$('save-button').disabled=false;}
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

  (async()=>{
    try{state.db=await dbOpen();await refresh();}catch(error){toast('Archivio locale non disponibile: impossibile salvare i civici.');$('save-button').disabled=true;}
    try{$('comune').value=localStorage.getItem('salvacivici-last-town')||'';$('via').value=localStorage.getItem('salvacivici-last-road')||'';}catch(e){}
    updateGpsUI();
    if('serviceWorker'in navigator&&location.protocol==='https:'){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  })();
})();
