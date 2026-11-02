/* SalvaCivici Beta 0.6.32 — backup JSON e elenco consultabile Google Sheets.
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
const SHEET_MIME='application/vnd.google-apps.spreadsheet';
const SHEET_PREFIX='Elenco civici - ';

const $=id=>document.getElementById(id);
let current=null,busy=false;
function showRecoveryButton(show){
 const button=$('drive-recover');
 if(button)button.hidden=!show;
}
function showSheetLink(id){
 const link=$('drive-sheet-link');
 if(!link)return;
 link.hidden=!id;
 if(id){link.href='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+'/edit';}
 else link.removeAttribute('href');
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
 showSheetLink(null);
 showRecoveryButton(false);
 status('Drive collegato automaticamente con Google ('+email+'). Controllo i backup disponibili…');
 root.SCCloud?.refreshAuthUi?.();
 void checkRecovery();
 return true;
}
function clear(){current=null;showSheetLink(null);showRecoveryButton(false);status('Il Drive si abilita con lo stesso accesso Google.');root.SCCloud?.refreshAuthUi?.();}
function isAuthorized(uid,email){
 return !!current?.token&&!!uid&&current.uid===uid&&
   String(current.email||'').toLowerCase()===String(email||'').toLowerCase();
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

/* Un file JSON resta la copia di sicurezza autorevole.
 * La conversione CSV -> Fogli Google crea un secondo documento consultabile,
 * mai una nuova sorgente di verita' o un archivio da importare automaticamente.
 * File creati una volta per versione JSON, senza sovrascritture.
 */
