/* Cloud sync beta 0.6.4 — Firebase Google + Email/Password e Firestore REST.
   Nessun client secret. Il salvataggio locale continua a funzionare anche offline.
   Nessun invio in background: solo consenso esplicito al pulsante Sincronizza. */
(function(root){
'use strict';
const $=id=>document.getElementById(id),KEY='sc-cloud-settings-v1',SESSION='sc-cloud-session-v1',BASE='sc-cloud-base-',OWNER='sc-cloud-owner-v1';
const DEFAULT_CONFIG={projectId:'salvacivici-mappa-recapito',apiKey:'AIzaSyAZfrIhmPy25_xDLIvb2SMPPsw_5H8hnCg'};
const M=root.SCCloudMerge;
let engine=null,config=null,session=null,token='',expires=0,busy=false;
let lastAutoPull=0;
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch(e){return fallback}}
function store(key,x){try{localStorage.setItem(key,JSON.stringify(x))}catch(e){throw Error('Spazio di archiviazione locale non disponibile.');}}
function remove(key){try{localStorage.removeItem(key)}catch(e){}}
function message(text,warning){const n=$('cloud-status');n.textContent=text;n.classList.toggle('warning',!!warning);}
function errorMessage(e){
 const m=String(e?.message||e||'Errore di rete');
 if(/EMAIL_NOT_FOUND|INVALID_PASSWORD|INVALID_LOGIN_CREDENTIALS/.test(m))return 'Email o password non corretti.';
 if(/EMAIL_EXISTS/.test(m))return 'Questo account esiste già: usa Accedi.';
 if(/OPERATION_NOT_ALLOWED/.test(m))return 'Attiva accesso Email/Password in Firebase Authentication.';
 if(/PERMISSION_DENIED/.test(m))return 'Accesso negato: verifica le regole di sicurezza di Firestore.';
 if(/RESOURCE_EXHAUSTED/.test(m))return 'Limite di utilizzo Firebase raggiunto.';
 if(/UNAUTHENTICATED|INVALID_ID_TOKEN|TOKEN_EXPIRED/.test(m))return 'Accesso scaduto: effettua nuovamente l’accesso.';
 return m.slice(0,230);
}
async function api(url,options){
 const resp=await fetch(url,options);
 const body=await resp.json().catch(()=>({}));
 if(!resp.ok){
   const e=new Error(body.error?.message||body.error?.status||'HTTP '+resp.status);
   e.status=resp.status;throw e;
 }
 return body;
}
function configOk(x){return x&&/^[a-z][a-z0-9-]{4,60}$/.test(x.projectId)&&/^[A-Za-z0-9_-]{20,}$/.test(x.apiKey);}
function baseKey(){return BASE+(config?.projectId||'')+'-'+(session?.uid||'');}
function baseSnapshot(){const data=read(baseKey(),null);return Array.isArray(data?.records)?data.records:[];}
function saveBase(records){store(baseKey(),{records,at:new Date().toISOString()});}
function sameRecords(a,b){return M.same([...a].sort((x,y)=>x.id.localeCompare(y.id)),[...b].sort((x,y)=>x.id.localeCompare(y.id)));}
function showState(){
 const authenticated=!!session?.uid,connected=!!configOk(config);
 $('cloud-config').hidden=connected;
 $('cloud-login-panel').hidden=!connected||authenticated;
 $('cloud-account').hidden=!connected||!authenticated;
 $('cloud-identity').textContent=authenticated?'Account: '+session.email:'';
}
async function saveConfiguration(){
 const next={projectId:$('cloud-project').value.trim(),apiKey:$('cloud-api-key').value.trim()};
 if(!configOk(next)){message('Configurazione Firebase non valida.',true);return;}
 if(config&&!M.same(config,next)){session=null;token='';expires=0;remove(SESSION);}
 config=next;store(KEY,config);
 showState();message('Cloud configurato. Accedi con lo stesso account su iPhone e iPad.');
}
function acceptGoogleAuth(data){
 // Non scambiare due account Firebase: condividere un indirizzo email non
 // dimostra che appartengano allo stesso UID o allo stesso archivio.
 const owner=read(OWNER,null);
 if(owner&&owner!==data?.localId)
   throw Error('Account Google diverso da quello dell’archivio già sincronizzato. Prima collega gli account Firebase; nessun dato modificato.');
 if(session?.uid&&session.uid!==data?.localId)
   throw Error('Hai già una sessione con un altro account. Per conservare i civici occorre collegare gli account prima di cambiarla.');
 useCredentials(data);
 void pullIfSafe();
}
function useCredentials(data){
 if(!data?.localId||!data?.refreshToken||!data?.idToken)throw Error('Firebase non ha restituito una sessione valida.');
 token=data.idToken;expires=Date.now()+Math.max(30,Number(data.expiresIn||3600)-120)*1000;
 session={uid:data.localId,email:data.email||session?.email||'',refreshToken:data.refreshToken};
 store(SESSION,session);
 $('cloud-password').value='';
 showState();
 message('Accesso riuscito. Controlla l’Archivio, poi trascina verso il basso per sincronizzare.');
}
async function login(mode){
 if(busy)return;
 if(!configOk(config)){message('Configura prima Firebase.',true);return;}
 const email=$('cloud-email').value.trim(),password=$('cloud-password').value;
 if(!email||password.length<6){message('Inserisci email e password (almeno 6 caratteri).',true);return;}
 busy=true;showState();message('Collegamento al tuo archivio cloud…');
 try{
   const op=mode==='register'?'signUp':'signInWithPassword';
   const data=await api('https://identitytoolkit.googleapis.com/v1/accounts:'+op+'?key='+encodeURIComponent(config.apiKey),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})
   });
   useCredentials(data);
 }catch(e){message(errorMessage(e),true)}
 finally{busy=false;showState();if(session?.uid)void pullIfSafe();}
}
async function freshToken(){
 if(!session?.refreshToken)throw Error('Accedi prima al tuo account cloud.');
 if(token&&Date.now()<expires)return token;
 const params='grant_type=refresh_token&refresh_token='+encodeURIComponent(session.refreshToken);
 const data=await api('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(config.apiKey),{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params
 });
 if(!data.id_token||!data.refresh_token||data.user_id!==session.uid)throw Error('Sessione non valida: accedi nuovamente.');
 token=data.id_token;expires=Date.now()+Math.max(30,Number(data.expires_in||3600)-120)*1000;
 session.refreshToken=data.refresh_token;
 store(SESSION,session);return token;
}
function cloudUrl(){
 return 'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(config.projectId)+
   '/databases/(default)/documents/users/'+encodeURIComponent(session.uid)+'/snapshots/main';
}
async function getCloud(){
 const bearer=await freshToken();
 const res=await fetch(cloudUrl(),{headers:{Authorization:'Bearer '+bearer},cache:'no-store'});
 if(res.status===404)return{records:[],updateTime:null};
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(data.error?.message||'Firestore HTTP '+res.status);
 const raw=data.fields?.payload?.stringValue;
 let records;
 try{records=JSON.parse(raw)}catch(e){throw Error('Archivio cloud non valido: nessun dato modificato.');}
 if(!Array.isArray(records)||!records.every(root.SC.isRecord))throw Error('Il cloud contiene record non validi.');
 return{records,updateTime:data.updateTime};
}
async function setCloud(records,updateTime){
 const payload=JSON.stringify(records);
 if(new TextEncoder().encode(payload).length>700*1024)throw Error('Archivio troppo grande per questa versione; nessun dato sovrascritto.');
 const u=cloudUrl()+(updateTime?'?currentDocument.updateTime='+encodeURIComponent(updateTime):'?currentDocument.exists=false');
 const resp=await fetch(u,{method:'PATCH',headers:{'Authorization':'Bearer '+await freshToken(),'Content-Type':'application/json'},
    body:JSON.stringify({fields:{payload:{stringValue:payload},format:{integerValue:'1'}}})});
 const data=await resp.json().catch(()=>({}));
 if(!resp.ok){
   if(resp.status===409||resp.status===412||/FAILED_PRECONDITION|ABORTED/.test(data.error?.message||''))throw Error('Un altro dispositivo ha aggiornato il cloud durante l’invio. Riprova: non è stato sovrascritto nulla.');
   throw Error(data.error?.message||'Google Cloud HTTP '+resp.status);
 }
 return data.updateTime;
}
async function pullIfSafe({quiet=false}={}){
 if(busy||!session?.uid||!navigator.onLine)return;
 if($('edit-dialog')?.open)return; // Non sovrapporre un aggiornamento a una modifica in corso.
 const owner=read(OWNER,null);
 if(owner&&owner!==session.uid){if(!quiet)message('Questo dispositivo è associato a un altro account. Nessun dato importato.',true);return;}
 busy=true;showState();
 try{
   const before=await engine.getRecords(),saved=read(baseKey(),null);
   if(saved?.records&& !sameRecords(before,saved.records)){
     if(!quiet)message('Hai civici locali da controllare: per inviarli, trascina verso il basso nell’Archivio.');return;
   }
   if(!saved&&before.length){
     if(!quiet)message('Archivio locale non ancora collegato: controlla i civici prima della prima sincronizzazione.');return;
   }
   const cloud=await getCloud();
   if(!sameRecords(before,await engine.getRecords()))return;
   const changed=!sameRecords(before,cloud.records);
   if(changed)await engine.applySnapshot(cloud.records);
   if(!saved||!sameRecords(saved.records,cloud.records))saveBase(cloud.records);
   store(OWNER,session.uid);
   if(changed||!quiet)message('Archivio aggiornato dal cloud: '+cloud.records.length+' civici. Le nuove modifiche restano da confermare con Sincronizza.');
 }catch(e){if(!quiet)message('Lettura cloud non disponibile: '+errorMessage(e),true)}
 finally{busy=false;showState();}
}
function autoReceive(){
 // Nessuna trasmissione di modifiche: solo GET Firestore e applicazione protetta.
 if(!session?.uid||!navigator.onLine||document.visibilityState==='hidden'||busy)return;
 if(Date.now()-lastAutoPull<12000)return;
 lastAutoPull=Date.now();
 void pullIfSafe({quiet:true});
}
async function synchronize({confirm=true}={}){
 if(busy)return{ok:false,description:'Sincronizzazione già in corso.'};
 if(!navigator.onLine){const description='Non c’è connessione: i civici restano salvati sul dispositivo.';message(description,true);return{ok:false,description};}
 if(!session?.uid){const description='Accedi prima con Google nella sezione Dati.';message(description,true);return{ok:false,description};}
 busy=true;showState();message('Confronto i civici di questo dispositivo con quelli nel cloud…');
 try{
   const owner=read(OWNER,null);
   if(owner&&owner!==session.uid)throw Error('Archivio locale già associato a un altro account: non verrà condiviso.');
   const before=await engine.getRecords(),cloud=await getCloud(),base=baseSnapshot();
   if(!before.every(root.SC.isRecord))throw Error('Archivio locale non valido; nessuna modifica effettuata.');
   const result=M.merge(base,before,cloud.records);
   if(result.conflicts.length){
     const description='Conflitto su '+result.conflicts.length+' civici modificati su entrambi i dispositivi. Nessun dato sovrascritto. Risolvi le differenze prima di sincronizzare.';
     message(description,true);return{ok:false,description};
   }
   const count=result.records.length,changedCloud=!sameRecords(result.records,cloud.records),
     changedLocal=!sameRecords(result.records,before);
   // Lo swipe esplicito in Archivio è il consenso all'invio.
   // La conferma resta disponibile per eventuali comandi alternativi.
   if(confirm){
     const confirmation=await engine.confirmAction('Sincronizzare i dispositivi?',
       'Risultato: '+count+' civici; '+(changedCloud?'aggiorno il cloud':'cloud già aggiornato')+
       (changedLocal?', aggiorno anche questo dispositivo.':'.')+
       ' I dati locali non saranno inviati automaticamente. Procedo?','Sincronizza');
     if(!confirmation){message('Operazione annullata, dati invariati.');return{ok:false,description:'Operazione annullata.'};}
   }
   if(!navigator.onLine)throw Error('Connessione persa: dati locali conservati.');
   if(!sameRecords(before,await engine.getRecords()))throw Error('L’Archivio è stato modificato durante la verifica. Riprova.');
   if(changedCloud){message('Invio le modifiche nel cloud…');await setCloud(result.records,cloud.updateTime);}
   if(!sameRecords(before,await engine.getRecords()))throw Error('L’Archivio è stato modificato durante la sincronizzazione. Il cloud è salvo; riprova prima di apportare altre correzioni.');
   if(changedLocal)await engine.applySnapshot(result.records);
   saveBase(result.records);
   store(OWNER,session.uid);
   message('Sincronizzati '+count+' civici. iPhone e iPad vedranno gli stessi dati dopo la sincronizzazione sul rispettivo dispositivo.');
   engine.toast('Sincronizzazione cloud completata.');
   return{ok:true,count,changedCloud,changedLocal};
 }catch(e){
   const description='Sincronizzazione non completata: '+errorMessage(e);
   message(description,true);
   return{ok:false,description};
 }
 finally{busy=false;showState();}
}
function logout(){
 session=null;token='';expires=0;remove(SESSION);
 if(root.SCGoogleAuth?.logout)void root.SCGoogleAuth.logout();
 showState();message('Disconnesso dal cloud. I civici locali rimangono sul dispositivo.');
}
function init(options){
 engine=options;config=DEFAULT_CONFIG;session=read(SESSION,null);
 // La configurazione web Firebase è pubblica, identica per entrambi i dispositivi.
 // Ignora eventuali parametri di prova archiviati da vecchie versioni.
 $('cloud-project').value=config.projectId;
 $('cloud-api-key').value=config.apiKey;
 $('cloud-save-config').addEventListener('click',()=>void saveConfiguration());
 $('cloud-login').addEventListener('click',()=>void login('login'));
 $('cloud-register').addEventListener('click',()=>void login('register'));
 $('cloud-logout').addEventListener('click',logout);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')autoReceive();});
 window.addEventListener('focus',autoReceive);
 window.addEventListener('pageshow',autoReceive);
 window.addEventListener('online',autoReceive);
 document.querySelector('[data-tab="records"]')?.addEventListener('click',autoReceive);
 document.querySelector('[data-tab="data"]')?.addEventListener('click',autoReceive);
 // Controllo discreto ogni 30 secondi SOLO mentre l'app è aperta in primo piano.
 // Non genera scritture cloud o traffico quando è in background.
 setInterval(autoReceive,30000);
 showState();
 if(session?.uid)void pullIfSafe();
 message(session?'Cloud pronto. Apri l’Archivio e trascina verso il basso per sincronizzare.':
   'Nessun accesso cloud: tutti i civici restano locali finché non configuri e sincronizzi.');
}
root.SCCloud={init,acceptGoogleAuth,notice:message,syncFromArchive:()=>synchronize({confirm:false})};
})(window);
