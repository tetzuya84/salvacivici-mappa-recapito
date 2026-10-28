/* SalvaCivici Beta 0.5.8 — backup manuale Google Drive.
   Richiede un OAuth Client ID Web dell'utente; permesso drive.file.
   Non trasmettere dati all'apertura o durante il recapito. */
(function(root){
  'use strict';
  const SCOPE='https://www.googleapis.com/auth/drive.file';
  const CLIENT_KEY='salvacivici-drive-client-id';
  const LAST_KEY='salvacivici-drive-last';
  const HASH_KEY='salvacivici-drive-hash';
  const FOLDER_NAME='SalvaCivici - Backup app';
  const MAIN_NAME='SalvaCivici_backup.json';
  const API='https://www.googleapis.com';
  const $=id=>document.getElementById(id);
  let token='',tokenUntil=0,busy=false,setup;

  function configuredClient(){try{return localStorage.getItem(CLIENT_KEY)||'';}catch(e){return '';}}
  function setClient(id){localStorage.setItem(CLIENT_KEY,id);}
  function getSaved(key){try{return localStorage.getItem(key)||'';}catch(e){return '';}}
  function setSaved(key,value){try{localStorage.setItem(key,value);}catch(e){}}
  function status(message,isError){
    const node=$('drive-status');if(!node)return;
    node.textContent=message;node.classList.toggle('warning',!!isError);
  }
  function openSetup(){const area=$('drive-setup');area.hidden=false;$('drive-client-id').focus();}
  function validClient(id){return /^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(id);}
  async function fingerprint(records){
    if(!root.crypto||!root.crypto.subtle)return '';
    const data=new TextEncoder().encode(JSON.stringify(records));
    const hash=await root.crypto.subtle.digest('SHA-256',data);
    return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function updateStatus(){
    if(busy)return;
    const last=getSaved(LAST_KEY),hash=getSaved(HASH_KEY);
    if(!configuredClient()){status('Collegamento Google da configurare. Nessun dato inviato.');return;}
    if(!last){status('Drive configurato. Nessun backup eseguito.');return;}
    const time=new Date(last);
    const when=Number.isNaN(time.getTime())?'precedentemente':time.toLocaleString('it-IT',{dateStyle:'short',timeStyle:'short'});
    try{
      const current=await setup.getRecords();
      const digest=await fingerprint(current);
      if(digest&&hash&&digest!==hash)status('Modifiche non sincronizzate. Ultimo invio: '+when);
      else status('Ultimo backup Drive: '+when+'.');
    }catch(e){status('Ultimo backup Drive: '+when+'.');}
  }
  async function responseJson(response){
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===401)token='';
      throw new Error(data.error?.message||('Google Drive HTTP '+response.status));
    }
    return data;
  }
  async function drive(method,path,data){
    const options={method,headers:{Authorization:'Bearer '+token}};
    if(data!==undefined){options.headers['Content-Type']='application/json';options.body=JSON.stringify(data);}
    return responseJson(await fetch(API+path,options));
  }
  async function findFile(name,folderId,mimeType){
    let q="name = '"+name.replace(/'/g,"\\'")+"' and trashed = false";
    if(folderId)q+=" and '"+folderId+"' in parents";
    if(mimeType)q+=" and mimeType = '"+mimeType+"'";
    const path='/drive/v3/files?q='+encodeURIComponent(q)+'&fields='+encodeURIComponent('files(id,name,mimeType),nextPageToken')+'&pageSize=100';
    const result=await drive('GET',path);
    return result.files?.[0]||null;
  }
  async function ensureFolder(){
    const mime='application/vnd.google-apps.folder';
    const existing=await findFile(FOLDER_NAME,null,mime);
    if(existing)return existing.id;
    const created=await drive('POST','/drive/v3/files?fields=id',{name:FOLDER_NAME,mimeType:mime});
    if(!created.id)throw new Error('Impossibile creare la cartella su Drive.');
    return created.id;
  }
  async function uploadJson(folderId,name,content){
    if(new TextEncoder().encode(content).byteLength>5*1024*1024)throw new Error('Backup oltre 5 MB: usa per ora l’esportazione JSON manuale.');
    const existing=await findFile(name,folderId,'application/json');
    const url=existing
      ?'/upload/drive/v3/files/'+encodeURIComponent(existing.id)+'?uploadType=media&fields=id,name'
      :'/upload/drive/v3/files?uploadType=multipart&fields=id,name';
    let resp;
    if(existing){
      resp=await fetch(API+url,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json; charset=UTF-8'},body:content});
    }else{
      const boundary='salvacivici_'+Date.now().toString(36);
      const body=new Blob([
        '--'+boundary+'\r\n',
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify({name,mimeType:'application/json',parents:[folderId]}),
        '\r\n--'+boundary+'\r\n',
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        content,
        '\r\n--'+boundary+'--'
      ],{type:'multipart/related; boundary='+boundary});
      resp=await fetch(API+url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/related; boundary='+boundary},body});
    }
    const saved=await responseJson(resp);
    if(!saved.id)throw new Error('Google Drive non ha confermato il file '+name+'.');
    return saved;
  }
  async function syncRecords(){
    if(busy)return;
    if(!navigator.onLine){status('Internet non disponibile. Nessun dato inviato.',true);return;}
    busy=true;$('drive-sync').disabled=true;status('Preparazione del backup…');
    try{
      const before=await setup.getRecords();
      if(!Array.isArray(before)||!before.every(r=>root.SC.isRecord(r)))throw new Error('L’archivio locale non è disponibile o contiene dati non validi.');
      const question=before.length
        ?'Hai controllato '+before.length+' civici in Archivio? Il backup su Drive sarà aggiornato con questi dati, comprese eventuali correzioni.'
        :'L’archivio è vuoto. Sincronizzando sostituirai il backup corrente con un archivio vuoto. Vuoi continuare?';
      const ok=await setup.confirmAction('Sincronizzare con Drive?',question,'Sincronizza');
      if(!ok){status('Sincronizzazione annullata: nessun dato inviato.');return;}
      const records=await setup.getRecords();
      if(!Array.isArray(records)||!records.every(r=>root.SC.isRecord(r)))throw new Error('Archivio non valido.');
      const exportedAt=new Date().toISOString();
      const backup=JSON.stringify({app:'SalvaCivici',version:1,exportedAt,records},null,2);
      const date=new Date(exportedAt).toLocaleDateString('sv-SE',{timeZone:'Europe/Rome'});
      status('Invio su Google Drive…');
      const folder=await ensureFolder();
      await uploadJson(folder,MAIN_NAME,backup);
      await uploadJson(folder,'SalvaCivici_backup_'+date+'.json',backup);
      const hash=await fingerprint(records);
      setSaved(HASH_KEY,hash);
      setSaved(LAST_KEY,exportedAt);
      status('Backup completato: '+records.length+' civici su Drive alle '+new Date(exportedAt).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})+'.');
      setup.toast('Backup Google Drive completato.');
    }catch(error){
      status('Backup non confermato: '+(error.message||'errore sconosciuto')+'. Riprova senza cancellare i dati locali.',true);
    }finally{busy=false;$('drive-sync').disabled=false;}
  }
  function requestSync(){
    if(busy)return;
    const id=configuredClient();
    if(!id){openSetup();status('Prima collega Google Drive. Nessun civico inviato.',true);return;}
    if(!navigator.onLine){status('Connettiti a Internet per sincronizzare.',true);return;}
    if(!root.google?.accounts?.oauth2){status('Accesso Google non caricato: controlla Internet e riapri l’app.',true);return;}
    if(token&&Date.now()<tokenUntil){void syncRecords();return;}
    try{
      const client=root.google.accounts.oauth2.initTokenClient({
        client_id:id,scope:SCOPE,
        callback:answer=>{
          if(answer.error||!answer.access_token){status('Accesso Google non autorizzato: '+(answer.error||'nessun token'),true);return;}
          token=answer.access_token;
          tokenUntil=Date.now()+Math.max(30,Number(answer.expires_in||3500)-90)*1000;
          void syncRecords();
        },
        error_callback:()=>status('Accesso Google annullato o non disponibile. Riprova.',true)
      });
      client.requestAccessToken({prompt:''});
    }catch(error){status('Impossibile aprire la connessione Google: '+(error.message||'errore'),true);}
  }
  function init(options){
    setup=options;
    if(!$('drive-sync'))return;
    $('drive-sync').addEventListener('click',requestSync);
    $('drive-setup-toggle').addEventListener('click',()=>{
      const area=$('drive-setup');area.hidden=!area.hidden;
      if(!area.hidden)$('drive-client-id').focus();
    });
    $('drive-client-id').value=configuredClient();
    $('drive-config-save').addEventListener('click',()=>{
      const id=$('drive-client-id').value.trim();
      if(!validClient(id)){status('Client ID non valido. Incolla solo il Client ID Web di Google, mai un client secret.',true);return;}
      setClient(id);token='';tokenUntil=0;$('drive-setup').hidden=true;
      void updateStatus();
      setup.toast('Collegamento configurato. Ora puoi autorizzare Drive.');
    });
    root.addEventListener('salvacivici:datachanged',()=>{void updateStatus();});
    void updateStatus();
  }
  root.SCDriveSync={init};
})(window);
