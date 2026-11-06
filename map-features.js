/* Beta 0.6.63 — heading affidabile iPhone e sincronizzazione con orientamento schermo. */
(function(root){
'use strict';
const OSM='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const IMAGERY='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ATTR='Immagini: &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, Vantor, Earthstar Geographics e GIS User Community';
let rotationPromise=null;
let autoCompassPermission=null,autoCompassDenied=false;
// Questo metodo deve essere chiamato dentro il click sul tab Mappa,
// PRIMA del caricamento asincrono di Leaflet (user activation Safari).
function primeAutoCompass(){
 const Orientation=root.DeviceOrientationEvent;
 if(typeof Orientation!=='function')return Promise.resolve(false);
 if(autoCompassDenied)return Promise.resolve(false);
 if(autoCompassPermission)return autoCompassPermission;
 try{
  const asked=typeof Orientation.requestPermission==='function'
    ?Orientation.requestPermission():Promise.resolve('granted');
  autoCompassPermission=Promise.resolve(asked).then(result=>{
   if(result!=='granted'){autoCompassDenied=true;return false;}
   return true;
  }).catch(()=>{autoCompassDenied=true;return false;});
 }catch(_){autoCompassDenied=true;autoCompassPermission=Promise.resolve(false);}
 return autoCompassPermission;
}
async function load(){
 const L=await root.SCMapReview.loadLeaflet();
 if(typeof L.Map?.prototype?.setBearing==='function')return L;
 if(!rotationPromise){
  rotationPromise=new Promise(resolve=>{
   const script=document.createElement('script');
   script.src='./assets/leaflet-rotate-0.3.0.min.js';
   const timer=setTimeout(()=>resolve(L),9000);
   script.onload=()=>{clearTimeout(timer);resolve(L);};
   script.onerror=()=>{clearTimeout(timer);resolve(L);};
   document.head.appendChild(script);
  });
 }
 await rotationPromise;
 return L; // Fallback: il caricamento mappa continua anche se la rotazione non è supportata.
}
function create({L,map,baseButton,compassButton,status,onTileLoad,onTileError}){
 const canRotate=typeof map.setBearing==='function';
 let satellite=false,compassOn=false,orientationListener=null;
 const street=L.tileLayer(OSM,{
  maxZoom:21,maxNativeZoom:19,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
 });
 let imagery=null;
 function configure(layer){
  layer.on('tileload',()=>onTileLoad?.());
  layer.on('tileerror',()=>onTileError?.());
  return layer;
 }
 configure(street);street.addTo(map);
 let statusTimer=null;
 function clearStatus(){
  if(statusTimer!==null){clearTimeout(statusTimer);statusTimer=null;}
  if(status){status.hidden=true;status.textContent='';}
 }
 function setStatus(msg){
  if(!status)return;
  clearStatus();
  status.hidden=false;status.textContent=msg;
  // Solo avvisi temporanei, per non coprire stabilmente i civici.
  statusTimer=setTimeout(()=>{status.hidden=true;statusTimer=null;},5000);
 }
 function toggleBasemap(){
  const nextSatellite=!satellite;
  if(nextSatellite&&!imagery){
   imagery=configure(L.tileLayer(IMAGERY,{maxZoom:21,maxNativeZoom:19,attribution:SAT_ATTR}));
  }
  const previous=satellite?imagery:street,next=nextSatellite?imagery:street;
  if(typeof map.removeLayer==='function')map.removeLayer(previous);
  else previous.remove?.();
  next.addTo(map);satellite=nextSatellite;
  baseButton.textContent=satellite?'▤ Stradale':'▧ Satellite';
  baseButton.setAttribute('aria-pressed',satellite?'true':'false');
 }
 let compassAttempt=0,compassSource=null,headingReady=false,compassWarmup=null;
 const screenAngle=()=>{
  const angle=Number(root.screen?.orientation?.angle??root.orientation??0);
  return Number.isFinite(angle)?angle:0;
 };
 function stopCompass(){
  compassAttempt++;
  if(compassWarmup!==null){clearTimeout(compassWarmup);compassWarmup=null;}
  compassSource=null;headingReady=false;
  clearStatus();
  if(orientationListener){
   root.removeEventListener('deviceorientation',orientationListener);
   root.removeEventListener('deviceorientationabsolute',orientationListener);
   orientationListener=null;
  }
  if(compassOn&&typeof map.stopHeadingUp==='function')map.stopHeadingUp();
  compassOn=false;
  compassButton.textContent='↗ Segui bussola';
  compassButton.setAttribute('aria-pressed','false');
 }
 function heading(event){
  if(!compassOn)return;
  let angle=null;
  // Safari iOS: webkitCompassHeading è il riferimento al nord MAGNETICO.
  // alpha può invece essere relativo a un'origine casuale, anche quando
  // deviceorientationabsolute e deviceorientation arrivano in parallelo.
  const appleHeading=Number.isFinite(event.webkitCompassHeading)&&
    event.webkitCompassHeading>=0&&event.webkitCompassHeading<360;
  if(appleHeading){
   const accuracy=event.webkitCompassAccuracy;
   if(Number.isFinite(accuracy)&&(accuracy<0||accuracy>45))return;
   compassSource='webkit';angle=event.webkitCompassHeading;
  }else{
   // Su iPhone non sostituire mai un heading WebKit con 360-alpha.
   if(compassSource==='webkit'||typeof root.DeviceOrientationEvent?.requestPermission==='function')return;
   if(event.absolute!==true||!Number.isFinite(event.alpha))return;
   compassSource='absolute';angle=(360-event.alpha)%360;
  }
  // La bussola misura la parte ALTA del telefono; in modalità landscape
  // la parte alta dello schermo può essere ruotata rispetto al dispositivo.
  angle=((angle-screenAngle())%360+360)%360;
  if(typeof map.setHeading==='function')map.setHeading(angle,{ease:.22,deadzone:1.5});
  else map.setBearing(-angle);
  headingReady=true;
  if(compassWarmup!==null){clearTimeout(compassWarmup);compassWarmup=null;}
  clearStatus();
  compassButton.setAttribute('aria-pressed','true');
  compassButton.textContent='◉ Bussola attiva';
 }
 function activateCompass(permission,isStillVisible){
  const attempt=++compassAttempt;
  return Promise.resolve(permission).then(result=>{
   if(attempt!==compassAttempt||(isStillVisible&&!isStillVisible()))return false;
   if(result!==true&&result!=='granted'){
    setStatus('Bussola non autorizzata. Tocca Segui bussola per riprovare.');
    return false;
   }
   if(compassOn)return true;
   compassOn=true;headingReady=false;compassSource=null;
   compassButton.setAttribute('aria-pressed','false');
   compassButton.textContent='◌ Attendo la bussola…';
   orientationListener=heading;
   root.addEventListener('deviceorientation',heading);
   root.addEventListener('deviceorientationabsolute',heading);
   clearStatus();
   compassWarmup=setTimeout(()=>{
    compassWarmup=null;
    if(compassOn&&!headingReady)
     setStatus('Bussola iPhone non calibrata o dati del nord non disponibili. Ruota lentamente il telefono oppure disattiva la bussola.');
   },2500);
   return true;
  }).catch(()=>{
   if(attempt===compassAttempt)setStatus('Non è stato possibile attivare la bussola.');
   return false;
  });
 }
 function startCompass(){
  if(compassOn){stopCompass();return;}
  if(!canRotate){setStatus('Rotazione non disponibile su questo dispositivo.');return;}
  const Orientation=root.DeviceOrientationEvent;
  if(typeof Orientation!=='function'){
   setStatus('Sensore bussola non disponibile: puoi ruotare la mappa con due dita.');return;
  }
  let permission;
  try{
   permission=typeof Orientation.requestPermission==='function'
    ?Orientation.requestPermission():Promise.resolve('granted');
  }catch(_){setStatus('Autorizzazione bussola non disponibile.');return;}
  autoCompassDenied=false;
  autoCompassPermission=Promise.resolve(permission).then(result=>{
   if(result!=='granted'){autoCompassDenied=true;return false;}
   return true;
  }).catch(()=>{autoCompassDenied=true;return false;});
  return activateCompass(permission);
 }
 function autoStartCompass(permission,isStillVisible){
  if(!canRotate||!permission)return Promise.resolve(false);
  return activateCompass(permission,isStillVisible);
 }
 baseButton.addEventListener('click',toggleBasemap);
 compassButton.disabled=!canRotate;
 compassButton.title=canRotate?'Orientamento tramite bussola; tocca per attivare/disattivare':'Rotazione non disponibile';
 compassButton.addEventListener('click',startCompass);
 map.on?.('rotatestart',()=>{if(compassOn)stopCompass();});
 return {pause:stopCompass,isSatellite:()=>satellite,canRotate,autoStartCompass};
}
root.SCMapFeatures={load,create,primeAutoCompass};
})(window);
