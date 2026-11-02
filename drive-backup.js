/* SalvaCivici Beta 0.6.30 — Google Sign-In unico e backup append-only nel Drive personale.
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
 status('Drive collegato automaticamente con Google ('+email+'). Il backup si aggiorna dopo Sincronizza nell’Archivio.');
 root.SCCloud?.refreshAuthUi?.();
 return true;
}
function clear(){current=null;status('Il Drive si abilita con lo stesso accesso Google.');root.SCCloud?.refreshAuthUi?.();}
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
       status('Drive già aggiornato · '+records.length+' civici. Nessun duplicato creato.');
       return{ok:true,unchanged:true,count:records.length};
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
   status('Backup Drive verificato · '+records.length+' civici. Le copie precedenti restano conservate.');
   return{ok:true,count:records.length,fileId:saved.id};
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
function init({getRecords}){
 root.SCDrive.getRecords=getRecords;
 $('drive-backup')?.addEventListener('click',()=>void manualBackup());
 status('Drive si abilita con lo stesso accesso Google, senza un secondo login.');
}
root.SCDrive={init,authorize,isAuthorized,clear,backupAfterSync:records=>backup(records),getRecords:null};
})(window);