function sheetName(backupFile){
 const match=String(backupFile?.name||'').match(/^SalvaCivici_auto_(\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d+Z)_[a-z0-9-]+\.json$/i);
 if(!match)throw Error('Nome backup Drive non riconosciuto.');
 return SHEET_PREFIX+match[1].replace('T',' ');
}
function printable(x){
 const value=String(x??'').replace(/\r/g,' ').replace(/\n/g,' ');
 // Protezione dalle formule nei contenuti importati da CSV in un foglio.
 return /^[=+@-]/.test(value)?"'"+value:value;
}
function csvField(x){return '"'+printable(x).replace(/"/g,'""')+'"';}
function csvForView(records){
 const header=['Civico','Via','Comune','Latitudine','Longitudine','Stato posizione','Precisione GPS (m)','Data salvataggio','ID'];
 const rows=records.map(r=>[
   r.civico,r.via,r.comune,r.lat,r.lon,
   r.positionSource==='manual'?'Pin corretto':r.positionSource==='gps_confirmed'?'Verificato GPS':'Da verificare',
   r.accuracy??'',r.createdAt,r.id
 ]);
 return '\uFEFF'+[header,...rows].map(row=>row.map(csvField).join(',')).join('\r\n')+'\r\n';
}
async function sheetForSnapshot(folderId,backupFile,records){
 const accountUid=current?.uid;
 if(!accountUid)throw Error('Account Google non disponibile.');
 const name=sheetName(backupFile);
 const query="'"+escaped(folderId)+"' in parents and name = '"+escaped(name)+"' and trashed = false";
 const existing=(await list(query,'id,name,mimeType,parents'))
   .filter(x=>x.name===name&&x.mimeType===SHEET_MIME);
 if(existing.length>1)throw Error('Trovati più elenchi per lo stesso backup. Nessuna nuova copia creata.');
 if(existing.length){showSheetLink(existing[0].id);return existing[0];}
 validate(records,accountUid);
 const boundary='sc-sheet-'+crypto.randomUUID().replace(/-/g,'');
 const meta=JSON.stringify({name,parents:[folderId],mimeType:SHEET_MIME,
   description:'Copia di sola consultazione del backup SalvaCivici '+backupFile.name+'. Le modifiche manuali non vengono sincronizzate.'});
 const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+
   '\r\n--'+boundary+'\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n'+csvForView(records)+
   '\r\n--'+boundary+'--';
 const response=await fetchGoogle(UPLOAD,{method:'POST',
   headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
 const saved=await response.json();
 if(!saved.id)throw Error('Fogli Google non ha confermato la creazione dell’elenco.');
 const checked=await (await fetchGoogle(BASE+'/'+encodeURIComponent(saved.id)+
   '?fields=id,name,mimeType,parents')).json();
 if(checked.id!==saved.id||checked.mimeType!==SHEET_MIME||
   !Array.isArray(checked.parents)||!checked.parents.includes(folderId)){
   throw Error('Elenco Google creato ma non verificato. Nessuna modifica al backup JSON.');
 }
 showSheetLink(saved.id);
 return checked;
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
 const missing=snapshot.records.filter(r=>!byId.has(r.id));
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
     status('Su Drive ci sono '+candidate.missing.length+' civici mancanti su questo dispositivo. Premi «Recupera civici dal Drive».',true);
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
async function prepareReadableView(){
 if(busy){status('Operazione Drive già in corso.');return;}
 if(!current?.token){status('Accedi con Google nella sezione Dati per leggere il backup.',true);return;}
 if(!navigator.onLine){status('La creazione dell’elenco richiede Internet.',true);return;}
 busy=true;const uid=current.uid;status('Preparo l’elenco consultabile in Fogli Google…');
 try{
   const parent=await folder(false);
   if(!parent)throw Error('Nessuna cartella di backup presente.');
   const files=await backups(parent);
   if(!files.length)throw Error('Non è ancora presente un backup JSON. Salva una copia su Drive.');
   const data=await download(files[0].id);
   if(!current||current.uid!==uid)throw Error('Account cambiato: nessun elenco creato.');
   await sheetForSnapshot(parent,files[0],data.records);
   status('Elenco pronto · '+data.records.length+' civici. Premi «Apri in Fogli Google».');
 }catch(e){status('Elenco non disponibile: '+String(e.message||e).slice(0,170)+'. Il backup JSON è intatto.',true);}
 finally{busy=false;}
}
async function backup(records,{manual=false}={}){
 if(busy)return{ok:false,reason:'busy'};
 if(!current?.token){
   if(manual)status('Per il backup personale, accedi con Google nella sezione Dati.',true);
   return{ok:false,reason:'not-authorized'};
 }
 if(!navigator.onLine){status('Offline: civici al sicuro sul dispositivo. Backup Drive da ripetere.',true);return{ok:false,reason:'offline'};}
 busy=true;
 const id=current.uid;
 status('Controllo i backup presenti nel tuo Google Drive…');
 try{
   validate(records,id);
   if(!records.length){status('Archivio vuoto: nessuna copia inviata.');return{ok:false,reason:'empty'};}
   const folderId=await folder(false);
   const older=folderId?await backups(folderId):[];
   if(older.length){
     const latest=await download(older[0].id);
     if(!current||current.uid!==id)throw Error('Account cambiato durante il backup.');
     if(same(latest.records,records)){
       try{await sheetForSnapshot(folderId,older[0],records);}
       catch(error){status('Backup JSON confermato; elenco Google non disponibile: '+String(error.message||error).slice(0,110),true);
         return{ok:true,unchanged:true,count:records.length,readable:false};}
       status('Drive già aggiornato · '+records.length+' civici. Elenco consultabile disponibile.');
       return{ok:true,unchanged:true,count:records.length,readable:true};
     }
     // Finché Drive è solo backup e NON l'archivio principale, impedisci
     // che una copia priva di record esistenti sembri la nuova versione.
     const localIds=new Set(records.map(r=>r.id));
     if(latest.records.some(r=>!localIds.has(r.id))){
       status('Drive contiene civici non presenti qui. Nessuna copia parziale salvata: prima confronta i due dispositivi.',true);
       return{ok:false,reason:'remote-only'};
     }
   }
   const parentId=folderId||await folder(true);
   const saved=await createBackup(parentId,records);
   const backupFile={id:saved.id,name:saved.name};
   try{
     await sheetForSnapshot(parentId,backupFile,records);
     status('Backup Drive verificato · '+records.length+' civici. Elenco Fogli Google disponibile.');
     return{ok:true,count:records.length,fileId:saved.id,readable:true};
   }catch(error){
     status('Backup JSON verificato · '+records.length+' civici. Elenco Google non creato: '+String(error.message||error).slice(0,110),true);
     return{ok:true,count:records.length,fileId:saved.id,readable:false};
   }
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
function init({getRecords,addRecoveredRecords,confirmAction}){
 Object.assign(root.SCDrive,{getRecords,addRecoveredRecords,confirmAction});
 $('drive-backup')?.addEventListener('click',()=>void manualBackup());
 $('drive-view')?.addEventListener('click',()=>void prepareReadableView());
 $('drive-recover')?.addEventListener('click',()=>void restoreMissing());
 showSheetLink(null);
 showRecoveryButton(false);
 status('Drive si abilita con lo stesso accesso Google, senza un secondo login.');
}
root.SCDrive={init,authorize,isAuthorized,clear,checkRecovery,restoreMissing,backupAfterSync:records=>backup(records),getRecords:null,addRecoveredRecords:null,confirmAction:null};
})(window);
