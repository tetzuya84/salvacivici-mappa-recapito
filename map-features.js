/* Beta 0.6.20 — cartografia condivisa: Satellite, rotazione a due dita, bussola opzionale. */
(function(root){
'use strict';
const OSM='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const IMAGERY='https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SAT_ATTR='Immagini: &copy; <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, Vantor, Earthstar Geographics e GIS User Community';
let rotationPromise=null;
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
 function setStatus(msg){
  if(!status)return;
  status.hidden=false;status.textContent=msg;
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
 function stopCompass(){
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
  let angle=Number.isFinite(event.webkitCompassHeading)&&event.webkitCompassHeading>=0?
   event.webkitCompassHeading:null;
  if(angle===null&&event.absolute===true&&Number.isFinite(event.alpha))
   angle=(360-event.alpha)%360;
  if(angle===null)return;
  if(typeof map.setHeading==='function')map.setHeading(angle,{ease:.24,deadzone:2});
  else map.setBearing(-angle);
  compassButton.textContent='◉ Bussola attiva';
 }
 function startCompass(){
  if(compassOn){stopCompass();return;}
  if(!canRotate){setStatus('Rotazione non disponibile su questo dispositivo.');return;}
  const Orientation=root.DeviceOrientationEvent;
  if(typeof Orientation!=='function'){
   setStatus('Sensore bussola non disponibile: puoi ruotare la mappa con due dita.');
   return;
  }
  // La richiesta su Safari deve partire nel click, prima di qualsiasi await.
  let perm;
  try{perm=typeof Orientation.requestPermission==='function'?Orientation.requestPermission():Promise.resolve('granted');}
  catch(_){setStatus('Autorizzazione bussola non disponibile.');return;}
  Promise.resolve(perm).then(result=>{
   if(result!=='granted'){setStatus('Bussola non autorizzata: resta disponibile la rotazione con due dita.');return;}
   if(compassOn)return;
   compassOn=true;
   compassButton.setAttribute('aria-pressed','true');
   compassButton.textContent='◉ Bussola attiva';
   orientationListener=heading;
   root.addEventListener('deviceorientation',heading);
   root.addEventListener('deviceorientationabsolute',heading);
   setStatus('Bussola attiva. Tocca di nuovo per fermarla; con due dita puoi orientare manualmente.');
  }).catch(()=>setStatus('Non è stato possibile attivare la bussola.'));
 }
 baseButton.addEventListener('click',toggleBasemap);
 compassButton.disabled=!canRotate;
 compassButton.title=canRotate?'Orientamento tramite bussola; tocca per attivare/disattivare':'Rotazione non disponibile';
 compassButton.addEventListener('click',startCompass);
 map.on?.('rotatestart',()=>{if(compassOn)stopCompass();});
 return {pause:stopCompass,isSatellite:()=>satellite,canRotate};
}
root.SCMapFeatures={load,create};
})(window);
