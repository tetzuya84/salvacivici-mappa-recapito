/* SalvaCivici Beta 0.6.41 — backup tecnico privato per Archivio e Mappa permanente.
 * NON sostituisce Firebase o IndexedDB. Drive.file limitato ai file dell'app.
 * Access token OAuth solo in memoria, ricevuto durante Google Sign-In.
 * Non pubblica civici in GitHub, non elimina né sovrascrive altri file Drive.
 */
(function(root){
'use strict';
const FOLDER='SalvaCivici - Backup app';
const PREFIX='SalvaCivici_auto_';
const BASE='https://www.googleapis.com/drive/v3/files';
const UPLOAD='https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink';
const MAX_BYTES=700*1024;

const $=id=>document.getElementById(id);
let current=null,busy=false;
function showRecoveryButton(show){
 const button=$('drive-recover');
 if(button)button.hidden=!show;
}
function status(text,isError=false){
 const el=$('drive-status');
 if(el){el.textContent=text;el.classList.toggle('warning',!!isError);}
}
function textError(e){
 const m=String(e?.message||e||'Errore Drive');
 if(/401|token non valido|expired/i.test(m))return 'Accesso Drive scaduto. Usa Accedi con Google nella sezione Dati per riattivarlo.';
 if(/403|insufficient|scope|permission/i.test(m))return 'Drive non autorizzato. Consenti a SalvaCivici di creare i propri file nel tuo Drive.';
 return 'Backup Drive non riuscito: '+m.slice(0,155)+'. Il cloud e l’archivio locale restano invariati.';
}
function authorize({uid,email,accessToken}){
 const own=root.SCCloud?.getIdentity?.();
 if(!uid||!accessToken||!own?.uid||own.uid!==uid||String(own.email||'').toLowerCase()!==String(email||'').toLowerCase()){
   current=null;status('Account non corrispondente: nessun file Drive modificato.',true);
   root.SCCloud?.refreshAuthUi?.();
   return false;
 }
 current={uid,email,token:accessToken};
 showRecoveryButton(false);
 status('Drive collegato automaticamente con Google ('+email+'). Controllo i backup disponibili…');
 root.SCCloud?.refreshAuthUi?.();
 void checkRecovery();
 return true;
}
function clear(){current=null;showRecoveryButton(false);status('Il Drive si abilita con lo stesso accesso Google.');root.SCCloud?.refreshAuthUi?.();}
function isAuthorized(uid,email){
 return !!current?.token&&!!uid&&current.uid===uid&&
   String(current.email||'').toLowerCase()===String(email||'').toLowerCase();
}
function showPendingAuthorization(){
 if(current?.token)return;
 status('Cloud collegato. Il backup Drive richiede una nuova autorizzazione Google; i civici restano sincronizzabili.');
}
async function fetchGoogle(url,options={}){
 if(!current?.token)throw Error('Accesso Drive non disponibile');
 const headers={Authorization:'Bearer '+current.token,...options.headers};
 const res=await fetch(url,{...options,headers,cache:'no-store'});
 if(!res.ok){
   const info=await res.json().catch(()=>({}));
   if(res.status===401||res.status===403)clear();
   throw Error('HTTP '+res.status+' '+(info.error?.message||''));
 }
 return res;
}
const escaped=v=>String(v).replace(/'/g,"\\'");
async function list(q,fields){
 let all=[],pageToken='';
 do{
   const args=new URLSearchParams({q,fields:'nextPageToken,files('+fields+')',pageSize:'100'});
   if(pageToken)args.set('pageToken',pageToken);
   const response=await (await fetchGoogle(BASE+'?'+args)).json();
   all.push(...(response.files||[]));
   if(all.length>200)throw Error('Troppi backup da controllare: verifica il Drive manualmente.');
   pageToken=response.nextPageToken||'';
 }while(pageToken);
 return all;
}
async function folder(create){
 let folders=await list("name = '"+escaped(FOLDER)+"' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",'id,name');
 if(folders.length>1)throw Error('Più cartelle SalvaCivici trovate. Nessuna scrittura eseguita.');
 if(folders.length)return folders[0].id;
 if(!create)return null;
 const response=await fetchGoogle(BASE+'?fields=id,name',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({name:FOLDER,mimeType:'application/vnd.google-apps.folder'})
 });
 const data=await response.json();
 if(!data?.id)throw Error('Google Drive non ha restituito la nuova cartella.');
 return data.id;
}
async function backups(folderId){
 const files=await list("'"+escaped(folderId)+"' in parents and name contains '"+PREFIX+"' and trashed = false",
   'id,name,mimeType,createdTime');
 return files.filter(x=>x.name?.startsWith(PREFIX)&&x.name.endsWith('.json')&&x.mimeType==='application/json')
   .sort((a,b)=>String(b.createdTime||'').localeCompare(String(a.createdTime||'')));
}
function validate(records,owner){
 if(!Array.isArray(records)||records.some(x=>!root.SC?.isRecord?.(x))||
    new Set(records.map(x=>x.id)).size!==records.length)throw Error('Archivio non valido o ID duplicati.');
 if(owner&&current?.uid!==owner)throw Error('Backup di un account diverso: nessuna modifica.');
}
async function download(id){
 const data=await (await fetchGoogle(BASE+'/'+encodeURIComponent(id)+'?alt=media')).json();
 if(data?.app!=='SalvaCivici'||data?.schema!==1||data?.ownerUid!==current.uid)
   throw Error('File Drive non riconosciuto come backup di questo account.');
 validate(data.records,data.ownerUid);
 return data;
}
function same(a,b){
 const sort=x=>[...x].sort((i,j)=>i.id.localeCompare(j.id));
 return root.SCCloudMerge.same(sort(a),sort(b));
}
async function createBackup(folderId,records){
 const now=new Date().toISOString();
 const name=PREFIX+now.replace(/[:.]/g,'-')+'_'+crypto.randomUUID()+'.json';
 const payload=JSON.stringify({app:'SalvaCivici',schema:1,ownerUid:current.uid,createdAt:now,records});
 if(new TextEncoder().encode(payload).length>MAX_BYTES)
   throw Error('Archivio troppo grande per il backup sperimentale. Usa l’esportazione JSON locale.');
 const boundary='sc-'+crypto.randomUUID().replace(/-/g,'');
 const meta=JSON.stringify({name,mimeType:'application/json',parents:[folderId]});
 const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+
   '\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+payload+'\r\n--'+boundary+'--';
 const response=await fetchGoogle(UPLOAD,{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
 const saved=await response.json();
 if(!saved.id)throw Error('Google Drive non ha confermato il salvataggio.');
 // Verifica effettiva: rileggi il file appena creato prima di dichiarare successo.
 const actual=await download(saved.id);
 if(!same(records,actual.records))throw Error('Contenuto Drive non corrispondente al backup inviato.');
 return saved;
}

/* Un backup remoto non modifica mai l'archivio finché l'utente non approva
 * il recupero. I record preesistenti restano intatti, anche su UID conflittuali.
 */
async function recoveryCandidate(){
 if(!current?.uid)throw Error('Effettua l’accesso Google.');
 const uid=current.uid;
 const parent=await folder(false);
 if(!parent)return{count:0,missing:[],reason:'no-folder'};
 const existing=await backups(parent);
 if(!existing.length)return{count:0,missing:[],reason:'no-backup'};
 const backupFile=existing[0];
 const snapshot=await download(backupFile.id);
 if(!current||current.uid!==uid)throw Error('Account Google cambiato: recupero bloccato.');
 const local=await root.SCDrive?.getRecords?.();
 if(!Array.isArray(local)||local.some(r=>!root.SC?.isRecord?.(r)))
   throw Error('Archivio locale non disponibile o non valido.');
 const byId=new Map(local.map(r=>[r.id,r]));
 if(byId.size!==local.length)throw Error('ID duplicati sul dispositivo.');
 // Il backup non deve riempire di nuovo l'Archivio se il civico
 // e' gia' conservato nella Mappa permanente dopo la pulizia volontaria.
 const published=await root.SCDrive?.getMapRecords?.()||[];
 if(!Array.isArray(published)||published.some(r=>!root.SC.isRecord(r)))
   throw Error('Archivio Mappa non disponibile: ripristino sospeso.');
 const mapById=new Map(published.map(r=>[r.id,r]));
 const missing=snapshot.records.filter(r=>!byId.has(r.id)&&!mapById.has(r.id));
 const conflicts=snapshot.records.filter(r=>byId.has(r.id)&&
   !root.SCCloudMerge.same(r,byId.get(r.id)));
 if(conflicts.length)throw Error('Sono presenti '+conflicts.length+' civici con lo stesso ID e dati differenti. Nessuna importazione automatica.');
 if(missing.some(r=>local.some(l=>root.SC.isSameCivic(l,r))))
   throw Error('Uno o più civici già esistono con un ID differente. Verifica prima i duplicati.');
 return{count:snapshot.records.length,missing,uid,local,backupFile};
}
let recoveryBusy=false;
async function checkRecovery(){
 if(!current||!navigator.onLine||recoveryBusy||busy)return;
 recoveryBusy=true;
 try{
   const candidate=await recoveryCandidate();
   if(!current||current.uid!==candidate.uid)return;
   showRecoveryButton(candidate.missing.length>0);
   if(candidate.missing.length){
     status('Su Drive ci sono '+candidate.missing.length+' civici mancanti. Apri «Opzioni di sicurezza» per recuperarli.',true);
   }else if(candidate.count>0){
     status('Backup Drive presente: '+candidate.count+' civici; nessun recupero locale necessario.');
   }
 }catch(e){
   showRecoveryButton(false);
   status('Controllo recupero Drive: '+String(e.message||e).slice(0,160)+'. Nessun civico modificato.',true);
 }finally{recoveryBusy=false;}
}
async function restoreMissing(){
 if(recoveryBusy||busy){status('Operazione già in corso. Riprova dopo il controllo.');return;}
 if(!current){status('Accedi prima con Google per recuperare i civici.',true);return;}
 recoveryBusy=true;showRecoveryButton(false);
 const uid=current.uid;
 try{
   const candidate=await recoveryCandidate();
   if(!current||uid!==current.uid)throw Error('Account modificato durante il controllo.');
   if(!candidate.missing.length){status('Nessun civico mancante: archivio già aggiornato.');return;}
   const confirmed=await root.SCDrive?.confirmAction?.(
     'Recuperare i civici dal tuo Drive?',
     'Nel backup personale ci sono '+candidate.missing.length+' civici mancanti su questo dispositivo. Li aggiungerò senza modificare quelli esistenti. Per inviarli al cloud dovrai poi sincronizzare nell’Archivio.',
     'Recupera civici');
   if(!confirmed){status('Ripristino annullato. Il backup e i civici rimangono invariati.');return;}
   if(!current||uid!==current.uid)throw Error('Account cambiato, ripristino bloccato.');
   const latest=await root.SCDrive.getRecords();
   if(!root.SCCloudMerge.same([...latest].sort((a,b)=>a.id.localeCompare(b.id)),
     [...candidate.local].sort((a,b)=>a.id.localeCompare(b.id))))
     throw Error('Archivio modificato durante la conferma. Nessun civico ripristinato; riprova.');
   if(!root.SCDrive?.addRecoveredRecords)throw Error('Ripristino locale non disponibile.');
   await root.SCDrive.addRecoveredRecords(candidate.missing);
   const final=await root.SCDrive.getRecords();
   if(candidate.missing.some(r=>!final.some(x=>x.id===r.id&&root.SCCloudMerge.same(x,r))))
     throw Error('Verifica ripristino non riuscita. Controlla l’Archivio prima di sincronizzare.');
   status('Recuperati '+candidate.missing.length+' civici dal backup Drive. Ora sincronizza dall’Archivio.');
 }catch(e){status('Recupero non completato: '+String(e.message||e).slice(0,165),true);showRecoveryButton(true);}
 finally{recoveryBusy=false;}
}
/* La copia tecnica comprende i civici pubblicati e la coda Archivio;
 * le correzioni ancora in Archivio prevalgono sul vecchio pin pubblicato.
 * Non riscrive i dati locali o il cloud. */
async function fullSnapshot(records,uid){
 validate(records,uid);
 const reader=root.SCDrive?.getMapRecords;
 if(typeof reader!=='function')
   throw Error('Mappa permanente non disponibile: backup sospeso per evitare copie parziali.');
 const published=await reader();
 validate(published,uid);
 const byId=new Map(published.map(r=>[r.id,r]));
 for(const record of records)byId.set(record.id,record);
 const complete=[...byId.values()];
 validate(complete,uid);
 return complete;
}
async function backup(records,{manual=false}={}){
 if(busy)return{ok:false,reason:'busy'};
 if(!current?.token){
   if(manual)status('Cloud collegato: autorizza Google Drive per creare una copia di sicurezza.',true);
   return{ok:false,reason:'not-authorized'};
 }
 if(!navigator.onLine){status('Offline: civici al sicuro sul dispositivo. Backup Drive da ripetere.',true);return{ok:false,reason:'offline'};}
 busy=true;
 const uid=current.uid;
 status('Verifico il backup di Archivio e Mappa permanente…');
 try{
   const complete=await fullSnapshot(records,uid);
   if(!complete.length){
     status('Nessun civico da salvare: Archivio e Mappa permanente sono vuoti.');
     return{ok:false,reason:'empty'};
   }
   if(!current||current.uid!==uid)throw Error('Account cambiato durante la preparazione: backup sospeso.');
   const folderId=await folder(false);
   const older=folderId?await backups(folderId):[];
   if(older.length){
     const latest=await download(older[0].id);
     if(!current||current.uid!==uid)throw Error('Account cambiato durante il controllo.');
     if(same(latest.records,complete)){
       status('Backup Drive già verificato · '+complete.length+' civici (Archivio e Mappa permanente).');
       return{ok:true,unchanged:true,count:complete.length};
     }
     const allIds=new Set(complete.map(r=>r.id));
     if(latest.records.some(r=>!allIds.has(r.id))){
       status('Backup precedente con civici assenti da Archivio e Mappa: nessuna copia parziale salvata. Controlla il recupero.',true);
       return{ok:false,reason:'remote-only'};
     }
   }
   const parentId=folderId||await folder(true);
   const saved=await createBackup(parentId,complete);
   status('Backup tecnico Drive verificato · '+complete.length+' civici (Archivio e Mappa permanente).');
   return{ok:true,count:complete.length,fileId:saved.id};
 }catch(e){
   status(textError(e),true);
   return{ok:false,reason:'error'};
 }finally{busy=false;}
}
async function manualBackup(){
 if(!current){status('Accedi con Google nella sezione Dati: Drive si attiva insieme al cloud.',true);return;}
 const records=await root.SCDrive?.getRecords?.();
 if(!records){status('Archivio locale non disponibile.',true);return;}
 await backup(records,{manual:true});
}
function init({getRecords,getMapRecords,addRecoveredRecords,confirmAction}){
 Object.assign(root.SCDrive,{getRecords,getMapRecords,addRecoveredRecords,confirmAction});
 $('drive-backup')?.addEventListener('click',()=>void manualBackup());
 $('drive-recover')?.addEventListener('click',()=>void restoreMissing());
 showRecoveryButton(false);
 status('Drive si abilita con lo stesso accesso Google, senza un secondo login.');
}
root.SCDrive={init,authorize,isAuthorized,showPendingAuthorization,clear,checkRecovery,restoreMissing,backupAfterSync:records=>backup(records),getRecords:null,getMapRecords:null,addRecoveredRecords:null,confirmAction:null};
})(window);
